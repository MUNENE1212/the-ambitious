import 'server-only';
import { randomBytes } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import bcrypt from 'bcryptjs';
import { adminDb } from './admin';
import { normalizePhone } from './members';
import { isClaimable, isPlaceholderPhone, pinProblem, firstNameOf } from '@/lib/onboarding';

/**
 * The claim RULES live in `src/lib/onboarding.ts` as pure functions so the unit
 * suite can assert them; this module owns only the Firestore side. Re-exported
 * here so API routes have a single import for "everything onboarding".
 */
export { isClaimable, isPlaceholderPhone, pinProblem, firstNameOf };

/**
 * Self-service onboarding: a member finds their seat by first name, then sets
 * their own phone number and PIN.
 *
 * The roster arrives from seed-members.mjs with placeholder phone numbers
 * (+254700000001…) and PIN 0000. Until a member claims their seat those
 * placeholders are live credentials — anyone can log in as anyone. Claiming is
 * therefore not a convenience, it is the step that closes that hole: it replaces
 * the placeholder phone, replaces the PIN with one the member chose, and
 * deletes the client-readable `pinHash` from the member document.
 *
 * ## Why a first name is enough here, and what still guards it
 *
 * The group is a closed roster of people who know each other, and all 13 names
 * are distinct, so first-name matching resolves without ambiguity. That is a
 * deliberate product choice, not an oversight. What makes it safe enough:
 *
 *   - A seat is claimable ONLY while it still carries a placeholder phone and
 *     has never been claimed. The first person to claim "Faith" takes the seat;
 *     the real Faith then has to ask the admin. That is the accepted trade.
 *   - Claiming cannot escalate: it never writes `role`, `titles` or `active`.
 *   - The nonce is single-use and consumed inside the claiming transaction.
 *   - Phone uniqueness is enforced in that same transaction.
 *   - Lookups are throttled (see below) so the roster cannot be harvested.
 *
 * A claim code per member would close the "wrong person claims first" gap. That
 * was the alternative offered and declined; it is a one-line change to this
 * module if the group later wants it.
 */

/**
 * No per-seat lookup cooldown, deliberately.
 *
 * An earlier draft put one here. It bought almost nothing — the per-IP limiter
 * in the lookup route is the actual control against harvesting the roster, and
 * re-minting a nonce is harmless because each mint invalidates the last. What it
 * did cost was real: a member who reached step 2, tapped "start over", and came
 * back would be told to wait. Throttling is not a substitute for thinking about
 * whether the thing being throttled is a legitimate user.
 */

export interface ClaimMatch {
  id: string;
  fullName: string;
  nonce: string;
}

/**
 * Find an unclaimed seat by first name and mint a single-use nonce.
 *
 * The roster is a few dozen documents at most and is read with the Admin SDK,
 * so matching in JS rather than a Firestore range query is both simpler and
 * more forgiving: it ignores case, stray whitespace, and the `nameAliases`
 * mapping (e.g. "Cecilia Gichuhi" -> "Cecilia Wanjiru") that seed-members.mjs
 * carries for members known by more than one name.
 */
export async function findClaimableSeat(firstName: string): Promise<ClaimMatch[]> {
  const wanted = firstName.trim().toLowerCase();
  if (!wanted) return [];

  const snap = await adminDb.collection('members').get();
  const matches: ClaimMatch[] = [];

  for (const doc of snap.docs) {
    const data = doc.data() as Record<string, unknown>;
    if (!isClaimable(data)) continue;

    const name = String(data.name ?? '');
    const aliasFirsts = ((data.nameAliases as string[]) ?? []).map(firstNameOf);
    if (firstNameOf(name) === wanted || aliasFirsts.includes(wanted)) {
      matches.push({ id: doc.id, fullName: name, nonce: randomBytes(16).toString('hex') });
    }
  }

  return matches;
}

/** Record that a nonce was issued, so the seat can be claimed with it. */
export async function storeNonce(memberId: string, nonce: string): Promise<void> {
  await adminDb
    .collection('members')
    .doc(memberId)
    .set({ claimNonce: nonce, claimNonceAt: Date.now() }, { merge: true });
}

/** Clear a nonce after use or after the cooldown lapses. */
export async function clearNonce(memberId: string): Promise<void> {
  await adminDb
    .collection('members')
    .doc(memberId)
    .set({ claimNonce: FieldValue.delete(), claimNonceAt: FieldValue.delete() }, { merge: true });
}

export type ClaimOutcome =
  | { ok: true; memberId: string }
  | { ok: false; status: number; error: string };

/**
 * Complete a claim: set the phone, set the PIN, consume the nonce.
 *
 * One transaction, and the check that decides is the check that commits — the
 * same rule the voting and withdrawal fixes established. Phone uniqueness is
 * queried inside the transaction so two members cannot both claim one number.
 *
 * The bcrypt hash is computed BEFORE the transaction opens: at ~100ms it would
 * blow the transaction deadline, and Firestore retries would recompute it.
 */
export async function completeClaim(
  memberId: string,
  nonce: string,
  phone: string,
  pinHash: string,
  audit: { ip: string; userAgent?: string }
): Promise<ClaimOutcome> {
  const normalized = normalizePhone(phone);

  // A phone we cannot possibly own, rejected before touching Firestore.
  if (!/^\+254\d{9}$/.test(normalized)) {
    return { ok: false, status: 400, error: 'Enter a valid Kenyan phone number, e.g. 0712345678.' };
  }

  const memberRef = adminDb.collection('members').doc(memberId);
  const secretRef = adminDb.collection('secrets').doc(memberId);
  const now = Date.now();

  try {
    return await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(memberRef);
      const data = snap.data() as Record<string, unknown> | undefined;

      if (!data || !isClaimable(data)) {
        return { ok: false, status: 409, error: 'This seat has already been set up.' } as const;
      }
      if (data.claimNonce !== nonce) {
        return { ok: false, status: 409, error: 'This setup link has expired. Please start again.' } as const;
      }

      // Uniqueness inside the transaction: two simultaneous claims on the same
      // number cannot both see "free".
      const taken = await tx.get(
        adminDb.collection('members').where('phone', '==', normalized).limit(1)
      );
      if (!taken.empty && taken.docs[0]!.id !== memberId) {
        return {
          ok: false,
          status: 409,
          error: 'That phone number is already registered to another member.',
        } as const;
      }

      tx.update(memberRef, {
        phone: normalized,
        // The audit trail the constitution requires — no silent overwrites.
        claimedAt: now,
        claimedFrom: audit.ip,
        claimNonce: FieldValue.delete(),
        claimNonceAt: FieldValue.delete(),
        // The whole point of the split: the hash leaves the client-readable
        // document and lives only in rules-denied `secrets/`.
        pinHash: FieldValue.delete(),
        updatedAt: now,
      });

      tx.set(secretRef, {
        pinHash,
        failedAttempts: 0,
        lockedUntil: null,
        migratedAt: now,
        claimedAt: now,
      });

      return { ok: true, memberId } as const;
    });
  } catch (err) {
    console.error('[onboarding] claim transaction failed', err);
    return {
      ok: false,
      status: 503,
      error: 'Could not finish setting up your account. Please try again.',
    };
  }
}

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10);
}
