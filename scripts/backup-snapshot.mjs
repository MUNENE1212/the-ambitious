#!/usr/bin/env node
/**
 * Dump every Firestore collection to a timestamped JSON snapshot on disk.
 *
 * Why this exists: Firestore has no document version history on a standard
 * project, and this project's rules deny `delete` on every collection — so a
 * bulk edit (like backfilling a season of contributions through Ledger Entry)
 * has no undo. Take a snapshot first.
 *
 * Uses the CLIENT SDK with the web config from .env.local, exactly like
 * seed-admin.mjs, so it needs no service-account credentials. That only works
 * because Firestore rules are permissive today (`allow read: if true`). Once
 * the rules are hardened (see docs/PLATFORM-PLAN.md §5), this script will stop
 * working and should be rewritten against firebase-admin with a service account.
 *
 * Usage:
 *   node scripts/backup-snapshot.mjs                # write backups/<timestamp>.json
 *   node scripts/backup-snapshot.mjs --out FILE     # write to an explicit path
 *   node scripts/backup-snapshot.mjs --emulator     # read from the local emulator
 *   node scripts/backup-snapshot.mjs --dry-run      # report counts, write nothing
 *
 * Snapshot files are gitignored (see .gitignore) — they contain every member's
 * phone number and PIN hash. Do not commit or share them.
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, collection, getDocs } from 'firebase/firestore';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { createHash } from 'crypto';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};

const EMULATOR = flag('emulator');
const DRY_RUN = flag('dry-run');

// Every collection the app writes to. The web SDK has no listCollections(), so
// this list is explicit — add to it when a new collection ships.
const COLLECTIONS = [
  'members',
  'contributions',
  'fines',
  'attendance',
  'expenses',
  'bankTransactions',
  'investments',
  'exitRequests',
  'meetingMinutes',
  'forumPosts',
  'config',
];

try {
  const envFile = await import('fs').then(fs => fs.readFileSync('.env.local', 'utf8'));
  envFile.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) {
      process.env[key.trim()] = vals.join('=').trim();
    }
  });
} catch {
  console.log('.env.local not found — falling back to process env\n');
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let db;
if (EMULATOR) {
  db = getFirestore(initializeApp({ apiKey: 'demo-key', projectId: 'demo-project' }));
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  console.log('Reading from the Firestore emulator at 127.0.0.1:8080\n');
} else {
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.error('Missing Firebase config. Create a .env.local file with your Firebase credentials, or pass --emulator.');
    process.exit(1);
  }
  db = getFirestore(initializeApp(firebaseConfig));
  console.log(`Reading from Firestore project ${firebaseConfig.projectId} (production)\n`);
}

async function snapshot() {
  const out = {};
  let total = 0;

  for (const name of COLLECTIONS) {
    let docs;
    try {
      docs = await getDocs(collection(db, name));
    } catch (err) {
      // A missing/denied collection should not abort the whole snapshot.
      console.error(`  ${name}: SKIPPED — ${err.message}`);
      continue;
    }
    out[name] = docs.docs.map(d => ({ id: d.id, ...d.data() }));
    total += docs.size;
    console.log(`  ${name.padEnd(20)} ${String(docs.size).padStart(5)} docs`);
  }

  console.log(`\n  ${'TOTAL'.padEnd(20)} ${String(total).padStart(5)} docs`);

  if (DRY_RUN) {
    console.log('\n--dry-run: nothing written.');
    return;
  }

  const payload = {
    takenAt: new Date().toISOString(),
    projectId: firebaseConfig.projectId,
    emulator: EMULATOR,
    counts: Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.length])),
    collections: out,
  };

  const json = JSON.stringify(payload, null, 2);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = resolve(option('--out', `backups/snapshot-${stamp}.json`));

  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, json);

  // Lets you confirm a restore produced identical bytes.
  const sha = createHash('sha256').update(json).digest('hex');

  console.log(`\n  Snapshot written: ${dest}`);
  console.log(`  Size:            ${(json.length / 1024).toFixed(1)} KB`);
  console.log(`  SHA-256:         ${sha}`);
  console.log('\n  Contains member phone numbers and PIN hashes — keep this local and out of git.');
}

snapshot().then(() => process.exit(0)).catch(err => {
  console.error('\nSnapshot failed:', err);
  process.exit(1);
});