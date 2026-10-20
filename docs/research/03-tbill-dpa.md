Memory directory isn't writable in this environment, so I'll skip that. Here's the report.

---

# Kenya T-Bill / FX / Data-Law Research — verified 20 October 2026

**Methodology caveat, up front:** the `WebSearch` tool returned **empty results for every query** in this environment (6 attempts, all silent). All findings below come from **direct fetches** of official sites via curl/WebFetch, plus two parallel research agents. That means coverage of official primary sources is strong, but I had **no working news/secondary-search fallback**, which is why a few items are flagged UNVERIFIED. Everything with a URL next to it was actually retrieved.

---

# PART A — Kenyan risk-free benchmark

## A.0 The headline determination

**A machine-readable Kenyan T-bill source PARTIALLY EXISTS.** The precise answer:

| What you want | Does it exist machine-readably? |
|---|---|
| **Monthly average** 91/182/364-day yields | **YES — a real, free, official CSV**,1991→2026 |
| **Auction-level** (weekly) yields | **NO — PDF only.** 2,322 individual PDFs. You must parse PDFs. |
| An official API | **NO.** None exists. |

So the honest one-line answer to your question is: **the monthly series is a CSV, but the actual auction yields you want are PDFs — and the good news is the PDFs are highly uniform and parse cleanly with `pdftotext -layout`.** You can build a reliable scraper, just not an API client.

## A.1 Domain — your three guesses were all wrong

| Domain | DNS (tested 2026-10-20) |
|---|---|
| `cba.go.ke` | **NXDOMAIN** |
| `cbk.go.ke` | **NXDOMAIN** (incl. `www.`) |
| `bank.go.ke` | **NXDOMAIN** |
| **`centralbank.go.ke`** | **RESOLVES** ✅ |

Official site: **https://www.centralbank.go.ke/** — actively maintained (serving auction PDFs dated 19-10-2026).

## A.2 ✅ The one genuinely machine-readable source

**`https://www.centralbank.go.ke/uploads/interest_rates/555932033_Central Bank Rates_with Heads.csv`**

Verified: HTTP 200, `content-type: text/csv`, 29,079 bytes, `Last-Modified: Thu, 01 Oct 2026 10:13:28 GMT`. Free, no login, no paywall, no API key.

Schema (row 2 is the header):
```
YEAR,MONTH,Repo,Reverse Repo,Interbank Rate,91-Day Tbill,182-days Tbill,364-days Tbill,Cash Reserve Requirement,Central Bank Rate
```
1991→2026, monthly. Note the year appears only on January rows; subsequent months leave it blank — **forward-fill on parse**. There is a header note `* Provisional` and a `Source: Central Bank of Kenya` footer to skip.

**Critical limitation — read this before building on it:** as of today the last data row is **August 2026**. It does **not** contain September or October 2026. It lags roughly **one to two months**. It cannot give you a current yield.

Companion CSV (same page, same pattern) — relevant to a savings group's opportunity-cost math:
**`https://www.centralbank.go.ke/uploads/interest_rates/2089616416_Commercial banks Weighted Average Rates.csv`** (12,525 bytes, `Last-Modified: 24 Sep 2026`) — `YEAR,MONTH,Deposit,Savings,Lending,Overdraft`. Aug 2026: **savings 3.54%, deposit 6.91%, lending 14.34%**. That's the real comparison for member savings vs T-bills at ~8.75–9.04%.

Index page for both: **https://www.centralbank.go.ke/statistics/interest-rates/**

## A.3 ❌ Auction-level yields: PDF only

**https://www.centralbank.go.ke/bills-bonds/treasury-bills/**

Every weekly auction result is a **PDF**. I enumerated the page programmatically: **2,322 result PDFs, and literally zero `.csv` / `.xlsx` / `.json` / `.xml` files** (checked by regex over all 2,327 hrefs). One file is literally named `...DATED 07-09-2026.xlsx.pdf` — an Excel file that was converted to PDF before upload. Nothing raw survives.

Coverage: filenames span **2014–2026** (2026: 126 files). Tenors are archived in three parallel directories — `/uploads/91_day_…`, `/uploads/182_day_…`, `/uploads/364_day_…` — but each PDF contains **all three tenors**, so you only need one directory (they duplicate).

