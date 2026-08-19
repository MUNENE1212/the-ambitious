/**
 * Clear test data from Firestore.
 * Keeps: forumPosts, members
 * Deletes: contributions, fines, attendance, expenses, bankTransactions,
 *          investments, exitRequests, meetingMinutes, config/settings
 *
 * Run: node scripts/clear-test-data.mjs
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { readFileSync } from 'fs';

// Load .env.local
try {
  const envFile = readFileSync('.env.local', 'utf8');
  envFile.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) {
      process.env[key.trim()] = vals.join('=').trim();
    }
  });
} catch {
  // .env.local not found
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
  console.error('Missing Firebase config. Ensure .env.local exists with credentials.');
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Collections to clear (everything except forumPosts and members)
const COLLECTIONS_TO_CLEAR = [
  'contributions',
  'fines',
  'attendance',
  'expenses',
  'bankTransactions',
  'investments',
  'exitRequests',
  'meetingMinutes',
];

async function clearCollection(name) {
  const snap = await getDocs(collection(db, name));
  if (snap.empty) {
    console.log(`  ${name}: already empty`);
    return 0;
  }
  let count = 0;
  for (const d of snap.docs) {
    await deleteDoc(doc(db, name, d.id));
    count++;
  }
  console.log(`  ${name}: deleted ${count} document(s)`);
  return count;
}

async function main() {
  console.log(`\nClearing test data from project: ${firebaseConfig.projectId}`);
  console.log('Keeping: forumPosts, members\n');

  let total = 0;
  for (const col of COLLECTIONS_TO_CLEAR) {
    total += await clearCollection(col);
  }

  // Clear config/settings document
  try {
    await deleteDoc(doc(db, 'config', 'settings'));
    console.log('  config/settings: deleted');
    total++;
  } catch {
    console.log('  config/settings: not found or already deleted');
  }

  console.log(`\nDone. Deleted ${total} document(s) total.`);
  console.log('Forum posts and members were preserved.');
  console.log('\nNote: Run "node scripts/seed-admin.mjs" to recreate default settings.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Clear failed:', err);
  process.exit(1);
});
