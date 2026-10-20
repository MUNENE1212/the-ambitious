# Research Brief

> **STATUS — mostly answered. Read the synthesis, not this brief.**
>
> Seven research agents worked this brief on 20 Oct 2026. The findings are in
> **`KENYA-REGULATORY.md`**, **`LICENSING-AND-TAX.md`** and
> **`INSIGHTS-RESEARCH.md`**, with the verbatim reports in `research/` and their
> sources and unverified lists preserved.
>
> | Question | Answered | Where |
> |---|---|---|
> | Q1 — is a bond to members a public offer? | ❌ **No** — no agent reached the CMA | — |
> | Q2 — does pooling for one asset create a CIS? | ❌ **No** — **still the highest-value open question** | `KENYA-REGULATORY.md` §7 |
> | Q3 — when does collecting become deposit-taking? | ✅ Answered **on scale**: SSRA not CBK, KES 10m floor, we are 167× below | §3 |
> | Q4 — what must a society be registered as? | ✅ Cap. 490 s.2, s.15, s.91(2)(l) — and the contribution/share distinction | §2 |
> | Q5–Q7 — DPA/ODPC obligations | ✅ Yes, and s.35 lands on the live fine sweep | §4 |
> | Q8 — AML/CFT duties | ⚠️ Partly — the society is a reporting institution regardless of gateway | §5 |
> | Q9–Q11 — payment rails and aggregators | ✅ Paystack; PostaPay; society is a merchant, not a PSP | §5 |
> | Q12–Q15 — insight engine, T-bills, FX | ✅ T-bill CSV found; **FX is a trap — do not scrape** | §6 |
> | Tax (raised independently, not in this brief) | ✅ Full report; **15% WHT on member distributions** | `LICENSING-AND-TAX.md` |
>
> **The brief is kept verbatim below** because the reasoning behind each question
> is still useful, and because it records what we *did not* think to ask. Two
> things it failed to anticipate turned out to be the most consequential
> findings: that a contribution is legally a **deposit** and not a share
> (`DECISIONS.md` D9), and that the **automatic fine sweep** is regulated under
> DPA s.35 (`PLATFORM-PLAN.md` §5.1).

---

# BLOCK 1 — Must have before the first real money moves (D2, D3)

These determine whether the "collects, never custodies" model survives contact
with reality. Everything else in this brief can wait weeks.

### 1. Is a bond issued to members of a single registered society a public offer?

- **Look at:** Kenya's Capital Markets Act and subsidiary legislation;
  Collective Investment Schemes Regulations; CMA Kenya guidance on public vs
  private offers; CMA's register of licensed collective investment schemes.
- **Unblocks:** whether D3 (members-only) is a safe boundary, and whether bonds
  (D7) can ever be offered to members or only to a registered CIS.
- **The sub-question that actually matters:** where is the line between a
  cooperative investing its own pooled funds, and *issuing a security to
  members*? Our model does the first comfortably; the second may be the line.
- **If unclear:** assume bonds to members are **off the table** until counsel
  confirms. Design is unaffected — D7 has bonds modelled behind a per-group
  switch that stays off.

### 2. Does pooling members' money to buy a single asset create a collective investment scheme?

- **Look at:** the CIS definition and its exclusions in the Capital Markets Act /
  CIS Regulations; whether "a scheme whose property is... contributed by
  persons for the purpose of investing" captures a single cooperative buying one
  building, and whether the CIS exemptions (small schemes, private schemes) apply.
- **Unblocks:** whether the group can raise for a project *itself* — the core of
  the product engine — or whether every project offer is a regulated CIS.
- **If unclear:** this is the **single highest-value question in the brief.** It
  determines whether a group raising for its own venture is a bookkeeping act
  or a licensing event. Book counsel specifically for this one.

### 3. Does collecting member money into a society-controlled M-Pesa paybill make it deposit-taking?

