import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Fine, hydrateContribution } from './types';
import { calculateRefund } from './exit';

/**
 * Shared by the member-initiated ("Request to Exit" on Profile) and
 * admin-initiated (Admin member row) flows — same math, same record shape,
 * so the committee and the exiting member always see identical numbers.
 */
export async function createExitRequest(params: {
  memberId: string;
  memberName: string;
  initiatedBy: 'member' | 'admin';
  initiatedById: string;
  initiatedByName: string;
  reason: string;
  exitDeductionPct: number;
}) {
  const { memberId, memberName, initiatedBy, initiatedById, initiatedByName, reason, exitDeductionPct } = params;

  const [contribSnap, fineSnap] = await Promise.all([
    getDocs(query(collection(db, 'contributions'), where('memberId', '==', memberId))),
    getDocs(query(collection(db, 'fines'), where('memberId', '==', memberId))),
  ]);
  const contributions = contribSnap.docs.map(d => hydrateContribution(d.id, d.data()));
  const fines = fineSnap.docs.map(d => ({ id: d.id, ...d.data() } as Fine));

  const refundBreakdown = calculateRefund(contributions, fines, exitDeductionPct);

  await addDoc(collection(db, 'exitRequests'), {
    memberId,
    memberName,
    initiatedBy,
    initiatedById,
    initiatedByName,
    reason: reason.trim(),
    refundBreakdown,
    votes: [],
    status: 'pending',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  return refundBreakdown;
}
