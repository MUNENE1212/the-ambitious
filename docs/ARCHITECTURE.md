# Architecture

The Ambitious is a mobile-first PWA for a Kenyan self-help group's
contributions, funds, investments, and governance. See [`../PLAN.md`](../PLAN.md)
for the product blueprint — most design decisions (rule engine, exit-request
flow, AGM Party Fund, interchangeable titles) trace back to a specific section
there.

## Shape of the app

A **client-side Firebase app** — there is no server-side data fetching. Every
page wraps its content in `<ClientLayout>` (AuthProvider + ToastProvider) and
`<AppShell>` (TopBar + BottomNav). Pages in `src/app/*/page.tsx` are thin
wrappers; the logic lives in `src/components/pages/*.tsx`. `/funds` uses
internal tabs (`funds-overview-tab`, `expenses-tab`, `bank-tab`,
`agm-fund-tab`, `investments-tab`).

- **Auth** — phone + 4-digit PIN verified against a bcrypt hash in the
  Firestore `members` collection. The session lives in localStorage for 30 days
  under `ambitious_session`. Firebase Auth is not used for login.
- **Realtime** — pages subscribe with `onSnapshot` directly.
- **Roles** — `admin`, `manager`, `member`, plus office-bearer `titles[]`
  (chairperson, viceChairperson, secretary, viceSecretary, treasurer,
  coordinator, disciplineMaster). Titles are *interchangeable, not exclusive*:
  a member may hold several, and the permission checks in `roles.ts` accept a
  title's deputy too (`DEPUTY_OF`). Firestore rules are permissive; role
  enforcement is client-side.

## Firestore collections

| Collection | Key fields | Notes |
|---|---|---|
| `members` | name, phone, role, titles[], secondary, representing?, active | No deletion allowed |
| `contributions` | memberId, purpose (monthly/meetingFee/entryFee), month, status, fineAmount | Monthly dues auto-generated; meeting fees fund the AGM Party Fund |
| `fines` | memberId, type, amount, waived | Unifies late-payment, absence, and welfare-arrears fines |
| `expenses` | date, category, amount | Categories: AGM Party / Welfare / Administration / Investment / Other |
| `bankTransactions` | type (deposit/withdrawal), amount, proposalId? | Links to forum proposals |
| `investments` | title, amountInvested, status, proposalId? | Closed with `actualReturn` |
| `exitRequests` | memberId, initiatedBy, refundBreakdown, votes[], status | Majority-vote flow — PLAN.md Section I |
| `meetingMinutes` | agendaItems[], attendees[], meetingType, status | Feeds the discipline master's "Apply Absence Fines" action |
| `forumPosts` | title, body, category, authorTitles[], pinned | Announcements: leadership-only to post, open to all to comment |
| `config/settings` | every constitution figure | Fully admin-editable — `constants.ts` `DEFAULT_SETTINGS` holds the seeded defaults |

## Financial formulas

- **Cash on Hand** = opening cash + bank withdrawals − cash expenses − bank deposits
- **Bank Balance** = opening bank + contributions collected + bank deposits − M-Pesa expenses − bank withdrawals
- **Total Group Funds** = Cash on Hand + Bank Balance + Investments Value
- **AGM Party Fund** = opening balance + meeting-fee contributions − "AGM Party" expenses
  (an informational subset of the buckets above, not additive)

## Group year & contribution rates

The financial year runs **July–June** (`src/lib/groupYear.ts` —
`groupYearForMonth`, `rateFor`, …). Monthly rates are **per group year**
(`Settings.contributionRates['2025/2026'] = { primary, secondary }`), editable
in Settings; the legacy flat fields mirror the current year for back-compat.

From `Settings.autoDuesFrom` (the AGM month, `2026-10`) onward,
`src/lib/use-auto-dues.ts` generates the current month's dues on any logged-in
visit — deterministic doc IDs (`auto-<month>-<memberId>`) make it race-safe.
Earlier months are backfilled by the treasurer through Contributions →
**Months → Ledger Entry**: pre-automation unpaid months save as `Late` with the
fine as entered (the sweep can't touch them), while automation-era months save
as `Unpaid` so the sweep applies the constitutional fine past the cutoff.

## Auto-fining

`src/lib/fines.ts` decides whether a monthly contribution is overdue (unpaid or
pending past the `contributionCutoffDay`-th of the following month, default the
5th). `contributions.tsx` runs that sweep client-side on load and flips overdue
records to `Late` with the configured fine. Like dues generation, it fires when
any logged-in user opens the page rather than on a clock; moving both to a
scheduled Cloud Function is the natural next step if the group moves to
Firebase Blaze billing.

## Brand / theming

The UI is built on Tailwind's `amber-*` utilities. Rather than touching every
component, `globals.css` repaints the `amber` scale itself to the group's navy
identity through a Tailwind v4 `@theme` override, and adds a `gold-*` scale for
accents (title badges, AGM Party Fund, pinned Announcements). New UI should keep
using `amber-*` for primary/brand elements and `gold-*` for accents rather than
literal hex values.

## Constraints

- **No record deletion** — audit-trail requirement; Firestore rules deny
  `delete` on every collection.
- **Kenya locale** — +254 phone numbers, KES currency, no conversion.
- **No member loans in v1** — deliberately out of scope; see PLAN.md Sections F/N.
- **PWA** — service worker at `public/sw.js` (cache `ambitious-v1`, stamped
  `ambitious-<sha>` at deploy by `scripts/stamp-sw-cache.mjs`), manifest at
  `public/manifest.json`. Icons are navy/gold SVGs with a vector seedling in
  `public/icons/`; the PNGs are regenerated from the SVGs with sharp.
- **Phone normalization** — `0712…` → `+254712…`, `254712…` → `+254712…`.

## Known follow-ups

- Market-data (stocks / forex / crypto) integration is Phase 2 per PLAN.md
  Section G. NSE stock pricing has no confirmed free source yet.
- M-Pesa verification is manual code entry plus treasurer sign-off, not a Daraja
  API integration (deliberate — PLAN.md Section N).
- Dues generation and the fine sweep are client-side; a scheduled Cloud Function
  would make them clock-driven, which needs Firebase Blaze billing.
