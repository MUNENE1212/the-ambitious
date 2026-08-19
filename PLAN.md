# The Ambitious — Platform Blueprint

Product & technical plan for the **Young & Ambitious Self Help Group** member investment PWA.

- **Prepared:** 19 Aug 2026
- **Source rules:** Y&A Constitution (`Y & A- CONSTITUION.pdf`)
- **Source ledger:** `APRIL2026.xlsx`, FY Jul–Jun
- **Reference build:** [`kuku-egg-tracker`](/media/munen/muneneENT/2026/zebray/kuku-egg-tracker) (Next.js + Firebase PWA)
- **Status:** Plan only — no implementation started
- **Published version:** https://claude.ai/code/artifact/3e6733d7-842d-432f-90a8-518f80f29275

---

## A. Purpose & scope

Young & Ambitious runs on WhatsApp reminders and monthly Excel sheets today — thirteen members, a fiscal year of July–June, contribution totals hand-carried forward month to month. The constitution already defines the rules precisely; the app's job is to **execute those rules automatically** and make the group's finances visible to every member, every day, not just at the AGM.

- **Keep** — every rule in the constitution, as configurable defaults an admin can tune without redeploying code — amounts, deadlines, welfare payouts.
- **Add** — self-serve login and contribution history, automatic fine calculation, live funds/investment tracking, and a curated feed of external opportunities.
- **Reuse** — the architecture, auth pattern, verification-by-vote model, and financial-formula approach already proven in the Kuku Egg Tracker build.

---

## B. Navigation map

Five bottom-nav destinations on mobile, same shell pattern as the reference app (TopBar + BottomNav around a client-side Firebase page).

| Tab | Purpose |
|---|---|
| **Home** | Animated overview: group funds, this member's contribution status, countdown to next meeting/AGM, live activity feed. See Section C. |
| **Contributions** | This member's month-by-month ledger (mirrors the existing xlsx grid), fine breakdown, M-Pesa code submission for the current month. |
| **Funds** | Group-wide cash + bank balances, loans, investments and expenses. Tabs: Overview / Loans / Investments / Expenses. |
| **Forum** | Discussion, proposals, and investment ideas — including the curated Opportunities feed as a pinned category. |
| **More** | Meeting minutes, member directory, my profile, settings (admin), and the constitution itself as an in-app reference. |

---

## C. Home page experience

This is the page the brief asks to be "richly shared and animated" — it has to answer, at a glance and without navigating anywhere: how healthy are our funds, am I in good standing, and what just happened.

**What makes it feel alive:**

