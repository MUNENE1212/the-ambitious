import { Expense, BankTransaction, Contribution, Investment, Settings } from './types';

export interface FinancialInputs {
  contributions: Contribution[];
  expenses: Expense[];
  bankTransactions: BankTransaction[];
  investments: Investment[];
  settings: Settings;
}

export interface FinancialSummary {
  cashOnHand: number;
  bankBalance: number;
  investmentsValue: number;
  totalGroupFunds: number;

  // Ring-fenced view — informational only, already included in bankBalance above
  agmFundBalance: number;

  totalContributionsCollected: number; // dues + fines, paid only
  totalExpenses: number;
  netIncome: number;

  totalDeposits: number;
  totalWithdrawals: number;

  unseenExpensesCount: number;
  unseenWithdrawalsCount: number;
}

export function calculateFinancials(inputs: FinancialInputs): FinancialSummary {
  const { contributions, expenses, bankTransactions, investments, settings } = inputs;

  // Every paid contribution (monthly dues, meeting fees, entry fees) is
  // banked by the treasurer per the constitution — it lands in bankBalance.
  const paidContributions = contributions.filter(c => c.status === 'Paid');
  const totalContributionsCollected = paidContributions.reduce((s, c) => s + c.amount + c.fineAmount, 0);

  const activeExpenses = expenses.filter(e => e.status !== 'rejected');
  const totalExpenses = activeExpenses.reduce((s, e) => s + e.amount, 0);
  const cashExpenses = activeExpenses.filter(e => e.paymentMethod === 'Cash').reduce((s, e) => s + e.amount, 0);
  const mpesaExpenses = activeExpenses.filter(e => e.paymentMethod === 'Mpesa').reduce((s, e) => s + e.amount, 0);

  const totalDeposits = bankTransactions.filter(t => t.type === 'deposit').reduce((s, t) => s + t.amount, 0);
  const totalWithdrawals = bankTransactions.filter(t => t.type === 'withdrawal').reduce((s, t) => s + t.amount, 0);

  const cashOnHand = settings.openingCashBalance
    + totalWithdrawals   // bank-to-cash
    - cashExpenses
    - totalDeposits;      // cash-to-bank

  const bankBalance = settings.openingBankBalance
    + totalContributionsCollected
    + totalDeposits       // cash-to-bank
    - mpesaExpenses
    - totalWithdrawals;   // bank-to-cash

  const investmentsValue = investments
    .filter(i => i.status !== 'closed')
    .reduce((s, i) => s + i.amountInvested, 0);

  const totalGroupFunds = cashOnHand + bankBalance + investmentsValue;

  const netIncome = totalContributionsCollected - totalExpenses;

  // Ring-fenced AGM Party Fund: meeting-fee contributions collected, minus
  // whatever's been spent from the "AGM Party" expense category. Informational
  // subset of bankBalance/cashOnHand above — not additive to totalGroupFunds.
  const meetingFeeCollected = paidContributions
    .filter(c => c.purpose === 'meetingFee')
    .reduce((s, c) => s + c.amount + c.fineAmount, 0);
  const agmPartySpent = activeExpenses
    .filter(e => e.category === 'AGM Party')
    .reduce((s, e) => s + e.amount, 0);
  const agmFundBalance = settings.openingAgmFundBalance + meetingFeeCollected - agmPartySpent;

  return {
    cashOnHand,
    bankBalance,
    investmentsValue,
    totalGroupFunds,
    agmFundBalance,
    totalContributionsCollected,
    totalExpenses,
    netIncome,
    totalDeposits,
    totalWithdrawals,
    unseenExpensesCount: activeExpenses.filter(e => e.seenBy.length === 0).length,
    unseenWithdrawalsCount: bankTransactions.filter(t => t.type === 'withdrawal' && t.seenBy.length === 0).length,
  };
}

/** Format KES currency */
export function formatKES(amount: number): string {
  return `KES ${Math.round(amount).toLocaleString()}`;
}
