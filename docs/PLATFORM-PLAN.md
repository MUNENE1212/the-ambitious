# The Ambitious — Platform Delivery Plan

How the Y&A pilot becomes a multi-group investment platform: bonds, shares,
group projects, mobile-first, chatbot-assisted.

- **Prepared:** 20 Oct 2026
- **Status:** plan — nothing in it implemented yet
- **Companions:** [`../PLAN.md`](../PLAN.md) (pilot blueprint),
  [`ARCHITECTURE.md`](./ARCHITECTURE.md) (pilot as built)

---

## 0. Bottom line

The pilot is a good app that cannot become a platform without three
foundational changes, and none of them is a feature:

1. **A real double-entry ledger.** Every shilling that moves must become a
   balanced journal posting with a chart of accounts. Today the money model is
   ad-hoc bucket arithmetic (`src/lib/financial.ts`), and it already has a
   100% double-count bug the moment the group deploys capital into an
   investment (§2.1). You cannot issue a bond, allocate shares, or run an
   escrow on top of bucket math.
2. **A trusted server on the write path.** Today any browser can write anything,
   and roles are enforced client-side only (§2.2). For an app that records
   people's savings and investment returns, that is disqualifying. The good
   news: a Next.js server already runs on the VPS under PM2, and
   `firebase-admin` is already a dependency — the backend skeleton is there and
   unused.
3. **Tenant isolation.** Every collection is currently global and unscoped
   (`config/settings` is a single document). Group #2 needs
   `groups/{groupId}/…` before it exists.

And one constraint that shapes everything the "AI" layer can honestly do: **the
data is tiny.** A group is ~540 member-months. No supervised ML is defensible at
that size, and an insight a member can interrogate at an AGM is worth more than
a more accurate one nobody understands. The insight engine (§4.12) is therefore
rules and statistics with provenance, using models only for free text — not a
model trying to decide a member's worth.

Everything else — offers, subscriptions, allocation, bonds, the chatbot — is a
consumer of those three. Sequence accordingly.

**The fastest honest path to "deployed":** Phase 0 makes the existing pilot
defensible and is shippable in about two weeks without adding scope. The
platform phases follow, each with a working product at the end.

---

## 1. What we already have (assets)

Do not underestimate these; the plan is mostly assembly, not invention.

- **A working, feature-complete pilot.** ~5,700 LOC across 12 pages. No stubs.
  Typecheck and `lint:strict` are clean on Node 24. The contribution ledger,
  fines engine, AGM Party Fund, vote-verification, meeting minutes, exit-request
  flow, and forum all exist and are exercised by 13 real members.
- **A constitution expressed as configurable data.** `Settings` already carries
  every figure — entry fee, per-group-year contribution rates, cutoff day, fine
  amounts, welfare payouts, exit deduction percentage, AGM date, member cap.
  That is the seed for the chart of accounts and the rule engine, and it means
  rule changes never need a redeploy.
- **A genuine product thesis.** Rule execution, peer-verified money movement,
  office-bearer titles with deputies, ring-fenced AGM fund, "shares resold
  before exit payout" — this is not a generic budgeting app, and the exit-resale
  rule is in fact a **share transfer**, which is the seed of the whole
  investment-share model.
- **Mature CI/CD.** Lint + typecheck + build on every PR, artifact upload, SSH
  deploy to VPS, atomic symlink swap, health check, automatic rollback on
  failure, 5-release retention. This is production-grade and it is the reason
  the plan can promise fast, safe iteration.
- **PWA groundwork.** Service worker with cache-busting stamped per deploy,
  manifest, navy/gold icons, install banner.
- **A local Firestore emulator + seed script**, so integration work is testable
  without touching production.

---

## 2. What is in the way (liabilities, with evidence)

### 2.1 The money model cannot represent capital deployment — live bug

`calculateFinancials()` computes:

```
cashOnHand      = openingCash + withdrawals − cashExpenses − deposits
bankBalance     = openingBank + contributions + deposits − mpesaExpenses − withdrawals
totalGroupFunds = cashOnHand + bankBalance + investmentsValue
```

`investmentsValue` sums `amountInvested` on every non-closed investment. But
recording an investment (`src/components/pages/investments-tab.tsx:60`) writes
**only** to the `investments` collection — no `bankTransactions` entry is
created. Nothing removes the money from the bank balance when the group
deploys it, and nothing adds it back when it returns.

Consequence: recording a KES 100,000 investment reports group funds as
KES 100,000 higher than they are, for as long as it is open. Closing it
(`closeInvestment`) records `actualReturn` but posts no deposit, so the
principal and return never re-enter the bank balance. The treasurer's only
workaround today is to manually record a matching bank withdrawal — an
undocumented convention, not enforced by anything, and not linked by ID.

`bankTransactions` has no type for "deployed into an investment" even if the
treasurer wanted to be correct. This is not a patch; it is the argument for the
ledger in §4.4.

### 2.2 Anyone can be anyone

- `firestore.rules` says `allow read: if true` for every collection, including
  `members`, which stores `pinHash`. An unauthenticated client with the Firebase
  web config can read every member record and every financial record, and
  bcrypt-crack the PINs offline.
- **The rules file is never deployed.** There is no `.firebaserc`, no CI step,
  and no script that runs `firebase deploy --only firestore:rules`. Whatever is
  live is whatever was clicked in the console, unenforced and unreviewable. The
  repo's rules are documentation, not policy.
- The session is `{memberId, expiresAt}` in `localStorage` with no signature
  (`src/lib/auth-context.tsx`). Writing any member ID into that key logs you in
  as that member.
- PIN verification runs in the browser, so the hash must be shipped to the
  client to verify against.
- Role lives in a client-writable document and `allow update: if true`, so any
  member can set their own `role: 'admin'`.
- Lockout (`failedAttempts`, `lockedUntil`) is also client-writable, so the
  rate limiting can be reset by the attacker it is meant to stop.

The app is running on the assumption that members are honest. The product
thesis is that it doesn't need that assumption. Today it does.

### 2.3 Automation runs on someone's phone

Dues generation (`src/lib/use-auto-dues.ts`) and the fine sweep
(`src/lib/use-auto-fines.ts`) execute in the browser of whoever happens to open
the app. The clock is the visitor's device clock. A member can suppress the
fines that apply to them, and the group's fine records depend on who logged in
last. `useAutoDues` also pulls **every** member document on each qualifying
visit, which does not survive 100k members.

For a cooperative whose constitution is the product, rules that a member can
influence are not rules.

### 2.4 Single tenant by accident, not by design

`config/settings` is one global document read by `useSettings()`. There is no
`groupId` anywhere in the data model. Every page queries top-level collections.
Group #2 would read group #1's money.

### 2.5 No tests, no idempotency, no audit trail

There is no test runner in `package.json`. There is no idempotency key on any
write — double-tapping "record payment" writes twice. There is no append-only
event log: `verifiedBy`/`recordedBy`/`seenBy` are scattered fields on unrelated
documents, so "who changed this, when, and what did it say before" cannot be
answered, which is exactly the question a cooperative dispute or an auditor
asks.

### 2.6 Thin evidence base for the regulated path

The pilot has never handled a bond, a third-party investor, or a second group.
The regulatory research that determines what the platform may legally offer is
still in flight (§9). Nothing in Phases 0–2 depends on it; everything in Phase
5 does.

