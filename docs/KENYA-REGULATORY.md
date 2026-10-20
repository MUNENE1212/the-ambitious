# Kenya Regulatory Findings — co-operatives, deposits, payments, data

> **Provenance.** Six research agents worked the licensing half of
> `RESEARCH-BRIEF.md` Block 1, on 20 Oct 2026. All six read primary sources —
> Kenya Law (NCLR), CBK directories and gazetted regulations, ODPC guidance —
> downloaded and text-extracted, not recalled. Tax findings are in a separate
> document, **`LICENSING-AND-TAX.md`**.
>
> **Still second-hand.** I have not independently verified any section number.
> Where an agent flagged its own limits, those flags are kept.
>
> **One methodological caveat that colours everything below:** `WebSearch`
> returned empty results for *every* query across multiple agents, including
> deliberate nonsense controls. Coverage of official primary sources is strong;
> coverage of news, commentary and secondary sources is essentially nil. Several
> agents were also blocked by rate limits or unreachable government domains.
> **Absence of evidence in these documents is weaker than it looks.**

---

## 0. Bottom line

**The pilot group's legal position is sound and, at 13 members, comfortably
below every threshold that matters.** But two findings change the product, and
one changes the roadmap:

1. **A member's monthly contribution is legally a *deposit*, not a share.**
   Calling it a share misdescribes it, and the difference is not cosmetic —
   shares are permanent equity with a one-fifth holding cap and a
   capital-proportional dividend; deposits are repayable. **This bears directly
   on the "investment shares" half of the platform's vision.**
2. **The automated fine sweep is regulated under the Data Protection Act
   s.35** — a right not to be subject to solely-automated decisions — with a
   written reconsideration route the app does not currently provide.
3. **The CMA questions (public offer; collective investment scheme) remain
   unanswered.** No agent reached CMA. `cma.or.ke` was returning 502 throughout.
   **Q2 is still the highest-value open question and still needs a lawyer.**

---

## 1. Co-operative law — Cap. 490

**The governing statute is the Co-operative Societies Act, Cap. 490** (1997, as
amended principally by **Act No. 2 of 2004**). Kenya Law's full index of ~500
instruments contains **no** Co-operative Societies Act 2024 or 2025 — a brief
asserting one is mistaken. Act No. 1 of 2024 is the County Governments
Additional Allocations Act.

- **Registration functionary:** the **Commissioner for Co-operative Development**
  (s.3), reporting to the Cabinet Secretary for Co-operative Development. There
  is no separate "Registrar of Co-operatives" title.
- **Minimum membership: ten persons** (s.5(a), s.6(1)(a)). *Our 13 clears it.*
- **Minimum capital: the Act sets no figure.** s.5(c) was **deleted by Act No. 2
  of 2004, s.4** — the statutory floor was removed in 2004. Any current figure
  comes from subsidiary rules or practice (**unverified**).
- **By-laws** are binding on every member once registered (s.13) and must
  incorporate all **seven co-operative principles** (s.4).

### 🚩 The procedural point that catches people out

> **An AGM vote alone does not change the by-laws. Cap. 490 s.8(2):** *"No
> amendment of the by-laws… shall be valid until the amendment has been
> **registered** under this Act, for which purpose a copy of the amendment shall
> be forwarded to the Commissioner."*

**Registration with the Commissioner is what makes it effective.** s.8(3A) even
allows the Commissioner to **cancel** an amendment effected by misrepresentation.
And s.2 defines a **special resolution** as two-thirds of members present and
voting, with **≥15 days' written notice** (s.27(4)).

> **This is on the roadmap.** Any move to shares, to investing beyond the s.45
> list, or to non-member subscriptions is a **by-law amendment requiring
> Commissioner registration** — weeks, not an afternoon. Design it in from the
> start rather than discovering it at the AGM.

### The statutory duties our app should eventually serve

