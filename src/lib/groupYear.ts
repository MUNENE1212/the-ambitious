import { format } from 'date-fns';
import { Settings } from './types';

/**
 * The group's financial year runs July–June (constitution + the paper ledgers).
 * A group year is labelled 'YYYY/YYYY' by its starting calendar year, e.g.
 * July 2025 – June 2026 is '2025/2026'.
 */

const JULY = 7; // 1-based month number

export function groupYearForMonth(month: string): string {
  const [year, m] = month.split('-').map(Number);
  const startYear = m >= JULY ? year : year - 1;
  return `${startYear}/${startYear + 1}`;
}

export function currentGroupYear(now: Date = new Date()): string {
  return groupYearForMonth(format(now, 'yyyy-MM'));
}

export function currentMonthKey(now: Date = new Date()): string {
  return format(now, 'yyyy-MM');
}

/** '2025/2026' → ['2025-07', '2025-08', … '2026-06'] */
export function monthsInGroupYear(label: string): string[] {
  const startYear = parseInt(label.split('/')[0], 10);
  const months: string[] = [];
  for (let offset = 0; offset < 12; offset++) {
    months.push(format(new Date(startYear, JULY - 1 + offset, 1), 'yyyy-MM'));
  }
  return months;
}

/** Month key of a group year's start ('2025/2026' → '2025-07') */
export function groupYearStartKey(label: string): string {
  return monthsInGroupYear(label)[0];
}

/** Group years worth showing in admin UIs: the two around the current one. */
export function recentGroupYears(now: Date = new Date()): string[] {
  const current = currentGroupYear(now);
  const startYear = parseInt(current.split('/')[0], 10);
  return [`${startYear - 1}/${startYear}`, current];
}

export interface YearRate {
  primary: number;
  secondary: number;
}

/**
 * Monthly contribution rate for a given month, from the per-group-year rates
 * map in Settings. Falls back to the legacy flat fields if no rate is set for
 * that year (e.g. a settings doc saved before year-scoped rates existed).
 */
export function rateFor(settings: Settings, month: string): YearRate {
  const rate = settings.contributionRates?.[groupYearForMonth(month)];
  if (rate) return rate;
  return {
    primary: settings.monthlyContributionPrimary,
    secondary: settings.monthlyContributionSecondary,
  };
}

/** Default display label, e.g. 'FY 2025/26' */
export function groupYearLabel(label: string): string {
  const [a, b] = label.split('/');
  return `FY ${a}/${b.slice(2)}`;
}

/**
 * The AGM runs on a fixed calendar day (Settings.agmDate, 'MM-DD'), so the
 * party fund accrues in cycles that start at one AGM and are spent at the next.
 * Returns the most recent AGM on or before `now`.
 */
export function lastAgmDate(agmDate: string, now: Date = new Date()): string {
  const [mm, dd] = agmDate.split('-').map(Number);
  const thisYear = new Date(now.getFullYear(), mm - 1, dd);
  const year = now >= thisYear ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

/** The next AGM strictly after `now`. */
export function nextAgmDate(agmDate: string, now: Date = new Date()): string {
  const [mm, dd] = agmDate.split('-').map(Number);
  const thisYear = new Date(now.getFullYear(), mm - 1, dd);
  const year = now >= thisYear ? now.getFullYear() + 1 : now.getFullYear();
  return `${year}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

/** First contribution month ('YYYY-MM') counted toward the current AGM cycle. */
export function agmCycleStartMonth(agmDate: string, now: Date = new Date()): string {
  return lastAgmDate(agmDate, now).slice(0, 7);
}
