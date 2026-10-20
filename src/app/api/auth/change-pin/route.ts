import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { headers } from 'next/headers';
import { isAdminConfigured, adminDb } from '@/lib/server/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { resolveSession, createSession, sessionCookie, revokeAllSessions } from '@/lib/server/session';
import { readSecrets, writeSecrets, publicMember } from '@/lib/server/members';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ success: false, error: 'Not configured.' }, { status: 503 });
  }

  const memberId = await resolveSession();
  if (!memberId) {
    return NextResponse.json({ success: false, error: 'Not logged in' }, { status: 401 });
  }

  let body: { oldPin?: string; newPin?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request.' }, { status: 400 });
  }

  const oldPin = (body.oldPin ?? '').trim();
  const newPin = (body.newPin ?? '').trim();

  if (!/^\d{4}$/.test(oldPin) || !/^\d{4}$/.test(newPin)) {
    return NextResponse.json(
      { success: false, error: 'PIN must be exactly 4 digits.' },
      { status: 400 }
    );
  }

  const secrets = await readSecrets(memberId);
  if (!secrets) {
    return NextResponse.json({ success: false, error: 'Could not verify your current PIN.' }, { status: 500 });
  }

  if (!(await bcrypt.compare(oldPin, secrets.pinHash))) {
    return NextResponse.json(
      { success: false, error: 'Current PIN is incorrect' },
      { status: 401 }
    );
  }

  const pinHash = await bcrypt.hash(newPin, 10);
  await writeSecrets(memberId, { pinHash, failedAttempts: 0, lockedUntil: null });
  // The new hash goes to secrets/ only — the member doc is client-readable, so
  // writing it there too would re-expose the PIN. But for a member who has not
  // migrated yet, the doc still carries the hash of the PIN they just replaced,
  // and leaving it is the whole vulnerability: the old PIN stays readable to
  // every signed-in member. Deleting is the difference between changing a PIN
  // and changing a PIN *safely*. The admin reset and the onboarding claim do
  // the same thing.
  await adminDb.collection('members').doc(memberId).set(
    {
      mustChangePin: false,
      pinHash: FieldValue.delete(),
      failedAttempts: FieldValue.delete(),
      lockedUntil: FieldValue.delete(),
      updatedAt: Date.now(),
    },
    { merge: true }
  );

  // A PIN change must invalidate every existing session, including any an
  // attacker already holds. Then re-issue one for the member who just changed it.
  await revokeAllSessions(memberId);
  const hdrs = await headers();
  const session = await createSession(memberId, hdrs.get('user-agent') ?? undefined);
  const jar = await cookies();
  jar.set(sessionCookie(session.token, session.expiresAt));

  const snap = await adminDb.collection('members').doc(memberId).get();
  const data = (snap.data() ?? {}) as Record<string, unknown>;

  return NextResponse.json({
    success: true,
    user: publicMember(memberId, { ...data, mustChangePin: false }),
  });
}