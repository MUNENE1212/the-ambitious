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

/** True if a monthly contribution is still unpaid/unverified past its cutoff. */
export function isContributionOverdue(c: Contribution, cutoffDay: number, now: Date = new Date()): boolean {
  if (c.purpose !== 'monthly') return false;
  if (c.status !== 'Unpaid' && c.status !== 'Pending') return false;
  return now > contributionCutoffDate(c.month, cutoffDay);
}

/** Sweep a set of contributions and return the ones that should flip to Late. */
export function findOverdueContributions(contributions: Contribution[], cutoffDay: number, now: Date = new Date()): Contribution[] {
  return contributions.filter(c => isContributionOverdue(c, cutoffDay, now));
}
