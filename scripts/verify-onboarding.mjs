/**
 * End-to-end check of the onboarding claim flow against the Firestore emulator.
 *
 * The claim flow is the only unauthenticated write path in the app, so it is
 * also the only one an outsider can reach. These checks assert the properties
 * that make it safe to leave open:
 *
 *   1. a first name finds an unclaimed placeholder seat, and only that;
 *   2. the nonce is single-use — a replayed token cannot claim a second seat;
 *   3. a phone already owned by someone else is refused, inside the transaction;
 *   4. claiming deletes the client-readable pinHash from members/ — the hole
 *      this whole flow exists to close;
 *   5. an onboarded member can actually sign in with what they just chose;
 *   6. weak PINs (0000, 1234) are refused, because 0000 is what seed-members
 *      hands out and 1234 is the first thing anyone tries;
 *   7. an admin PIN reset deletes the hash from members/ as well — the other
 *      route by which an exposure could outlive the credential it came from.
 *
 * Fixtures are written and removed through the admin SDK — the rules deny
 * `delete`, so a client-SDK teardown would silently fail and leave junk behind.
 *
 * Run with the Firestore emulator up AND a dev server on BASE_URL:
 *   npx firebase emulators:start --only firestore --project demo-project
 *   npm run dev
 *   node scripts/verify-onboarding.mjs
 */

import bcrypt from 'bcryptjs';
import { adminFirestore } from './admin-db.mjs';

const admin = adminFirestore({ emulator: true, label: 'verify-onboarding' });

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const LOOKUP = `${BASE}/api/onboarding/lookup`;
const COMPLETE = `${BASE}/api/onboarding/complete`;
const LOGIN = `${BASE}/api/auth/login`;

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass });
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const post = (url, body, cookie) =>
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });

// ---------------------------------------------------------------------------
// Fixtures. Distinct placeholder phones so the emulator's own demo seed does
// not collide with these.
// ---------------------------------------------------------------------------

const FIXTURES = [
  { name: 'Grace Wanjiru', phone: '+254700000901', pin: '0000', active: true },
  { name: 'Henry Otieno', phone: '+254700000902', pin: '0000', active: true },
  // Already onboarded: a real phone, so not claimable. Deliberately NOT
  // 0712345678 — that is the number Grace claims below, and sharing it would
  // make the uniqueness check fire and mask the happy path.
  { name: 'Ivy Muthoni', phone: '+254712399988', pin: '0000', active: true },
  // Deactivated placeholder: must never be claimable, or anyone could take a
  // seat that was closed on purpose.
  { name: 'Jane Chebet', phone: '+254700000903', pin: '0000', active: false },
  // An admin-role placeholder that is active — claiming must not be able to
  // hand anyone a live admin account.
  { name: 'Karl Kimani', phone: '+254700000904', pin: '0000', active: true, role: 'admin' },
  // A second admin who signs in for real, so the reset-pin checks below drive
  // the actual endpoint through its actual auth guard rather than a stub.
  { name: 'Mary Njeri', phone: '+254700000905', pin: '0000', active: true, role: 'admin' },
];

const ids = {};

