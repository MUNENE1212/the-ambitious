/**
 * Reset a member's PIN from the command line, with the Admin SDK.
 *
 * This exists for the case the app cannot cover: a member who cannot sign in
 * has no admin dashboard, because the dashboard is behind the same login. The
 * admin Reset PIN button is unreachable for exactly the people who need it
 * most, so recovery has to come from outside the app.
 *
 * It performs the same work as POST /api/admin/members/{id} reset-pin, and the
 * same work as the onboarding claim, because all three are the same operation:
 *
 *   - hash the new PIN into secrets/{id} (rules-denied)
 *   - DELETE pinHash / failedAttempts / lockedUntil from members/{id}
 *   - set mustChangePin so the member chooses their own
 *   - revoke every existing session
 *
 * The deletes are the whole point. Writing a new hash while leaving the old one
 * in members/ changes nothing about the exposure: the replaced PIN stays
 * readable to every signed-in member until the migration script runs, which may
 * be never.
 *
 * Usage:
 *   node scripts/admin-reset-pin.mjs --list
 *   node scripts/admin-reset-pin.mjs --audit
 *   node scripts/admin-reset-pin.mjs --lock-placeholders [--dry-run]
 *   node scripts/admin-reset-pin.mjs --phone 0712345678 --pin 4821 [--dry-run]
 *   node scripts/admin-reset-pin.mjs --name "Denis Munene" --pin 4821
 *
 * Credentials: FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY, or
 * --key /path/to/service-account.json, or Application Default Credentials.
 *
 * Audit trail: Firestore rules deny delete, and this script never deletes a
 * member. It records `pinResetAt` / `pinResetBy` on the member document so the
 * reset is attributable after the fact.
 */

import bcrypt from 'bcryptjs';
import { FieldValue } from 'firebase-admin/firestore';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { adminFirestore, loadEnv } from './admin-db.mjs';

loadEnv();

/**
 * Must stay identical to normalizePhone in src/lib/server/members.ts.
 *
 * Duplicated rather than imported because that module is TypeScript and marked
 * `server-only`, so a plain .mjs script cannot load it. If the two ever drift,
 * this script would stop finding members by the number they actually use — so
 * if you change one, change both.
 */
function normalizePhone(phone) {
  const trimmed = phone.trim();
  if (trimmed.startsWith('0')) return '+254' + trimmed.slice(1);
  if (trimmed.startsWith('254')) return '+' + trimmed;
  return trimmed;
}

const argv = process.argv.slice(2);
const has = (flag) => argv.includes(flag);
const valueOf = (flag) => {
  const i = argv.indexOf(flag);
  return i === -1 ? undefined : argv[i + 1];
};

const DRY_RUN = has('--dry-run');

function connect() {
  if (valueOf('--key')) {
    // admin-db reads credentials from the environment, so lift them out of the
    // key file into the place it already looks. The private key is written with
    // real newlines, which is exactly the form the admin-db loader expects.
    const json = JSON.parse(fs.readFileSync(valueOf('--key'), 'utf8'));
    process.env.FIREBASE_CLIENT_EMAIL = json.client_email;
    process.env.FIREBASE_PRIVATE_KEY = json.private_key;
    process.env.FIREBASE_PROJECT_ID = json.project_id;
  }
  return adminFirestore({ label: 'admin-reset-pin' });
}

