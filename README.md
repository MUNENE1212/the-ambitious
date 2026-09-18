# The Ambitious — Young & Ambitious Self Help Group

A mobile-first Progressive Web App for the Young & Ambitious Self Help Group's contributions, funds, investments, and forum. Built with Next.js 16, Firebase, and Tailwind CSS — scaffolded from the same architecture as the group's [kuku-egg-tracker](../zebray/kuku-egg-tracker) app.

See [`PLAN.md`](./PLAN.md) for the full product/technical blueprint this build follows.

## Features

- **Home** — animated funds hero, a "What's your idea?" composer, pinned leadership Announcements, and an unhidden feed of recent forum posts/replies
- **Contributions** — monthly dues grouped by group year (July–June) with per-year rates, a treasurer Ledger Entry screen for backfilling paper months, M-Pesa code submission + one-tap treasurer verification, automatic late-fine sweep (constitution: cutoff is the 5th of the following month), and automatic dues generation from the AGM month onward
- **Funds** — cash/bank/investments overview, Expenses, Bank transactions, the ring-fenced AGM Party Fund, and an Investments ledger
- **Forum** — Observation / Proposal / Opportunity / Question / Report / General / Announcement categories, with office-bearer title badges and leadership-only Announcements open to member comments
- **Meeting Minutes** — draft/official minutes, attendance capture, and a one-tap "Apply Absence Fines" action for the discipline master
- **Exit Requests** — member- or admin-initiated, auto-calculated refund breakdown, majority-vote approval, share-resale wait, then payout
- **Admin** — member management with interchangeable office-bearer titles, auto-invoiced entry fee on join
- **Settings** — every constitution figure (dues, fines, welfare payouts, exit deduction, AGM date) is admin-editable, not hard-coded
- **PWA** — installable, works offline for viewing

## Tech Stack

- **Next.js 16** (App Router), **TypeScript**, **Tailwind CSS v4**
- **Firebase** (Firestore for realtime data; phone + PIN auth, no Firebase Auth)
- **Recharts** for the funds trend chart
- **bcryptjs** for PIN hashing

Node 20 is required (`.nvmrc`) — the sandbox this was built in defaults to Node 18, so run `nvm use 20` first.

## Setup

### 1. Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Enable **Firestore Database** (start in test mode)
4. Go to Project Settings → General → Your apps → Add web app
5. Copy the Firebase config values

### 2. Environment Variables

```bash
cp .env.local.example .env.local
```

Fill in your Firebase credentials in `.env.local`.

### 3. Install & Run

```bash
nvm use 20
npm install
npm run dev
```

### 4. Seed Data

```bash
node scripts/seed-admin.mjs      # creates the first admin (phone +254700000000, PIN 1234) + default settings
node scripts/seed-members.mjs    # imports the real 13-member roster from APRIL2026.xlsx (placeholder phones, PIN 0000)
```

Change the admin credentials after first login, and have an admin fix each seeded member's real phone number and assign office-bearer titles from the Admin screen.

### 5. Import the Historical Ledgers (one-time)

```bash
node scripts/import-history.mjs --parse-only   # parse the xlsx files, no Firebase access — sanity check
node scripts/import-history.mjs                # dry-run against Firestore: matches names, skips duplicates, prints reconciliation
node scripts/import-history.mjs --write        # commit (add --emulator to target the local Firebase emulator instead)
```

Imports three years of contributions (FY 2023/24 → 2025/26 through April 2026) from the paper workbooks plus both expenses workbooks, preserving exact amounts and fines. The dry-run report explains the opening balances to enter in Settings (the pre-July-2023 position, including the paper ledger's own gaps).

### 6. Deploy Firestore Rules

```bash
npx firebase-tools deploy --only firestore:rules
```

## Launch Runbook (2026/27 kickoff)

1. **One-time VPS prep**: `mkdir -p /opt/the-ambitious` (CI deploys there, port 3005, PM2 app `the-ambitious`).
2. Seed admin + members; set real phone numbers and office-bearer titles from Admin.
3. Settings → set per-year contribution rates (2025/2026 and 2026/2027), confirm `autoDuesFrom` is `2026-10` (the AGM month), and enter opening balances from the import report's reconciliation line.
4. Run the ledger import (dry-run first, then `--write`).
5. Contributions → **Months → Ledger Entry**: enter and confirm May/June 2026 (the paper's blank months) and July–September 2026.
6. From **October 2026 (AGM)** the app runs itself: dues auto-generate on the first visit each month, and unpaid dues flip to `Late` with the constitutional fine after the 5th of the following month.

## Architecture

```
src/
├── app/                    # Next.js App Router pages
│   ├── page.tsx            # Login / root
│   ├── dashboard/          # Home
│   ├── contributions/      # Monthly dues & meeting fees
│   ├── funds/               # Overview, Expenses, Bank, AGM Fund, Investments
│   ├── forum/               # Discussion, proposals, opportunities, announcements
│   ├── minutes/             # Meeting minutes & attendance
│   ├── exit-requests/       # Refund breakdowns & committee votes
│   ├── more/                 # Menu for Minutes, Forum, Exit Requests, Settings, Admin
│   ├── settings/             # App settings (admin) — every constitution figure
│   ├── admin/                 # Member management (admin)
│   └── profile/                # Own profile, PIN change, request to exit
├── components/
│   ├── layout/              # AppShell, TopBar, BottomNav
│   ├── pages/                # Page-level components
│   └── ui/                   # Reusable UI components
├── lib/
│   ├── firebase.ts          # Firebase initialization
│   ├── types.ts              # TypeScript types
│   ├── constants.ts          # Constitution-derived defaults
│   ├── roles.ts               # Permission checks, incl. interchangeable deputy titles
│   ├── financial.ts           # Funds/AGM-fund/investment calculations
│   ├── verification.ts        # Majority-vote helpers (expenses, exits, withdrawals)
│   ├── fines.ts                # Auto-fine cutoff/overdue logic
│   ├── exit.ts / exit-actions.ts  # Exit-request refund math + Firestore writes
│   ├── auth-context.tsx       # Auth provider (phone + PIN)
│   └── hooks.ts                # Firestore hooks
```

## Roles & Titles

| Permission | Admin | Office-bearer title | Member |
|---|---|---|---|
| Verify contribution payments | Yes | Treasurer (or Coordinator, its deputy) | No |
| Manage minutes / attendance | Yes | Secretary (or Vice Secretary) | No |
| Apply fines | Yes | Discipline Master | No |
| Post Announcements | Yes | Any office-bearer title | No |
| Record funds (bank/investments) | Yes | Treasurer (or Coordinator) | No |
| Vote on expenses / exit requests | Yes | Yes | Yes (active members) |
| Manage members / settings | Yes | No | No |

A member can hold more than one title — see `DEPUTY_OF` in `src/lib/roles.ts` for how deputies (vice-chair, vice-secretary, coordinator) inherit their principal's permissions.

## Financial Formulas

- **Cash on Hand** = opening cash + bank withdrawals − cash expenses − bank deposits
- **Bank Balance** = opening bank + contributions collected + bank deposits − M-Pesa expenses − bank withdrawals
- **Total Group Funds** = Cash on Hand + Bank Balance + Investments Value
- **AGM Party Fund** (informational subset of the above) = opening balance + meeting-fee contributions − "AGM Party" category expenses
