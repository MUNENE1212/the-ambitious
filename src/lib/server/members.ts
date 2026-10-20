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
  /** Carried so a counter write can find the document it belongs to. */
  memberId: string;
  pinHash: string;
  failedAttempts: number;
  lockedUntil: number | null;
  migratedAt?: number;
  /**
   * Which collection supplied the values above.
   *
   * Not cosmetic. The lockout counter has to be incremented in the document it
   * was READ from: an unmigrated member's counter lives in `members/`, and
   * writing the increment to `secrets/` instead would leave the read and the
   * write in different documents — the counter would climb where nobody looks
   * and the lockout would never fire.
   */
  source: 'secrets' | 'members';
}

/** True when a pinHash is a value bcrypt can actually be handed. */
function usableHash(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
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
 *
 * The fallback triggers on a MISSING pinHash, not merely a missing document.
 * Both matter, and the second is the one that bit: three code paths write a
 * secrets document without a hash — the failed-attempt counter in login, the
 * admin Unlock action, and writeSecrets — so a member could end up with a
 * secrets doc that exists and is empty of the one field that matters. Reading
 * that as authoritative handed bcrypt an undefined hash, which throws, which
 * surfaced to the member as a bare 500 on every attempt, correct PIN included.
 * One mistyped PIN was enough to lock a seat out permanently.
 */
export async function readSecrets(memberId: string): Promise<SecretDoc | null> {
  const snap = await adminDb.collection('secrets').doc(memberId).get();
  if (snap.exists) {
    const d = snap.data() as SecretDoc;
    if (usableHash(d.pinHash)) {
      return {
        memberId,
        pinHash: d.pinHash,
        failedAttempts: d.failedAttempts ?? 0,
        lockedUntil: d.lockedUntil ?? null,
        migratedAt: d.migratedAt,
        source: 'secrets',
      };
    }
    // A secrets doc with no hash is not a migrated member. Fall through.
  }

  const memberSnap = await adminDb.collection('members').doc(memberId).get();
  if (!memberSnap.exists) return null;
  const d = memberSnap.data() as Record<string, unknown>;
  if (!usableHash(d.pinHash)) return null;

  return {
    memberId,
    pinHash: d.pinHash,
    failedAttempts: (d.failedAttempts as number) ?? 0,
    lockedUntil: (d.lockedUntil as number | null) ?? null,
    source: 'members',
  };
}

/**
 * Increment the failed-attempt counter in the document it was read from.
 *
 * A transaction, so parallel attempts cannot race the counter past the lockout
 * threshold — a client-side increment was resettable by the client it was meant
 * to constrain.
 */
export async function recordFailedAttempt(secrets: SecretDoc): Promise<number> {
  const ref =
    secrets.source === 'secrets'
      ? adminDb.collection('secrets').doc(secrets.memberId)
      : adminDb.collection('members').doc(secrets.memberId);
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current =
      (snap.data() as { failedAttempts?: number } | undefined)?.failedAttempts ?? 0;
    const attempts = current + 1;
    const patch: Record<string, number | null> = { failedAttempts: attempts };
    if (attempts >= MAX_ATTEMPTS) {
      patch.lockedUntil = Date.now() + LOCK_MINUTES * 60 * 1000;
    }
    tx.set(ref, patch, { merge: true });
    return attempts;
  });
}

/**
 * Clear the lockout counters in the document that holds them.
 *
 * Deliberately does not touch `secrets/` for an unmigrated member. Writing
 * there is what created a hashless secrets doc in the first place; the counter
 * for those members lives in `members/`, which is also what the admin screen
 * reads to show the lock indicator.
 */
export async function clearLockout(secrets: SecretDoc): Promise<void> {
  const ref =
    secrets.source === 'secrets'
      ? adminDb.collection('secrets').doc(secrets.memberId)
      : adminDb.collection('members').doc(secrets.memberId);
  await ref.set({ failedAttempts: 0, lockedUntil: null }, { merge: true });
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
  // Counters are written as zero, not spread from `secrets`. The caller has
  // already cleared them on the document it read from, and `secrets` is the
  // value captured before that — copying it verbatim would carry a stale
  // failedAttempts across the migration, and a stale lockedUntil with it.
  await adminDb.collection('secrets').doc(memberId).set(
    { pinHash: secrets.pinHash, failedAttempts: 0, lockedUntil: null, migratedAt: Date.now() },
    { merge: true }
  );
}