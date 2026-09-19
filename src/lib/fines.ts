import { Contribution } from './types';

/**
 * A monthly contribution for `month` (YYYY-MM) is due by `cutoffDay` of the
 * FOLLOWING month — the constitution's flat "any form of lateness" rule,
 * applied here as the auto-fine trigger (Section E of the platform plan).
 */
export function contributionCutoffDate(month: string, cutoffDay: number): Date {
  const [year, m] = month.split('-').map(Number);
  // JS months are 0-indexed, so `m` (1-12) already points at the next month.
  return new Date(year, m - 1 + 1, cutoffDay);
}

/**
 * True if a monthly contribution is still unpaid/unverified past its cutoff.
 *
 * A 'Pending' record is judged on when the member submitted, not on the
 * current date: the money already arrived, and a treasurer who verifies a week
 * later must not turn an on-time payment into a late one. Records submitted
 * before submittedAt existed fall back to `now`, matching the old behaviour.
 */
export function isContributionOverdue(c: Contribution, cutoffDay: number, now: Date = new Date()): boolean {
  if (c.purpose !== 'monthly') return false;
  if (c.status !== 'Unpaid' && c.status !== 'Pending') return false;
  const asOf = c.status === 'Pending' && c.submittedAt ? new Date(c.submittedAt) : now;
  return asOf > contributionCutoffDate(c.month, cutoffDay);
}

/** Sweep a set of contributions and return the ones that should flip to Late. */
export function findOverdueContributions(contributions: Contribution[], cutoffDay: number, now: Date = new Date()): Contribution[] {
  return contributions.filter(c => isContributionOverdue(c, cutoffDay, now));
}

/**
 * What the sweep should write for one overdue record, or null to leave it be.
 *
 * A record already carrying the right fine is left alone so the sweep is
 * idempotent, and a 'Pending' record keeps that status: the member has
 * submitted and is waiting on a treasurer, so flipping it to 'Late' would drop
 * it out of the verification queue and penalise them for someone else's delay.
 * It still earns the fine — lateness is about when the money arrived.
 */
export function overdueUpdate(
  c: Contribution,
  fine: number,
): { status?: 'Late'; fineAmount: number; finePaid: false } | null {
  const needsFine = c.fineAmount !== fine;
  const needsStatus = c.status === 'Unpaid';
  if (!needsFine && !needsStatus) return null;
  return {
    ...(needsStatus ? { status: 'Late' as const } : {}),
    fineAmount: fine,
    finePaid: false,
  };
}
