import 'server-only';
import type { MemberTitle } from '../types';

/**
 * Title checks, server-side.
 *
 * This mirrors `DEPUTY_OF` in `src/lib/roles.ts` — the constitution (PLAN.md
 * Section C) lets the vice-chairperson act as chairperson, the vice-secretary
 * as secretary, and the coordinator deputize for the treasurer. The client
 * version of these checks is unchanged and still used for rendering; this copy
 * exists because the API routes cannot trust it.
 *
 * If you change one, change both. A mismatch means a button is shown to someone
 * the server then refuses, or worse, hidden from someone it allows.
 */
const DEPUTY_OF: Partial<Record<MemberTitle, MemberTitle>> = {
  viceChairperson: 'chairperson',
  viceSecretary: 'secretary',
  coordinator: 'treasurer',
};

/** Titles that may act for the treasurer: the treasurer, or their deputy. */
const TREASURER_TITLES: MemberTitle[] = ['treasurer', 'coordinator'];

export function hasTitleOrDeputy(titles: string[], title: MemberTitle): boolean {
  const held = titles as MemberTitle[];
  if (held.includes(title)) return true;
  return held.some(t => DEPUTY_OF[t] === title);
}

/** Mirrors `canRecordFunds` for a non-admin caller. */
export function canSignForTreasurer(titles: string[]): boolean {
  return TREASURER_TITLES.some(t => hasTitleOrDeputy(titles, t));
}
