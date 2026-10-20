# Scoping: Firestore → local PostgreSQL for the pilot

Written 2026-10-20 to size the migration properly, before anything touches the
box. **This reverses D6** (`docs/DECISIONS.md`), which deferred exactly this.
Nothing here is a recommendation yet — it is the measurement, so the decision can
be made on numbers rather than impression.

## What was measured

Not estimated — counted from the tree.

| Measure | Count |
|---|---|
| TypeScript/TSX lines | 8,509 |
| Files importing `firebase/firestore` | 18 |
| Total Firestore API call sites | 214 |
| `onSnapshot` realtime listeners | **29 across 12 files** |
| `where()` queries | 9 |
| `runTransaction` | 1 |
| `writeBatch` | 0 |
| `arrayUnion` write sites | 4 |

D6's "~5,700 lines of data access" estimate was close. The whole tree is 8,509
lines, and the Firestore surface touches nearly every page.

### Collections in use

`members`, `contributions`, `fines`, `expenses`, `bankTransactions`,
`investments`, `exitRequests`, `meetingMinutes`, `forumPosts`,
`attendance`, `config/settings`. Plus `secrets` and `sessions`, which the
secrets split moved out of `members` two commits ago.

Ten tables, twelve with auth. Not large.

## The three things that actually cost

### 1. Realtime — the real blocker

29 `onSnapshot` listeners across 12 files. Firestore pushes deltas to the
browser; PostgreSQL does not. Every one needs a replacement, and the app is
built around the push model — `dashboard.tsx` alone opens 6 concurrent
listeners, `funds-overview-tab.tsx` opens 4, and most pages subscribe to the
same collections independently.

Options, honestly costed:

| Approach | Cost | Trade-off |
|---|---|---|
| Polling on an interval | Low code, forever CPU | A treasurer reconciling the ledger re-reads constantly; on 2 vCPU this is real |
| Server-Sent Events per collection | Medium | One long-lived HTTP connection per tab; needs connection management under PM2 |
| Manual refresh + refetch on mutation | Lowest | Loses "I see Mary's payment land while I'm looking" — a genuine loss for a verification workflow |
| Postgres LISTEN/NOTIFY → SSE | Medium-high | Correct, but a second distributed-systems problem on top of a migration |

This is the item that decides whether the migration is worth doing. The other
two are mechanical.

**Sequencing note:** the fine sweep and auto-dues run on page load. Moving to
Postgres turns them into real cron jobs (already planned as Gate 2 work via
`node-cron`), which is a *win* — but only after the data layer moves.

### 2. Document-shaped data → relational

Firestore documents map unevenly. Four patterns need real thought:

- **`seenBy[]`, `votes[]`, `replies[]`** — arrays of embedded objects, appended
  with `arrayUnion`. These want child tables: `expense_seen_by`,
  `exit_request_votes`, `forum_replies`. In Postgres they also become
  *individually addressable*, which Firestore cannot do.
- **`config/settings`** — a singleton document. One row, or a key/value table.
- **Nested `agendaItems[]`** in meeting minutes — JSONB, or a child table.
- **Contribution `month` + `purpose`** — already a natural composite key, and the
  auto-dues logic relies on `(month, purpose)` uniqueness.

The money paths (`contributions`, `fines`) are the ones to get right first.
They are the audit trail, and the constitutional "no deletion" rule becomes a
`REVOKE DELETE` grant rather than a Firestore rule — which is stronger, not
weaker.

### 3. Authorization has to become real

Today Firestore rules are permissive and authority is enforced client-side
(`firestore.rules` says so explicitly, and points at Gate 3). That was tolerable
when the data was behind `allow update: if true`.

With Postgres there are no rules engine. **The API becomes the only door**, so
every query needs a role check — the same checks `src/lib/server/guard.ts`
already does for admin routes, extended to every collection. Getting this wrong
means any member reads the whole ledger. This is not optional work; it is the
point of moving.

## A live bug this would fix — or entrench

`castVote` in `src/components/pages/exit-requests.tsx`:

```ts
const newVote = { memberId: user.id, vote, votedAt };
const votes = [...req.votes, newVote];          // stale client-side copy
const outcome = checkVoteOutcome(votes, activeMemberCount);
await updateDoc(doc(db, 'exitRequests', req.id), {
  votes: arrayUnion(newVote),                    // atomic append
  status: outcome === 'verified' ? 'awaitingResale' : ...,   // ← from stale read
});
```

