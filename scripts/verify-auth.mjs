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
import { loadEnv, adminFirestore } from './admin-db.mjs';

// Fixtures are created and torn down through the admin SDK, not the client one:
// the rules deny `delete` on exitRequests and bankTransactions (the audit-trail
// requirement), so a client-SDK cleanup would silently fail and leave junk
// behind. The client SDK below is still what answers "what can a browser do?".
loadEnv();
const admin = adminFirestore({ emulator: true, label: 'verify-auth' });

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

/**
 * A member cannot vote twice on the same exit request.
 *
 * Casts one vote, then a second from the same session. The second must be
 * refused and the stored array must still hold exactly one entry from that
 * member — otherwise one member is two votes toward the majority, which is how
 * an exit request could be carried without anyone else agreeing.
 */
const verifyVoteGuard = async (authCookie) => {
  const allMembers = await admin.collection('members').get();
  const grace = allMembers.docs.find((d) => d.data().phone === '+254712000005');
  const exiting = allMembers.docs.find((d) => d.data().phone === '+254712000002');
  if (!grace || !exiting) {
    check('vote guard ran', false, 'demo members missing — run npm run emulators:seed');
    return;
  }

  const reqRef = admin.collection('exitRequests').doc();
  await reqRef.set({
    memberId: exiting.id,
    memberName: exiting.data().name,
    initiatedBy: exiting.id,
    initiatedByName: exiting.data().name,
    reason: 'verify-auth fixture',
    refundBreakdown: {
      contributionsPaid: 0, welfarePaid: 0, arrears: 0,
      deductionPct: 0.2, deductionAmount: 0, netRefund: 0,
    },
    votes: [],
    status: 'pending',
    createdAt: Date.now(),
  });

  const cast = (cookie) => fetch(`${BASE}/api/exit-requests/${reqRef.id}/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ vote: 'approve' }),
  });

  const first = await cast(authCookie);
  check('first vote is accepted', first.status === 200, `status ${first.status}`);

  const second = await cast(authCookie);
  check('a second vote from the same member is refused', second.status === 409,
    `status ${second.status}`);

  // Verify the stored data, not just the response — a 409 with the vote
  // written anyway would be the worst of both.
  const voterId = await janeIdFrom(authCookie);
  const stored = (await reqRef.get()).data();
  const mine = (stored?.votes ?? []).filter((v) => v.memberId === voterId);
  check('the duplicate vote was not written', mine.length === 1,
    `${mine.length} entries from the voter`);

  // The exiting member cannot vote on their own exit.
  const selfCookie = await loginAs('+254712000002');
  if (selfCookie) {
    const selfVote = await cast(selfCookie);
    check('a member cannot vote on their own exit request', selfVote.status === 409,
      `status ${selfVote.status}`);
    await logout(selfCookie);
  }

  await reqRef.delete();
};

/** Login a demo member by phone and return just the session cookie. */
const loginAs = async (phone) => {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, pin: DEMO_PIN }),
  });
  if (!res.ok) return null;
  return (res.headers.get('set-cookie') ?? '').split(';')[0];
};

const logout = (cookie) =>
  fetch(`${BASE}/api/auth/logout`, { method: 'POST', headers: { cookie } }).catch(() => {});

/** The cookie is opaque, so resolve the caller's id from the session endpoint. */
const janeIdFrom = async (cookie) => {
  const res = await fetch(`${BASE}/api/auth/session`, { headers: { cookie } });
  const body = await res.json().catch(() => ({}));
  return body?.user?.id;
};

/**
 * A withdrawal needs two distinct signatories, and the recorder cannot be one.
 *
 * The old code wrote `status: 'approved'` on create and never wrote `approvals`
 * at all, so the constitutional rule (PLAN.md Section C) was inert: the balance
 * moved the instant the treasurer typed the amount in.
 */
const verifyWithdrawalGuard = async (authCookie) => {
  const created = await fetch(`${BASE}/api/bank-transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: authCookie },
    body: JSON.stringify({ type: 'withdrawal', amount: 100, description: 'verify-auth fixture' }),
  });
  if (!created.ok) {
    check('withdrawal recorded via the server', false,
      `status ${created.status} — ${(await created.json().catch(() => ({}))).error ?? ''}`);
    return;
  }
  const { id: txId, status } = await created.json();
  check('a new withdrawal is created pending, not approved', status === 'pending', `status ${status}`);

  const txRef = admin.collection('bankTransactions').doc(txId);

  // Jane recorded the withdrawal (authCookie is hers). Grace is an ordinary
  // member, so she is a legitimate first signatory.
  const graceCookie = await loginAs('+254712000005');
  if (graceCookie) {
    const graceSign = await fetch(`${BASE}/api/bank-transactions/${txId}/approve`, {
      method: 'POST', headers: { cookie: graceCookie },
    });
    check('an ordinary member can be the first signatory', graceSign.status === 200,
      `status ${graceSign.status}`);

    // The recorder cannot supply the second signature.
    const recorderSign = await fetch(`${BASE}/api/bank-transactions/${txId}/approve`, {
      method: 'POST', headers: { cookie: authCookie },
    });
    check('the recorder cannot sign their own withdrawal', recorderSign.status === 409,
      `status ${recorderSign.status}`);

    // One signature must not be enough, and a repeat must not become the second.
    const stillPending = (await txRef.get()).data();
    check('one signature leaves the withdrawal pending', stillPending?.status === 'pending',
      `status ${stillPending?.status}`);

    const repeat = await fetch(`${BASE}/api/bank-transactions/${txId}/approve`, {
      method: 'POST', headers: { cookie: graceCookie },
    });
    check('the same member cannot sign twice', repeat.status === 409, `status ${repeat.status}`);

    const afterRepeat = (await txRef.get()).data();
    const distinct = new Set((afterRepeat?.approvals ?? []).map((a) => a.memberId));
    check('only one distinct signatory is stored', distinct.size === 1, `${distinct.size} stored`);
    check('still pending after the repeat attempt', afterRepeat?.status === 'pending');

    // A third member is the genuinely independent second signature, and only
    // then does the money move.
    const thirdCookie = await loginAs('+254712000003');
    if (thirdCookie) {
      const secondSign = await fetch(`${BASE}/api/bank-transactions/${txId}/approve`, {
        method: 'POST', headers: { cookie: thirdCookie },
      });
      const afterSecond = (await txRef.get()).data();
      check('a second, different signatory approves the withdrawal',
        secondSign.status === 200 && afterSecond?.status === 'approved',
        `status ${secondSign.status}, tx status ${afterSecond?.status}`);
      await logout(thirdCookie);
    }

    await logout(graceCookie);
  }

  await txRef.delete();
};

