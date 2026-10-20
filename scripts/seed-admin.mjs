/**
 * Seed script to create the first admin user and the default settings doc.
 *
 * Run: node scripts/seed-admin.mjs              # target the project in .env.local
 *      node scripts/seed-admin.mjs --emulator   # target the local Firebase emulator
 *
 * Requires (without --emulator): FIREBASE_PROJECT_ID, FIREBASE_API_KEY env vars
 * or a filled-in .env.local file.
 *
 * Idempotent: an existing admin or settings doc is left untouched.
 */

import bcrypt from 'bcryptjs';
import { loadEnv, adminFirestore } from './admin-db.mjs';

const EMULATOR = process.argv.slice(2).includes('--emulator');

loadEnv();

let db;
if (EMULATOR) {
  db = adminFirestore({ emulator: true });
  console.log('Targeting the Firestore emulator at 127.0.0.1:8080\n');
} else {
  if (!process.env.FIREBASE_PROJECT_ID && !process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
    console.error(
      'Missing Firebase config. Create a .env.local file with FIREBASE_PROJECT_ID and a service-account key, or pass --emulator.'
    );
    process.exit(1);
  }
  db = adminFirestore({ label: 'seed-admin' });
  console.log(
    `Targeting Firestore project ${process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID} (production)\n`
  );
}

async function seed() {
  // --- Admin user (idempotent) ---
  const ADMIN_PHONE = '+254700000000';
  const existingAdmin = await db
    .collection('members')
    .where('phone', '==', ADMIN_PHONE)
    .limit(1)
    .get();

  if (!existingAdmin.empty) {
    console.log(`Admin already exists (${existingAdmin.docs[0].id}) — left untouched.`);
  } else {
    const pinHash = await bcrypt.hash('1234', 10);
    const now = Date.now();
    const admin = db.collection('members').add({
      name: 'Admin',
      phone: ADMIN_PHONE,
      role: 'admin',
      mustChangePin: true,
      titles: [],
      secondary: false,
      joinedAt: new Date().toISOString().slice(0, 10),
      failedAttempts: 0,
      lockedUntil: null,
      active: true,
      createdAt: now,
      updatedAt: now,
    });

    // The hash lives in secrets/, never in members/ — a member document is
    // readable by any client the rules allow, so nothing that grants access
    // belongs in one. See scripts/migrate-secrets.mjs for the split.
    await admin.then((ref) =>
      db.collection('secrets').doc(ref.id).set({
        pinHash,
        failedAttempts: 0,
        lockedUntil: null,
        migratedAt: now,
      })
    );

    console.log(`Admin user created with ID: ${(await admin).id}`);
    console.log(`Phone: ${ADMIN_PHONE}`);
    console.log('PIN: 1234');
    console.log('\nChange these credentials after first login!');
  }

  // --- Default settings (idempotent) ---
  // Keep this object in sync with DEFAULT_SETTINGS in src/lib/constants.ts —
  // every figure comes from the Y&A constitution and stays editable in Settings.
  const settingsRef = db.collection('config').doc('settings');
  if ((await settingsRef.get()).exists) {
    console.log('\nSettings doc already exists — left untouched (edit it in Settings).');
    process.exit(0);
  }

  await settingsRef.set({
    groupName: 'Young & Ambitious Self Help Group',
    groupShortName: 'Y&A',

    entryFee: 5000,
    monthlyContributionPrimary: 600,
    monthlyContributionSecondary: 900,
    contributionRates: {
      '2025/2026': { primary: 600, secondary: 900 },
      '2026/2027': { primary: 600, secondary: 900 },
    },
    meetingFee: 100,
    memberCap: 20,

    autoDuesFrom: '2026-10',
    contributionCutoffDay: 5,
    lateContributionFine: 200,
    virtualAbsenceFine: 500,
    agmAbsenceFine: 3000,

    welfareParentDeath: 500,
    welfareNuclearDeath: 1000,
    welfareMemberDeath: 2000,

    exitDeductionPct: 0.2,

    agmDate: '10-20',

    openingCashBalance: 0,
    openingBankBalance: 0,
    openingAgmFundBalance: 0,
    openingBalancesSet: false,

    expenseCategories: ['AGM Party', 'Welfare', 'Administration', 'Investment', 'Other'],
  });

  console.log('\nDefault settings created.');
  console.log('Next: Settings → enter the opening balances from the import report.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
