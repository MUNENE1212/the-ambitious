import 'server-only';
import { NextResponse } from 'next/server';
import { adminDb } from './admin';
import { resolveSession } from './session';

export interface Caller {
  memberId: string;
  role: string;
  titles: string[];
}

export type Guard = { ok: true; caller: Caller } | { ok: false; response: NextResponse };

/**
 * Resolve the caller and check their role server-side.
 *
 * This is the first real authorization check in the app's history. Every
 * previous check — `isAdmin` in the admin page, the PIN in login — was client
 * state, and Firestore rules were `allow write: if true`, so none of them were
 * enforced anywhere that mattered.
 */
export async function requireRole(...allowed: string[]): Promise<Guard> {
  const memberId = await resolveSession();
  if (!memberId) {
    return { ok: false, response: NextResponse.json({ error: 'Not signed in.' }, { status: 401 }) };
  }

  const snap = await adminDb.collection('members').doc(memberId).get();
  if (!snap.exists) {
    return { ok: false, response: NextResponse.json({ error: 'Not signed in.' }, { status: 401 }) };
  }

  const data = snap.data() as Record<string, unknown>;
  if (data.active === false) {
    return { ok: false, response: NextResponse.json({ error: 'Membership inactive.' }, { status: 403 }) };
  }

  const role = (data.role as string) ?? 'member';
  const titles = ((data.titles as string[]) ?? []).map((t) => t.toLowerCase());

  if (!allowed.includes(role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'You do not have permission to do that.' }, { status: 403 }),
    };
  }

  return { ok: true, caller: { memberId, role, titles } };
}

export const requireAdmin = () => requireRole('admin');