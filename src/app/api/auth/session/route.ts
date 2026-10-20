import { NextResponse } from 'next/server';
import { isAdminConfigured, adminDb } from '@/lib/server/admin';
import { resolveSession } from '@/lib/server/session';
import { publicMember } from '@/lib/server/members';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Rehydrate the current session on page load.
 *
 * This replaces the old localStorage session, which was a plain JSON blob
 * containing a memberId and an expiry — editable by anyone with devtools, so it
 * was impersonation of any member (including the treasurer) in one line.
 */
export async function GET() {
  if (!isAdminConfigured()) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  const memberId = await resolveSession();
  if (!memberId) return NextResponse.json({ user: null });

  const snap = await adminDb.collection('members').doc(memberId).get();
  if (!snap.exists) return NextResponse.json({ user: null });

  const data = snap.data() as Record<string, unknown>;
  if (data.active === false) return NextResponse.json({ user: null });

  return NextResponse.json({ user: publicMember(snap.id, data) });
}