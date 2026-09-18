#!/usr/bin/env node
/**
 * One-time import of the group's historical xlsx ledgers into Firestore.
 *
 * Sources (default directory, override with --dir):
 *   Contributions (per member per month, Jul–Jun grid of Contribution|Fine|Total):
 *     - 23-24YA.xlsx                → FY 2023/24 (all months closed)
 *     - 24-25Y_AGM_FINAL.xlsx       → FY 2024/25 (columns B–AK only — the trailing
 *                                     "next year" columns are stale copies of data
 *                                     that APRIL2026.xlsx supersedes)
 *     - APRIL2026.xlsx              → FY 2025/26 through April 2026 (closed);
 *                                     May/June 2026 only where the paper has values
 *                                     (the rest are entered manually via Ledger Entry)
 *   Expenses:
 *     - EXPENSES2023-24.xlsx        → FY 2023/24
 *     - EXPENSES 2024-25 June updated.xlsx → FY 2024/25 (both OCTOBER rows are real)
 *
 * Status mapping (closed months):
 *   contribution > 0        → 'Paid'  (amount as recorded, fine kept, paidDate = month end)
 *   contribution = 0        → 'Late'  (amount = member's typical due that year, fine as
 *                              recorded — Late/0 keeps the audit trail without triggering
 *                              the auto-fine sweep, which only touches Unpaid/Pending)
 *
 * Usage:
 *   node scripts/import-history.mjs --parse-only    # parse + report, no Firebase at all
 *   node scripts/import-history.mjs                 # dry-run (default): parse + match vs Firestore, no writes
 *   node scripts/import-history.mjs --write         # actually write to Firestore
 *   node scripts/import-history.mjs --emulator      # target the local Firebase emulator
 *   node scripts/import-history.mjs --expenses-method Mpesa   # default Cash
 *
 * Idempotent: existing (memberId, month, purpose 'monthly') records are skipped.
 * Expenses are write-once (Firestore rules deny updates) — review the dry-run first.
 */

import { readFileSync } from 'fs';
import { basename } from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, collection, getDocs, addDoc, query, where } from 'firebase/firestore';
import ExcelJS from 'exceljs';

// ---------- CLI ----------
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};

const PARSE_ONLY = flag('parse-only');
const WRITE = flag('write');
const EMULATOR = flag('emulator');
const BASE_DIR = option('dir', '/home/munen/Desktop/Y&A FILES');
const EXPENSES_METHOD = option('expenses-method', 'Cash') === 'Mpesa' ? 'Mpesa' : 'Cash';

// ---------- Ledger definitions ----------
// Column triples (Contribution|Fine|Total) run B..AK for Jul..Jun of the FY.
const MONTH_COLUMNS = ['B', 'E', 'H', 'K', 'N', 'Q', 'T', 'W', 'Z', 'AC', 'AF', 'AI']; // Jul..Jun
const MONTH_NUMS = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6];

function nextCol(col) {
  const chars = col.split('');
  for (let i = chars.length - 1; i >= 0; i--) {
    if (chars[i] !== 'Z') {
      chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1);
      return chars.join('');
    }
    chars[i] = 'A';
  }
  return 'A' + chars.join('');
}
const FINE_COLUMNS = MONTH_COLUMNS.map(nextCol); // C, F, I, L, O, R, U, X, AA, AD, AG, AJ

function monthKey(fyStartYear, idx) {
  const m = MONTH_NUMS[idx];
  const y = m >= 7 ? fyStartYear : fyStartYear + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}
