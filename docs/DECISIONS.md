# Decision Record

Agreed 20 Oct 2026. Each entry records what was decided, why, and — importantly
— **what would reverse it**, so a decision can be revisited without re-litigating
the argument.

---

## D1 — The platform is a multi-tenant SaaS for cooperatives

**Decided:** other registered cooperatives become tenants, each with its own
constitution, officers, members and books. Our group is tenant #1 and the
reference implementation.

**Why:** this is what "the platform" was always meant to be. It is also the only
reading under which the pilot is doing real work — a single group's bookkeeping
app does not need a constitution-driven rule engine, an AGM party fund, or a
peer-verified exit flow.

**Reverses if:** group #2 does not materialise within a reasonable window, or
turns out to need something structurally different (SACCO-scale membership,
payroll integration, T24/Ucore-class requirements). Tenancy is deferred to Phase
2 precisely so this can be tested cheaply first.

---

## D2 — The platform collects money but never holds it

**Decided:** each group gets its own M-Pesa paybill; the app initiates
collection and posts the payment to the ledger automatically. Funds settle to the
group's own account. The platform is never the account holder.

**Why:** member experience improves enormously without the platform becoming the
business of holding other people's money. It keeps the regulatory path
substantially simpler and the trust model intact — a member can always ask
"where is my money?" and get an answer that isn't "with us."

**Reverses if:** counsel concludes that collecting through a platform paybill is
itself a regulated activity, or if product experience proves untenable without
in-platform escrow. Escrow is designed for (§4.5) but is a different decision.

**Corroborated independently by tax (see `LICENSING-AND-TAX.md` §1).** The
s.19A co-operative deduction, the s.10(3)(b) deeming provision and the Fourth
Schedule carve-out form a favourable regime that **only applies if the society
sits between the platform and the members.** A platform that pools capital itself
loses all three. Securities regulation, AML and tax now point the same direction
— which is a considerably stronger basis for this decision than any one of them
alone.

---

## D3 — Only a group's own members subscribe to its offers

**Decided:** subscriptions are limited to members in good standing of the group
raising the offer.

**Why:** keeps every subscription inside one cooperative's membership. This is
the single largest factor keeping the platform away from public-offer and
collective-investment-scheme territory, and it is also how real cooperatives
actually work — members fund their own ventures.

**Reverses if:** the group needs outside capital it cannot raise internally. That
is a Phase 5 decision requiring counsel, not an engineering one.

**Corroborated and hardened by tax (see `LICENSING-AND-TAX.md` §1).** Income Tax
Act **s.19A** allows a designated co-operative society to deduct bonuses and
dividends distributed to members from its chargeable income, with **s.10(3)(b)**
deeming those distributions dividends and the s.2 "qualifying dividend"
definition excluding them from the 5% regime. All of it only works **if the
co-operative sits between the platform and the members.**

More sharply: **s.19A(1)(b)** excludes a society the Commissioner considers a
body corporate carrying on business *"for its own profit,"* having regard to
**non-member transactions** and member numbers. Widening D3 to guests or public
subscriptions is therefore not only a securities-law question — it risks the
**tax treatment of every member's return**. Revisiting D3 now carries a tax cost
as well as a regulatory one, which raises the bar rather than lowering it.

**Now corroborated from three further directions** (`KENYA-REGULATORY.md` §3):
**LN 95/2010 reg. 15** prohibits a deposit-taking society from transacting
business with non-members; **Cap. 490 s.43** permits loans to non-members only
with by-laws provision *and* a general-meeting resolution; and **Cap. 490 s.19**
gives one member one vote irrespective of shares — so any share-weighted
governance borrowed from company law would be invalid here.

**And a ceiling nobody had priced.** A society accepting repayable member money
crosses into deposit-taking territory. Our group sits at **~KES 60,000 against a
KES 10,000,000 core-capital floor** — 167× below. That is not an obstacle to the
pilot; it *is* an obstacle to the per-tenant SaaS story, and it should shape
which groups D1 is aimed at.

---

## D4 — Full-time build

**Decided:** continuous working time on this until the milestone is met.

**Why:** Gate 1 (data safety) is partly blocked on treasurer backfill, and Gate
3 (the ledger) is a large, well-understood build. Both suit sustained attention.

