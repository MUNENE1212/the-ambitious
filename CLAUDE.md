# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

## Origin

Scaffolded from `../zebray/kuku-egg-tracker` (same architecture: Next.js + Firebase + phone/PIN auth). See [`PLAN.md`](./PLAN.md) for the full product/technical blueprint — read it before making structural changes, since most design decisions (rule engine, exit-request flow, AGM Party Fund, interchangeable titles) trace back to specific sections there.

## Build & Dev Commands

```bash
nvm use 20    # Node 20 required — this sandbox defaults to Node 18
npm run dev          # Start dev server (Next.js 16 with Turbopack)
npm run build        # Production build (TypeScript checked)
npm run lint         # ESLint
npm start            # Start production server
node scripts/seed-admin.mjs      # Seed first admin user (requires .env.local)
node scripts/seed-members.mjs    # Import the real member roster
node scripts/import-history.mjs  # Historical xlsx ledger import (--parse-only / --dry-run / --write / --emulator)
```

## Architecture

**Client-side Firebase app** — no server-side data fetching. Every page wraps content in `<ClientLayout>` (AuthProvider + ToastProvider) and `<AppShell>` (TopBar + BottomNav).

- **Auth**: Phone + 4-digit PIN verified against bcrypt hash in Firestore `members` collection. Session in localStorage (30 days, key `ambitious_session`). No Firebase Auth for login.
- **Realtime**: pages use `onSnapshot` listeners directly.
- **Roles**: `admin`, `manager`, `member`, plus office-bearer `titles[]` (chairperson, viceChairperson, secretary, viceSecretary, treasurer, coordinator, disciplineMaster). Titles are **interchangeable, not exclusive** — a member can hold several, and permission checks in `roles.ts` accept a title's deputy too (`DEPUTY_OF`). Firestore rules are permissive; role enforcement is client-side, same as the reference app.

### Firestore Collections

| Collection | Key Fields | Notes |
|---|---|---|
| `members` | name, phone, role, titles[], secondary, representing?, active | No deletion allowed |
| `contributions` | memberId, purpose (monthly/meetingFee/entryFee), month, status, fineAmount | Monthly dues auto-generated; meeting fees fund the AGM Party Fund |
| `fines` | memberId, type, amount, waived | Unifies late-payment, absence, and welfare-arrears fines |
| `expenses` | date, category, amount | Categories: AGM Party/Welfare/Administration/Investment/Other |
| `bankTransactions` | type (deposit/withdrawal), amount, proposalId? | Links to forum proposals |
| `investments` | title, amountInvested, status, proposalId? | Group's own investments, closed with actualReturn |
| `exitRequests` | memberId, initiatedBy, refundBreakdown, votes[], status | Majority-vote flow — see PLAN.md Section I |
| `meetingMinutes` | agendaItems[], attendees[], meetingType, status | Feeds the discipline master's "Apply Absence Fines" action |
| `forumPosts` | title, body, category (+ Announcement, Opportunity), authorTitles[], pinned | Announcements: leadership-only to post, open to all to comment |
| `config/settings` | every constitution figure | Fully admin-editable — see `constants.ts` `DEFAULT_SETTINGS` for the seeded defaults |

### Financial Formulas

- **Cash on Hand** = opening cash + bank withdrawals − cash expenses − bank deposits
- **Bank Balance** = opening bank + contributions collected + bank deposits − M-Pesa expenses − bank withdrawals
- **Total Group Funds** = Cash on Hand + Bank Balance + Investments Value
- **AGM Party Fund** = opening balance + meeting-fee contributions − "AGM Party" expenses (informational subset of the buckets above, not additive)

### Group Year & Contribution Rates

The financial year runs **July–June** (`src/lib/groupYear.ts` — `groupYearForMonth`, `rateFor`, etc.). Monthly contribution rates are **per group year** (`Settings.contributionRates['2025/2026'] = { primary, secondary }`), editable in Settings; the legacy flat fields mirror the current year for back-compat. From `Settings.autoDuesFrom` (the AGM month, '2026-10') onward, `src/lib/use-auto-dues.ts` auto-generates the current month's dues on any logged-in visit (deterministic doc IDs `auto-<month>-<memberId>` make it race-safe). Months before that are backfilled by the treasurer via the Contributions **Months → Ledger Entry** flow: pre-automation unpaid months are saved as `Late` with the fine as entered (the sweep can't touch them); automation-era months save as `Unpaid` and the sweep applies the constitutional fine past the cutoff.

### Auto-Fining

`src/lib/fines.ts` computes whether a monthly contribution is overdue (unpaid/pending past the `contributionCutoffDay`-th of the following month, default the 5th). `contributions.tsx` runs this sweep client-side on load and flips overdue records to `Late` with the configured fine — it fires whenever any logged-in user visits Contributions, not on a fixed clock. Same pattern as the dues auto-generation above; migrating both to a scheduled Cloud Function is the natural next step if the group ever moves to Firebase Blaze billing.

### Page → Component Mapping

Pages in `src/app/*/page.tsx` are thin wrappers; logic lives in `src/components/pages/*.tsx`. `/funds` uses internal tabs (`funds-overview-tab`, `expenses-tab`, `bank-tab`, `agm-fund-tab`, `investments-tab`).

### Brand / Theming

The whole UI is built on Tailwind's `amber-*` utility classes (inherited from the reference app). Rather than touching every component, `globals.css` repaints the `amber` scale itself to the group's navy identity via a Tailwind v4 `@theme` override, and adds a `gold-*` scale for accent use (title badges, AGM Party Fund, pinned Announcements). If you add new UI, keep using `amber-*` class names for primary/brand elements and `gold-*` for accent — don't reach for literal hex values.

## Key Constraints

- **No record deletion** — audit trail requirement. Firestore rules deny `delete` on every collection.
- **Kenya locale** — phone numbers +254, currency KES, no currency conversion.
- **No member loans in v1** — deliberately out of scope (group decision); don't add a loans module without checking `PLAN.md` Section F/N first.
- **PWA** — service worker at `public/sw.js` (cache name `ambitious-v1`, stamped `ambitious-<sha>` at deploy by `scripts/stamp-sw-cache.mjs`), manifest at `public/manifest.json`. Icons are navy/gold SVGs with a vector seedling in `public/icons/`; the PNGs (`icon-192.png`, `icon-512.png`, `apple-touch-icon.png`) are regenerated from the SVGs via sharp (`node -e "import('sharp')…"` — sharp ships with next) — regenerate them if the SVGs change.
- **Phone format normalization** — `0712...` → `+254712...`, `254712...` → `+254712...`.

## Environment Setup

Copy `.env.local.example` to `.env.local` and fill Firebase credentials. Without real credentials the app renders the login UI but Firebase operations fail.

## Known Follow-ups (not yet done)

- Market-data (stocks/forex/crypto) integration is Phase 2 per `PLAN.md` Section G — not built. NSE stock pricing specifically has no confirmed free source yet.
- M-Pesa verification is manual code entry + treasurer sign-off, not a Daraja API integration (deliberate — see PLAN.md Section N).
- Dues generation + fine sweep are client-side (any member visit triggers them). A scheduled Cloud Function would make them clock-driven — needs Firebase Blaze billing, deliberately deferred.
