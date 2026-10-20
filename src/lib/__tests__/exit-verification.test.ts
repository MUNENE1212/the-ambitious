import { describe, it, expect } from 'vitest';
import { calculateRefund } from '../exit';
import {
  getVoteSummary, checkVoteOutcome, hasVoted, canMemberVote,
  isWithdrawalApproved, canApproveTransaction,
} from '../verification';
import { makeContribution, makeFine } from './fixtures';

const PCT = 0.2; // the constitution's 20% exit deduction

describe('calculateRefund', () => {
  it('sums dues and welfare separately, subtracts arrears, then deducts 20%', () => {
    const result = calculateRefund(
      [
        makeContribution({ purpose: 'monthly', status: 'Paid', amount: 6000 }),
        makeContribution({ purpose: 'meetingFee', status: 'Paid', amount: 100 }),
        makeContribution({ purpose: 'entryFee', status: 'Paid', amount: 5000 }),
      ],
      [
        makeFine({ amount: 500, waived: false }),
        makeFine({ amount: 200, waived: true }),
      ],
      PCT,
    );

    expect(result.contributionsPaid).toBe(6000);
    expect(result.welfarePaid).toBe(5100); // every paid non-monthly charge
    expect(result.arrears).toBe(500);       // waived fines do not count
    // gross 5500 → deduction 1100 → net 4400
    expect(result.deductionPct).toBe(0.2);
    expect(result.deductionAmount).toBe(1100);
    expect(result.netRefund).toBe(4400);
  });

  it('ignores unpaid dues — only what was actually paid is refundable', () => {
    const result = calculateRefund(
      [
        makeContribution({ purpose: 'monthly', status: 'Paid', amount: 600 }),
        makeContribution({ purpose: 'monthly', status: 'Unpaid', amount: 600 }),
        makeContribution({ purpose: 'monthly', status: 'Late', amount: 600 }),
      ],
      [],
      PCT,
    );

    expect(result.contributionsPaid).toBe(600);
    expect(result.netRefund).toBe(480); // 600 − 20%
  });

  it('floors at zero when arrears exceed everything paid', () => {
    const result = calculateRefund(
      [makeContribution({ purpose: 'monthly', status: 'Paid', amount: 1000 })],
      [makeFine({ amount: 1500, waived: false })],
      PCT,
    );

    expect(result.contributionsPaid).toBe(1000);
    expect(result.arrears).toBe(1500);
    // Nothing left to deduct from, and the member is never refunded a negative.
    expect(result.deductionAmount).toBe(0);
    expect(result.netRefund).toBe(0);
  });

  it('rounds the deduction rather than truncating it', () => {
    // 1,111 × 0.2 = 222.2 → 222; 999 × 0.2 = 199.8 → 200
    expect(calculateRefund(
      [makeContribution({ purpose: 'monthly', status: 'Paid', amount: 1111 })], [], PCT,
    ).deductionAmount).toBe(222);

    expect(calculateRefund(
      [makeContribution({ purpose: 'monthly', status: 'Paid', amount: 999 })], [], PCT,
    ).deductionAmount).toBe(200);
  });

  it('handles a member with no paid contributions at all', () => {
    const result = calculateRefund([], [], PCT);
    expect(result.netRefund).toBe(0);
    expect(result.deductionAmount).toBe(0);
  });
});

describe('vote verification', () => {
  const vote = (memberId: string, kind: 'approve' | 'reject') => ({
    memberId, memberName: memberId, vote: kind, votedAt: 1,
  });

  it('excludes the recorder and takes a strict majority of the rest', () => {
    // 12 active members → 11 eligible → 6 needed
    expect(getVoteSummary([], 12)).toEqual({
      approvals: 0, rejections: 0, threshold: 6, eligible: 11, remaining: 6,
    });
  });

  it('counts down the votes still needed', () => {
    const votes = [vote('a', 'approve'), vote('b', 'approve')];
    expect(getVoteSummary(votes, 12).remaining).toBe(4);
    expect(getVoteSummary(votes, 12).threshold).toBe(6);
  });

  it('never lets the eligible pool fall below one', () => {
    expect(getVoteSummary([], 1)).toMatchObject({ eligible: 1, threshold: 1 });
    expect(getVoteSummary([], 0)).toMatchObject({ eligible: 1, threshold: 1 });
  });

  it('reaches a verified outcome at the threshold', () => {
    const approvals = ['a', 'b', 'c', 'd', 'e', 'f'].map(id => vote(id, 'approve'));
    expect(checkVoteOutcome(approvals, 12)).toBe('verified');
  });

  it('reaches a rejected outcome at the threshold', () => {
    const rejections = ['a', 'b', 'c', 'd', 'e', 'f'].map(id => vote(id, 'reject'));
    expect(checkVoteOutcome(rejections, 12)).toBe('rejected');
  });

  it('stays open below the threshold', () => {
    const split = [
      vote('a', 'approve'), vote('b', 'approve'), vote('c', 'approve'),
      vote('d', 'reject'), vote('e', 'reject'),
    ];
    expect(checkVoteOutcome(split, 12)).toBeNull();
  });

  it('first side to reach the threshold decides', () => {
    const sixRejections = ['a', 'b', 'c', 'd', 'e', 'f'].map(id => vote(id, 'reject'));
    expect(checkVoteOutcome(sixRejections, 12)).toBe('rejected');
  });

  it('stops a member voting twice', () => {
    const votes = [vote('a', 'approve')];
    expect(hasVoted(votes, 'a')).toBe(true);
    expect(hasVoted(votes, 'b')).toBe(false);
    expect(canMemberVote(votes, 'a', 'admin')).toBe(false);
    expect(canMemberVote(votes, 'b', 'admin')).toBe(true);
  });

  it('never lets the recorder vote on their own proposal', () => {
    expect(canMemberVote([], 'admin', 'admin')).toBe(false);
  });
});

describe('bank withdrawal sign-off', () => {
  const approval = (memberId: string) => ({ memberId, memberName: memberId, approvedAt: 1 });

  it('requires two signatories', () => {
    expect(isWithdrawalApproved([])).toBe(false);
    expect(isWithdrawalApproved([approval('a')])).toBe(false);
    expect(isWithdrawalApproved([approval('a'), approval('b')])).toBe(true);
    expect(isWithdrawalApproved([approval('a'), approval('b'), approval('c')])).toBe(true);
  });

  it('does not let the recorder or a duplicate signatory approve', () => {
    const approvals = [approval('a')];
    expect(canApproveTransaction(approvals, 'recorder', 'recorder')).toBe(false);
    expect(canApproveTransaction(approvals, 'a', 'recorder')).toBe(false);
    expect(canApproveTransaction(approvals, 'b', 'recorder')).toBe(true);
  });
});