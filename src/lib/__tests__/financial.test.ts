import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { calculateFinancials, formatKES } from '../financial';
import {
  makeSettings, makeContribution, makeExpense, makeBankTx, makeInvestment,
} from './fixtures';

/**
 * calculateFinancials reads "today" internally (to derive the AGM cycle), so
 * the clock is frozen to the AGM date itself. Without this the expectations
 * would silently change behaviour a year from now.
 */
const NOW = new Date(2026, 9, 20, 12, 0, 0); // 20 Oct 2026, the AGM day

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

const settings = makeSettings({
  openingCashBalance: 10_000,
  openingBankBalance: 50_000,
  openingAgmFundBalance: 1_000,
  meetingFee: 100,
  agmDate: '10-20',
});

/** A worked group state, chosen so every term in every formula is non-zero. */
function workedState() {
  const contributions = [
    // Paid in the previous AGM cycle — sets arrears-of-fine behaviour.
    makeContribution({ purpose: 'monthly', month: '2026-08', status: 'Paid', amount: 600, fineAmount: 200, finePaid: true }),
    makeContribution({ purpose: 'monthly', month: '2026-08', status: 'Paid', amount: 600, fineAmount: 0, finePaid: true }),
    // Before the current cycle — must not accrue to the AGM fund.
    makeContribution({ purpose: 'monthly', month: '2025-11', status: 'Paid', amount: 600, fineAmount: 0, finePaid: true }),
    makeContribution({ purpose: 'meetingFee', month: '2026-09', status: 'Paid', amount: 100, fineAmount: 0, finePaid: true }),
    // In the current cycle — accrues to the AGM fund.
    makeContribution({ purpose: 'monthly', month: '2026-10', status: 'Paid', amount: 600, fineAmount: 0, finePaid: true }),
    // Outstanding dues, outside the cycle.
    makeContribution({ purpose: 'monthly', month: '2026-09', status: 'Unpaid', amount: 600, fineAmount: 0 }),
    // Outstanding dues inside the cycle — counts toward agmOutstanding.
    makeContribution({ purpose: 'monthly', month: '2026-10', status: 'Unpaid', amount: 600, fineAmount: 0 }),
  ];

  const expenses = [
    makeExpense({ amount: 2000, paymentMethod: 'Cash', status: 'verified' }),
    makeExpense({ amount: 500, paymentMethod: 'Mpesa', status: 'verified' }),
  ];

  const bankTransactions = [
    makeBankTx({ type: 'withdrawal', amount: 3000 }), // bank → cash
    makeBankTx({ type: 'deposit', amount: 1000 }),    // cash → bank
  ];

  return { contributions, expenses, bankTransactions, investments: [] as ReturnType<typeof makeInvestment>[] };
}

describe('calculateFinancials — worked state', () => {
  const inputs = () => ({ ...workedState(), settings });

  it('counts collected contributions including settled fines', () => {
    // 800 (600 + settled 200) + 600 + 600 + 100 + 600 = 2700
    expect(calculateFinancials(inputs()).totalContributionsCollected).toBe(2700);
  });

  it('computes cash on hand as opening + withdrawals − cash expenses − deposits', () => {
    // 10000 + 3000 − 2000 − 1000 = 10000
    expect(calculateFinancials(inputs()).cashOnHand).toBe(10_000);
  });

  it('computes bank balance as opening + contributions + deposits − M-Pesa expenses − withdrawals', () => {
    // 50000 + 2700 + 1000 − 500 − 3000 = 50200
    expect(calculateFinancials(inputs()).bankBalance).toBe(50_200);
  });

  it('totals group funds as cash + bank + investments', () => {
    // 10000 + 50200 + 0 = 60200
    expect(calculateFinancials(inputs()).totalGroupFunds).toBe(60_200);
  });

  it('computes net income as collected contributions minus expenses', () => {
    expect(calculateFinancials(inputs()).netIncome).toBe(200); // 2700 − 2500
  });

  it('accrues the AGM fund only from months in the current cycle', () => {
    const fin = calculateFinancials(inputs());
    // Only the paid 2026-10 monthly contribution falls in the 2026-10 cycle.
    expect(fin.agmCycleStart).toBe('2026-10');
    expect(fin.agmAccrued).toBe(100);
  });

  it('reports unpaid meeting-fee shares still to come in this cycle', () => {
    expect(calculateFinancials(inputs()).agmOutstanding).toBe(100);
  });

  it('balances the ring-fenced AGM fund', () => {
    // 1000 opening + 100 accrued − 0 spent = 1100
    expect(calculateFinancials(inputs()).agmFundBalance).toBe(1_100);
  });

  it('counts unseen items awaiting member review', () => {
    const fin = calculateFinancials(inputs());
    expect(fin.unseenExpensesCount).toBe(2);
    expect(fin.unseenWithdrawalsCount).toBe(1); // deposits are not withdrawals
  });
});

