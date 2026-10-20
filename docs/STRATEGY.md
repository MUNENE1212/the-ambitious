# Strategy — Execution Run

The operating plan for the next continuous build push.

- **Prepared:** 20 Oct 2026
- **Covers:** Phase 0 and Phase 1 of [`PLATFORM-PLAN.md`](./PLATFORM-PLAN.md)
- **Decision record:** [`DECISIONS.md`](./DECISIONS.md)
- **Status:** agreed, not started

---

## 1. The strategy in one paragraph

Prove the books on one group before anything else. Everything the platform
promises — shares, bonds, projects, a second cooperative, insights — rests on
a member being able to trust a single number about their own money. So this run
does two things in order: **stop the app from being unsafe** (identity, secrets,
enforced rules, server-side rules engine, backups), then **replace its ad-hoc
money arithmetic with a real double-entry ledger** and migrate the pilot onto it
with a reconciliation that must come out to zero. No new visible features. No
tenancy, no payments, no instruments, no chatbot. The pilot keeps running and
keeps serving 12 real members throughout, which makes it the test harness for
everything that follows.

---

## 2. Scope of this run

**In**

- Server-side authentication with revocable sessions
- PINs and lockout state removed from client-readable documents
- Firestore rules actually deployed and enforced, with tests in CI
- Dues generation and the fine sweep moved off the browser onto a server clock
- Backups and a rehearsed restore
- The investment/bank double-count defect fixed at source
- Characterisation tests freezing today's financial behaviour
- Double-entry ledger, chart of accounts, server-only posting path
- Migration of the pilot's full history onto the ledger, reconciling to zero
- Funds and member statements derived from the ledger

**Out — deliberately, with the trigger that reopens each**

| Deferred | Reopens when |
|---|---|
| Multi-tenancy, `groups/{gid}/…` | Group #2 signs up. Also the point to settle Firestore vs Postgres with real numbers. |
| Payment collection (Daraja / PSP) | After the ledger; needs the compliance answers in `PLATFORM-PLAN.md` §9 |
| Instruments — deposit, project, share, bond | After the ledger. The engine is designed generic from day one so this is enabling, not rebuilding. |
| Insights and chatbot | Reconciliation intelligence is worth starting as soon as the ledger exists; the rest follows Phase 3.5 |
| Firebase Auth / Blaze | Only if SMS OTP is needed; server sessions cover the pilot |
| Compliance workstream | Book a lawyer now for the two gating questions; nothing in this run blocks on it |

---

## 3. Sequencing — the three gates that matter

The run has three gates. Passing out of order is how financial systems get
corrupted, so the order is a hard dependency, not a preference.

```
GATE 1 ── data is safe ────────────────────────────────►
  snapshot  →  backfill  →  reconcile  →  ledger migration
  (undo)      (treasurer)  (man agrees)   (proves itself)

GATE 2 ── identity and authority are real ────────────►
  secrets split  →  server auth  →  rules enforced  →  jobs on the server

GATE 3 ── the books are derived, not recomputed ──────►
  chart of accounts  →  posting engine  →  server-only writes  →  screens
```

Two consequences worth stating plainly:

- **The backfill must finish before the ledger migration.** The ledger is built
  by reading existing records; migrating a half-entered season bakes the error
  into the opening balances forever. This is why the treasurer's work is on the
  critical path, not alongside it.
- **Rules hardening must not block the backfill.** Ledger Entry writes to
  Firestore straight from the browser, so a rules deployment that denies client
  writes to `contributions` would lock the treasurer out on the night it matters.
  Gate 2 is therefore sequenced *around* the backfill: the secrets split and
  server auth ship first, and the write restrictions land only in Gate 3, once
  every money write goes through the ledger API.

---

## 4. Workstreams

### Gate 2 — identity and authority

**2.1 Split the secrets out.** Move `pinHash`, `failedAttempts` and
`lockedUntil` from `members` into a `secrets/{memberId}` collection that the
rules deny to clients entirely. Once auth is server-side the client has no reason
to hold a hash, so this is pure removal of risk. It is the single highest-value
change in the run: it closes the "anyone can read and crack every member's PIN"
hole with a one-collection change, and it is independently enforceable in rules.

**2.2 Server-side authentication.** `POST /api/auth/login` verifies the PIN with
`firebase-admin`, and issues an **opaque random token** stored as a hashed
`sessions/{id}` document and returned as an httpOnly, `Secure`,
`SameSite=Strict` cookie. Opaque over signed JWT, deliberately: revocation is
required (PIN change, deactivation, forced logout), and a server-side session
document gets it for free. Lockout counters move server-side inside a
transaction so they cannot be reset by the client they are meant to constrain.

