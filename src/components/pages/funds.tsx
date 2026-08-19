'use client';

import { useState } from 'react';
import { FundsOverviewTab } from './funds-overview-tab';
import { ExpensesTab } from './expenses-tab';
import { BankTab } from './bank-tab';
import { AgmFundTab } from './agm-fund-tab';
import { InvestmentsTab } from './investments-tab';

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'bank', label: 'Bank' },
  { id: 'agm', label: 'AGM Fund' },
  { id: 'investments', label: 'Investments' },
];

export function FundsContent() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div>
      <div className="flex border-b border-stone-200 bg-white sticky top-[52px] z-20 overflow-x-auto no-scrollbar">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 min-w-[90px] px-3 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors
              ${activeTab === tab.id ? 'border-amber-700 text-amber-700' : 'border-transparent text-stone-500 hover:text-stone-700'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div>
        {activeTab === 'overview' && <FundsOverviewTab />}
        {activeTab === 'expenses' && <ExpensesTab />}
        {activeTab === 'bank' && <BankTab />}
        {activeTab === 'agm' && <AgmFundTab />}
        {activeTab === 'investments' && <InvestmentsTab />}
      </div>
    </div>
  );
}
