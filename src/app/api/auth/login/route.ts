import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { cookies, headers } from 'next/headers';
import { isAdminConfigured } from '@/lib/server/admin';
import { createSession, sessionCookie } from '@/lib/server/session';
import {
  findMemberByPhone,
  readSecrets,
  recordFailedAttempt,
  clearLockout,
  backfillSecrets,
  publicMember,
  MAX_ATTEMPTS,
} from '@/lib/server/members';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * A bcrypt hash of a value nobody knows. Compared against when the phone number
 * does not match a member, so a wrong phone and a wrong PIN cost the same time.
 * Without this, login times tell an attacker which member numbers exist.
 */
const DECOY_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

export async function POST(request: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { success: false, error: 'Login is not configured on this server.' },
      { status: 503 }
    );
  }

  let body: { phone?: string; pin?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request.' }, { status: 400 });
  }

  const phone = (body.phone ?? '').trim();
  const pin = (body.pin ?? '').trim();

  if (!phone || !pin) {
    return NextResponse.json({ success: false, error: 'Enter your phone number and PIN.' }, { status: 400 });
  }

  // Never echo which half was wrong.
  const generic = { success: false, error: 'Invalid phone number or PIN' };

  const member = await findMemberByPhone(phone);
  if (!member) {
    await bcrypt.compare(pin, DECOY_HASH);
    return NextResponse.json(generic, { status: 401 });
  }

  const secrets = await readSecrets(member.id);
  if (!secrets) {
    await bcrypt.compare(pin, DECOY_HASH);
    return NextResponse.json(generic, { status: 401 });
  }

  if (member.data.active === false) {
    await bcrypt.compare(pin, DECOY_HASH);
    return NextResponse.json(
      { success: false, error: 'This membership is inactive. Speak to the committee.' },
      { status: 403 }
    );
  }

  if (secrets.lockedUntil !== null && secrets.lockedUntil > Date.now()) {
    const mins = Math.ceil((secrets.lockedUntil - Date.now()) / 60000);
    return NextResponse.json(
      { success: false, error: `Account locked. Try again in ${mins} minute${mins === 1 ? '' : 's'}.` },
      { status: 423 }
    );
  }

  const valid = await bcrypt.compare(pin, secrets.pinHash);

  if (!valid) {
    const attempts = await recordFailedAttempt(secrets);
    if (attempts >= MAX_ATTEMPTS) {
      return NextResponse.json(
        { success: false, error: 'Account locked due to too many failed attempts.' },
        { status: 423 }
      );
    }
    const remaining = MAX_ATTEMPTS - attempts;
    return NextResponse.json(
      { success: false, error: `Invalid PIN. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.` },
      { status: 401 }
    );
  }

  // Success. Clear the counter in whichever document holds it, and promote the
  // member out of the legacy shape on the way through — the promotion is what
  // eventually makes the fallback in readSecrets unnecessary.
  await clearLockout(secrets);
  if (secrets.source === 'members') {
    await backfillSecrets(member.id, secrets);
  }

  const hdrs = await headers();
  const session = await createSession(member.id, hdrs.get('user-agent') ?? undefined);

  const jar = await cookies();
  jar.set(sessionCookie(session.token, session.expiresAt));

  return NextResponse.json({ success: true, user: publicMember(member.id, member.data) });
}