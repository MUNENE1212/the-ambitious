'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  Contribution, Expense, BankTransaction, Investment, ForumPost, Member,
  hydrateContribution, hydrateExpense, hydrateBankTransaction, hydrateMember, hydrateForumPost,
} from '@/lib/types';
import { useAuth } from '@/lib/auth-context';
import { canVerifyPayments } from '@/lib/roles';
import { extractMpesaCode } from '@/lib/mpesa';
import { useSettings } from '@/lib/hooks';
import { calculateFinancials, formatKES } from '@/lib/financial';
import { currentGroupYear, groupYearStartKey } from '@/lib/groupYear';
import { useToast } from '@/components/ui/toast';
import { Card } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { TitleBadges } from '@/components/ui/title-badges';
import { Loading } from '@/components/ui/loading';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import Link from 'next/link';

function timeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Days until the next occurrence of an MM-DD date (this year, or next year if passed). */
function daysUntilAnnual(mmdd: string): number {
  const [month, day] = mmdd.split('-').map(Number);
  const now = new Date();
  let target = new Date(now.getFullYear(), month - 1, day);
  if (target < now) target = new Date(now.getFullYear() + 1, month - 1, day);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function DashboardContent() {
  const { user } = useAuth();
  const { settings, loading: settingsLoading } = useSettings();
  const { showToast } = useToast();

  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [bankTx, setBankTx] = useState<BankTransaction[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const [idea, setIdea] = useState('');
  const [postingIdea, setPostingIdea] = useState(false);

  // Pay-from-home (member) and verify-from-home (treasurer/admin)
  // Held in state, not read from the render-computed myCurrentContrib: the React
  // Compiler treats a closure over a memoized render value as impure, so Date.now()
  // inside the submit handler would be flagged (react-hooks/purity).
  const [payContrib, setPayContrib] = useState<Contribution | null>(null);
  const [mpesaInput, setMpesaInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [verifyContrib, setVerifyContrib] = useState<Contribution | null>(null);
  const [treasurerMpesaInput, setTreasurerMpesaInput] = useState('');
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    const unsubs: (() => void)[] = [];
    unsubs.push(onSnapshot(collection(db, 'contributions'), snap => {
      setContributions(snap.docs.map(d => hydrateContribution(d.id, d.data())));
    }));
    unsubs.push(onSnapshot(collection(db, 'expenses'), snap => {
      setExpenses(snap.docs.map(d => hydrateExpense(d.id, d.data())));
    }));
    unsubs.push(onSnapshot(collection(db, 'bankTransactions'), snap => {
      setBankTx(snap.docs.map(d => hydrateBankTransaction(d.id, d.data())));
    }));
    unsubs.push(onSnapshot(collection(db, 'investments'), snap => {
      setInvestments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Investment)));
    }));
    unsubs.push(onSnapshot(collection(db, 'forumPosts'), snap => {
      setPosts(snap.docs.map(d => hydrateForumPost(d.id, d.data())).sort((a, b) => b.createdAt - a.createdAt));
    }));
    unsubs.push(onSnapshot(collection(db, 'members'), snap => {
      setMembers(snap.docs.map(d => hydrateMember(d.id, d.data())));
      setLoading(false);
    }));
    return () => unsubs.forEach(u => u());
  }, []);

  const fin = useMemo(
    () => calculateFinancials({ contributions, expenses, bankTransactions: bankTx, investments, settings }),
    [contributions, expenses, bankTx, investments, settings]
  );

  const myCurrentMonth = format(new Date(), 'yyyy-MM');
  const myCurrentContrib = contributions.find(
    c => c.memberId === user?.id && c.purpose === 'monthly' && c.month === myCurrentMonth
  );
  const fyStart = groupYearStartKey(currentGroupYear());
  const myFinesFY = contributions
    .filter(c => c.memberId === user?.id && c.month >= fyStart)
    .reduce((s, c) => s + c.fineAmount, 0);
  const myGoodStanding = myCurrentContrib?.status === 'Paid' && myFinesFY === 0;

  const daysToAgm = daysUntilAnnual(settings.agmDate);

  const canVerify = canVerifyPayments(user);
  // Everyone else's submissions waiting on a treasurer — never your own, since
  // handleVerify refuses self-verification anyway.
  const pendingForMe = useMemo(
    () => contributions
      .filter(c => c.status === 'Pending' && c.memberId !== user?.id)
      .sort((a, b) => b.updatedAt - a.updatedAt),
    [contributions, user?.id]
  );


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
      setVerifyContrib(null);
      setTreasurerMpesaInput('');
    } catch {
      showToast('Failed to reject', 'error');
    }
    setVerifying(false);
  };

  const pinnedPost = posts.find(p => p.pinned) ?? posts.find(p => p.category === 'Announcement');

  // Member spotlight: longest current streak of on-time (non-Late, no fine) monthly payments
  const spotlight = useMemo(() => {
    const byMember = new Map<string, Contribution[]>();
    contributions
      .filter(c => c.purpose === 'monthly' && c.status === 'Paid')
      .forEach(c => {
        const arr = byMember.get(c.memberId) ?? [];
        arr.push(c);
        byMember.set(c.memberId, arr);
      });
    let best: { name: string; streak: number } | null = null;
    byMember.forEach((list, memberId) => {
      const sorted = [...list].sort((a, b) => b.month.localeCompare(a.month));
      let streak = 0;
      for (const c of sorted) {
        if (c.fineAmount > 0) break;
        streak++;
      }
      if (streak >= 3 && (!best || streak > best.streak)) {
        const name = members.find(m => m.id === memberId)?.name ?? 'A member';
        best = { name, streak };
      }
    });
    return best as { name: string; streak: number } | null;
  }, [contributions, members]);

  // Recent activity: forum posts + replies, verifications, auto-fines — interleaved by recency
  const activity = useMemo(() => {
    type Item = { id: string; ts: number; text: string };
    const items: Item[] = [];
    posts.forEach(p => {
      items.push({ id: `post-${p.id}`, ts: p.createdAt, text: `${p.authorName} posted "${p.title}" (${p.category})` });
      p.replies.forEach(r => {
        items.push({ id: `reply-${r.id}`, ts: r.createdAt, text: `${r.authorName} replied on "${p.title}"` });
      });
    });
    contributions.filter(c => c.verifiedAt).forEach(c => {
      items.push({ id: `verify-${c.id}`, ts: c.verifiedAt!, text: `${c.memberName}'s ${format(new Date(c.month + '-01'), 'MMM yyyy')} contribution was verified` });
      if (c.fineAmount > 0) {
        items.push({ id: `fine-${c.id}`, ts: c.updatedAt, text: `Auto-fine applied — ${c.memberName}, late payment (${formatKES(c.fineAmount)})` });
      }
    });
    return items.sort((a, b) => b.ts - a.ts).slice(0, 6);
  }, [posts, contributions]);

  // Contributions vs expenses, last 6 months
  const monthlyData = useMemo(() => {
    const now = new Date();
    const data: { month: string; funds: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mStart = format(startOfMonth(d), 'yyyy-MM-dd');
      const mEnd = format(endOfMonth(d), 'yyyy-MM-dd');
      const collected = contributions
        .filter(c => c.status === 'Paid' && c.paidDate && c.paidDate >= mStart && c.paidDate <= mEnd)
        .reduce((s, c) => s + c.amount + c.fineAmount, 0);
      const spent = expenses
        .filter(e => e.status !== 'rejected' && e.date >= mStart && e.date <= mEnd)
        .reduce((s, e) => s + e.amount, 0);
      data.push({ month: format(d, 'MMM'), funds: collected - spent });
    }
    return data;
  }, [contributions, expenses]);

  const handlePostIdea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !idea.trim()) return;
    setPostingIdea(true);
    try {
      await addDoc(collection(db, 'forumPosts'), {
        title: idea.trim().length > 60 ? idea.trim().slice(0, 57) + '…' : idea.trim(),
        body: idea.trim(),
        category: 'Proposal',
        pinned: false,
        authorId: user.id,
        authorName: user.name,
        authorTitles: user.titles ?? [],
        replies: [],
        createdAt: Date.now(),
      });
      showToast('Idea posted to the forum');
      setIdea('');
    } catch {
      showToast('Failed to post', 'error');
    }
    setPostingIdea(false);
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payContrib || !user) return;
    const code = extractMpesaCode(mpesaInput);
    if (!code) {
      showToast('Could not extract M-Pesa code. Enter a valid code or paste the full SMS.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await updateDoc(doc(db, 'contributions', payContrib.id), {
        status: 'Pending',
        mpesaCode: code,
        mpesaMessage: mpesaInput.trim(),
        submittedAt: Date.now(),
        updatedAt: Date.now(),
      });
      showToast('Payment submitted for verification');
      setPayContrib(null);
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
      setVerifyContrib(null);
      setTreasurerMpesaInput('');
    } catch {
      showToast('Failed to verify', 'error');
    }
    setVerifying(false);
  };

  if (loading || settingsLoading) return <Loading />;

  return (
    <div className="p-4 space-y-4">
      {/* Hero: Total Group Funds */}
      <div className="relative overflow-hidden rounded-3xl bg-brand-gradient shadow-hero p-5 pt-6 text-white animate-count-up">
        {/* Soft gold bloom, purely decorative */}
        <div aria-hidden className="absolute -top-16 -right-10 w-48 h-48 rounded-full bg-gold-300/15 blur-2xl" />
        <div className="relative">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold-300 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-gold-300" />
            </span>
            <p className="eyebrow text-gold-200/90">Total Group Funds</p>
          </div>
          <p className="text-4xl font-bold mt-2 tabular-nums tracking-tight">{formatKES(fin.totalGroupFunds)}</p>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              { label: 'Cash', value: fin.cashOnHand },
              { label: 'Bank', value: fin.bankBalance },
              { label: 'AGM fund', value: fin.agmFundBalance },
            ].map(part => (
              <div key={part.label} className="rounded-xl bg-white/10 ring-1 ring-white/10 py-2">
                <p className="text-[10px] uppercase tracking-wider text-gold-200/70">{part.label}</p>
                <p className="text-sm font-semibold tabular-nums mt-0.5">{formatKES(part.value)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="My status"
          value={myGoodStanding ? 'Clear' : (myCurrentContrib?.status ?? 'Unpaid')}
          tone={myGoodStanding ? 'positive' : 'negative'}
          hint={myGoodStanding ? 'up to date' : 'action needed'}
        />
        <StatCard
          label="My fines"
          value={formatKES(myFinesFY)}
          tone={myFinesFY > 0 ? 'negative' : 'default'}
          hint="this year"
        />
        <StatCard label="Next AGM" value={`${daysToAgm}`} hint={daysToAgm === 1 ? 'day away' : 'days away'} tone="accent" />
      </div>

      {/* Pay this month — the member's own current dues, submitted without leaving Home */}
      {myCurrentContrib && myCurrentContrib.status !== 'Paid' && (
        <Card className="ring-1 ring-gold-200/60">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow text-stone-400">
                {format(new Date(`${myCurrentMonth}-01`), 'MMMM yyyy')} contribution
              </p>
              <p className="text-3xl font-bold text-stone-800 tabular-nums mt-1 tracking-tight">
                {formatKES(myCurrentContrib.amount + myCurrentContrib.fineAmount)}
              </p>
              {myCurrentContrib.fineAmount > 0 && (
                <p className="text-xs text-red-600 mt-0.5">
                  includes {formatKES(myCurrentContrib.fineAmount)} late fine
                </p>
              )}
            </div>
            <Badge variant={myCurrentContrib.status === 'Pending' ? 'gold' : 'danger'}>
              {myCurrentContrib.status}
            </Badge>
          </div>

          {myCurrentContrib.status === 'Pending' ? (
            <p className="text-sm text-stone-600 mt-3">
              Submitted as <strong className="font-mono">{myCurrentContrib.mpesaCode}</strong> — waiting for the
              treasurer to confirm it against their own M-Pesa message.
            </p>
          ) : (
            <Button size="lg" className="w-full mt-4" onClick={() => setPayContrib(myCurrentContrib)}>
              Submit M-Pesa payment
            </Button>
          )}
        </Card>
      )}

      {myCurrentContrib?.status === 'Paid' && (
        <div className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-50 ring-1 ring-emerald-200 px-4 py-3">
          <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          <p className="text-sm font-medium text-emerald-800">
            {format(new Date(`${myCurrentMonth}-01`), 'MMMM')} verified — you are up to date
          </p>
        </div>
      )}

      {/* Treasurer/admin: verification queue */}
      {canVerify && pendingForMe.length > 0 && (
        <Card title={`Awaiting your verification (${pendingForMe.length})`}>
          <div className="space-y-2">
            {pendingForMe.map(c => (
              <button
                key={c.id}
                onClick={() => setVerifyContrib(c)}
                className="pressable w-full flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white p-3 text-left hover:bg-stone-50"
              >
                <div className="min-w-0 flex items-center gap-3">
                  <span className="grid place-items-center w-9 h-9 rounded-full bg-amber-100 text-amber-800 text-xs font-bold shrink-0">
                    {c.memberName.split(' ').map(n => n[0]).slice(0, 2).join('')}
                  </span>
                  <div className="min-w-0">
                  <p className="font-medium text-stone-800 truncate">{c.memberName}</p>
                  <p className="text-xs text-stone-500">
                    {c.month} · <span className="font-mono">{c.mpesaCode}</span>
                  </p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-amber-700 tabular-nums shrink-0">
                  {formatKES(c.amount + c.fineAmount)}
                </span>
              </button>
            ))}
          </div>
          <p className="text-xs text-stone-400 mt-2">
            Tap one, then paste the M-Pesa message you received. The codes must match.
          </p>
        </Card>
      )}

      {/* Pinned Announcement */}
      {pinnedPost && (
        <Link href="/forum">
          <div className="pressable bg-gold-50 border border-gold-200 rounded-2xl p-4 hover:bg-gold-100">
            <div className="flex items-center gap-2">
              <Badge variant="gold">Announcement</Badge>
              <TitleBadges titles={pinnedPost.authorTitles} />
            </div>
            <p className="font-medium text-stone-800 mt-2">{pinnedPost.title}</p>
            <p className="text-sm text-stone-600 line-clamp-2 mt-1">{pinnedPost.body}</p>
            <p className="text-xs text-stone-400 mt-2">{pinnedPost.authorName} · {timeAgo(pinnedPost.createdAt)}</p>
          </div>
        </Link>
      )}

      {/* What's your idea? composer */}
      <Card>
        <form onSubmit={handlePostIdea} className="flex gap-2">
          <input
            className="flex-1 rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm shadow-soft transition-colors focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/25"
            placeholder="💡 What's your idea?"
            value={idea}
            onChange={e => setIdea(e.target.value)}
          />
          <button
            type="submit"
            disabled={postingIdea || !idea.trim()}
            className="pressable px-4 py-2.5 rounded-xl bg-amber-800 text-white text-sm font-semibold shadow-soft disabled:opacity-50"
          >
            Post
          </button>
        </form>
        <p className="text-xs text-stone-400 mt-2">Posts straight to the Forum as a Proposal — no separate screen needed.</p>
      </Card>

      {/* Member spotlight */}
      {spotlight && (
        <div className="flex items-center justify-center gap-2 rounded-2xl bg-white border border-stone-200/70 shadow-soft px-4 py-3">
          <span className="text-base">🎉</span>
          <p className="text-sm text-stone-600">
            <strong className="text-stone-800">{spotlight.name}</strong> has a {spotlight.streak}-month clean streak
          </p>
        </div>
      )}

      {/* Funds trend */}
      <Card title="Funds Trend (6 months)">
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthlyData}>
              <defs>
                <linearGradient id="fundsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#293759" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#293759" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="#a8a29e" />
              <YAxis tick={{ fontSize: 10 }} stroke="#a8a29e" width={40} />
              <Tooltip formatter={(value) => formatKES(Number(value))} />
              <Area type="monotone" dataKey="funds" stroke="#293759" strokeWidth={2} fill="url(#fundsFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Recent posts & replies — unhidden, right on Home */}
      <Card title="Recent Activity" action={<Link href="/forum" className="text-xs text-amber-700 font-medium">See Forum →</Link>}>
        {activity.length === 0 ? (
          <p className="text-sm text-stone-400">Nothing yet — be the first to post an idea above.</p>
        ) : (
          <div className="space-y-2">
            {activity.map(item => (
              <div key={item.id} className="flex items-center justify-between text-sm py-1 border-b border-stone-50 last:border-0">
                <span className="text-stone-700">{item.text}</span>
                <span className="text-xs text-stone-400 whitespace-nowrap ml-2">{timeAgo(item.ts)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Submit own payment */}
      <Modal
        open={!!payContrib}
        onClose={() => { setPayContrib(null); setMpesaInput(''); }}
        title="Submit Payment"
      >
        {payContrib && (
          <form onSubmit={handleSubmitPayment} className="space-y-4">
            <div className="bg-stone-50 rounded-lg p-3 text-sm">
              <p>Amount: <strong>{formatKES(payContrib.amount)}</strong></p>
              {payContrib.fineAmount > 0 && (
                <p>Fine: <strong className="text-red-500">{formatKES(payContrib.fineAmount)}</strong></p>
              )}
              <p>Total: <strong className="text-amber-700">{formatKES(payContrib.amount + payContrib.fineAmount)}</strong></p>
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
              <Button type="button" variant="secondary" className="flex-1"
                onClick={() => { setPayContrib(null); setMpesaInput(''); }}>Cancel</Button>
              <Button type="submit" loading={submitting} className="flex-1">Submit</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Verify someone else's payment */}
      <Modal
        open={!!verifyContrib}
        onClose={() => { setVerifyContrib(null); setTreasurerMpesaInput(''); }}
        title="Verify Payment"
      >
        {verifyContrib && (
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="bg-stone-50 rounded-lg p-3 text-sm space-y-1">
              <p>{verifyContrib.memberName} · {verifyContrib.month}</p>
              <p>Total: <strong className="text-amber-700">{formatKES(verifyContrib.amount + verifyContrib.fineAmount)}</strong></p>
              <p>Member&apos;s code: <strong className="font-mono">{verifyContrib.mpesaCode}</strong></p>
            </div>
            <Textarea
              label="Your M-Pesa SMS or Transaction Code"
              placeholder="Paste the M-Pesa message you received..."
              value={treasurerMpesaInput}
              onChange={e => setTreasurerMpesaInput(e.target.value)}
              rows={3}
            />
            {treasurerMpesaInput && (
              <div className="bg-amber-50 rounded-lg p-3 text-sm">
                Extracted code: <strong className={extractMpesaCode(treasurerMpesaInput) === verifyContrib.mpesaCode ? 'text-emerald-600' : 'text-red-500'}>
                  {extractMpesaCode(treasurerMpesaInput) || 'Invalid'}
                </strong>
                {extractMpesaCode(treasurerMpesaInput) && extractMpesaCode(treasurerMpesaInput) !== verifyContrib.mpesaCode && (
                  <span className="text-red-500"> — does not match</span>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="danger" loading={verifying} onClick={handleReject} className="flex-1">Reject</Button>
              <Button type="submit" loading={verifying} className="flex-1">Verify</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
