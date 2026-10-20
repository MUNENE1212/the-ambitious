A cooperative society is not exempted — it must be an authorised merchant of a licensed PSP. I have everything needed.

# Payment Collection Alternatives to Safaricom Daraja — Kenya, October 2026

**Bottom line up front.** For a Kenyan cooperative society collecting monthly member dues, only **one** aggregator is both CBK-licensed and genuinely usable: **Paystack**. Flutterwave is not in CBK's licensed-PSP register; Kuda no longer operates in Kenya. The cheapest verified non-M-Pesa collection rail is **PostaPay** (Postal Corporation), which issues Tills/Paybills and is already interoperable with M-Pesa, Airtel Money, T-Kash and banks. No aggregator requires *you* to hold a CBK licence — s.9(1) of the pending 2026 Bill exempts only banks, MFIs, building societies and government enterprises, but the exemption structure confirms a society using a gateway is a **merchant of a licensed PSP**, not a PSP itself.

---

## Methodology & caveat (read this first)

**WebSearch returned empty result bodies for every query** in this environment — tested repeatedly across ~10 queries on unrelated topics. Zero results were returned. All findings below come from **direct WebFetch/curl of primary sources**, plus `pdftotext` extraction of official CBK PDFs.

This has one consequence you should weight heavily: I could not run open-ended news discovery. Section (e) news is therefore thin and mostly derives from documents I reached directly rather than from news aggregators. Brave Search via WebFetch partially worked before hitting persistent HTTP 429 rate limits.

**Two genuine corrections to the brief's premises, both verified against primary sources:**

1. **There is no "National Payment System Act 2021."** The law in force is the **National Payment System Act, Cap. 491A (No. 39 of 2011)**, with **National Payment System Regulations 2014**. CBK's own legislation index lists only the 2011 Act. The2026 Bill would repeal Cap. 491A and replace it.
2. **KEPSS/RTGS is operated by CBK, not KBA.** The brief assumed KBA-on-IPN. CBK's own PFMI assessment states: *"The CBK, as the KEPSS operator, has set out regulations to specify both access and exit criteria for participants."* KBA's role is via IPSL, which runs **PesaLink/IPP** — a different rail.

---

## (a) Aggregator gateways in Kenya

### Paystack Payments Kenya Limited — ✅ VERIFIED, and the only viable option

Licensed by CBK as of **November 8, 2022**; still listed in the current directory (as at **August 10, 2026**), entry 21, approved service: *"To provide a platform that facilitates processing of payments on behalf of merchants."*

**Pricing** (paystack.com/ke/pricing):

| Method | Charge |
|---|---|
| M-Pesa | **1.5%** |
| Local cards | 2.9% |
| International cards | 3.8% |
| M-Pesa Paybill/Till transfer | KES 40–350 (banded) |
| Bank transfer | KES 80–350 (banded) |

No setup or monthly fees. **Settlement T+2** (two working days) to bank account **or** M-Pesa wallet. Volume discounts offered.

**M-Pesa STK Push: confirmed, and this is the key detail.** Paystack's payment-channels doc lists **M-PESA** (provider code `mpesa`) under Mobile Money — *"allows businesses to charge individual customers via STK push to their phone number."* Support article: *"the customer will receive a prompt on the mobile device attached to their number… confirm the payment via an OTP."* **Max M-Pesa transaction: KES 150,000.**

Paystack also supports **Airtel Money** (provider code `atl`) and **PesaLink** bank transfer in the same checkout.

**M-Pesa Till is a real Paystack product** — charge **1.5%**, min KES 10, max KES 250,000. But note a restrictive eligibility clause: *"The solution currently is limited to the operator whose phone number is under the Nominated Number… as configured on MPESA."* Large organisations typically don't qualify. **If your society needs a Till/short code, Paystack's Till may not be available to you** — verify before designing around it.

**KYC:** UNVERIFIED. Paystack publishes no onboarding document checklist. You will need to ask them directly.