- **Look at:** SACCO Societies Act No. 8 of 2019 and CBK's rules/guidelines;
  the deposit ceiling and minimum capital for deposit-taking societies; CBK's
  definition of a deposit; any CBK guidance on use of mobile money by
  cooperatives.
- **Unblocks:** D2. It is the load-bearing assumption of the payments design.
- **Also answer:** can a M-Pesa paybill/settlement account be held **in the name
  of a registered cooperative society** at all, and does Safaricom require the
  society's registration certificate and current officials to open one?
- **If unclear:** per-group paybills are the fallback and they work without
  Daraja — the treasurer confirms manually as today. No dead end.

### 4. How must a cooperative be registered to subscribe for shares with its members?

- **Look at:** Registrar of Co-operatives (Department of Cooperatives);
  societies by shares vs by guarantee; the Societies By-Laws rules; what
  share capital means for a society vs a company.
- **Unblocks:** whether our "share" instrument maps to a real legal instrument in
  a society, or whether in practice it is a members' account — which changes how
  D7's share register is described in the product and in the constitution.
- **Note:** our constitution already implies a share transfer (payout waits until
  the vacated share is resold). Confirming whether that is legally a transfer of
  a society share, or of a member's interest, matters for the exit flow.

---

# BLOCK 2 — Data protection and automation (D2, §4.12)

### 5. What are our data protection obligations?

- **Look at:** Data Protection Act 2019; ODPC registration requirements and
  deadlines; lawful basis for processing member financial data and ID documents;
  breach notification duties and timelines; **cross-border transfer rules** and
  whether data on a foreign VPS or Firebase's infrastructure is treated as
  leaving Kenya; any 2024–2026 amendments.
- **Unblocks:** whether we may register as a data controller now, and whether
  hosting location constrains the architecture.
- **Answer specifically:** must *every* data controller register with ODPC, or
  only controllers above a size threshold? What is the penalty for not registering?

### 6. What do Kenyan rules require around automated decision-making and profiling individuals?

- **Look at:** DPA 2019 provisions on automated decision-making; any ODPC
  guidance, advisory or code of practice (2024–2026); Kenyan national AI policy
  or strategy, if any.
- **Unblocks:** §4.12's arrears early-warning feature. We have designed it as an
  officer-only, non-punitive attention list — this question asks whether that is
  sufficient, or whether individual risk scoring triggers something more.
- **If unclear:** the feature is *already* designed to the conservative side
  (never punitive, never peer-visible, provenance on everything), so we are
  defensible by design while we check.

### 7. How do our retention rules conflict with a no-deletion audit trail?

- **Look at:** AML record-keeping retention periods; DPA storage limitation and
  erasure rights; the constitution's no-deletion rule.
- **Unblocks:** the data-subject-rights section of the platform. A member asking
  us to erase their data, against a legal duty to retain financial records and
  an internal audit rule, needs a written answer before we build the export
  feature.

---

# BLOCK 3 — Compliance duties of the platform itself

### 8. What AML/CFT duties attach to us?

- **Look at:** Proceeds of Crime and Anti-Money Laundering Act; AML Regulations
  2023; whether a cooperative society has reporting duties in its own right; KYC
  expectations on members; record retention; suspicious transaction reporting to
  the Financial Intelligence Centre.
- **Unblocks:** whether facilitating subscriptions makes the platform a reporting
  entity, and what member identification we must do at onboarding.
- **Important distinction to resolve:** duties of the *cooperative society* vs
  duties of the *software platform serving it*. We may have substantially fewer
  — but only if we are genuinely a tool and not an arranger. This interacts with
  D2.

---

# BLOCK 4 — Money rails (D2)

Only needed before payments, which is after the ledger. Do this block when the
treasurer's books are sound.

### 9. Daraja: what does it actually take?

- **Look at:** Safaricom Daraja product pages and current pricing (2026);
  business onboarding requirements; STK Push vs C2B vs Till vs Paybill;
  settlement account rules; realistic approval lead times; callback/webhook
  security (IP allowlisting, encryption).