/**
 * Only an admin may close a membership, and only for an approved request.
 *
 * Regression: `markPaidOut` wrote `members/{id}.active = false` from the
 * browser. The button sat behind a client-side role check and the rules allow
 * `update: if true`, so any signed-in member could have closed anyone's
 * membership. `active` is load-bearing — the vote threshold counts active
 * members, so deactivating people shrinks the denominator of every later vote.
 */
const verifyPayoutGuard = async () => {
  const allMembers = await admin.collection('members').get();
  const grace = allMembers.docs.find((d) => d.data().phone === '+254712000005');
  const jane = allMembers.docs.find((d) => d.data().phone === '+254712000001');
  if (!grace || !jane) return;

  // A PENDING request — approved by nobody. Paying this must be refused even
  // by an admin, or the refund goes out without a vote.
  const pendingRef = admin.collection('exitRequests').doc();
  await pendingRef.set({
    memberId: grace.id, memberName: grace.data().name,
    initiatedBy: grace.id, initiatedByName: grace.data().name,
    reason: 'verify-auth payout fixture',
    refundBreakdown: { contributionsPaid: 0, welfarePaid: 0, arrears: 0, deductionPct: 0.2, deductionAmount: 0, netRefund: 0 },
    votes: [], status: 'pending', createdAt: Date.now(),
  });

  const adminCookie = await loginAs('+254712000001');
  const memberCookie = await loginAs('+254712000005');
  if (!adminCookie || !memberCookie) {
    check('payout guard ran', false, 'could not log in both demo members');
    return;
  }

  // The headline check: an ordinary member must not be able to close a membership.
  const asMember = await fetch(`${BASE}/api/exit-requests/${pendingRef.id}/payout`, {
    method: 'POST', headers: { cookie: memberCookie },
  });
  check('a plain member cannot close a membership', asMember.status === 401 || asMember.status === 403,
    `status ${asMember.status}`);

  const graceAfter = (await admin.collection('members').doc(grace.id).get()).data();
  check('Grace is still active after the attempt', graceAfter?.active !== false,
    `active=${graceAfter?.active}`);

  // An admin must also be refused on a request nobody approved.
  const asAdmin = await fetch(`${BASE}/api/exit-requests/${pendingRef.id}/payout`, {
    method: 'POST', headers: { cookie: adminCookie },
  });
  check('an admin cannot pay out a request that was never approved',
    asAdmin.status === 409, `status ${asAdmin.status}`);

  const graceStillActive = (await admin.collection('members').doc(grace.id).get()).data();
  check('Grace is still active after the refused payout', graceStillActive?.active !== false,
    `active=${graceStillActive?.active}`);

  await pendingRef.delete();
  await logout(adminCookie);
  await logout(memberCookie);
};

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
    //
    // Note the cookie handling. A PIN change revokes every session for that
    // member (correctly — an attacker holding a stolen session must lose it)
    // and re-issues one in the response. So `cookieHeader` is DEAD from here
    // on: it names a session that no longer exists, and every later request
    // using it returns 401. That is not a bug in the app, and reusing it here
    // is what previously made the checks below fail for the wrong reason.
    const changed = await changePin(cookieHeader, usedPin, '9999');
    check('/api/auth/change-pin accepts the correct PIN', changed.status === 200, `status ${changed.status}`);

    let liveCookie = (changed.headers.get('set-cookie') ?? cookie).split(';')[0];

    if (changed.status === 200 && usedPin !== '9999') {
      const restored = await changePin(liveCookie, '9999', DEMO_PIN);
      check('PIN restored to the seeded value', restored.status === 200, `status ${restored.status}`);
      // The restore revoked that session too — take the fresh one.
      liveCookie = (restored.headers.get('set-cookie') ?? liveCookie).split(';')[0];
    } else if (usedPin === '9999') {
      // A previous run was interrupted between the change and the restore.
      // Put it back rather than leaving the fixture permanently altered.
      const restored = await changePin(liveCookie, '9999', DEMO_PIN);
      check('PIN restored after an interrupted previous run', restored.status === 200,
        `status ${restored.status}`);
      liveCookie = (restored.headers.get('set-cookie') ?? liveCookie).split(';')[0];
    }

    // The re-issued session must actually work, rather than assuming it.
    const afterPinChange = await fetch(`${BASE}/api/auth/session`, { headers: { cookie: liveCookie } });
    check('the session re-issued after the PIN change is live',
      afterPinChange.status === 200, `status ${afterPinChange.status}`);

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

    // --- 7. Vote and withdrawal guards ---------------------------------
    // Both of these were client-side read-modify-write against `arrayUnion`,
    // which dedupes on whole-object equality. Every entry carried a timestamp,
    // so the same member acting twice produced two entries — in the vote case
    // enough to carry an exit request on their own, and in the withdrawal case
    // enough to be both signatories of their own payout.
    //
    // Unit tests cover the threshold arithmetic, but not the transaction, so
    // these run against the emulator where the guards actually live. They must
    // run BEFORE the admin logs out — the session is destroyed by logout.
    await verifyVoteGuard(liveCookie);
    await verifyWithdrawalGuard(liveCookie);
    await verifyPayoutGuard();

    await fetch(`${BASE}/api/auth/logout`, {
      method: 'POST', headers: { cookie: liveCookie },
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