import { Vote, VerificationStatus, SignatoryApproval } from './types';

export interface VoteSummary {
  approvals: number;
  rejections: number;
  threshold: number;
  eligible: number;
  remaining: number;
}

/**
 * Calculate majority vote threshold and check outcome.
 * Eligible = activeSGMemberCount - 1 (exclude the recorder).
 * Threshold = >50% of eligible = floor(eligible / 2) + 1.
 */
export function getVoteSummary(votes: Vote[], activeSGMemberCount: number): VoteSummary {
  const eligible = Math.max(1, activeSGMemberCount - 1);
  const threshold = Math.floor(eligible / 2) + 1;
  const approvals = votes.filter(v => v.vote === 'approve').length;
  const rejections = votes.filter(v => v.vote === 'reject').length;
  const remaining = Math.max(0, threshold - approvals);
  return { approvals, rejections, threshold, eligible, remaining };
}

/** Check if voting has reached a final outcome */
export function checkVoteOutcome(votes: Vote[], activeSGMemberCount: number): VerificationStatus | null {
  const { approvals, rejections, threshold } = getVoteSummary(votes, activeSGMemberCount);
  if (approvals >= threshold) return 'verified';
  if (rejections >= threshold) return 'rejected';
  return null;
}

/** Check if a member has already voted */
export function hasVoted(votes: Vote[], memberId: string): boolean {
  return votes.some(v => v.memberId === memberId);
}

/** Check if a member can vote (not the recorder, hasn't voted yet) */
export function canMemberVote(votes: Vote[], memberId: string, recordedBy: string): boolean {
  if (memberId === recordedBy) return false;
  if (hasVoted(votes, memberId)) return false;
  return true;
}

/** Check if a bank withdrawal has enough signatory approvals (2 required) */
export function isWithdrawalApproved(approvals: SignatoryApproval[]): boolean {
  return approvals.length >= 2;
}

/** Check if a member can approve a withdrawal (not the recorder, hasn't approved yet) */
export function canApproveTransaction(approvals: SignatoryApproval[], memberId: string, recordedBy: string): boolean {
  if (memberId === recordedBy) return false;
  return !approvals.some(a => a.memberId === memberId);
}
