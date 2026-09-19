import { Expense, BankTransaction, Contribution, Investment, Settings } from './types';
import { agmCycleStartMonth, lastAgmDate } from './groupYear';

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
  agmAccrued: number;        // meeting-fee share earned this AGM cycle
  agmSpentThisCycle: number; // AGM Party spending since the last AGM
  agmCycleStart: string;     // 'YYYY-MM' the cycle began
  agmOutstanding: number;    // still owed on unpaid months in this cycle

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
  // A member can settle the dues and leave the fine, so only count a fine as
  // money in the bank when it was actually paid (finePaid). hydrateContribution
  // defaults older records to the previous all-or-nothing behaviour.
  const totalContributionsCollected = paidContributions.reduce(
    (s, c) => s + c.amount + (c.finePaid ? c.fineAmount : 0), 0
  );

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

  // Ring-fenced AGM Party Fund. The meeting fee is not billed separately — it
  // is the meetingFee share carried inside each monthly contribution (e.g. 100
  // of every 600). So each PAID monthly contribution contributes one meeting
  // fee, alongside any explicitly-billed meetingFee record.
  //
  // The fund runs in cycles: it accrues from one AGM and is spent at the next,
  // so only this cycle's months and this cycle's spending count. Informational
  // subset of bankBalance/cashOnHand — not additive to totalGroupFunds.
  const agmCycleStart = agmCycleStartMonth(settings.agmDate);
  const lastAgm = lastAgmDate(settings.agmDate);

  const agmAccrued =
    paidContributions.filter(c => c.purpose === 'monthly' && c.month >= agmCycleStart).length * settings.meetingFee
    + paidContributions
        .filter(c => c.purpose === 'meetingFee' && c.month >= agmCycleStart)
        .reduce((s, c) => s + c.amount + c.fineAmount, 0);

  const agmSpentThisCycle = activeExpenses
    .filter(e => e.category === 'AGM Party' && e.date > lastAgm)
    .reduce((s, e) => s + e.amount, 0);

  // Meeting fees still to come from months already billed but not yet paid.
  const agmOutstanding = contributions
    .filter(c => c.purpose === 'monthly' && c.status !== 'Paid' && c.month >= agmCycleStart)
    .length * settings.meetingFee;

  const agmFundBalance = settings.openingAgmFundBalance + agmAccrued - agmSpentThisCycle;

  return {
    cashOnHand,
    bankBalance,
    investmentsValue,
    totalGroupFunds,
    agmFundBalance,
    agmAccrued,
    agmSpentThisCycle,
    agmCycleStart,
    agmOutstanding,
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