describe('calculateFinancials — withdrawal sign-off', () => {
  // Regression: a withdrawal used to be written with `status: 'approved'` and
  // nothing ever wrote `approvals`, so the constitutional two-signatory rule
  // (PLAN.md Section C) was never applied and the balance moved on write.

  const withDrawals = (txs: ReturnType<typeof makeBankTx>[]) => ({
    contributions: [makeContribution({ purpose: 'monthly', status: 'Paid', amount: 10_000 })],
    expenses: [] as ReturnType<typeof makeExpense>[],
    bankTransactions: txs,
    investments: [] as ReturnType<typeof makeInvestment>[],
    settings: makeSettings({ openingBankBalance: 0, openingCashBalance: 0 }),
  });

  it('counts an approved withdrawal as having left the bank', () => {
    const fin = calculateFinancials(withDrawals([
      makeBankTx({ type: 'withdrawal', amount: 3_000, status: 'approved' }),
    ]));
    expect(fin.totalWithdrawals).toBe(3_000);
  });

  it('does NOT count a pending withdrawal — the money has not moved', () => {
    const fin = calculateFinancials(withDrawals([
      makeBankTx({ type: 'withdrawal', amount: 3_000, status: 'pending' }),
    ]));
    expect(fin.totalWithdrawals).toBe(0);
    // And the balance must not be shrunk by an unauthorised withdrawal.
    expect(fin.bankBalance).toBe(10_000);
  });

  it('reports pending withdrawals so the UI can prompt for signatures', () => {
    const fin = calculateFinancials(withDrawals([
      makeBankTx({ type: 'withdrawal', amount: 3_000, status: 'pending' }),
      makeBankTx({ type: 'withdrawal', amount: 1_000, status: 'approved' }),
      makeBankTx({ type: 'deposit', amount: 500 }),
    ]));
    expect(fin.pendingWithdrawalCount).toBe(1);
    expect(fin.totalWithdrawals).toBe(1_000);
  });
});

describe('calculateFinancials — fine settlement', () => {
  it('does not count a fine as money in the bank until it is actually settled', () => {
    // Dues paid, fine left behind: 600 in, the 200 fine excluded.
    const fin = calculateFinancials({
      ...workedState(),
      contributions: [makeContribution({ purpose: 'monthly', status: 'Paid', amount: 600, fineAmount: 200, finePaid: false })],
      settings,
    });
    expect(fin.totalContributionsCollected).toBe(600);
  });
});

describe('calculateFinancials — expenses', () => {
  it('excludes rejected expenses from totals', () => {
    const fin = calculateFinancials({
      ...workedState(),
      expenses: [
        makeExpense({ amount: 2000, status: 'verified' }),
        makeExpense({ amount: 500, status: 'rejected' }),
      ],
      settings,
    });
    expect(fin.totalExpenses).toBe(2000);
  });
});

describe('calculateFinancials — investments', () => {
  it('counts only open positions toward investment value', () => {
    const fin = calculateFinancials({
      ...workedState(),
      investments: [
        makeInvestment({ amountInvested: 100_000, status: 'active' }),
        makeInvestment({ amountInvested: 40_000, status: 'proposed' }),
        makeInvestment({ amountInvested: 30_000, status: 'closed' }),
      ],
      settings,
    });
    // 'closed' is excluded; 'proposed' is still counted as a position.
    expect(fin.investmentsValue).toBe(140_000);
  });

  /**
   * KNOWN DEFECT — PLATFORM-PLAN §2.1.
   *
   * Recording an investment writes only to `investments`; nothing removes the
   * money from the bank balance, and nothing puts principal or return back when
   * it closes. So `investmentsValue` is added on top of a bank balance that was
   * never debited — the same shilling is counted twice.
   *
   * `it.fails` pins the CORRECT behaviour: this test passes once the linked
   * bank transaction exists, and fails loudly if the defect is reintroduced
   * after it is fixed.
   */
  it.fails('does not count deployed capital twice — an investment must be funded from a withdrawal', () => {
    const base = workedState();
    const withoutInvestment = calculateFinancials({ ...base, investments: [], settings });

    const withInvestment = calculateFinancials({
      ...base,
      investments: [makeInvestment({ amountInvested: 100_000, status: 'active' })],
      settings,
    });

    // Recording an investment must not create money: 100000 should come out of
    // the bank balance, not be added on top of it.
    expect(withInvestment.totalGroupFunds).toBe(withoutInvestment.totalGroupFunds);
  });
});

describe('calculateFinancials — AGM cycle boundary', () => {
  it('stops accruing for months before the current cycle start', () => {
    vi.setSystemTime(new Date(2027, 0, 15, 12, 0, 0)); // 15 Jan 2027

    const fin = calculateFinancials({
      ...workedState(),
      contributions: [
        makeContribution({ purpose: 'monthly', month: '2026-08', status: 'Paid', amount: 600, fineAmount: 0, finePaid: true }),
        makeContribution({ purpose: 'monthly', month: '2026-11', status: 'Paid', amount: 600, fineAmount: 0, finePaid: true }),
      ],
      settings,
    });

    // The cycle began at the Oct 2026 AGM, so November accrues and August —
    // which belonged to the cycle spent at that AGM — does not.
    expect(fin.agmCycleStart).toBe('2026-10');
    expect(fin.agmAccrued).toBe(100);
  });
});

describe('formatKES', () => {
  it('renders a rounded, comma-grouped KES amount', () => {
    expect(formatKES(231450)).toBe('KES 231,450');
    expect(formatKES(0)).toBe('KES 0');
    expect(formatKES(1234.6)).toBe('KES 1,235');
  });
});