import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/server/guard';
import { adminDb } from '@/lib/server/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * Mark an exit refund paid and close the membership.
 *
 * This replaces a browser `updateDoc` that set `members/{id}.active = false`
 * directly. The button was behind a client-side `canRecordFunds()` check and
 * the rules say `allow update: if true`, so the gate was decorative: any
 * signed-in member could have deactivated any other member.
 *
 * `active` is not cosmetic. `countActiveSGMembers()` counts on it, so
 * deactivating members shrinks the denominator of every subsequent exit vote —
 * deactivating enough of them could carry a request on a handful of votes.
 *
 * Both writes are in one transaction so the refund and the membership cannot
 * diverge: a member cannot be marked paid out while still active, or closed
 * while still owing.
 */
export async function POST(_request: Request, { params }: Params) {
  // Paying a refund is an admin action. The recorder role that books the
  // payment (treasurer/coordinator) is covered by being an admin in practice,
  // but the constitution puts refund approval with the membership, so this
  // stays admin-only rather than widened to `canRecordFunds`.
  const guard = await requireRole('admin');
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const reqRef = adminDb.collection('exitRequests').doc(id);

  const result = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(reqRef);
    if (!snap.exists) return { ok: false as const, error: 'That exit request no longer exists.', status: 404 };

    const data = snap.data() as Record<string, unknown>;

    // Only a request the members actually approved may be paid. Paying an
    // unapproved or rejected request would hand back a refund no one voted for.
    if (data.status !== 'awaitingResale') {
      return {
        ok: false as const,
        error: `This request is "${data.status}", not approved. Only an approved request can be paid out.`,
        status: 409,
      };
    }

    const memberId = data.memberId as string;
    if (!memberId) return { ok: false as const, error: 'This request has no member.', status: 400 };

    const memberRef = adminDb.collection('members').doc(memberId);
    const memberSnap = await tx.get(memberRef);
    if (!memberSnap.exists) {
      return { ok: false as const, error: 'That member no longer exists.', status: 404 };
    }

    const now = Date.now();
    tx.update(reqRef, { status: 'paidOut', paidOutAt: now, updatedAt: now });
    tx.update(memberRef, { active: false, updatedAt: now });

    return { ok: true as const, memberId, memberName: memberSnap.data()?.name as string };
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ success: true, memberId: result.memberId });
}
