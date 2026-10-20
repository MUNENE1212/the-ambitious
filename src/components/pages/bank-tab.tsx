'use client';

import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { BankTransaction, ForumPost, SeenBy, hydrateBankTransaction } from '@/lib/types';
import { useAuth } from '@/lib/auth-context';
import { canRecordFunds, canVote } from '@/lib/roles';
import { formatKES } from '@/lib/financial';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { Loading } from '@/components/ui/loading';
import { EmptyState } from '@/components/ui/empty-state';
import { format } from 'date-fns';

export function BankTab() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [proposals, setProposals] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [type, setType] = useState<'deposit' | 'withdrawal'>('deposit');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [description, setDescription] = useState('');
  const [proposalId, setProposalId] = useState('');

  const isAdmin = canRecordFunds(user);

  useEffect(() => {
    const unsubs: (() => void)[] = [];
    unsubs.push(onSnapshot(
      query(collection(db, 'bankTransactions'), orderBy('createdAt', 'desc')),
      (snap) => {
        setTransactions(snap.docs.map(d => hydrateBankTransaction(d.id, d.data())));
        setLoading(false);
      }
    ));
    unsubs.push(onSnapshot(
      query(collection(db, 'forumPosts'), orderBy('createdAt', 'desc')),
      (snap) => {
        setProposals(
          snap.docs
            .map(d => ({ id: d.id, ...d.data() } as ForumPost))
            .filter(p => p.category === 'Proposal')
        );
      }
    ));
    return () => unsubs.forEach(u => u());
  }, []);

  // Only approved withdrawals have moved money out of the bank. A pending one is
  // recorded but not yet authorised, so it is shown but not subtracted.
  const totalDeposits = transactions.filter(t => t.type === 'deposit').reduce((s, t) => s + t.amount, 0);
  const totalWithdrawals = transactions
    .filter(t => t.type === 'withdrawal' && t.status === 'approved')
    .reduce((s, t) => s + t.amount, 0);
  const bankBalance = totalDeposits - totalWithdrawals;
  const unseenWithdrawalsCount = transactions.filter(t => t.type === 'withdrawal' && t.seenBy.length === 0).length;
  const pendingWithdrawals = transactions.filter(t => t.type === 'withdrawal' && t.status !== 'approved');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !isAdmin) return;

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      showToast('Enter valid amount', 'error');
      return;
    }
    if (type === 'withdrawal' && amountNum > bankBalance) {
      showToast('Cannot withdraw more than bank balance', 'error');
      return;
    }

    setSaving(true);
    try {
      // The server decides status and re-checks the balance against committed
      // data — the snapshot above is only for the early client-side nudge.
      const res = await fetch('/api/bank-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ type, amount: amountNum, date, description: description.trim(), proposalId: proposalId || null }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; status?: string };
      if (!res.ok) {
        showToast(data.error || 'Failed to save', 'error');
        return;
      }
      showToast(
        data.status === 'pending'
          ? 'Withdrawal recorded — awaiting a second signatory'
          : 'Cash deposited to bank'
      );
      setShowForm(false);
      setAmount('');
      setDescription('');
      setProposalId('');
      setDate(format(new Date(), 'yyyy-MM-dd'));
    } catch {
      showToast('Failed to save', 'error');
    }
    setSaving(false);
  };

  const handleApprove = async (tx: BankTransaction) => {
    if (!user) return;
    setBusyId(tx.id);
    try {
      const res = await fetch(`/api/bank-transactions/${tx.id}/approve`, {
        method: 'POST',
        credentials: 'same-origin',
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; status?: string };
      if (!res.ok) {
        showToast(data.error || 'Failed to sign', 'error');
        return;
      }
      showToast(data.status === 'approved' ? 'Withdrawal approved — funds released' : 'Signature recorded');
    } catch {
      showToast('Failed to sign', 'error');
    }
    setBusyId(null);
  };

  const handleMarkSeen = async (tx: BankTransaction) => {
    if (!user) return;
    if (tx.seenBy.some(s => s.memberId === user.id)) return;
    try {
      const res = await fetch('/api/seen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ collection: 'bankTransactions', id: tx.id }),
      });
      if (!res.ok) showToast('Failed to mark as seen', 'error');
    } catch {
      showToast('Failed to mark as seen', 'error');
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-stone-200/70 shadow-soft p-4">
          <p className="text-sm text-stone-500">Cash to Bank</p>
          <p className="text-xl font-bold text-emerald-600">{formatKES(totalDeposits)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200/70 shadow-soft p-4">
          <p className="text-sm text-stone-500">Bank to Cash</p>
          <p className="text-xl font-bold text-red-600">{formatKES(totalWithdrawals)}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200/70 shadow-soft p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-stone-500">Bank Balance</p>
            <p className="text-2xl font-bold text-amber-700">{formatKES(bankBalance)}</p>
          </div>
          {isAdmin && <Button onClick={() => setShowForm(true)}>+ Transaction</Button>}
        </div>
      </div>

      {/* Unseen notice (informational) */}
      {user && unseenWithdrawalsCount > 0 && (
        <p className="text-xs text-amber-700">
          {unseenWithdrawalsCount} withdrawal{unseenWithdrawalsCount === 1 ? '' : 's'} awaiting member review
        </p>
      )}

      {/* Withdrawals recorded but not yet carrying two signatories. The
          constitution requires two, so these do not move the balance until the
          second signature lands. */}
      {pendingWithdrawals.length > 0 && (
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-stone-700">
              {pendingWithdrawals.length} withdrawal{pendingWithdrawals.length === 1 ? '' : 's'} awaiting signatures
            </p>
            <Badge variant="warning">Not yet released</Badge>
          </div>
          <p className="text-xs text-stone-400 mt-1">
            Two signatories are required before funds leave the bank.
          </p>
          <div className="space-y-2 mt-3">
            {pendingWithdrawals.map(tx => {
              const alreadySigned = tx.approvals.some(a => a.memberId === user?.id);
              const isRecorder = tx.recordedBy === user?.id;
              const canSign = !!user && canVote(user) && !alreadySigned && !isRecorder;
              return (
                <div key={tx.id} className="flex items-center justify-between gap-2 text-sm">
                  <div>
                    <p className="text-stone-700">{formatKES(tx.amount)}</p>
                    <p className="text-xs text-stone-400">
                      by {tx.recordedByName || 'a member'}
                      {tx.approvals.length > 0 &&
                        ` · signed by ${tx.approvals.map(a => a.memberName).join(', ')}`}
                    </p>
                  </div>
                  {isRecorder ? (
                    <span className="text-xs text-stone-400 italic">You recorded this</span>
                  ) : alreadySigned ? (
                    <span className="text-xs text-stone-400 italic">You signed this</span>
                  ) : canSign ? (
                    <Button size="sm" loading={busyId === tx.id} onClick={() => handleApprove(tx)}>
                      Sign
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Transaction List */}
      {transactions.length === 0 ? (
        <EmptyState title="No bank transactions" description="Record deposits and withdrawals here" />
      ) : (
        <div className="space-y-2">
          {transactions.map(tx => {
            const hasSeen = !!user && tx.seenBy.some(s => s.memberId === user.id);
            return (
              <Card key={tx.id}>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant={tx.type === 'deposit' ? 'success' : 'danger'}>
                          {tx.type === 'deposit' ? 'Cash to Bank' : 'Bank to Cash'}
                        </Badge>
                        {tx.type === 'withdrawal' && tx.status !== 'approved' && (
                          <Badge variant="warning">Awaiting signature</Badge>
                        )}
                      </div>
                      {tx.description && <p className="text-sm text-stone-500 mt-1">{tx.description}</p>}
                      <p className="text-xs text-stone-400 mt-1">
                        {format(new Date(tx.date), 'dd MMM yyyy')}
                        {tx.recordedByName && ` | by ${tx.recordedByName}`}
                      </p>
                    </div>
                    <p className={`font-bold ${tx.type === 'deposit' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {tx.type === 'deposit' ? '+' : '-'}{formatKES(tx.amount)}
                    </p>
                  </div>
                  <SeenByLine seenBy={tx.seenBy} />
                  {user && !hasSeen && (
                    <Button size="sm" variant="secondary" onClick={() => handleMarkSeen(tx)} className="w-full">
                      Mark as Seen
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Bank Transaction">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select
            label="Type"
            value={type}
            onChange={e => setType(e.target.value as 'deposit' | 'withdrawal')}
            options={[
              { value: 'deposit', label: 'Cash to Bank (Deposit)' },
              { value: 'withdrawal', label: 'Bank to Cash (Withdrawal)' },
            ]}
          />
          <Input label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} />
          <Input label="Amount (KES)" type="number" inputMode="numeric" placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} />
          <Textarea label="Description" placeholder="Transaction description..." value={description} onChange={e => setDescription(e.target.value)} rows={2} />
          {type === 'deposit' && proposals.length > 0 && (
            <Select
              label="Link to Proposal (optional)"
              value={proposalId}
              onChange={e => setProposalId(e.target.value)}
              options={[{ value: '', label: 'None' }, ...proposals.map(p => ({ value: p.id, label: p.title }))]}
            />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)} className="flex-1">Cancel</Button>
            <Button type="submit" loading={saving} className="flex-1">Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function SeenByLine({ seenBy }: { seenBy: SeenBy[] }) {
  if (seenBy.length === 0) {
    return <p className="text-xs text-stone-400 italic">Not yet seen by any member</p>;
  }
  const names = seenBy.map(s => s.memberName).join(', ');
  return <p className="text-xs text-stone-500">Seen by: <span className="text-stone-700">{names}</span></p>;
}