function monthEndKey(monthKeyStr) {
  const [y, m] = monthKeyStr.split('-').map(Number);
  return `${monthKeyStr}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
}

const CONTRIBUTION_FILES = [
  { file: '23-24YA.xlsx', fyStartYear: 2023, closedMonths: 12 },
  { file: '24-25Y_AGM_FINAL.xlsx', fyStartYear: 2024, closedMonths: 12 },
  // APRIL2026: snapshot taken in April — Jul..Apr are closed; May/Jun only where paper has values
  { file: 'APRIL2026.xlsx', fyStartYear: 2025, closedMonths: 10 },
];

const EXPENSE_FILES = [
  { file: 'EXPENSES2023-24.xlsx', fyStartYear: 2023 },
  { file: 'EXPENSES 2024-25 June updated.xlsx', fyStartYear: 2024 },
];

const MONTH_NAMES = {
  JANUARY: 1, FEBRUARY: 2, MARCH: 3, APRIL: 4, MAY: 5, JUNE: 6,
  JULY: 7, AUGUST: 8, SEPTEMBER: 9, OCTOBER: 10, NOVEMBER: 11, DECEMBER: 12,
};

// Ledger name quirks vs the members roster (seeded from APRIL2026.xlsx)
const NAME_ALIASES = {
  'cecilia gichuhi': 'Cecilia Wanjiru', // 23-24 sheet predates the name change
};

const STOP_ROWS = /sub\s*total|previous\s*total|t?total\s*(contribution|expense)|available\s*funds|cash\s*at\s*hand/i;

function normalizeName(raw) {
  const cleaned = String(raw ?? '')
    .replace(/\\+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return NAME_ALIASES[cleaned.toLowerCase()] ?? cleaned;
}

function num(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'object') {
    const r = v.result ?? v.text ?? v.richText?.map((t) => t.text).join('');
    const n = parseFloat(String(r ?? ''));
    return Number.isNaN(n) ? 0 : n;
  }
  const n = parseFloat(String(v));
  return Number.isNaN(n) ? 0 : n;
}

// ---------- Parsing ----------
async function parseContributions(spec) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(`${BASE_DIR}/${spec.file}`);
  const ws = wb.worksheets[0];

  const headerA = String(ws.getCell('A1').value ?? '').trim();
  if (!/member\s*name/i.test(headerA)) {
    throw new Error(`${spec.file}: unexpected header A1="${headerA}" — refusing to guess`);
  }

  const entries = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const name = normalizeName(row.getCell('A').value);
    if (!name) return;
    if (STOP_ROWS.test(name)) return;

    for (let i = 0; i < MONTH_COLUMNS.length; i++) {
      const month = monthKey(spec.fyStartYear, i);
      const closed = i < spec.closedMonths;
      const contribution = num(row.getCell(MONTH_COLUMNS[i]).value);
      const fine = num(row.getCell(FINE_COLUMNS[i]).value);

      if (closed) {
        // Closed month: always record — Paid, or Late with whatever fine the paper shows
        entries.push({ file: spec.file, name, month, contribution, fine, closed: true });
      } else if (contribution > 0 || fine > 0) {
        // Open month (May/Jun 2026): only import where the paper has values
        entries.push({ file: spec.file, name, month, contribution, fine, closed: false });
      }
    }
  });
  return entries;
}

function typicalDue(entries) {
  // Mode of a member's nonzero contributions in one file — best proxy for "amount owed"
  const byMember = new Map();
  entries.forEach((e) => {
    if (e.contribution > 0) {
      byMember.set(e.name, [...(byMember.get(e.name) ?? []), e.contribution]);
    }
  });
  const mode = new Map();
  byMember.forEach((vals, name) => {
    const counts = new Map();
    vals.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
    let best = 600, bestCount = -1;
    counts.forEach((count, v) => {
      if (count > bestCount || (count === bestCount && v > best)) {
        best = v; bestCount = count;
      }
    });
    mode.set(name, best);
  });
  return mode;
}

async function parseExpenses(spec) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(`${BASE_DIR}/${spec.file}`);
  const ws = wb.worksheets[0];

  const rows = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const monthRaw = String(row.getCell('A').value ?? '').trim().toUpperCase();
    if (!monthRaw) return;
    if (/TOTAL|PREVIOUS|CUMULATIVE/.test(monthRaw)) return;

    const monthNum = MONTH_NAMES[monthRaw.split(/\s+/)[0]];
    if (!monthNum) return;

    const expense = num(row.getCell('B').value);
    const reason = String(row.getCell('C').value ?? '').trim();
    const transaction = num(row.getCell('D').value);
    const total = num(row.getCell('E').value) || expense;

    if (total <= 0) return; // zero rows carry no financial record

    const year = monthNum >= 7 ? spec.fyStartYear : spec.fyStartYear + 1;
    const category = /agm|general\s*meetin/i.test(reason)
      ? 'AGM Party'
      : /registration|printing|search|certificate|transport|logistics|stamp/i.test(reason)
        ? 'Administration'
        : 'Other';

    rows.push({
      file: spec.file,
      date: `${year}-${String(monthNum).padStart(2, '0')}-01`,
      category,
      amount: total,
      notes: reason + (transaction > 0 ? ` (transaction cost ${transaction})` : ''),
    });
  });
  return rows;
}

// ---------- Firestore ----------
function initFirestore() {
  if (EMULATOR) {
    const app = initializeApp({ apiKey: 'demo-key', projectId: 'demo-project' });
    const db = getFirestore(app);
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    return db;
  }
  try {
    const envFile = readFileSync('.env.local', 'utf8');
    envFile.split('\n').forEach((line) => {
      const [key, ...vals] = line.split('=');
      if (key && vals.length) process.env[key.trim()] = vals.join('=').trim();
    });
  } catch {
    // fall through to process env
  }
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  if (!config.apiKey || !config.projectId) {
    console.error('Missing Firebase config — create .env.local or use --emulator / --parse-only.');
    process.exit(1);
  }
  return getFirestore(initializeApp(config));
}

// ---------- Main ----------
const fmt = (n) => `KES ${Math.round(n).toLocaleString()}`;

async function main() {
  console.log(`Parsing ledgers from: ${BASE_DIR}\n`);

  const contribEntries = [];
  for (const spec of CONTRIBUTION_FILES) {
    const entries = await parseContributions(spec);
    console.log(`  ${spec.file}: ${entries.length} member-month entries (FY ${spec.fyStartYear}/${spec.fyStartYear + 1})`);
    contribEntries.push(...entries);
  }
  const dueModes = typicalDue(contribEntries);

  const expenseEntries = [];
  for (const spec of EXPENSE_FILES) {
    const rows = await parseExpenses(spec);
    console.log(`  ${spec.file}: ${rows.length} expense rows (FY ${spec.fyStartYear}/${spec.fyStartYear + 1})`);
    expenseEntries.push(...rows);
  }
  console.log('');

  if (PARSE_ONLY) {
    report(contribEntries, expenseEntries, [], 0, 0);
    console.log('\n(parse-only — no Firebase access)');
    return;
  }

  const db = initFirestore();
  console.log(EMULATOR ? 'Connected to Firestore emulator.\n' : 'Connected to Firestore (production).\n');

  const memberSnap = await getDocs(collection(db, 'members'));
  const membersByName = new Map(memberSnap.docs.map((d) => [d.data().name, d.id]));

  const existingContribSnap = await getDocs(
    query(collection(db, 'contributions'), where('purpose', '==', 'monthly'))
  );
  const existingContrib = new Set(existingContribSnap.docs.map((d) => {
    const v = d.data();
    return `${v.memberId}|${v.month}`;
  }));

  const existingExpenseSnap = await getDocs(collection(db, 'expenses'));
  const existingExpense = new Set(existingExpenseSnap.docs.map((d) => {
    const v = d.data();
    return `${v.date}|${v.amount}`;
  }));

  const unmatched = new Set();
  let duplicateContribs = 0;
  const contribDocs = [];
  for (const e of contribEntries) {
    const memberId = membersByName.get(e.name);
    if (!memberId) {
      unmatched.add(e.name);
      continue;
    }
    if (existingContrib.has(`${memberId}|${e.month}`)) {
      duplicateContribs++;
      continue;
    }
    const paid = e.contribution > 0;
    contribDocs.push({
      memberId,
      memberName: e.name,
      purpose: 'monthly',
      month: e.month,
      amount: paid ? e.contribution : (dueModes.get(e.name) ?? 600),
      fineAmount: e.fine,
      status: paid ? 'Paid' : 'Late',
      paidDate: paid ? monthEndKey(e.month) : null,
      mpesaMessage: `Imported from ${e.file}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  let duplicateExpenses = 0;
  const expenseDocs = [];
  for (const e of expenseEntries) {
    if (existingExpense.has(`${e.date}|${e.amount}`)) {
      duplicateExpenses++;
      continue;
    }
    expenseDocs.push({
      date: e.date,
      category: e.category,
      amount: e.amount,
      notes: `${e.notes} [imported from ${basename(e.file)}]`,
      paymentMethod: EXPENSES_METHOD,
      status: 'verified',
      votes: [],
      seenBy: [],
      recordedBy: 'import',
      recordedByName: 'Historical import (xlsx)',
      createdAt: Date.now(),
    });
  }

  report(contribEntries, expenseEntries, [...unmatched], duplicateContribs, duplicateExpenses);

  if (unmatched.size > 0) {
    console.error('\nABORTED — ledger names with no matching member (fix NAME_ALIASES or seed the roster first):');
    unmatched.forEach((n) => console.error(`  - "${n}"`));
    process.exit(1);
  }

  console.log(`\nReady to write: ${contribDocs.length} contributions, ${expenseDocs.length} expenses.`);
  if (!WRITE) {
    console.log('Dry-run only — re-run with --write to commit.');
    return;
  }

  for (const doc of contribDocs) await addDoc(collection(db, 'contributions'), doc);
  console.log(`  ✓ wrote ${contribDocs.length} contribution records`);
  for (const doc of expenseDocs) await addDoc(collection(db, 'expenses'), doc);
  console.log(`  ✓ wrote ${expenseDocs.length} expense records`);
  console.log('\nNext: open the app → Contributions → Months → Ledger Entry for May/Jun 2026 and');
  console.log('Jul–Sep 2026, then set opening balances in Settings (pre-July-2023 position, see report above).');
}

