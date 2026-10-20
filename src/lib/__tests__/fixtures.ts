import type {
  BankTransaction, Contribution, ContributionPurpose, ContributionStatus,
  Expense, Fine, Investment, Member, Settings,
} from '../types';
import { DEFAULT_SETTINGS } from '../constants';

/**
 * Builders for the characterisation suite. Each fills every required field with
 * an inert default so a test only states the attributes it actually cares
 * about — the point is to pin behaviour, not to restate the type.
 */

let seq = 0;
const nextId = () => `id-${++seq}`;

export function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return { ...DEFAULT_SETTINGS, ...overrides };
}

export function makeContribution(overrides: Partial<Contribution> = {}): Contribution {
  return {
    id: nextId(),
    memberId: 'm1',
    memberName: 'Member One',
    purpose: 'monthly' as ContributionPurpose,
    month: '2026-07',
    amount: 600,
    fineAmount: 0,
    status: 'Paid' as ContributionStatus,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

export function makeFine(overrides: Partial<Fine> = {}): Fine {
  return {
    id: nextId(),
    memberId: 'm1',
    memberName: 'Member One',
    type: 'virtualAbsence',
    amount: 500,
    reason: 'Absent',
    waived: false,
    createdBy: 'admin',
    createdByName: 'Admin',
    createdAt: 1,
    ...overrides,
  };
}

export function makeMember(overrides: Partial<Member> = {}): Member {
  return {
    id: 'm1',
    name: 'Member One',
    phone: '+254712000001',
    role: 'member',
    pinHash: '',
    mustChangePin: false,
    titles: [],
    secondary: false,
    failedAttempts: 0,
    lockedUntil: null,
    isLocked: false,
    active: true,
    joinedAt: '2023-07-01',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  } as Member;
}

export function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: nextId(),
    date: '2026-07-15',
    category: 'Administration',
    amount: 1000,
    notes: '',
    paymentMethod: 'Cash',
    status: 'verified',
    votes: [],
    seenBy: [],
    recordedBy: 'admin',
    recordedByName: 'Admin',
    createdAt: 1,
    ...overrides,
  };
}

export function makeBankTx(overrides: Partial<BankTransaction> = {}): BankTransaction {
  return {
    id: nextId(),
    type: 'deposit',
    amount: 5000,
    date: '2026-07-15',
    description: '',
    status: 'approved',
    approvals: [],
    seenBy: [],
    recordedBy: 'admin',
    recordedByName: 'Admin',
    createdAt: 1,
    ...overrides,
  };
}

export function makeInvestment(overrides: Partial<Investment> = {}): Investment {
  return {
    id: nextId(),
    title: 'Poultry co-investment',
    description: '',
    amountInvested: 100_000,
    status: 'active',
    recordedBy: 'admin',
    recordedByName: 'Admin',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}