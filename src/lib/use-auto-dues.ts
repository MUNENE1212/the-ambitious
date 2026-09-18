'use client';

import { useEffect, useRef } from 'react';
import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { db } from './firebase';
import { Member } from './types';
import { useSettings } from './hooks';
import { isSavingsGroupMember } from './roles';
import { currentMonthKey, rateFor } from './groupYear';

/**
 * Client-side "cron" for monthly dues. Once the automation month is reached
 * (settings.autoDuesFrom — the AGM month, e.g. '2026-10'), any logged-in visit
 * generates the current month's dues for every active member if they don't
 * exist yet. Same pattern as the client-side auto-fine sweep in
 * contributions.tsx — free-tier friendly, no scheduled Cloud Function.
 *
 * Race safety: records use deterministic IDs (auto-<month>-<memberId>) so two
 * members opening the app at once can't create duplicates. The exact doc is
 * re-checked right before the write so a member who already submitted payment
 * on a just-created record is never overwritten.
 */
export function useAutoDues(user: Member | null) {
  const { settings } = useSettings();
  const attempted = useRef<string | null>(null);

  useEffect(() => {
    if (!user || !settings.autoDuesFrom) return;
    const month = currentMonthKey();
    if (month < settings.autoDuesFrom) return; // string compare works for zero-padded YYYY-MM
    if (attempted.current === month) return;
    attempted.current = month;

    let cancelled = false;
    (async () => {
      try {
        const [memberSnap, contribSnap] = await Promise.all([
          getDocs(collection(db, 'members')),
          getDocs(query(collection(db, 'contributions'), where('month', '==', month), where('purpose', '==', 'monthly'))),
        ]);
        if (cancelled) return;

        const existing = new Set(
          contribSnap.docs.map(d => d.data().memberId as string).filter(Boolean)
        );
        const missing = memberSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as Member))
          .filter(m => m.active && isSavingsGroupMember(m) && !existing.has(m.id));
        if (missing.length === 0) return;

        const { primary, secondary } = rateFor(settings, month);
        for (const member of missing) {
          const ref = doc(db, 'contributions', `auto-${month}-${member.id}`);
          const snap = await getDoc(ref);
          if (snap.exists()) continue;
          await setDoc(ref, {
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
      } catch {
        // Non-fatal — the next app load retries.
      }
    })();

    return () => { cancelled = true; };
  }, [user, settings]);
}
