'use client';

import { useEffect, useRef } from 'react';
import { collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { db } from './firebase';
import { Member, hydrateContribution } from './types';
import { useSettings } from './hooks';
import { findOverdueContributions, overdueUpdate } from './fines';

/**
 * Client-side "cron" for late-payment fines, the counterpart to useAutoDues.
 *
 * It previously lived inside the Contributions page, so a fine only landed if
 * somebody happened to open that screen. Running it from AppShell means any
 * logged-in visit to any page applies it — the same free-tier trade-off as dues
 * generation, and still the thing a scheduled Cloud Function would replace.
 *
 * Only months from `autoDuesFrom` onward are touched. Earlier months are the
 * imported paper history, which the group never actually fined; sweeping those
 * would invent thousands of shillings of debt retroactively.
 */
export function useAutoFines(user: Member | null) {
  const { settings } = useSettings();
  const ranFor = useRef<string | null>(null);

  useEffect(() => {
    if (!user || !settings.autoDuesFrom) return;
    const today = new Date().toISOString().slice(0, 10);
    if (ranFor.current === today) return;
    ranFor.current = today;

    let cancelled = false;
    (async () => {
      try {
        const snap = await getDocs(
          query(collection(db, 'contributions'), where('purpose', '==', 'monthly'))
        );
        if (cancelled) return;

        const eligible = snap.docs
          .map(d => hydrateContribution(d.id, d.data()))
          .filter(c => c.month >= settings.autoDuesFrom);

        const overdue = findOverdueContributions(eligible, settings.contributionCutoffDay);
        for (const c of overdue) {
          const update = overdueUpdate(c, settings.lateContributionFine);
          if (!update) continue;
          await updateDoc(doc(db, 'contributions', c.id), { ...update, updatedAt: Date.now() });
        }
      } catch {
        // Non-fatal — the next app load retries.
      }
    })();

    return () => { cancelled = true; };
  }, [user, settings]);
}
