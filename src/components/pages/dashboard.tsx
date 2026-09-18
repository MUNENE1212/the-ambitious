'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  Contribution, Expense, BankTransaction, Investment, ForumPost, Member,
  hydrateContribution, hydrateExpense, hydrateBankTransaction, hydrateMember, hydrateForumPost,
} from '@/lib/types';
import { useAuth } from '@/lib/auth-context';
import { useSettings } from '@/lib/hooks';
import { calculateFinancials, formatKES } from '@/lib/financial';
import { currentGroupYear, groupYearStartKey } from '@/lib/groupYear';
import { useToast } from '@/components/ui/toast';
import { Card } from '@/components/ui/card';
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

  if (loading || settingsLoading) return <Loading />;

  return (
    <div className="p-4 space-y-4">
      {/* Hero: Total Group Funds */}
      <div className="bg-gradient-to-br from-amber-900 to-amber-700 rounded-2xl p-5 text-gold-100 animate-count-up">
        <p className="text-xs uppercase tracking-wide text-gold-200/80 font-mono">Total Group Funds · live</p>
        <p className="text-3xl font-bold mt-1 tabular-nums">{formatKES(fin.totalGroupFunds)}</p>
        <p className="text-xs text-gold-200/70 mt-1">Cash + bank + investments</p>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-stone-200 p-3">
          <p className="text-xs text-stone-500">My Status</p>
          <p className={`text-sm font-bold mt-1 ${myGoodStanding ? 'text-emerald-600' : 'text-red-600'}`}>
            {myGoodStanding ? 'Paid ✓' : (myCurrentContrib?.status ?? 'Unpaid')}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-stone-200 p-3">
          <p className="text-xs text-stone-500">My Fines (FY)</p>
          <p className="text-sm font-bold mt-1 text-stone-800 tabular-nums">{formatKES(myFinesFY)}</p>
        </div>
        <div className="bg-white rounded-xl border border-stone-200 p-3">
          <p className="text-xs text-stone-500">Next AGM</p>
          <p className="text-sm font-bold mt-1 text-stone-800 tabular-nums">{daysToAgm} days</p>
        </div>
      </div>

      {/* Pinned Announcement */}
      {pinnedPost && (
        <Link href="/forum">
          <div className="bg-gold-50 border border-gold-200 rounded-xl p-4 hover:bg-gold-100 transition-colors">
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
            className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            placeholder="💡 What's your idea?"
            value={idea}
            onChange={e => setIdea(e.target.value)}
          />
          <button
            type="submit"
            disabled={postingIdea || !idea.trim()}
            className="px-4 py-2 rounded-lg bg-amber-700 text-white text-sm font-medium disabled:opacity-50"
          >
            Post
          </button>
        </form>
        <p className="text-xs text-stone-400 mt-2">Posts straight to the Forum as a Proposal — no separate screen needed.</p>
      </Card>

      {/* Member spotlight */}
      {spotlight && (
        <p className="text-sm text-stone-600 text-center">
          🎉 <strong>{spotlight.name}</strong> has a {spotlight.streak}-month clean payment streak
        </p>
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
    </div>
  );
}
