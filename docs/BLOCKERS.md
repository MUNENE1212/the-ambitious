# Blockers before one serious run

Written 2026-10-20, after fixing the double-vote bug and the two siblings of the
same defect. Everything here is either **fixed and verified** or **still open**.
The point is that one run should be the next thing that happens, not a fifth
round of findings.

## Fixed and verified in this pass

All three were the same bug: a client-side read-modify-write whose dedupe was
`arrayUnion`, which compares **whole objects** — and every entry in these arrays
carries a timestamp, so the same member acting twice produced two entries.

| Bug | Harm | Fix | Verified by |
|---|---|---|---|
| Exit-request votes | **One member could carry an exit request alone.** Two tabs, one second apart, two entries, both counted toward the majority. | `POST /api/exit-requests/{id}/vote` — one transaction, membership test on `memberId` | `verify-auth.mjs` 30/30 |
| Withdrawal sign-off | **The constitutional two-signatory rule was inert.** `bank-tab.tsx` hardcoded `status: 'approved'` on write; nothing ever wrote `approvals`; `financial.ts` ignored status entirely. A withdrawal moved the bank balance the moment it was typed in. | New `POST /api/bank-transactions` (server decides status), `POST /api/bank-transactions/{id}/approve` (two distinct signatories, recorder excluded), `financial.ts` counts only approved | same |
| `seenBy` / `replies` | "Seen by: Mary, Mary"; a forum double-click posted twice. Replies also took `authorId`/`authorName`/`authorTitles` **from the browser**, so any member could post as anyone, including as an office-bearer. | `POST /api/seen`, `POST /api/forum-posts/{id}/reply` — identity read from the member document, replies deduped by a server-checked reply id | same |

Checks: **99 unit tests pass** (7 files), typecheck clean, lint clean,
`npm run build` clean, `verify-auth.mjs` **30/30 twice** with no fixture residue.

Three of my own test bugs surfaced and were fixed rather than worked around — the
`vote()` helper defaulted to `undefined` instead of `'approve'`; a stray call
signed a withdrawal twice before asserting it *couldn't* be; and `janeIdFrom` was
compared without `await`, so the member id was a Promise. Also: `verify-auth.mjs`
was reusing a session cookie that `change-pin` had already revoked, which made
the new checks fail for entirely the wrong reason. That last one is worth
knowing — it is correct app behaviour (a PIN change must kill every session), and
the script now re-authenticates.

---

## Open blockers, in dependency order

### B1 — Pushing to `main` auto-deploys a broken app

**The one that can actually hurt.** `deploy.yml` fires on `workflow_run` when CI
passes on `main`, and `production` has **0 protection rules** — no approval gate.
The current health check only fetches `/`, which renders fine without
credentials. So `git push` today deploys an app whose **every member login
returns 503**, and the deploy goes green.

Fix, all before the next push:
- [ ] Add required reviewers on the `production` environment, **or** narrow
      `deploy.yml` to `workflow_dispatch` until phases 0–4 have run clean twice
- [ ] Add an `/api/auth/session` probe to the health check — probing `/` cannot
      see a 503 login, which is the most likely failure

### B2 — All six deploy secrets are missing

`VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `FIREBASE_CLIENT_EMAIL`,
`FIREBASE_PRIVATE_KEY`, `FIREBASE_PROJECT_ID`. Only the six `NEXT_PUBLIC_*`
values exist.

This is currently the *only* thing preventing a bad deploy, which is a poor
thing to rely on. Note also that **`FIREBASE_PRIVATE_KEY` contains literal
`\n`** and `appleboy/ssh-action` is known to mangle multi-line values through
`envs` — a truncated key produces the same 503 as a missing one, but *after* a
"successful" deploy. Write it to a root-owned `600` env file over a heredoc
instead of passing it through the runner environment.

### B3 — Both recovery scripts would take down seven other production apps

`scripts/recover-vps.sh` and `scripts/vps-fix.sh` each run **`pm2 kill`**, which
kills the whole daemon and every app in it — `iphone-onlineduka`,
`baitech-backend`, `platform-hub`, `ementech-backend-staging`,
`kuku-egg-tracker`, `dumuwaks-backend`, `ementech-backend`. Two of them already
show 25 and 47 restarts, so this has been run before and recovered by hand.

Replace with `pm2 delete the-ambitious` and drop the `pm2 kill` fallback. Until
then both are booby traps — **do not run them**.

### B4 — No vhost or certificate for `ambitious.emen.africa`

DNS already resolves to the box, but no vhost claims the name, so it falls
through to nginx's implicit default (`admin.ementech.co.ke.conf`) and 301s there.
**Anyone sent that link today lands on an unrelated production app.** No cert
covers the subdomain either; the `emen.africa` cert is apex-only, so certbot
needs to issue a new one (webroot, per this box's existing pattern).

### B5 — `ambitious.emen.africa` is not the only route to a bad login

The secrets split is **not deployed**. `members/{id}.pinHash` may still be
client-readable in production, and the session is still the old localStorage
object. The Phase 3 ordering matters: run `migrate-secrets.mjs` **before**
deploying the tightened rules, or unmigrated members' hashes stay exposed.
`readSecrets()`'s fallback makes the migration lockout-free, so there is no
excuse for doing it in the wrong order.

### B6 — The automatic fine sweep is a non-compliant automated decision

Already known, unchanged, and **not** a Phase 4 item — it is Gate 2. DPA 2019
s.35 gives members a right not to be subject to solely-automated decisions, with
a written reconsideration route (s.35(3)–(4)); Cap. 490 s.32 separately requires
notice and an opportunity to show cause before a fine. We do neither. Every
contributions-page visit currently flips overdue records to `Late` with a fine,
with no notice and no appeal. See `docs/PLATFORM-PLAN.md` §5.1 item 7.

### B7 — Any member can deactivate any other member

`exit-requests.tsx:90`, in `markPaidOut`:

```ts
await updateDoc(doc(db, 'members', req.memberId), { active: false, updatedAt: Date.now() });
```

The button is behind `canRecordFunds(user)`, which is a **client-side** check,
and the rules say `allow update: if true`. So the gate is decorative: any
signed-in member can call this against any member id and close their membership.

It sits in the same file as the vote flow just fixed, which is how it survived
the earlier audit — the vote was examined, the line below it was not.

`active: false` is not cosmetic. `countActiveSGMembers()` counts on it, so
deactivating members **shrinks the denominator of every future exit vote**, and
`isSavingsGroupMember`/`canVote` both gate on it. Deactivating enough members
could make a request pass on a handful of votes.

Fix: move to `POST /api/exit-requests/{id}/payout`, `requireRole('admin')`,
inside a transaction that also flips `status` to `paidOut` so the two writes
cannot diverge. Roughly fifteen minutes, and it is the last remaining client-side
`members` write.

---

The vote/withdrawal/seenBy fixes were instances of a pattern, not the whole of
it. **22 client-side write sites remain** (counted — `addDoc`/`updateDoc`/
`setDoc`/`deleteDoc` under `src/components`), plus one in `src/lib/use-auto-dues.ts`.
They still carry the two properties that made the three fixed bugs serious:

- **Identity from the client.** Anything writing `recordedBy`, `authorId`,
  `initiatedBy`, or a status field is asserting something the server should be
  reading from the member document.
- **Decisions from a stale snapshot.** Anything that computes a value and writes
  it in a separate field — the exact shape of the vote bug.

By collection:

| Collection | Sites | Risk |
|---|---|---|
| `contributions` | 11 (across `contributions.tsx` + `dashboard.tsx`) | **Highest.** Money + `status` transitions written from the browser; verification (`verifyContrib`) is a client write in *both* files. `use-auto-dues.ts` writes a `setDoc` on every logged-in visit. |
| `forumPosts` | 2 | Post creation's leadership check is client-side, so an Announcement can be created by any member |
| `meetingMinutes` | 2 | Minutes status → **triggers "Apply Absence Fines"**, which writes a `fines` record |
| `investments` | 2 | `amountInvested`, `actualReturn` — money |
| `expenses` | 1 | Same shape as the withdrawal bug that was just fixed |
| `members` | 1 | **See B7 — worse than it looks** |
| `exitRequests`, `config`, `fines` | 3 | Lower, but `config` holds every constitutional figure |
| *(`use-auto-dues.ts`)* | 1 | Fires on every logged-in visit, not on a user action |

**This is the real remaining hole.** Firestore rules are still
`allow create, update: if true` on all of these (deliberately, per the rules file
and Gate 3), so "client-side check" currently means *no check at all* for
anything that doesn't go through `/api`.

The honest framing: today's group is 6–13 demo members who trust each other, so
this is not an emergency. The moment a member's browser is not the treasurer's
browser, it is. Moving these to `/api` is mechanical now that `guard.ts`,
`arrays.ts`, `voting.ts` and the route pattern exist — it is the same work three
times over.

B7 is the one to do first among these: it is a single site, it takes minutes,
and unlike the rest it is a live privilege problem rather than a latent one.

## Deliberately not done

- **`financial.ts` counts only approved withdrawals.** Existing records were all
  written `status: 'approved'` by the old code, so nothing already in the ledger
  changes value. No backfill needed.
- **The Postgres migration** is scoped in `docs/POSTGRES-SCOPE.md` and still
  needs four decisions (realtime approach, superseding D6, whether Firestore data
  is live, single-group confirmation). None of it blocks a deploy.
- **Nothing on the box was changed.** No database created, no migration run, no
  nginx change, no PM2 action. Every check was read-only.