/** Members whose PIN hash is still readable, or whose secrets doc is unusable. */
async function audit(db) {
  const members = await db.collection('members').get();
  const secrets = await db.collection('secrets').get();
  const byId = new Map(secrets.docs.map((d) => [d.id, d.data() ?? {}]));

  const rows = [];
  for (const doc of members.docs) {
    const d = doc.data() ?? {};
    const s = byId.get(doc.id);
    const hashInMembers = typeof d.pinHash === 'string' && d.pinHash.length > 0;
    const hashInSecrets = typeof s?.pinHash === 'string' && s?.pinHash.length > 0;
    if (!hashInMembers && hashInSecrets) continue; // healthy, migrated
    if (hashInMembers && hashInSecrets) {
      rows.push({ name: d.name, phone: d.phone, state: 'exposed', note: 'old hash still in members/' });
      continue;
    }
    if (!hashInMembers && !hashInSecrets) {
      rows.push({ name: d.name, phone: d.phone, state: 'BROKEN', note: 'no PIN hash anywhere' });
      continue;
    }
    // The 500 case: a secrets doc exists but carries no hash.
    rows.push({
      name: d.name,
      phone: d.phone,
      state: 'BRICKED',
      note: `secrets/ has no pinHash (login 500s); hash is in members/ — source='members'`,
    });
  }

  const width = Math.max(0, ...rows.map((r) => (r.name ?? '').length));
  console.log(`\n${rows.length} member(s) need attention:\n`);
  for (const r of rows) {
    const pad = ' '.repeat(width - (r.name ?? '').length);
    console.log(`  ${r.state.padEnd(8)} ${r.name}${pad}  ${r.phone ?? '—'}  ${r.note}`);
  }
  const bricked = rows.filter((r) => r.state === 'BRICKED').length;
  const broken = rows.filter((r) => r.state === 'BROKEN').length;
  console.log(
    `\n  BRICKED (cannot log in at all): ${bricked}` +
      `\n  BROKEN  (no hash anywhere):     ${broken}` +
      `\n  EXPOSED (hash readable):        ${rows.length - bricked - broken}\n`
  );
  return rows;
}

async function reset(db, { phone, name, pin, actor }) {
  const memberQuery = phone
    ? db.collection('members').where('phone', '==', normalizePhone(phone)).limit(1)
    : null;

  let doc;
  if (memberQuery) {
    const snap = await memberQuery.get();
    if (snap.empty) {
      console.error(`No member with phone ${normalizePhone(phone)}.`);
      process.exit(1);
    }
    doc = snap.docs[0];
  } else {
    const snap = await db.collection('members').where('name', '==', name).limit(2).get();
    if (snap.empty) {
      console.error(`No member named "${name}".`);
      process.exit(1);
    }
    if (snap.size > 1) {
      console.error(`"${name}" is ambiguous — ${snap.size} members share it. Use --phone.`);
      process.exit(1);
    }
    doc = snap.docs[0];
  }

  const data = doc.data() ?? {};
  console.log(`\n  Member:  ${data.name}`);
  console.log(`  Phone:   ${data.phone}`);
  console.log(`  Role:    ${data.role}${data.active === false ? '  (INACTIVE)' : ''}`);
  console.log(`  PIN set: ${pin}`);
  if (DRY_RUN) {
    console.log('\n  --dry-run: nothing written.\n');
    return;
  }

  const pinHash = await bcrypt.hash(pin, 10);
  const now = Date.now();

  // One batch so there is no window where the new hash is in place but the old
  // one is still readable.
  const batch = db.batch();
  batch.set(
    db.collection('secrets').doc(doc.id),
    { pinHash, failedAttempts: 0, lockedUntil: null, migratedAt: now },
    { merge: true }
  );
  batch.set(
    doc.ref,
    {
      mustChangePin: true,
      pinResetAt: now,
      pinResetBy: actor,
      pinHash: FieldValue.delete(),
      failedAttempts: FieldValue.delete(),
      lockedUntil: FieldValue.delete(),
      updatedAt: now,
    },
    { merge: true }
  );
  await batch.commit();

  // Anyone who knew the old PIN must lose their session. Best-effort: a failure
  // here does not invalidate the reset, and the PIN itself has already changed.
  const sessions = await db.collection('sessions').where('memberId', '==', doc.id).get();
  if (!sessions.empty) {
    const sb = db.batch();
    sessions.docs.forEach((s) => sb.delete(s.ref));
    await sb.commit();
  }

  // Verify by reading back, rather than trusting the write.
  const after = (await doc.ref.get()).data() ?? {};
  const stored = (await db.collection('secrets').doc(doc.id).get()).data() ?? {};
  const hashOk = typeof stored.pinHash === 'string' && stored.pinHash.startsWith('$2');
  const matchOk = hashOk && (await bcrypt.compare(pin, stored.pinHash));

  console.log(`\n  secrets/ hash written:   ${hashOk ? 'yes' : 'NO — FAILED'}`);
  console.log(`  members/ hash removed:   ${after.pinHash === undefined ? 'yes' : 'NO — FAILED'}`);
  console.log(`  new PIN verifies:        ${matchOk ? 'yes' : 'NO — FAILED'}`);
  console.log(`  sessions revoked:        ${sessions.size}`);
  console.log(`  member must change PIN:  ${after.mustChangePin === true ? 'yes' : 'NO — FAILED'}`);

  if (!hashOk || after.pinHash !== undefined || !matchOk) {
    console.error('\n  Verification failed — do not report this reset as done.\n');
    process.exit(1);
  }
  console.log(`\n  ${data.name} can now sign in and will be asked to choose a new PIN.\n`);
}

