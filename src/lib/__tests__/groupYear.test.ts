import { describe, it, expect } from 'vitest';
import {
  groupYearForMonth, currentGroupYear, monthsInGroupYear, groupYearStartKey,
  recentGroupYears, rateFor, groupYearLabel,
  lastAgmDate, nextAgmDate, agmCycleStartMonth,
} from '../groupYear';
import { makeSettings } from './fixtures';

/**
 * Characterisation tests. They pin the group's financial-year behaviour as it
 * stands today, so the ledger migration can be checked against an oracle rather
 * than against my own recollection. Expected values are written out literally.
 */
describe('groupYearForMonth', () => {
  it('treats July as the start of a new group year', () => {
    expect(groupYearForMonth('2026-07')).toBe('2026/2027');
    expect(groupYearForMonth('2026-10')).toBe('2026/2027');
    expect(groupYearForMonth('2026-12')).toBe('2026/2027');
  });

  it('treats January to June as the back half of the previous label', () => {
    expect(groupYearForMonth('2026-06')).toBe('2025/2026');
    expect(groupYearForMonth('2026-01')).toBe('2025/2026');
    expect(groupYearForMonth('2025-07')).toBe('2025/2026');
  });
});

describe('monthsInGroupYear', () => {
  it('spans July to June inclusive, twelve months', () => {
    const months = monthsInGroupYear('2025/2026');
    expect(months).toHaveLength(12);
    expect(months[0]).toBe('2025-07');
    expect(months[11]).toBe('2026-06');
  });

  it('rolls across the year boundary correctly', () => {
    expect(monthsInGroupYear('2026/2027')[0]).toBe('2026-07');
    expect(monthsInGroupYear('2026/2027')[11]).toBe('2027-06');
  });
});

describe('groupYearStartKey', () => {
  it('is the July of the labelling year', () => {
    expect(groupYearStartKey('2025/2026')).toBe('2025-07');
    expect(groupYearStartKey('2026/2027')).toBe('2026-07');
  });
});

describe('currentGroupYear', () => {
  it('derives the label from the supplied date', () => {
    expect(currentGroupYear(new Date(2026, 9, 20))).toBe('2026/2027');
    expect(currentGroupYear(new Date(2026, 5, 30))).toBe('2025/2026');
  });
});

describe('recentGroupYears', () => {
  it('offers the current year and the one before it, current first', () => {
    expect(recentGroupYears(new Date(2026, 9, 20))).toEqual(['2025/2026', '2026/2027']);
  });
});

describe('rateFor', () => {
  it('uses the per-group-year rate when one is set', () => {
    const settings = makeSettings({
      monthlyContributionPrimary: 600,
      monthlyContributionSecondary: 900,
      contributionRates: {
        '2025/2026': { primary: 500, secondary: 800 },
        '2026/2027': { primary: 600, secondary: 900 },
      },
    });
    expect(rateFor(settings, '2026-08')).toEqual({ primary: 600, secondary: 900 });
    expect(rateFor(settings, '2025-12')).toEqual({ primary: 500, secondary: 800 });
  });

  it('falls back to the legacy flat fields when a year has no entry', () => {
    const settings = makeSettings({
      monthlyContributionPrimary: 700,
      monthlyContributionSecondary: 1000,
      contributionRates: {},
    });
    expect(rateFor(settings, '2026-08')).toEqual({ primary: 700, secondary: 1000 });
  });
});

describe('groupYearLabel', () => {
  it('abbreviates the second year to two digits', () => {
    expect(groupYearLabel('2025/2026')).toBe('FY 2025/26');
    expect(groupYearLabel('2026/2027')).toBe('FY 2026/27');
  });
});

describe('AGM cycle dates', () => {
  it('treats the AGM day itself as the most recent AGM', () => {
    expect(lastAgmDate('10-20', new Date(2026, 9, 20))).toBe('2026-10-20');
  });

  it('still reports last year before the AGM day arrives', () => {
    expect(lastAgmDate('10-20', new Date(2026, 4, 1))).toBe('2025-10-20');
  });

  it('reports next year strictly after now', () => {
    expect(nextAgmDate('10-20', new Date(2026, 9, 21))).toBe('2027-10-20');
  });

  it('reports this year before the AGM day arrives', () => {
    expect(nextAgmDate('10-20', new Date(2026, 4, 1))).toBe('2026-10-20');
  });

  it('derives the cycle start month from the last AGM', () => {
    expect(agmCycleStartMonth('10-20', new Date(2026, 9, 20))).toBe('2026-10');
    expect(agmCycleStartMonth('10-20', new Date(2026, 4, 1))).toBe('2025-10');
  });
});