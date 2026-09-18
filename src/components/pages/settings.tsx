'use client';

import { useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { useSettings } from '@/lib/hooks';
import { DEFAULT_EXPENSE_CATEGORIES } from '@/lib/constants';
import { currentGroupYear, recentGroupYears } from '@/lib/groupYear';
import { canAdminister } from '@/lib/roles';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Loading } from '@/components/ui/loading';
import { Badge } from '@/components/ui/badge';

export function SettingsContent() {
  const { user } = useAuth();
  const { settings, loading } = useSettings();
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<string[] | null>(null);
  const [newCategory, setNewCategory] = useState('');

  const isAdmin = canAdminister(user);
  const currentCategories = categories ?? settings.expenseCategories ?? DEFAULT_EXPENSE_CATEGORIES;
  const protectedCategories = ['AGM Party', 'Other'];

  const val = (key: string, settingsValue: string) => overrides[key] ?? settingsValue;
  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => setOverrides(prev => ({ ...prev, [key]: e.target.value }));

  // Group years with editable rates: the two around the current one plus any
  // year already recorded in settings (e.g. rates set at a previous AGM).
  const rateYears = Array.from(new Set([
    ...Object.keys(settings.contributionRates ?? {}),
    ...recentGroupYears(),
  ])).sort();

  const addCategory = () => {
    const name = newCategory.trim();
    if (!name) return;
    if (currentCategories.includes(name)) { showToast('Category already exists', 'error'); return; }
    setCategories([...currentCategories, name]);
    setNewCategory('');
  };
  const removeCategory = (cat: string) => {
    if (protectedCategories.includes(cat)) return;
    setCategories(currentCategories.filter(c => c !== cat));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    const v = (key: string, fallback: string) => overrides[key] ?? fallback;

    setSaving(true);
    try {
      // Per-group-year rates, seeded from current settings, overridden by the form
      const rates: Record<string, { primary: number; secondary: number }> = {};
      for (const yr of rateYears) {
        const existing = settings.contributionRates?.[yr];
        rates[yr] = {
          primary: parseFloat(v(`rate-${yr}-primary`, (existing?.primary ?? 0).toString())) || 0,
          secondary: parseFloat(v(`rate-${yr}-secondary`, (existing?.secondary ?? 0).toString())) || 0,
        };
      }
      // Mirror the current group year's rate into the legacy flat fields
      const currentRate = rates[currentGroupYear()]
        ?? { primary: settings.monthlyContributionPrimary, secondary: settings.monthlyContributionSecondary };

      const data: Record<string, unknown> = {
        groupName: v('groupName', settings.groupName).trim() || settings.groupName,
        groupShortName: v('groupShortName', settings.groupShortName).trim() || settings.groupShortName,

        entryFee: parseFloat(v('entryFee', settings.entryFee.toString())) || 0,
        monthlyContributionPrimary: currentRate.primary,
        monthlyContributionSecondary: currentRate.secondary,
        contributionRates: rates,
        meetingFee: parseFloat(v('meetingFee', settings.meetingFee.toString())) || 0,
        memberCap: parseInt(v('memberCap', settings.memberCap.toString())) || settings.memberCap,

        autoDuesFrom: v('autoDuesFrom', settings.autoDuesFrom).trim() || settings.autoDuesFrom,
        contributionCutoffDay: parseInt(v('cutoffDay', settings.contributionCutoffDay.toString())) || settings.contributionCutoffDay,
        lateContributionFine: parseFloat(v('lateFine', settings.lateContributionFine.toString())) || 0,
        virtualAbsenceFine: parseFloat(v('virtualFine', settings.virtualAbsenceFine.toString())) || 0,
        agmAbsenceFine: parseFloat(v('agmFine', settings.agmAbsenceFine.toString())) || 0,

        welfareParentDeath: parseFloat(v('welfareParent', settings.welfareParentDeath.toString())) || 0,
        welfareNuclearDeath: parseFloat(v('welfareNuclear', settings.welfareNuclearDeath.toString())) || 0,
        welfareMemberDeath: parseFloat(v('welfareMember', settings.welfareMemberDeath.toString())) || 0,

        exitDeductionPct: (parseFloat(v('exitDeduction', (settings.exitDeductionPct * 100).toString())) || 0) / 100,
        agmDate: v('agmDate', settings.agmDate).trim() || settings.agmDate,

        expenseCategories: currentCategories,

        openingCashBalance: parseFloat(v('openingCash', settings.openingCashBalance.toString())) || 0,
        openingBankBalance: parseFloat(v('openingBank', settings.openingBankBalance.toString())) || 0,
        openingAgmFundBalance: parseFloat(v('openingAgmFund', settings.openingAgmFundBalance.toString())) || 0,
        openingBalancesSet: true,
      };

      await setDoc(doc(db, 'config', 'settings'), data);
      showToast('Settings saved');
    } catch {
      showToast('Failed to save settings', 'error');
    }
    setSaving(false);
  };

  if (loading) return <Loading />;
  if (!isAdmin) return (
    <div className="p-4"><Card><p className="text-stone-500 text-center">Only admins can access settings</p></Card></div>
  );

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-bold text-stone-800">Settings</h2>
      <p className="text-xs text-stone-400 -mt-2">
        Defaults are seeded from the Y&amp;A constitution — every figure here is editable.
      </p>

      <form onSubmit={handleSave} className="space-y-4">
        <Card>
          <div className="space-y-4">
            <p className="text-sm font-medium text-stone-700">Group Identity</p>
            <Input label="Group Name" value={val('groupName', settings.groupName)} onChange={set('groupName')} />
            <Input label="Short Name (top bar)" value={val('groupShortName', settings.groupShortName)} onChange={set('groupShortName')} />
          </div>
        </Card>

        <Card>
          <div className="space-y-4">
            <p className="text-sm font-medium text-stone-700">Membership &amp; Dues</p>
            <Input label="Entry Fee — Murangano (KES)" type="number" inputMode="numeric" value={val('entryFee', settings.entryFee.toString())} onChange={set('entryFee')} />
            <div className="space-y-2">
              <p className="text-xs text-stone-400">Monthly contribution rates per group year (July–June). Members who are secondary/minors pay the secondary rate.</p>
              {rateYears.map(yr => (
                <div key={yr} className="space-y-2 rounded-lg border border-stone-100 p-3">
                  <p className="text-sm font-medium text-stone-700">{yr}{yr === currentGroupYear() && <span className="ml-1 text-xs text-amber-600">(current)</span>}</p>
                  <Input
                    label="Primary Member (KES)"
                    type="number"
                    inputMode="numeric"
                    value={val(`rate-${yr}-primary`, (settings.contributionRates?.[yr]?.primary ?? 0).toString())}
                    onChange={set(`rate-${yr}-primary`)}
                  />
                  <Input
                    label="Secondary/Minor Member (KES)"
                    type="number"
                    inputMode="numeric"
                    value={val(`rate-${yr}-secondary`, (settings.contributionRates?.[yr]?.secondary ?? 0).toString())}
                    onChange={set(`rate-${yr}-secondary`)}
                  />
                </div>
              ))}
            </div>
            <Input label="Meeting Fee — AGM Party Fund (KES)" type="number" inputMode="numeric" value={val('meetingFee', settings.meetingFee.toString())} onChange={set('meetingFee')} />
            <Input label="Member Cap" type="number" inputMode="numeric" value={val('memberCap', settings.memberCap.toString())} onChange={set('memberCap')} />
          </div>
        </Card>

        <Card>
          <div className="space-y-4">
            <p className="text-sm font-medium text-stone-700">Automation</p>
            <Input
              label="Auto-generate monthly dues from"
              type="month"
              value={val('autoDuesFrom', settings.autoDuesFrom)}
              onChange={set('autoDuesFrom')}
            />
            <p className="text-xs text-stone-400">
              From this month onward the app generates each month&apos;s dues automatically on first
              visit. Months before it are entered manually by the treasurer (Ledger Entry).
              Set to the AGM month — {'2026-10'} for the 2026/27 year.
            </p>
          </div>
        </Card>

        <Card>
          <div className="space-y-4">
            <p className="text-sm font-medium text-stone-700">Fines &amp; Penalties</p>
            <Input label="Contribution Cutoff Day (of the following month)" type="number" inputMode="numeric" value={val('cutoffDay', settings.contributionCutoffDay.toString())} onChange={set('cutoffDay')} />
            <Input label="Late Contribution Fine (KES)" type="number" inputMode="numeric" value={val('lateFine', settings.lateContributionFine.toString())} onChange={set('lateFine')} />
            <Input label="Virtual Meeting Absence Fine (KES)" type="number" inputMode="numeric" value={val('virtualFine', settings.virtualAbsenceFine.toString())} onChange={set('virtualFine')} />
            <Input label="AGM Absence Fine (KES)" type="number" inputMode="numeric" value={val('agmFine', settings.agmAbsenceFine.toString())} onChange={set('agmFine')} />
          </div>
        </Card>

        <Card>
          <div className="space-y-4">
            <p className="text-sm font-medium text-stone-700">Welfare Payouts</p>
            <Input label="Parent's Death (KES)" type="number" inputMode="numeric" value={val('welfareParent', settings.welfareParentDeath.toString())} onChange={set('welfareParent')} />
            <Input label="Nuclear Family Death (KES)" type="number" inputMode="numeric" value={val('welfareNuclear', settings.welfareNuclearDeath.toString())} onChange={set('welfareNuclear')} />
            <Input label="Member's Death (KES)" type="number" inputMode="numeric" value={val('welfareMember', settings.welfareMemberDeath.toString())} onChange={set('welfareMember')} />
          </div>
        </Card>

        <Card>
          <div className="space-y-4">
            <p className="text-sm font-medium text-stone-700">Exit &amp; Meetings</p>
            <Input label="Voluntary Exit Deduction (%)" type="number" inputMode="numeric" value={val('exitDeduction', (settings.exitDeductionPct * 100).toString())} onChange={set('exitDeduction')} />
            <Input label="AGM Date (MM-DD)" placeholder="10-20" value={val('agmDate', settings.agmDate)} onChange={set('agmDate')} />
          </div>
        </Card>

        <Card>
          <p className="text-sm font-medium text-stone-700 mb-3">Expense Categories</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {currentCategories.map(cat => (
              <Badge key={cat} variant={protectedCategories.includes(cat) ? 'default' : 'info'}>
                {cat}
                {!protectedCategories.includes(cat) && (
                  <button type="button" onClick={() => removeCategory(cat)} className="ml-1 text-xs hover:text-red-600">x</button>
                )}
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input placeholder="New category..." value={newCategory} onChange={(e) => setNewCategory(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCategory())} />
            <Button type="button" variant="secondary" onClick={addCategory}>Add</Button>
          </div>
        </Card>

        <Card>
          <div className="space-y-4">
            <p className="text-sm font-medium text-stone-700">Opening Balances</p>
            <Input label="Opening Cash on Hand (KES)" type="number" inputMode="numeric" value={val('openingCash', settings.openingCashBalance.toString())} onChange={set('openingCash')} />
            <Input label="Opening Bank Balance (KES)" type="number" inputMode="numeric" value={val('openingBank', settings.openingBankBalance.toString())} onChange={set('openingBank')} />
            <Input label="Opening AGM Party Fund (KES)" type="number" inputMode="numeric" value={val('openingAgmFund', settings.openingAgmFundBalance.toString())} onChange={set('openingAgmFund')} />
          </div>
        </Card>

        <Button type="submit" loading={saving} className="w-full">Save Settings</Button>
      </form>
    </div>
  );
}