/**
 * Invalidate every UNCLAIMED seat by setting a random PIN nobody knows.
 *
 * Why this exists. The seeded placeholders are +254700000001…013 with PIN 0000 —
 * sequential, and printed in the seed script. While a seat is bricked nobody can
 * reach it; the moment readSecrets is fixed it becomes reachable by anyone who
 * guesses the phone number, and the PIN is a constant in this repo. So fixing the
 * login bug and locking down the unclaimed seats are one operation, not two.
 *
 * A member whose phone is still a placeholder has not claimed a seat, so setting
 * an unknown PIN costs them nothing: /join re-issues the seat with a phone and
 * PIN of their own choosing. It only removes the ability to walk in as someone
 * who has not turned up yet.
 */
async function lockPlaceholders(db, { actor }) {
  const members = await db.collection('members').get();
  const targets = [];
  for (const doc of members.docs) {
    const d = doc.data() ?? {};
    const phone = d.phone ?? '';
    if (!/^\+254700000\d{3}$/.test(phone)) continue; // a real phone — leave it alone
    if (typeof d.claimedAt === 'number') continue; // already claimed
    targets.push({ doc, data: d });
  }

  if (targets.length === 0) {
    console.log('\n  No unclaimed placeholder seats. Nothing to do.\n');
    return;
  }

  console.log(`\n  ${targets.length} unclaimed seat(s) to invalidate:`);
  for (const t of targets) {
    console.log(`    ${(t.data.name ?? '').padEnd(22)} ${t.data.phone}`);
  }
  if (DRY_RUN) {
    console.log('\n  --dry-run: nothing written.\n');
    return;
  }

  const now = Date.now();
  const batch = db.batch();
  for (const { doc } of targets) {
    // A PIN nobody is told. Its only job is to not be 0000.
    const pin = String(crypto.randomInt(1000, 10000));
    const pinHash = await bcrypt.hash(pin, 10);
    batch.set(
      db.collection('secrets').doc(doc.id),
      { pinHash, failedAttempts: 0, lockedUntil: null, migratedAt: now },
      { merge: true }
    );
    batch.set(
      doc.ref,
      {
        mustChangePin: true,
        pinResetAt: now,
        pinResetBy: actor,
        pinHash: FieldValue.delete(),
        failedAttempts: FieldValue.delete(),
        lockedUntil: FieldValue.delete(),
        updatedAt: now,
      },
      { merge: true }
    );
  }
  await batch.commit();
  console.log(`\n  ${targets.length} seat(s) invalidated. Each must now claim via /join.\n`);
}

const db = await connect();

if (has('--list') || (argv.length === 0)) {
  const snap = await db.collection('members').orderBy('name').get();
  console.log('\nMembers:\n');
  for (const d of snap.docs) {
    const data = d.data() ?? {};
    console.log(
      `  ${(data.name ?? '').padEnd(24)} ${(data.phone ?? '').padEnd(16)} ${data.role ?? ''}` +
        `${data.active === false ? '  (inactive)' : ''}`
    );
  }
  console.log();
} else if (has('--audit')) {
  await audit(db);
} else if (has('--lock-placeholders')) {
  await lockPlaceholders(db, { actor: valueOf('--by') ?? process.env.USER ?? 'cli' });
} else {
  const pin = valueOf('--pin') ?? '';
  if (!/^\d{4}$/.test(pin)) {
    console.error('--pin must be exactly 4 digits.');
    process.exit(1);
  }
  if (!valueOf('--phone') && !valueOf('--name')) {
    console.error('Give --phone or --name to identify the member.');
    process.exit(1);
  }
  await reset(db, {
    phone: valueOf('--phone'),
    name: valueOf('--name'),
    pin,
    actor: valueOf('--by') ?? process.env.USER ?? 'cli',
  });
}

process.exit(0);