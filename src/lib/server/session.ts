import 'server-only';
import { randomBytes, createHash, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { adminDb } from './admin';

export const SESSION_COOKIE = 'ambitious_session';
export const SESSION_DAYS = 30;
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;

/** Store only a hash of the token. A leaked session doc must not be a login. */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface SessionDoc {
  memberId: string;
  tokenHash: string;
  createdAt: number;
  expiresAt: number;
  userAgent?: string;
}

export interface IssuedSession {
  token: string;
  sessionId: string;
  expiresAt: number;
}

/**
 * Mint a session. The raw token goes to the client in a cookie; only its hash
 * is persisted, so reading the sessions collection is not enough to impersonate.
 */
export async function createSession(
  memberId: string,
  userAgent?: string
): Promise<IssuedSession> {
  const token = randomBytes(32).toString('base64url');
  const now = Date.now();
  const expiresAt = now + SESSION_MS;
  const sessionId = hashToken(token).slice(0, 32);

  const doc: SessionDoc = {
    memberId,
    tokenHash: hashToken(token),
    createdAt: now,
    expiresAt,
    ...(userAgent ? { userAgent: userAgent.slice(0, 200) } : {}),
  };

  await adminDb.collection('sessions').doc(sessionId).set(doc);
  return { token, sessionId, expiresAt };
}

/** Resolve the current cookie to a memberId, or null. Expired rows are deleted. */
export async function resolveSession(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const sessionId = hashToken(token).slice(0, 32);
  const ref = adminDb.collection('sessions').doc(sessionId);
  const snap = await ref.get();
  if (!snap.exists) return null;

  const data = snap.data() as SessionDoc;

  // Constant-time compare so a timing oracle cannot be used to guess a token.
  const a = Buffer.from(data.tokenHash);
  const b = Buffer.from(hashToken(token));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  if (data.expiresAt <= Date.now()) {
    await ref.delete();
    return null;
  }

  return data.memberId;
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const sessionId = hashToken(token).slice(0, 32);
    await adminDb.collection('sessions').doc(sessionId).delete().catch(() => {});
  }
}

/** Invalidate every session for a member — on PIN change or deactivation. */
export async function revokeAllSessions(memberId: string): Promise<number> {
  const snap = await adminDb.collection('sessions').where('memberId', '==', memberId).get();
  if (snap.empty) return 0;
  const batch = adminDb.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  return snap.size;
}

export function sessionCookie(token: string, expiresAt: number) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    expires: new Date(expiresAt),
  };
}

export function clearSessionCookie() {
  return {
    name: SESSION_COOKIE,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    maxAge: 0,
  };
}