---

## 3. Product scope ladder

Each rung is shippable and useful on its own; we do not skip rungs.

| Rung | What it is | Who can invest | Needs |
|---|---|---|---|
| **0. Sound pilot** | One group, correct books, real auth | Members only | Phases 0–1 |
| **1. Multi-group** | N cooperatives on the platform | Each group's own members | Phase 2 |
| **2. Product engine** | Group offers: shares, projects, loans, deposits-with-return | Members of the group offering | Phase 3 |
| **3. Money movement** | In-app M-Pesa collection, verified against the till | Same | Phase 4 + Daraja |
| **4. Regulated instruments** | Bonds to members; any external capital | Broader | Phase 5 + counsel |

Rungs 0–2 are where the value is and where we should focus. The user-facing
promise at rung 2 is: *your group's treasury runs the constitution, your money is
traceable to the shilling, and your group can launch a project or issue a bond
internally and the app does the allocation, the servicing, and the books.*

### The financial-engineering core

This is the part that makes it a platform rather than an app. Four primitives,
each generic enough to absorb new instruments without schema changes:

1. **Instrument** — a promise with terms: `share` (no maturity, dividend when
   declared), `bond` (tenor, coupon rate, redemption value, payment dates),
   `project` (target, min/max subscription, return mode, waterfall),
   `contribution`/`deposit` (the existing dues, with return), `loan`.
2. **Offer** — an instrument offered to a group, with a subscription window,
   caps, and approval requirements.
3. **Subscription → Allocation** — members commit; the engine allocates
   deterministically when the window closes or the target is hit.
4. **Position** — what each member holds: units, cost basis, accrued coupon,
   declared-but-unpaid dividend, maturity date.

New instruments become configuration, not new collections.

---

## 4. Target architecture

```
┌─────────────────────────────────────────────────────────────┐
│  PWA client (Next.js App Router, client components)         │
│  screens · onSnapshot reads · offline cache · chatbot UI    │
└───────────────┬─────────────────────────────┬───────────────┘
                │ reads (scoped by rules)      │ writes (always)
                ▼                             ▼
┌────────────────────────────────┐   ┌─────────────────────────────┐
│  Firestore                      │   │  Next.js API (VPS, PM2)     │
│  groups/{gid}/…  — realtime     │   │  auth · ledger · offers ·   │
│  journalEntries (append-only)   │◄──┤  jobs · payments · chatbot  │
│  rules enforce tenant + role    │   │  firebase-admin · JWT        │
└────────────────────────────────┘   └──────────────┬──────────────┘
                                                     │
                              ┌──────────────────────┼──────────────────┐
                              ▼                      ▼                  ▼
                       node-cron jobs        Daraja / PSP        LLM provider
                       (lease-locked)         (later)              (read-only tools)
```

### 4.1 Tenancy — subcollections, not a `groupId` field

**Decision: `groups/{groupId}/members`, `groups/{groupId}/contributions`, etc.**

The alternative — a `groupId` field on flat collections — is cheaper to
migrate and much worse: every query must remember to filter, and one omission
leaks one tenant's money into another's screen. A missing filter in a
cooperative's financials is the worst bug this platform can have, so the
structure should make the mistake impossible rather than merely discouraged.

Subcollections also give tenant isolation *in the rules language itself*:

```rules
match /groups/{groupId}/{document=**} {
  allow read: if signedIn() && isMemberOf(groupId);
  allow write: if false;   // money writes are server-only — see §4.3
}
```

- **Migration:** every `collection(db, 'members')` becomes
  `collection(db, 'groups', gid, 'members')`. Roughly 100 call sites, entirely
  mechanical, and the compiler finds them. One migration script moves existing
  documents under the pilot's group ID and rewrites `config/settings` into
  `groups/{gid}/settings`.
- **Cross-group operations** (platform admin, statements that span groups) use
  `collectionGroup()`, which Firestore indexes and serves efficiently.
- **One person in several groups:** membership is a subcollection document, and
  a top-level `users/{uid}` holds the identity and the list of group IDs.
- **`groups/{groupId}`** itself holds the tenant record: name, status, plan,
  onboarding/KYC state, currency, settings pointer.

### 4.2 Identity — this is the decision that gates the security model

Firestore rules can only authorize what `request.auth` says. There is no way to
validate a hand-rolled token from a client header. So:

| Option | Tenant isolation | Realtime + offline | Cost | Effort |
|---|---|---|---|---|
| **A. Firebase Auth phone OTP + custom claims** | Real | Yes | Needs Blaze billing + SMS | Medium |
| **B. Keep PIN, move all reads through our server** | Real | Lost (needs own realtime layer) | Free | High |
| **C. Keep PIN, permissive client reads** | None | Yes | Free | Zero |

C is today's state and is not acceptable once other people's money is in it.

**Recommendation: A**, phased so the pilot is never blocked:

1. **Now:** server-verified PIN. `POST /api/auth/login` checks the PIN with
   `firebase-admin`, issues a signed, httpOnly, `SameSite=Strict` session
   cookie; hashes are never sent to the client; lockout counters move server-side.
   This alone kills the PIN-cracking and impersonation problems.
2. **At Blaze:** Firebase Auth phone OTP as the primary factor, with the server
   minting custom claims (`groupIds`, `role`, `titles`) via the already-installed
   `firebase-admin`. Rules then enforce isolation, and the service worker keeps
   its offline cache.

In both phases, **money writes are server-only** (§4.3), so authorization for
the dangerous operations never depends on client-side state.

A phone+PIN fallback should be retained for members who lose signal — Kenyan
mobile-money norms make SMS OTP dependency a real accessibility risk.

### 4.3 Trusted write path

Client `onSnapshot` listeners stay for **reads**. For **writes**, every
money-affecting action goes through the Next.js API, which uses `firebase-admin`
(the dependency is already installed and currently unused) and is validated by
rules as server identity. Rules will `allow write: if false` on financial
collections, so a compromised client cannot corrupt books even if it bypasses
the UI entirely.

Every money endpoint must have:

- **Idempotency key** — client-generated per intent (`pay-month-2026-10-<uuid>`),
  stored with the result; a repeat returns the first result. This is what makes
  "double-tap pay" safe.
- **Validation against `Settings`** — amount, cap, cutoff, quorum — server-side,
  re-read at write time, not trusted from the client.
- **Append-only audit record** — actor, group, action, entity, before/after
  hash, IP, user agent, request ID, timestamp.
- **A single posted journal entry** (§4.4) — the source of truth is the ledger,
  not the collection that triggered it.

Reads of derived data can stay client-side. Anything that computes money moves
server-side.

### 4.4 The ledger

**Design: append-only double-entry journal, derived balances, immutable
postings.**

```
journalEntries/{id}
  groupId, date, memo
  sourceType: 'contribution' | 'fine' | 'expense' | 'offer' | 'position' | …
  sourceId, idempotencyKey
  lines[]: { accountId, memberId?, offerId?, debit, credit }
  postedBy, postedAt, requestId
  reversedBy?: id          // corrections are reversals, never edits
```

Rules: every entry balances to zero; postings are never updated or deleted;
errors are corrected by a reversing entry that references the original;
`accountBalances` and `memberBalances` are materialized for speed and can be
rebuilt from the journal by a script that CI verifies.

**Chart of accounts** (seeded from the constitution, extensible per group):

