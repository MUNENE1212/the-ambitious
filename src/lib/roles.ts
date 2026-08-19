import { Member, MemberTitle } from './types';

// Deputies stand in for their principal per the constitution (Section C):
// the vice-chairperson performs the chairperson's roles in their absence,
// the vice-secretary the secretary's, and the coordinator deputizes the
// treasurer. Titles are interchangeable, not exclusive — permission checks
// accept either the title itself or its deputy.
export const DEPUTY_OF: Partial<Record<MemberTitle, MemberTitle>> = {
  viceChairperson: 'chairperson',
  viceSecretary: 'secretary',
  coordinator: 'treasurer',
};

export function isAdmin(user: Member | null): boolean {
  return user?.role === 'admin';
}

export function isSavingsGroupMember(user: Member | null): boolean {
  return user?.role === 'member' || user?.role === 'admin' || user?.role === 'manager';
}

export function canAdminister(user: Member | null): boolean {
  return user?.role === 'admin';
}

export function hasTitle(user: Member | null, title: MemberTitle): boolean {
  return (user?.titles ?? []).includes(title);
}

/** True if the member holds the title itself, or deputizes for it. */
export function hasTitleOrDeputy(user: Member | null, title: MemberTitle): boolean {
  if (hasTitle(user, title)) return true;
  const titles = user?.titles ?? [];
  return titles.some(t => DEPUTY_OF[t] === title);
}

/** Any office-bearer title at all — used for leadership-only actions like Announcements. */
export function isOfficeBearer(user: Member | null): boolean {
  return isAdmin(user) || (user?.titles ?? []).length > 0;
}

export function canLogAttendance(user: Member | null): boolean {
  return isAdmin(user) || hasTitleOrDeputy(user, 'secretary');
}

export function canVerifyPayments(user: Member | null): boolean {
  return isAdmin(user) || hasTitleOrDeputy(user, 'treasurer');
}

export function canApplyFines(user: Member | null): boolean {
  return isAdmin(user) || hasTitle(user, 'disciplineMaster');
}

export function canManageMinutes(user: Member | null): boolean {
  return isAdmin(user) || hasTitleOrDeputy(user, 'secretary');
}

export function canPostAnnouncement(user: Member | null): boolean {
  return isOfficeBearer(user);
}

export function canRecordFunds(user: Member | null): boolean {
  return isAdmin(user) || hasTitleOrDeputy(user, 'treasurer');
}

/** Can this user vote on expenses/withdrawals/investments/exit requests (active member) */
export function canVote(user: Member | null): boolean {
  return !!user && user.active && isSavingsGroupMember(user);
}
