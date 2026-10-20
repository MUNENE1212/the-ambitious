import { describe, it, expect } from 'vitest';
import { planCatchUp } from '../catchup';
import { makeContribution, makeSettings } from './fixtures';

/**
 * A single lump-sum payment spread across a member's unpaid months, oldest
 * first. A month settled late costs dues + fine, so a payment that covers the
 * dues but not the fine settles the dues and leaves the fine owed.
 */
const settings = makeSettings({ lateContributionFine: 200 });

/** Three unpaid months at 600 dues, each carrying no fine of its own (so the
 *  constitutional 200 applies when settling). */
function threeUnpaidMonths() {
  return [
    makeContribution({ purpose: 'monthly', month: '2026-07', status: 'Unpaid', amount: 600, fineAmount: 0 }),
    makeContribution({ purpose: 'monthly', month: '2026-08', status: 'Unpaid', amount: 600, fineAmount: 0 }),
    makeContribution({ purpose: 'monthly', month: '2026-09', status: 'Unpaid', amount: 600, fineAmount: 0 }),
  ];
}

describe('planCatchUp', () => {
  it('settles whole months oldest-first while the money covers dues and fine', () => {
    const plan = planCatchUp(threeUnpaidMonths(), 1700, settings);

    expect(plan.lines).toHaveLength(2);
    expect(plan.lines[0]).toMatchObject({ month: '2026-07', settled: 'full' });
    expect(plan.lines[1]).toMatchObject({ month: '2026-08', settled: 'full' });
    expect(plan.applied).toBe(1600);
    expect(plan.leftover).toBe(100);
  });

  it('settles the dues but leaves the fine outstanding when the money runs short', () => {
    const plan = planCatchUp(threeUnpaidMonths(), 600, settings);

    expect(plan.lines).toHaveLength(1);
    expect(plan.lines[0]).toMatchObject({ month: '2026-07', dues: 600, fine: 200, settled: 'duesOnly' });
    expect(plan.applied).toBe(600);
    expect(plan.leftover).toBe(0);
  });

  it('stops at the first month it cannot cover, rather than absorbing a shortfall', () => {
    const plan = planCatchUp(threeUnpaidMonths(), 1000, settings);

    // 1000 covers July fully (800), but not August's 800 — and 200 left is not
    // silently applied to August's dues.
    expect(plan.lines.map(l => l.month)).toEqual(['2026-07']);
    expect(plan.leftover).toBe(200);
  });

  it('reports everything still owed, including the unsettled fine on a dues-only month', () => {
    const plan = planCatchUp(threeUnpaidMonths(), 600, settings);

    // August and September untouched (800 + 800) plus July's outstanding fine.
    expect(plan.stillOwed).toBe(1800);
  });

  it('applies nothing when the payment cannot cover a single month of dues', () => {
    const plan = planCatchUp(threeUnpaidMonths(), 500, settings);

    expect(plan.lines).toEqual([]);
    expect(plan.applied).toBe(0);
    expect(plan.leftover).toBe(500);
    expect(plan.stillOwed).toBe(2400);
  });

  it('ignores months that are already paid', () => {
    const records = [
      makeContribution({ purpose: 'monthly', month: '2026-07', status: 'Paid', amount: 600, fineAmount: 0 }),
      ...threeUnpaidMonths().slice(1),
    ];
    const plan = planCatchUp(records, 800, settings);

    expect(plan.lines.map(l => l.month)).toEqual(['2026-08']);
  });

  it('ignores non-monthly charges when allocating', () => {
    const records = [
      makeContribution({ purpose: 'meetingFee', month: '2026-07', status: 'Unpaid', amount: 100 }),
      ...threeUnpaidMonths(),
    ];
    const plan = planCatchUp(records, 800, settings);

    expect(plan.lines.map(l => l.month)).toEqual(['2026-07']);
  });

  it('settles a month whose fine is already recorded at the recorded amount', () => {
    const records = [
      makeContribution({ purpose: 'monthly', month: '2026-07', status: 'Late', amount: 600, fineAmount: 200 }),
      makeContribution({ purpose: 'monthly', month: '2026-08', status: 'Late', amount: 600, fineAmount: 200 }),
    ];
    const plan = planCatchUp(records, 800, settings);

    expect(plan.lines).toHaveLength(1);
    expect(plan.lines[0]).toMatchObject({ month: '2026-07', settled: 'full', fine: 200 });
  });

  it('handles a payment larger than the total owed without going negative', () => {
    const plan = planCatchUp(threeUnpaidMonths(), 5000, settings);

    expect(plan.lines).toHaveLength(3);
    expect(plan.applied).toBe(2400);
    expect(plan.leftover).toBe(2600);
    expect(plan.stillOwed).toBe(0);
  });

  it('returns an empty plan when there is nothing outstanding', () => {
    const plan = planCatchUp([], 1000, settings);

    expect(plan.lines).toEqual([]);
    expect(plan.applied).toBe(0);
    expect(plan.stillOwed).toBe(0);
  });
});