**The one real enabler: the site runs an open, unauthenticated WordPress REST API.** Verified `"authentication":[]` on `https://www.centralbank.go.ke/wp-json/` — reads need no credentials. So you can get the full manifest as JSON in one request instead of scraping HTML:

```
https://www.centralbank.go.ke/wp-json/wp/v2/pages/991 ← page ID 991, 1.88 MB of HTML
```

That response contains all 2,322 PDF URLs, already sorted, with machine-parseable filenames:
```
/uploads/91_day_historical_treasury_bill_results/1647758237_RESULTS 2704-091 2678-182 2633-364 DATED 19-10-2026.pdf
```
The `NNNN-091 NNNN-182 NNNN-364 DATED dd-mm-yyyy` convention is consistent across all of 2025–2026, so you can resolve any auction's PDF URL **without fetching the page** once you know the issue numbers — and issue numbers increment by1 per week per tenor. Page `modified: 2026-10-15`.

Each PDF gives you, in a fixed table layout: amount offered, bids received, performance rate, amount accepted, **bid-to-cover ratio**, **market weighted average interest rate**, **weighted average interest rate of accepted bids**, price per Ksh 100, and a **comparative table vs the previous auction with variance**. `pdftotext -layout` parses these cleanly — no OCR needed.

Cadence is **weekly** (42 auctions in 2026 YTD, 4–5 per month, consistent Mon–Tue value dates).

## A.4 Current yields — October 2026 (VERIFIED)

From the latest auction, **value-dated 19/10/2026** (PDF `Last-Modified: 15 Oct 2026`, signed Robert Aloo, Director Financial Markets, 15 October 2026):

| Tenor | **Weighted avg of accepted bids** | Market weighted avg | Prior auction | Variance |
|---|---|---|---|---|
| **91-day** | **8.7500%** | 8.7538% | 8.7615% | +0.0115 |
| **182-day** | **8.8600%** | 8.8652% | 8.8744% | +0.0144 |
| **364-day** | **9.0383%** | 9.0387% | 9.0352% | +0.0031 |

Bid-to-cover: 1.45 / 1.05 / 1.01 (total 1.31). Next auction (issues 2705/091, 2679/182, 2634/364) bids close **22 Oct 2026**, so **the 19-Oct values are the current ones as of today**.

