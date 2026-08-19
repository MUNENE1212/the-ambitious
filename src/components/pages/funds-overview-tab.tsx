'use client';

import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Contribution, Expense, BankTransaction, Investment, hydrateContribution, hydrateExpense, hydrateBankTransaction } from '@/lib/types';
import { useSettings } from '@/lib/hooks';
import { calculateFinancials, formatKES } from '@/lib/financial';
import { Loading } from '@/components/ui/loading';

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
      <div className="bg-gradient-to-br from-amber-900 to-amber-700 rounded-2xl p-5 text-gold-100">
        <p className="text-xs uppercase tracking-wide text-gold-200/80 font-mono">Total Group Funds</p>
        <p className="text-3xl font-bold mt-1 tabular-nums">{formatKES(fin.totalGroupFunds)}</p>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-4 text-xs text-stone-500 font-mono">
        {formatKES(fin.cashOnHand)} cash + {formatKES(fin.bankBalance)} bank + {formatKES(fin.investmentsValue)} investments
        = {formatKES(fin.totalGroupFunds)}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-stone-200 p-4">
          <p className="text-sm text-stone-500">Cash on Hand</p>
          <p className="text-xl font-bold text-stone-800 tabular-nums">{formatKES(fin.cashOnHand)}</p>
        </div>
        <div className="bg-white rounded-xl border border-stone-200 p-4">
          <p className="text-sm text-stone-500">Bank Balance</p>
          <p className="text-xl font-bold text-stone-800 tabular-nums">{formatKES(fin.bankBalance)}</p>
        </div>
        <div className="bg-white rounded-xl border border-stone-200 p-4">
          <p className="text-sm text-stone-500">Investments</p>
          <p className="text-xl font-bold text-stone-800 tabular-nums">{formatKES(fin.investmentsValue)}</p>
        </div>
        <div className="bg-gold-50 border border-gold-200 rounded-xl p-4">
          <p className="text-sm text-stone-600">AGM Party Fund</p>
          <p className="text-xl font-bold text-gold-700 tabular-nums">{formatKES(fin.agmFundBalance)}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-4">
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
