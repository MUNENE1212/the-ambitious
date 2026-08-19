'use client';

import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Contribution, Expense, hydrateContribution, hydrateExpense } from '@/lib/types';
import { useSettings } from '@/lib/hooks';
import { formatKES } from '@/lib/financial';
import { Loading } from '@/components/ui/loading';
import { Card } from '@/components/ui/card';
import { format } from 'date-fns';

export function AgmFundTab() {
  const { settings } = useSettings();
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubs: (() => void)[] = [];
    unsubs.push(onSnapshot(collection(db, 'contributions'), snap => {
      setContributions(snap.docs.map(d => hydrateContribution(d.id, d.data())));
    }));
    unsubs.push(onSnapshot(collection(db, 'expenses'), snap => {
      setExpenses(snap.docs.map(d => hydrateExpense(d.id, d.data())));
      setLoading(false);
    }));
    return () => unsubs.forEach(u => u());
  }, []);

  if (loading) return <Loading />;

  const meetingFeeContribs = contributions.filter(c => c.purpose === 'meetingFee' && c.status === 'Paid');
  const collected = meetingFeeContribs.reduce((s, c) => s + c.amount + c.fineAmount, 0);
  const partyExpenses = expenses.filter(e => e.category === 'AGM Party' && e.status !== 'rejected');
  const spent = partyExpenses.reduce((s, e) => s + e.amount, 0);
  const balance = settings.openingAgmFundBalance + collected - spent;

  return (
    <div className="p-4 space-y-4">
      <div className="bg-gold-50 border border-gold-200 rounded-xl p-4">
        <p className="text-sm text-stone-600">AGM Party Fund</p>
        <p className="text-2xl font-bold text-gold-700 tabular-nums">{formatKES(balance)}</p>
        <p className="text-xs text-stone-500 mt-1">
          Ring-fenced — every meeting&apos;s {formatKES(settings.meetingFee)}/member fee lands here instead of buying
          refreshments. Spent down each October at the AGM.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-stone-200 p-4">
          <p className="text-sm text-stone-500">Collected</p>
          <p className="text-xl font-bold text-emerald-600 tabular-nums">{formatKES(collected)}</p>
        </div>
        <div className="bg-white rounded-xl border border-stone-200 p-4">
          <p className="text-sm text-stone-500">Spent</p>
          <p className="text-xl font-bold text-red-600 tabular-nums">{formatKES(spent)}</p>
        </div>
      </div>

      {partyExpenses.length > 0 && (
        <Card title="AGM Party Spending">
          <div className="space-y-2">
            {partyExpenses.map(e => (
              <div key={e.id} className="flex items-center justify-between text-sm py-1">
                <div>
                  <p className="text-stone-700">{e.notes || 'AGM Party expense'}</p>
                  <p className="text-xs text-stone-400">{format(new Date(e.date), 'dd MMM yyyy')}</p>
                </div>
                <p className="font-medium text-stone-800">{formatKES(e.amount)}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <p className="text-xs text-stone-400 text-center">
        Add AGM Party spending from the Expenses tab, category &quot;AGM Party&quot;.
      </p>
    </div>
  );
}
