import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/server/admin';
import { requireAdmin } from '@/lib/server/guard';
import { normalizePhone } from '@/lib/server/members';
import { revokeAllSessions } from '@/lib/server/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

/** Guard against demoting or deactivating the last remaining admin. */
async function isLastAdmin(excludeId: string): Promise<boolean> {
  const snap = await adminDb.collection('members').where('role', '==', 'admin').get();
  return snap.docs.filter((d) => d.id !== excludeId && d.data().active !== false).length === 0;
}

/**
 * Reset a member's PIN, unlock them, or change their active status.
 *
 * All three were client-side writes before. Two consequences worth naming:
 * an admin writing a hash from the browser shipped it through every proxy and
 * devtools on the way, and the lockout counters an attacker was meant to be
 * constrained by were writable by the client being constrained.
 */
export async function POST(request: Request, { params }: Params) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;

  let body: {
    action?: string;
    pin?: string;
    name?: string;
    phone?: string;
    role?: string;
    titles?: string[];
    secondary?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const memberRef = adminDb.collection('members').doc(id);
  const secretRef = adminDb.collection('secrets').doc(id);
  const now = Date.now();

  switch (body.action) {
    case 'update': {
      // `role` is the dangerous field here. It used to be written straight from
      // the browser, which — with `allow update: if true` — meant any member
      // could set their own role to admin.
      const name = (body.name ?? '').trim();
      if (!name) return NextResponse.json({ error: 'Name is required.' }, { status: 400 });

      const patch: Record<string, unknown> = {
        name,
        role: body.role === 'admin' || body.role === 'manager' ? body.role : 'member',
        titles: (body.titles ?? []).filter((t) => typeof t === 'string'),
        secondary: body.secondary ?? false,
        updatedAt: now,
      };

      if (body.phone) {
        const phone = normalizePhone(body.phone);
        if (!/^\+254\d{9}$/.test(phone)) {
          return NextResponse.json({ error: 'Enter a valid Kenyan phone number.' }, { status: 400 });
        }
        patch.phone = phone;
      }

      // Refuse to strip the last admin, so a mistake cannot lock everyone out
      // of member management.
      if (patch.role !== 'admin' && (await isLastAdmin(id))) {
        return NextResponse.json(
          { error: 'This is the only admin — promote someone else first.' },
          { status: 409 }
        );
      }

      await memberRef.set(patch, { merge: true });
      return NextResponse.json({ success: true });
    }

    case 'reset-pin': {
      const pin = (body.pin ?? '').trim();
      if (!/^\d{4}$/.test(pin)) {
        return NextResponse.json({ error: 'PIN must be exactly 4 digits.' }, { status: 400 });
      }
      const pinHash = await bcrypt.hash(pin, 10);
      await secretRef.set({ pinHash, failedAttempts: 0, lockedUntil: null, migratedAt: now }, { merge: true });
      // secrets/ only — mirroring the hash onto the member doc would undo the
      // point of the split. But an UNMIGRATED member still carries the hash
      // that was there before, and leaving it is the whole vulnerability: the
      // old PIN stays readable to any signed-in member until the migration
      // script eventually runs, which may be never. Clearing it here is what
      // makes "reset this PIN" mean the old one is gone. The onboarding claim
      // path does exactly the same thing.
      await memberRef.set(
        {
          mustChangePin: true,
          pinHash: FieldValue.delete(),
          failedAttempts: FieldValue.delete(),
          lockedUntil: FieldValue.delete(),
          updatedAt: now,
        },
        { merge: true }
      );
      // Anyone who knew the old PIN must lose their session.
      await revokeAllSessions(id);
      return NextResponse.json({ success: true });
    }

    case 'unlock': {
      await secretRef.set({ failedAttempts: 0, lockedUntil: null }, { merge: true });
      // Cleared on the member doc too, while unmigrated members still read it.
      await memberRef.set({ failedAttempts: 0, lockedUntil: null, updatedAt: now }, { merge: true });
      return NextResponse.json({ success: true });
    }

    case 'deactivate': {
      await memberRef.set({ active: false, updatedAt: now }, { merge: true });
      await revokeAllSessions(id);
      return NextResponse.json({ success: true });
    }

    case 'activate': {
      await memberRef.set({ active: true, updatedAt: now }, { merge: true });
      return NextResponse.json({ success: true });
    }

    default:
      return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  }
}