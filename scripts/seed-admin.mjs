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

import { initializeApp } from 'firebase/app';
import {
  getFirestore, connectFirestoreEmulator, collection, addDoc, getDocs,
  query, where, limit, setDoc, doc, getDoc,
} from 'firebase/firestore';
import bcrypt from 'bcryptjs';
import { readFileSync } from 'fs';

const EMULATOR = process.argv.slice(2).includes('--emulator');

// Try to load .env.local
try {
  const envFile = readFileSync('.env.local', 'utf8');
  envFile.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) {
      process.env[key.trim()] = vals.join('=').trim();
    }
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

let db;
if (EMULATOR) {
  // Same demo project id the app uses under NEXT_PUBLIC_USE_EMULATORS (src/lib/firebase.ts).
  db = getFirestore(initializeApp({ apiKey: 'demo-key', projectId: 'demo-project' }));
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  console.log('Targeting the Firestore emulator at 127.0.0.1:8080\n');
} else {
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.error('Missing Firebase config. Create a .env.local file with your Firebase credentials, or pass --emulator.');
    process.exit(1);
  }
  db = getFirestore(initializeApp(firebaseConfig));
  console.log(`Targeting Firestore project ${firebaseConfig.projectId} (production)\n`);
}

async function seed() {
  // --- Admin user (idempotent) ---
  const ADMIN_PHONE = '+254700000000';
  const existingAdmin = await getDocs(
    query(collection(db, 'members'), where('phone', '==', ADMIN_PHONE), limit(1))
  );

  if (!existingAdmin.empty) {
    console.log(`Admin already exists (${existingAdmin.docs[0].id}) — left untouched.`);
  } else {
    const pinHash = await bcrypt.hash('1234', 10);
    const admin = await addDoc(collection(db, 'members'), {
      name: 'Admin',
      phone: ADMIN_PHONE,
      role: 'admin',
      pinHash,
      mustChangePin: true,
      titles: [],
      secondary: false,
      joinedAt: new Date().toISOString().slice(0, 10),
      failedAttempts: 0,
      lockedUntil: null,
      active: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    console.log(`Admin user created with ID: ${admin.id}`);
    console.log(`Phone: ${ADMIN_PHONE}`);
    console.log('PIN: 1234');
    console.log('\nChange these credentials after first login!');
  }

  // --- Default settings (idempotent) ---
  // Keep this object in sync with DEFAULT_SETTINGS in src/lib/constants.ts —
  // every figure comes from the Y&A constitution and stays editable in Settings.
  const settingsRef = doc(db, 'config', 'settings');
  if ((await getDoc(settingsRef)).exists()) {
    console.log('\nSettings doc already exists — left untouched (edit it in Settings).');
    process.exit(0);
  }

  await setDoc(settingsRef, {
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
