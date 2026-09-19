import { Contribution, Settings } from './types';
import { fineForLateMonth } from './arrears';

/**
 * Allocation of a single lump-sum "catch-up" payment across a member's unpaid
 * months, oldest first.
 *
 * A month settled late costs its dues plus the constitutional late fine, so a
 * payment that covers the dues but not the fine settles the dues and leaves
 * the fine outstanding (finePaid false) rather than silently clearing it.
 */
export interface CatchUpLine {
  contributionId: string;
  month: string;
  dues: number;
  fine: number;
  /** 'full' = dues and fine settled, 'duesOnly' = fine still owed. */
  settled: 'full' | 'duesOnly';
}

export interface CatchUpPlan {
  lines: CatchUpLine[];
  applied: number;
  leftover: number;
  stillOwed: number;
}

/**
 * Work out how `payment` should be spread over `contributions` (one member's).
 * Pure — callers write the result. Months are settled oldest first; allocation
 * stops at the first month the remainder cannot even cover the dues for, so a
 * leftover is never silently absorbed.
 */
export function planCatchUp(
  contributions: Contribution[],
  payment: number,
  settings: Settings,
): CatchUpPlan {
  const outstanding = contributions
    .filter(c => c.purpose === 'monthly' && c.status !== 'Paid')
    .sort((a, b) => a.month.localeCompare(b.month));

  const lines: CatchUpLine[] = [];
  let remaining = payment;

  for (const c of outstanding) {
    const fine = fineForLateMonth(c, settings);
    if (remaining >= c.amount + fine) {
      lines.push({ contributionId: c.id, month: c.month, dues: c.amount, fine, settled: 'full' });
      remaining -= c.amount + fine;
    } else if (remaining >= c.amount) {
      lines.push({ contributionId: c.id, month: c.month, dues: c.amount, fine, settled: 'duesOnly' });
      remaining -= c.amount;
      break; // the fine is unpaid, so nothing after this month can be settled
    } else {
      break;
    }
  }

  const stillOwed =
    outstanding
      .filter(c => !lines.some(l => l.contributionId === c.id))
      .reduce((s, c) => s + c.amount + fineForLateMonth(c, settings), 0)
    + lines.filter(l => l.settled === 'duesOnly').reduce((s, l) => s + l.fine, 0);

  return { lines, applied: payment - remaining, leftover: remaining, stillOwed };
}
