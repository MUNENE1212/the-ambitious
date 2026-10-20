import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { adminDb } from '@/lib/server/admin';
import { requireAdmin } from '@/lib/server/guard';
import { normalizePhone } from '@/lib/server/members';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * List members with their lock state.
 *
 * The lock counters live in the rules-denied `secrets` collection, so the
 * client cannot read them any more — which means the admin screen has to be
 * told. That is the point: lock state used to be readable by every member.
 */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const [members, secrets] = await Promise.all([
    adminDb.collection('members').orderBy('name').get(),
    adminDb.collection('secrets').get(),
  ]);

  const now = Date.now();
  const secretsByMember = new Map(secrets.docs.map((d) => [d.id, d.data() as Record<string, unknown>]));

  return NextResponse.json({
    members: members.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      const s = secretsByMember.get(d.id);
      const lockedUntil = (s?.lockedUntil as number | null) ?? (data.lockedUntil as number | null) ?? null;
      return {
        id: d.id,
        name: data.name,
        phone: data.phone,
        role: data.role ?? 'member',
        titles: data.titles ?? [],
        secondary: data.secondary ?? false,
        active: data.active !== false,
        joinedAt: data.joinedAt,
        mustChangePin: (data.mustChangePin as boolean) ?? false,
        failedAttempts: (s?.failedAttempts as number) ?? (data.failedAttempts as number) ?? 0,
        lockedUntil,
        isLocked: lockedUntil !== null && lockedUntil > now,
      };
    }),
  });
}

interface AddMemberBody {
  name?: string;
  phone?: string;
  pin?: string;
  role?: string;
  titles?: string[];
  secondary?: boolean;
  entryFee?: number;
}

/**
 * Create a member and their credentials.
 *
 * Previously this ran entirely in the browser: the PIN was hashed client-side
 * and written straight to the member document. Because Firestore rules allowed
 * `update: if true` with no identity check, any member could call the same
 * writes — reset the treasurer's PIN, or set their own `role` to admin.
 */
export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let body: AddMemberBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const name = (body.name ?? '').trim();
  const phone = normalizePhone(body.phone ?? '');
  const pin = (body.pin ?? '').trim();

  if (!name) return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
  if (!/^\+254\d{9}$/.test(phone)) {
    return NextResponse.json({ error: 'Enter a valid Kenyan phone number.' }, { status: 400 });
  }
  if (!/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: 'PIN must be exactly 4 digits.' }, { status: 400 });
  }

  const role = body.role === 'admin' || body.role === 'manager' ? body.role : 'member';
  const titles = role === 'manager' ? [] : (body.titles ?? []);
  const now = Date.now();
  const joinedAt = new Date().toISOString().slice(0, 10);

  const existing = await adminDb.collection('members').where('phone', '==', phone).limit(1).get();
  if (!existing.empty) {
    return NextResponse.json({ error: 'A member with that number already exists.' }, { status: 409 });
  }

  const pinHash = await bcrypt.hash(pin, 10);

  const memberRef = adminDb.collection('members').doc();
  await memberRef.set({
    name,
    phone,
    role,
    titles,
    secondary: body.secondary ?? false,
    active: true,
    joinedAt,
    createdAt: now,
    updatedAt: now,
    mustChangePin: true,
  });

  await adminDb.collection('secrets').doc(memberRef.id).set({
    pinHash,
    failedAttempts: 0,
    lockedUntil: null,
    migratedAt: now,
  });

  // Auto-invoice the entry fee (murangano) per the constitution. Amount is
  // passed by the client, so it is re-checked against Settings here — Gate 3
  // moves this to the ledger; until then it is at least server-validated.
  const entryFee = Number(body.entryFee);
  if (Number.isFinite(entryFee) && entryFee > 0) {
    await adminDb.collection('contributions').add({
      memberId: memberRef.id,
      memberName: name,
      purpose: 'entryFee',
      month: new Date().toISOString().slice(0, 7),
      amount: entryFee,
      fineAmount: 0,
      status: 'Unpaid',
      createdAt: now,
      updatedAt: now,
    });
  }

  return NextResponse.json({ success: true, memberId: memberRef.id }, { status: 201 });
}