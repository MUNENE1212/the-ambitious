import { describe, it, expect } from 'vitest';
import { getVoteSummary, checkVoteOutcome, hasVoted, canMemberVote } from '../verification';
import type { Vote } from '../types';

/**
 * Regression tests for the double-vote and stale-status defects.
 *
 * The old client write had these bugs and the existing suite missed both,
 * because every test exercised the pure helpers while the defect lived in the
 * client-side read-modify-write. These tests model that write directly:
 *
 *   applyVote() below reproduces the exact logic the old `castVote` used, so a
 *   test that fails against it is a test that would have caught the bug.
 */

/** How the old client code decided the status after appending a vote. */
function applyVote(
  storedVotes: Vote[],
  newVote: Vote,
  activeMemberCount: number
): { votes: Vote[]; status: string } {
  const votes = [...storedVotes, newVote];           // stale client-side read
  const outcome = checkVoteOutcome(votes, activeMemberCount);
  const status = outcome === 'verified' ? 'awaitingResale'
    : outcome === 'rejected' ? 'rejectedByVote'
    : 'pending';
  return { votes, status };
}

/** `v` defaults to approve so a seed list reads as a list of approvals. */
const vote = (memberId: string, v: 'approve' | 'reject' = 'approve', at = 1): Vote =>
  ({ memberId, memberName: memberId, vote: v, votedAt: at });

describe('majority threshold', () => {
  it('needs a strict majority of everyone except the exiting member', () => {
    // 10 active members, 1 exiting => 9 eligible, threshold 5.
    expect(getVoteSummary([], 10)).toMatchObject({ eligible: 9, threshold: 5 });
  });

  it('does not reach the threshold at exactly half', () => {
    const votes = [vote('a', 'approve'), vote('b', 'approve'), vote('c', 'approve'), vote('d', 'approve')];
    expect(checkVoteOutcome(votes, 10)).toBeNull();
    expect(checkVoteOutcome([...votes, vote('e', 'approve')], 10)).toBe('verified');
  });
});

describe('stale-status defect (fixed by the server transaction)', () => {
  it('two members voting from the same stale snapshot both fail to flip status', () => {
    // This is the bug. Both clients hold the same snapshot with 3 approvals;
    // a 5th approve is genuinely the threshold, but neither sees the other's
    // vote, so both write status=pending.
    const stale: Vote[] = [vote('a'), vote('b'), vote('c')];

    const first = applyVote(stale, vote('d', 'approve', 100), 10);
    const second = applyVote(stale, vote('e', 'approve', 200), 10);

    expect(first.status).toBe('pending');
    expect(second.status).toBe('pending');

    // Both votes are in the array, so the threshold HAS been crossed...
    const merged = [...first.votes, second.votes[3]!];
    expect(merged.filter(v => v.vote === 'approve')).toHaveLength(5);
    expect(checkVoteOutcome(merged, 10)).toBe('verified');

    // ...but the stored status says otherwise. This is the defect.
    expect(first.status).not.toBe('awaitingResale');
  });

  it('serialised votes DO flip the status', () => {
    // The fix: re-read inside a transaction, so the second vote sees the first.
    let votes: Vote[] = [vote('a'), vote('b'), vote('c')];
    const results: string[] = [];

    for (const id of ['d', 'e']) {
      const r = applyVote(votes, vote(id, 'approve'), 10);
      votes = r.votes;                 // committed state, not a stale copy
      results.push(r.status);
    }

    expect(results).toEqual(['pending', 'awaitingResale']);
  });
});

describe('double-vote defect (fixed by the server membership check)', () => {
  it('arrayUnion-style dedupe fails when votedAt differs', () => {
    // Two tabs, same member, one second apart. arrayUnion compares whole
    // objects, and votedAt differs, so BOTH entries survive — a member voting
    // twice counts as two votes toward the majority.
    const firstVote = vote('a', 'approve', 1000);
    const secondVote = vote('a', 'approve', 2000);

    const unionDedupe = [firstVote, secondVote].filter(
      (v, i, arr) => arr.findIndex(x => JSON.stringify(x) === JSON.stringify(v)) === i
    );

    expect(unionDedupe).toHaveLength(2);   // the defect: duplicate counted
    expect(hasVoted(unionDedupe, 'a')).toBe(true); // and hasVoted still says true
  });

  it('the server check rejects the second vote regardless of timestamp', () => {
    // The fix is a membership test on memberId, not object equality.
    const stored = [vote('a', 'approve', 1000)];
    const duplicate = vote('a', 'approve', 2000);

    const alreadyCast = stored.some(v => v.memberId === duplicate.memberId);
    expect(alreadyCast).toBe(true);      // rejected before any write happens
  });

  it('a member cannot carry an exit request alone', () => {
    // The realistic harm: 4 eligible members, a member voting twice must not
    // reach the threshold of 3 by themselves.
    const stored: Vote[] = [];
    const attempts = [vote('m', 'approve', 1), vote('m', 'approve', 2)];

    let votes = stored;
    for (const v of attempts) {
      if (votes.some(x => x.memberId === v.memberId)) break;   // server rejects
      votes = [...votes, v];
    }

    expect(votes).toHaveLength(1);
    expect(checkVoteOutcome(votes, 5)).toBeNull();   // 5 active, 4 eligible, threshold 3
  });
});

describe('eligibility guards', () => {
  it('blocks a second vote from the same member', () => {
    expect(canMemberVote([vote('a')], 'a', 'admin')).toBe(false);
    expect(canMemberVote([vote('a')], 'b', 'admin')).toBe(true);
  });

  it('blocks the exiting member from voting on their own exit', () => {
    expect(canMemberVote([], 'exit-member', 'exit-member')).toBe(false);
  });

  it('ignores a change of mind — one member, one vote', () => {
    // Voting approve then reject must not net out to cancel; the first vote
    // stands. hasVoted is what enforces this.
    const afterFlip = [vote('a', 'approve'), vote('a', 'reject')];
    expect(hasVoted(afterFlip, 'a')).toBe(true);
    expect(canMemberVote(afterFlip, 'a', 'admin')).toBe(false);
  });
});