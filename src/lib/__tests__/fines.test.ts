import { describe, it, expect } from 'vitest';
import {
  contributionCutoffDate, isContributionOverdue,
  findOverdueContributions, overdueUpdate,
} from '../fines';
import { makeContribution, makeSettings } from './fixtures';

const CUTOFF = 5; // the constitution's default: due by the 5th of the next month
const FINE = 200;

describe('contributionCutoffDate', () => {
  it("places the deadline at the END of the cutoff day of the FOLLOWING month", () => {
    const cutoff = contributionCutoffDate('2026-07', CUTOFF);
    expect(cutoff.getFullYear()).toBe(2026);
    expect(cutoff.getMonth()).toBe(7); // August, 0-indexed
    expect(cutoff.getDate()).toBe(5);
    expect(cutoff.getHours()).toBe(23);
    expect(cutoff.getMinutes()).toBe(59);
  });

  it('crosses the year boundary correctly for a June contribution', () => {
    const cutoff = contributionCutoffDate('2026-06', CUTOFF);
    expect(cutoff.getFullYear()).toBe(2026);
    expect(cutoff.getMonth()).toBe(6); // July
    expect(cutoff.getDate()).toBe(5);
  });

  it('handles December contributions rolling into January', () => {
    const cutoff = contributionCutoffDate('2026-12', CUTOFF);
    expect(cutoff.getFullYear()).toBe(2027);
    expect(cutoff.getMonth()).toBe(0);
  });
});

describe('isContributionOverdue', () => {
  const unpaid = (month = '2026-07') =>
    makeContribution({ purpose: 'monthly', month, status: 'Unpaid' });

  it('is not overdue before the cutoff', () => {
    expect(isContributionOverdue(unpaid(), CUTOFF, new Date(2026, 7, 3))).toBe(false);
  });

  it('is NOT overdue on the cutoff day itself — paying on the 5th is on time', () => {
    expect(isContributionOverdue(unpaid(), CUTOFF, new Date(2026, 7, 5, 10, 0))).toBe(false);
    expect(isContributionOverdue(unpaid(), CUTOFF, new Date(2026, 7, 5, 23, 59))).toBe(false);
  });

  it('is overdue from one minute past the cutoff day', () => {
    expect(isContributionOverdue(unpaid(), CUTOFF, new Date(2026, 7, 6, 0, 0))).toBe(true);
    expect(isContributionOverdue(unpaid(), CUTOFF, new Date(2026, 7, 20))).toBe(true);
  });

  it('ignores records that are already settled', () => {
    expect(isContributionOverdue(
      makeContribution({ purpose: 'monthly', month: '2026-07', status: 'Paid' }),
      CUTOFF, new Date(2026, 7, 20),
    )).toBe(false);
    // A Late record is already an outcome; the sweep must not touch it.
    expect(isContributionOverdue(
      makeContribution({ purpose: 'monthly', month: '2026-07', status: 'Late' }),
      CUTOFF, new Date(2026, 7, 20),
    )).toBe(false);
  });

  it('ignores charges that are not monthly dues', () => {
    expect(isContributionOverdue(
      makeContribution({ purpose: 'meetingFee', month: '2026-07', status: 'Unpaid' }),
      CUTOFF, new Date(2026, 7, 20),
    )).toBe(false);
  });

  it('judges a submitted payment on when the member submitted it, not on now', () => {
    // Submitted on the 3rd, verified late by the treasurer: NOT late.
    const earlySubmit = makeContribution({
      purpose: 'monthly', month: '2026-07', status: 'Pending',
      submittedAt: new Date(2026, 7, 3, 9, 0).getTime(),
    });
    expect(isContributionOverdue(earlySubmit, CUTOFF, new Date(2026, 7, 25))).toBe(false);

    // Submitted on the 10th: late, whatever the verification date.
    const lateSubmit = makeContribution({
      purpose: 'monthly', month: '2026-07', status: 'Pending',
      submittedAt: new Date(2026, 7, 10, 9, 0).getTime(),
    });
    expect(isContributionOverdue(lateSubmit, CUTOFF, new Date(2026, 7, 11))).toBe(true);
  });

  it('falls back to now for a Pending record with no submittedAt', () => {
    const noStamp = makeContribution({ purpose: 'monthly', month: '2026-07', status: 'Pending' });
    expect(isContributionOverdue(noStamp, CUTOFF, new Date(2026, 7, 20))).toBe(true);
  });
});

describe('overdueUpdate', () => {
  it('flips an Unpaid record to Late and stamps the fine', () => {
    const update = overdueUpdate(
      makeContribution({ purpose: 'monthly', month: '2026-07', status: 'Unpaid', fineAmount: 0 }),
      FINE,
    );
    expect(update).toEqual({ status: 'Late', fineAmount: 200, finePaid: false });
  });

  it('is idempotent — an already-Late record with the right fine is left alone', () => {
    const update = overdueUpdate(
      makeContribution({ purpose: 'monthly', month: '2026-07', status: 'Late', fineAmount: FINE }),
      FINE,
    );
    expect(update).toBeNull();
  });

  it('still writes the fine onto an already-Late record that has none', () => {
    const update = overdueUpdate(
      makeContribution({ purpose: 'monthly', month: '2026-07', status: 'Late', fineAmount: 0 }),
      FINE,
    );
    expect(update).toEqual({ fineAmount: 200, finePaid: false });
  });

  it('leaves a Pending record Pending — the member waits on the treasurer, not on a penalty', () => {
    const update = overdueUpdate(
      makeContribution({ purpose: 'monthly', month: '2026-07', status: 'Pending', fineAmount: 0 }),
      FINE,
    );
    // Earns the fine (lateness is about when the money arrived) but keeps
    // Pending so the verification queue does not drop it.
    expect(update).toEqual({ fineAmount: 200, finePaid: false });
    expect(update).not.toHaveProperty('status');
  });
});

describe('findOverdueContributions', () => {
  it('returns only the records that should flip, leaving the rest untouched', () => {
    const records = [
      makeContribution({ memberId: 'm1', purpose: 'monthly', month: '2026-07', status: 'Unpaid' }),
      makeContribution({ memberId: 'm2', purpose: 'monthly', month: '2026-07', status: 'Unpaid' }),
      makeContribution({ memberId: 'm3', purpose: 'monthly', month: '2026-07', status: 'Paid' }),
      makeContribution({ memberId: 'm4', purpose: 'monthly', month: '2026-08', status: 'Unpaid' }),
      makeContribution({ memberId: 'm5', purpose: 'meetingFee', month: '2026-07', status: 'Unpaid' }),
    ];
    const overdue = findOverdueContributions(records, CUTOFF, new Date(2026, 7, 20));

    // Both unpaid July dues; the paid July, the not-yet-due August
    // (cutoff 5 September), and the meeting fee are all left alone.
    expect(overdue).toHaveLength(2);
    expect(overdue.map(c => c.memberId).sort()).toEqual(['m1', 'm2']);
  });
});

describe('interaction with Settings', () => {
  it('honours a configured fine amount rather than a hard-coded one', () => {
    const settings = makeSettings({ lateContributionFine: 350 });
    const update = overdueUpdate(
      makeContribution({ purpose: 'monthly', month: '2026-07', status: 'Unpaid', fineAmount: 0 }),
      settings.lateContributionFine,
    );
    expect(update?.fineAmount).toBe(350);
  });
});