Corroborating: CBR held at **8.75%** on 7 Oct 2026 (https://www.centralbank.go.ke/2026/10/07/mpc-retains-the-cbr-at-8-75-percent-3/). The curve is upward-sloping and sits just above the policy rate — a normal, well-behaved shape.

Two corroborating series, **do not confuse them**:
- **CSV monthly averages (through Aug 2026):** 91d 8.78 · 182d 8.95 · 364d 9.03
- **Single latest auction (19-Oct-2026):** 91d 8.750 · 182d 8.860 · 364d 9.038

The homepage ticker (`91-Day T-Bill 8.750%`, dated 19/10/2026) is **hardcoded HTML in the WordPress page, not a live feed** — I checked the source. Don't treat it as an endpoint.

## A.5 Traps — two dead ends worth knowing about

1. **`/bills-bonds/treasury-bills-average-rates/`** — this page looks exactly like what you want ("Treasury Bills Average Rates", with an `Issue Date / Issue Number / Tenor / Maturity Date / Average Interest Rate` table). **It is dead.** Last modified **2016-10-04**; its table stops at issue2150, **7 March 2016**. If you found this in a search result, it's a trap.
2. **`/releases/statistical-bulletin/`** — semiannual PDF, latest **December 2025**. Authoritative and deep, but PDF-only and 6-month lag. https://www.centralbank.go.ke/wp-content/uploads/2024/02/Statistical%20Bulletin%20-%20December%202025.pdf

## A.6 National Treasury & mirrors — negative results

- **treasury.go.ke** resolves and works, but has a **broken TLS chain** (must use `curl -k`); WebFetch refuses it. Debt documents live at the **Public Debt Management Office**, https://pdmo.treasury.go.ke/ — `/domestic-debt`, `/total-debt`, `/macroeconomic-data`, `/monthly-bulletins`, `/annual-public-debt-management-reports`. **Verdict: not usable.** `/domestic-debt` has outstanding T-bill *amounts* only; `/macroeconomic-data` has a "91 Day T-Bill end. %" chart with **stale values (7.0 / 7.9 / 11.5 / 16.0)**; `/monthly-bulletins` has exactly **one PDF, from 2011**.
- **Kenya Open Data portal:** `data.go.ke` and `open.go.ke` **do not resolve**. The real one is **`https://www.opendata.go.ke/`** — an ArcGIS Hub. Searched via the ArcGIS sharing API for treasury-bill yields: **total: 0 results.** Nothing there.
- **DBnomics:** no CBK provider. Searched for "CBK", "Kenya treasury bill", "Central Bank of Kenya" — **no Kenyan yield series exists.**
- **World Bank WDI:** no T-bill interest-rate indicator for Kenya.
- **GitHub:** essentially nothing (`kenya+tbill+rates` → 0 repos; one irrelevant quant-finance repo).
- **UNVERIFIED:** IMF IFS / AfDB — not tested. Given DBnomics mirrors IFS and had nothing, I rate the chance of a usable free Kenya T-bill series there as low, but I did not confirm it.

## A.7 What I'd actually build

```
Weekly Cloud Function (needs Blaze):
  1. fetch wp-json/wp/v2/pages/991  → parse 2,322 PDF URLs (one request)
  2. HEAD/GET only PDFs newer than your stored last-seen value-date
  3. pdftotext -layout → regex the "Weighted Average Interest Rate of accepted bids" row
  4. write {date, tenor, avgYield, marketAvg, bidToCover} to Firestore
```
For a small group, honestly: **monthly CSV is probably enough.** Fetch the CSV once a month, ingest rows newer than your last one, done — no PDF parsing, no Blaze. Use the auction PDFs only if you need the current week.

---

# PART B — CBK foreign exchange

## B.1 DomainSame as Part A: **https://www.centralbank.go.ke/**. `cba.go.ke` / `cbk.go.ke` / `bank.go.ke` are all NXDOMAIN.

## B.2 Where rates are published

**Daily (live):** **https://www.centralbank.go.ke/forex/** — a WordPress DataTable (`wpdatatable_id="182"`), **business days only** (the index jumps 16 → 19 Oct across the weekend).

Each row is a **PDF**. Current:
```
https://www.centralbank.go.ke/uploads/cbk_indicative_rates/1457720283_Daily%20KES%20Exchange%20Rates.pdf
```
**Format: PDF only.** Single "EXCHANGE RATE" column — commercial banks' **average**, no buy/sell spread (older archived tables had mean/buy/sell; the current daily PDF does not).

**There is an undocumented JSON index behind the table:**
```
https://www.centralbank.go.ke/wp-admin/admin-ajax.php?action=get_wdtable&table_id=182
```
Returns `{"recordsTotal":"2271", "data":[["<a href=...pdf>","19/10/2026"], ...]}`. **Caveat:** it returns only the newest ~10 rows and **ignores every paging parameter** (`iDisplayStart`, `iDisplayLength`, `start`, `length`, `sEcho` — all byte-identical responses). It's a plugin internals endpoint with **no stability guarantee**. Treat as a convenience, not a contract.

## B.3 ⚠️ A live-looking CSV that is dead — important**`https://www.centralbank.go.ke/uploads/fx_rates/historical_data.csv`** (2,082,067 bytes, `text/csv`) — HTTP 200, looks healthy, **contains 37,877 rows**. Parsed all of them: **the last valid date is 2024-01-03**, plus one corrupt row dated `2038-01-22`. It has been **abandoned for ~2.5 years**. Any scraper built on it silently serves 2024 data with no error. Same for the legacy per-year `Key-CBK-Indicative-Exchange-Rates-2003.csv … -2015.csv` files and the `cbk_indicative_rates/*_forex.csv` snapshots (2017–18).

## B.4 Is there an API? — **No.**

Exhaustively checked: `/api/`, `/developer/`, `/developers/`, `/open-data/`, `/data-portal/`, `/sitemap.xml`, `/wp-sitemap.xml` → all 404. Enumerated **all 69 routes** in `https://www.centralbank.go.ke/wp-json/` searching for fx/exchange/rate/forex/currency → **zero matches**; namespaces are only `oembed/1.0`, `aam/v1`, `aam/v2`, `wp/v2`. robots.txt is 3 lines. **No developer portal, no API keys, no documentation.** Blunt answer: **HTML/PDF only.**

## B.5 Current rates (16-Oct-2026, official PDF)

| Currency | KES per unit |
|---|---|
| **US Dollar** | **129.92** |
| Sterling Pound | 173.14 |
| Euro | 145.79 |
| Japanese Yen (100) | 82.16 |
| Swiss Franc | 157.56 |
| Canadian Dollar | 92.05 |
| Chinese Yuan | 19.44 |
| Australian Dollar | 90.57 |
| Singapore Dollar | 101.54 |
| Saudi Riyal | 34.62 |
| Hong Kong Dollar | 16.55 |
| South African Rand | 7.89 |

**Three implementation gotchas:**
1. **JPY, USD/TSH, RWF, BIF are quoted per 100 units** — divide by 100. The regional-Africa rows invert the convention entirely.
2. **Don't trust the index date.** This PDF is listed under 19/10/2026 but its content says **16-Oct-26**. Read the date inside the document.
3. **The filename hash is a random WordPress upload ID that changes every publication.** You cannot hardcode a URL.
4. **`pdftotext` FAILS on this PDF** (`Syntax Error: Missing 'endstream'`) — it's image-based. A scraper would need OCR. Strong argument against depending on it.

**Recommendation for a small group: don't scrape. Use a manually-entered rate** on an admin screen, exactly like your existing `config/settings` constitution figures. For a KES-denominated savings group this is almost certainly sufficient.

---

# PART C — Data protection, ODPC, AI

## C.1 ⚠️ Correcting a likely assumption: Kenya DOES have a GDPR Art. 22 analogue

You may believe Kenya has no automated-decision right. **It does.** Primary source:

**Data Protection Act No. 24 of 2019, Cap. 411C — https://new.kenyalaw.org/akn/ke/act/2019/24/eng@2022-12-31** (commenced 15 Nov 2019; as amended by the 24th Annual Supplement, 14 Jan 2022)

### Section 35 — Automated individual decision making (verbatim, s.35(1))

> "Every data subject has a right **not** to be subject to a decision based solely on automated processing, including profiling, which produces legal effects concerning or significantly affects the data subject."

s.35(2) carves out three exceptions: **(a)** necessary for entering into or performing a **contract** between subject and controller; **(b)** authorised by law with suitable safeguards; **(c)** based on consent.

s.35(3)–(4) are the operational bite and go **beyond** GDPR:
- (3)(a) you must **notify the data subject in writing** that a solely-automated decision was taken;
- (3)(b) the subject may then request **(i) reconsideration** of the decision, or **(ii) a new decision not based solely on automated processing**;
- (4) you must **consider, comply, and respond in writing with the steps taken and outcome**.

**Regulation 22**, General Regulations 2021, adds: inform the subject; provide **meaningful information about the logic involved**; explain **significance and envisaged consequences**; prevent errors; use appropriate statistical procedures; **eliminate discriminatory effects and bias**; and ensure the subject **can obtain human intervention and express their point of view**. Where s.31 conditions arise, a **DPIA is carried out**.

### 🎯 This lands directly on your codebase

Your `fines.ts` sweep (flips contributions to `Late` with a constitutional fine, client-side, on any member's visit) and `use-auto-dues` are **automated individual decision-making** under Reg 22 — they set payment status and apply a monetary penalty with no human in the loop at decision time.

Your current posture is actually **mostly defensible**: the fine is deterministic and constitution-derived, so **s.35(2)(a) contract necessity** is a good basis, and it also matches **s.30(1)(b)(i)** for holding contribution records generally (contract performance — cleaner than consent, and it survives a member objecting).

What's missing is s.35(3)/(4) and Reg 22: **no written notice of the automated decision, no explanation of the logic, and no reconsideration route.** Three cheap fixes — a one-page written explanation of the fine logic shown at signup, a named officer who reviews appeals, and a printed notice when a fine is applied.

An **arrears-risk score** on a *named member* would be materially riskier than the current deterministic fine: it's profiling, it ranks people against each other, and it squarely hits **Reg 49(1)(a)** (DPIA trigger) and Reg 22(2)(h)'s anti-bias requirement.

## C.2 Core principles and obligations — section map

All from the same Act.74 sections total.

| Topic | Provision |
|---|---|
| **Lawful basis** | **s.30** — closed list of 8 bases (consent; contract; legal obligation; vital interests; public interest/official authority; public authority task; **legitimate interests**; historical/statistical/research). s.30(3): breach is an **offence**. |
| **Consent conditions** | **s.32** — controller bears **burden of proof** (32(1)); withdrawable any time (32(2)). |
| **Purpose limitation** | **s.25(c)** |
| **Data minimisation** | **s.25(d)** — "adequate, relevant, limited to what is necessary" |
| **Storage limitation** | **s.25(g)**; **s.39** |
| **Cross-border** | **s.25(h)** — no transfer outside Kenya unless proof of adequate safeguards or consent |
| **Cross-border conditions** | **s.48** (safeguards / commensurate jurisdictions / 6 necessity grounds incl. compelling legitimate interests), **s.49** (sensitive data → consent + confirmed safeguards), **s.50** (localisation power — see below) |
| **Security by design** | **s.41**, incl. **41(3)** — *by default* only necessary personal data |
| **Data subject rights** | **s.26** — informed; access; **object**; **correct false/misleading**; **delete false/misleading**. Mechanics: Regs 8–13. **Access and erasure within 14 days.** |
| **Restriction pending dispute** | **s.34** — right to restrict processing pending verification (directly useful for contesting a fine) |
| **Breach notification** | **s.43** + Regs 37–38 |
| **Complaints** | **s.56**, **s.57**, appeal **s.64** |
| **Enforcement** | **s.58** enforcement notices, **s.62** penalty notices, **s.63** administrative fines, **s.73** general penalty |
| **Data controller / processor defs** | **s.2** |

Regs 27–36 elaborate the s.25 principles element-by-element, incl. **Reg 31** (purpose limitation) and **Reg 33** (data minimisation).

## C.3 Sending data to an overseas LLM API

**Act:** s.25(h) is the headline bar. **s.48–49** supply the gateways.
**Regs 2021 Part VII (40–48)** is the operative machinery:

- **Reg 40** — transfer must rest on one of: appropriate safeguards / adequacy decision / necessity / consent.
- **Reg 41** — appropriate safeguards. **Reg 41(2) imposes a documentation duty**: date & time of transfer, **name of the recipient**, justification, description of the personal data. *You must be able to hand the Commissioner a record of what you sent, to whom, and why.*
- **Reg 42** — deemed safeguards (Malabo Convention, reciprocal agreement, or binding corporate rules).
- **Reg 44** — adequacy decisions. **UNVERIFIED:** no published adequacy list found on the ODPC site.
- **Reg 45** — necessity.
- **Reg 46** — consent (explicit, informed of risks).
- **Reg 47** — **onward transfers must be barred**: you must make it a condition that the recipient does not further transfer without authorisation. Directly relevant — check where your model provider sends data, and its sub-processors.
- **Reg 48** — cross-border transfer agreement form.

**ODPC's own guidance is stricter than the statute and names Firebase explicitly.** The Sept 2026 *Guidance Notes for Cross-border Data Transfers*:
- "The processing of personal data in cloud environments with servers located outside Kenya **constitutes a cross-border data transfer**."
- Cloud is expressly contemplated under the **necessity/legitimate-interest** exception: "…when a data controller or processor opts to host personal data on cloud servers outside the country to enhance operational efficiency…"
- Onward transfers must prohibit use "for the Data Recipient's own purposes including **analytics, commercial exploitation, profiling, product improvement, or marketing**."

⚠️ **Two of Google's standard terms sit in direct tension with that last clause:** (1) Google's reservation of rights to use customer data for its own service **improvement**; (2) Google's right to add **sub-processors on notice**. The guidance requires *specific prior written authorisation* for the exact sub-processor and *full recipient liability* for all onward recipients. Worth one review of your Firebase project's terms.

## C.4 DPIA — when mandatory

**s.31**: DPIA required **prior to** processing that is likely to result in high risk. **s.31(5)**: the report **must be submitted60 days before** processing. (Note the lead time — discovering you need one post-launch leaves you retroactively non-compliant.)

**Reg 49(1)** triggers include: **(a)** automated decision-making with legal or similar significant effect including profiling/algorithmic means; **(b)** large-scale secondary-purpose use; **(d)** change in processing increasing risk; **(e)** sensitive or children's data; **(f)** combining datasets; **(g)** large-scale processing; **(i)** **innovative use or application of new technological solutions**; **(j)** processing that prevents exercise of a right.

**For you: (a) and (i) are both plausibly live and are *not* size-qualified.** Regs 50–51 cover the template (Third Schedule) and prior consultation.

## C.5 Registration — what actually binds a small cooperative

**Is a cooperative a data controller?** **Yes.** s.2: "a natural or legal person, public authority, agency **or other body** which… determines the purpose and means of Processing." "Other body" captures non-corporate entities. No size carve-out from the *definition*.

**s.18(1)**: "**no person shall act as a data controller or data processor unless registered** with the Data Commissioner."

**The threshold — Registration Regulations 2021 (LN 265), reg 13(2)**, from https://new.kenyalaw.org/akn/ke/act/ln/2021/265/eng@2022-12-31:

> exempt where the controller **(a) has an annual turnover below five million shillings or annual revenue below five million shillings; and (b) has less than ten employees.**

**A conjunctive test — BOTH limbs.** Either failing removes the exemption.

**⚠️ And reg 13(4) kills it anyway.** Third Schedule — "**THRESHOLDS FOR MANDATORY REGISTRATION**" — lists purposes requiring registration *notwithstanding* the sub-5m exemption. **Item 8 is "Provision of financial services."** Read literally, a group running a savings scheme and collecting contributions could fall inside — in which case registration is mandatory **regardless of size**.

**This is the single pivotal open question.** The counter-argument is real: a small voluntary savings group isn't a licensed financial-services provider, isn't CBK- or SASRA-regulated, doesn't take public deposits. But the schedule exists precisely to capture lenders and credit unions, and the drafting is visibly sloppy ("gambling", "transport services firms"), so intent is genuinely unclear. **UNVERIFIED — no ODPC determination on cooperative societies was found.**

**Fees** (from ODPC guidance — the *legislation* sets fees by regulation but the live fee page 404'd): **KSh 4,000** registration, **KSh 2,000** renewal every 2 years (Micro/Small tier, and the non-profit row reads as a flat KSh 4,000).

**Cost-benefit is not close: pay KSh 4,000 and find out.** `compliance@odpc.go.ke`.

**Processor agreements — s.42(2)(b) + Reg 24.** Easy to miss; my own first keyword sweep missed it too. **Reg 24(1)**: engage a processor "**through a written contract**", specifying subject matter, **duration**, nature and purpose, **type of personal data**, **categories of data subjects**, controller's instructions, processor's **confidentiality commitments** for anyone the processor admits, security measures, **permanent deletion or return on termination**, and **auditing/inspection** rights. **Reg 25(1)**: a processor must **not engage a third party without prior authorisation**; (4) it **remains liable** for them.

**Breach notification — two clocks (s.43):** processor → controller within **48 hours**; controller → ODPC within **72 hours**; and communicate to affected data subjects in writing. **Notifiable** breaches under **Reg 37** are narrower than "any breach" — only where there's real risk of harm and the data is Second Schedule data **or account credentials**. Reg 37(4): data does **not** become "publicly available" merely because a breach exposed it. *Your PIN hashes + phone numbers + balances across ~30 members plausibly qualifies. Treat a member-list dump as notifiable.* Report at **https://www.odpc.go.ke/report-a-data-breach**. For a group with no IR capacity, treat 72 hours as 24.

**Annual returns: NONE found.** The MSME guidance, the registration guidance, and the General Regulations 2021 contain **no annual or periodic reporting duty on controllers.** Don't budget for one.

## C.6 ODPC guidance 2024–2026

Site: **https://www.odpc.go.ke/** (live). Index: https://www.odpc.go.ke/guidelines — **24 guidance notes**: 10 in 2024, 10 in 2025, 4 in 2026.

The five that matter for you:

| Note | URL |
|---|---|
| **MSMEs (2025)** | `https://www.odpc.go.ke/wp-content/uploads/2025/11/ODPC-%E2%80%93-Guidance-Note-on-Processing-by-MSMEs.pdf` |
| **Cross-border transfers (Sept 2026)** | `https://www.odpc.go.ke/wp-content/uploads/2026/09/ODPC-%E2%80%93-Guidance-Notes-for-Cross-border-Data-Transfers.pdf` |
| **Data Sharing Code (Mar 2025)** | `https://www.odpc.go.ke/wp-content/uploads/2025/03/FINAL-DATA-SHARING-CODE.pdf` |
| **Registration (2024)** | `https://www.odpc.go.ke/wp-content/uploads/2024/02/ODPC-Guidance-Note-on-Registration-of-Data-Controllers-and-Data-Processors.pdf` |
| **DPIA (2024)** | `https://www.odpc.go.ke/wp-content/uploads/2024/02/ODPC-Guidance-Note-on-Data-Protection-Impact-Assessment-1.pdf` |

### 🔴 Verified negative: ODPC has issued **no** AI / ADM / profiling guidance

I checked all 24 notes plus the FAQ page. The only AI-adjacent ODPC output is a **news post** with no legal weight: *"Compliance with Data Protection Regulations in Wake of Growing AI Regulations"* (event 15 Aug 2024, https://www.odpc.go.ke/compliance-with-data-protection-regulations-in-wake-of-growing-ai-regulations/). **The binding ADM rules live in Regulation 22, not guidance.**

### Regulations / notices 2024–2026

- **Data Protection (Compliance Audit) Regulations, 2024** — **still DRAFT**, out for comment: https://www.odpc.go.ke/draft-the-data-protection-compliance-audit-regulations-2024/
- **Malabo Convention** added to the framework page Aug 2025. **Kenya has NOT acceded** (consultations only).
- **No amendments to the General Regulations found.**
- ⚠️ **Gazette sweep incomplete — UNVERIFIED.** gazettes.africa indexes Kenya **only to 2024** and exposes **no 2025 or 2026 entries**. I could not run the sweep you asked for. "No new 2025/26 DP regulations" rests on the ODPC framework page being current, which is strong but not equivalent to a gazette sweep.

## C.7 Kenya AI policy / AI Bill — **NOT enacted**

**The Kenya Artificial Intelligence Bill, 2026 — Senate Bill No. 4 of 2026.** Sponsor **Sen. Karen Nyamu**. Published **19 Feb 2026**. First reading in the Senate **2 Apr 2026**. Ordinary Bill.

- Bill (scanned PDF): https://www.parliament.go.ke/sites/default/files/2026-04/The%20Artificial%20Intelligence%20Bill%2C%202026%20%28Senate%20Bills%20No.4%20of%202026%29.pdf
- **Bill Digest (text-extractable)**: https://www.parliament.go.ke/sites/default/files/2026-04/Bill%20Digest%20-%20The%20Artificial%20Intelligence%20Bill%2C%20No.4%20of%202026.pdf
- Index: https://www.parliament.go.ke/the-senate/senate-bills

**Status20 Oct 2026: before the Senate ICT Committee, not enacted, no Act number.** The Digest required the committee to report within 30 days of committal (by 2 May 2026) but predates that, so **where it sits now is UNVERIFIED** — that it still appears as a live Senate Bill is the strongest available evidence it hasn't completed passage.

**No Kenya Artificial Intelligence Act exists.**

**Would require, if enacted:** an Office of the AI Commissioner with inspection/enforcement powers and fines; four-tier risk classification (unacceptable/high/limited/minimal), where **high risk includes "critical sectors including… finance"**; for high-risk systems — **risk and human rights impact assessments before deployment**, transparency/explainability, dataset documentation, DPA compliance, robustness/cybersecurity, and **human intervention rights**; workforce impact assessments; prohibitions on unacceptable-risk deployment and on likeness/voice misuse without consent; penalties up to **KSh 5,000,000 or 2 years or both**, with **officer liability**; plus subsidiary legislation on **data governance including localisation in AI applications**.

**Registration nuance that matters to you:** the Bill does **not** impose a general registration duty. Only **high-risk systems** go on a public register. Ordinary business AI use is not registered. *Revisit if you ever deploy AI in a credit-scoring context.*

**UNVERIFIED — do not assert either way:**
- **Whether a Kenya National AI Strategy exists or was adopted.** `ict.go.ke` returned403, `innovation.go.ke` is NXDOMAIN, `new.kenyalaw.org` failed TLS via WebFetch. The Bill Digest confirms a Ministry of ICT exists but names no strategy.
- **CAK:** checked https://www.cak.go.ke/ — no AI regulations, guidelines or positions. Genuinely not relevant.

## C.8 Financial data is NOT sensitive under the Act

The Act's sensitive-personal-data definition (s.2, ss.45–47) covers health, biometric, genetic, race, ethnic origin, conscience, belief, **property details**, marital/family status, sex life, sexual orientation. **Financial/transactional data is not listed.** Member contributions and arrears are ordinary personal data under ss.25 and 30.

**But s.45(a) is valuable to you:** processing by "a foundation, association or any other **not-for profit body**… with a political, philosophical, religious or **trade union aim**" is a permitted ground where processing relates **solely to members** and data **is not disclosed outside that body without consent**. A savings cooperative plausibly fits — and note that proviso cuts **against** piping member data to an external LLM API without consent.

**There is no cooperative-society-specific exemption anywhere in the Act.** You are an ordinary controller. *(Whether the SACCO Societies Act / CMA regime displaces the DPA for registered deposit-taking SACCOs is UNVERIFIED.)*

## C.9 Practical bottom line

**Do:**
1. **Register with ODPC (KSh 4,000, renew every 2 yrs).** Ask them directly whether a savings group falls in Third Schedule item 8.
2. **Written privacy notice at signup** — what you hold (name, phone, PIN hash, balances, contribution history), why, who else sees it (office-bearers, Google/Firebase), that it leaves Kenya, retention, what they can demand. **s.29** makes this mandatory at any size.
3. **Add the s.35 safeguards to the fine sweep** — written notice when a fine is applied, a one-page explanation of the logic, and a named officer who reviews challenges. Cheapest, highest-value item on this list.
4. **One-page DPIA** before adding any LLM feature (Reg 49(1)(i)), and remember the **60-day** s.31(5) lead time.
5. **Written DPAs** with Firebase and any LLM provider (s.42(2)(b), Reg 24) — Google click-through terms sit awkwardly against the 2026 guidance.
6. **Breach plan** — 72h to ODPC, written notice to members, treat as 24.
7. **Firebase hardening** — MFA, encryption in transit/at rest, audit logging, tested restore.
8. **Retention pass** — your constitution's no-deletion rule is right for the financial audit trail, but **wrong** for exited members' PIN hashes. s.26(e) gives a 14-day erasure right (framed narrowly, for "false or misleading" data); s.25(g) storage limitation gives you the cleaner answer.

**Can ignore:**
- **The AI Bill** — not law, won't bind you as drafted, no general AI registration duty.
- **Data localisation** — s.50 covers civil registration, elections, public finance, critical systems, basic education, primary health care. **No Kenyan data centre required.**
- **Binding Corporate Rules** — corporate-group machinery, prior-approval forms.
- **Annual ODPC returns** — none found.
- **A DPO** — optional; the registration form permits leaving it blank.
- **GDPR ceremony** — no DPO mandate, no EU representative, no adequacy analysis.

**Honest risk:** regulatory enforcement risk to a small cooperative is **low** — ODPC's history targets digital lenders, banks, telcos and health providers. The risk that actually bites is a member asking where their data went. The compliance work here is cheap, and it is mostly the same work as being an organisation its members trust.

---

## Three things I'd flag before you build anything

1. **Part A's answer is "hybrid, not API."** Take the monthly CSV for the risk-free benchmark (one fetch a month, no Blaze, no PDFs). Only parse the auction PDFs if you genuinely need the current week. And do not build against `https://www.centralbank.go.ke/bills-bonds/treasury-bills-average-rates/` — it looks right and has been dead since March 2016.
2. **Part B: don't scrape FX.** The daily rates are image-based PDFs that `pdftotext` cannot parse, behind a plugin endpoint with no paging and no stability guarantee, and the one obvious CSV is a2.5-year-dead trap. A manually-entered rate in your existing `config/settings` pattern is the right call for this group.
3. **Part C's sharpest edge is §35, not the AI Bill.** Your automated fine sweep already sits inside a real right not to be subject to solely-automated decisions, with a written reconsideration route. Three cheap additions close it. The AI Bill is not law and is not your problem this year.