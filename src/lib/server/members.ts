import 'server-only';
import { adminDb } from './admin';

/** Normalisation must match the client exactly, or members cannot log in. */
export function normalizePhone(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.startsWith('0')) return '+254' + trimmed.slice(1);
  if (trimmed.startsWith('254')) return '+' + trimmed;
  return trimmed;
}

export const MAX_ATTEMPTS = 5;
export const LOCK_MINUTES = 30;

/**
 * The member document as the CLIENT is allowed to see it.
 *
 * Anything absent here cannot leak, because this is the only shape the login
 * and session endpoints return. Keep it explicit rather than deleting fields
 * from the raw doc — a denylist silently grows new leaks when the schema does.
 */
export function publicMember(id: string, data: Record<string, unknown>) {
  return {
    id,
    name: data.name as string,
    phone: data.phone as string,
    role: data.role as string,
    titles: (data.titles as string[]) ?? [],
    secondary: (data.secondary as boolean) ?? false,
    representing: (data.representing as string) ?? undefined,
    representedBy: (data.representedBy as string) ?? undefined,
    active: data.active !== false,
    joinedAt: data.joinedAt as string,
    createdAt: data.createdAt as number,
    updatedAt: data.updatedAt as number,
    mustChangePin: (data.mustChangePin as boolean) ?? false,
    claimedAt: data.claimedAt as number | undefined,
  };
}

export interface SecretDoc {
  pinHash: string;
  failedAttempts: number;
  lockedUntil: number | null;
  migratedAt?: number;
}

export async function findMemberByPhone(phone: string) {
  const normalized = normalizePhone(phone);
  const snap = await adminDb.collection('members').where('phone', '==', normalized).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0]!;
  return { id: doc.id, data: doc.data() as Record<string, unknown>, ref: doc.ref };
}

/**
 * Read a member's secrets, tolerating the not-yet-migrated shape.
 *
 * The fallback is what makes the secrets split safe to deploy gradually: a
 * member whose secrets have not moved yet can still log in, and a successful
 * login promotes them. There is no cutover window where someone is locked out.
 */
export async function readSecrets(memberId: string): Promise<SecretDoc | null> {
  const snap = await adminDb.collection('secrets').doc(memberId).get();
  if (snap.exists) {
    const d = snap.data() as SecretDoc;
    return {
      pinHash: d.pinHash,
      failedAttempts: d.failedAttempts ?? 0,
      lockedUntil: d.lockedUntil ?? null,
      migratedAt: d.migratedAt,
    };
  }

  const memberSnap = await adminDb.collection('members').doc(memberId).get();
  if (!memberSnap.exists) return null;
  const d = memberSnap.data() as Record<string, unknown>;
  if (typeof d.pinHash !== 'string' || !d.pinHash) return null;

  return {
    pinHash: d.pinHash,
    failedAttempts: (d.failedAttempts as number) ?? 0,
    lockedUntil: (d.lockedUntil as number | null) ?? null,
  };
}

export async function writeSecrets(
  memberId: string,
  secrets: Partial<SecretDoc>
): Promise<void> {
  await adminDb.collection('secrets').doc(memberId).set(secrets, { merge: true });
}

/**
 * Promote legacy fields out of the member doc on first successful login.
 *
 * Deliberately does NOT delete the old fields — Firestore cannot delete a single
 * key via set(), and the migration script does that once, deliberately. This
 * only seeds the new collection so nothing depends on the script having run.
 */
export async function backfillSecrets(memberId: string, secrets: SecretDoc): Promise<void> {
  await adminDb.collection('secrets').doc(memberId).set(
    { ...secrets, migratedAt: Date.now() },
    { merge: true }
  );
}