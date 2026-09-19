import { Contribution, Fine, Member, Settings } from './types';

/**
 * What a member still owes the group.
 *
 * Two things can be outstanding and they behave differently:
 *  - unpaid DUES, which live on a contribution whose status is not 'Paid'
 *  - unpaid FINES, which come from two places: the fine carried on a
 *    contribution record (late payment) and the standalone `fines` collection
 *    (absence, welfare arrears). A member who pays the dues and skips the fine
 *    leaves the record 'Paid' with finePaid === false.
 */
export interface MemberArrears {
  memberId: string;
  memberName: string;
  unpaidDues: number;
  unpaidMonths: string[];
  unpaidContributionFines: number;
  unpaidOtherFines: number;
  unpaidFines: number;
  totalOwed: number;
}

/** True when this record's fine is still outstanding. */
export function hasOutstandingFine(c: Contribution): boolean {
  return c.fineAmount > 0 && c.finePaid !== true;
}

export function arrearsForMember(
  member: Pick<Member, 'id' | 'name'>,
  contributions: Contribution[],
  fines: Fine[],
): MemberArrears {
  const mine = contributions.filter(c => c.memberId === member.id);

  const unpaidRecords = mine.filter(c => c.status !== 'Paid');
  const unpaidDues = unpaidRecords.reduce((s, c) => s + c.amount, 0);
  const unpaidMonths = unpaidRecords
    .filter(c => c.purpose === 'monthly')
    .map(c => c.month)
    .sort();

  // A fine is owed whether or not its dues were paid.
  const unpaidContributionFines = mine
    .filter(hasOutstandingFine)
    .reduce((s, c) => s + c.fineAmount, 0);

  const unpaidOtherFines = fines
    .filter(f => f.memberId === member.id && !f.waived)
    .reduce((s, f) => s + f.amount, 0);

  const unpaidFines = unpaidContributionFines + unpaidOtherFines;

  return {
    memberId: member.id,
    memberName: member.name,
    unpaidDues,
    unpaidMonths,
    unpaidContributionFines,
    unpaidOtherFines,
    unpaidFines,
    totalOwed: unpaidDues + unpaidFines,
  };
}

export function arrearsForAll(
  members: Member[],
  contributions: Contribution[],
  fines: Fine[],
): MemberArrears[] {
  return members
    .filter(m => m.active)
    .map(m => arrearsForMember(m, contributions, fines))
    .sort((a, b) => b.totalOwed - a.totalOwed);
}

export interface GroupArrears {
  totalOwed: number;
  totalDues: number;
  totalFines: number;
  membersInArrears: number;
}

export function groupArrears(rows: MemberArrears[]): GroupArrears {
  return {
    totalOwed: rows.reduce((s, r) => s + r.totalOwed, 0),
    totalDues: rows.reduce((s, r) => s + r.unpaidDues, 0),
    totalFines: rows.reduce((s, r) => s + r.unpaidFines, 0),
    membersInArrears: rows.filter(r => r.totalOwed > 0).length,
  };
}

/** Fine a month should carry once it is settled late, if it has none yet. */
export function fineForLateMonth(c: Contribution, settings: Settings): number {
  return c.fineAmount > 0 ? c.fineAmount : settings.lateContributionFine;
}
