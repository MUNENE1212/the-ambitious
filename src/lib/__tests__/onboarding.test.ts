import { describe, it, expect } from 'vitest';
import { isClaimable, isPlaceholderPhone, pinProblem, firstNameOf } from '@/lib/onboarding';

/**
 * Pure-logic tests for the claim rules.
 *
 * These cover the predicates, NOT the transaction — `node scripts/verify-onboarding.mjs`
 * covers the transaction against the emulator. Both are needed: a passing unit
 * test says nothing about whether a replayed nonce is refused, and a passing
 * emulator run says nothing about whether an edge case predicate is right.
 */

describe('isPlaceholderPhone', () => {
  it('accepts the exact shape seed-members.mjs mints', () => {
    expect(isPlaceholderPhone('+254700000001')).toBe(true);
    expect(isPlaceholderPhone('+254700000013')).toBe(true);
    expect(isPlaceholderPhone('+254700000000')).toBe(true);
  });

  it('rejects a real phone', () => {
    expect(isPlaceholderPhone('+254799954672')).toBe(false);
    expect(isPlaceholderPhone('+254712000005')).toBe(false);
  });

  it('rejects near-misses that a looser regex would let through', () => {
    // One digit short/long — a `.*` or an unanchored match would accept these.
    expect(isPlaceholderPhone('+25470000090')).toBe(false);
    expect(isPlaceholderPhone('+2547000009012')).toBe(false);
    // Different shape entirely.
    expect(isPlaceholderPhone('+25470000090a')).toBe(false);
    expect(isPlaceholderPhone('+254800000001')).toBe(false);
    expect(isPlaceholderPhone('0712345678')).toBe(false);
  });

  it('rejects non-strings', () => {
    expect(isPlaceholderPhone(undefined)).toBe(false);
    expect(isPlaceholderPhone(null)).toBe(false);
    expect(isPlaceholderPhone(700000001)).toBe(false);
  });
});

describe('isClaimable', () => {
  const placeholder = { phone: '+254700000001', active: true };

  it('allows an unclaimed active placeholder seat', () => {
    expect(isClaimable(placeholder)).toBe(true);
  });

  it('refuses a seat that has already been claimed', () => {
    expect(isClaimable({ ...placeholder, claimedAt: Date.now() })).toBe(false);
  });

  it('refuses a deactivated seat', () => {
    // Otherwise anyone could claim a seat closed on purpose — and the seeded
    // inactive Admin placeholder would become a live admin account.
    expect(isClaimable({ ...placeholder, active: false })).toBe(false);
  });

  it('refuses a seat that has already been onboarded to a real phone', () => {
    expect(isClaimable({ phone: '+254799954672', active: true, claimedAt: Date.now() })).toBe(false);
  });

  it('refuses a missing document', () => {
    expect(isClaimable(undefined)).toBe(false);
  });

  it('ignores role — claiming must not depend on privilege', () => {
    expect(isClaimable({ ...placeholder, role: 'admin' })).toBe(true);
  });
});

describe('pinProblem', () => {
  it('accepts an ordinary PIN', () => {
    expect(pinProblem('5731')).toBeNull();
    expect(pinProblem('9074')).toBeNull();
    expect(pinProblem('4821')).toBeNull();
  });

  it('rejects anything that is not four digits', () => {
    expect(pinProblem('123')).toBeTruthy();
    expect(pinProblem('12345')).toBeTruthy();
    expect(pinProblem('12a4')).toBeTruthy();
    expect(pinProblem('')).toBeTruthy();
  });

  it('rejects four of the same digit', () => {
    // 0000 is exactly what seed-members.mjs hands every member.
    for (const pin of ['0000', '1111', '2222', '9999']) {
      expect(pinProblem(pin), pin).toBeTruthy();
    }
  });

  it('rejects consecutive runs', () => {
    // 1234 is the first thing anyone tries.
    expect(pinProblem('1234')).toBeTruthy();
    expect(pinProblem('4567')).toBeTruthy();
    expect(pinProblem('7890')).toBeTruthy();
    expect(pinProblem('9876')).toBeTruthy();
  });

  it('still allows PINs that merely contain a run', () => {
    expect(pinProblem('1502')).toBeNull();
    expect(pinProblem('2048')).toBeNull();
  });
});

describe('firstNameOf', () => {
  it('takes the first word, lowercased and trimmed', () => {
    expect(firstNameOf('Faith Njeri')).toBe('faith');
    expect(firstNameOf('  GRACE   Wanjiru ')).toBe('grace');
    expect(firstNameOf('Cecilia')).toBe('cecilia');
  });

  it('survives a missing or blank name without throwing', () => {
    expect(firstNameOf(undefined)).toBe('');
    expect(firstNameOf('')).toBe('');
    expect(firstNameOf('   ')).toBe('');
  });
});
