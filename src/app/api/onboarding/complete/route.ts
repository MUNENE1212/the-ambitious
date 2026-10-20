import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import { isAdminConfigured, adminDb } from '@/lib/server/admin';
import { createSession, sessionCookie } from '@/lib/server/session';
import { publicMember } from '@/lib/server/members';
import {
  completeClaim,
  hashPin,
  pinProblem,
  clearNonce,
} from '@/lib/server/onboarding';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Step 2 of onboarding: set your phone number and PIN.
 *
 * Takes the opaque single-use token from /lookup — never a member id — so the
 * client cannot nominate whose seat to claim. Everything that decides (is the
 * seat still claimable, is the nonce still valid, is the phone free) happens
 * inside one transaction in completeClaim().
 *
 * On success it signs the member straight in: they have just proved they can
 * set up an account, and making them then type the same PIN again on the login
 * screen is friction for no security gain.
 */
export async function POST(request: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { success: false, error: 'Setup is not available on this server.' },
      { status: 503 }
    );
  }

  let body: { token?: string; phone?: string; pin?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request.' }, { status: 400 });
  }

  const token = (body.token ?? '').trim();
  const phone = (body.phone ?? '').trim();
  const pin = (body.pin ?? '').trim();

  if (!token || !phone || !pin) {
    return NextResponse.json({ success: false, error: 'Enter your phone number and PIN.' }, { status: 400 });
  }

  const problem = pinProblem(pin);
  if (problem) {
    return NextResponse.json({ success: false, error: problem }, { status: 400 });
  }

  // Resolve the token to a member. The token is 32 hex chars; anything else is
  // noise and is refused before it reaches a query.
  if (!/^[a-f0-9]{32}$/.test(token)) {
    return NextResponse.json(
      { success: false, error: 'This setup link has expired. Please start again.' },
      { status: 400 }
    );
  }

  const snap = await adminDb
    .collection('members')
    .where('claimNonce', '==', token)
    .limit(1)
    .get();

  if (snap.empty) {
    return NextResponse.json(
      { success: false, error: 'This setup link has expired. Please start again.' },
      { status: 409 }
    );
  }

  const memberId = snap.docs[0]!.id;
  const pinHash = await hashPin(pin);

  const hdrs = await headers();
  const ip =
    hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() || hdrs.get('x-real-ip') || 'unknown';

  const result = await completeClaim(memberId, token, phone, pinHash, {
    ip,
    userAgent: hdrs.get('user-agent') ?? undefined,
  });

  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }

  // The nonce is consumed inside the transaction. This is belt-and-braces for
  // the case where the seat became un-claimable mid-flight.
  await clearNonce(memberId).catch(() => {});

  const memberRef = adminDb.collection('members').doc(memberId);
  const memberSnap = await memberRef.get();
  const memberData = memberSnap.data() as Record<string, unknown>;

  const session = await createSession(memberId, hdrs.get('user-agent') ?? undefined);
  const jar = await cookies();
  jar.set(sessionCookie(session.token, session.expiresAt));

  return NextResponse.json({
    success: true,
    user: publicMember(memberId, memberData),
  });
}
