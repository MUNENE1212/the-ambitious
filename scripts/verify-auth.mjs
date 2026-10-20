/**
 * End-to-end check of the secrets split against the Firestore emulator.
 *
 * Four things must hold, and none of them are visible from a build:
 *   1. login succeeds for a migrated member;
 *   2. a client CANNOT read secrets/ (the rules actually deny it);
 *   3. a client CANNOT read a PIN hash out of members/ either;
 *   4. a client still CAN read the ordinary member fields it needs.
 *
 * (3) and (4) are the pair that matters: if a client can't read members/ at all
 * the app is broken, and if it can still see pinHash the split accomplished
 * nothing. Only asserting both catches a half-finished migration.
 *
 * Run with the Firestore emulator up:
 *   npx firebase emulators:start --only firestore --project demo-project
 *   node scripts/verify-auth.mjs
 */

import { initializeApp } from 'firebase/app';
import {
  getFirestore, connectFirestoreEmulator, doc, getDoc, collection, getDocs,
} from 'firebase/firestore';

const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';

// Deliberately the CLIENT SDK, not the admin SDK. The whole point is to ask
// "what can an ordinary signed-out browser do?", and the admin SDK bypasses
// the rules, so it cannot answer that question.
const app = initializeApp({ apiKey: 'demo-key', projectId: 'demo-project' }, 'verify-auth');
const db = getFirestore(app);
connectFirestoreEmulator(db, '127.0.0.1', Number(EMULATOR_HOST.split(':')[1]));

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass });
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const LOGIN = `${BASE}/api/auth/login`;

/**
 * The PIN every seeded demo member starts with.
 *
 * The change-PIN check below really does change the PIN, so it has to put it
 * back or the next run cannot log in. That is why this script has to restore
 * what it touches rather than just assert on it.
 */
const DEMO_PIN = '1234';

