import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { isAdminConfigured } from '@/lib/server/admin';
import {
  findClaimableSeat,
  storeNonce,
} from '@/lib/server/onboarding';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Step 1 of onboarding: find your seat by first name.
 *
 * Unauthenticated by necessity — this is how a member arrives in the first
 * place. It is therefore the most exposed endpoint in the app, and it is kept
 * deliberately dull: it reveals a full name and nothing else, never a phone, a
 * member id, or a credential, and it cannot change anything a member can observe.
 *
 * One throttle sits in front of it: a per-process counter by client IP.
 *
 * Be honest about what this buys. It does NOT stop someone claiming a seat they
 * should not — that takes one lookup and one POST, and no request-rate limit can
 * prevent it. What actually holds the line is that a seat can only ever be
 * claimed once, after which it is invisible to this endpoint forever. The
 * counter only blunts slow enumeration of who is on the roster.
 *
 * The number is therefore set for the shared-IP case, not for a lone attacker.
 * Kenyan mobile networks put many subscribers behind one carrier-grade NAT
 * address, so all thirteen members can arrive from a single IP. A limit tuned
 * for "one person" would lock the whole group out mid-onboarding, which is a far
 * likelier event than a scripted harvest. 60 per 10 minutes covers every member
 * signing up from one address several times over, and still stops a loop.
 */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_LOOKUPS_PER_WINDOW = 60;
const attempts = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || entry.resetAt <= now) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_LOOKUPS_PER_WINDOW;
}

// Bound the map so a spray of spoofed addresses cannot grow it without limit.
if (typeof setInterval !== 'undefined') {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of attempts) if (entry.resetAt <= now) attempts.delete(ip);
  }, WINDOW_MS);
  timer.unref?.();
}

function clientIp(hdrs: Headers): string {
  return (
    hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    hdrs.get('x-real-ip') ||
    'unknown'
  );
}

export async function POST(request: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { success: false, error: 'Setup is not available on this server.' },
      { status: 503 }
    );
  }

  const hdrs = await headers();
  const ip = clientIp(hdrs);

  if (rateLimited(ip)) {
    return NextResponse.json(
      { success: false, error: 'Too many attempts. Please wait a few minutes and try again.' },
      { status: 429 }
    );
  }

  let body: { firstName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request.' }, { status: 400 });
  }

  const firstName = (body.firstName ?? '').trim();
  if (firstName.length < 2) {
    return NextResponse.json(
      { success: false, error: 'Enter your first name.' },
      { status: 400 }
    );
  }

  const seats = await findClaimableSeat(firstName);

  if (seats.length === 0) {
    // One message for "no such member" and "already set up". Distinguishing them
    // would let a caller enumerate who has onboarded — which is membership
    // status, and in a group this size that is itself identifying.
    return NextResponse.json({
      success: true,
      matches: [],
      message:
        'We could not find an unclaimed account with that first name. Check the spelling, or ask your admin.',
    });
  }

  // Mint and persist a single-use nonce per matched seat. Persisting it is what
  // makes completion unforgeable: the client only ever holds an opaque string
  // that the server can revoke, and minting a new one retires the old.
  const ready: { fullName: string; token: string }[] = [];
  for (const seat of seats) {
    await storeNonce(seat.id, seat.nonce);
    ready.push({ fullName: seat.fullName, token: seat.nonce });
  }

  return NextResponse.json({
    success: true,
    matches: ready,
    ...(ready.length > 1
      ? { message: 'More than one unclaimed account starts with that name — pick yours.' }
      : {}),
  });
}