### Flutterwave — ❌ NOT a licensed Kenyan PSP

Pricing is published and competitive (M-Pesa/wallets **2.9%**, local cards 3.2%, international 4.8%, transfers out KES 100, **T+1 settlement**, next-day) — but Flutterwave appears in **neither** CBK directory (Nov 2025 nor Aug 2026). Cellulant and Pesapal, both comparable aggregators, *are* listed. This is a material red flag for a cooperative society's compliance posture, not a pricing question. **UNVERIFIED** as to why; do not assume it means non-compliance — but do not assume it doesn't either.

### Kuda — ❌ DEAD IN KENYA

kuda.co.ke does not resolve. Kuda's live site describes itself as *"the digital bank built for Nigerians,"* incorporated and licensed in Nigeria, with all fees in Naira. **Not a Kenya option.**

### Others you asked about, checked against the CBK register

| Provider | Status (CBK licensed-PSP directory) |
|---|---|
| **Cellulant Kenya Ltd** | ✅ Licensed1 Jan 2022. Owns Cellulant.io. Active. |
| **Pesapal** | ✅ Licensed 1 Jun 2021 |
| **Tanda** (tanda.africa) | ✅ Licensed — "facilitates processing of payments on behalf of **SACCOS and other Informal Financial Groups**" |
| **Data Integrated** | ✅ Licensed. Self-reports **80+ SACCOs onboarded**. No published pricing. |
| **Wakandi Kenya** | ✅ Licensed. **SACCO-focused** — expressly licensed to process payments on behalf of SACCOs. |
| **PayAfrica, Till, GoPay, Pesapay** | ❌ Not in CBK directory. PayAfrica & Till: NXDOMAIN. Regulatory standing UNVERIFIED. |
| **Interswitch, Kenswitch, IPSL** | ✅ Licensed as **switching/clearing operators**, not collection gateways |

**Wakandi and Data Integrated deserve a look** — both are licensed specifically for cooperative/SACCO group collection, which suggests they understand your member type.

---

## (b) Other mobile money

### PostaPay (Postal Corporation of Kenya) — ✅ the strongest alternative to M-Pesa

