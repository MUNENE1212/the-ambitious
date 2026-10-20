import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/server/guard';
import { canSignForTreasurer } from '@/lib/server/titles';
import { adminDb } from '@/lib/server/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Record a bank transaction.
 *
 * The client used to `addDoc` this itself and hardcode `status: 'approved'`,
 * which meant the constitutional two-signatory rule on withdrawals (PLAN.md
 * Section C) was never applied — a withdrawal moved the bank balance the
 * moment it was typed in. Status is now decided here:
 *
 *   - a deposit takes effect immediately (money arriving is not a risk)
 *   - a withdrawal is written `pending` and only becomes `approved` when two
 *     distinct signatories have signed it (see arrays.ts → approveWithdrawal)
 */
export async function POST(request: Request) {
  const guard = await requireRole('member', 'manager', 'admin');
  if (!guard.ok) return guard.response;

  // canRecordFunds client-side is admin OR treasurer (or the coordinator
  // deputizing for them). Same rule, enforced here where it counts.
  if (guard.caller.role !== 'admin' && !canSignForTreasurer(guard.caller.titles)) {
    return NextResponse.json({ error: 'Only the treasurer can record bank transactions.' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const type = body.type;
  if (type !== 'deposit' && type !== 'withdrawal') {
    return NextResponse.json({ error: 'Type must be deposit or withdrawal.' }, { status: 400 });
  }

  const amount = typeof body.amount === 'number' ? body.amount : parseFloat(String(body.amount ?? ''));
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Enter a valid amount.' }, { status: 400 });
  }

  const date = typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
    ? body.date
    : new Date().toISOString().slice(0, 10);

  const description = typeof body.description === 'string' ? body.description.trim().slice(0, 500) : '';
  const proposalId = typeof body.proposalId === 'string' && body.proposalId ? body.proposalId : null;

  // A withdrawal is checked against the committed balance on the server, not
  // against whatever snapshot the browser happened to be holding.
  if (type === 'withdrawal') {
    const [txSnap, settingsSnap, contributionsSnap, expensesSnap] = await Promise.all([
      adminDb.collection('bankTransactions').get(),
      adminDb.collection('config').doc('settings').get(),
      adminDb.collection('contributions').get(),
      adminDb.collection('expenses').get(),
    ]);

    const openingBank = Number(settingsSnap.data()?.openingBankBalance ?? 0);
    const deposits = txSnap.docs
      .filter(d => d.data().type === 'deposit')
      .reduce((s, d) => s + Number(d.data().amount ?? 0), 0);
    // Only approved withdrawals have left the bank. A pending one has not.
    const withdrawals = txSnap.docs
      .filter(d => d.data().type === 'withdrawal' && d.data().status === 'approved')
      .reduce((s, d) => s + Number(d.data().amount ?? 0), 0);
    const collected = contributionsSnap.docs
      .filter(d => d.data().status === 'Paid')
      .reduce((s, d) => s + Number(d.data().amount ?? 0) + (d.data().finePaid ? Number(d.data().fineAmount ?? 0) : 0), 0);
    const mpesaExpenses = expensesSnap.docs
      .filter(d => d.data().status !== 'rejected' && d.data().paymentMethod === 'Mpesa')
      .reduce((s, d) => s + Number(d.data().amount ?? 0), 0);

    const balance = openingBank + collected + deposits - mpesaExpenses - withdrawals;

    if (amount > balance) {
      return NextResponse.json(
        { error: `Cannot withdraw more than the bank balance (KES ${Math.round(balance).toLocaleString()}).` },
        { status: 400 }
      );
    }
  }

  const memberSnap = await adminDb.collection('members').doc(guard.caller.memberId).get();
  const memberName = (memberSnap.data()?.name as string) ?? 'Member';

  const ref = await adminDb.collection('bankTransactions').add({
    type,
    amount,
    date,
    description,
    proposalId,
    // The whole point: a withdrawal is not approved on write.
    status: type === 'withdrawal' ? 'pending' : 'approved',
    approvals: [],
    seenBy: type === 'withdrawal' ? [] : [{ memberId: guard.caller.memberId, memberName, seenAt: Date.now() }],
    recordedBy: guard.caller.memberId,
    recordedByName: memberName,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  return NextResponse.json({ success: true, id: ref.id, status: type === 'withdrawal' ? 'pending' : 'approved' });
}