| Code | Account | Notes |
|---|---|---|
| 1100 | Cash on Hand | |
| 1110 | Bank Account | treasurer's bank |
| 1120 | M-Pesa Till / Paybill | if collected in-app |
| 1130 | Escrow — Offer *n* | one per live offer; **never** mixed with general funds |
| 1200 | Contribution Receivable | dues raised, not yet paid |
| 1210 | Fine Receivable | |
| 1220 | Subscription Receivable | |
| 1300 | Investment at Cost / Fair Value | per instrument held |
| 2100 | Member Current Account | per-member balance |
| 2200 | Member Share Capital | §4.5 |
| 2300 | AGM Party Fund Payable | ring-fenced, the current feature, now explicit |
| 3100 | Dividend / Interest Income | |
| 3200 | Fines Income | |
| 4000 | Expenses (by category) | |

Postings that fall out of existing features — these replace the implicit logic
in `financial.ts` with something auditable:

| Event | Debit | Credit |
|---|---|---|
| Monthly dues generated | Contribution Receivable 600 | Member Current 600 |
| Dues paid by M-Pesa | Bank 600 | Contribution Receivable 600 |
| Meeting-fee share of dues | (settled above) | AGM Party Fund Payable 100 |
| Fine levied | Fine Receivable 200 | Fines Income 200 |
| Fine paid | Bank 200 | Fine Receivable 200 |
| **Capital deployed into an offer** | **Escrow — Offer *n* 100,000** | **Bank 100,000** |
| **Offer returns principal + yield** | **Bank 115,000** | **Escrow — Offer *n* 100,000**; Investment Income 15,000 |
| Dividend declared | Retained Surplus | Dividend Payable |
| Dividend paid | Dividend Payable | Bank |
| Exit payout (net of 20%) | Member Share Capital, Exit Deduction | Bank |

The fourth row is the bug in §2.1, expressed as the correct behaviour. Every
existing screen — cash on hand, bank balance, AGM fund, member arrears, net
income — becomes a query over the journal rather than an independent
recalculation, which is how the three figures can never disagree again.

**Migration:** existing records become one opening journal entry per group,
built from `calculateFinancials()` output plus per-member balances, dated the
migration date, memo *"Opening balances — migration"*. Historic contribution
rows import as monthly journal entries via the existing
`scripts/import-history.mjs`, so the history is reconstructed rather than
discarded. Back out by deleting the journal and reverting to the old paths.

### 4.5 Product engine

**Offers.** `groups/{gid}/offers/{id}` — instrument type, terms, target amount,
subscription window, per-member min/max, approval requirement, status
(`draft → open → subscribed → funded → active → closed | cancelled`).

**Subscriptions & allocation.** Members subscribe within caps. Allocation is
deterministic and documented, because in a cooperative, fairness is the product:
order by `(createdAt, id)`; fill pro-rata to each member's cap; apply any
early-bird bonus before pro-rata; refuse over-subscription rather than silently
trimming. The exact algorithm is a spec with test cases, because it will be
argued about in a meeting.

**Escrow.** Subscription money moves to a per-offer liability account on
subscription and to the instrument's asset account on funding. Investor money is
never commingled with the group's general treasury — that separation is what
makes the platform trustworthy, and it is the shape an eventual escrow licence
would need.

**Instruments.** `share` (no maturity; dividends when declared from a basis the
group sets — NAV, earnings, or a fixed rate). `bond` (tenor, coupon rate,
payment dates generated from tenor, redemption at maturity, accrued-interest
tracking for the "who holds it on the coupon date" question). `project`
(target, min/max, return mode, waterfall — e.g. return of capital first, then
profit share pro-rata by subscription).

**Share register.** `shares/{memberId, classId}` with units, cost basis, issue
date, certificate number; plus an immutable transfer log. Note this already
exists in the constitution: *"payout waits until the vacated share is resold to a
replacement member."* That rule is a share transfer with a pending state, and
building the register from it means the exit flow gets more accurate, not
retrofitted.

**Positions & statements.** Per-member position and statement-of-account
derived from the journal, with running balance, yield earned, and value at a
stated valuation basis. The member-facing screen becomes a financial document,
not a summary.

**🚩 The legal instrument is a property of the offer, not of the schema.**
`KENYA-REGULATORY.md` §2 draws a line that changes how this section should be
read: under Cap. 490 s.2, a **deposit** is money that *shall be repaid*, while a
**share** is *permanent* equity held *as a co-owner*, capped at one-fifth per
member (s.15), requiring a register of shares (s.91(2)(l)) and attracting a
capital-proportional dividend (s.2). Cap. 490 contains **no withdrawal
mechanism for member money anywhere in the Act.**

So each instrument carries a `denomination: 'deposit' | 'share'` and the engine
posts accordingly — deposits as liabilities to members, shares as equity. **This
is exactly why D7's generic engine was the right call:** adoption of shares later
is *configuring an instrument type*, not a database migration. Had we
hard-coded "contribution = share" in July, this would be a rewrite.

Two statutory constraints the engine must model, because they will otherwise be
discovered at an AGM:

- **Cap. 490 s.45** permits investment only in a closed list (POSB, authorised
  securities, another co-op's shares, a licensed bank, statutory-body/company
  stock) **or in any other manner approved by resolution at a general meeting.**
  "Flexible investment including bonds and projects" needs a standing GM
  resolution authorising the categories, or a registered by-law amendment
  (**s.8(2)** — an AGM vote alone is *not* sufficient; registration with the
  Commissioner is what makes an amendment effective). **This is a governance
  prerequisite with weeks of lead time. Design for it, don't discover it.**
- **Cap. 490 s.19 — one member, one vote, irrespective of shares held.** Any
  share-weighted governance borrowed from company law is invalid here. The
  existing majority-vote exit flow is consistent; keep it.

**Tax, on distribution.** The moment a member receives interest or a bonus, the
society is a withholding agent: **s.10(3)(b) deems it a dividend**, it is
chargeable under s.3(2)(b), so **s.35(4) does not exempt it**, and **15% WHT
applies** (s.35(3)(a), Third Schedule HB para 5(a)), remittable **within five
working days** (s.35(5)). The ledger must compute it, net it at payout and carry
the liability. *Refunds of deposits are not distributions* — so the exit flow is
unaffected, and this starts at distributions, which is exactly here.

### 4.6 Governance engine

