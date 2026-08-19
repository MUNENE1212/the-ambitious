/**
 * Seed the Firebase emulator with demo data for testing/demos.
 * Run: npm run emulators:seed  (with emulators already running)
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, collection, addDoc, setDoc, doc } from 'firebase/firestore';
import bcrypt from 'bcryptjs';

const app = initializeApp({ apiKey: 'demo-key', projectId: 'demo-project' });
const db = getFirestore(app);
connectFirestoreEmulator(db, '127.0.0.1', 8080);

const pin = await bcrypt.hash('1234', 10);
const now = Date.now();

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function monthKey(n = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 7);
}

async function seed() {
  console.log('Seeding emulator...\n');

  const admin = await addDoc(collection(db, 'members'), {
    name: 'Jane Wanjiku', phone: '+254712000001', role: 'admin',
    pinHash: pin, mustChangePin: false, titles: ['chairperson'], secondary: false,
    failedAttempts: 0, lockedUntil: null, active: true, joinedAt: daysAgo(400), createdAt: now, updatedAt: now,
  });
  const treasurer = await addDoc(collection(db, 'members'), {
    name: 'Mary Akinyi', phone: '+254712000003', role: 'member',
    pinHash: pin, mustChangePin: false, titles: ['treasurer'], secondary: false,
    failedAttempts: 0, lockedUntil: null, active: true, joinedAt: daysAgo(400), createdAt: now, updatedAt: now,
  });
  const secretary = await addDoc(collection(db, 'members'), {
    name: 'James Mwangi', phone: '+254712000004', role: 'member',
    pinHash: pin, mustChangePin: false, titles: ['secretary'], secondary: false,
    failedAttempts: 0, lockedUntil: null, active: true, joinedAt: daysAgo(400), createdAt: now, updatedAt: now,
  });
  const discipline = await addDoc(collection(db, 'members'), {
    name: 'Peter Ochieng', phone: '+254712000002', role: 'member',
    pinHash: pin, mustChangePin: false, titles: ['disciplineMaster'], secondary: false,
    failedAttempts: 0, lockedUntil: null, active: true, joinedAt: daysAgo(400), createdAt: now, updatedAt: now,
  });
  const member1 = await addDoc(collection(db, 'members'), {
    name: 'Grace Njeri', phone: '+254712000005', role: 'member',
    pinHash: pin, mustChangePin: false, titles: [], secondary: false,
    failedAttempts: 0, lockedUntil: null, active: true, joinedAt: daysAgo(200), createdAt: now, updatedAt: now,
  });
  const member2 = await addDoc(collection(db, 'members'), {
    name: 'David Kipchoge', phone: '+254712000006', role: 'member',
    pinHash: pin, mustChangePin: false, titles: [], secondary: false,
    failedAttempts: 0, lockedUntil: null, active: true, joinedAt: daysAgo(200), createdAt: now, updatedAt: now,
  });
  console.log('6 members created');

  await setDoc(doc(db, 'config', 'settings'), {
    groupName: 'Young & Ambitious Self Help Group', groupShortName: 'Y&A',
    entryFee: 5000, monthlyContributionPrimary: 500, monthlyContributionSecondary: 900,
    meetingFee: 100, memberCap: 20,
    contributionCutoffDay: 5, lateContributionFine: 200, virtualAbsenceFine: 500, agmAbsenceFine: 3000,
    welfareParentDeath: 500, welfareNuclearDeath: 1000, welfareMemberDeath: 2000,
    exitDeductionPct: 0.2, agmDate: '10-20',
    openingCashBalance: 8000, openingBankBalance: 45000, openingAgmFundBalance: 2000, openingBalancesSet: true,
    expenseCategories: ['AGM Party', 'Welfare', 'Administration', 'Investment', 'Other'],
  });
  console.log('Settings created');

  // --- Monthly dues, last 2 months ---
  const roster = [
    { id: admin.id, name: 'Jane Wanjiku' }, { id: treasurer.id, name: 'Mary Akinyi' },
    { id: secretary.id, name: 'James Mwangi' }, { id: discipline.id, name: 'Peter Ochieng' },
    { id: member1.id, name: 'Grace Njeri' }, { id: member2.id, name: 'David Kipchoge' },
  ];
  for (const monthsAgo of [1, 0]) {
    const month = monthKey(monthsAgo);
    for (const m of roster) {
      const late = monthsAgo === 1 && m.id === member1.id;
      const status = monthsAgo === 1 ? 'Paid' : (m.id === member2.id ? 'Pending' : m.id === member1.id ? 'Unpaid' : 'Paid');
      await addDoc(collection(db, 'contributions'), {
        memberId: m.id, memberName: m.name, purpose: 'monthly', month,
        amount: 500, fineAmount: late ? 200 : 0, status,
        ...(status === 'Paid' ? {
          mpesaCode: `QK${Math.random().toString(36).slice(2, 9).toUpperCase()}`,
          paidDate: daysAgo(monthsAgo * 30 + 3), verifiedBy: treasurer.id, verifiedAt: now - monthsAgo * 86400000,
          paymentMethod: 'Mpesa',
        } : status === 'Pending' ? { mpesaCode: `QK${Math.random().toString(36).slice(2, 9).toUpperCase()}` } : {}),
        createdAt: now - monthsAgo * 30 * 86400000, updatedAt: now,
      });
    }
  }
  console.log('Monthly dues created (2 months x 6 members)');

  await addDoc(collection(db, 'fines'), {
    memberId: member1.id, memberName: 'Grace Njeri', type: 'lateContribution', amount: 200,
    reason: 'Late monthly contribution', waived: false,
    createdBy: treasurer.id, createdByName: 'Mary Akinyi', createdAt: now - 20 * 86400000,
  });
  console.log('Fines created (1)');

  await addDoc(collection(db, 'expenses'), {
    date: daysAgo(5), category: 'AGM Party', amount: 1500, notes: 'Venue deposit for AGM',
    paymentMethod: 'Mpesa', status: 'verified', votes: [], seenBy: [{ memberId: admin.id, memberName: 'Jane Wanjiku', seenAt: now }],
    recordedBy: treasurer.id, recordedByName: 'Mary Akinyi', createdAt: now - 5 * 86400000,
  });
  await addDoc(collection(db, 'expenses'), {
    date: daysAgo(2), category: 'Welfare', amount: 1000, notes: 'Condolence contribution — nuclear family bereavement',
    paymentMethod: 'Cash', status: 'verified', votes: [], seenBy: [],
    recordedBy: discipline.id, recordedByName: 'Peter Ochieng', createdAt: now - 2 * 86400000,
  });
  console.log('Expenses created (2)');

  await addDoc(collection(db, 'bankTransactions'), {
    type: 'deposit', amount: 5000, date: daysAgo(6), description: 'Cash contributions banked',
    status: 'approved', approvals: [], seenBy: [], recordedBy: treasurer.id, recordedByName: 'Mary Akinyi', createdAt: now - 6 * 86400000,
  });
  console.log('Bank transactions created (1)');

  await addDoc(collection(db, 'investments'), {
    title: 'Poultry co-investment', description: 'Joint venture with a member-run poultry business',
    amountInvested: 15000, expectedReturn: 21000, status: 'active',
    recordedBy: admin.id, recordedByName: 'Jane Wanjiku', createdAt: now - 15 * 86400000, updatedAt: now - 15 * 86400000,
  });
  console.log('Investments created (1)');

  await addDoc(collection(db, 'forumPosts'), {
    title: 'AGM date confirmed — 20th October', body: 'This year\'s Annual General Meeting is confirmed for 20 October, physical attendance required.',
    category: 'Announcement', pinned: true, authorId: admin.id, authorName: 'Jane Wanjiku', authorTitles: ['chairperson'],
    replies: [{ id: 'r0', body: 'Noted, thank you!', authorId: member1.id, authorName: 'Grace Njeri', authorTitles: [], createdAt: now - 86400000 }],
    createdAt: now - 2 * 86400000,
  });
  await addDoc(collection(db, 'forumPosts'), {
    title: 'Should we expand the poultry co-investment?', body: 'Our current flock is doing well. Proposal to double the investment next quarter.',
    category: 'Proposal', pinned: false, authorId: admin.id, authorName: 'Jane Wanjiku', authorTitles: ['chairperson'],
    replies: [
      { id: 'r1', body: 'I support this — returns have been solid.', authorId: member2.id, authorName: 'David Kipchoge', authorTitles: [], createdAt: now - 2 * 86400000 },
      { id: 'r2', body: 'What is the risk if egg prices drop?', authorId: member1.id, authorName: 'Grace Njeri', authorTitles: [], createdAt: now - 86400000 },
    ],
    createdAt: now - 3 * 86400000,
  });
  console.log('Forum posts created (2)');

  console.log('\n--- Demo accounts (all PIN: 1234) ---');
  console.log('+254712000001  Jane Wanjiku   (admin, chairperson)');
  console.log('+254712000002  Peter Ochieng  (member, discipline master)');
  console.log('+254712000003  Mary Akinyi    (member, treasurer)');
  console.log('+254712000004  James Mwangi   (member, secretary)');
  console.log('+254712000005  Grace Njeri    (member)');
  console.log('+254712000006  David Kipchoge (member)');
  console.log('\nDone!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
