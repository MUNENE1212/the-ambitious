'use client';

import { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, getDocs, where, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Contribution, Member, hydrateMember, hydrateContribution } from '@/lib/types';
import { useAuth } from '@/lib/auth-context';
import { useSettings } from '@/lib/hooks';
import { canVerifyPayments, isSavingsGroupMember } from '@/lib/roles';
import { extractMpesaCode } from '@/lib/mpesa';
import { findOverdueContributions } from '@/lib/fines';
import { formatKES } from '@/lib/financial';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { Loading } from '@/components/ui/loading';
import { EmptyState } from '@/components/ui/empty-state';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';

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

  const generateMonthly = async () => {
    if (!canVerify) return;
    setGenerating(true);
    try {
      const month = format(new Date(), 'yyyy-MM');
      const existing = await getDocs(
        query(collection(db, 'contributions'), where('month', '==', month), where('purpose', '==', 'monthly'))
      );
      if (!existing.empty) {
        showToast('Monthly dues already generated for this month', 'info');
        setGenerating(false);
        return;
      }
      const activeMembers = members.filter(m => m.active && isSavingsGroupMember(m));
      for (const member of activeMembers) {
        await addDoc(collection(db, 'contributions'), {
          memberId: member.id,
          memberName: member.name,
          purpose: 'monthly',
          month,
          amount: member.secondary ? settings.monthlyContributionSecondary : settings.monthlyContributionPrimary,
          fineAmount: 0,
          status: 'Unpaid',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
      showToast(`Generated ${activeMembers.length} monthly dues records`);
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
      const activeMembers = members.filter(m => m.active && isSavingsGroupMember(m));
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
          {canVerify && (
            <Button onClick={activeTab === 'monthly' ? generateMonthly : generateMeetingFee} loading={generating} size="sm">
              {activeTab === 'monthly' ? 'Generate Month' : 'Generate Fee'}
            </Button>
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
          description={canVerify ? 'Generate records to get started' : 'Nothing generated yet — check back soon'}
        />
      ) : (
        Array.from(months.entries())
          .sort((a, b) => b[0].localeCompare(a[0]))
          .map(([month, contribs]) => (
            <Card key={month} title={format(new Date(month + '-01'), 'MMMM yyyy')}>
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
          ))
      )}

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
