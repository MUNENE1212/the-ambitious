'use client';

import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Expense, PaymentMethod, SeenBy, hydrateExpense } from '@/lib/types';
import { PAYMENT_METHODS, DEFAULT_EXPENSE_CATEGORIES } from '@/lib/constants';
import { useAuth } from '@/lib/auth-context';
import { useSettings } from '@/lib/hooks';
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
import { format } from 'date-fns';

export function ExpensesTab() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const { showToast } = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [category, setCategory] = useState('Other');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');

  useEffect(() => {
    return onSnapshot(
      query(collection(db, 'expenses'), orderBy('createdAt', 'desc')),
      (snap) => {
        setExpenses(snap.docs.map(d => hydrateExpense(d.id, d.data())));
        setLoading(false);
      }
    );
  }, []);

  const categories = settings.expenseCategories ?? DEFAULT_EXPENSE_CATEGORIES;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      showToast('Enter valid amount', 'error');
      return;
    }

    setSaving(true);
    try {
      const seenBy: SeenBy[] = [{ memberId: user.id, memberName: user.name, seenAt: getTimestamp() }];
      await addDoc(collection(db, 'expenses'), {
        date,
        category,
        amount: amountNum,
        notes: notes.trim(),
        paymentMethod,
        status: 'verified',
        votes: [],
        seenBy,
        recordedBy: user.id,
        recordedByName: user.name,
        createdAt: Date.now(),
      });
      showToast('Expense recorded');
      setShowForm(false);
      setAmount('');
      setNotes('');
      setCategory('Other');
      setPaymentMethod('Cash');
      setDate(format(new Date(), 'yyyy-MM-dd'));
    } catch {
      showToast('Failed to save expense', 'error');
    }
    setSaving(false);
  };

  const handleMarkSeen = async (expense: Expense) => {
    if (!user) return;
    if (expense.seenBy.some(s => s.memberId === user.id)) return;
    try {
      const entry = { memberId: user.id, memberName: user.name, seenAt: getTimestamp() };
      await updateDoc(doc(db, 'expenses', expense.id), { seenBy: arrayUnion(entry) });
    } catch {
      showToast('Failed to mark as seen', 'error');
    }
  };

  if (loading) return <Loading />;

  const activeExpenses = expenses.filter(e => e.status !== 'rejected');
  const totalAmount = activeExpenses.reduce((sum, e) => sum + e.amount, 0);
  const unseenCount = activeExpenses.filter(e => e.seenBy.length === 0).length;

  const categoryColors: Record<string, string> = {
    'AGM Party': 'gold', Welfare: 'info', Administration: 'default', Investment: 'success', Other: 'default',
  };

  return (
    <div className="p-4 space-y-4">
      <div className="bg-white rounded-2xl border border-stone-200/70 shadow-soft p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-stone-500">Total Expenses</p>
            <p className="text-2xl font-bold text-red-600">{formatKES(totalAmount)}</p>
          </div>
          <Button onClick={() => setShowForm(true)}>+ Expense</Button>
        </div>
      </div>

      {/* Unseen notice (informational) */}
      {user && unseenCount > 0 && (
        <p className="text-xs text-amber-700">
          {unseenCount} expense{unseenCount === 1 ? '' : 's'} awaiting member review
        </p>
      )}

      {/* Expenses List */}
      {activeExpenses.length === 0 ? (
        <EmptyState title="No expenses yet" description="Record your first expense" />
      ) : (
        <div className="space-y-2">
          {activeExpenses.map(exp => {
            const hasSeen = !!user && exp.seenBy.some(s => s.memberId === user.id);
            return (
              <Card key={exp.id}>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant={(categoryColors[exp.category] ?? 'default') as 'default' | 'success' | 'warning' | 'info' | 'gold'}>
                          {exp.category}
                        </Badge>
                        <Badge variant={exp.paymentMethod === 'Cash' ? 'default' : 'info'}>
                          {exp.paymentMethod === 'Mpesa' ? 'M-Pesa' : 'Cash'}
                        </Badge>
                      </div>
                      {exp.notes && <p className="text-sm text-stone-500 mt-1">{exp.notes}</p>}
                      <p className="text-xs text-stone-400 mt-1">
                        {format(new Date(exp.date), 'dd MMM yyyy')}
                        {exp.recordedByName && ` | by ${exp.recordedByName}`}
                      </p>
                    </div>
                    <p className="font-bold text-stone-800">{formatKES(exp.amount)}</p>
                  </div>
                  <SeenByLine seenBy={exp.seenBy} />
                  {user && !hasSeen && (
                    <Button size="sm" variant="secondary" onClick={() => handleMarkSeen(exp)} className="w-full">
                      Mark as Seen
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Record Expense">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} />
          <Select
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            options={categories.map(c => ({ value: c, label: c }))}
          />
          <Select
            label="Payment Method"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
            options={PAYMENT_METHODS.map(m => ({ value: m, label: m === 'Mpesa' ? 'M-Pesa (from Bank)' : m }))}
          />
          <Input
            label="Amount (KES)" type="number" inputMode="numeric" placeholder="0"
            value={amount} onChange={e => setAmount(e.target.value)}
          />
          {amount && (
            <div className="bg-amber-50 rounded-lg p-3 text-xs text-stone-500">
              {formatKES(parseFloat(amount) || 0)} → from {paymentMethod === 'Mpesa' ? 'Bank' : 'Cash on Hand'}
            </div>
          )}
          <Textarea label="Notes" placeholder="Description..." value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
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