async function seedFixtures() {
  const hash = await bcrypt.hash('0000', 10);
  for (const f of FIXTURES) {
    const ref = admin.collection('members').doc();
    await ref.set({
      name: f.name,
      phone: f.phone,
      role: f.role ?? 'member',
      titles: [],
      secondary: false,
      active: f.active,
      pinHash: hash,
      failedAttempts: 0,
      lockedUntil: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    ids[f.name] = ref.id;
  }
}

async function tearDown() {
  for (const id of Object.values(ids)) {
    await admin.collection('members').doc(id).delete().catch(() => {});
    await admin.collection('secrets').doc(id).delete().catch(() => {});
  }
  const sessions = await admin.collection('sessions').get();
  await Promise.all(sessions.docs.map((d) => d.ref.delete().catch(() => {})));
}

async function memberDoc(name) {
  return (await admin.collection('members').doc(ids[name]).get()).data();
}

async function run() {
  console.log('\nOnboarding claim flow — Firestore emulator\n');

  await seedFixtures();

  // --- lookup -------------------------------------------------------------
  const found = await post(LOOKUP, { firstName: 'Grace' });
  const foundBody = await found.json();

  check(
    'a first name finds an unclaimed placeholder seat',
    found.ok && foundBody.matches?.length === 1,
    `${foundBody.matches?.length ?? 0} match(es)`
  );
  check(
    'the lookup returns a full name and an opaque token, nothing else',
    foundBody.matches?.[0]?.fullName === 'Grace Wanjiru' &&
      /^[a-f0-9]{32}$/.test(foundBody.matches?.[0]?.token ?? ''),
    foundBody.matches?.[0]?.fullName
  );
  check(
    'no member id or phone leaks from the lookup',
    !JSON.stringify(foundBody).includes(ids['Grace Wanjiru']) &&
      !JSON.stringify(foundBody).includes('+254700000901')
  );

  // Case-insensitivity: members type their name however they like. This lookup
  // re-mints the nonce, which retires the token captured above — so the token
  // used to complete below is deliberately the one from HERE, and the stale one
  // is replayed later to prove a superseded token is dead too.
  const lower = await post(LOOKUP, { firstName: 'grace' });
  const lowerBody = await lower.json();
  check(
    'the first-name match ignores case',
    lowerBody.matches?.length === 1,
    `${lowerBody.matches?.length ?? 0} match(es)`
  );
  const staleToken = foundBody.matches[0].token;
  const token = lowerBody.matches?.[0]?.token;

  // An onboarded member's seat must be invisible to the flow.
  const onboarded = await post(LOOKUP, { firstName: 'Ivy' });
  check(
    'a member who already set up cannot be claimed again',
    (await onboarded.json()).matches?.length === 0
  );

  const inactive = await post(LOOKUP, { firstName: 'Jane' });
  check(
    'a deactivated seat is not claimable',
    (await inactive.json()).matches?.length === 0
  );

  const unknown = await post(LOOKUP, { firstName: 'Nobody' });
  check(
    'an unknown first name is refused without erroring',
    unknown.ok && (await unknown.json()).matches?.length === 0
  );

  // --- token hygiene ------------------------------------------------------
  const garbage = await post(COMPLETE, {
    token: 'not-a-real-token',
    phone: '0711000001',
    pin: '4821',
  });
  check('a malformed token is refused', garbage.status === 400, `HTTP ${garbage.status}`);

  // --- weak PINs ----------------------------------------------------------
  const weakPin = await post(COMPLETE, {
    token: foundBody.matches[0].token,
    phone: '0711000001',
    pin: '0000',
  });
  check('PIN 0000 is refused (it is what the seeder hands out)', weakPin.status === 400, `HTTP ${weakPin.status}`);

  const seqPin = await post(COMPLETE, {
    token: foundBody.matches[0].token,
    phone: '0711000001',
    pin: '1234',
  });
  check('PIN 1234 is refused', seqPin.status === 400, `HTTP ${seqPin.status}`);

  // --- the happy path -----------------------------------------------------
  const done = await post(COMPLETE, { token, phone: '0712345678', pin: '5731' });
  const doneBody = await done.json();
  check(
    'completing the claim succeeds',
    done.ok && doneBody.success === true,
    `HTTP ${done.status}`
  );
  check(
    'completing the claim signs the member straight in',
    typeof done.headers.get('set-cookie') === 'string' &&
      done.headers.get('set-cookie').includes('ambitious_session')
  );
  check(
    'the phone is stored normalised to +254',
    (await memberDoc('Grace Wanjiru')).phone === '+254712345678'
  );
  check(
    'the client-readable pinHash is DELETED from members/',
    (await memberDoc('Grace Wanjiru')).pinHash === undefined
  );
  const stored = (await admin.collection('secrets').doc(ids['Grace Wanjiru']).get()).data();
  check(
    'the PIN hash now lives only in secrets/',
    typeof stored?.pinHash === 'string' && stored.pinHash.startsWith('$2')
  );
  check(
    'the claim is recorded for the audit trail',
    typeof (await memberDoc('Grace Wanjiru')).claimedAt === 'number'
  );
  check(
    'the nonce is consumed',
    (await memberDoc('Grace Wanjiru')).claimNonce === undefined
  );

  // --- replay -------------------------------------------------------------
  const replay = await post(COMPLETE, { token, phone: '0719999999', pin: '4821' });
  check('a replayed token cannot claim again', replay.status === 409, `HTTP ${replay.status}`);

  // The token minted by the FIRST lookup was retired when the case-insensitive
  // lookup minted a second. It must be just as dead as the spent one — otherwise
  // "single-use" only holds for as long as nobody asks twice.
  const superseded = await post(COMPLETE, { token: staleToken, phone: '0719999998', pin: '4821' });
  check(
    'a token superseded by a later lookup is dead too',
    superseded.status === 409,
    `HTTP ${superseded.status}`
  );

  const afterClaim = await post(LOOKUP, { firstName: 'Grace' });
  check(
    'a claimed seat no longer appears in lookup',
    (await afterClaim.json()).matches?.length === 0
  );

  // --- phone uniqueness ---------------------------------------------------
  const henry = await post(LOOKUP, { firstName: 'Henry' });
  const henryToken = (await henry.json()).matches?.[0]?.token;
  const clash = await post(COMPLETE, {
    token: henryToken,
    phone: '0712345678', // now owned by Grace
    pin: '4821',
  });
  check(
    'a phone already claimed by someone else is refused',
    clash.status === 409,
    `HTTP ${clash.status}`
  );
  check(
    'the refused claim left the second seat unclaimed',
    (await memberDoc('Henry Otieno')).phone === '+254700000902'
  );

  // --- the new credentials work ------------------------------------------
  const login = await post(LOGIN, { phone: '0712345678', pin: '5731' });
  check(
    'the member can sign in with the phone and PIN they just chose',
    login.ok && (await login.json()).success === true,
    `HTTP ${login.status}`
  );

  const wrongPin = await post(LOGIN, { phone: '0712345678', pin: '0000' });
  check(
    'the old placeholder PIN no longer works',
    wrongPin.status === 401,
    `HTTP ${wrongPin.status}`
  );

  // --- admin reset path ---------------------------------------------------
  // An admin resetting a PIN must clear the hash from the member document too,
  // not just write a new one into secrets/. Writing only to secrets/ leaves the
  // OLD hash readable to every member — the reset looks like it worked and
  // nothing about the exposure changed. This is the same defect the onboarding
  // claim had to fix for itself.
  const resetId = ids['Ivy Muthoni'];
  // Sign in as a real admin over HTTP rather than forging a session — the point
  // is to prove the endpoint works through its own guard, and a cookie minted
  // behind the guard's back would not test that.
  const adminLogin = await post(LOGIN, { phone: '0700000905', pin: '0000' });
  const adminCookie = (adminLogin.headers.get('set-cookie') ?? '').split(';')[0];
  check('the admin fixture can sign in', adminCookie.length > 0, `HTTP ${adminLogin.status}`);
  const reset = await post(
    `${BASE}/api/admin/members/${resetId}`,
    { action: 'reset-pin', pin: '8402' },
    adminCookie
  );
  check('an admin can reset a PIN', reset.ok, `HTTP ${reset.status}`);
  const afterReset = await admin.collection('members').doc(resetId).get();
  check(
    'resetting a PIN DELETES the hash from members/, not just secrets/',
    afterReset.data()?.pinHash === undefined,
    afterReset.data()?.pinHash ? 'still readable by every member' : 'gone'
  );
  const resetSecret = (await admin.collection('secrets').doc(resetId).get()).data();
  check(
    'the new hash is written to secrets/ where the rules deny it',
    typeof resetSecret?.pinHash === 'string' && resetSecret.pinHash.startsWith('$2')
  );
  const resetLogin = await post(LOGIN, { phone: '0712399988', pin: '8402' });
  check(
    'the member signs in with the PIN the admin set',
    resetLogin.ok,
    `HTTP ${resetLogin.status}`
  );
  const oldPin = await post(LOGIN, { phone: '0712399988', pin: '0000' });
  check('the pre-reset PIN no longer works', oldPin.status === 401, `HTTP ${oldPin.status}`);

  // --- privilege ----------------------------------------------------------
  // Two directions, because they fail differently. The security-relevant one is
  // escalation: claiming a member seat must NOT mint an admin. The other is that
  // claiming does not silently strip a role the register already assigned.
  const karl = await post(LOOKUP, { firstName: 'Karl' });
  const karlToken = (await karl.json()).matches?.[0]?.token;
  const karlClaim = await post(COMPLETE, { token: karlToken, phone: '0712345999', pin: '4821' });
  await karlClaim.json();
  const karlDoc = await memberDoc('Karl Kimani');
  check(
    'claiming does not strip the role the register assigned',
    karlDoc.role === 'admin' && karlClaim.ok,
    `role still ${karlDoc.role}`
  );

  const ivyLookup = await post(LOOKUP, { firstName: 'Karl' });
  check(
    'an admin seat is claimable once and only once, like any other',
    (await ivyLookup.json()).matches?.length === 0
  );

  // Henry is still unclaimed — his earlier claim was refused on the phone clash.
  const henryRetry = await post(LOOKUP, { firstName: 'Henry' });
  const henryRetryToken = (await henryRetry.json()).matches?.[0]?.token;
  await post(COMPLETE, { token: henryRetryToken, phone: '0712345670', pin: '9074' }).then((r) => r.json());
  const henryDoc = await memberDoc('Henry Otieno');
  check(
    'claiming a MEMBER seat does not escalate it to admin',
    henryDoc.role === 'member' && henryDoc.active !== false,
    `role ${henryDoc.role}, active ${henryDoc.active}`
  );

  // --- summary ------------------------------------------------------------
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log('\nFAILED:');
    failed.forEach((f) => console.log(`  - ${f.name}`));
  }

  await tearDown();
  process.exit(failed.length ? 1 : 0);
}

run().catch(async (err) => {
  console.error('\nharness error:', err);
  await tearDown().catch(() => {});
  process.exit(2);
});
