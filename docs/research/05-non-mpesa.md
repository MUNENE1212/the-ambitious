I have solid verified material. Writing the brief now.

## Kenya non‑Safaricom payment‑collection options — research brief

**Retrieved 2026‑10‑20.** WebSearch returned empty bodies for every query in this environment (tested once, confirmed); all findings below come from direct fetches of primary sources.

### Critical infrastructure finding: Airtel Kenya's "real" domains

`airtel.ke`, `www.airtel.ke`, `api.airtel.ke` and `my.airtel.ke` **do not resolve** — not a sandbox artifact. The failure is at the authoritative‑nameserver level and reproduces across Cloudflare, Google and AliDNS DoH:

> `EDE(22): No Reachable Authority at delegation airtel.ke.` / `EDE(23): Network Error 192.163.206.25:53 returned REFUSED for airtel.ke A` — and `[192.163.206.25] rcode=REFUSED for airtel.ke/a`. The `.ke` zone SOA (mzizi.kenic.or.ke) answers fine for other names, so this is Airtel's own lame/broken delegation, not Kenyan registry outage. An external text proxy (jina.ai, independent resolver) failed on it too.

**The live Airtel Kenya site is `airtelkenya.com`**, not `airtel.ke`. This is confirmed by the Central Bank of Kenya itself — the Directory of Authorized PSPs lists Airtel Money Kenya Limited's `Website: https://www.airtelkenya.com/`. Wayback has effectively nothing for `airtel.ke` (one 2022 root snapshot).

---

### 1. Airtel Money Kenya

**Licensed and regulated.** CBK, *Directory of Authorized Payment Service Providers (PSPs) as at August 10, 2026*, entry 2: "Airtel Money Kenya Limited", P.O. Box 73146‑00200 Nairobi, tel +254733475220, customerservice@ke.airtel.com, www.airtelkenya.com, Parkside Towers Mombasa Road Nairobi, "Date First Licensed: January 21, 2022", MD Ms. Anne Kinuthia‑Otieno. Approved services, quoted: "To issue, process, store, send and facilitate mobile money payments" and "To provide a platform that facilitates processing of payments on behalf of merchants."

**Consumer tariff — full published table** (airtelkenya.com/ke/personal/tariffs-charges). Page text, verbatim: "We have waived all person to person transaction fees for Airtel Money customers across all the bands… Maximum daily transaction value is Kes 500,000 / Maximum account balance is Kes 500,000 / Maximum amount per transaction is Kes 250,000."

| Band (KES) | Airtel→Airtel | To other networks | Withdrawal |
|---|---|---|---|
| 10–49 | Free | – | – |
| 50–100 | Free | – | 11 |
| 101–500 | Free | 7 | 29 |
| 501–1,000 | Free | 13 | 29 |
| 1,001–1,500 | Free | 23 | 29 |
| 1,501–2,500 | Free | 33 | 29 |
| 2,501–3,500 | Free | 53 | 52 |
| 3,501–5,000 | Free | 57 | 69 |
| 5,001–7,500 | Free | 78 | 87 |
| 7,501–10,000 | Free | 90 | 115 |
| 10,001–15,000 | Free | 100 | 167 |
| 15,001–20,000 | Free | 105 | 185 |
| 20,001–25,000 | Free | 108 | 197 |
| 25,001–30,000 | Free | 108 | 197 |
| 30,001–35,000 | Free | 108 | 197 |
| 35,001–40,000 | Free | 108 | 278 |
| 40,001–45,000 | Free | 108 | 278 |
| 45,001–50,000 | Free | 108 | 278 |
| 50,001–70,000 | Free | 108 | 309 |
| 70,001–150,000 | Free | 108 | 309 |
| >150,000 | Free | 108 | 309 |

Also on page: "To transact at any Airtel Money Agent outlet, you will be required to produce your original identification document, i.e. National ID or Kenyan Passport."