- **Count-up numbers** on the hero balance and stat tiles when the page mounts, not on every re-render — respects `prefers-reduced-motion`.
- **"What's your idea?" composer, right on Home** — a one-line input that posts straight to the forum (defaults to the Proposal category); no separate "new post" screen required to float an idea.
- **Recent posts & replies, unhidden** — the last few forum posts and their latest replies render directly on Home, not tucked away in the Forum tab. Nothing the group discusses should need a second tap to find.
- **A real-time activity feed** sourced from the same audit trail every module already writes (contribution verified, fine applied, expense recorded, forum post) — no separate "activity" system to maintain.
- **A standing indicator** that's honest, not decorative: green only when this member's current-month contribution is verified and no unpaid fines exist.
- **A funds trend sparkline** (Recharts, as in the reference app) showing the last 6 months of total group funds — makes growth (the group's whole purpose) visible without a tap.
- **Member spotlight** — small, non-competitive: e.g. "Cecilia has a 14-month clean streak," pulled from real data, not manufactured gamification.

Illustrative hero: `Total Group Funds · live — KES 231,450`, stat tiles for `My Status`, `My Fines (FY)`, `Next AGM`; any pinned leadership **Announcement** at the top; a `💡 What's your idea?` composer; then a feed of recent posts/replies and events (verifications, auto-fines, new proposals) interleaved by recency.

---

## D. Roles & permissions

The constitution already defines nine office-bearer roles (Section C). Map them directly onto the reference app's `admin / manager / member` role field plus a `titles[]` array — the same pattern `roles.ts` already uses for treasurer.

| Constitution office | App role | Extra permissions unlocked |
|---|---|---|
| Chairperson / Vice-chairperson | `admin` | Full settings access, member management, signatory on withdrawals |
| Treasurer | `admin` + title | Verify contributions, record deposits/withdrawals, signatory |
| Secretary / Vice-secretary | `manager` + title | Create & finalize meeting minutes, mark attendance |
| Discipline master | `manager` + title | Apply / waive fines, record excused absences, view fines ledger |
| Coordinator | `manager` | Post events, manage the Opportunities feed drafts |
| Committee member | `member` | Standard member access + minutes visibility |
| Ordinary / secondary member | `member` | Own contribution history, vote/approve, forum, funds view |

Secondary (minor) members log in under their adult representative's account per the constitution's binding clause — the representative's profile carries a `representing: memberId` link rather than a separate login.

**Titles are interchangeable, not exclusive.** The constitution pairs several offices as deputies — vice-chairperson stands in for chairperson, vice-secretary for secretary, coordinator deputizes the treasurer — so a member's `titles[]` can hold more than one entry, and permission checks look at *any* title that grants an action rather than a single fixed owner. Whichever title(s) a member holds render as small badges wherever they post — forum posts, replies, announcements, and contribution-verification stamps all show "Treasurer," "Secretary," etc. next to the name.

---

## E. Contribution verification & automatic fining

The heart of the request: "simple verification procedures... with automatic fining and rule implementation." Extends the reference app's `Contribution` model (already has `mpesaCode`, `fineAmount`, `verifiedBy`, `status`) with a scheduled rule engine.

**Flow:**

1. **Record generated** — On the 1st of each month, a Cloud Function creates a `Pending` contribution record for every active member, amount pulled from Settings (500, or 900 for a secondary member).
2. **Member pays & submits** — Member pays via M-Pesa and enters the transaction code in-app. Status moves to `Submitted` — visible to the treasurer, not yet counted as verified funds.
3. **Treasurer verifies** — One tap: match the code against the till statement, mark `Paid`. This is the "simple verification" — one approver, one action, fully logged (`verifiedBy`, `verifiedAt`), no committee vote needed for routine contributions.
4. **Deadline check (automatic)** — A scheduled function compares the cutoff — **the 5th of the following month** (e.g. July's contribution is due by 5 August), configurable in Settings — against submission time. Anything still `Pending` after the cutoff flips to `Late` and a fine is stamped automatically from Settings — no admin action required.
5. **Fine settles with the next payment** — Outstanding `fineAmount` rolls forward and must clear before a member's status shows green again — matching how the real ledger already carries fines in their own column next to each month's contribution.

**Rule engine — defaults seeded from the constitution, all editable in Settings:**

| Rule | Default (KES) | Trigger |
|---|---:|---|
| Entry fee (murangano) | 5,000 | New member joins — nonrefundable, plus back-contributions owed |
| Monthly contribution — primary member | 500 | Auto-generated 1st of each month |
| Monthly contribution — secondary (minor) member | 900 | Auto-generated 1st of each month |
| Meeting fee (AGM party fund) | 100 | Every meeting, physical or virtual — no refreshments purchased; ring-fenced toward the October AGM party |
| Late payment fine | 200 | Contribution unpaid by the 5th of the following month |
| Virtual meeting absence | 500 | Unmarked as attended, no prior excuse logged |
| AGM absence | 3,000 | Not marked present on 20 Oct AGM |
| Welfare — parent's death | 500 / member | Discipline master or admin logs a welfare event |
| Welfare — nuclear family death | 1,000 / member | Welfare event, deducted from arrears/shares if unpaid |
| Welfare — member's death | 2,000 / member | Welfare event |
| Exit deduction | 20% | Voluntary exit, applied to refunded share value |

**Three-strikes rule, encoded not just documented:** the constitution auto-terminates membership after three consecutive unexcused meeting absences. The attendance module counts consecutive misses per member and raises a flag to admins at strike two, and a required committee confirmation step at strike three — the app assists the rule, a human still executes expulsion.

---

## F. Funds, loans & investments

The current spreadsheet already tracks *Total Contributions → Total Expense → Available Funds*. The app computes this live, the same way `financial.ts` derives cash-on-hand and bank balance in the reference app, extended with an Investments bucket.

- **Funds Overview** — Cash on hand + bank balance + investment value − outstanding loans = Total Group Funds. Formula shown transparently on the Funds tab, not just the final number, so members can audit it themselves.
- **Loans — deferred, not in v1** — The group has decided not to lend to members yet. Objective D of the constitution ("to secure loans from any financial institution") is about the group borrowing externally, not lending internally — that stays a future consideration, not built now.
- **Investments** — New ledger: what the group put money into, when, expected/actual return. Each entry can link to the forum proposal that approved it — the paper trail the group currently keeps only in meeting minutes.
- **Expenses** — Categorized, same voting-verification pattern as the reference app (a proposal-worthy spend needs sign-off from active members before it posts).
- **AGM Party Fund** — a ring-fenced bucket, not part of general funds. Every meeting's 100/member fee lands here instead of buying refreshments; the running balance is visible on the Funds tab year-round, spent down at the October AGM, then the cycle restarts.

---

## G. Opportunities feed — external data

You asked for "possible pulling of available data for possible innovations" — confirmed scope is **trading, forex, stocks, and crypto** market data. This is the least certain piece technically — costs and API access vary — so it's scoped as its own phase with a fallback that needs zero external accounts.

- **Phase 1 — no external dependency:** Coordinator/admin-curated postings — business ideas, SACCO offers, land/investment leads members bring manually. Ships with the forum, costs nothing, works immediately.
- **Phase 2 — live market feeds, researched open/free sources:**

  | Market | Recommended source | Notes |
  |---|---|---|
  | Crypto | [CoinGecko Keyless Public API](https://docs.coingecko.com/docs/keyless-public-api) | Free, no signup/key, 30 req/min, 17,000+ coins. Fine for a periodically-refreshed widget; not for high-frequency polling. |
  | Forex (KES) | [Central Bank of Kenya — Forex](https://www.centralbank.go.ke/forex/) | Official daily indicative rates, free, authoritative for a Kenyan group. No JSON API — needs a small server-side fetch/parse of the published page, refreshed once daily. |
  | Forex (backup) | [CurrencyExchangeTool.com](https://www.currencyexchangetool.com/api-docs) | Free REST API, no key, no signup, covers KES — smaller/less-established provider, worth a reliability check before relying on it. |
  | Stocks (NSE) | **Unresolved — no clean free official API.** Candidates: [NSE's own Data Services API](https://www.nse.co.ke/dataservices/api-specification-documents/) (likely requires registration/cost), [mystocks.africa's API](https://mystocks.africa/african-stock-market-api) (free sandbox key, production pricing to confirm), or an open-source scraper like [kwoshvick/NSE-Stock-Price-Crawler](https://github.com/kwoshvick/NSE-Stock-Price-Crawler) (unofficial, fragile to site changes). |

  Shown as a "Markets" widget alongside the Opportunities feed. Crypto and forex can ship as soon as Phase 2 starts; NSE stocks stay a manual/coordinator-curated line item until one of the above is vetted.

Either way, feed items land in the same `ForumCategory` pattern as existing posts (a new `Opportunity` category) — no separate content system.

---

## H. Forum, minutes & transparency

"Full interaction and transparency" reuses the reference app's strongest pattern almost unchanged: nothing gets deleted, everything gets seen-by tracking, and money-moving actions require peer approval.

- **Voting verification** — expenses, withdrawals and investments carry a `votes[]` array; majority of eligible active members (excluding the recorder) approves or rejects, exactly as `verification.ts` already implements.
- **Meeting minutes** — structured agenda items, draft until the secretary marks them Official (then locked), attendance captured here feeds the auto-fining absence rule directly.
- **Forum** — Observation / Proposal / Question / Report / General / *Opportunity* / *Announcement* categories; investment decisions get proposed and discussed here before a Funds entry is created. Nothing here is walled off behind the Forum tab — Home surfaces the newest posts, replies, and the idea composer directly (Section C).
- **Announcements** — a leadership-only posting category (any member holding an office-bearer title, per Section D) pinned above the regular feed on both Home and Forum. Open to comments from every member — leadership broadcasts, but the group can still respond, not a one-way notice board.
- **No deletion, ever** — same audit-trail constraint as the reference app's Firestore rules. For a group's money, an immutable record matters more than tidy history.

---

## I. Member lifecycle

The constitution's membership rules (max 20, entry fee, four exit paths) become explicit member states rather than tribal knowledge.

| Path | What the app does |
|---|---|
| **Join** | Admin creates profile → entry fee + any back-owed contributions auto-invoiced → account active once treasurer verifies entry fee payment. Group hard-caps at 20 active members. |
| **Exit request** | Either the member themselves or an admin can initiate. See the dedicated flow below. |
| **Expulsion / suspension** | Triggered by admin action or the auto-flagged three-absence rule (Section E); suspended accounts lock but retain read access to their own history; readmission requires a fee the committee sets per case. |
| **Death** | Admin transfers the account to a recorded next-of-kin contact, who chooses to continue membership or exit with full share value (no 20% deduction, per constitution). |

**Exit request flow (voluntary exit):**

1. **Request raised** — by the member themselves, or by an admin on the member's behalf (e.g. following up a verbal notice) — captured with a reason and date, starting the constitution's 3-month notice clock.
2. **Auto-calculated refund, shown in full** — the engine sums total contributions paid + welfare paid, subtracts outstanding fines/arrears and the constitutional 20% exit deduction, and shows every line item — not just the final number — so the exiting member and the committee see the same math.
3. **Majority vote** — the same eligible-active-member majority pattern used for expense/withdrawal verification (Section H), excluding the exiting member, must approve before the exit proceeds.
4. **Share resale wait** — per the constitution, actual payout still waits until the vacated share is resold to a replacement member; status shows "Approved — pending share resale" until then.
5. **Payout & closeout** — the treasurer marks the refund paid once resold; the member's account moves to Exited, full history retained (no deletion, as everywhere else in the app).

---

## J. Data model

Firestore collections, extending the reference app's schema. **New collections marked NEW.**

| Collection | Key fields | Notes |
|---|---|---|
| `members` | name, phone, role, titles[], representing?, joinedAt, active | + `representing` for secondary-member links |
| `contributions` | memberId, month, amount, fineAmount, status, mpesaCode, verifiedBy | Auto-generated monthly, as today |
| `fines` **NEW** | memberId, type, amount, reason, waivedBy?, createdAt | Unifies late-payment, absence & welfare-arrears fines in one ledger |
| `attendance` **NEW** | meetingId, memberId, present, excused, consecutiveMisses | Drives the three-strikes rule |
| `investments` **NEW** | title, amountInvested, expectedReturn, actualReturn, proposalId, status | Linked to forum proposal |
| `exitRequests` **NEW** | memberId, initiatedBy (member\|admin), reason, refundBreakdown{contributions, welfare, arrears, deduction20pct, netRefund}, votes[], status | Drives Section I's exit-request flow |
| `loans` | borrowerName, principal, interestRate, repayments[] | Present in schema, **unused in v1** — no member loans yet |
| `bankTransactions` | type, amount, proposalId?, approvals[] | Reused as-is |
| `expenses` | category, amount, votes[], seenBy[] | Reused as-is |
| `forumPosts` | title, body, category (+ Opportunity, Announcement), authorTitles[], replies[], pinned? | Two categories added; `authorTitles` renders the badge, `pinned` lifts Announcements above the feed |
| `meetingMinutes` | agendaItems[], attendees[], status | Reused; feeds attendance |
| `config/settings` | all rule amounts from Section E, cutoff dates, member cap | Fully admin-editable, no hard defaults |

---

## K. Technical architecture

Deliberately the same stack as `kuku-egg-tracker` — proven, free-tier-friendly, and it means real code (types, verification logic, financial formulas, auth flow) can be adapted rather than rebuilt.

- **Frontend** — Next.js (App Router) + TypeScript + Tailwind CSS. All pages client-rendered against Firestore `onSnapshot` listeners for realtime updates across every logged-in member's phone.
- **Backend** — Firebase: Firestore for data, phone + 4-digit PIN auth (bcrypt hash, same as reference), **Cloud Functions on a schedule** for the new piece — monthly record generation and the deadline/fining sweep (Section E) — the reference app has no scheduled functions yet, this is the one real backend addition.
- **PWA** — Installable manifest + service worker, offline-readable cached data, same icon/splash pattern as the reference app's `public/` setup.
- **Motion & charts** — Recharts for the funds trend and dashboards (already a dependency in the reference app); count-up numbers and reveal transitions via CSS/Framer Motion, gated by `prefers-reduced-motion`.

---

## L. Migrating existing records

The FY2025-26 sheet (`APRIL2026.xlsx`) already gives real seed data: 13 members, a running "Previous Total" of KES 125,250 carried in from prior years, KES 52,600 contributed so far this FY, KES 177,850 lifetime — and fine entries (KES 200 each) matching the constitution's late-payment rule exactly.

- A one-time import script reads each historical workbook (23-24, 24-25, and monthly 2025-26 sheets already on file) and writes one `contributions` record per member per month, preserving the real fine history instead of starting the ledger from zero.
- The "Previous Total" carry-forward becomes each member's `openingBalance`, exactly mirroring how `Settings.openingCashBalance` already seeds the reference app's financial calculations.
- The Expenses workbooks (`EXPENSES 2024-25`, etc.) import the same way into the `expenses` collection, marked `verified` since they predate the app.

---

## M. Rollout roadmap

1. **Foundation** — Scaffold from the reference app: auth, member profiles + roles, Settings with all constitution defaults editable, PWA shell, animated home page (Section C).
2. **Money core** — Contributions with M-Pesa code submission + treasurer verification, the scheduled auto-fining function, fines ledger, funds overview.
3. **Transparency layer** — Expenses/withdrawals with vote-verification, meeting minutes + attendance (wires into the three-strikes rule), forum.
4. **Growth layer** — Investments ledger, Opportunities feed (curated ideas first, then live stocks/forex/crypto market feeds once a provider is picked), historical data migration. Loans stay out of scope until the group decides to lend to members.
5. **Polish & launch** — Animation pass, admin walkthrough for the treasurer/secretary, seed real member accounts, retire the spreadsheet.

---

## N. Open decisions for the committee

**Decided since the first draft:**

- ~~Contribution cutoff date~~ → **5th of the following month** (Section E).
- ~~Internal peer loans~~ → **No member loans in v1**; deferred indefinitely (Section F).
- ~~M-Pesa integration depth~~ → **Manual code entry + treasurer verification**, matching current practice — no Daraja API push for now (Section E).
- Forum visibility → **surfaced on Home**, not confined to the Forum tab (Sections C, H).
- External data scope → **confirmed: trading, forex, stocks, crypto** (Section G).
- Roles → **interchangeable, not exclusive**; a member can hold multiple titles, and title badges show on every post (Section D).
- Leadership communication → **Announcements category**, leadership-only to post, open to all to comment (Section H).
- Crypto/forex data source → **CoinGecko keyless API + CBK's official forex page** (Section G) — both free, no signup.
- Meeting refreshments → **discontinued**; the 100/meeting fee now funds a ring-fenced AGM Party Fund instead (Sections E, F).
- Member exit → **either member or admin can initiate**, refund auto-calculated with a full line-item breakdown, and requires majority member approval before payout (Section I).

**Still open:**

- **NSE stock-price source** — no clean official free API confirmed (Section G table). Needs a decision between the NSE's own paid data-services API, mystocks.africa's commercial API, or maintaining an unofficial scraper — or simply deferring live NSE prices and keeping that line curator-updated for now.
