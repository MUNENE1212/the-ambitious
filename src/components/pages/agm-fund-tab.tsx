'use client';

import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Contribution, Expense, Member, hydrateContribution, hydrateExpense, hydrateMember } from '@/lib/types';
import { useSettings } from '@/lib/hooks';
import { calculateFinancials, formatKES } from '@/lib/financial';
import { nextAgmDate } from '@/lib/groupYear';
import { Loading } from '@/components/ui/loading';
import { Card } from '@/components/ui/card';
import { format } from 'date-fns';

export function AgmFundTab() {
  const { settings } = useSettings();
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubs: (() => void)[] = [];
    unsubs.push(onSnapshot(collection(db, 'contributions'), snap => {
      setContributions(snap.docs.map(d => hydrateContribution(d.id, d.data())));
    }));
    unsubs.push(onSnapshot(collection(db, 'expenses'), snap => {
      setExpenses(snap.docs.map(d => hydrateExpense(d.id, d.data())));
    }));
    unsubs.push(onSnapshot(collection(db, 'members'), snap => {
      setMembers(snap.docs.map(d => hydrateMember(d.id, d.data())));
      setLoading(false);
    }));
    return () => unsubs.forEach(u => u());
  }, []);

  if (loading) return <Loading />;

  const fin = calculateFinancials({
    contributions, expenses, bankTransactions: [], investments: [], settings,
  });
  const partyExpenses = expenses
    .filter(e => e.category === 'AGM Party' && e.status !== 'rejected')
    .sort((a, b) => b.date.localeCompare(a.date));
  const balance = fin.agmFundBalance;
  const agm = nextAgmDate(settings.agmDate);
  const monthsLeft = Math.max(
    0,
    (new Date(agm).getFullYear() - new Date().getFullYear()) * 12
      + (new Date(agm).getMonth() - new Date().getMonth())
  );
  const activeCount = members.filter(m => m.active).length;
  // Every remaining month bills each active member one more meeting fee.
  const stillToCome = monthsLeft * activeCount * settings.meetingFee;
  const projected = balance + fin.agmOutstanding + stillToCome;
  const perHead = activeCount > 0 ? projected / activeCount : 0;

  return (
    <div className="p-4 space-y-4">
      <div className="bg-gold-50 border border-gold-200 rounded-2xl shadow-soft p-4">
        <p className="text-sm text-stone-600">Available now for the AGM</p>
        <p className="text-3xl font-bold text-gold-700 tabular-nums">{formatKES(balance)}</p>
        <p className="text-xs text-stone-500 mt-1">
          {formatKES(settings.meetingFee)} of every monthly contribution is the meeting fee and belongs to this fund.
          Accrues from one AGM to the next — this cycle began {fin.agmCycleStart}.
        </p>
      </div>

      <Card title={`Budget for the AGM on ${format(new Date(agm), 'd MMM yyyy')}`}>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-stone-600">Accrued from paid months</span>
            <span className="font-medium tabular-nums">{formatKES(fin.agmAccrued)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-600">Already spent this cycle</span>
            <span className="font-medium tabular-nums text-red-600">−{formatKES(fin.agmSpentThisCycle)}</span>
          </div>
          <div className="flex justify-between border-t border-stone-100 pt-2">
            <span className="text-stone-700 font-medium">Available now</span>
            <span className="font-bold tabular-nums">{formatKES(balance)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-600">If unpaid months are collected</span>
            <span className="font-medium tabular-nums text-emerald-600">+{formatKES(fin.agmOutstanding)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-600">
              {monthsLeft} more month{monthsLeft === 1 ? '' : 's'} × {activeCount} members
            </span>
            <span className="font-medium tabular-nums text-emerald-600">+{formatKES(stillToCome)}</span>
          </div>
          <div className="flex justify-between border-t border-stone-200 pt-2">
            <span className="text-stone-800 font-semibold">Projected at AGM</span>
            <span className="font-bold text-gold-700 tabular-nums">{formatKES(projected)}</span>
          </div>
          <p className="text-xs text-stone-500 pt-1">
            About {formatKES(perHead)} per member to budget with.
          </p>
        </div>
      </Card>

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
