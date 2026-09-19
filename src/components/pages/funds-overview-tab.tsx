'use client';

import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Contribution, Expense, BankTransaction, Investment, hydrateContribution, hydrateExpense, hydrateBankTransaction } from '@/lib/types';
import { useSettings } from '@/lib/hooks';
import { calculateFinancials, formatKES } from '@/lib/financial';
import { Loading } from '@/components/ui/loading';
import { StatCard } from '@/components/ui/stat-card';

export function FundsOverviewTab() {
  const { settings, loading: settingsLoading } = useSettings();
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [bankTx, setBankTx] = useState<BankTransaction[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubs: (() => void)[] = [];
    unsubs.push(onSnapshot(collection(db, 'contributions'), snap => setContributions(snap.docs.map(d => hydrateContribution(d.id, d.data())))));
    unsubs.push(onSnapshot(collection(db, 'expenses'), snap => setExpenses(snap.docs.map(d => hydrateExpense(d.id, d.data())))));
    unsubs.push(onSnapshot(collection(db, 'bankTransactions'), snap => setBankTx(snap.docs.map(d => hydrateBankTransaction(d.id, d.data())))));
    unsubs.push(onSnapshot(collection(db, 'investments'), snap => {
      setInvestments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Investment)));
      setLoading(false);
    }));
    return () => unsubs.forEach(u => u());
  }, []);

  if (loading || settingsLoading) return <Loading />;

  const fin = calculateFinancials({ contributions, expenses, bankTransactions: bankTx, investments, settings });

  return (
    <div className="p-4 space-y-4">
      <div className="relative overflow-hidden rounded-3xl bg-brand-gradient shadow-hero p-5 pt-6 text-white">
        <div aria-hidden className="absolute -top-16 -right-10 w-48 h-48 rounded-full bg-gold-300/15 blur-2xl" />
        <div className="relative">
          <p className="eyebrow text-gold-200/90">Total Group Funds</p>
          <p className="text-4xl font-bold mt-2 tabular-nums tracking-tight">{formatKES(fin.totalGroupFunds)}</p>
          <p className="text-xs text-gold-200/70 mt-2 tabular-nums">
            {formatKES(fin.cashOnHand)} cash + {formatKES(fin.bankBalance)} bank + {formatKES(fin.investmentsValue)} investments
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Cash on Hand" value={formatKES(fin.cashOnHand)} hint="held outside the bank" />
        <StatCard label="Bank Balance" value={formatKES(fin.bankBalance)} hint="held by the treasurer" />
        <StatCard label="Investments" value={formatKES(fin.investmentsValue)} hint="open positions" />
        <div className="rounded-2xl bg-gold-50 border border-gold-200 shadow-soft p-3.5">
          <p className="eyebrow text-gold-600/80">AGM Party Fund</p>
          <p className="text-lg font-bold text-gold-700 tabular-nums mt-1.5 leading-tight">{formatKES(fin.agmFundBalance)}</p>
          <p className="text-xs text-gold-600/70 mt-0.5">ring-fenced</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200/70 shadow-soft p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-stone-500">Net Income (all-time)</span>
          <span className={`font-bold tabular-nums ${fin.netIncome >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {formatKES(fin.netIncome)}
          </span>
        </div>
        <div className="flex items-center justify-between mt-2 text-sm text-stone-400">
          <span>Contributions collected</span>
          <span className="tabular-nums">{formatKES(fin.totalContributionsCollected)}</span>
        </div>
        <div className="flex items-center justify-between text-sm text-stone-400">
          <span>Expenses</span>
          <span className="tabular-nums">{formatKES(fin.totalExpenses)}</span>
        </div>
      </div>

      {(fin.unseenExpensesCount > 0 || fin.unseenWithdrawalsCount > 0) && (
        <p className="text-xs text-amber-700 text-center">
          {fin.unseenExpensesCount + fin.unseenWithdrawalsCount} item(s) awaiting member review — see Expenses / Bank tabs
        </p>
      )}
    </div>
  );
}