The `AuthContext` interface stays exactly as it is — `user`, `login`, `logout`,
`changePin`. Twelve pages must not need to know this happened.

**2.3 Deploy the rules, and make CI enforce them.** Add `.firebaserc`, deploy
`firestore.rules` from CI with a service-account secret, and add
`@firebase/rules-unit-testing` so a rule change that reopens a hole fails the
build. Until this exists the repo's rules are documentation, not policy.

**2.4 Move the rules engine to the server.** Dues generation and the fine sweep
run as `node-cron` inside the existing Next.js server (via `instrumentation.ts`),
reusing the *existing* `fines.ts` / `groupYear.ts` logic unchanged, with a
Firestore lease so two instances can never double-post. A dry-run mode and a
visible run log matter here more than the code: the treasurer needs to see what
a sweep *would* do before it runs.

**2.5 Fix the investment double-count at source.** When an investment is
recorded, auto-create the paired bank withdrawal; when it closes, auto-create the
deposit carrying principal and return. This is what stops
`totalGroupFunds` over-reporting, and it is the minimum that makes the current
numbers truthful before the ledger replaces them.

**2.6 Backups and a rehearsed restore.** `scripts/backup-snapshot.mjs` exists.
Add scheduling, off-site copy, and — the part that actually counts — a restore
rehearsal with the SHA-256 verified. An untested backup is a belief, not a
backup.

**2.7 🚩 Close the data-protection gap in the fine flow.** New, and the only
Gate 2 item that touches what a member actually sees. The automatic fine sweep is
**automated individual decision-making with legal effect** — DPA 2019 s.35(1) —
and s.35(3)–(4) requires **written notice** of the decision, a **right to request
reconsideration** or a fresh human decision, and a **written response with the
steps taken**. Cap. 490 s.32 separately requires notice and an opportunity to
show cause before a fine. **Today we do none of that, and the behaviour is live
in production**, which makes this the item a regulator would look at first.

Three things, all cheap: a written notice naming the rule and the amount; a
one-page plain-language explanation of the fine logic, linked from the notice and
shown at signup; and **a named officer who reviews challenges, with the outcome
recorded in writing.** The appeals route doubles as the s.32 show-cause process.
Full reasoning in `PLATFORM-PLAN.md` §5.1 item 7.

**2.8 🚩 Data-protection housekeeping.** Same gate, because it is the same
evidence and the same storage. **Stop retaining PIN hashes for exited members** —
the constitution's no-deletion rule is right for the financial audit trail and
wrong for a credential (DPA s.25(g)). **Publish a written privacy notice at
signup** (s.29, mandatory at any size) that says plainly what we hold and that it
leaves Kenya. **Write processor agreements** with Firebase and any LLM provider
(s.42(2)(b), Reg 24), and review Google's service-improvement and sub-processor
terms against ODPC's September 2026 cross-border guidance, which appears to sit
in tension with both. **Write a breach plan to 24 hours**, not the statutory 72 —
with no incident-response capacity, and with credentials and member lists
plainly notifiable under Reg 37.

**2.9 Register with the Data Commissioner.** KSh 4,000, KSh 2,000 to renew. Ask
them whether Third Schedule item 8 — *"provision of financial services"* — forces
registration regardless of the small-society exemption. **The cost-benefit is not
close: the fee is less than one late fine, and it resolves an open question.**
`compliance@odpc.go.ke`.

### Gate 3 — the ledger

**3.1 Characterisation tests first.** Before touching a line of financial
logic, pin today's behaviour with unit tests over `financial.ts`, `fines.ts`,
`arrears.ts`, `catchup.ts`, `exit.ts` and `groupYear.ts`. These are the
specification the ledger must reproduce. Without them the migration is a
rewrite with no oracle, and there is no way to know whether a changed number is
a fix or a regression.

**3.2 Chart of accounts.** Seeded from the constitution, per group, extensible.
Asset / liability / equity / income / expense, plus per-member current accounts
and the per-offer escrow account.

**3.3 Posting engine.** A pure, heavily tested library: balanced entries,
idempotency keys, append-only, corrections by reversal only, materialised
balances with a rebuild tool that CI verifies.

**3.4 Server-only write path.** Every money mutation goes through the ledger API
under `firebase-admin`; rules then set `allow write: if false` on the financial
collections, so a compromised client cannot corrupt the books. This is the point
at which Gate 3's write restrictions land and Gate 2's backfill conflict
disappears for good.

**3.5 Migration and reconciliation.** Build one opening entry per group from
current state, convert the contribution history into monthly postings, and
produce a **reconciliation report** showing old figures against new, line by
line, for the treasurer to sign off. The migration does not ship if it does not
reconcile.

