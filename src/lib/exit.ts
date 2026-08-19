import { Contribution, Fine, RefundBreakdown } from './types';

/**
 * Exit-request refund math (platform plan Section I): sum what the member
 * paid in, subtract unwaived fines/arrears, then apply the constitution's
 * exit deduction — every line shown separately so the committee and the
 * exiting member see the same numbers.
 */
export function calculateRefund(
  memberContributions: Contribution[],
  memberFines: Fine[],
  exitDeductionPct: number
): RefundBreakdown {
  const contributionsPaid = memberContributions
    .filter(c => c.status === 'Paid' && c.purpose === 'monthly')
    .reduce((s, c) => s + c.amount, 0);

  const welfarePaid = memberContributions
    .filter(c => c.status === 'Paid' && c.purpose !== 'monthly')
    .reduce((s, c) => s + c.amount, 0);

  const arrears = memberFines
    .filter(f => !f.waived)
    .reduce((s, f) => s + f.amount, 0);

  const gross = Math.max(0, contributionsPaid - arrears);
  const deductionAmount = Math.round(gross * exitDeductionPct);
  const netRefund = Math.max(0, gross - deductionAmount);

  return {
    contributionsPaid,
    welfarePaid,
    arrears,
    deductionPct: exitDeductionPct,
    deductionAmount,
    netRefund,
  };
}
