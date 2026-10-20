import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/server/guard';
import { markSeen } from '@/lib/server/arrays';
import { adminDb } from '@/lib/server/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Record that the signed-in member has seen an expense or a withdrawal.
 *
 * Two callers, one shape: the expenses ledger and the bank tab both show a
 * "Mark as Seen" button, and both used `arrayUnion`, which dedupes on
 * whole-object equality — including `seenAt`. A member with two tabs open
 * listed themselves twice, and a record could show "Seen by" three names when
 * only two members had looked at it.
 */
export async function POST(request: Request) {
  const guard = await requireRole('member', 'manager', 'admin');
  if (!guard.ok) return guard.response;

  let body: { collection?: string; id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const { collection, id } = body;
  if (!collection || !id) {
    return NextResponse.json({ error: 'collection and id are required.' }, { status: 400 });
  }

  const memberSnap = await adminDb.collection('members').doc(guard.caller.memberId).get();
  const memberName = (memberSnap.data()?.name as string) ?? 'Member';

  const result = await markSeen(collection, id, guard.caller.memberId, memberName);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.error === 'Unknown collection.' ? 400 : 404 });
  }

  return NextResponse.json({ success: true, seenCount: result.count });
}