**Reverses if:** the pace becomes unsustainable or the treasurer's backfill
slips far enough that holding effort is wasteful — in which case the sensible
move is to prioritise Gate 2 (security) and pause the ledger.

---

## D5 — The pilot stays self-hosted; no Firebase Blaze billing

**Decided:** Firestore remains the pilot's database. Scheduled jobs run as
`node-cron` inside the existing Next.js server on the VPS. Authentication is
server-verified PIN with signed/opaque sessions. No Blaze.

**Why:** the immediate milestone is sound books on *one* group. Blaze would buy
Cloud Functions, Cloud Scheduler and phone OTP — none of which is needed for
that. The jobs have a better home anyway: the server already exists, already
runs under PM2, and already has `firebase-admin` available.

**Reverses if:** we need SMS OTP for member onboarding (Blaze), or managed
scheduled jobs become a reliability burden as instances scale past one. Both are
plausible at Phase 2 and neither is urgent now.

---

## D6 — Firestore-vs-Postgres is deferred to group #2

**Decided:** do not migrate the data layer now. Revisit when a second tenant is
real, and settle it with actual numbers rather than architecture diagrams.

**Why:** a rewrite of ~5,700 lines of data access is unjustifiable for a
one-group milestone. The honest counter-argument — that Firestore cannot answer
analytical queries natively, and a ledger plus insights engine wants exactly
those — is real and is precisely why it should be decided with a second tenant
in view. Sequencing it here would mean paying twice: once for the rewrite, once
again when the analytics requirements sharpen.

**Reverses if:** group #2 arrives with analytical or batch requirements that
materialised metrics cannot serve economically.

---

## D7 — One generic instrument engine, all four modelled, enabled per group

**Decided:** the product engine treats deposit, project, share and bond as the
same primitives from day one. Each group enables the instruments its committee
has approved.

**Why:** it delivers "all of them" without building four products, and — the
actual reason — it means the schema never has to change again. "Add bonds later"
otherwise implies the data model was wrong from the start, and the bond accrual
machinery (who held it on the coupon date) is exactly the kind of change that
corrupts a live ledger.

**Reverses if:** it proves to have over-generalised the schema, making the common
case (a fixed-term deposit) harder to build than it should be. Mitigation: build
deposit first *as the reference implementation* of the generic model, so any
over-generalisation surfaces immediately rather than later.

**Out of scope for this run** regardless — the engine is designed here, built
after the ledger is sound.

---

## D8 — The milestone is sound books on one group

**Decided:** this run ends at Phase 0 + Phase 1. Multi-tenancy, payments,
instruments and insights are all designed for and none are built.

**Why:** every later phase assumes correct books and real authority. Skipping
straight to instruments or tenancy would multiply whatever is wrong with the
current foundation — a product engine on shaky books is worse than no product
engine, because it looks finished.

**Reverses if:** the group is presented with a real, time-limited opportunity
that cannot wait for the ledger. That is a legitimate reason to reorder — but it
should be an explicit decision, not a drift.

---

## D9 — Contributions are deposits, and the app must keep calling them that

**Decided:** the app says *contributions*. It does not say shares, subscriptions
or savings. The exit-request flow is a **refund of a repayable deposit**, and
that is what it is modelled as, in the ledger and in the UI.

**Why:** `RESEARCH-BRIEF.md` Block 1 asked whether pooling member money to buy
one asset creates a collective investment scheme. The regulatory research came
back with a cleaner and more uncomfortable answer (`KENYA-REGULATORY.md` §2):
**contribution and share are two different legal instruments, and Cap. 490's own
definitions draw the line.**

A **deposit** (s.2) is money *"which shall be repaid, with or without interest or
premium."* Cap. 490 contains **zero occurrences of "withdraw"** and no withdrawal
mechanism for member money anywhere in the Act. A **share** (s.2) is *permanent*
equity held *as a co-owner*, carries a **one-fifth holding cap per member**
(s.15), requires a **register of shares** (s.91(2)(l)), and attracts a
**capital-proportional** dividend (s.2).

Our exit flow pays money back on request. **That makes contributions deposits —
correctly — and the current naming is right.** Calling them shares would
misdescribe the instrument to the members, to the auditor and to KRA.

**This is not a naming preference; it is the reason D7 was the right call.** The
generic instrument engine does not care whether a given instrument is
denominated in shares or deposits — that is a property of the instrument, not of
the schema. Because the engine is generic, adopting shares later is *configuring
an instrument type*, not migrating the database. Had we hard-coded
"contribution = share" in July, that migration would have been a rewrite.

