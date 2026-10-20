import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/server/guard';
import { castExitVote, countActiveSGMembers } from '@/lib/server/voting';
import { adminDb } from '@/lib/server/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * Record a vote on an exit request.
 *
 * All members may vote — voting rights come from membership, not a title, per
 * Cap. 490 s.19. Eligibility beyond that (not the exit member, not a second
 * vote, request still open) is enforced in castExitVote inside the transaction,
 * because those checks have to read the same committed state the write uses.
 */
export async function POST(request: Request, { params }: Params) {
  const guard = await requireRole('member', 'manager', 'admin');
  if (!guard.ok) return guard.response;

  const { id } = await params;

  let body: { vote?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const choice = body.vote;
  if (choice !== 'approve' && choice !== 'reject') {
    return NextResponse.json({ error: 'Vote must be approve or reject.' }, { status: 400 });
  }

  // The voter's display name comes from the member document, not the request
  // body, so a client cannot vote in someone else's name.
  const memberSnap = await adminDb.collection('members').doc(guard.caller.memberId).get();
  const memberName = (memberSnap.data()?.name as string) ?? 'Member';

  const eligibleCount = await countActiveSGMembers();

  const result = await castExitVote(id, guard.caller.memberId, memberName, choice, eligibleCount);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  return NextResponse.json({
    success: true,
    status: result.status,
    voteCount: result.voteCount,
  });
}