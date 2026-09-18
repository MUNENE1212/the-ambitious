/**
 * Seed the real Y&A member roster (from APRIL2026.xlsx) as a starting point.
 * Run: node scripts/seed-members.mjs
 *
 * Phone numbers are NOT in the source spreadsheet — every member is created
 * with a clearly-fake placeholder (+2547000000XX) and PIN 0000. An admin
 * must edit each member's real phone number from the Admin screen before
 * that member can log in, and everyone should change their PIN on first use
 * (mustChangePin is already set).
 *
 * Office-bearer titles (chairperson, treasurer, etc.) are intentionally left
 * blank — assign them from the Admin screen; this script has no way to know
 * who currently holds which office.
 *
 * Requires: .env.local with Firebase credentials (same as seed-admin.mjs), or
 * pass --emulator to target the local Firebase emulator.
 *
 * Idempotent: a member whose name is already on the roster in Firestore is
 * skipped. This matters — Firestore rules deny deletes, so a duplicate created
 * by a second run could never be removed, only deactivated.
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, collection, addDoc, getDocs } from 'firebase/firestore';
import bcrypt from 'bcryptjs';
import { readFileSync } from 'fs';

const EMULATOR = process.argv.slice(2).includes('--emulator');

try {
  const envFile = readFileSync('.env.local', 'utf8');
  envFile.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) process.env[key.trim()] = vals.join('=').trim();
  });
} catch {
  // .env.local not found, use process env
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

if (!EMULATOR && (!firebaseConfig.apiKey || !firebaseConfig.projectId)) {
  console.error('Missing Firebase config. Create a .env.local file with your Firebase credentials, or pass --emulator.');
  process.exit(1);
}

// The roster is personal data, so it lives in scripts/roster.local.json, which
// is gitignored. Copy scripts/roster.example.json to create it.
const ROSTER_FILE = new URL('./roster.local.json', import.meta.url);
let ROSTER;
try {
  ROSTER = JSON.parse(readFileSync(ROSTER_FILE, 'utf8')).roster;
} catch {
  console.error('Missing scripts/roster.local.json — copy scripts/roster.example.json and fill in the roster.');
  process.exit(1);
}
if (!Array.isArray(ROSTER) || ROSTER.length === 0) {
  console.error('scripts/roster.local.json has no "roster" array.');
  process.exit(1);
}

let db;
if (EMULATOR) {
  // Same demo project id the app uses under NEXT_PUBLIC_USE_EMULATORS (src/lib/firebase.ts).
  db = getFirestore(initializeApp({ apiKey: 'demo-key', projectId: 'demo-project' }));
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  console.log('Targeting the Firestore emulator at 127.0.0.1:8080\n');
} else {
  db = getFirestore(initializeApp(firebaseConfig));
  console.log(`Targeting Firestore project ${firebaseConfig.projectId} (production)\n`);
}

async function seed() {
  const pinHash = await bcrypt.hash('0000', 10);
  const existing = new Set(
    (await getDocs(collection(db, 'members'))).docs
      .map(d => String(d.data().name ?? '').trim().toLowerCase())
  );

  let i = 0;
  let created = 0;
  let skipped = 0;
  for (const name of ROSTER) {
    i++;
    if (existing.has(name.trim().toLowerCase())) {
      console.log(`Skipped ${name} — already on the roster`);
      skipped++;
      continue;
    }
    const phone = `+254700000${String(i).padStart(3, '0')}`;
    await addDoc(collection(db, 'members'), {
      name,
      phone,
      role: 'member',
      pinHash,
      mustChangePin: true,
      titles: [],
      secondary: false,
      failedAttempts: 0,
      lockedUntil: null,
      active: true,
      joinedAt: new Date().toISOString().slice(0, 10),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    console.log(`Created ${name} — placeholder phone ${phone}, PIN 0000`);
    created++;
  }

  console.log(`\n${created} members created, ${skipped} skipped (already present).`);
  console.log('Next steps:');
  console.log('  1. Edit each member\'s real phone number from Admin.');
  console.log('  2. Assign office-bearer titles (chairperson, treasurer, ...) from Admin.');
  console.log('  3. Enter opening balances in Settings — the source ledger shows KES 125,250');
  console.log('     carried forward and KES 177,850 lifetime contributions as of April 2026;');
  console.log('     the treasurer should confirm the cash/bank split before entering it.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
