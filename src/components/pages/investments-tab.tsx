'use client';

import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Investment, InvestmentStatus, ForumPost } from '@/lib/types';
import { useAuth } from '@/lib/auth-context';
import { canRecordFunds } from '@/lib/roles';
import { formatKES } from '@/lib/financial';
import { getTimestamp } from '@/lib/utils';
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

const statusVariant: Record<InvestmentStatus, 'default' | 'info' | 'success'> = {
  proposed: 'default', active: 'info', closed: 'success',
};

export function InvestmentsTab() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [proposals, setProposals] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [expectedReturn, setExpectedReturn] = useState('');
  const [proposalId, setProposalId] = useState('');

  const canManage = canRecordFunds(user);

  useEffect(() => {
    const unsubs: (() => void)[] = [];
    unsubs.push(onSnapshot(query(collection(db, 'investments'), orderBy('createdAt', 'desc')), snap => {
      setInvestments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Investment)));
      setLoading(false);
    }));
    unsubs.push(onSnapshot(query(collection(db, 'forumPosts'), orderBy('createdAt', 'desc')), snap => {
      setProposals(snap.docs.map(d => ({ id: d.id, ...d.data() } as ForumPost)).filter(p => p.category === 'Proposal'));
    }));
    return () => unsubs.forEach(u => u());
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !canManage) return;
    const amountNum = parseFloat(amount);
    if (!title.trim() || isNaN(amountNum) || amountNum <= 0) {
      showToast('Enter a title and valid amount', 'error');
      return;
    }
    setSaving(true);
    try {
      await addDoc(collection(db, 'investments'), {
        title: title.trim(),
        description: description.trim(),
        amountInvested: amountNum,
        expectedReturn: expectedReturn ? parseFloat(expectedReturn) : null,
        status: 'active',
        proposalId: proposalId || null,
        recordedBy: user.id,
        recordedByName: user.name,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      showToast('Investment recorded');
      setShowForm(false);
      setTitle(''); setDescription(''); setAmount(''); setExpectedReturn(''); setProposalId('');
    } catch {
      showToast('Failed to save', 'error');
    }
    setSaving(false);
  };

  const closeInvestment = async (inv: Investment) => {
    if (!canManage) return;
    const actual = prompt(`Actual return for "${inv.title}" (KES, 0 if none):`, inv.expectedReturn?.toString() ?? '0');
    if (actual === null) return;
    const actualNum = parseFloat(actual);
    if (isNaN(actualNum)) { showToast('Enter a valid number', 'error'); return; }
    try {
      await updateDoc(doc(db, 'investments', inv.id), {
        status: 'closed', actualReturn: actualNum, updatedAt: getTimestamp(),
      });
      showToast('Investment closed');
    } catch {
      showToast('Failed to update', 'error');
    }
  };

  if (loading) return <Loading />;

  const totalInvested = investments.filter(i => i.status !== 'closed').reduce((s, i) => s + i.amountInvested, 0);

  return (
    <div className="p-4 space-y-4">
      <div className="bg-white rounded-xl border border-stone-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-stone-500">Active Investments</p>
            <p className="text-2xl font-bold text-amber-700 tabular-nums">{formatKES(totalInvested)}</p>
          </div>
          {canManage && <Button onClick={() => setShowForm(true)}>+ Investment</Button>}
        </div>
      </div>

      {investments.length === 0 ? (
        <EmptyState title="No investments yet" description="Record what the group has put money into" />
      ) : (
        <div className="space-y-2">
          {investments.map(inv => (
            <Card key={inv.id}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-stone-800">{inv.title}</p>
                    <Badge variant={statusVariant[inv.status]}>{inv.status}</Badge>
                  </div>
                  {inv.description && <p className="text-sm text-stone-500 mt-1">{inv.description}</p>}
                  <p className="text-xs text-stone-400 mt-1">by {inv.recordedByName}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-stone-800 tabular-nums">{formatKES(inv.amountInvested)}</p>
                  {inv.expectedReturn != null && <p className="text-xs text-stone-400">expects {formatKES(inv.expectedReturn)}</p>}
                  {inv.status === 'closed' && inv.actualReturn != null && (
                    <p className={`text-xs font-medium ${inv.actualReturn >= inv.amountInvested ? 'text-emerald-600' : 'text-red-600'}`}>
                      returned {formatKES(inv.actualReturn)}
                    </p>
                  )}
                </div>
              </div>
              {canManage && inv.status !== 'closed' && (
                <Button size="sm" variant="secondary" onClick={() => closeInvestment(inv)} className="w-full mt-2">
                  Close Out
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Record Investment">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Title" placeholder="e.g. Poultry co-investment" value={title} onChange={e => setTitle(e.target.value)} />
          <Textarea label="Description" placeholder="What is this investment?" value={description} onChange={e => setDescription(e.target.value)} rows={2} />
          <Input label="Amount Invested (KES)" type="number" inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value)} />
          <Input label="Expected Return (KES, optional)" type="number" inputMode="numeric" value={expectedReturn} onChange={e => setExpectedReturn(e.target.value)} />
          {proposals.length > 0 && (
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
