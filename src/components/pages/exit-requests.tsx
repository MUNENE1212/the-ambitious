'use client';

import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ExitRequest, Member, hydrateMember } from '@/lib/types';
import { useAuth } from '@/lib/auth-context';
import { canVote, isAdmin, isSavingsGroupMember } from '@/lib/roles';
import { getVoteSummary, canMemberVote } from '@/lib/verification';
import { formatKES } from '@/lib/financial';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loading } from '@/components/ui/loading';
import { EmptyState } from '@/components/ui/empty-state';
import { format } from 'date-fns';

const statusLabel: Record<ExitRequest['status'], { text: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'info' }> = {
  pending: { text: 'Voting open', variant: 'warning' },
  awaitingResale: { text: 'Approved — awaiting share resale', variant: 'info' },
  rejectedByVote: { text: 'Rejected by vote', variant: 'danger' },
  rejected: { text: 'Rejected', variant: 'danger' },
  approved: { text: 'Approved', variant: 'success' },
  paidOut: { text: 'Paid out — exited', variant: 'default' },
};

export function ExitRequestsContent() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [requests, setRequests] = useState<ExitRequest[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const unsubs: (() => void)[] = [];
    unsubs.push(onSnapshot(query(collection(db, 'exitRequests'), orderBy('createdAt', 'desc')), snap => {
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as ExitRequest)));
      setLoading(false);
    }));
    unsubs.push(onSnapshot(collection(db, 'members'), snap => {
      setMembers(snap.docs.map(d => hydrateMember(d.id, d.data())));
    }));
    return () => unsubs.forEach(u => u());
  }, []);

  const activeMemberCount = members.filter(m => m.active && isSavingsGroupMember(m)).length;

  /**
   * Record a vote.
   *
   * This goes through /api rather than writing to Firestore from the browser.
   * The old client write decided the request's new status from the snapshot this
   * page already held, so two members voting at once could both fail to flip the
   * status; and `arrayUnion` dedupes on whole-object equality, so a member voting
   * twice in two tabs got two votes because `votedAt` differed. Both now happen
   * inside one server transaction that re-reads the committed vote list.
   */
  const castVote = async (req: ExitRequest, vote: 'approve' | 'reject') => {
    if (!user) return;
    setBusyId(req.id);
    try {
      const res = await fetch(`/api/exit-requests/${req.id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ vote }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        showToast(data.error || 'Failed to vote', 'error');
        return;
      }
      showToast('Vote recorded');
      // onSnapshot pushes the authoritative state, so no local patching here —
      // a local guess is exactly what made the old version disagree with the
      // server.
    } catch {
      showToast('Failed to vote', 'error');
    }
    setBusyId(null);
  };

  /**
   * Mark a refund paid and close the membership.
   *
   * This used to write `members/{id}.active = false` straight from the browser.
   * That was a live privilege hole: the button was behind a client-side role
   * check and the rules allow `update: if true`, so any signed-in member could
   * have closed anyone's membership — and since the vote threshold counts active
   * members, deactivating people shrinks the denominator of every later exit
   * vote. Both writes now happen server-side, in one transaction.
   */
  const markPaidOut = async (req: ExitRequest) => {
    if (!user) return;
    setBusyId(req.id);
    try {
      const res = await fetch(`/api/exit-requests/${req.id}/payout`, {
        method: 'POST',
        credentials: 'same-origin',
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        showToast(data.error || 'Failed to update', 'error');
        return;
      }
      showToast(`${req.memberName}'s refund marked paid — membership closed`);
      // onSnapshot pushes the new request status and member record.
    } catch {
      showToast('Failed to update', 'error');
    }
    setBusyId(null);
  };

  if (loading) return <Loading />;

  return (
    <div className="p-4 space-y-4">
      <div>
        <h2 className="text-lg font-bold text-stone-800">Exit Requests</h2>
        <p className="text-xs text-stone-400 mt-1">
          Refunds are auto-calculated and need a majority of active members to approve before payout.
        </p>
      </div>

      {requests.length === 0 ? (
        <EmptyState title="No exit requests" description="Members can request to exit from their Profile; admins can initiate one from Admin." />
      ) : (
        <div className="space-y-3">
          {requests.map(req => {
            const summary = getVoteSummary(req.votes, activeMemberCount);
            const eligible = canVote(user) && req.status === 'pending' && canMemberVote(req.votes, user?.id ?? '', req.memberId);
            const b = req.refundBreakdown;
            return (
              <Card key={req.id}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-stone-800">{req.memberName}</p>
                    <p className="text-xs text-stone-400">
                      Requested by {req.initiatedByName} ({req.initiatedBy}) · {format(new Date(req.createdAt), 'dd MMM yyyy')}
                    </p>
                  </div>
                  <Badge variant={statusLabel[req.status].variant}>{statusLabel[req.status].text}</Badge>
                </div>

                {req.reason && <p className="text-sm text-stone-600 mt-2">&quot;{req.reason}&quot;</p>}

                <div className="bg-stone-50 rounded-lg p-3 mt-3 text-sm space-y-1">
                  <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-1">Refund breakdown</p>
                  <div className="flex justify-between"><span className="text-stone-500">Contributions paid</span><span className="tabular-nums">{formatKES(b.contributionsPaid)}</span></div>
                  <div className="flex justify-between"><span className="text-stone-500">Welfare paid</span><span className="tabular-nums">{formatKES(b.welfarePaid)}</span></div>
                  <div className="flex justify-between text-red-600"><span>Arrears (unwaived fines)</span><span className="tabular-nums">-{formatKES(b.arrears)}</span></div>
                  <div className="flex justify-between text-red-600"><span>Exit deduction ({Math.round(b.deductionPct * 100)}%)</span><span className="tabular-nums">-{formatKES(b.deductionAmount)}</span></div>
                  <div className="flex justify-between font-bold text-stone-800 border-t border-stone-200 pt-1 mt-1"><span>Net refund</span><span className="tabular-nums">{formatKES(b.netRefund)}</span></div>
                </div>

                {req.status === 'pending' && (
                  <div className="mt-3">
                    <p className="text-xs text-stone-400 mb-2">
                      {summary.approvals} approve · {summary.rejections} reject · needs {summary.threshold} of {summary.eligible} eligible members
                    </p>
                    {eligible ? (
                      <div className="flex gap-2">
                        <Button size="sm" variant="danger" loading={busyId === req.id} onClick={() => castVote(req, 'reject')} className="flex-1">Reject</Button>
                        <Button size="sm" loading={busyId === req.id} onClick={() => castVote(req, 'approve')} className="flex-1">Approve</Button>
                      </div>
                    ) : (
                      <p className="text-xs text-stone-400 italic">
                        {req.memberId === user?.id ? 'You cannot vote on your own exit' : 'Already voted or not eligible'}
                      </p>
                    )}
                  </div>
                )}

                {req.status === 'awaitingResale' && isAdmin(user) && (
                  <Button size="sm" loading={busyId === req.id} onClick={() => markPaidOut(req)} className="w-full mt-3">
                    Mark Refund Paid — Close Membership
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
