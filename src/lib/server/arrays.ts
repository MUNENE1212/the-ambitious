import 'server-only';
import { adminDb } from './admin';
import { getTimestamp } from '../utils';
import type { SeenBy, SignatoryApproval } from '../types';

/**
 * Transactional array appends.
 *
 * `arrayUnion` is the wrong tool for any array that identifies *who* did
 * something. It dedupes on whole-object equality, and every entry here carries
 * a timestamp, so the same member acting twice in two tabs produces two
 * entries — both counted, both displayed. That is how a single member could
 * supply both signatories on their own withdrawal, and how "seen by" could list
 * the same person twice.
 *
 * The fix is a membership test on the member id, inside the same transaction as
 * the write, so the read that decides is the read the write commits against.
 */

/** Collections whose arrays we are allowed to touch. Anything else is a bug. */
const WRITABLE = new Set(['expenses', 'bankTransactions', 'forumPosts']);

export interface AppendResult {
  ok: boolean;
  error?: string;
  count?: number;
}

/**
 * Record that a member has seen an expense or a withdrawal.
 *
 * Idempotent by member id: a second call from the same member is a no-op, not a
 * duplicate entry. Returns the current count so the caller can report it.
 */
export async function markSeen(
  collection: string,
  docId: string,
  memberId: string,
  memberName: string
): Promise<AppendResult> {
  if (!WRITABLE.has(collection)) {
    return { ok: false, error: 'Unknown collection.' };
  }

  const ref = adminDb.collection(collection).doc(docId);

  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { ok: false, error: 'That record no longer exists.' };

    const seenBy: SeenBy[] = ((snap.data() as Record<string, unknown>).seenBy as SeenBy[]) ?? [];

    // The member id, not the whole object, is the identity. A timestamp
    // difference must not create a second entry.
    if (seenBy.some(s => s.memberId === memberId)) {
      return { ok: true, count: seenBy.length };
    }

    const next = [...seenBy, { memberId, memberName, seenAt: getTimestamp() }];
    tx.update(ref, { seenBy: next, updatedAt: Date.now() });
    return { ok: true, count: next.length };
  });
}

/**
 * Add a signatory approval to a withdrawal.
 *
 * Enforces the constitutional two-signatory rule (PLAN.md Section C):
 *   - the member who recorded the transaction cannot also sign it
 *   - the same member cannot sign twice
 *   - the status only flips to 'approved' on the server, once two distinct
 *     signatories are present — the client never gets to assert it
 *
 * A withdrawal written with `status: 'approved'` and no signatories is exactly
 * the defect this closes: the balance moved the moment the record was created.
 */
export async function approveWithdrawal(
  transactionId: string,
  memberId: string,
  memberName: string
): Promise<AppendResult & { status?: string }> {
  const ref = adminDb.collection('bankTransactions').doc(transactionId);

  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { ok: false, error: 'That transaction no longer exists.' };

    const data = snap.data() as Record<string, unknown>;
    if (data.type !== 'withdrawal') {
      return { ok: false, error: 'Only withdrawals need signatory approval.' };
    }
    if (data.recordedBy === memberId) {
      return { ok: false, error: 'You recorded this withdrawal, so you cannot sign it.' };
    }
    if (data.status === 'approved') {
      return { ok: false, error: 'This withdrawal is already fully signed.' };
    }

    const approvals: SignatoryApproval[] = (data.approvals as SignatoryApproval[]) ?? [];

    if (approvals.some(a => a.memberId === memberId)) {
      return { ok: false, error: 'You have already signed this withdrawal.' };
    }

    const next = [...approvals, { memberId, memberName, approvedAt: Date.now() }];
    const patch: Record<string, unknown> = { approvals: next, updatedAt: Date.now() };

    // Two distinct signatories — the check is `distinct members`, which the
    // membership guards above have already made true of this array.
    if (next.length >= 2) patch.status = 'approved';

    tx.update(ref, patch);
    return { ok: true, count: next.length, status: (patch.status as string) ?? 'pending' };
  });
}
