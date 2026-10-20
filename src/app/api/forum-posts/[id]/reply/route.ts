import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/server/guard';
import { adminDb } from '@/lib/server/admin';
import { randomUUID } from 'node:crypto';
import type { ForumReply } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * Post a reply to a forum post.
 *
 * The author identity comes from the member document, not the request body.
 * Previously the browser sent its own `authorId`, `authorName` and
 * `authorTitles` and they were written verbatim, so any member could post under
 * another member's name — including as an office-bearer, which matters because
 * Announcements are leadership-only and replies carry titles forward.
 *
 * Deduplication is by a server-generated id. `arrayUnion` compared whole
 * objects, so a double-submit produced two identical-looking replies; here the
 * same id is generated once per attempt and a retry reuses it.
 */
export async function POST(request: Request, { params }: Params) {
  const guard = await requireRole('member', 'manager', 'admin');
  if (!guard.ok) return guard.response;

  const { id } = await params;

  let body: { body?: string; replyId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const text = typeof body.body === 'string' ? body.body.trim() : '';
  if (!text) {
    return NextResponse.json({ error: 'Reply cannot be empty.' }, { status: 400 });
  }
  if (text.length > 5000) {
    return NextResponse.json({ error: 'Reply is too long.' }, { status: 400 });
  }

  // Reuse the caller's id if they retried, so a duplicate submit collapses into
  // one reply rather than two. The id is not trusted as an identity — only the
  // member document decides who is speaking.
  const replyId = typeof body.replyId === 'string' && /^[\w-]{8,64}$/.test(body.replyId)
    ? body.replyId
    : randomUUID();

  const ref = adminDb.collection('forumPosts').doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: 'That post no longer exists.' }, { status: 404 });
  }

  const memberSnap = await adminDb.collection('members').doc(guard.caller.memberId).get();
  const memberData = memberSnap.data() as Record<string, unknown> | undefined;
  const memberName = (memberData?.name as string) ?? 'Member';
  const titles = ((memberData?.titles as string[]) ?? []).slice(0, 10);

  const reply: ForumReply = {
    id: replyId,
    body: text,
    authorId: guard.caller.memberId,
    authorName: memberName,
    authorTitles: titles as ForumReply['authorTitles'],
    createdAt: Date.now(),
  };

  const result = await adminDb.runTransaction(async (tx) => {
    const current = await tx.get(ref);
    if (!current.exists) return { ok: false as const };

    const replies: ForumReply[] = ((current.data() as Record<string, unknown>).replies as ForumReply[]) ?? [];

    // Same guard the transaction gives us: one reply per id, so a retried
    // submit is a no-op rather than a second identical post.
    if (replies.some(r => r.id === replyId)) {
      return { ok: true as const, duplicate: true, count: replies.length };
    }

    const next = [...replies, reply];
    tx.update(ref, { replies: next, updatedAt: Date.now() });
    return { ok: true as const, duplicate: false, count: next.length };
  });

  if (!result.ok) {
    return NextResponse.json({ error: 'That post no longer exists.' }, { status: 404 });
  }

  return NextResponse.json({ success: true, replyId, duplicate: result.duplicate });
}