**Consequences if we ever do move to shares** (Phase 3+, not before):

- a **by-law amendment registered with the Commissioner** — Cap. 490 **s.8(2)**
  makes an AGM vote necessary but **not sufficient**; registration is what makes
  it effective, and s.8(3A) lets the Commissioner cancel an amendment effected by
  misrepresentation;
- a **share register** with s.40's prima facie-evidence status;
- **s.15 allocation constraints** in the engine;
- **s.46**: no dividend without a balance sheet and audited accounts, with the
  rate **approved by the AGM**;
- **Cap. 490 s.45**: investment outside the permitted list needs a **general
  meeting resolution**;
- and **forfeiture of the s.19A tax route** if the co-operative stops sitting
  between the platform and the members.

**🚩 And the path is narrower than it looks.** The **Co-operative Societies
Rules and the model by-laws are not published** — Kenya Law's only subsidiary
legislation under Cap. 490 is a 2003 officer-ethics code
(`KENYA-REGULATORY.md` §1). So there is no template to start from: **the route
is the group's own existing registered by-laws**, obtained from the
Commissioner. Get a copy now, while it is a phone call, not in Phase 3 when it
is a dependency with lead time.

**Reverses if:** the group registers a by-law amendment making contributions
share capital, and that amendment is registered with the Commissioner. Until
then, "contribution" is the accurate word and the app should keep using it —
including in anything the auditor reads.

---

## Still open

- 🚩 **CMA questions Q1 and Q2 — the highest-value open items, and now the
  *only* major research gap.** No agent reached the CMA; `cma.or.ke` was
  returning 502 throughout. (1) Is a bond offered to the members of a single
  registered society a **public offer**? (2) Does pooling members' money to buy
  one asset create a **collective investment scheme**? **These gate D3, D7 and
  the bond and share instrument types.** Everything else that touches them —
  s.19A, LN 95/2010 reg. 15, Cap. 490 s.43 and s.19, the deposit-taking
  thresholds — points the same favourable way, but **none of it is securities
  law.** Book counsel on these two (`KENYA-REGULATORY.md` §7).
- **ODPC registration** — KSh 4,000, and it resolves whether Third Schedule item 8
  ("provision of financial services") forces registration regardless of size.
  **Pay it and email `compliance@odpc.go.ke`; the cost-benefit is not close.**
- **Budget tolerance per member per month** — low priority while there is no SMS
  or payment rail in play; decide before Phase 4.
- **Whether the pilot's constitution logic generalises** — e.g. whether a
  different cooperative's constitution fits `Settings`, or needs a rules engine.
  Answerable with the first external group.
- **VAT treatment of a platform subscription** — **now answered** at 16% VAT,
  plus a possible **5% WHT above KSh 24,000/month**, plus the risk that a fee
  charged on a member's credit balance is itself "interest" under s.2. Price the
  subscription with all three in mind (`LICENSING-AND-TAX.md` §3).
- **Withholding on foreign software vendors** — **assume 20%** with no treaty
  relief assumed; no DTA text was retrievable. The Firebase dependency is exactly
  this shape; worth checking before scale.
- **The 5% digital-marketplace WHT** (FA2025) — whether it reaches a
  member-capital subscription platform is **the agent's reading, not a KRA
  position.** Get written confirmation before Phase 4; the cost of being wrong is
  5% of gross turnover.
- **Co-operative model by-laws and the Co-operative Societies Rules** — 🚩
  **confirmed not published.** Kenya Law's only subsidiary legislation under
  Cap. 490 is a 2003 officer-ethics code (LN 172/173 of 2003). So the
  registration forms (s.6), the fees (s.91(2)(r)), the annual returns
  (s.91(2)(q)) and the **reserve-fund percentage that s.47(2) delegates to
  them** are all unobtainable from any source reachable from here. **The route
  to a by-law amendment in D9 starts from the group's own registered by-laws,
  held by the Commissioner — worth requesting now, not in Phase 3.**
- **Officer code of conduct** — LN 172 of 2003 (Public Officer Ethics Act) binds
  office-bearers. It says nothing about accounting, but it means the app's
  officer roles sit on statutory duties, not only constitutional ones. Worth
  surfacing in officer onboarding.