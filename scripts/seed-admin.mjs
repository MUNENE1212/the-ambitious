/**
 * Seed script to create the first admin user.
 * Run: node scripts/seed-admin.mjs
 *
 * Requires: FIREBASE_PROJECT_ID, FIREBASE_API_KEY env vars or .env.local file
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc } from 'firebase/firestore';
import bcrypt from 'bcryptjs';
import { readFileSync } from 'fs';

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

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('Missing Firebase config. Create a .env.local file with your Firebase credentials.');
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function seed() {
  // Create admin user
  const pinHash = await bcrypt.hash('1234', 10);

  const admin = await addDoc(collection(db, 'members'), {
    name: 'Admin',
    phone: '+254700000000',
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
  console.log('Phone: +254700000000');
  console.log('PIN: 1234');
  console.log('\nChange these credentials after first login!');

  // Create default settings — figures from the Y&A constitution, all editable later in Settings
  const { setDoc, doc } = await import('firebase/firestore');
  await setDoc(doc(db, 'config', 'settings'), {
    groupName: 'Young & Ambitious Self Help Group',
    groupShortName: 'Y&A',
    entryFee: 5000,
    monthlyContributionPrimary: 500,
    monthlyContributionSecondary: 900,
    meetingFee: 100,
    memberCap: 20,
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

  console.log('Default settings created.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