Proposals already exist in the forum with `votes[]`. Generalize into a
`proposals` collection with configurable quorum and majority from `Settings`
(the constitution's own thresholds), then **require a resolution reference on
every money-moving action**: expense, bank movement, offer launch, distribution,
exit. The link between "we agreed" and "money moved" is currently conventional;
here it becomes structural and queryable — `which resolutions created this
payment` becomes a one-line query.

The three-strikes rule stays human-executed with the app assisting, as the
existing blueprint intends.

### 4.7 Payments

Currently manual code entry, which is the right call for 13 members and the
wrong call at scale — manual verification does not survive 500 members across
10 groups. The plan is staged and does not block anything earlier:

1. **Per-group M-Pesa paybill** with a unique reference per member per month;
   the treasurer confirms against the till. One paybill per group, no Daraja
   dependency, still manual confirmation.
2. **A licensed aggregator — Paystack first** — once the second group's onboarding
   justifies it: the member taps pay, a code arrives, the app polls the result,
   the payment posts a journal entry automatically, and the treasurer's queue
   becomes exception-handling rather than data entry. Idempotency on the
   transaction code prevents double-posting.
3. **PostaPay** as the multi-wallet fallback, and **Wakandi / Data Integrated /
   Tanda** as co-operative-specialist alternatives.

**This ordering changed when the research came back** (`KENYA-REGULATORY.md` §5).
The question is no longer "Daraja or an aggregator" but **which licensed
processor**, and the answer is fairly constrained:

- **Paystack is the only aggregator both CBK-licensed and genuinely usable:**
  M-Pesa STK push at **1.5%**, **T+2** settlement to a bank account or M-Pesa
  wallet, M-Pesa transaction ceiling KES 150,000. 🚩 *Its M-Pesa **Till** carries
  a Nominated Number restriction that large organisations typically fail — so
  do not design the short-code path around it before asking.*
- **Flutterwave is not in either CBK directory** despite competitive published
  pricing. A material red flag, not a pricing question.
- **Kuda is dead in Kenya** — a Nigerian bank with Naira pricing.
- **PostaPay** (Postal Corporation of Kenya) is the verified multi-wallet option:
  issues real Tills and Paybills, interoperable with M-Pesa, Airtel Money, T-Kash,
  Vooma and banks via PesaLink, with standing orders and auto-settlement.
  Merchant collection rate is unpublished — request it.
- **Wakandi, Data Integrated and Tanda** are all CBK-licensed and all aimed
  specifically at SACCO/cooperative group collection. Data Integrated self-reports
  80+ SACCOs.

**And the architecture question is now answered, which is the more useful part:
a society paying through a licensed gateway is a *merchant*, not a payment
service provider, and needs no licence of its own.** Cap. 490B keeps the
deposit-taking regime at KES 10,000,000 core capital plus three ratio tests;
**our pilot sits at ~KES 60,000, 167× below.** More importantly, *every viable
rail settles into the group's own bank account* — a platform that pooled funds
would have to become a licensed merchant acquirer at KSh 50m, or accept an
unlicensed counterparty.

> **D2 ("collects, never custodies") is now confirmed from three independent
> directions** — the group's own co-operative law, the tax position in
> `LICENSING-AND-TAX.md` §1, and now the licensing economics. It is not a
> preference any more; it is the only structure that is simultaneously legal,
> taxed correctly and affordable.

One caveat the platform must carry forward: **a co-operative society is an AML
reporting institution under POCAMLA in its own right, regardless of gateway.**
Adopting an aggregator moves PSP-level merchant due diligence to the processor;
it does **not** move the society's own AML/KYC obligations.

Until a money rail exists, the platform **records** money and never **moves**
it. That boundary should be explicit in the product copy and in the terms.

### 4.8 Realtime, offline, PWA

Keep `onSnapshot`. Under subcollections the shape of the code barely changes,
and the service worker keeps its offline cache. Three additions for a
money-bearing app:

- **Offline writes queue** — a member who pays at a network dead spot must not
  believe they paid. Queue with a visible pending state, replay on reconnect
  with the same idempotency key, and show the server's confirmation.
- **Never cache money.** The service worker must not cache API or ledger
  responses; stale balances are worse than no balances.
- **Conflict handling** — last-writer-wins is unacceptable for financial
  documents. Server-owned writes and append-only postings remove the class of
  problem; where a genuine conflict exists, surface it rather than resolve it
  silently.

### 4.9 Chatbot

An assistant over the member's own data, deliberately constrained:

- **Read-only tools** — "what's my balance", "when is my next contribution due",
  "what did I hold in offer X", "summarise this meeting". It may query the
  ledger and may not write to it. No tool that moves money, ever.
- **Grounded** — answers cite the documents they came from; no free-form
  financial advice, no predictions, no recommendations of instruments.
- **Escalates to humans** — anything about disputes, refunds, expulsion, or a
  member asking about *their* position routes to the treasurer/officers with
  the conversation attached.
- **Honest scope** — it explains the group's rules and records. It is not
  advice, and the UI should say so.
- **Cost and privacy** — provider choice and retention are in §9; member
  financial data going to a third-party LLM is a data-protection question that
  must be answered before launch, not after.

### 4.10 Notifications

Push is the difference between a group that uses the app and a group that
doesn't. FCM web push, free, for: dues generated, payment due, payment
confirmed, fine applied, proposal needing a vote, resolution passed, offer
opening/closing, coupon/dividend payment, resolution requiring action.
In-app notification feed as the offline fallback.

### 4.11 Operations

- **Backup:** scheduled Firestore exports to a separate bucket with retention,
  plus a monthly restore drill. A cooperative's books must survive a lost VPS.
- **Audit:** append-only event log with a per-entity history view ("every change
  to this member, in order"). Answer disputes instead of arguing.
- **Retention:** per-entity retention rules aligned with the AML record-keeping
  obligations identified in §9.
- **Data subject rights:** export a member's complete record as a single
  portable file, and support correction and deletion requests where the law
  allows (the no-deletion audit rule and DPA erasure rights are in tension and
  must be reconciled deliberately — §9).
- **Multi-instance safety:** PM2 runs `instances: 1`; when that changes, jobs
  take a Firestore lease so two instances never post the same dues twice.

### 4.12 The insight engine

#### The governing constraint: the data is tiny, and that is fine

A group has ~12 members and ~45 months of history — about 540 member-months. Even
at 1,000 groups the whole corpus is roughly 50,000 member-months. **Nothing here
supports supervised ML.** A model trained on 540 observations per entity will
memorise noise, and in a cooperative the cost of that isn't an accuracy metric —
it's a treasurer explaining to a member why the app thinks they're a defaulter.

So the design rule is:

> **If a rule can compute it, a rule computes it. A model is used only where a
> rule genuinely cannot reach — free-text parsing and summarisation. And no model
> ever produces a number that enters the books.**

What *is* defensible at this scale is empirical base rates, rolling/median
statistics, EWMA smoothing, and Bayesian estimates with a **group-level prior
that individual members borrow strength from** — the hierarchical trick. One
cooperative's thin data leans on the platform's pooled data; a new member with
two months of history leans on the group average. That is honest statistics, not
machine learning, and it is explainable enough to defend in a meeting.

This is a feature. An insight a member can interrogate at an AGM is worth more
to a cooperative than a more accurate one nobody understands.

#### Architecture

```
ledger (source of truth)
   → feature store        materialised per-group & per-member metrics,
                          recomputable, versioned
   → insight engine       rules + statistical estimators (+ LLM for text only)
   → insight records      derived, with provenance; never authoritative
   → surfaces             officer dashboard · member view · push · chatbot grounding
```

- **Feature store** — `groups/{gid}/metrics/{memberId}.{period}` and
  `groups/{gid}/metrics/group.{period}`, holding things like days-to-pay
  (median, p85), payment base rate, consecutive unpaid months, outstanding
  balance, fine settlement rate, shareholding. Materialised so insight queries
  never scan the journal.
- **Insight records** — every insight is a stored document carrying
  `generatedAt`, the `ruleVersion`/model that produced it, a human-readable
  *why*, and **the ledger references it was computed from**. Officers can click
  through to the exact postings. An insight with no provenance is not shown.
- **Recomputation** — features and insights are derived, so they can be rebuilt
  and backtested. A nightly job recomputes; the whole store is disposable.
- **Insight ledger** — officers accept / dismiss / act on each insight. This is
  the only feedback signal that exists at this scale, and it is what tells you
  which insights are noise.
- **Backtesting before showing** — run a forecaster against the last 12 months
  *before* it appears on anyone's dashboard. A forecast that has never been
  scored is a guess with a chart around it.

#### Extraction is not parsing — and the ledger makes this expensive

A hard architectural rule, arrived at the hard way:

> **A constrained decoder guarantees the shape of the output, never the truth of
> its contents — at any model size.**

This was verified empirically, not inferred. A grammar-constrained small model
given a real M-Pesa confirmation SMS produced perfectly formed JSON with a
correct `amount`, an **invented transaction code**, and a **fabricated
timestamp**. A smaller model read `2000000000` from a KSh 2,000 message and
repeated digits without bound. The schema constraint held perfectly. Every
value inside it was unreliable.

That failure mode interacts badly with an append-only ledger. **A wrong value
flows in looking clean** — well-formed, correctly typed, indistinguishable from a
real one — and because postings cannot be edited, the only remedy is a
reversing entry. The design that makes the books trustworthy also makes an
extraction error expensive to undo and easy to introduce.

So the rules are:

1. **Money fields never touch a model.** Amounts, transaction codes and
   timestamps are extracted by regex and validated in code. A model may be
   consulted about *formatting* — what template is this, which field is which —
   and never about values that become postings.
2. **Every extracted field is independently validated**, regardless of which
   component produced it: the amount must parse and sit within plausible bounds;
   the timestamp must be sane relative to when it was pasted and cannot be in
   the future; **a transaction code that does not match the expected format is
   `null`, never guessed.**
3. **Schemas must make `null` representable.** A field that cannot be a null will
   be filled in to satisfy the schema — which is precisely the failure observed.
   Design the shape so "I could not read this" is a valid answer, and treat an
   unfilled field as a normal outcome rather than an error to be patched.
4. **Regex fails visibly, models fail silently.** An unknown SMS template makes
   the parser decline, which a human sees and can fix. A model produces a
   confident wrong answer instead. Send to a model only what regex genuinely
   cannot handle, and prefer a visible failure to a plausible one everywhere.

Rule 4 is why the plan says a model is used *only* where a rule cannot reach: it
is not about capability, it is about **which failure mode you would rather
have** when something is wrong with a cooperative's books.

#### What to actually build, in priority order

**1. Reconciliation intelligence — the highest-value item, and it needs no
model at all.** The treasurer's manual verification step is the thing that does
not survive 500 members (§3, rung 3). Regex parses the pasted M-Pesa
confirmation SMS into `{code, amount, phone, timestamp}`; codes are deduped
against those already recorded; and the bank statement (CSV/XLSX) is uploaded
to auto-match rows to the ledger, with the treasurer confirming each proposed
match. It measures itself: the auto-match rate *is* the quality metric, and it
starts at zero and climbs.

**An LLM is never in the path of a money field.** This is not a caution, it is
the architecture — see "Extraction is not parsing" below.

**2. Cash and collection forecasting.** Per member, the historical base rate of
paying in a given month plus the median and p85 lag from month start; rolled into
"At the 5th we expect KES X of KES 12,000, with KES Y at risk from three
members." Committee members use this to plan — it is the difference between
discovering a KES 5,000 hole on the 28th and on the 4th. Forecast obligations
forward too: approved-but-unpaid expenses, declared dividends, maturing bonds.

**3. Arrears early warning — framed correctly or not at all.** Signals:
consecutive unpaid months, a fine left unsettled across months, time since last
payment, deviation from the member's own median. Presented as an **officer
attention list**, not a member scoreboard, and explicitly **never** the basis for
a fine, a reminder escalation, or anything touching expulsion. The constitution
and a human decide those. This guardrail is not optional — the moment a risk
score becomes punitive, the platform has become the thing §3's fairness claim is
designed to avoid.

**4. Instrument pricing intelligence.** This is where genuine financial
engineering meets the group's own data. Given a proposed tenor and target, the
engine proposes a **terms sheet with reasoning**, not a number:
- the Kenyan risk-free anchor — CBK 91/182/364-day T-bill average yields, which
  are official, free and daily (already identified as a source in the pilot's
  `PLAN.md` §G);
- a group-specific risk premium from *that group's* collection rate and arrears
  trend;
- member absorption capacity — median monthly surplus across members, so the
  coupon is priced against what members can actually carry;
- a concentration limit — no single member above a configured share of an offer.

An officer can see why KES 500 for six months was suggested. That explainability
is the product; the number is incidental.

**5. Document intelligence.** Meeting minutes → extracted resolutions,
attendance and action items, each linked to the money movements it authorised
(§4.6). Long forum threads → a digest for members who missed the discussion.
The constitution PDF → **verified against `Settings`**, so a rule an admin has
drifted from the constitution is detected rather than discovered in a dispute.

**6. Natural-language access.** "How much did we spend on welfare last quarter?"
→ a structured query compiled against the ledger by a deterministic query
builder, executed as a parameterised query (**never** a generated string
interpolated into anything). Answers cite the postings they came from. The model
selects and names fields; the query builder validates the types and ranges, and
an unrecognisable request returns "I didn't understand that" rather than a
confident wrong sum — the same rule as item 1, applied to queries.

#### Guardrails — the non-negotiables

- **No model writes to the ledger.** Insights are advisory or draft; a human
  acts. Every money path from §4.3 stays server-side and deterministic.
- **Provenance or nothing.** No insight renders without its ledger references
  and version.
- **Aggregate by default.** Group-level insights are visible to all members.
  Member-level risk signals are officer-only, and never the basis for
  penalties — see item 3.
- **Minimum data to third parties.** Prefer aggregate or redacted payloads to
  external models; any member-level data leaving the platform needs a
  data-protection answer first (§9), not a footnote. Where an extraction step is
  cheap enough to run locally, run it locally.
- **Explainability at the AGM.** Every officer-facing insight carries a
  "why am I seeing this" line in plain language, plus a *report this insight*
  button feeding the insight ledger.
- **Say what it isn't.** The forecast is a forecast. Label the confidence and
  the sample size. A prediction drawn from eight months of a member's history
  must not be presented with the authority of a bank statement.
- **Never let a model write a money value.** Not into a posting, not into a
  parsed transaction, not into a query parameter. Schema conformance is not
  validation, and an append-only ledger turns a plausible wrong value into a
  permanent, correction-required defect. See "Extraction is not parsing".
- 🚩 **Predict the group; never score the member.** This was already the design
  instinct — hierarchical estimation over *aggregate* quantities — but the
  research turned it into a hard constraint. **DPA s.35(1)** gives every data
  subject a right not to be subject to a solely-automated decision with legal or
  similarly significant effect, including profiling, and **s.35(3)–(4)** require
  **written notice** of such a decision, a **right to request reconsideration**
  or a fresh human decision, and a **written response with the steps taken**.
  **General Regulation 49(1)(a)** makes ADM-with-significant-effect a **DPIA
  trigger** — and Reg 49 triggers are *not* size-qualified. **A named member's
  arrears-risk score is exactly that; the aggregate forecast is not.** If anyone
  proposes to rank members, the answer is no, and this is why.
- 🚩 **LLM calls must not carry member records.** Reg 41(2) requires a documented
  record of every cross-border transfer — date, recipient, justification,
  description of the data. **s.45(a)** permits not-for-profit processing that
  relates *solely to members* and is not disclosed outside without consent, and
  the proviso cuts against piping member data to an external model. ODPC's Sept
  2026 cross-border guidance requires that onward recipients be barred from using
  data for *"analytics, commercial exploitation, profiling, product improvement,
  or marketing"* — **and Google's standard terms reserve rights to use customer
  data for service improvement and to add sub-processors on notice.** Keep the
  insight engine's inputs aggregate; if a record must leave, log the transfer
  properly.
- 🚩 **A DPIA precedes the insight engine, not follows it.** Reg 49(1)(i) makes
  *"innovative use or application of new technological solutions"* a trigger, and
  **s.31(5) requires the report to be submitted 60 days before the processing
  begins.** Discovering this post-launch leaves us retroactively non-compliant.
  One page, before Phase 3.5 starts.

#### Sizing

No GPU, no training pipeline, no feature store service — the whole engine is a
scheduled job in the existing Node process writing Firestore documents, plus
LLM calls for text. That keeps it inside the current VPS for a long time and
means its cost is a few API calls a day per group, not a fixed platform bill.
Cost figures and provider choice are pending §9 research.

---

## 5. Security remediation order

Not a list of nice-to-haves. Ordered by what stops the most harm soonest.

1. **Deploy and enforce Firestore rules.** Stop reading `pinHash` from a public
   collection; deny client writes to financial collections; scope reads to the
   member's group. Wire it into CI with `@firebase/rules-unit-testing` so a
   regression fails the build. *This is a one-day fix to a catastrophic hole and
   it is the reason §2.2 matters.*
2. **Move PIN verification server-side**, stop shipping hashes to the client,
   issue signed httpOnly sessions, move lockout counters server-side. Kills
   impersonation and offline cracking.
3. **Route money writes through the server** with idempotency and audit records.
4. **Move dues and fine sweeps off the client** onto a server job with a trusted
   clock — so a member can no longer influence the rules that apply to them.
5. **Firebase Auth + custom claims** at Blaze, with PIN retained as fallback.
6. Automated dependency scanning, CSP/security headers, backup and restore drill.

Steps 1–4 need no billing, no external accounts, and no user-visible change —
they can ship immediately, which is why they are Phase 0.

### 5.1 Data-protection obligations — added after the DPA research

These are not a separate programme. They are **Gate 2 work items**, ordered by
what closes a real exposure soonest (`KENYA-REGULATORY.md` §4).

7. 🚩 **Close the DPA s.35 gap in the fine flow.** The automatic fine sweep is
   automated individual decision-making with legal effect. **Three small things:**
   a written notice naming the rule and the amount when a fine is applied; a
   one-page plain-language explanation of the fine logic, linked from the notice
   and shown at signup; and **a named officer who reviews challenges, with the
   outcome recorded in writing.** s.35(3)(a)–(4) and Reg 22 require all three,
   and this doubles as the Cap. 490 s.32 "show cause" process. **This is the
   cheapest, highest-value compliance item in the entire plan** — and it is the
   one place where the regulator is most likely to look first, because the
   behaviour is already live in production.
8. **Publish a written privacy notice at signup.** s.29 makes this mandatory at
   any size: what we hold (name, phone, PIN hash, balances, contribution
   history), why, who else sees it (office-bearers, Google/Firebase), **that it
   leaves Kenya**, retention, and what the member can demand.
9. **Written processor agreements with Firebase and any LLM provider** —
   s.42(2)(b) and Reg 24 specify subject matter, duration, nature, data types,
   subject categories, instructions, confidentiality, security, deletion or
   return on termination, and audit rights. **Also review Google's
   service-improvement and sub-processor terms against ODPC's Sept 2026
   cross-border guidance, which appears to be in tension with both.**
10. **Write and rehearse a breach plan to 24 hours.** s.43 gives 48 hours
    processor→controller and 72 controller→ODPC. Notifiable breaches under Reg 37
    include credentials and account data; **a member-list dump plainly
    qualifies.** With no incident-response capacity, treat 72 as 24.
11. **Stop retaining PIN hashes for exited members.** The constitution's
    no-deletion rule is **correct for the financial audit trail and wrong for a
    credential.** s.26(e) gives a 14-day erasure right (framed narrowly, for
    false or misleading data); **s.25(g) storage limitation is the cleaner hook.**
12. **Register with the Data Commissioner — KSh 4,000** — and ask whether Third
    Schedule item 8 ("provision of financial services") forces registration
    regardless of the small-society exemption. **The cost-benefit is not close;
    the fee is less than one late fine.**

---

## 6. Delivery plan

Sequenced so there is a working product at the end of every phase. Weeks assume
one developer working substantially full-time; the phases are honest estimates,
not commitments, and Phases 3–4 scale with a second contributor.

### Phase 0 — Make the pilot defensible *(~2 weeks)*

> **Prerequisite, already in flight:** the treasurer is backfilling the
> Jul–Sep 2026 paper months through the Ledger Entry flow, which writes to
> Firestore **from the browser**. Security item 1 (rules) would break that flow
> if it lands first. So: finish the backfill, then harden the rules — or harden
> the rules with client writes on `contributions` still permitted and revoke
> them once the money write paths are server-side. Take a snapshot with
> `node scripts/backup-snapshot.mjs` before any bulk edit; there is no undo.

Security items 1–4, plus the §2.1 investment/bank linkage fix as a stopgap
(a required matching bank transaction when recording or closing an
investment), plus backup + restore drill.

**Exit criteria:** rules deployed and enforced in CI; no `pinHash` readable
from a client; sessions unforgeable; money writes server-side and audited; dues
and fines computed by a server job; a scheduled, tested backup exists. No new
features, no user-visible change — this phase buys the right to build the rest.

### Phase 1 — The ledger *(~3–4 weeks)*

Chart of accounts, journal posting API with idempotency, materialised balances
+ rebuild tool, opening-balance migration, statements and member balances,
derived Funds screens, and **unit tests for the posting rules and for every
financial formula** (these are the tests that must exist before any instrument
ships).

**Exit criteria:** every shilling in the pilot's history is a journal posting;
cash/bank/investments/AGM-fund figures agree with the old screens and are
independently derivable from the journal; a second developer can reconcile any
member's position from the ledger without asking anyone.

### Phase 2 — Identity and tenancy *(~3 weeks)*

Subcollection migration, `groups/{groupId}` tenant records, Firebase Auth +
custom claims, tenant onboarding wizard (create a group, invite officers, set
constitution figures, import a roster), platform-admin console, one-person-
many-groups membership.

**Exit criteria:** three real groups running in production on isolated data with
rules enforcing isolation; the pilot migrated with no data loss and a verified
reconciliation.

### Phase 3 — Product engine *(~4 weeks)*

Offers, subscriptions, allocation with tests, escrow, positions, the share
register (absorbing the exit-resale rule), bond terms with coupon schedules,
project return modes, and governance resolutions gating money movement.

> **🚩 Two statutory prerequisites, and both have weeks of lead time — start
> them before the code, not when it is needed.**
>
> **Cap. 490 s.45** permits investment only in a closed list (POSB, authorised
> securities, another co-op's shares, a licensed bank, statutory-body or company
> stock) **or in any other manner approved by resolution at a general meeting.**
> "Bonds and projects" are not on that list. The group needs either a **standing
> GM resolution authorising the instrument categories**, or a **by-law amendment
> registered with the Commissioner** — and under **s.8(2) an AGM vote alone is
> not sufficient**. Registration is what makes an amendment effective, and
> s.8(3A) lets the Commissioner cancel one effected by misrepresentation.
>
> **Distributions need a withholding engine before the first one is paid.**
> s.10(3)(b) deems a member's interest or bonus a **dividend**; it is chargeable,
> so s.35(4) does not exempt it, and **15% WHT applies** under s.35(3)(a),
> remittable within **five working days**. The ledger computes it, the payout
> nets it, and the liability is carried. *Refunds of deposits are not
> distributions, so the exit flow is unaffected.*
>
> **Cap. 490 s.19 — one member, one vote** — the governance engine must not
> drift into share-weighted voting.

**Exit criteria:** a group launches a real project offer, members subscribe,
capital is escrowed and deployed, returns are distributed **net of withholding**,
and the entire lifecycle is visible in the ledger and on member statements.

### Phase 3.5 — Insight engine *(~3 weeks, startable after Phase 1)*

Deliberately overlaps Phases 3–4: items 1–3 of §4.12 depend only on the ledger
and the treasurer's workflow, so they can start as soon as Phase 1 lands.

Reconciliation intelligence (M-Pesa SMS parsing, code dedupe, bank-statement
matching), the feature store, collection forecasting, arrears early warning,
minutes → resolutions, and the officer insight surface with provenance.

> **🚩 Write the DPIA first — and note the clock.** Reg 49(1)(i) makes
> "innovative use of new technological solutions" a trigger, and **s.31(5)
> requires the report to be submitted 60 days *before* processing begins.**
> Discovering this after the feature is built leaves us retroactively
> non-compliant. One page, before the first line of engine code.
>
> **Boundary to hold: predict the group, never score the member.** The design
> already does this — hierarchical estimation over aggregate quantities — but DPA
> **s.35** and **Reg 49(1)(a)** make a member-level risk score a DPIA trigger and
> a subject-access obligation, not just an ethical concern. Aggregate
> forecasting is defensible; naming individuals is not.
>
> **Market data:** fetch the CBK **monthly** T-bill CSV (free, official, no key;
> lags 1–2 months) and take FX as a **manually-entered setting**. Do not build
> against `/bills-bonds/treasury-bills-average-rates/` — it looks right and has
> been dead since 2016 — and 🚩 **never against `/uploads/fx_rates/historical_data.csv`,
> which returns HTTP 200 with 37,877 rows and stops at January 2024.**

**Exit criteria:** statement matching is measurably improving the
auto-match rate; the forecaster has been backtested over 12 months and shown
with its confidence; every insight on the officer screen links to its postings;
**the T-bill benchmark is being read from the CSV, and no member-level score
exists anywhere in the codebase.**

### Phase 4 — Payments, notifications, chatbot *(~3 weeks)*

Per-group paybills and reference codes, **the Paystack STK path** (§4.7, revised
after research — not Daraja), FCM push, the read-only grounded chatbot, statement
PDFs/exports.

> Before any distribution reaches a member, **re-check the 5% digital-marketplace
> WHT question with a tax practitioner** and get **written confirmation on the
> 5% WHT on non-resident vendor fees**. Both are open in `LICENSING-AND-TAX.md`
> §6, and both are cheaper to answer before the first payment than after.

**Exit criteria:** a member pays in-app end to end; a payment posts exactly one
journal entry; officers approve by push; the assistant answers from ledger data
and cannot write.

### Phase 5 — Regulated path *(scoped by research + counsel)*

Whatever the compliance research in §9 requires before the platform can serve a
second group or offer an instrument to non-members. Deliberately last: rungs 0–3
carry the value and the risk is lowest while capital stays inside a single
cooperative's own membership.

### Parallel workstreams

- **Research/verification:** §9 items, plus counsel for Phase 5.
- **Design:** product and visual language for offers, positions, statements —
  the pilot's navy/gold system extends naturally, but statements and position
  screens are new surfaces with real design decisions.
- **Content:** onboarding copy, constitution in-app, member education on
  instruments. A cooperative platform that doesn't teach its members what a bond
  is has not solved inclusion.

---

## 7. Cost

Provisional. Numbers pending the infrastructure research (§9); the shape is:

- **Hosting:** the existing single VPS is adequate well past the first few
  hundred groups and should not be the constraint. The real step is a monthly
  spend cap with alerting so a traffic spike or a runaway job cannot become a
  bill.
- **Firebase Blaze:** only needed for Cloud Functions/Scheduler and phone auth.
  Avoidable entirely by using the existing Next.js server for jobs (§4.3), which
  keeps the pilot free-tier-compatible longer.
- **SMS/OTP and push:** scales with member count; needs a per-member cost model
  before Phase 4.
- **Payment processing — priced now.** Paystack M-Pesa STK is **1.5%** with
  **T+2 settlement** to a bank account or M-Pesa wallet, no setup or monthly fee;
  local cards 2.9%, international 3.8%; M-Pesa Till/Paybill transfers banded
  KES 40–350. On ~KES 100,000/month of member dues across one group that is
  **~KES 1,500/month** — and it is money moving into the *group's* account, not
  through the platform, which is D2 in the cost sheet as well as the compliance
  one. **Merchant KYC document requirements are unpublished**; expect the
  certificate of registration, KRA PIN certificate, directors' IDs, proof of
  address and a bank account in the society's exact name.
- **Insight engine:** no fixed platform cost — the statistics run in the
  existing Node process on a nightly schedule. The variable cost is a handful
  of LLM calls per group per day for text extraction and summarisation only.
  That is why the design rules out models on the numeric path: it is the
  difference between pennies and a bill that scales with member count.
  Provider pricing pending §9.

**Recommendation: stay on the current VPS + Next.js API until the payments and
identity phases are actually needed.** Every month of avoided complexity is a
month the ledger and the product engine get more attention, and the ledger is the
thing that makes the platform real.

---

## 8. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Ledger migration reconciles differently from the old numbers | High | Opening-balance entry is explicit and reversible; reconciliation report before cutover; never delete the old path until verified |
| Rules deployment breaks the live pilot | Medium | Emulator + rules unit tests; deploy behind a feature flag; staged rollout |
| Scope creep into regulated instruments before Phase 3 | High | Rung ladder is explicit; Phase 5 gated on research and counsel |
| Second group's data leaks into the first | Medium | Subcollections + rules tests + platform-admin read access is explicit and audited |
| Daraja onboarding takes months | Medium | Per-group paybills work with no Daraja dependency; PSP fallback identified |
| Fine sweep changing behaviour surprises members | Medium | Dry-run mode for a cycle, member-visible explanation of every fine, grandfather automation-era records |
| Members can't log in after the auth change | Medium | PIN fallback retained; staged rollout per group |
| Chatbot gives financial advice | Medium | Read-only tools, grounded citations, explicit escalation, no recommendation capability |
| An insight is overfitted to one group's tiny history | High | Hierarchical estimates with a pooled prior; backtest before display; show sample size and confidence; insight ledger to catch noise early |
| A risk score becomes punitive toward a member | Medium | Officer-only, never a basis for fines or expulsion, never shown to peers as a scoreboard — enforced in the product, not the docs. **Now also a statutory boundary: DPA Reg 49(1)(a) makes ADM-with-significant-effect a DPIA trigger (§4.12).** |
| Member financial data sent to a third-party LLM | Medium | Aggregate/redact by default, local extraction where cheap, DPA answer required before any member-level payload leaves (§9) |
| 🚩 **A member challenges an automatically-applied fine and we have no process** | **High — already live** | **DPA s.35(3)–(4) requires written notice, a right to reconsideration and a written response. Cap. 490 s.32 requires notice and an opportunity to show cause. §5.1 item 7 closes both — build it in Gate 2, not Phase 4.** |
| 🚩 **The group invests in something outside Cap. 490 s.45 without the required general-meeting resolution** | Medium | Engine models the s.45 permitted list; offers outside it require a resolution reference; standing GM resolution authorised before Phase 3 launches any instrument |
| 🚩 **A by-law amendment is passed at the AGM and assumed effective** | Medium | **Cap. 490 s.8(2): an amendment is not valid until registered with the Commissioner.** Model registration status explicitly; never treat an AGM vote as sufficient |
| 🚩 **The CMA finds a member-only bond offer is a public offer** | Unknown — unresearched | Counsel before Phase 5. D3 and §4.5's s.45/s.19 constraints are the mitigations available now |
| 🚩 **Google's terms conflict with ODPC's cross-border guidance** | Medium | Reg 41(2) transfer log; aggregate-only LLM payloads; written DPAs with Firebase and any model provider; §5.1 item 9 |
| An LLM-derived figure reaches the ledger | Medium | Deterministic query builder, parameterised queries only, no model on the money write path (§4.3), provenance on every output |
| Scope of work exceeds one developer | High | Phases have honest exit criteria; Phase 3+ assumes help; cut the ladder rather than half-build a rung |

**Kill criteria:** if Phase 1's ledger can't reconcile the pilot's real history,
stop and fix it before anything else — every later phase assumes correct books.

---

## 9. Open questions and research brief

### ✅ Research came back. Here is what it changed.

Six agents worked the Kenyan regulatory and payment questions and a seventh
covered tax. All read primary sources — Kenya Law, CBK directories and
gazetted regulations, KRA consolidations, ODPC guidance — and every finding is
recorded with its provenance and its unverified list:

| Document | Covers |
|---|---|
| **`KENYA-REGULATORY.md`** | Co-operative law (Cap. 490), deposit-taking and SSRA, payments and licensed processors, DPA/ODPC, T-bill and FX data sources |
| **`LICENSING-AND-TAX.md`** | ITA s.19A, withholding tax, VAT and SEPT, excise, 2023–2026 changes |
| **`INSIGHTS-RESEARCH.md`** | The schema-vs-truth finding that rewrote §4.12's extraction design; on-device sizing |

**The four findings that changed a decision:**

1. **A member's monthly contribution is legally a *deposit*, not a share**
   (Cap. 490 s.2; the Act has no withdrawal mechanism for member money at all).
   The exit flow's refunds are what make that true, and the app's naming is
   correct. → **`DECISIONS.md` D9.**
2. **DPA s.35 puts the automatic fine sweep inside a statutory right** not to be
   subject to solely-automated decisions, with a written reconsideration route
   we do not offer. → **§5.1 item 7, Gate 2.**
3. **Every viable payment rail settles into the group's own bank account**, and
   a society paying through a licensed gateway is a merchant, not a PSP.
   → **D2 confirmed a third time**; §4.7 rewritten around Paystack, not Daraja.
4. **A free, official, machine-readable CBK T-bill CSV exists** — closing the
   "no confirmed free source" follow-up in `CLAUDE.md`. The group currently
   **beats T-bills at every tenor** (91-day 8.750% on 19 Oct 2026 vs ~3.54% on
   savings), which is a real insight the engine can make. The FX "CSV" that
   looks healthy is a **2.5-year-dead trap**.

### 🚩 Still open — and it is now a short list

**The CMA questions did not get answered. No agent reached the CMA; `cma.or.ke`
returned 502 throughout.**

1. **Is a bond offered to the members of a single registered society a public
   offer?** 2. **Does pooling members' money to buy one asset create a
   collective investment scheme?**

> **These remain the highest-value open questions in the project.** They gate D3,
> D7 and the bond and share instrument types. Everything that touches them points
> favourably — member-only under LN 95/2010 reg. 15 and Cap. 490 s.43; the
> co-operative sitting in the middle under s.19A; one-member-one-vote under
> s.19; the deposit-taking thresholds an order of magnitude away — but **none of
> it is securities law.** Book counsel on these two.

Also open, with owners:

| # | Question | Owner |
|---|---|---|
| 3 | ODPC Third Schedule item 8 — does "provision of financial services" force registration regardless of size? | **KSh 4,000 and one email** → `compliance@odpc.go.ke` |
| 4 | AML record-keeping and retention — society vs platform duties under POCAMLA | Counsel, with #1–2 |
| 5 | Co-operative **model by-laws** and the **Co-operative Societies Rules** — the by-law amendment path in D9, and the reserve-fund percentage Cap. 490 s.47(2) delegates to them | The Commissioner; blocked last time by JS-loading and rate limits |
| 6 | M-Pesa confirmation SMS formats and bank-statement export formats, for §4.12's reconciliation work | Ask members; or capture real samples |
| 7 | Hosting cost at three scales; Firebase Blaze pricing; 2026 PWA-vs-store reality | Not researched |
| 8 | The **5% digital-marketplace WHT** (FA2025) reaching a member-capital platform | Tax practitioner, before Phase 4 |

**Treat every answer as advisory until confirmed by a Kenyan lawyer or the
relevant authority.** Two findings already bear on *live* behaviour — the fine
sweep and the naming of contributions — and those two should not wait for the
counsel engagement.

### Decisions I need from you

1. **Is this one group's tool, or a product sold to other cooperatives?** The
   rung ladder assumes both, but the identity model, onboarding, support, and
   regulatory path all get materially more expensive for the second reading.
2. **Will non-members ever invest?** This single answer determines whether the
   platform is a bookkeeping tool (rung 2) or a regulated marketplace (rung 4),
   and it should be settled before Phase 3 rather than after.
3. **Is the platform ever expected to hold or move money**, or only to record it?
   Every payment and regulatory question downstream depends on this.
4. **Timeline for rung 1 and rung 2**, and whether a second developer is
   available — it changes the phasing, not the sequence.
5. **Budget tolerance per member per month**, which sets the OTP channel, the
   payment rail, and the notification cadence.

---

## 10. What I'd do Monday

1. Ship Phase 0 security items 1–2 (rules + server-side auth). One or two days,
   removes the two worst exposures.
2. Write the ledger spec — chart of accounts, posting rules, opening-balance
   migration — and get it reviewed before any code. This is the document the
   whole platform stands on.
3. Get counsel on the two gating questions (§9 items 1 and 2). Book the call
   now; it has lead time.
4. Start the per-group paybill conversation with the treasurer; it is the
   first step toward in-app payments and it does not need Daraja.
5. Leave the pilot running and keep shipping to it. It is the best test harness
   the platform will ever have, and 13 real members are a better product team
   than any roadmap.