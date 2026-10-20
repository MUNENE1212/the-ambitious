/**
 * The claim rules, as pure functions.
 *
 * Deliberately NOT in `src/lib/server/` and free of any `server-only` import, so
 * the unit suite can assert them directly — a predicate nobody can test is a
 * predicate nobody will notice breaking. The server module imports these; there
 * is exactly one copy of each rule, and nothing re-implements them.
 */

/**
 * The placeholder shape minted by scripts/seed-members.mjs: `+254700000` + 3
 * digits.
 *
 * This is the ONLY thing that makes a seat claimable, and it is what stops an
 * onboarded member — whose real phone no longer matches — from being claimed a
 * second time by anyone.
 */
const PLACEHOLDER_PHONE = /^\+254700000\d{3}$/;

export function isPlaceholderPhone(phone: unknown): boolean {
  return typeof phone === 'string' && PLACEHOLDER_PHONE.test(phone);
}

/**
 * A seat can be claimed only if it has never been claimed, still carries the
 * placeholder phone, and has not been deactivated.
 *
 * `active === false` matters twice over: a member who exited the group should
 * not be re-claimable, and the seeded "Admin" placeholder is inactive — letting
 * anyone claim it would hand them a live admin account.
 */
export function isClaimable(data: Record<string, unknown> | undefined): boolean {
  if (!data) return false;
  if (data.claimedAt) return false;
  if (data.active === false) return false;
  return isPlaceholderPhone(data.phone);
}

/**
 * A PIN the member chose at signup. Rejects the digit runs that make a 4-digit
 * PIN trivially guessable in practice — 0000 is what seed-members.mjs hands
 * every member, and 1234 is the first thing anyone tries.
 *
 * "Run" is computed with wrap-around (7890, 9012 and 0123 count) rather than
 * matched against a literal list. The first version here searched for the PIN
 * inside '0123456789', which silently missed every wrapped run because
 * `includes` does not wrap — a list that looks exhaustive and is not is worse
 * than no list at all.
 *
 * Four digits is a thin secret no matter what; this is the floor, not a
 * substitute for the account lockout and the server-side verification.
 */
export function pinProblem(pin: string): string | null {
  if (!/^\d{4}$/.test(pin)) return 'Your PIN must be exactly 4 digits.';
  if (/^(\d)\1{3}$/.test(pin)) return 'Choose a PIN that is not four of the same digit.';

  const digits = [...pin].map(Number);
  const step = (digits[1]! - digits[0]! + 10) % 10;
  if (step === 1 || step === 9) {
    const rising = step === 1 ? 1 : -1;
    for (let i = 1; i < digits.length; i++) {
      if (digits[i] !== (digits[i - 1]! + rising + 10) % 10) return null;
    }
    return 'Choose a PIN that is not a run of consecutive digits.';
  }

  return null;
}

/** Case- and whitespace-insensitive first-name extraction. */
export function firstNameOf(name: unknown): string {
  return String(name ?? '').trim().split(/\s+/)[0]!.toLowerCase();
}