The append is atomic; the **status is decided from a stale snapshot**. Two
members voting at once both read `4/7`, both compute "not yet", both append — and
the request sits at 2 new votes when it should have flipped status. Worse: a
member who votes twice in different tabs produces a **duplicate vote** in the
array, because `arrayUnion` dedupes on whole-object equality and `votedAt`
differs each time.

`hasVoted()` exists and is tested, but it is checked against the same stale list
the write uses, so it does not prevent a cross-tab double-vote.

**This is a majority-vote flow on member refunds.** It is worth fixing
regardless of the data layer. In Postgres it becomes a single transaction with
`SELECT ... FOR UPDATE`, or better a `UNIQUE (exit_request_id, member_id)` on a
child table that makes a double-vote impossible at the schema level rather than
by convention.

Recommendation: fix it in Firestore first, on its own, because it is a
correctness bug that exists today. Then the migration has a correct behaviour to
preserve rather than a broken one to port.

## Security work already banked

The last three commits moved PIN hashing and role changes server-side. That work
is **not wasted** under Postgres — it gets simpler:

- `secrets/` and `sessions/` become `member_secrets` and `member_sessions` tables,
  reachable only from the server. The rules deny becomes a `REVOKE`.
- No Firestore rules to write, test, and CI-enforce.
- No `firebase-admin`, no service-account key, no `FIREBASE_CLIENT_EMAIL` /
  `FIREBASE_PRIVATE_KEY` secrets at all. **The blocker I hit last turn disappears.**
- The `readSecrets()` fallback that made the migration lockout-free becomes
  ordinary: one table, one query.

That is a real argument for the local database, and it is not a small one.

## The box

`69.164.244.165`, Ubuntu 24.04, **2 vCPU, 6 GB RAM**, 119 GB disk at 50%.

Postgres 17 is already running and serving six other databases — `typebot`,
`tomtin_erp`, `hub_db`, `ionline_db`, `mailserver_db`, `evolution_api` — plus
authentik. **Shared infrastructure.** The only non-system schema is an empty
`public`, so there is no existing table to collide with, and no migration of
anyone else's data is implied.

Constraints that follow:

- A **separate database** (`ambitious`), separate role, **no DELETE grant**.
- Connection limits: at 2 vCPU with 1.3 GB swap already in use, a
  `max_connections` bump for this app must be small. The pool, not the database,
  is the right place to cap it.
- No `DROP DATABASE`, no `pg_dumpall`, no touching the other six databases. Any
  migration tooling must be scoped to `ambitious` by name and refuse to run
  otherwise.
- Seven PM2 apps and 10 Docker containers share the box. A migration must not
  restart Postgres — that would take down authentik and five production apps.

## Effort, in three bands

**Band A — mechanical, low risk.** Schema for the 12 collections, child tables
for the array fields, a data-access layer mirroring the current Firestore API
shape (`collection()`/`doc()`/`where()` → a thin adapter), and a one-off
Firestore→Postgres importer. The 86 existing tests keep passing against pure
functions unchanged, because they test money logic, not data access.

**Band B — needs design.** Realtime replacement. Authorization on every
collection. The money paths (contributions, fines) done properly, with the
`month`/`purpose` uniqueness and no-delete guarantee. This is where the real
effort is.

**Band C — deferred until decided.** `use-auto-dues` and the fine sweep become
`node-cron` jobs on the box (already Gate 2 work). Ledger/chart-of-accounts
(Gate 3). Market data and insights (Phase 2). These get *easier* under Postgres
— analytical queries are the thing Firestore cannot do well — but none of them
should be attempted mid-migration.

## What I need decided before starting

1. **Realtime.** Polling, SSE, or manual refresh. This is the whole ballgame —
   Band B is 1 week or 4 depending on the answer.
2. **Does D6 get formally superseded?** It should be amended with the reason,
   not silently overwritten, so the next person reads why it changed.
3. **Is the Firestore data already live?** If the pilot has real member records
   in Firestore, the importer needs a rehearsed dry-run and a reconciliation
   report before cutover. If it is still demo data, this is far cheaper.
4. **Single group confirmed?** Postgres for one group is more operational surface
   than Firestore for one group. The argument for it gets much stronger at
   group #2 — which is the exact trigger D6 named. Worth being honest that this
   reverses the stated reason, not just the stated conclusion.

## What I did not do

No changes to the box. No database created. No migration run. The seven PM2 apps
and the six existing databases are untouched, and the read-only checks that
produced these numbers were all `SELECT`.