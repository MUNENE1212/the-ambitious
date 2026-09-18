import { MemberTitle, Settings, ForumCategory, PaymentMethod } from './types';

export const DEFAULT_EXPENSE_CATEGORIES = [
  'AGM Party', 'Welfare', 'Administration', 'Investment', 'Other',
];

// Every figure below comes straight from the Y&A constitution. All of it is
// admin-editable in Settings — these are starting defaults, not hard limits.
export const DEFAULT_SETTINGS: Settings = {
  groupName: 'Young & Ambitious Self Help Group',
  groupShortName: 'Y&A',

  entryFee: 5000,
  monthlyContributionPrimary: 600,
  monthlyContributionSecondary: 900,
  contributionRates: {
    '2025/2026': { primary: 600, secondary: 900 },
    '2026/2027': { primary: 600, secondary: 900 },
  },
  meetingFee: 100,
  memberCap: 20,

  autoDuesFrom: '2026-10',
  contributionCutoffDay: 5,
  lateContributionFine: 200,
  virtualAbsenceFine: 500,
  agmAbsenceFine: 3000,

  welfareParentDeath: 500,
  welfareNuclearDeath: 1000,
  welfareMemberDeath: 2000,

  exitDeductionPct: 0.2,

  agmDate: '10-20',

  openingCashBalance: 0,
  openingBankBalance: 0,
  openingAgmFundBalance: 0,
  openingBalancesSet: false,

  expenseCategories: DEFAULT_EXPENSE_CATEGORIES,
};

export const ALL_TITLES: MemberTitle[] = [
  'chairperson', 'viceChairperson', 'secretary', 'viceSecretary',
  'treasurer', 'coordinator', 'disciplineMaster',
];

export const TITLE_LABELS: Record<MemberTitle, string> = {
  chairperson: 'Chairperson',
  viceChairperson: 'Vice Chairperson',
  secretary: 'Secretary',
  viceSecretary: 'Vice Secretary',
  treasurer: 'Treasurer',
  coordinator: 'Coordinator',
  disciplineMaster: 'Discipline Master',
};

export const FORUM_CATEGORIES: ForumCategory[] = [
  'Announcement', 'Proposal', 'Opportunity', 'Observation', 'Question', 'Report', 'General',
];

export const PAYMENT_METHODS: PaymentMethod[] = ['Cash', 'Mpesa'];