| Duty | Provision |
|---|---|
| **Accounts per IAS**, true and fair | s.25(1) |
| **Audit at least once per financial year**; auditor appointed **at the AGM** from the Commissioner's approved list | s.25(3)–(4) |
| Audit must be **IFRS**: balance sheet, income & expenditure, **cash flow statement**, authenticated by **≥3 committee members including the chairman** | s.25(6) |
| 🚩 **The auditor may not present accounts at the AGM unless previously submitted to the Commissioner** | **s.25(7)** |
| Submit accounts within **four months** of period end | s.25(8) |
| **Annual return** to the Commissioner with a certified copy of audited accounts | s.25(10) |
| **AGM within four months** of financial year end | s.27(2) |
| Committee of **5–9** members; chair and vice-chair elected from within | s.28(1)–(2) |
| **Reserve fund** where surplus is derivable; percentage **delegated to rules/by-laws**, not in the Act | s.47(1)–(2) |
| Reserve fund **indivisible** — no member claims a specific share of it | s.47(4) |
| **No dividend/bonus/distribution** without a balance sheet and audited account; **rate approved by the AGM** | s.46(2)–(3) |
| 🚩 **Investment of funds restricted** to a closed list (POSB, authorised securities, another co-op's shares, a licensed bank, statutory-body/company stock) **or any other manner approved by resolution at a general meeting** | **s.45** |
| Loans to non-members need by-laws provision **and** a GM resolution | s.43 |
| **One member, one vote, irrespective of shares held** | **s.19** |
| Fines: **no fine until written notice and an opportunity to show cause**; civil debt; **cap KES 20,000** | **s.32** |
| **Officer code of conduct** — national ethics code binding office-bearers | **LN 172 of 2003** |

### Officers are bound by a statutory ethics code

**Legal Notice 172 of 2003 — the Co-operative Societies Code of Conduct and
Ethics** (Gazette Vol. CV No. 106, 31 Oct 2003, commenced same day, revised by
LN 221 of 2023). Made under the **Public Officer Ethics Act**, and administered
with **LN 173 of 2003** (Ethics Commission for Co-operative Societies
procedures). LN 173 designates the **Senior Deputy Commissioner for Co-operative
Development** as the administration officer and secretary — which incidentally
confirms that senior co-operative administration sits **under the Commissioner
(s.3)**, and that there is no separate "Registrar of Co-operatives" office.

> The code's full text contains **no** reference to bye-laws, dividends, bonuses,
> contributions or reserves — it is purely an officer-conduct instrument. So it
> does not constrain the accounting design. But it *does* mean the app's
> office-bearer roles (chairperson, treasurer, secretary…) sit on top of
> **statutory** duties, not only constitutional ones. Worth surfacing to members
> in officer onboarding rather than leaving as folklore.

### 🚩 The Co-operative Societies Rules and the model bye-laws do not exist publicly

This is the addendum's most consequential finding, and it is a negative.

**Kenya Law's only subsidiary legislation under Cap. 490 is the pair of *ethics*
instruments above.** The `uncommenced` tab was fully enumerated (one page, six
instruments, no co-operative item), and the `recent` tab for Oct 2025 – Oct 2026
was fully enumerated with no co-operative hits.

> **The Co-operative Societies Rules are not on Kenya Law.** Neither are the model
> bye-laws. Those Rules are what Cap. 490 s.91 requires to prescribe the
> **registration forms** (s.6), the **fees** (s.91(2)(r)), the **annual
> returns** (s.91(2)(q)) and — the operationally important one — the
> **reserve-fund percentage that s.47(2) delegates to them.**
>
> **So: the reserve percentage our by-laws must specify cannot be verified from
> any source reachable from here.** Nor can the form a by-law amendment must take.

**What this actually means for the roadmap.** D9's by-law amendment path does
not start from a model document — it starts from **the group's own registered
bye-laws**, which the Commissioner already holds. Anyone taking this to the
Commissioner should take a copy of those, and the practical sources are the
Gazette and the Commissioner's office directly; `cooperative.go.ke` **does not
resolve in DNS**.

Two of these land on us directly:

- **s.45 constrains the investment engine.** A co-op may only invest in a closed
  list *unless a general meeting approves the specific manner*. "Flexible
  investment including bonds and projects" needs either a by-law amendment or a
  standing GM resolution authorising the categories. **This is a governance
  prerequisite, not an engineering one** — and it should be designed for.
- **s.19 is one-member-one-vote regardless of shares.** Any share-weighted
  governance model borrowed from company law would be invalid here. Our
  majority-vote exit flow is consistent; keep it that way.

### s.32 and the automatic fine — a genuine open question

s.32 governs **fines for breach of the by-laws**, and requires written notice of
intention, the reason, and an opportunity to show cause before any fine is
imposed.

> Our late-payment fine is a **contribution penalty**, arguably a different
> instrument from a by-law fine — but the distinction is not established, and
> the app currently imposes it with no notice at all. Combined with the DPA
> finding in §4, **the remedy is the same either way and is cheap: notice,
> explanation, and an appeal route.** See §4.

---

## 2. 🚩 Contribution is not share — the finding that bears on the vision

Cap. 490's own definitions draw the line, and they draw it firmly:

| | **Deposit** (s.2) | **Share / capital** (s.2) |
|---|---|---|
| Definition | *"a sum of money paid on terms under which it **shall be repaid**, with or without interest or premium, and either on demand or at a time or circumstances agreed"* | *"the amount represented by a member's portion in the **equity** of a society **as a co-owner**"*; capital is the *"**permanent** members equity"* |
| Repayable? | Yes — that is the definition | **No.** Cap. 490 contains **zero occurrences of "withdraw"** and no withdrawal mechanism for member money anywhere in the Act |
| Dividend basis | n/a | **Pro-rata to share capital** (s.2 "dividend") |
| Holding cap | none | **No member above one-fifth of issued paid-up capital** (s.15) |
| Register | n/a | **Register of shares** required (s.91(2)(l)); **prima facie evidence** (s.40) |

**A recurring monthly contribution the member expects back is a recoverable
obligation, not capital.** The Act reinforces it: s.44 deems a hire-purchase
deposit *"to be a loan"*; s.91(2)(c) separates *"the payments to be made"* from
*"the interest to be acquired"*; s.32's set-off runs against **produce
delivered**, not share capital.

> **This is load-bearing for the platform's name.** The vision is "financial
> contribution **and investment shares**" — and the research says those are two
> different legal instruments with different mechanics, different tax treatment,
> different accounting, and different governance.
>
> **Our exit-request flow pays refunds to members. That makes contributions
> deposits — correctly — and the app's current naming is right.** Moving to
> shares is not a relabelling; it is a change of legal structure requiring a
> by-law amendment registered with the Commissioner (s.8(2)), a share register
> (s.91(2)(l)), a cap-aware allocation engine (s.15), and — per
> `LICENSING-AND-TAX.md` — it forfeits the s.19A route unless the platform keeps
> the co-operative squarely in the middle.
>
> **The generic instrument engine in D7 is unaffected** — it models offers,
> subscriptions and positions generically. Whether a given instrument is
> denominated in shares or deposits is a property of the instrument, which is
> exactly why D7's "one engine, all instruments" was the right call.

---

## 3. Deposit-taking — SSRA, not CBK, and we are nowhere near

### The premise correction

**The Central Bank of Kenya does not license SACCO societies.** Deposit-taking
SACCO societies are regulated by the **Sacco Societies Regulatory Authority
(SSRA)**, established by the **Sacco Societies Act (Cap. 490B)**. Evidence: CBK's
licensing index carries **no SACCO category** at all; its legislation index
contains **no** SACCO regulations; and the Banking Act's list of competent
authorities names **SSRA as a separate entry alongside CBK**. The only CBK role
is representational — the Governor sits on the SSRA Board (Cap. 490B s.6(1)(d)).

*(Note: `cbk.go.ke` no longer resolves. The live domain is `centralbank.go.ke`.)*

### The thresholds

**Deposit-taking — LN 95 of 2010, reg. 9:** core capital **≥ KES 10,000,000**,
**and** ≥10% of total assets, **and** institutional capital ≥8% of total assets,
**and** core capital ≥8% of total deposits.

**Non-deposit-taking — LN 82 of 2020, reg. 11:** **KES 5,000,000**, ≥8% of total
assets (≥50% of core capital as retained earnings/disclosed reserves), ≥5% of
total non-withdrawable deposits. Authorisation, revocable, renewable annually.
Must include **"Regulated Non-withdrawable deposit-taking SACCO"** in its name.

Fees (LN 95/2010): application **KES 3,000**, licence **KES 50,000** head office
+ **KES 20,000** per branch, Deposit Guarantee Fund premium **KES 50,000 or
0.05% of total savings and deposits, whichever is higher**.

**Deposit protection** (not a cap): the Deposit Guarantee Fund compensates
**KES 100,000 per member**, net of liabilities — and **covers deposits but not
shares** (Cap. 490B s.59(1)).

### Where we stand

**Our group holds roughly KES 60,000 in total funds.** The KES 10,000,000 floor
is **167×** that. The application and licence fees alone (KES 53,000) are within
an order of magnitude of the group's entire balance sheet.

> **The pilot group is not, and cannot practically become, a deposit-taking
> society.** LN 82/2020 reg. 4's trigger — non-withdrawable member deposits of
> **KES 100,000,000** — is 1,600× the group's current funds.

**Two consequences worth stating plainly:**

- **Q3 ("does a society-controlled M-Pesa paybill make it deposit-taking?") is
  answered on scale, not on principle.** At 13 members and KES 60,000 the answer
  is no. It is not a licence question. But it *is* a question that scales — the
  moment a group's repayable member money passes a threshold, the analysis
  changes, and the platform must not pretend otherwise. **This is a real ceiling
  on D1's per-tenant model, and worth knowing before group #2.**
- **LN 95/2010 reg. 15 already prohibits a deposit-taking society from
  transacting business with non-members** — independent regulatory support for
  D3 (members only), alongside the tax support in `LICENSING-AND-TAX.md` §1 and
  Cap. 490 s.43.

---

## 4. 🚩 Data protection — s.35 lands directly on the fine sweep

**Data Protection Act No. 24 of 2019, Cap. 411C**; General Regulations 2021.

### The right

**s.35(1):** *"Every data subject has a right **not** to be subject to a decision
based solely on automated processing, including profiling, which produces legal
effects concerning or significantly affects the data subject."*

Exceptions (s.35(2)): necessary for entering into or performing a **contract**;
authorised by law with safeguards; or based on consent.

**s.35(3)–(4) go beyond GDPR** and are the operative bite:

- **(3)(a)** the controller must **notify the data subject in writing** that a
  solely-automated decision was taken;
- **(3)(b)** the subject may request **reconsideration**, or a **new decision not
  based solely on automated processing**;
- **(4)** the controller must **consider, comply, and respond in writing with
  the steps taken and the outcome**.

**Regulation 22** adds: explain the logic, the significance and envisaged
consequences; prevent errors; eliminate discriminatory effects and bias; and
**ensure the subject can obtain human intervention and express their point of
view**.

### This is our code

`fines.ts` flips contributions to `Late` with a constitutional fine, client-side,
on any member's visit. `use-auto-dues` generates dues the same way. **Both set
payment status and apply a monetary penalty with no human in the loop at decision
time.** That is automated individual decision-making.

**The current posture is mostly defensible:** the fine is deterministic and
constitution-derived, so **s.35(2)(a) contract necessity** is a good basis — and
better than consent, because it survives a member objecting.

**What is missing is s.35(3)/(4) and Reg 22:** no written notice of the
automated decision, no explanation of the logic, no reconsideration route.

> **Three cheap fixes close it, and they are worth more than any compliance
> theatre:**
> 1. **A written notice when a fine is applied**, naming the rule and the amount.
> 2. **A one-page plain-language explanation of the fine logic**, shown at
>    signup and linked from the notice.
> 3. **A named officer who reviews challenges**, with the outcome recorded in
>    writing. This is also the natural home for the s.32 "show cause" process.
>
> **Build these into Gate 2**, not Gate 3 — they are small, and they are the
> difference between a defensible position and an indefensible one.

### 🚩 Where we must not go

**An arrears-risk score on a named member would be materially riskier.** It is
profiling; it ranks people against each other; it hits **Reg 49(1)(a)** (DPIA
trigger — and Reg 49 triggers are *not size-qualified*) and Reg 22's anti-bias
requirement.

> **This is a design constraint on the insight engine, and it is firm.** §4.12's
> hierarchical estimation is sound precisely because it estimates *aggregate*
> quantities — how much will be collected, when will the cash land — and never
> ranks individuals. **Keep it that way. The boundary is: predict the group, never
> score the member.**

### Registration — cheap, and possibly mandatory

**s.18(1):** *"no person shall act as a data controller or data processor unless
registered."* A co-operative **is** a controller — s.2's definition covers
*"other body"*, with no size carve-out.

Exemption (Registration Regulations 2021, LN 265, reg. 13(2)) requires **both**
turnover **and** headcount below KSh 5m / 10 employees. **But reg. 13(4)'s Third
Schedule lists purposes requiring registration *notwithstanding* the
exemption — and item 8 is *"Provision of financial services."***

> **The pivotal open question.** Read literally, a group running a savings scheme
> and collecting contributions falls inside — making registration **mandatory
> regardless of size.** The counter-argument is real: we are not a licensed
> financial-services provider, are not CBK- or SSRA-regulated, and take no public
> deposits. But the Schedule exists to capture exactly lenders and credit unions,
> and its drafting is visibly loose elsewhere.
>
> **Cost: KSh 4,000** (KSh 2,000 renewal every 2 years). **The cost-benefit is
> not close — pay it and ask them.** `compliance@odpc.go.ke`.

### The rest, in brief

- **Financial data is NOT sensitive data** under the Act. Contributions and
  arrears are ordinary personal data under ss.25/30. *(Useful: the classification
  boundary is real and our data sits on the ordinary side of it.)*
- **s.45(a)** permits processing by a not-for-profit body where it relates
  **solely to members** and data is not disclosed outside without consent — a
  savings co-op plausibly fits, and **the proviso cuts against piping member data
  to an external LLM API without consent.**
- **Cross-border:** s.25(h) with ss.48–50. ODPC's Sept 2026 cross-border guidance
  states cloud processing outside Kenya **is** a cross-border transfer, and
  requires that onward recipients be barred from using data for *"analytics,
  commercial exploitation, profiling, product improvement, or marketing."*
  **Google's standard terms reserve rights to use customer data for service
  improvement and to add sub-processors on notice — that sits in tension with
  the guidance.** Worth one review of the Firebase project's terms.
- **Reg 41(2) imposes a documentation duty** — date, time, recipient,
  justification, description — for every transfer. **You must be able to hand the
  Commissioner a record of what you sent, to whom and why.** (This is a cheap
  log table and an argument for keeping LLM calls off member records entirely —
  which §4.12's design already does.)
- **Breach notification (s.43):** processor → controller **48 hours**;
  controller → ODPC **72 hours**; plus written notice to affected subjects.
  Notifiable breaches under Reg 37 are narrower than "any breach" — but
  **credentials and account data qualify, and a member-list dump plainly does.**
  **For a group with no incident-response capacity, plan to 24 hours.**
- **Processor agreements:** s.42(2)(b) + Reg 24 require a **written contract**
  with Firebase and any LLM provider, specifying subject matter, duration,
  nature, data types, subject categories, instructions, confidentiality,
  security, deletion/return on termination, and audit rights. **Reg 25: a
  processor must not engage a third party without prior authorisation and
  remains liable for them.**
- **DPIA (s.31) is required *before* high-risk processing and must be submitted
  60 days before it** (s.31(5)). Reg 49 triggers include ADM with significant
  effect **(a)** and **"innovative use of new technological solutions" (i)** —
  both plausibly live for an insight engine. **Discovering this post-launch
  leaves you retroactively non-compliant.**
- **Annual returns: none found.** No periodic reporting duty on controllers.
- **A DPO is optional**; the registration form permits leaving it blank.
- **No data localisation requirement** — s.50 covers civil registration,
  elections, public finance, critical systems, education and primary health care.
  **No Kenyan data centre required.**
- **s.26(e) gives a 14-day erasure right** for false or misleading data;
  **s.25(g) storage limitation** is the cleaner hook. **Our constitution's
  no-deletion rule is right for the financial audit trail and wrong for exited
  members' PIN hashes.**

### Kenya's AI Bill — not law, not our problem

**Kenya Artificial Intelligence Bill, 2026 — Senate Bill No. 4 of 2026** (Sen.
Karen Nyamu, published 19 Feb 2026, first reading 2 Apr 2026). As of 20 Oct
2026: before the Senate ICT Committee, **not enacted**. **No Kenya Artificial
Intelligence Act exists.**

If enacted it would create an Office of the AI Commissioner, a four-tier risk
classification where **high risk includes "finance"**, pre-deployment impact
assessments, and penalties to KSh 5,000,000. **But it imposes no general
registration duty — only high-risk systems are registered.** Revisit if AI is
ever deployed in a credit-scoring context.

**ODPC has issued no AI or ADM guidance.** The binding rules are in Regulation 22.

---

## 5. Payments — D2 confirmed, and one viable integrator

### We are a merchant, not a payment service provider

The in-force law is the **National Payment System Act, Cap. 491A (No. 39 of
2011)** with the 2014 Regulations. *(There is no "NPS Act 2021" — that premise
was wrong.)* A **Draft National Payment System Policy and Bill, 2026** was
published by CBK and National Treasury in Sept 2026; comment closed 9 Oct 2026.
**Not law.**

A society selling services and taking payment through a licensed gateway is a
**merchant acquirer's merchant** — the Bill's own definition puts "merchant
acquirer" at the PSP layer. **No licence requirement on us.**

Third Schedule capital (for reference, not ours): payment initiation KSh 5m;
merchant acquirer / e-wallet provider KSh 50m; payment gateway operator KSh 10m;
e-money issuer KSh 250m.

**Note:** a co-operative society is **separately an AML reporting institution**
under POCAMLA in its own right, regardless of gateway. **Adopting an aggregator
does not change our AML/KYC obligations** — it moves PSP-level merchant
due diligence to the processor.

### The options, checked against the CBK register

| Provider | Status |
|---|---|
| **Paystack Kenya** | ✅ CBK-licensed 8 Nov 2022, in the Aug 2026 directory. **M-Pesa STK push, 1.5%, T+2 settlement to bank or M-Pesa wallet.** M-Pesa max KES 150,000 per transaction. Also Airtel Money and PesaLink. |
| **PostaPay** (Postal Corporation of Kenya) | ✅ Verified live and multi-wallet. Issues genuine **Tills and Paybills**, interoperable with **M-Pesa, Airtel Money, T-Kash, Vooma and banks** via PesaLink. Standing orders, auto-settlement, 600+ offices. **Merchant collection rate not published.** |
| **Wakandi, Data Integrated, Tanda** | ✅ All CBK-licensed, **all three licensed or marketed specifically for SACCO / cooperative group collection.** Data Integrated self-reports 80+ SACCOs. Pricing quote-based. |
| **Cellulant, Pesapal, Kashia, Loop Payco** | ✅ Licensed |
| **Flutterwave** | ⚠️ **Not in either CBK directory** despite competitive published pricing. Material red flag. |
| **Kuda** | ❌ **Dead in Kenya** — Nigerian bank, Naira pricing |
| **Airtel Money Kenya** | ✅ CBK-licensed for merchant processing, consumer tariff published (Airtel→Airtel P2P free). **But no merchant price is published anywhere** — not because the research missed it, but because Airtel discloses none. Published ceilings: **KES 250,000 per transaction, KES 500,000 daily, KES 500,000 account balance.** A MerchantPay API demonstrably exists (`openapi.airtel.africa/merchantpay/`, auth-gated). **You would be negotiating from zero**, where Paystack publishes 1.5% and PostaPay will at least give a number on request |
| **Interswitch, Kenswitch, IPSL** | Licensed as **switching/clearing**, not collection |
| **Equity, KCB, NCBA** | Unverified — bot walls / dead DNS |
| **Co-op Bank** | ✅ Only bank with **Airtel Money priced in a published tariff** (tiered KSh 0–50 on wallet transfers) |
| **Family Bank** | ✅ Self-serve Merchant & Agent portal; publishes **no** Airtel/paybill/collection pricing |
| **Postbank / Patacash** | ❌ **Disbursement only** — explicitly a Safaricom partnership for transfers *out*. **PostaPay (Postal Corporation) and Postbank are separate entities** — do not conflate. |
| **KEPSS/RTGS** | CBK-operated, banks-only. **A society cannot realistically self-serve onto it.** |
| **PesaLink/IPP** (IPSL, a KBA subsidiary) | ✅ Live, 80+ participants **including SACCOs**, up to KES 999,999, real-time, settles through KEPSS. **This is the interbank rail that serves co-operatives.** |

> **D2 is confirmed from this direction too.** Every viable rail settles money
> **into the society's own bank account**. A structure in which the platform
> pooled funds would have to become a licensed PSP — KSh 50m for merchant
> acquirer — or accept an unlicensed counterparty. **The architecture that is
> right for trust, tax and the group's own law is also the only one that is
> affordable.**

### 🚩 No published tariff tells you what collection costs

The single most useful thing to know before pricing anything here, and easy to
miss in a wall of tariff tables:

| Tariff | What it actually is |
|---|---|
| **Airtel's 20-band table** | **Customer-side.** What a person pays to send or withdraw. Says nothing about what an *organisation* pays to collect |
| **PostaPay's 2026 PDF** | Explicitly the **transfer and withdrawal** tariff. Not merchant collection |
| **Family Bank's Jan 2026 guide** | No collection lines at all — M-Pesa float and agency deposits only |
| **Co-op Bank's KES 0–50 Airtel figures** | Bank→wallet transfers and airtime; and even those are only *partially* verified given the scrambled PDF columns |

**Exactly one collection rate is quotable today:**

| Provider | Collection rate | Source |
|---|---|---|
| **Paystack** | **1.5% on M-Pesa** | **Published** |
| PostaPay | Unknown | Must request |
| Airtel merchant | Unknown | **No merchant page exists at all** |
| Wakandi / Data Integrated / Tanda | Unknown | Quote-based |

> **Practical consequence: quote Paystack's 1.5% as the anchor and treat every
> other provider as a conversation rather than a number.** The marketplace looks
> far more price-competitive than it is, because almost nothing publishes a
> merchant rate. Do not build a pricing model on the customer tariffs.

### Two domain corrections worth keeping

`cbk.go.ke`, `cba.go.ke`, `bank.go.ke` **do not resolve** — the live domain is
**`centralbank.go.ke`**. And `airtel.ke` has a **broken DNS delegation** at the
authoritative-nameserver level (reproduces across Cloudflare, Google and AliDNS);
Airtel Kenya's real site is **`airtelkenya.com`**, as CBK's own directory
confirms. Similarly `cooperative.go.ke` is **NXDOMAIN** and `treasury.go.ke` has
a **broken TLS chain**. **Verify a government domain resolves before trusting
anything you read about it.**

---

## 6. Market data — the "no free source" follow-up is now closed

**`CLAUDE.md` records that NSE stock pricing has no confirmed free source. That
was half true, and the answer is better than expected.**

### ✅ Treasury bills: a free, official, machine-readable CSV

**`https://www.centralbank.go.ke/uploads/interest_rates/555932033_Central Bank Rates_with Heads.csv`**

Verified HTTP 200, `text/csv`, 29,079 bytes, last modified 1 Oct 2026. Free, no
login, no API key, no paywall. Schema: `YEAR,MONTH,Repo,Reverse Repo,Interbank
Rate,91-Day Tbill,182-days Tbill,364-days Tbill,Cash Reserve Requirement,Central
Bank Rate`. Monthly, 1991→2026. *(The year appears only on January rows —
forward-fill on parse.)*

**Limitation: the last row is August 2026.** It lags one to two months and
cannot give a current yield.

Companion, same pattern — and the right comparison for a savings group's
opportunity cost:
**`.../2089616416_Commercial banks Weighted Average Rates.csv`** (`Deposit,
Savings, Lending, Overdraft`). August 2026: **savings 3.54%, deposit 6.91%,
lending 14.34%.**

**Current yields (auction value-dated 19/10/2026):** 91-day **8.7500%**, 182-day
**8.8600%**, 364-day **9.0383%**. CBR held at 8.75% on 7 Oct 2026.

> **So the group's money is currently beating T-bills at every tenor.** That is
> a real, current, citable insight — and it is exactly the kind of statement the
> insight engine should be able to make. It is also the kind of statement that
> must be derived from fetched data, never from a model's memory.

**Auction-level (weekly) yields are PDF-only** — 2,322 result PDFs, zero CSV/XLSX/
JSON/XML. They parse cleanly with `pdftotext -layout`, and the site's **open,
unauthenticated WordPress REST API** (`/wp-json/wp/v2/pages/991`) returns the
whole manifest as JSON in one request.

> 🚩 **Do not build against `/bills-bonds/treasury-bills-average-rates/`.** It
> looks exactly like what you want, is titled "Treasury Bills Average Rates", and
> has been **dead since 7 March 2016**. It will appear in search results.

**Recommendation:** fetch the monthly CSV once a month, ingest rows newer than
the last. No PDF parsing, no Blaze. Parse auction PDFs only if the current week
genuinely matters.

### ❌ FX: do not scrape

The daily rates are **image-based PDFs that `pdftotext` cannot parse**, behind an
undocumented `admin-ajax.php` endpoint that ignores every paging parameter and
has **no stability guarantee**. There is **no API** — all 69 REST routes were
enumerated; zero match fx/forex/rate/currency.

🚩 **`/uploads/fx_rates/historical_data.csv` is a trap.** HTTP 200, `text/csv`,
2MB, 37,877 rows, looks perfectly healthy — **and its last valid date is 3 Jan
2024**, plus one corrupt row dated 2038. It has been abandoned for ~2.5 years.
A scraper built on it would serve two-year-old data with no error.

> **Recommendation: a manually-entered rate** in the existing `config/settings`
> pattern, exactly like the constitution figures. For a KES-denominated savings
> group this is sufficient, and it is the same design already proven in this
> codebase.

### Negative results worth not repeating

DBnomics has **no CBK provider**. World Bank WDI has no Kenya T-bill indicator.
The Kenya open-data portal (`opendata.go.ke`, an ArcGIS Hub) has **zero**
T-bill series. `data.go.ke` and `open.go.ke` do not resolve. GitHub: nothing.

---

## 7. Still open — the questions nobody answered

### 🚩 Q2 — the collective investment scheme question. **Still unanswered.**

**No agent reached the CMA.** `cma.or.ke` returned 502 throughout. Neither
question was addressed by any of the six:

1. **Is a bond offered to the members of a single registered society a public
   offer?** (Q1)
2. **Does a co-operative pooling members' money to buy one asset create a
   collective investment scheme?** (Q2 — **still the highest-value question in
   the brief**)

> **These gate D3, D7 and the instrument engine's bond and share types.** The
> indirect evidence is all *favourable* — member-only (Cap. 490 s.43, LN 95/2010
> reg. 15), the co-operative sitting in the middle (s.19A), one-member-one-vote
> (s.19) — but **none of it is securities law**, and the CMA is the regulator
> that matters.
>
> **Book counsel on Q1 and Q2. Nothing else in this document can substitute.**
> `cma.or.ke` being down is a reason to hire someone, not a reason to infer.

### Other open items

| # | Question | Status |
|---|---|---|
| 3 | Deposit-taking threshold detail | Answered **on scale** (§3) — but the *definitional* question of when a growing group crosses over is unresolved |
| 4 | Society registration for share subscriptions | **Partly** — s.2/s.15/s.91(2)(l) make the mechanics clear; the *procedure* needs the Rules, which could not be retrieved |
| 5 | **ODPC Third Schedule item 8** — "provision of financial services" | **Unresolved. KSh 4,000 to ask.** |
| 6 | Co-operative Societies **Rules** — prescribed forms, fees, annual returns, **the reserve-fund percentage s.47(2) delegates to them** | 🚩 **Confirmed absent from Kenya Law.** The only subsidiary legislation under Cap. 490 is the 2003 ethics pair. Obtain from the Commissioner or the Gazette |
| 7 | **Model / standard by-laws** | 🚩 **Confirmed absent from Kenya Law.** Start from the group's own registered by-laws instead |
| 8 | **Annual SSRA supervision fee** | Power exists (Cap. 490B s.25(4)); no figure in LN 95/2010 or LN 82/2020; SSRA website unreachable on every candidate domain |
| 9 | Co-operative Societies (Amendment) Act or Bill 2024/2025 | ✅ **Verified absent.** Both the `uncommenced` and `recent` tabs were fully enumerated. **Cap. 490 (1997) as amended by Act No. 2 of 2004 is the law.** |
| 10 | AML/CFT duties split between society and platform | **Partly** — society is a reporting institution under POCAMLA regardless of gateway; the detailed obligations were not researched |
| 11 | Whether the **Cap. 490 (Dec 2023)** version reflects the 2019 transfer of SACCO supervision to SSRA | **Unverified** — the reconciling instrument could not be retrieved |

**A pattern worth noting:** several government domains simply do not resolve —
`cooperative.go.ke`, `cbk.go.ke`, `data.go.ke`, `airtel.ke`, and every candidate
SSRA domain. Several regulators' sites are behind bot walls. ** Kenyan
regulatory research from outside the country is genuinely difficult, and that is
itself an argument for the counsel engagement rather than against it.**

---

## 8. What changes, concretely

| Change | Where it lands |
|---|---|
| **Write notice, a plain-language explanation of the fine logic, and a named appeals officer into the fine flow** | **Gate 2** — DPA s.35(3)/(4) + Reg 22. Cheap; do it. |
| **Never build a member-level risk score.** Aggregate forecasting only. | **Gate 3 / Phase 4** — Reg 49(1)(a) DPIA trigger; Reg 22 anti-bias |
| **One-page DPIA before any LLM feature** | **Phase 4** — Reg 49(1)(i); and **60 days' lead time**, so it must precede, not follow |
| **Keep LLM calls off member records.** Predict the group, not the member. | **Phase 4** — Reg 41(2) transfer log, s.45(a), cross-border guidance |
| **Register with ODPC (KSh 4,000)** and ask about Third Schedule item 8 | **Now** — costs nothing, resolves an open question |
| **Publish a written privacy notice at signup** (s.29, mandatory at any size) | **Gate 2** — with the Firebase cross-border disclosure |
| **Write DPAs with Firebase and any LLM provider** (s.42(2)(b), Reg 24) | **Gate 2** — and review Google's service-improvement and sub-processor terms against the Sept 2026 guidance |
| **Build a breach plan to 24 hours** (not 72) | **Gate 2** — no IR capacity; credentials and member lists are notifiable |
| **Stop retaining PIN hashes for exited members** | **Gate 2** — s.25(g) storage limitation, independent of the no-deletion rule for financial records |
| **Model s.45 constraints into the instrument engine** — investment outside the permitted list needs a GM resolution | **Phase 3** — governance prerequisite, not engineering |
| **Keep contributions named as contributions.** Shares are a different legal instrument. | **Naming** — see `DECISIONS.md` D9 |
| **T-bill benchmark from the CBK monthly CSV** | **Phase 4** — closes the `CLAUDE.md` follow-up; the group currently beats T-bills at every tenor |
| **FX as a manually-entered setting**, not a scraper | **Phase 4** — the obvious CSV is a two-year-dead trap |
| **If collection is ever built: Paystack primary, PostaPay as the multi-wallet fallback** | **Phase 4** — every rail settles into the society's own account, which is D2 working as designed |