const changePin = (cookie, oldPin, newPin) =>
  fetch(`${BASE}/api/auth/change-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ oldPin, newPin }),
  });

const run = async () => {
  console.log('\nAuth / secrets-split verification (emulator)\n');

  // --- 1. Find a seeded member and confirm login works -----------------
  const members = await getDocs(collection(db, 'members'));
  if (members.empty) {
    console.error('No members found — run `npm run emulators:seed` first.');
    process.exit(1);
  }
  const jane = members.docs.find((d) => d.data().phone === '+254712000001');
  check('seeded admin found', Boolean(jane));

  let cookie = null;
  let usedPin = null;
  // Accept the PIN this run set earlier as well as the seeded one, so a
  // half-finished previous run does not make this one lie about login.
  for (const candidate of [DEMO_PIN, '9999']) {
    try {
      const res = await fetch(LOGIN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '+254712000001', pin: candidate }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.user?.name === 'Jane Wanjiku') {
        cookie = res.headers.get('set-cookie');
        usedPin = candidate;
        check('login response carries no hash or lockout fields',
          !Object.keys(body.user ?? {}).some((k) =>
            /pinHash|hash|failedAttempts|lockedUntil|isLocked|secret/i.test(k)),
          Object.keys(body.user ?? {}).join(',') || 'empty user object');
        break;
      }
      if (candidate === '9999') {
        check('login returns 200 and a user', false, `status ${res.status} — ${body.error ?? 'no error body'}`);
      }
    } catch (err) {
      // No server running is a legitimate skip, not a pass.
      check('login endpoint reachable', false, `${err.message} (start the app first)`);
      break;
    }
  }

  if (cookie) {
    check('login returns 200 and a user', true);
    check('session cookie is httpOnly', /httponly/i.test(cookie));
    check('session cookie is SameSite=Strict', /samesite=strict/i.test(cookie));
  }

  // --- 2/3/4. What can a plain client reach? ---------------------------
  let secretsReadable = null;
  try {
    await getDoc(doc(db, 'secrets', jane.id));
    secretsReadable = true;
  } catch {
    secretsReadable = false;
  }
  check('secrets/ is denied to clients', secretsReadable === false);

  const memberDoc = await getDoc(doc(db, 'members', jane.id));
  check('members/ is readable to clients (app still works)', memberDoc.exists);
  check(
    'members/ exposes no pinHash',
    memberDoc.exists && !('pinHash' in memberDoc.data()),
    memberDoc.exists ? Object.keys(memberDoc.data()).filter((k) => /pin/i.test(k)).join(',') || 'no pin-like fields' : ''
  );

  // --- 5. The server-side view, via the API when it is running ---------
  if (cookie) {
    const cookieHeader = cookie.split(';')[0];
    const session = await fetch(`${BASE}/api/auth/session`, {
      headers: { cookie: cookieHeader },
    }).then((r) => r.json()).catch(() => null);

    check('/api/auth/session resolves the member', session?.user?.name === 'Jane Wanjiku');

    // A wrong current PIN must be refused. (The correct PIN succeeding is
    // covered by the login check above; this is the negative case.)
    const wrong = await changePin(cookieHeader, usedPin === '0000' ? '1111' : '0000', '9999');
    check('/api/auth/change-pin rejects a wrong old PIN', wrong.status === 401, `status ${wrong.status}`);

    // A correct PIN must be accepted — and then immediately put back, or the
    // next run of this script cannot log in.
    const changed = await changePin(cookieHeader, usedPin, '9999');
    check('/api/auth/change-pin accepts the correct PIN', changed.status === 200, `status ${changed.status}`);
    if (changed.status === 200 && usedPin !== '9999') {
      const restoreCookie = (changed.headers.get('set-cookie') ?? cookie).split(';')[0];
      const restored = await changePin(restoreCookie, '9999', DEMO_PIN);
      check('PIN restored to the seeded value', restored.status === 200, `status ${restored.status}`);
    }

    // And a request with no cookie at all must not authenticate anyone.
    const anon = await fetch(`${BASE}/api/admin/members`);
    check(
      '/api/admin/members rejects an anonymous caller',
      anon.status === 401 || anon.status === 403,
      `status ${anon.status}`
    );

    // --- 6. Privilege escalation ---------------------------------------
    // This is the bug the split was called in to close. Any logged-in member
    // must be refused by the admin API, and must not be able to promote
    // themselves by writing `role` — which the old rules allowed from any client.
    const asMember = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '+254712000005', pin: DEMO_PIN }),
    });
    if (!asMember.ok) {
      console.log(`\n  (privilege checks skipped — demo member login failed: ${asMember.status})`);
    } else {
      const memberCookie = (asMember.headers.get('set-cookie') ?? '').split(';')[0];

      const listAsMember = await fetch(`${BASE}/api/admin/members`, {
        headers: { cookie: memberCookie },
      });
      check(
        'a plain member cannot list the roster via /api/admin',
        listAsMember.status === 401 || listAsMember.status === 403,
        `status ${listAsMember.status}`
      );

      // Find Grace's own id from the client SDK, then try to promote her.
      const grace = members.docs.find((d) => d.data().phone === '+254712000005');
      const escalate = await fetch(`${BASE}/api/admin/members/${grace.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: memberCookie },
        body: JSON.stringify({ action: 'update', name: 'Grace Njeri', role: 'admin' }),
      });
      check(
        'a plain member cannot promote themselves to admin',
        escalate.status === 401 || escalate.status === 403,
        `status ${escalate.status}`
      );

      // Confirm the database was not actually changed, rather than trusting the
      // status code alone.
      const graceAfter = (await getDoc(doc(db, 'members', grace.id))).data();
      check('the escalation attempt left role unchanged', graceAfter?.role !== 'admin',
        `role is still ${graceAfter?.role}`);

      // A reset-PIN attempt from a non-admin would let anyone take over the
      // treasurer's account, so it gets the same treatment.
      const hijack = await fetch(`${BASE}/api/admin/members/${jane.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: memberCookie },
        body: JSON.stringify({ action: 'reset-pin', pin: '0000' }),
      });
      check(
        'a plain member cannot reset another member\'s PIN',
        hijack.status === 401 || hijack.status === 403,
        `status ${hijack.status}`
      );

      await fetch(`${BASE}/api/auth/logout`, {
        method: 'POST', headers: { cookie: memberCookie },
      }).catch(() => {});
    }

    await fetch(`${BASE}/api/auth/logout`, {
      method: 'POST', headers: { cookie: cookieHeader },
    }).catch(() => {});
  } else {
    console.log('\n  (server-side checks skipped — no app running on :3000)');
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log('\nFailed:');
    for (const f of failed) console.log(`  - ${f.name}`);
  }
  process.exit(failed.length ? 1 : 0);
};

run().catch((err) => {
  console.error('Verification crashed:', err);
  process.exit(1);
});