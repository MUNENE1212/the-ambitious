# Licensing & Tax — Research Findings

> **Provenance — read this first.**
>
> A first relay delivered **Addendum E only**, which was thin and partly wrong. A
> second agent returned a **complete ten-question report, every section quoted
> from a primary legal text it downloaded and text-extracted** (Income Tax Act
> consolidated to 1 July 2026; Excise Duty Act to 1 July 2025; Finance Acts
> 2020–2026; the VAT First/Second Schedule listing of July 2026).
>
> **This document has been rewritten from the second report.** The first report's
> §4 corrections are retained only where the second confirmed them. Where the two
> disagreed, the second wins — it had the statute in front of it and the first
> did not.
>
> **Still second-hand.** I have not independently verified any section number
> against the source myself. Treat it as a well-evidenced brief, not a tax
> opinion, and do not build on §19A without a Kenyan tax practitioner's view.
>
> **Separate document:** the *licensing* half of `RESEARCH-BRIEF.md` Block 1 —
> co-operative registration, deposit-taking, payments, DPA/ODPC — came back
> separately and is in **`KENYA-REGULATORY.md`**. It is no longer open.

- **Primary source:** KRA's NCLR consolidation of the Income Tax Act **as at
  1 July 2026**, 144pp, `https://www.kra.go.ke/images/publications/Income-Tax-Act-2026.pdf`.
  The document header warns: *"outstanding amendments that have not yet been
  applied: Act No. 19 of 2026"* — **the Finance Act 2026 is not fully
  incorporated**, so anything it did is read from the amending Act, not the
  consolidation.

---

## 1. The headline: s.19A favours keeping the co-operative in the middle

**Income Tax Act s.19A(2)** — a designated co-operative society's chargeable
income is its total income *"deducting therefrom an amount equal to the aggregate
of bonuses and dividends declared for that year and distributed by it to its
members in money or an order to pay money; but the deduction shall in no case
exceed the total income of the society."*

Reinforced by **s.10(3)(b)** — *"a bonus or interest paid by a designated
cooperative society… **shall be deemed to be a dividend**"* — and by the s.2
"qualifying dividend" definition, which **expressly excludes** s.19A dividends,
so the 5% qualifying-dividend regime does not attach to them.

This is **independent corroboration of D2 and D3**, reached from tax law rather
than from securities regulation. Three regimes — securities, AML, tax — now point
the same way, which is a far stronger basis than any one alone.

### 🚨 But the s.19A deduction is not the end of the chain — and this is the part the first report missed

**The member's receipt is a chargeable dividend, and 15% withholding attaches to
it.** The chain runs all the way:

1. The society deducts the distribution at **society level** (s.19A(2)).
2. **s.10(3)(b) deems it a dividend in the member's hands.**
3. A dividend is **chargeable** under s.3(2)(b) — not exempt income.
4. Therefore **s.35(4)** does not rescue it: that exemption covers only payments
   that are *exempt income*, and this is not.
5. **s.35(3)(a)** therefore bites, at **Third Schedule Head B para 5(a) = 15%.**
6. The society is the **withholding agent under s.35**, and must remit **within
   five working days** (s.35(5)).

> **This is a product requirement, not a footnote.** The moment the group pays
> interest or a bonus on members' money, the platform must compute 15% WHT, show
> it as a deduction on the member's statement, net the payout, and carry a
> remittance liability with a deadline. **None of that exists today** — the exit
> flow pays gross refunds.
>
> The good news: **a refund of a repayable deposit is not a distribution**, so
> the exit-request flow itself is not WHT-able. The obligation starts at
> *distributions*, which is exactly where the investment engine begins. **This is
> a Gate 3 requirement for the ledger, not a Gate 1 one.**

**Budget 15% of every member return as the society's remittance liability,
netted at payout.** Assume this is right until a practitioner says otherwise.

### The watch item, unchanged

**s.19A(1)(b)** excludes any society the Commissioner considers *"a body corporate
carrying on business **for its own profit**,"* having regard to **non-member
transactions** and member numbers. The advantage is **conditional on D3**, not
merely compatible with it. Widening D3 to guests or public subscriptions risks
the tax treatment of every member's return.

This is now corroborated from the *securities* side too: **LN 95/2010 reg. 15
prohibits a deposit-taking society from transacting business with non-members**,
and Cap. 490 s.43 permits loans to non-members only if the by-laws provide for it
**and a general-meeting resolution is passed**.

---

## 2. Withholding tax — the operative rates

Rates live in the **Third Schedule Head B**, not in s.35. This matters whenever
someone says "s.35 says 15%" when they mean the Schedule.