- **Answer:** per-transaction and monthly pricing in KES; how long onboarding
  takes in practice; whether a settlement account can be in a society's name.

### 10. What are the alternatives?

- **Look at:** Paystack, Flutterwave, Kuda, Cellulant — Kenya pricing in KES,
  M-Pesa STK/collection support, settlement timelines, whether they support
  per-tenant collection codes. Plus Kenya's interoperable payment rails status
  under the National Payment System Act 2021 — which are live in 2026, and
  whether account-to-account or mobile-money-to-bank transfers are available.
- **Unblocks:** whether we are hostage to Safaricom's onboarding timeline.

### 11. What does Firebase cost, and what actually needs Blaze?

- **Look at:** current pay-as-you-go pricing for Cloud Functions, Cloud
  Scheduler, Firestore reads/writes; the Spark-plan limits that break on
  billing; the hard spend limit and what happens when it is hit.
- **Context:** the pilot deliberately stays on Spark with jobs on our own VPS
  (D5), so this is only needed to know the exit cost if we later want managed
  scheduling or phone auth.
- **Also give us:** VPS cost at three scales — 1 group / 100 groups / 1,000
  groups — including domain, TLS, and off-site backups.

---

# BLOCK 5 — Insight engine (§4.12)

Lowest urgency of the blocks. The reconciliation work is worth starting as soon
as the ledger exists and does not need any of this.

### 12. What is the cheapest viable model tier?

- **Look at:** current per-million-token pricing for major providers, including
  cached input; and what open-weights models are competitive for short
  structured extraction.
- **Answer separately for:** (a) parsing an M-Pesa SMS into fields, (b)
  summarising a few hundred words, (c) NL → structured query.
- **Then:** can a small model run inside our Node server on the VPS
  (llama.cpp / node-llama-cpp / ONNX / transformers.js), and in the browser on a
  low-end Android (WebGPU or WASM)? Model names, quantised sizes, RAM, realistic
  latency. What is the smallest model that reliably does structured extraction?

### 13. Is there a machine-readable Kenyan risk-free rate?

- **Look at:** CBK and Kenya National Treasury for 91/182/364-day T-bill average
  yields — is there a JSON, CSV or downloadable series, and how often does it
  update? Confirm CBK's daily forex rates too.
- **Unblocks:** §4.12's bond pricing engine, which anchors suggested coupons to
  the Kenyan risk-free rate. Without it, pricing suggestions fall back to
  CBK's published rate quoted manually by the treasurer.

### 14. What do the statements actually look like?

- **Look at:** Safaricom C2B/STK confirmation SMS message structures; existing
  open-source Kenyan M-Pesa SMS parsers worth reusing. And bank statement exports
  available to Kenyan cooperatives — which banks, and CSV/XLSX/PDF.
- **Unblocks:** the reconciliation engine, which is the highest-value insight
  feature and the one most likely to be plain code rather than AI.

### 15. What device should we assume?

- **Look at:** Android hardware typical of the Kenyan market in 2026 — RAM and
  storage ceilings for the bottom half of users; WebGPU support share in Android
  Chrome vs Safari/iOS.
- **Unblocks:** whether any in-browser inference is realistic at all, or whether
  everything must run server-side.

---

# What is safe regardless of the answers

So you know what is not at risk while you research:

- **The ledger, the auth rework, the rules, the jobs, the backfill, the
  characterisation tests** — all proceeding, no dependency on this brief.
- **D2 has a working fallback.** Per-group paybills with manual treasurer
  confirmation are what the pilot already does. If question 3 or 9 comes back
  unfavourable, the payments phase degrades gracefully rather than blocking.
- **D3 has a working fallback.** If question 1 or 2 comes back restrictive, the
  instrument engine has a per-group switch that stays off. Nothing is wasted.
- **D6 has a working fallback.** Firestore serves the pilot indefinitely.

The only genuinely blocking item is **question 2**, and only at the point where
a group raises for a real project. That is months of runway away, and counsel
has lead time, so it should be booked now rather than answered by research.