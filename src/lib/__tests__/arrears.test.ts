import { describe, it, expect } from 'vitest';
import {
  hasOutstandingFine, arrearsForMember, arrearsForAll, groupArrears, fineForLateMonth,
} from '../arrears';
import { makeContribution, makeFine, makeMember, makeSettings } from './fixtures';

describe('hasOutstandingFine', () => {
  it('is false when there is no fine at all', () => {
    expect(hasOutstandingFine(makeContribution({ fineAmount: 0 }))).toBe(false);
  });

  it('is false once the fine has been settled', () => {
    expect(hasOutstandingFine(makeContribution({ fineAmount: 200, finePaid: true }))).toBe(false);
  });

  it('is true when a fine is carried and unpaid', () => {
    expect(hasOutstandingFine(makeContribution({ fineAmount: 200, finePaid: false }))).toBe(true);
  });

  it('treats an absent finePaid as unpaid — the safe direction', () => {
    expect(hasOutstandingFine(makeContribution({ fineAmount: 200 }))).toBe(true);
  });
});

describe('arrearsForMember', () => {
  const me = makeMember({ id: 'm1', name: 'Member One' });

  it('is clean when everything is paid and no fines are outstanding', () => {
    const result = arrearsForMember(me, [
      makeContribution({ memberId: 'm1', status: 'Paid', amount: 600, fineAmount: 200, finePaid: true }),
    ], []);

    expect(result.unpaidDues).toBe(0);
    expect(result.unpaidMonths).toEqual([]);
    expect(result.unpaidFines).toBe(0);
    expect(result.totalOwed).toBe(0);
  });

  it('counts unpaid dues and names the months', () => {
    const result = arrearsForMember(me, [
      makeContribution({ memberId: 'm1', month: '2026-07', status: 'Unpaid', amount: 600 }),
      makeContribution({ memberId: 'm1', month: '2026-08', status: 'Late', amount: 600 }),
      makeContribution({ memberId: 'm1', month: '2026-09', status: 'Paid', amount: 600 }),
    ], []);

    expect(result.unpaidDues).toBe(1200);
    expect(result.unpaidMonths).toEqual(['2026-07', '2026-08']);
  });

  it("counts a Late record's dues as still owed — Late is an outcome, not a payment", () => {
    const result = arrearsForMember(me, [
      makeContribution({ memberId: 'm1', status: 'Late', amount: 600, fineAmount: 200, finePaid: false }),
    ], []);

    expect(result.unpaidDues).toBe(600);
    expect(result.unpaidFines).toBe(200);
    expect(result.totalOwed).toBe(800);
  });

  it('still charges the fine when the dues are settled but the fine is not', () => {
    const result = arrearsForMember(me, [
      makeContribution({ memberId: 'm1', status: 'Paid', amount: 600, fineAmount: 200, finePaid: false }),
    ], []);

    expect(result.unpaidDues).toBe(0);
    expect(result.unpaidFines).toBe(200);
    expect(result.totalOwed).toBe(200);
  });

  it('separates contribution fines from standalone fines and ignores waived ones', () => {
    const result = arrearsForMember(me, [], [
      makeFine({ memberId: 'm1', amount: 500, waived: false }),
      makeFine({ memberId: 'm1', amount: 1000, waived: true }),
      makeFine({ memberId: 'other', amount: 300, waived: false }),
    ]);

    expect(result.unpaidOtherFines).toBe(500);
    expect(result.unpaidFines).toBe(500);
  });

  it('ignores another member’s records entirely', () => {
    const result = arrearsForMember(me, [
      makeContribution({ memberId: 'someone-else', status: 'Unpaid', amount: 600 }),
    ], [makeFine({ memberId: 'someone-else', amount: 500 })]);

    expect(result.totalOwed).toBe(0);
  });

  it('reports unpaid meeting and entry fees as dues but not as months', () => {
    const result = arrearsForMember(me, [
      makeContribution({ memberId: 'm1', purpose: 'meetingFee', status: 'Unpaid', amount: 100 }),
    ], []);

    expect(result.unpaidDues).toBe(100);
    expect(result.unpaidMonths).toEqual([]);
  });
});

describe('arrearsForAll', () => {
  it('covers active members only and sorts the worst debt first', () => {
    const members = [
      makeMember({ id: 'a', name: 'A' }),
      makeMember({ id: 'b', name: 'B' }),
      makeMember({ id: 'c', name: 'C', active: false }),
    ];
    const contributions = [
      makeContribution({ memberId: 'a', status: 'Unpaid', amount: 600 }),
      makeContribution({ memberId: 'b', status: 'Unpaid', amount: 1800 }),
      makeContribution({ memberId: 'c', status: 'Unpaid', amount: 5000 }),
    ];

    const rows = arrearsForAll(members, contributions, []);
    expect(rows.map(r => r.memberId)).toEqual(['b', 'a']);
    expect(rows[0].totalOwed).toBe(1800);
  });
});

describe('groupArrears', () => {
  it('totals dues, fines and the headcount in arrears', () => {
    const members = [makeMember({ id: 'a' }), makeMember({ id: 'b' })];
    const contributions = [
      makeContribution({ memberId: 'a', status: 'Unpaid', amount: 600 }),
      makeContribution({ memberId: 'a', status: 'Paid', amount: 600, fineAmount: 200, finePaid: false }),
    ];

    const totals = groupArrears(arrearsForAll(members, contributions, [
      makeFine({ memberId: 'b', amount: 500 }),
    ]));

    expect(totals.totalDues).toBe(600);
    expect(totals.totalFines).toBe(700);
    expect(totals.totalOwed).toBe(1300);
    expect(totals.membersInArrears).toBe(2);
  });
});

describe('fineForLateMonth', () => {
  it('keeps a fine already recorded on the month', () => {
    const settings = makeSettings({ lateContributionFine: 200 });
    expect(fineForLateMonth(makeContribution({ fineAmount: 350 }), settings)).toBe(350);
  });

  it('supplies the constitutional fine when the month carries none', () => {
    const settings = makeSettings({ lateContributionFine: 200 });
    expect(fineForLateMonth(makeContribution({ fineAmount: 0 }), settings)).toBe(200);
  });
});