'use client';

import { useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { useSettings } from '@/lib/hooks';
import { DEFAULT_EXPENSE_CATEGORIES } from '@/lib/constants';
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
      const data: Record<string, unknown> = {
        groupName: v('groupName', settings.groupName).trim() || settings.groupName,
        groupShortName: v('groupShortName', settings.groupShortName).trim() || settings.groupShortName,

        entryFee: parseFloat(v('entryFee', settings.entryFee.toString())) || 0,
        monthlyContributionPrimary: parseFloat(v('monthlyPrimary', settings.monthlyContributionPrimary.toString())) || 0,
        monthlyContributionSecondary: parseFloat(v('monthlySecondary', settings.monthlyContributionSecondary.toString())) || 0,
        meetingFee: parseFloat(v('meetingFee', settings.meetingFee.toString())) || 0,
        memberCap: parseInt(v('memberCap', settings.memberCap.toString())) || settings.memberCap,

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
            <Input label="Monthly Contribution — Primary Member (KES)" type="number" inputMode="numeric" value={val('monthlyPrimary', settings.monthlyContributionPrimary.toString())} onChange={set('monthlyPrimary')} />
            <Input label="Monthly Contribution — Secondary/Minor Member (KES)" type="number" inputMode="numeric" value={val('monthlySecondary', settings.monthlyContributionSecondary.toString())} onChange={set('monthlySecondary')} />
            <Input label="Meeting Fee — AGM Party Fund (KES)" type="number" inputMode="numeric" value={val('meetingFee', settings.meetingFee.toString())} onChange={set('meetingFee')} />
            <Input label="Member Cap" type="number" inputMode="numeric" value={val('memberCap', settings.memberCap.toString())} onChange={set('memberCap')} />
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