`posta.co.ke` (note: **not** teleposta.co.ke, which doesn't resolve). Published, quoted:

> "**PostaPay** is a unified payment interface (UPI) that is interoperable with all mobile wallets and banks in Kenya… The platform is interoperable with all other mobile money wallets e.g. **Mpesa, Airtel Money, Tkash, Vooma**, and all banks… This interoperability cuts cuts both individual wallets and business accounts i.e. **paybills and tills** and all banks through **Pesalink**."
> "Postapay will allocate **Tills and Paybills**… to collect **school fees**… Businesses can access… **Standing orders, Auto-settlement**."
> 600+ offices nationally. Register via USSD `*336*20#`.

Published 2026 tariff covers transfers and withdrawals (e.g. transfer to another wallet KES 5–39 banded; agent withdrawal KES 19–210 banded). **Merchant collection MDR: UNVERIFIED — must be requested from PostaPay directly.** Settlement is interbank via PesaLink, i.e. into your society's own bank account.

### Airtel Money Kenya — licensed but unpublished

CBK-licensed (21 Jan 2022) for mobile money **and** merchant processing. Live site is **`airtelkenya.com`** — `airtel.ke` has a broken DNS delegation (REFUSED at authoritative NS across Cloudflare/Google/AliDNS).

Consumer tariff is published and generous: **all Airtel-to-Airtel person-to-person transfers free**, cross-network7–108, withdrawal 11–309. **Merchant collection pricing: UNVERIFIED** — no merchant page exists (`/ke/personal/merchant` → 404). An Airtel **"MerchantPay"** and **"collections"** API *do* exist (`openapi.airtel.africa/merchantpay/`, `/collections/`, both HTTP 401 — auth-walled), so the Daraja analogue exists but is undocumented and unpublished for pricing. **You would negotiate from zero.**

### Teleposta/Postbank — ❌ no collection product

Postbank's only digital channel is Patacash, and it is explicitly Safaricom-partnered: *"allows customers to transfer funds from their Postbank account **to M-PESA**… offered under partnership with… Safaricom."* It's a disbursement channel, not a collection one. **PostaPay and Postbank are separate entities** — don't conflate them.

### Banks

**Co-op Bank** is the only bank with Airtel Money priced in a published tariff (Tariff Guide as at **29 Sept 2026**): bank→Airtel transfers tiered **KES 0–50** (column layout scrambled in extraction; partially verified). SACCO banking and bulk payments are separate tariff tables.

**Family Bank** has a live self-serve **Merchant & Agent portal** (5-step wizard, business number + OTP only) — worth a call. But its Jan 2026 tariff guide contains **only M-Pesa** lines and no Airtel, merchant, paybill or collection pricing.

**Equity, KCB, NCBA: UNVERIFIED** — equitybank.co.ke connection never completes; KCB is behind a bot wall; ncba.co.ke returns NXDOMAIN from three resolvers.

---

## (c) Bank rails

### KEPSS/RTGS — CBK-operated, banks-only

- **Operated by CBK**, not KBA. Participants hold reserves at CBK; RTGS debits/credits bank accounts there.
- **Pricing: UNVERIFIED from CBK.** CBK's KEPSS pages publish volume/value statistics only, not tariffs. Bank-level published tariffs are the practical reference: **Family Bank (Tariff effective Jan 2026) — RTGS outward KES 500, RTGS inward Free.** Other banks cluster in the same range.
- **Window:** payment instructions accepted **08:25–16:30 Mon–Fri**; pending value-date transactions cancelled at closure; future-dated queuing supported.
- **Critically for you: "KEPSS membership is generally provided to all licensed commercial and microfinance banks"** meeting eligibility in the KEPSS Rules and Procedures. Participation is *"open to a financial institution or any entity approved by the CBK"* — so a society is theoretically possible via approval, but this is not a normal path. **A SACCO cannot realistically self-serve onto RTGS.**

### ACH (Cheques & EFTs)

EFT is the rail that actually serves cooperatives. Family Bank Jan 2026: **Inward EFT KES 100, Transaction Processing (EFT) KES 100.** Settlement timing and CBK's own EFT tariff: UNVERIFIED — CBK's ACH page publishes statistics only.

### PesaLink / IPP — ✅ LIVE, and the interbank rail you'd actually use

Operated by **Integrated Payment Services Limited (IPSL)**, a KBA subsidiary established 2015 under the National Payment System Act. **80+ participants** including banks, **SACCOs**, telcos, MFIs and fintechs. **Up to KES 999,999 per transfer, real-time, 24/7/365.** Fee: not published. **CBK's KEPSS report confirms PesaLink clearings settle in KEPSS daily.**

Safaricom joining PesaLink for mobile-wallet↔bank transfers: **UNVERIFIED** — widely reported in secondary sources, not confirmed on a CBK or Safaricom primary page in this research.

### SWIFT

Family Bank Jan 2026: **SWIFT KES 2,000** corporate (KES 1,500 retail), **amendment KES 2,000**. Realistically only for international; irrelevant for member dues.

### Live interoperability status (what's actually working in 2026)

- **PesaLink/IPP A2A** — live, 80+ institutions, SACCOs included.
- **M-Pesa ↔ Airtel Money cross-network** — live at consumer level (Airtel publishes cross-network transfer charges; Co-op prices bank→Airtel).
- **PostaPay** — verified live and multi-wallet.
- **Full PSP-level interoperability** — **NOT yet in force.** Section 28 of the 2026 Bill would *mandate* interoperability and empower CBK to *order* PSPs to interoperate, with administrative enforcement for non-compliance. This is prospective, not current.

---

## (d) CBK PSP licensing and KYC — the question you most need answered

### Legal basis (corrected)

In force: **National Payment System Act Cap. 491A (No. 39 of 2011)** + **NPS Regulations 2014**. Pending: **Draft National Payment System Policy and Bill, 2026**, published by CBK and National Treasury **September 2026**; public comment period **closed October 9, 2026**; **not yet law**.

### Does your society need a CBK PSP licence? **No.**

Bill s.9(1) exempts only: government-owned enterprises, banks, microfinance banks, building societies. A cooperative society is not exempt *from the Act*, but it is not conducting "the business of a payment service provider or payment system operator" when it merely sells goods/services and takes payment through a licensed gateway — it is a **merchant**. The Bill's own definition supports this:

> *"merchant acquirer" means a **payment service provider** through which **merchants** can process their payment transactions…"*

Paystack (and Wakandi, Tanda, Data Integrated) hold the licence; your society uses theirs. You pay their fees; they carry the PSP-level AML burden.

### Minimum capital — the Third Schedule (primary source, Third Schedule pp. 43–44)

| License type | Category | KSh m |
|---|---|---|
| Payment Service Provider | Payment Initiation Service Provider | 5 |
| | Account Information Service Provider | 5 |
| | Money Remittance Service Provider | 30 |
| | Merchant Acquirer | 50 |
| | Electronic Wallet Provider | 50 |
| | Electronic Money Issuer | 250 |
| Payment System Operator | **Payment Gateway** | **10** |
| | Payment Messaging System Operator | 20 |
| | Card Scheme Operator | 50 |
| | Payment Switching and Clearing System Operator | 50 |

Multi-category: full capital for the highest tier **plus 50% of each additional tier**. Trust-account cap: KES 500m or 25% of trust monies per bank. Transition: existing providers get **one year** to comply (s.79).

### AML/KYC allocation

The Bill cross-refers to the **Proceeds of Crime and Anti-Money Laundering Act** for PSP-level duties. A cooperative society is separately an AML-regulated reporting institution in its own right under POCAMLA regardless of which gateway it uses — so your society's existing AML/KYC obligations **do not change** by adopting an aggregator. What changes is that PSP-level merchant due diligence sits with Paystack.

**Merchant KYC documents required: UNVERIFIED.** Neither Paystack nor Flutterwave publishes a Kenyan onboarding checklist. Expect to be asked for: certificate of registration, KRA PIN certificate, IDs of directors, proof of registered address, and a bank account in the society's exact name. Confirm directly.

---

## (e) 2025/2026 fintech news

Limited by the search outage. What I verified directly:

- **Sept 2026** — CBK + National Treasury publish Draft NPS Policy and Bill 2026; KES 250m e-money capital headline drew coverage; comment period closed 9 Oct 2026.
- **Aug 2026** — CBK PSP directory shows turnover: Quidexplus and Raha newly listed; Whizmo dropped since the Nov 2025 edition. Kuda gone from the Kenyan market entirely.
- **Aggregator pricing changes specifically: UNVERIFIED.** I found no evidence of 2025/2026 repricing at Paystack or Flutterwave. Neither advertises a change.
- **Cellulant / Airtel Africa acquisition: UNVERIFIED.** Cellulant Kenya Ltd remains a separately-licensed CBK PSP entity. I could not verify or refute acquisition from a primary source.

---

## Recommendation

1. **Paystack** (1.5% M-Pesa STK, T+2, settles to your bank account) is the primary option. Confirm at onboarding: (a) merchant KYC documents for a registered cooperative society, (b) whether your society qualifies for the M-Pesa Till/short code given the Nominated Number restriction, (c) whether T+2 can be improved.
2. **Add PostaPay as a second rail** — it issues genuine Tills/Paybills, is already interoperable across M-Pesa/Airtel/T-Kash/banks, supports standing orders and auto-settlement, and settles via PesaLink. Request the merchant collection rate, which is not published.
3. **Talk to Wakandi and Data Integrated** — both CBK-licensed and both explicitly aimed at SACCO/cooperative group collection.
4. **Avoid Flutterwave** unless they explain their CBK licensing position.
5. **Watch the 2026 Bill.** It is not law today, but mandatory interoperability and the KES 10m payment-gateway tier signal where this market is heading.

---

## Sources

| URL | Retrieved |
|---|---|
| https://paystack.com/ke/pricing | 2026-10-20 |
| https://paystack.com/docs/payments/payment-channels/ | 2026-10-20 |
| https://support.paystack.com/en/articles/2128322 (M-Pesa STK) | 2026-10-20 |
| https://support.paystack.com/en/articles/3340930 (M-Pesa Till) | 2026-10-20 |
| https://paystack.com/ke | 2026-10-20 |
| https://flutterwave.com/ke/pricing | 2026-10-20 |
| https://kuda.com/ ; https://kuda.com/ke/pricing | 2026-10-20 |
| **CBK** Directory of Authorized PSPs, as at **10 Aug 2026** (PDF, 41 entries) | 2026-10-20 |
| **CBK** Directory of Authorized PSPs, as at **6 Nov 2025** (PDF) | 2026-10-20 |
| **CBK** National Payment System Bill 2026 (PDF; Third Schedule, ss.9, 19, 28, 78, 79) | 2026-10-20 |
| CBK — Draft NPS Policy and Bill 2026 announcement (21 Sep 2026) | 2026-10-20 |
| CBK — NPS legislation index (NPS Act 2011, Regulations 2014) | 2026-10-20 |
| CBK — National Payment System (overview) | 2026-10-20 |
| CBK — KEPSS/RTGS (Aug 2026 statistics) | 2026-10-20 |
| **CBK** KEPSS PFMI Assessment, Dec 2024 (PDF; operator, participants, PesaLink settlement) | 2026-10-20 |
| CBK — Mobile Payments; ACH Cheques & EFTs | 2026-10-20 |
| https://pesalink.co.ke/how-it-works (IPSL/KBA, 80+ participants) | 2026-10-20 |
| https://pesalink.co.ke/ | 2026-10-20 |
| https://www.airtelkenya.com/ke/personal/tariffs-charges | 2026-10-20 |
| https://openapi.airtel.africa/ (merchantpay, collections — 401) | 2026-10-20 |
| https://posta.co.ke/services/payment-services/ | 2026-10-20 |
| posta.co.ke PostaPay Transfer Tariff 2026 (PDF) | 2026-10-20 |
| https://www.postbank.co.ke/ | 2026-10-20 |
| Family Bank Tariff Guide, effective **Jan 2026** (PDF; RTGS/SWIFT/EFT) | 2026-10-20 |
| https://merchant-agent.familybank.co.ke/portal/login | 2026-10-20 |
| Co-op Bank Tariff Guide, as at **29 Sep 2026** (PDF) | 2026-10-20 |
| https://dataintegrated.co.ke/ (80+ SACCOs) | 2026-10-20 |
| https://hapakenya.com/2026/09/24/kenya-proposes-capital-requirements-of-up-to-ksh-250m-for-payment-service-providers/ | 2026-10-20 |
| https://vellum.co.ke/skin-in-the-game-new-requirement-for-minimum-capital-under-the-national-payment-system-bill-2026/ | 2026-10-20 |

**Marked UNVERIFIED:** Flutterwave CBK licence status; all aggregator merchant KYC checklists; Airtel merchant/collection pricing and MDR; PostaPay merchant collection MDR; PostaPay SACCO eligibility; Paystack Till eligibility for large organisations; CBK's own RTGS/ACH/EFT tariff schedule; Safaricom–PesaLink integration; Cellulant/Airtel Africa acquisition; Equity/KCB/NCBA collection products and pricing; all 2025/26 aggregator repricing news; GoPay/Pesapay regulatory standing.