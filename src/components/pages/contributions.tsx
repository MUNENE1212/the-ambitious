'use client';

import { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Contribution, ContributionStatus, Member, PaymentMethod, hydrateMember, hydrateContribution } from '@/lib/types';
import { useAuth } from '@/lib/auth-context';
import { useSettings } from '@/lib/hooks';
import { canVerifyPayments, isSavingsGroupMember } from '@/lib/roles';
import { extractMpesaCode } from '@/lib/mpesa';
import { contributionCutoffDate, findOverdueContributions } from '@/lib/fines';
import { currentGroupYear, currentMonthKey, groupYearForMonth, groupYearLabel, monthsInGroupYear, rateFor } from '@/lib/groupYear';
import { formatKES } from '@/lib/financial';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Loading } from '@/components/ui/loading';
import { EmptyState } from '@/components/ui/empty-state';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';

interface LedgerRow {
  member: Member;
  existing?: Contribution;
  mode: 'skip' | 'paid' | 'unpaid';
  amount: string;
  fine: string;
  method: PaymentMethod;
  code: string;
  paidDate: string;
}

export function ContributionsContent() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const { showToast } = useToast();
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'monthly' | 'meetingFee'>('monthly');

  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [selectedContrib, setSelectedContrib] = useState<Contribution | null>(null);
  const [mpesaInput, setMpesaInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyContrib, setVerifyContrib] = useState<Contribution | null>(null);
  const [treasurerMpesaInput, setTreasurerMpesaInput] = useState('');
  const [verifying, setVerifying] = useState(false);

  const [generating, setGenerating] = useState(false);
  const canVerify = canVerifyPayments(user);
  const fineCheckDone = useRef(false);

  // Month manager + ledger entry (treasurer backfill)
  const [showMonths, setShowMonths] = useState(false);
  const [showLedger, setShowLedger] = useState(false);
  const [ledgerMonth, setLedgerMonth] = useState<string | null>(null);
  const [ledgerRows, setLedgerRows] = useState<LedgerRow[]>([]);
  const [savingLedger, setSavingLedger] = useState(false);

  useEffect(() => {
    const unsubs: (() => void)[] = [];
    unsubs.push(onSnapshot(
      query(collection(db, 'contributions'), orderBy('createdAt', 'desc')),
      (snap) => {
        setContributions(snap.docs.map(d => hydrateContribution(d.id, d.data())));
        setLoading(false);
      }
    ));
    unsubs.push(onSnapshot(collection(db, 'members'), (snap) => {
      setMembers(snap.docs.map(d => hydrateMember(d.id, d.data())));
    }));
    return () => unsubs.forEach(u => u());
  }, []);

  // Auto-fine sweep: monthly dues unpaid past the cutoff (5th of the following month by default)
  useEffect(() => {
    if (loading || fineCheckDone.current || contributions.length === 0) return;
    fineCheckDone.current = true;
    const overdue = findOverdueContributions(contributions, settings.contributionCutoffDay);
    overdue.forEach(c => {
      updateDoc(doc(db, 'contributions', c.id), {
        status: 'Late',
        fineAmount: settings.lateContributionFine,
        updatedAt: Date.now(),
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, contributions]);

  const activeMembers = members.filter(m => m.active && isSavingsGroupMember(m));

  /** Generate monthly dues for ANY month at that group year's rate (fills missing members). */
  const generateForMonth = async (month: string) => {
    if (!canVerify) return;
    setGenerating(true);
    try {
      const existing = contributions.filter(c => c.purpose === 'monthly' && c.month === month);
      const existingIds = new Set(existing.map(c => c.memberId));
      const missing = activeMembers.filter(m => !existingIds.has(m.id));
      if (missing.length === 0) {
        showToast(`All ${existing.length} records already exist for ${format(new Date(month + '-01'), 'MMMM yyyy')}`, 'info');
        setGenerating(false);
        return;
      }
      const { primary, secondary } = rateFor(settings, month);
      for (const member of missing) {
        await addDoc(collection(db, 'contributions'), {
          memberId: member.id,
          memberName: member.name,
          purpose: 'monthly',
          month,
          amount: member.secondary ? secondary : primary,
          fineAmount: 0,
          status: 'Unpaid',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
      showToast(`Generated ${missing.length} dues records for ${format(new Date(month + '-01'), 'MMMM yyyy')}`);
    } catch {
      showToast('Failed to generate', 'error');
    }
    setGenerating(false);
  };

  const generateMeetingFee = async () => {
    if (!canVerify) return;
    setGenerating(true);
    try {
      const month = format(new Date(), 'yyyy-MM');
      for (const member of activeMembers) {
        await addDoc(collection(db, 'contributions'), {
          memberId: member.id,
          memberName: member.name,
          purpose: 'meetingFee',
          month,
          amount: settings.meetingFee,
          fineAmount: 0,
          status: 'Unpaid',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
      showToast(`Generated ${activeMembers.length} meeting-fee records — funds the AGM Party Fund`);
    } catch {
      showToast('Failed to generate', 'error');
    }
    setGenerating(false);
  };

  /** Open the per-month ledger entry sheet, prefilled from existing records + that year's rate. */
  const openLedger = (month: string) => {
    setLedgerMonth(month);
    const { primary, secondary } = rateFor(settings, month);
    const rows: LedgerRow[] = activeMembers.map(member => {
      const existing = contributions.find(
        c => c.purpose === 'monthly' && c.month === month && c.memberId === member.id
      );
      return {
        member,
        existing,
        mode: existing ? (existing.status === 'Paid' ? 'paid' : 'unpaid') : 'skip',
        amount: (existing?.amount ?? (member.secondary ? secondary : primary)).toString(),
        fine: (existing?.fineAmount ?? 0).toString(),
        method: existing?.paymentMethod ?? 'Cash',
        code: existing?.mpesaCode ?? '',
        paidDate: existing?.paidDate ?? '',
      };
    });
    setLedgerRows(rows);
    setShowMonths(false);
    setShowLedger(true);
  };

  const updateRow = (idx: number, patch: Partial<LedgerRow>) => {
    setLedgerRows(prev => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  /**
   * Save & confirm the month. Status rules for unpaid rows:
   *  - months before `autoDuesFrom` (paper era) → 'Late' with the entered fine
   *    (closed history; the auto-fine sweep ignores non-Unpaid records)
   *  - automation-era months past their cutoff → 'Late' + constitutional fine (same as the sweep)
   *  - otherwise → 'Unpaid' (the sweep will fine it if it becomes overdue)
   */
  const saveLedger = async () => {
    if (!user || !ledgerMonth) return;
    setSavingLedger(true);
    const cutoffPassed = new Date() > contributionCutoffDate(ledgerMonth, settings.contributionCutoffDay);
    let written = 0;
    try {
      for (const row of ledgerRows) {
        if (row.mode === 'skip') continue;
        const amount = parseFloat(row.amount) || 0;
        const fine = parseFloat(row.fine) || 0;

        let status: ContributionStatus;
        let extra: Record<string, unknown>;
        if (row.mode === 'paid') {
          status = 'Paid';
          extra = {
            paymentMethod: row.method,
            mpesaCode: row.code.trim() || null,
            mpesaMessage: row.existing?.mpesaMessage ?? (row.code.trim() ? undefined : 'Entered by treasurer via Ledger Entry'),
            paidDate: row.paidDate || null,
            recordedBy: row.existing?.recordedBy ?? user.id,
          };
        } else if (ledgerMonth < settings.autoDuesFrom) {
          status = 'Late';
          extra = { fineAmount: fine, mpesaCode: null, paidDate: null, paymentMethod: null };
        } else if (cutoffPassed) {
          status = 'Late';
          extra = { fineAmount: settings.lateContributionFine, mpesaCode: null, paidDate: null, paymentMethod: null };
        } else {
          status = 'Unpaid';
          extra = { fineAmount: fine, mpesaCode: null, paidDate: null, paymentMethod: null };
        }

        const base = {
          memberId: row.member.id,
          memberName: row.member.name,
          purpose: 'monthly' as const,
          month: ledgerMonth,
          amount,
          fineAmount: fine,
          updatedAt: Date.now(),
        };

        if (row.existing) {
          await updateDoc(doc(db, 'contributions', row.existing.id), { ...base, status, ...extra });
        } else {
          await addDoc(collection(db, 'contributions'), { ...base, status, ...extra, createdAt: Date.now() });
        }
        written++;
      }
      showToast(written === 0 ? 'Nothing to save — all rows skipped' : `Ledger confirmed — ${written} record${written === 1 ? '' : 's'} saved`);
      setShowLedger(false);
      setLedgerMonth(null);
      setLedgerRows([]);
    } catch {
      showToast('Failed to save ledger', 'error');
    }
    setSavingLedger(false);
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContrib || !user) return;
    const code = extractMpesaCode(mpesaInput);
    if (!code) {
      showToast('Could not extract M-Pesa code. Enter a valid code or paste the full SMS.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await updateDoc(doc(db, 'contributions', selectedContrib.id), {
        status: 'Pending',
        mpesaCode: code,
        mpesaMessage: mpesaInput.trim(),
        updatedAt: Date.now(),
      });
      showToast('Payment submitted for verification');
      setShowSubmitModal(false);
      setSelectedContrib(null);
      setMpesaInput('');
    } catch {
      showToast('Failed to submit', 'error');
    }
    setSubmitting(false);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyContrib || !user) return;
    if (verifyContrib.memberId === user.id) {
      showToast('You cannot verify your own contribution', 'error');
      return;
    }
    const code = extractMpesaCode(treasurerMpesaInput);
    if (!code) {
      showToast('Could not extract M-Pesa code', 'error');
      return;
    }
    if (code !== verifyContrib.mpesaCode) {
      showToast('Codes do not match. Verification failed.', 'error');
      return;
    }
    setVerifying(true);
    try {
      await updateDoc(doc(db, 'contributions', verifyContrib.id), {
        status: 'Paid',
        paidDate: format(new Date(), 'yyyy-MM-dd'),
        verifiedBy: user.id,
        verifiedAt: Date.now(),
        paymentMethod: 'Mpesa',
        treasurerMpesaCode: code,
        updatedAt: Date.now(),
      });
      showToast('Payment verified');
      setShowVerifyModal(false);
      setVerifyContrib(null);
      setTreasurerMpesaInput('');
    } catch {
      showToast('Failed to verify', 'error');
    }
    setVerifying(false);
  };

  const handleReject = async () => {
    if (!verifyContrib || !user) return;
    setVerifying(true);
    try {
      await updateDoc(doc(db, 'contributions', verifyContrib.id), {
        status: 'Unpaid',
        mpesaCode: null,
        mpesaMessage: null,
        updatedAt: Date.now(),
      });
      showToast('Payment rejected');
      setShowVerifyModal(false);
      setVerifyContrib(null);
      setTreasurerMpesaInput('');
    } catch {
      showToast('Failed to reject', 'error');
    }
    setVerifying(false);
  };

  if (loading) return <Loading />;

  const currentContribs = contributions.filter(c => c.purpose === activeTab);
  const totalCollected = currentContribs.filter(c => c.status === 'Paid').reduce((s, c) => s + c.amount + c.fineAmount, 0);
  const pendingCount = currentContribs.filter(c => c.status === 'Pending').length;
  const unpaidCount = currentContribs.filter(c => c.status === 'Unpaid' || c.status === 'Late').length;

  const months = new Map<string, Contribution[]>();
  currentContribs.forEach(c => {
    const existing = months.get(c.month) || [];
    existing.push(c);
    months.set(c.month, existing);
  });

  const pendingItems = currentContribs.filter(c => c.status === 'Pending');

  // Months grouped under group-year (Jul–Jun) section headers
  const fySections = new Map<string, Map<string, Contribution[]>>();
  Array.from(months.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .forEach(([month, contribs]) => {
      const fy = groupYearForMonth(month);
      if (!fySections.has(fy)) fySections.set(fy, new Map());
      fySections.get(fy)!.set(month, contribs);
    });

  return (
    <div className="p-4 space-y-4">
      <div className="flex bg-stone-100 rounded-lg p-1">
        <button
          onClick={() => setActiveTab('monthly')}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors
            ${activeTab === 'monthly' ? 'bg-white text-amber-700 shadow-sm' : 'text-stone-500'}`}
        >
          Monthly Dues
        </button>
        <button
          onClick={() => setActiveTab('meetingFee')}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors
            ${activeTab === 'meetingFee' ? 'bg-white text-amber-700 shadow-sm' : 'text-stone-500'}`}
        >
          Meeting Fees
        </button>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-stone-500">Total Collected</p>
            <p className="text-2xl font-bold text-amber-700">{formatKES(totalCollected)}</p>
            <div className="flex gap-3 text-sm text-stone-400">
              {pendingCount > 0 && <span>{pendingCount} pending</span>}
              {unpaidCount > 0 && <span>{unpaidCount} unpaid</span>}
            </div>
          </div>
          {canVerify && activeTab === 'monthly' && (
            <Button onClick={() => setShowMonths(true)} size="sm">Months</Button>
          )}
          {canVerify && activeTab === 'meetingFee' && (
            <Button onClick={generateMeetingFee} loading={generating} size="sm">Generate Fee</Button>
          )}
        </div>
        {activeTab === 'meetingFee' && (
          <p className="text-xs text-stone-400 mt-2">No refreshments are bought with this fee — it funds the AGM Party Fund (see Funds tab).</p>
        )}
      </div>

      {pendingItems.length > 0 && (
        <Card title="Pending Verification">
          <div className="space-y-2">
            {pendingItems.map(c => {
              const isOwnContrib = c.memberId === user?.id;
              return (
                <div key={c.id} className="flex items-center justify-between py-1">
                  <div>
                    <p className="text-sm font-medium text-stone-700">
                      {c.memberName}{isOwnContrib && <span className="text-xs text-amber-600 ml-1">(you)</span>}
                    </p>
                    <p className="text-xs text-stone-400">
                      {formatKES(c.amount + c.fineAmount)}
                      {c.mpesaCode && <span className="ml-1 text-amber-600">Code: {c.mpesaCode}</span>}
                    </p>
                  </div>
                  {canVerify && !isOwnContrib && (
                    <Button size="sm" onClick={() => { setVerifyContrib(c); setShowVerifyModal(true); }}>Verify</Button>
                  )}
                  {canVerify && isOwnContrib && <span className="text-xs text-stone-400 italic">Cannot self-verify</span>}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {currentContribs.length === 0 ? (
        <EmptyState
          title={activeTab === 'monthly' ? 'No monthly dues' : 'No meeting-fee records'}
          description={canVerify ? 'Open Months to generate or backfill records' : 'Nothing generated yet — check back soon'}
        />
      ) : (
        Array.from(fySections.entries()).map(([fy, fyMonths]) => (
          <div key={fy} className="space-y-4">
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-amber-700">{groupYearLabel(fy)}</span>
              <span className="flex-1 h-px bg-amber-200" />
            </div>
            {Array.from(fyMonths.entries()).map(([month, contribs]) => (
              <Card
                key={month}
                title={format(new Date(month + '-01'), 'MMMM yyyy')}
                action={
                  canVerify ? (
                    <button onClick={() => openLedger(month)} className="text-xs text-amber-700 font-medium">Ledger</button>
                  ) : undefined
                }
              >
                <div className="space-y-2">
                  {contribs.map(c => (
                    <ContributionRow
                      key={c.id}
                      contribution={c}
                      isOwn={c.memberId === user?.id}
                      canVerify={canVerify}
                      onSubmit={() => { setSelectedContrib(c); setShowSubmitModal(true); }}
                      onVerify={() => { setVerifyContrib(c); setShowVerifyModal(true); }}
                    />
                  ))}
                </div>
              </Card>
            ))}
          </div>
        ))
      )}

      <MonthManager
        open={showMonths}
        onClose={() => setShowMonths(false)}
        contributions={contributions}
        activeCount={activeMembers.length}
        onGenerate={generateForMonth}
        onOpenLedger={openLedger}
        generating={generating}
      />

      <LedgerEntryModal
        open={showLedger}
        month={ledgerMonth}
        rows={ledgerRows}
        autoDuesFrom={settings.autoDuesFrom}
        saving={savingLedger}
        onClose={() => { setShowLedger(false); setLedgerMonth(null); setLedgerRows([]); }}
        onUpdate={updateRow}
        onSave={saveLedger}
      />

      <Modal
        open={showSubmitModal}
        onClose={() => { setShowSubmitModal(false); setSelectedContrib(null); setMpesaInput(''); }}
        title="Submit Payment"
      >
        {selectedContrib && (
          <form onSubmit={handleSubmitPayment} className="space-y-4">
            <div className="bg-stone-50 rounded-lg p-3 text-sm">
              <p>Amount: <strong>{formatKES(selectedContrib.amount)}</strong></p>
              {selectedContrib.fineAmount > 0 && <p>Fine: <strong className="text-red-500">{formatKES(selectedContrib.fineAmount)}</strong></p>}
              <p>Total: <strong className="text-amber-700">{formatKES(selectedContrib.amount + selectedContrib.fineAmount)}</strong></p>
            </div>
            <Textarea
              label="M-Pesa SMS or Transaction Code"
              placeholder="Paste your M-Pesa confirmation SMS or type the transaction code..."
              value={mpesaInput}
              onChange={e => setMpesaInput(e.target.value)}
              rows={3}
            />
            {mpesaInput && (
              <div className="bg-amber-50 rounded-lg p-3 text-sm">
                Extracted code: <strong className={extractMpesaCode(mpesaInput) ? 'text-amber-700' : 'text-red-500'}>
                  {extractMpesaCode(mpesaInput) || 'Invalid — enter a 10-character M-Pesa code'}
                </strong>
              </div>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => { setShowSubmitModal(false); setSelectedContrib(null); setMpesaInput(''); }} className="flex-1">Cancel</Button>
              <Button type="submit" loading={submitting} className="flex-1">Submit</Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        open={showVerifyModal}
        onClose={() => { setShowVerifyModal(false); setVerifyContrib(null); setTreasurerMpesaInput(''); }}
        title="Verify Payment"
      >
        {verifyContrib && (
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="bg-stone-50 rounded-lg p-3 text-sm">
              <p>Member: <strong>{verifyContrib.memberName}</strong></p>
              <p>Amount: <strong>{formatKES(verifyContrib.amount)}</strong></p>
              {verifyContrib.fineAmount > 0 && <p>Fine: <strong className="text-red-500">{formatKES(verifyContrib.fineAmount)}</strong></p>}
              <p>Total: <strong className="text-amber-700">{formatKES(verifyContrib.amount + verifyContrib.fineAmount)}</strong></p>
              {verifyContrib.mpesaCode && <p className="mt-2">Member&apos;s code: <strong className="text-amber-700 font-mono">{verifyContrib.mpesaCode}</strong></p>}
            </div>
            <Textarea
              label="Your M-Pesa SMS or Transaction Code"
              placeholder="Paste your receiving M-Pesa SMS or type the transaction code..."
              value={treasurerMpesaInput}
              onChange={e => setTreasurerMpesaInput(e.target.value)}
              rows={3}
            />
            {treasurerMpesaInput && (
              <div className="bg-amber-50 rounded-lg p-3 text-sm">
                Extracted code: <strong className={extractMpesaCode(treasurerMpesaInput) ? 'text-amber-700' : 'text-red-500'}>
                  {extractMpesaCode(treasurerMpesaInput) || 'Invalid'}
                </strong>
                {extractMpesaCode(treasurerMpesaInput) && verifyContrib.mpesaCode && (
                  <span className={`ml-2 font-medium ${extractMpesaCode(treasurerMpesaInput) === verifyContrib.mpesaCode ? 'text-emerald-600' : 'text-red-500'}`}>
                    {extractMpesaCode(treasurerMpesaInput) === verifyContrib.mpesaCode ? 'Match' : 'No match'}
                  </span>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="danger" onClick={handleReject} loading={verifying} className="flex-1">Reject</Button>
              <Button type="submit" loading={verifying} className="flex-1">Verify</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

/** Group-year → month grid with generate + ledger entry actions (treasurer backfill). */
function MonthManager({
  open, onClose, contributions, activeCount, onGenerate, onOpenLedger, generating,
}: {
  open: boolean;
  onClose: () => void;
  contributions: Contribution[];
  activeCount: number;
  onGenerate: (month: string) => Promise<void>;
  onOpenLedger: (month: string) => void;
  generating: boolean;
}) {
  const [year, setYear] = useState(currentGroupYear());

  const dataYears = contributions
    .filter(c => c.purpose === 'monthly')
    .map(c => groupYearForMonth(c.month));
  const currentStart = parseInt(currentGroupYear().split('/')[0], 10);
  const years = Array.from(new Set([
    ...dataYears,
    `${currentStart - 1}/${currentStart}`,
    `${currentStart}/${currentStart + 1}`,
  ])).sort((a, b) => parseInt(b.split('/')[0], 10) - parseInt(a.split('/')[0], 10));

  const nowKey = currentMonthKey();

  return (
    <Modal open={open} onClose={onClose} title="Monthly Dues by Group Year">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {years.map(y => (
            <button
              key={y}
              onClick={() => setYear(y)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors
                ${y === year ? 'bg-amber-700 text-white' : 'bg-stone-100 text-stone-600'}`}
            >
              {groupYearLabel(y)}
            </button>
          ))}
        </div>
        <p className="text-xs text-stone-400">
          Generate the month&apos;s dues for every active member, or open Ledger Entry to record who paid
          from the paper record. From the automation month the app generates dues by itself.
        </p>
        <div className="space-y-2">
          {monthsInGroupYear(year).map(month => {
            const recs = contributions.filter(c => c.purpose === 'monthly' && c.month === month);
            const paid = recs.filter(c => c.status === 'Paid').length;
            const isFuture = month > nowKey;
            return (
              <div key={month} className={`flex items-center justify-between rounded-lg border border-stone-100 p-3 ${isFuture ? 'opacity-50' : ''}`}>
                <div>
                  <p className="text-sm font-medium text-stone-700">{format(new Date(month + '-01'), 'MMM yyyy')}</p>
                  <p className="text-xs text-stone-400">
                    {isFuture ? 'Upcoming' : recs.length === 0 ? 'Not generated' : `${paid}/${recs.length} paid${recs.length < activeCount ? ` · ${activeCount - recs.length} members missing` : ''}`}
                  </p>
                </div>
                {!isFuture && (
                  <div className="flex gap-2">
                    {(recs.length === 0 || recs.length < activeCount) && (
                      <Button size="sm" variant="secondary" loading={generating} onClick={() => onGenerate(month)}>
                        {recs.length === 0 ? 'Generate' : 'Fill'}
                      </Button>
                    )}
                    <Button size="sm" onClick={() => onOpenLedger(month)}>Ledger</Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}

/** Per-month ledger sheet: mark each member paid/unpaid from the paper record, then confirm. */
function LedgerEntryModal({
  open, month, rows, autoDuesFrom, saving, onClose, onUpdate, onSave,
}: {
  open: boolean;
  month: string | null;
  rows: LedgerRow[];
  autoDuesFrom: string;
  saving: boolean;
  onClose: () => void;
  onUpdate: (idx: number, patch: Partial<LedgerRow>) => void;
  onSave: () => Promise<void>;
}) {
  const paperEra = month !== null && month < autoDuesFrom;
  return (
    <Modal open={open} onClose={onClose} title={month ? `Ledger — ${format(new Date(month + '-01'), 'MMMM yyyy')}` : 'Ledger'}>
      <div className="space-y-4">
        <p className="text-xs text-stone-400">
          Enter each member&apos;s outcome for this month, then confirm. Rows on <span className="font-medium">Skip</span> are
          left untouched.{' '}
          {paperEra
            ? 'Unpaid entries are recorded as Late with the fine you enter (closed, pre-automation month — no automatic fines).'
            : 'Unpaid entries are recorded as Unpaid; the app applies the constitutional late fine automatically once the cutoff passes.'}
        </p>
        {rows.map((row, idx) => (
          <div key={row.member.id} className="rounded-lg border border-stone-100 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-stone-700">
                {row.member.name}
                {row.member.secondary && <span className="ml-1 text-xs text-amber-600">(secondary)</span>}
              </p>
              <div className="flex bg-stone-100 rounded-lg p-0.5">
                {(['skip', 'paid', 'unpaid'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => onUpdate(idx, { mode })}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md capitalize transition-colors
                      ${row.mode === mode
                        ? mode === 'paid' ? 'bg-emerald-600 text-white' : mode === 'unpaid' ? 'bg-red-500 text-white' : 'bg-white text-stone-600 shadow-sm'
                        : 'text-stone-400'}`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
            {row.mode !== 'skip' && (
              <div className="grid grid-cols-2 gap-2">
                <Input label="Amount" type="number" inputMode="numeric" value={row.amount} onChange={e => onUpdate(idx, { amount: e.target.value })} />
                <Input label="Fine" type="number" inputMode="numeric" value={row.fine} onChange={e => onUpdate(idx, { fine: e.target.value })} />
                {row.mode === 'paid' && (
                  <>
                    <Select
                      label="Method"
                      value={row.method}
                      onChange={e => onUpdate(idx, { method: e.target.value as PaymentMethod })}
                      options={[{ value: 'Cash', label: 'Cash' }, { value: 'Mpesa', label: 'M-Pesa' }]}
                    />
                    <Input label="Paid date" type="date" value={row.paidDate} onChange={e => onUpdate(idx, { paidDate: e.target.value })} />
                    <div className="col-span-2">
                      <Input label="M-Pesa code (optional)" placeholder="e.g. SLK7A2B9CD" value={row.code} onChange={e => onUpdate(idx, { code: e.target.value })} />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
          <Button type="button" loading={saving} onClick={onSave} className="flex-1">Save &amp; Confirm</Button>
        </div>
      </div>
    </Modal>
  );
}

function ContributionRow({
  contribution: c, isOwn, canVerify, onSubmit, onVerify,
}: {
  contribution: Contribution; isOwn: boolean; canVerify: boolean; onSubmit: () => void; onVerify: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <div>
        <p className="text-sm font-medium text-stone-700">
          {c.memberName}{isOwn && <span className="text-xs text-amber-600 ml-1">(you)</span>}
        </p>
        <p className="text-xs text-stone-400">
          {formatKES(c.amount)}
          {c.fineAmount > 0 && <span className="text-red-500"> + {formatKES(c.fineAmount)} fine</span>}
        </p>
        {c.mpesaCode && (c.status === 'Pending' || c.status === 'Paid') && (
          <p className="text-xs text-stone-400">M-Pesa: <span className="font-mono text-amber-600">{c.mpesaCode}</span></p>
        )}
        {c.paidDate && c.status === 'Paid' && <p className="text-xs text-stone-400">Paid {c.paidDate}</p>}
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={c.status === 'Paid' ? 'success' : c.status === 'Pending' ? 'info' : c.status === 'Late' ? 'danger' : 'warning'}>
          {c.status}
        </Badge>
        {isOwn && (c.status === 'Unpaid' || c.status === 'Late') && (
          <button onClick={onSubmit} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium px-1">Pay</button>
        )}
        {canVerify && c.status === 'Pending' && !isOwn && (
          <button onClick={onVerify} className="text-xs text-amber-600 hover:text-amber-700 font-medium px-1">Verify</button>
        )}
        {canVerify && c.status === 'Pending' && isOwn && <span className="text-xs text-stone-400 italic">Self</span>}
      </div>
    </div>
  );
}