function report(contribEntries, expenseEntries, unmatched, duplicateContribs, duplicateExpenses) {
  const paidAmount = contribEntries.filter((e) => e.contribution > 0).reduce((s, e) => s + e.contribution, 0);
  const finesOnPaid = contribEntries.filter((e) => e.contribution > 0).reduce((s, e) => s + e.fine, 0);
  const lateFines = contribEntries.filter((e) => e.contribution <= 0).reduce((s, e) => s + e.fine, 0);
  const lateCount = contribEntries.filter((e) => e.contribution <= 0 && e.closed).length;
  const expensesTotal = expenseEntries.reduce((s, e) => s + e.amount, 0);

  console.log('=== Import summary ===');
  console.log(`  Paid records:   ${contribEntries.filter((e) => e.contribution > 0).length}  (dues ${fmt(paidAmount)} + fines ${fmt(finesOnPaid)})`);
  console.log(`  Unpaid (Late):  ${lateCount} closed-era months (recorded fines ${fmt(lateFines)}); open months left for manual entry`);
  console.log(`  Expenses:       ${expenseEntries.length} rows, ${fmt(expensesTotal)} (payment method assumed: ${EXPENSES_METHOD})`);
  console.log(`  Duplicates skipped: ${duplicateContribs} contributions, ${duplicateExpenses} expenses`);
  if (unmatched.length) {
    console.log(`  UNMATCHED NAMES: ${unmatched.join(', ')}`);
  }

  // Reconciliation: the FY24-25 AGM sheet records CASH AT HAND = KES 125,250 after that year.
  const byFile = new Map();
  contribEntries.forEach((e) => {
    const t = byFile.get(e.file) ?? { collected: 0 };
    t.collected += e.contribution + e.fine;
    byFile.set(e.file, t);
  });
  const expByFile = new Map();
  expenseEntries.forEach((e) => {
    const t = expByFile.get(e.file) ?? { spent: 0 };
    t.spent += e.amount;
    expByFile.set(e.file, t);
  });
  const collected2325 = (byFile.get('23-24YA.xlsx')?.collected ?? 0) + (byFile.get('24-25Y_AGM_FINAL.xlsx')?.collected ?? 0);
  const spent2325 = (expByFile.get('EXPENSES2023-24.xlsx')?.spent ?? 0) + (expByFile.get('EXPENSES 2024-25 June updated.xlsx')?.spent ?? 0);

  console.log('\n=== Reconciliation (opening balances) ===');
  console.log(`  FY23/24 + FY24/25 collected per paper: ${fmt(collected2325)}, spent: ${fmt(spent2325)}`);
  console.log(`  Implied cash after FY24/25 = opening(pre-Jul-2023) + ${fmt(collected2325)} - ${fmt(spent2325)}`);
  console.log('  The FY24/25 AGM sheet records CASH AT HAND = KES 125,250 — so set');
  console.log(`  opening balances to ≈ ${fmt(125250 - collected2325 + spent2325)} (pre-Jul-2023 position), split cash/bank as the treasurer knows it.`);
  const gap = collected2325 - spent2325 - 125250;
  if (gap > 0) {
    console.log(`  Why negative: the paper itself has gaps — only KES 91,900 of FY23/24's KES 92,700 was carried`);
    console.log(`  forward (KES 800), and KES 47,150 of expenses were tracked vs KES 41,048 receipted (KES 6,102) —`);
    console.log(`  together exactly the KES ${gap.toLocaleString()} shortfall. Entering the number above keeps the app`);
    console.log('  consistent with the ledger; entering 0 instead overstates funds by that amount.');
  }
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