**3.6 Screens from the ledger.** Funds, member statement, arrears — all queries
over postings. `calculateFinancials()` retires rather than being kept in
parallel, because two sources of truth for money is the defect itself.

**3.7 🚩 Withholding on distributions.** New, and it is the one piece of tax
that the ledger must get right the *first* time, because it is wrong money
leaving the building. The moment a member receives interest or a bonus, the
society becomes a withholding agent:

**s.10(3)(b) deems it a dividend** → it is **chargeable** under s.3(2)(b) →
**s.35(4) does not exempt it** (that covers exempt income only) → **15% WHT
applies** under s.35(3)(a) and Third Schedule Head B para 5(a), remittable
**within five working days** (s.35(5)).

So the posting engine computes it, the payout nets it, and the liability is
carried on the books with a deadline. **Refunds of deposits are not
distributions, so the exit flow is untouched** — this starts at distributions,
which is exactly where the product engine begins. Budget 15% of every member
return as the society's remittance liability until a practitioner says
otherwise. See `LICENSING-AND-TAX.md` §1.

---

## 5. Acceptance gates

**Gate 1 — data is safe.** Snapshot exists and restores; Jul–Sep and May–Jun
2026 backfilled; treasurer has signed off that every month's status matches the
till; the audit shows no month with a missing member record unexplained.

**Gate 2 — identity and authority are real.** No client can read a PIN hash; no
client can escalate its own role or reset a lockout counter; sessions revoke on
PIN change and deactivation; dues and fines are produced by a server job that
logs what it did; rules tests pass in CI; a restore rehearsal is documented and
was actually run. **A member who disputes a fine receives a written notice
naming the rule, a plain-language explanation of the logic, and a reconsideration
request answered in writing by a named officer** (DPA s.35(3)–(4); Cap. 490 s.32).
**Exited members' PIN hashes are no longer retained.** A privacy notice is
published at signup; processor agreements are signed; a breach plan exists.

**Gate 3 — the books are derived.** Every shilling in the pilot's history is a
posting. Old and new totals reconcile to zero with any difference explained.
Rebuilding balances from the journal reproduces the materialised balances
exactly. Reversing an expense returns the balance to its prior state. A member's
position can be reconstructed from the ledger without asking anyone. **A
distribution computes 15% withholding, nets it at payout, and carries the
remittance liability** — and no money path anywhere writes a value a model
produced.

---

## 6. Risk and rollback

| Risk | Handling |
|---|---|
| Backfill entered wrongly | Snapshot + Gate 1 reconciliation before anything consumes the data; Ledger Entry updates in place, so correction is a re-save, not a deletion |
| Rules deployment breaks the live pilot | Emulator + rules unit tests first; deploy rules separately from the app deploy; keep client writes permitted on `contributions` until Gate 3 |
| Moving jobs to the server changes fine behaviour | Reuse the existing sweep logic unchanged; characterisation tests (3.1) are written *before* the move, so any semantic drift is caught |
| Ledger migration reconciles differently | Reconciliation report is a hard gate; the old path is retained and reversible until the treasurer signs off |
| Scope creep toward instruments or tenancy | Out of scope is written down in §2 with the trigger that reopens it; adding an instrument mid-run means the ledger is not done |

---

## 7. First actions

**Treasurer (blocking the critical path)**

1. Snapshot: `node scripts/backup-snapshot.mjs`
2. Backfill 2026-07, 2026-08, 2026-09 — Ledger Entry saves these as `Late` with
   the fine as typed, so a bare save means "did not pay, no fine". Members with
   no record prefill as `skip` and are left alone.
3. Backfill 2026-05 and 2026-06 — both are missing members entirely.
4. Reconcile against the till and confirm the month totals.

**Engineering (parallel, does not block the above)**

5. Characterisation tests over the existing financial libs.
6. Secrets split + rules for `secrets/` denying all client access.
7. Server auth with opaque revocable sessions.
8. Investment/bank linkage fix.

**Book now, block nothing**

9. A Kenyan lawyer, on two questions: whether a bond to members of a single
   registered society is a public offer, and whether collecting member money into
   a cooperative-held M-Pesa account is deposit-taking.

---

## 8. Research status

Three background investigations are running: the Kenyan regulatory path, money
rails and infrastructure cost, and insight-engine constraints. **None of them
blocks this run** — Gate 1 through Gate 3 depend on none of them. They gate the
payment, tenancy and instrument work that follows.

If they have not returned, the research brief in `PLATFORM-PLAN.md` §9 is
self-contained enough to run in parallel, or pick it up in a later session
without losing anything.