/**
 * The annual earnings statement for a creator or a mentor: the "tax
 * reporting tools" the blueprint promises creators, done as the summary a
 * member takes to her tax return.
 *
 * The platform pays members three ways: gifts from viewers (the creator's
 * share of the points), mentoring sessions (the mentor's payout after the
 * platform fee), and the bank payouts that move the money out. The first
 * two are what she earned in the year and are assessable; the third is
 * when it reached her bank. All three are summed for the financial year.
 */

import { prisma } from '../../utils/prisma';
import { round2 } from './tax-plan.service';

export const POINT_VALUE_AUD = 0.01;

export interface FinancialYear {
  label: string;
  from: Date;
  to: Date;
}

/** The Australian financial year that ends in `endYear`: 1 July to 30 June. */
export function financialYear(endYear?: number, now = new Date()): FinancialYear {
  const year = endYear ?? (now.getUTCMonth() >= 6 ? now.getUTCFullYear() + 1 : now.getUTCFullYear());
  return { label: `FY${year}`, from: new Date(Date.UTC(year - 1, 6, 1)), to: new Date(Date.UTC(year, 5, 30, 23, 59, 59, 999)) };
}

export interface StatementLine {
  key: 'gifts' | 'mentoring' | 'payouts';
  label: string;
  count: number;
  gross: number;
  platformFees: number;
  net: number;
}

export interface EarningsStatement {
  fy: string;
  from: string;
  to: string;
  lines: StatementLine[];
  assessableIncome: number;
  platformFees: number;
  paidToBank: number;
  gstRegistrationDue: boolean;
  notes: string[];
}

export async function buildEarningsStatement(userId: string, endYear?: number, now = new Date()): Promise<EarningsStatement> {
  const fy = financialYear(endYear, now);
  const range = { gte: fy.from, lte: fy.to };

  const [gifts, sessions, creatorProfile] = await Promise.all([
    prisma.giftTransaction.findMany({ where: { receiverId: userId, createdAt: range }, select: { giftValue: true, creatorShare: true, platformShare: true } }),
    prisma.mentorSession.findMany({ where: { mentorProfile: { userId }, paymentCapturedAt: range }, select: { sessionAmount: true, platformFee: true, mentorPayout: true } }),
    prisma.creatorProfile.findUnique({ where: { userId }, select: { id: true } }),
  ]);
  const payouts = creatorProfile
    ? await prisma.creatorPayout.findMany({ where: { creatorProfileId: creatorProfile.id, status: 'COMPLETED', completedAt: range }, select: { amount: true } })
    : [];

  const giftGross = gifts.reduce((s, g) => s + g.giftValue, 0) * POINT_VALUE_AUD;
  const giftFees = gifts.reduce((s, g) => s + g.platformShare, 0) * POINT_VALUE_AUD;
  const giftNet = gifts.reduce((s, g) => s + g.creatorShare, 0) * POINT_VALUE_AUD;
  const sessionGross = sessions.reduce((s, x) => s + Number(x.sessionAmount), 0);
  const sessionFees = sessions.reduce((s, x) => s + Number(x.platformFee), 0);
  const sessionNet = sessions.reduce((s, x) => s + Number(x.mentorPayout), 0);
  const paid = payouts.reduce((s, p) => s + p.amount, 0);

  const lines: StatementLine[] = [
    { key: 'gifts', label: 'Gifts from viewers', count: gifts.length, gross: round2(giftGross), platformFees: round2(giftFees), net: round2(giftNet) },
    { key: 'mentoring', label: 'Mentoring sessions', count: sessions.length, gross: round2(sessionGross), platformFees: round2(sessionFees), net: round2(sessionNet) },
    { key: 'payouts', label: 'Paid to your bank', count: payouts.length, gross: round2(paid), platformFees: 0, net: round2(paid) },
  ];
  const assessable = round2(giftNet + sessionNet);
  const fees = round2(giftFees + sessionFees);

  return {
    fy: fy.label,
    from: fy.from.toISOString().slice(0, 10),
    to: fy.to.toISOString().slice(0, 10),
    lines,
    assessableIncome: assessable,
    platformFees: fees,
    paidToBank: round2(paid),
    gstRegistrationDue: giftGross + sessionGross >= 75000,
    notes: [
      'Income earned on the platform is assessable in the year it was earned, whether or not it had reached your bank by 30 June.',
      'The figures are shown net of the platform fee. If you report the gross instead, the fee is a deduction; do not do both.',
      'Gifts are valued at one cent a point, the rate the platform pays out at.',
      'Regular, organised earning with a view to profit is a business for tax; a few gifts a year may be a hobby. The ATO has a test; an accountant can apply it.',
      giftGross + sessionGross >= 75000 ? 'Gross earnings passed $75,000 this year: GST registration is required, and your sessions would carry GST.' : 'Under $75,000 gross, GST registration is optional.',
      'This is a summary from the platform\'s records, not a payment summary from an employer. Keep it with your tax records.',
    ],
  };
}