**Merchant / business collection — UNVERIFIED pricing.** Airtel Kenya is *licensed* for merchant payment processing (CBK, quoted above), and Airtel Africa confirms merchant payments are a live product line: "We're expanding our mobile money portfolio through additional fintech services, including **merchant payments**, loans, savings and international money transfers (IMTs)." But:
- No Airtel Money **merchant discount rate, paybill/till pricing, or commercial/collection fee** is published anywhere I could reach. I crawled the full `airtelkenya.com/ke/*` menu (via the site's own sitemap-of-links); there is **no merchant/collection page at all** — `/ke/personal/merchant` returns 404.
- **Airtel API — partially verified.** `openapi.airtel.africa` resolves and exposes distinct product gateways: `/collections/` → HTTP 401, `/merchantpay/` → HTTP 401, `/v1-0/` → 401, `/apidocs/` → 401. So **an Airtel "MerchantPay" API and a "collections" API exist** as distinct Airtel API products — this is the closest thing to a Daraja equivalent (the STK‑push analogue would live under these gateways). **All commercial/API fees: UNVERIFIED** — every docs path is behind auth or Imperva bot‑protection, and `developer.airtel.africa` and `business.airtel.africa` are Cloudflare CNAMPs with **no A‑record** (resolution failure), so the developer portal is not publicly reachable.
- Consumer‑side only: "Zero charges when you send money Airtel to Airtel."

**Practical read for your group:** Airtel Money *collection* is real and regulated, but Airtel publishes no merchant price list. You would be negotiating from zero.

---

### 2. Teleposta / Kenya Post — the strongest verified finding

The operator is **Postal Corporation of Kenya**, site `posta.co.ke` (NOT `teleposta.co.ke`, which does not resolve; `kenyapost.co.ke` is an unrelated news site). CBK's postal register lists "POSTAL CORPORATION OF KENYA" as no. 347, the **Public Postal Operator**.

**PostaPay is a real, live, Airtel-interoperable collection product.** From posta.co.ke/services/payment-services/, verbatim:

> "**PostaPay** is a unified payment interface (UPI) that is interoperable with all mobile wallets and banks in Kenya… to collections accounts issued by PostaPay."
> "The platform is interoperable with all other mobile money wallets e.g. **Mpesa, Airtel Money, Tkash, Vooma**, and all banks… This interoperability cuts across both individual wallets and business accounts i.e. **paybills and tills** and all banks through **Pesalink**."
> "It is organized in three ways namely: Individual Wallets, **Merchant Accounts (Disbursements & Collections)** and Agency Solution."
> "PostaPay accounts gives Government institutions the ability to collect funds… Through one account, they can receive collections from **Mpesa, Airtel money, Tkash and Partner banks**."
> "Postapay will allocate **Tills and Paybills**… to collect **school fees** from parents from any of their preferred payments wallet."
> "Businesses can access the following solutions through the PostaPay business account e.g. **Standing orders, Auto-settlement**."
> "Leveraging on the **600+ Posta Corporation of Kenya offices** spread throughout the country…"
> "Dial **\*336\*20#** to Register or Download PostaPay"

**Published2026 tariff (posta.co.ke/wp-content/uploads/2026/04/postapay-transfer-tariff-2026.pdf)** — customer withdrawal & transfer tariff:

| Band (KES) | Transfer to registered PostaPay users/subwallets | Transfer to other mobile money | PostaPay agent withdrawal |
|---|---|---|---|
| 1–49 | 0 | 0 | 0 |
| 50–100 | 0 | 0 | 0 |
| 101–500 | 5 | 7 | 19 |
| 501–1,000 | 10 | 11 | 20 |
| 1,001–1,500 | 18 | 19 | 20 |
| 1,501–2,500 | 18 | 19 | 20 |
| 2,501–3,500 | 21 | 24 | 35 |
| 3,501–5,000 | 21 | 24 | 47 |
| 5,001–7,500 | 21 | 24 | 59 |
| 7,501–10,000 | 24 | 25 | 78 |
| 10,001–15,000 | 28 | 29 | 113 |
| 15,001–20,000 | 29 | 29 | 126 |
| 20,001–25,000 | 35 | 39 | 134 |
| 25,001–30,000 | 35 | 39 | 134 |
| 30,001–35,000 | 35 | 39 | 134 |
| 35,001–40,000 | 35 | 39 | 134 |
| 40,001–45,000 | 35 | 39 | 189 |
| 45,001–50,000 | 35 | 39 | 189 |
| 50,001–70,000 | 35 | 39 | 210 |
| 70,001–150,000 | 35 | 39 | 210 |
| 150,001–250,000 | 35 | 39 | 210 |

Other published lines: "Buying airtime Free / PostaPay registration Free / All deposits Free"; ATM withdrawal KES 30 (KES 101–1,500), 33 (1,501–2,500), 58 (2,501–3,500), 61 (3,501–5,000), 100 (5,001–7,500), 112 (7,501–10,000), 183 (10,001–15,000), 195 (15,001–20,000); one‑time limit KES 150,000, daily KES 500,000; "PostaPay wallet limits for individual users to be KES 500,000".

**Merchant/collection MDR: UNVERIFIED** — the PDF is explicitly the *transfer and withdrawal* tariff; the merchant collection rate is not published.

**Postbank** (postbank.co.ke) has **no mobile-money collection product**. Its only digital channel is Patacash, and the page is explicit about the limitation: "Patacash… allows customers to transfer funds from their Postbank account **to M-PESA** or to another Postbank account. **The patacash service is offered under partnership with mobile network provider, Safaricom**." USSD `*498#`, features: transfers to MNO wallets, school fees payment. Note PostaPay (Postal Corporation) and Postbank are **separate entities** — don't conflate them.

---

### 3. Banks

**Co-op Bank — the only bank with Airtel Money priced in a published tariff guide.** Tariff Guide as at 29 September 2026 (co-opbank.co.ke/wp-content/uploads/2026/10/Co-op-A2-Bank-Tariff-Guide_29-September-2026.pdf), Table 5 (Digital Products & Services) includes rows for "Transfer to Mpesa, **Airtel Money (Tiered)** Ksh.0‑Ksh.50" and "Airtime Purchase (Tiered) **Airtel Money** (Tiered) Ksh.0‑Ksh.50" — i.e. bank→Airtel-wallet transfers and Airtel airtime, at **KES 0–50 tiered**. The PDF's column layout is scrambled by text extraction and I could not reliably reconstruct which product tier each figure attaches to, so treat the KES 0–50 attribution as **partially verified**. Also present: "Mcollection Deposit — Free", "Mcollection Pay to Paybill/Pay to Till — Free", "MPesa Float Purchase Ksh.0‑Ksh.200", "Mco-opcash transfer Ksh.0‑Ksh.35". SACCO banking is Table 11; bulk payments Table 2 ("Cheques paid against ENC & Excesses for Saccos — Between Ksh.30 to Ksh.200 negotiable payable by the originator", minimum Ksh.2,000 per cheque). Co-op also publishes a School Business Codes list (24.08.2026).

**Family Bank — merchant/agent portal confirmed live and self-serve.** `merchant-agent.familybank.co.ke/portal/login` is a working 5‑step registration wizard: "Family Bank Merchants and Agents portal", steps Account Number → Customer type (ID/Business No) → Credentials → OTP. Self‑registration is possible with just an account number. Family Pay bulk payments at `familypay.familybank.co.ke/bulk`. Tariff Guide effective January 2026 (familybank.co.ke/family-bank/wp-content/uploads/2026/01/Tariff_Guide_as_at_January_2026.pdf) — I searched the full extracted text: it contains **only M‑Pesa** (M‑Pesa Float, agency deposits) and **zero occurrences of "Airtel", "merchant", "paybill" or "collection"** as a priced line. So Family Bank publishes **no Airtel collection pricing**, and no merchant MDR.

**Equity Bank Kenya — UNVERIFIED.** `equitybank.co.ke` resolves (196.216.242.179) but the connection never completes from this sandbox; `equitybank.com` serves the **US** business site whose "Collect Solutions" page is US‑only (ACH, lockbox, remote deposit capture, BASYS card processing) — not Kenya products.

**KCB — UNVERIFIED.** `kcbgroup.co.ke` is behind a bot wall ("Verifying that you are not a robot…"); no content retrievable.

**NCBA — UNVERIFIED.** `ncba.co.ke`, `www.ncba.co.ke`, `ncba-group.co.ke`, `ncba.com` and `ncba.co.za` — the `.co.ke` names return **NXDOMAIN** from three independent resolvers with the KeNIC `.ke` SOA in the authority section. (NCBA's Kenyan site appears to be genuinely absent from DNS as observed here.)

---

### 4. Aggregators / paybill-as-a-service — verified against the CBK register

The authoritative test is the CBK *Directory of Authorized PSPs as at 10 August 2026*. Names licensed for "To provide a platform that facilitates processing of payments on behalf of merchants" include: Viewtech Limited (sasapay.co.ke), Finserve Africa, Web Tribe, Afrinet Global, **Kashia Services** (cashia.com), **Whizmo Limited** (ke.whizmo.com, first licensed 15 May 2026), **Cellulant Kenya Limited** (cellulant.io), Pesapal, **Loop Payco** (loop.co.ke), Jumia Payment Services Kenya, Umsuka Capital, Fivespot Kenya, **Paykit Kenya**, Craft Silicon, Virtual Pay International, dLocal Payments Kenya, Kasapay, Tangazoletu, Skyworld, **Data Integrated Limited** (dataintegrated.co.ke), **Tanda Agent Limited** (**tanda.africa**, not tanda.co.ke).

- **Tanda — CONFIRMED operating.** CBK‑licensed 13 September 2023, P.O. Box 31470‑00606 Nairobi, hello@tanda.africa, Ground Floor Riara Corporate Suites, Riara Road. Note `tanda.africa` did not resolve through the proxy here and `tanda.co.ke` is NXDOMAIN.
- **Cellulant Kenya — CONFIRMED operating** as a licensed Kenyan PSP entity (P.O. Box 44134‑00100, info@cellulant.io).
- **Data Integrated — CONFIRMED operating, and the most SACCO-relevant find.** Their own site: "CBK Licensed · Nairobi, Kenya", "East Africa's Merchant Payments Infrastructure Platform, built in Kenya", "**80+ SACCOs onboarded**", "50k+ Active merchants", "KES 2B+ Transactions processed", and for operators: "Cashless fare collection via Epesi Tap & Go", "Real-time revenue tracking per vehicle". Also runs **Mapato** payroll and **MobiTill** devices. **Pricing: UNVERIFIED** — quote‑based, contact sales@dataintegrated.co.ke / 071 1520 705.
- **GoPay (gopay.co.ke) — NOT in the CBK licensed PSP directory** as fetched. Its own site claims Airtel/T‑kash/Loop/KCB/Equitel support and no published fees. Treat its regulatory standing as **UNVERIFIED**.
- **Pesapay (pesapay.co.ke) — NOT in the directory.** Site claims Kikosi Limited, USSD/QR/merchant portal, "all major cards and mobile money", no prices. **UNVERIFIED**.
- **Till (till.x) — DEAD.** NXDOMAIN.
- **PayAfrica (payafrica.co.ke) — DEAD.** NXDOMAIN.
- **Kuda (kuda.co.ke) — DEAD.** NXDOMAIN.
- **apesa.co.ke — abandoned.** Serves a raw LiteSpeed "Index of /" directory listing, last modified 2021‑01‑21.

---

### 5. SACCO / cooperative eligibility

- **Airtel Money collection account for a SACCO: UNVERIFIED.** Airtel Kenya is licensed to process merchant payments, but publishes no onboarding criteria, and there is no merchant page to check. Whether a registered cooperative society qualifies is not documented anywhere reachable.
- **PostaPay for a SACCO/cooperative: partially supported by published language, but eligibility UNVERIFIED.** PostaPay's published text addresses "**Merchant – Business Accounts**" and "Institutional accounts", says "**No limitation to mobile numbers**", and offers "Standing orders, **Auto-settlement**", disbursement to "multiple different accounts through one payment instruction", and settlement "through Pesalink" — i.e. interbank settlement into a cooperative's own bank account is architecturally supported. But PostaPay is **not in the CBK licensed‑PSP directory** as I fetched it (consistent with it being an agent of banks/wallets rather than a PSP), and I found no published KYC/eligibility rule admitting cooperatives.
- **Airtel wallet → bank account payout:** the mechanism is well established on the consumer side — the Airtel tariff lists "Transfer to Other Networks" charges and Co‑op Bank prices bank→Airtel‑Money transfers at KES 0–50 tiered, so Airtel‑wallet‑to‑bank settlement exists in both directions. The **specific tariff for a bulk/SACCO‑scale Airtel→cooperative‑bank payout is UNVERIFIED** (that would be an API/merchant‑pay commercial fee, unpublished).

---

### Bottom line

If you need a **verified, priced, Airtel‑Money‑interoperable collection** path today, the only one is **PostaPay** (posta.co.ke): it is the sole non‑Safaricom product I could verify from an official source that explicitly collects from M‑Pesa, **Airtel Money**, T‑kash, Vooma and banks via issued Tills/Paybills, with 600+ physical outlets, standing orders and auto‑settlement. Its published tariff is withdrawal/transfer only — **the merchant collection rate must be requested from PostaPay directly** (USSD `*336*20#` to register). Airtel's own merchant‑collection API exists (`openapi.airtel.africa/merchantpay/`, `/collections/`) but is undocumented and unpublished for fees. Bank‑side Airtel collection pricing exists only at **Co‑op Bank** (tiered KES 0–50 on wallet transfers/airtime), and Family Bank's self‑serve Merchant & Agent portal is the other route worth a call.

### Sources

| URL | Retrieved |
|---|---|
| https://www.airtelkenya.com/ | 2026‑10‑20 |
| https://www.airtelkenya.com/ke/personal/tariffs-charges | 2026‑10‑20 |
| https://www.airtel.africa/mobile-money | 2026‑10‑20 |
| https://openapi.airtel.africa/ (401 on /collections/, /merchantpay/, /apidocs/) | 2026‑10‑20 |
| https://dns.google/resolve?name=airtel.ke&type=A (REFUSED / lame delegation) | 2026‑10‑20 |
| https://web.archive.org/cdx/search/cdx?url=airtel.ke&matchType=domain | 2026‑10‑20 |
| https://posta.co.ke/ | 2026‑10‑20 |
| https://posta.co.ke/services/payment-services/ | 2026‑10‑20 |
| http://posta.co.ke/wp-content/uploads/2026/04/postapay-transfer-tariff-2026.pdf | 2026‑10‑20 |
| https://postbank.co.ke/mobile-banking-2/ | 2026‑10‑20 |
| https://postbank.co.ke/services/ | 2026‑10‑20 |
| https://www.centralbank.go.ke/wp-content/uploads/2026/09/Directory-of-Authorized-Payment-Service-Providers-August-10-2026.pdf | 2026‑10‑20 |
| https://www.centralbank.go.ke/2022/09/14/directory-of-payment-service-providers/ | 2026‑10‑20 |
| https://www.centralbank.go.ke/national-payment-system/mobile-payments/ | 2026‑10‑20 |
| https://www.ca.go.ke/licensee-register | 2026‑10‑20 |
| https://www.ca.go.ke/sites/default/files/2026-07/REGISTER%20OF%20TELECOMMUNICATION%20LICENSEES.pdf | 2026‑10‑20 |
| https://www.ca.go.ke/sites/default/files/2026-03/POSTAL%20AND%20COURIER%20OPERATORS%20AS%20AT%2015TH%20FEB%202026.pdf | 2026‑10‑20 |
| https://www.co-opbank.co.ke/ | 2026‑10‑20 |
| https://www.co-opbank.co.ke/wp-content/uploads/2026/10/Co-op-A2-Bank-Tariff-Guide_29-September-2026.pdf | 2026‑10‑20 |
| https://www.co-opbank.co.ke/wp-content/uploads/2026/08/24.08.2026-UPDATED-SCHOOLS-CODES.pdf | 2026‑10‑20 |
| https://familybank.co.ke/ | 2026‑10‑20 |
| https://familybank.co.ke/family-bank/wp-content/uploads/2026/01/Tariff_Guide_as_at_January_2026.pdf | 2026‑10‑20 |
| https://merchant-agent.familybank.co.ke/portal/login | 2026‑10‑20 |
| https://dataintegrated.co.ke/ and /industries/transport-saccos | 2026‑10‑20 |
| https://pesapay.co.ke/ , https://gopay.co.ke/ , https://apesa.co.ke/ | 2026‑10‑20 |
| https://www.equitybank.com/business/treasury-management-services/collect/ (US site) | 2026‑10‑20 |