| Payment to a **resident** | Provision | Rate |
|---|---|---|
| Dividend (incl. s.19A member returns) | s.35(3)(a), HB para 5(a) | **15%** |
| Interest — ordinary | s.35(3)(b), HB para 5(b)(ii) | **15%** |
| Interest — bearer instrument (not ≥2yr Govt) | HB para 5(b)(i) | **25%** |
| Interest — Govt bearer bond ≥10 years | HB para 5(b)(iii) | **10%** |
| Qualifying dividend — **NOT available to co-op members** | HB para 5(e) | 5%, final |
| Qualifying interest (a narrower concept) | HB para 5(h) | 10/20/15%, final |
| Insurance commission | s.35(3)(d), HB para 5(c) | 5% brokers / 10% others |
| Management/professional fee **≥ KSh 24,000/month** | s.35(3)(f), HB para 5(f) | **5%** / 3% contractual |

**s.35(3)(b) excludes** interest to a **Fourth Schedule** financial institution
resident in Kenya — and the Fourth Schedule lists *"a co-operative society
registered under the Co-operative Societies Act (Cap. 490)."* So interest *earned
by* the society can avoid WHT. Interest *distributed by* the society cannot —
see §1.

**s.35(4) is the trap.** It exempts only payments that are **exempt income**. A
dividend is chargeable, so residence of payer and payee is irrelevant and
Kenyan-source withholding applies to residents.

### Two statutory definitions that bind the product

- **s.2 "interest"** — *"interest payable in any manner in respect of a loan,
  deposit, debt, claim or other right or obligation, and includes any premium or
  discount by way of interest and **any commitment or service fee paid in respect
  of a loan or credit** or an Islamic finance return."*

  > **A subscription or underwriting fee charged on member credit is itself
  > "interest."** Any platform fee modelled as a charge on a member's balance is
  > inside this definition, not outside it.

- **s.2 "dividend"** — distribution by a **company** to its **shareholders** in
  respect of equity. Note the words: *a society's member bonus is not a dividend
  under this definition — it is one **by s.10(3)(b)**.* That deeming provision is
  doing all the work, and it is easy to miss.

---

## 3. VAT and SEPT

**Standard rate 16%.** The July 2026 KRA TIMS listing of First/Second Schedule
items (30pp) was grepped for "management fee" and "advisory": **zero hits.**

> **Therefore: management, administration, advisory, platform-subscription and
> custody-arranging fees are ordinary taxable supplies at 16%.** Neither exempt
> nor zero-rated. Exemption applies only where the supply is itself a listed
> financial service.

**Significant Economic Presence Tax (SEPT)** — the successor to DST, and the
correct current position:

- **s.12E**, inserted by **FA2020 s.4**, renamed by **TLAA2024 s.5**,
  re-rated by **TLAA2024 s.16(b)(iii)**. *(The first report's claim that DST was
  "never in" FA2023/24/25 was right about the Acts and wrong about the origin —
  FA2020 is where it was inserted.)*
- Applies **only to a non-resident person** whose Kenyan-source service income
  accrues through a business carried over the internet (s.12E(1)–(2)).
- **Rate:** Third Schedule para 12 = **30%** of deemed taxable profit, where
  deemed profit is **10% of gross turnover** (s.12E(4)) — an effective **3% of
  gross turnover**, up from the original 1.5%.

> **A domestic-only Kenyan platform is out of scope.** s.12E(1)'s non-resident
> requirement is not displaced by the user-location test in s.12E(2).

**But if we ever pay a non-resident vendor**, s.12E(3)(b) carves out s.10 income —
which is where management and professional fees sit — so it is carved out of SEPT
while sitting squarely inside **s.35(1)(a) WHT at 20%** (Third Schedule para 3(a);
EAC consultancy 15%, SEZ 5%). **SEPT and s.35 WHT are largely mutually exclusive
here. Assume 20% on a foreign software or cloud vendor and rely only on treaty
relief separately confirmed.** No DTA text was retrieved.

### The platform's own fees are a triple liability

If the platform charges a group a fee, it may attract, depending on shape:

1. **VAT at 16%** (Q6);
2. **WHT at 5% / 3%** if aggregate management-or-professional fees reach
   **KSh 24,000/month** (s.35(3)(f)) — and **FA2026 s.2(b) broadened "management
   or professional fee" to include interchange and merchant service fees**, so
   card-related charges can pull this in; and
3. possibly the **"interest"** definition in s.2 if the fee is charged on a
   member's credit balance.

**Price the subscription with all three in mind.** This is a D1 pricing question,
not a current-run one.

---

## 4. Excise — the mobile-money figures were wrong twice

**There is no levy on mobile money. It is excise duty, at 15%.**

