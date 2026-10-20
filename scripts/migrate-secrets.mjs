#!/usr/bin/env node
/**
 * Move PIN hashes and lockout counters out of the member document.
 *
 * FROM  members/{id}.{pinHash, failedAttempts, lockedUntil}
 * TO    secrets/{id}.{pinHash, failedAttempts, lockedUntil, migratedAt}
 *
 * Why this is safe to run at any time:
 *   - the login endpoint reads secrets/ first and falls back to members/, so a
 *     partially-migrated database still lets everyone in;
 *   - a successful login promotes the member automatically;
 *   - the old fields are only removed from members/ once a verified copy exists
 *     in secrets/, re-read to confirm, so a failed write cannot lose a hash.
 *
 * Nothing here is destructive in the sense that matters: no PIN hash is ever
 * deleted unless it has been read back and byte-compared from the new location.
 *
 * Usage:
 *   node scripts/migrate-secrets.mjs --dry-run     report, change nothing
 *   node scripts/migrate-secrets.mjs --write       perform the migration
 *   node scripts/migrate-secrets.mjs --write --emulator
 */

import { createHash } from 'node:crypto';

import { loadEnv, adminFirestore } from './admin-db.mjs';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const WRITE = args.includes('--write');
const EMULATOR = args.includes('--emulator');

if (!DRY_RUN && !WRITE) {
  console.error('Nothing to do. Pass --dry-run to report, or --write to migrate.');
  process.exit(1);
}

loadEnv();

const db = adminFirestore({ emulator: EMULATOR, label: 'migrate-secrets' });

const run = async () => {
  const members = await db.collection('members').get();
  const existingSecrets = new Set(
    (await db.collection('secrets').get()).docs.map((d) => d.id)
  );

  let moved = 0, alreadyThere = 0, noPin = 0, scrubbed = 0;
  const problems = [];

  for (const memberDoc of members.docs) {
    const data = memberDoc.data();
    const id = memberDoc.id;
    const pinHash = data.pinHash;

    if (!pinHash) { noPin++; continue; }

    const failedAttempts = data.failedAttempts ?? 0;
    const lockedUntil = data.lockedUntil ?? null;
    const already = existingSecrets.has(id);

    // If a secrets doc already exists, compare before overwriting — a member who
    // changed their PIN after a partial migration must not be rolled back.
    if (already) {
      const current = (await db.collection('secrets').doc(id).get()).data()?.pinHash;
      if (current && current !== pinHash) {
        problems.push({ id, reason: 'secrets/ holds a different hash than members/ — left untouched' });
        continue;
      }
      alreadyThere++;
    }

    if (DRY_RUN) {
      if (!already) moved++;
      continue;
    }

    // 1. Write the new location.
    await db.collection('secrets').doc(id).set(
      { pinHash, failedAttempts, lockedUntil, migratedAt: Date.now() },
      { merge: true }
    );

    // 2. Read it back and byte-compare. Only then is it safe to remove the old.
    const verify = await db.collection('secrets').doc(id).get();
    if (verify.data()?.pinHash !== pinHash) {
      problems.push({ id, reason: 'verification failed after write — members/ left intact' });
      continue;
    }

    // 3. Remove the hash from the member doc. Failed attempts and lockout are
    //    kept in sync for the admin UI until it reads from secrets/.
    await memberDoc.ref.update({
      pinHash: null,
      failedAttempts,
      lockedUntil,
      updatedAt: Date.now(),
    });
    scrubbed++;
    if (!already) moved++;
  }

  const summary = { scanned: members.size, moved, alreadyThere, noPin, scrubbed, problems };

  console.log('\nSecrets migration', DRY_RUN ? '(DRY RUN — nothing written)' : '(WRITING)');
  console.table({
    'members scanned': summary.scanned,
    'hashes to move': summary.moved,
    'already migrated': summary.alreadyThere,
    'no pinHash (skipped)': summary.noPin,
    'members scrubbed': summary.scrubbed,
  });

  if (problems.length) {
    console.log('\nLeft alone for a human:');
    for (const p of problems) console.log(`  ${p.id}: ${p.reason}`);
  }

  if (DRY_RUN) {
    console.log('\nRe-run with --write to perform the migration.');
  } else {
    console.log('\nEvery hash was read back and verified before the original was cleared.');
    console.log('Next: deploy the rules so secrets/ is unreadable to clients.');
  }

  // Print a digest of what moved so the run can be compared against a snapshot.
  const digest = createHash('sha256')
    .update(members.docs.map((d) => `${d.id}:${(d.data().pinHash ?? '').slice(0, 7)}`).join('\n'))
    .digest('hex');
  console.log(`\nmembers pinHash digest: ${digest}`);
};

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});