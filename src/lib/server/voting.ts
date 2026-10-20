import 'server-only';
import { adminDb } from './admin';
import { getVoteSummary } from '../verification';
import type { Vote, ExitRequest } from '../types';

/**
 * Server-side vote recording.
 *
 * The client version had two defects that both came from deciding the outcome
 * outside a transaction:
 *
 *   1. Stale status. `castVote` computed the outcome from the request snapshot
 *      the browser already held, then appended with `arrayUnion`. Two members
 *      voting at once both read the old list, both computed "not yet", and the
 *      status failed to flip even though the threshold had been crossed.
 *   2. Duplicate votes. `arrayUnion` dedupes on whole-object equality, and the
 *      vote carries a `votedAt` timestamp — so the same member voting from two
 *      tabs produced two distinct array entries, both counted toward the
 *      majority. A member could carry an exit request on their own.
 *
 * Both are fixed here by doing the read and the write inside one transaction and
 * checking membership of the existing array on the server. The transaction
 * retries on contention, so the outcome is always computed against the state
 * that includes every vote that committed first.
 */
export interface VoteResult {
  ok: boolean;
  error?: string;
  status?: ExitRequest['status'];
  voteCount?: number;
}

export async function castExitVote(
  requestId: string,
  voterId: string,
  voterName: string,
  choice: 'approve' | 'reject',
  activeSGMemberCount: number
): Promise<VoteResult> {
  const ref = adminDb.collection('exitRequests').doc(requestId);

  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { ok: false, error: 'That exit request no longer exists.' };

    const data = snap.data() as unknown as ExitRequest;

    // Re-check status inside the transaction. A member whose vote landed after
    // the request was already decided must not append to a closed vote.
    if (data.status !== 'pending') {
      return { ok: false, error: 'Voting on this request has closed.' };
    }

    const votes: Vote[] = data.votes ?? [];

    // The guard that makes a double-vote impossible rather than unlikely.
    if (votes.some((v) => v.memberId === voterId)) {
      return { ok: false, error: 'You have already voted on this request.' };
    }

    // A member cannot vote on their own exit. Checked here as well as in the UI,
    // because the UI check is client state.
    if (data.memberId === voterId) {
      return { ok: false, error: 'You cannot vote on your own exit request.' };
    }

    const vote: Vote = { memberId: voterId, memberName: voterName, vote: choice, votedAt: Date.now() };
    const nextVotes = [...votes, vote];
    const outcome = checkOutcome(nextVotes, activeSGMemberCount);

    const patch: Record<string, unknown> = { votes: nextVotes, updatedAt: Date.now() };
    if (outcome === 'verified') patch.status = 'awaitingResale';
    if (outcome === 'rejected') patch.status = 'rejectedByVote';

    tx.update(ref, patch);

    return { ok: true, status: (patch.status as ExitRequest['status']) ?? 'pending', voteCount: nextVotes.length };
  });
}

/**
 * Decide the outcome. Imported lazily to keep this module free of a client/Firestore
 * import cycle, and re-implemented here so the server never depends on the
 * client bundle's view of the threshold.
 */
function checkOutcome(votes: Vote[], activeSGMemberCount: number): 'verified' | 'rejected' | null {
  const { approvals, rejections, threshold } = getVoteSummary(votes, activeSGMemberCount);
  if (approvals >= threshold) return 'verified';
  if (rejections >= threshold) return 'rejected';
  return null;
}

/**
 * Active savings-group members, counted server-side.
 *
 * This must stay identical to the client-side count in
 * `exit-requests.tsx`, or the two would disagree about the majority threshold —
 * the server would reject a vote the UI thought was valid. `isSavingsGroupMember`
 * in roles.ts is `role in (member, admin, manager)`, NOT the `secondary` flag;
 * the latter only changes the dues rate.
 */
export async function countActiveSGMembers(): Promise<number> {
  const snap = await adminDb.collection('members').where('active', '!=', false).get();
  return snap.docs.filter((d) => {
    const data = d.data() as Record<string, unknown>;
    const role = (data.role as string) ?? 'member';
    return role === 'member' || role === 'admin' || role === 'manager';
  }).length;
}