**Excise Duty Act (Cap. 472), First Schedule Part II ¶3** — *"Excise duty on fees
charged for money transfer services by cellular phone service providers, or
payment service providers licensed under the National Payment System Act, shall
be **fifteen percent**"* (as amended by **Act No. 10 of 2018 s.32(b)(iii)** and
**Act No. 4 of 2023 s.47(b)(iii)**).

**Two corrections:** the widely quoted **12%** was the pre-FA2023 rate, replaced in
2023; and the charge was **never converted from excise duty to a levy** — TLAA2024
s.27, FA2025 and FA2026 were each grepped in full with zero hits.

**Verified negative: there is no WHT on mobile money transactions.** No Third
Schedule item exists and s.35 has no such limb. The 15% attaches to the **service
provider's fee**. If members pay M-Pesa fees directly to Safaricom, that is
Safaricom's liability. Adjacent: ¶4 sets **20%** on other fees charged by
financial institutions.

---

## 5. Other verified negatives and 2023–2026 changes

- **No Financial Crimes Levy exists.** FA2020 through FA2026 were each grepped in
  full for "financial crime", "levy", "anti-money", "AML" — nothing.
- **FA2025 repealed ITA s.12D (minimum tax)** (s.6) and **s.12F (digital asset
  tax)** (s.8), deleted Third Schedule para 13 (turnover tax), and inserted
  **HB para 5(n) (0.5% on payments by a public entity for goods to it)** and
  **para 5(o) (5% on income deemed to accrue from a digital marketplace)**.
- **FA2024/FA2025 inserted a 5% WHT on digital-content monetisation** (para 5(m)).
- **FA2026** repealed ss.54B, 72B, 72C, 131; added Fourth Schedule Microfinance Act
  licensees; deleted s.35(1)(u) and HB para 5(p); expanded "management or
  professional fee" to card interchange/merchant fees.
- **There is no statutory "specified services" classification.** Checked s.35(1)
  exhaustively, items (a)–(w). That is treaty/DTA language, not statutory.

### 🚩 The live risk for a digital investment platform

**s.10(3)(ba)** defines *"digital marketplace"* as an online platform which
**enables users to sell to or provide services to other users.** The 5% WHT in
HB para 5(o) is the item most likely to be argued to reach a subscription
platform.

> **The agent's reading: a pure member-capital subscription platform does not
> enable users to sell to other users, so this should not attach.** It says
> plainly that this is *its reading, not a KRA position*, and that the drafting
> is loose elsewhere in the Schedule.

**Get written confirmation before Phase 4.** The cost of being wrong is 5% of
gross turnover.

### A methodological point worth keeping

🚩 **KRA's website contradicts the Act.** KRA's published table states **10%**
withholding on dividends to a resident company. **That figure appears nowhere in
the Income Tax Act**; HB para 5(a) says **15%**, with no amending provision.

> **Treat regulator web pages as unreliable where primary statutory text
> exists.** Had we sourced that from KRA's site rather than the consolidation,
> the number would have been wrong. This is not a criticism of KRA — it is a
> reason to always check the schedule.

---

## 6. UNVERIFIED — do not rely on these

1. **Resident company / resident society dividend rate.** Third Schedule para 2 as
   printed in the NCLR revision is internally inconsistent and the text layer is
   corrupted. Obtain the gazetted Third Schedule from the Kenya Gazette.
2. **Treaty/DTA withholding rates.** No DTA text retrieved. Assume 20% for
   non-resident professional fees.
3. **Whether s.19A survives for a society with substantial non-member dealings.**
   s.19A(1)(b) hands the Commissioner the judgment; no published ruling located.
4. **Whether the 5% digital-marketplace WHT reaches a member-capital subscription
   platform.** The agent's reading is no. No KRA guidance located.
5. **FA2026 amendments are not in the 1 July 2026 consolidation** — anything
   attributed to Act No. 19 of 2026 is read from the amending Act.

---

## 7. What this changes, concretely

| Change | Where it lands |
|---|---|
| **Compute 15% WHT on member distributions**, net it at payout, carry a remittance liability with a 5-working-day deadline | **Gate 3** — the ledger's posting engine. Not Gate 1; the exit flow pays deposit refunds, not distributions. |
| **A fee charged on a member's credit balance is "interest"** (s.2) | D1 pricing; also means the platform's take is itself taxable |
| **Platform subscription = 16% VAT + possible 5% WHT above KSh24k/month** | D1 pricing, before any price is published |
| **Foreign vendor = assume 20% WHT**, no treaty relief assumed | Worth checking the Firebase dependency before scale |
| **D3 is load-bearing, not merely prudent** — s.19A(1)(b) and LN 95/2010 reg. 15 both turn on member-only | `DECISIONS.md` D3 |
| **5% digital-marketplace WHT is an open exposure** | Counsel question, before Phase 4 |