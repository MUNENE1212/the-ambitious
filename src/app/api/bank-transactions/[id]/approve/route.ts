import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/server/guard';
import { approveWithdrawal } from '@/lib/server/arrays';
import { adminDb } from '@/lib/server/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * Sign a withdrawal as a second signatory.
 *
 * Any active member may sign — that is deliberate and is what one-member-one-vote
 * (Cap. 490 s.19) requires; restricting signatories to office-bearers would let
 * a treasurer move money with no other member's agreement. The two rules that
 * must hold are enforced in `approveWithdrawal`, inside the transaction:
 * the recorder cannot sign their own withdrawal, and one member is one
 * signature.
 */
export async function POST(_request: Request, { params }: Params) {
  const guard = await requireRole('member', 'manager', 'admin');
  if (!guard.ok) return guard.response;

  const { id } = await params;

  const memberSnap = await adminDb.collection('members').doc(guard.caller.memberId).get();
  const memberName = (memberSnap.data()?.name as string) ?? 'Member';

  const result = await approveWithdrawal(id, guard.caller.memberId, memberName);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  return NextResponse.json({ success: true, status: result.status, approvalCount: result.count });
}
