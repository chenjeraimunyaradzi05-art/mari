/**
 * The financial roadmap: the "personalised financial plan" the blueprint
 * describes, built from what the member has actually done on the platform
 * rather than from a questionnaire alone.
 *
 * The order is the one every adviser gives: a safety net, then expensive
 * debt, then super and insurance, then investing, then the bigger plans.
 * Each step reads its status from her own records (a savings goal, a card
 * balance she entered, a super account, an insurance application, a saved
 * plan), so the roadmap moves as she does. The peer snapshot beside it is
 * an anonymous aggregate across all members and is withheld while there
 * are too few to hide anyone in.
 */

import { prisma } from '../../utils/prisma';
import { round, round2 } from './tax-plan.service';

export type StepStatus = 'done' | 'in_progress' | 'next' | 'later';

export interface RoadmapStep {
  key: string;
  title: string;
  why: string;
  status: StepStatus;
  href: string;
  detail: string;
}

export interface Roadmap {
  steps: RoadmapStep[];
  completed: number;
  total: number;
  personalRunwayMonths: number | null;
  cash: number;
  monthlyExpenses: number | null;
}

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const money = (n: number) => `$${round(n).toLocaleString('en-AU')}`;

export async function buildRoadmap(userId: string): Promise<Roadmap> {
  const [goals, holdings, superAccounts, insurance, plans, registrations] = await Promise.all([
    prisma.savingsGoal.findMany({ where: { userId }, select: { type: true, status: true, currentAmount: true, targetAmount: true } }),
    prisma.portfolioHolding.findMany({ where: { userId }, select: { kind: true, category: true, value: true } }),
    prisma.superannuationAccount.count({ where: { userId } }),
    prisma.insuranceApplication.findMany({ where: { userId }, select: { status: true, product: { select: { type: true } } } }),
    prisma.strategyPlan.findMany({ where: { userId }, select: { area: true, inputs: true, result: true } }),
    prisma.businessRegistration.count({ where: { userId } }),
  ]);

  const plan = (area: string) => plans.find((p) => p.area === area);
  const investment = plan('INVESTMENT');
  const inputs = (investment?.inputs ?? {}) as Record<string, unknown>;
  const result = (investment?.result ?? {}) as Record<string, unknown>;
  const expenses = num(inputs.expenses) || null;

  const emergency = goals.filter((g) => g.type === 'EMERGENCY_FUND').sort((a, b) => num(b.currentAmount) / Math.max(1, num(b.targetAmount)) - num(a.currentAmount) / Math.max(1, num(a.targetAmount)))[0];
  const emergencyProgress = emergency ? num(emergency.currentAmount) / Math.max(1, num(emergency.targetAmount)) : 0;
  const cash = holdings.filter((h) => h.category === 'CASH').reduce((s, h) => s + num(h.value), 0) + goals.filter((g) => g.status === 'ACTIVE').reduce((s, g) => s + num(g.currentAmount), 0);
  const expensiveDebt = holdings.filter((h) => h.kind === 'LIABILITY' && (h.category === 'CREDIT_CARD' || h.category === 'PERSONAL_LOAN')).reduce((s, h) => s + num(h.value), 0);
  const activeCover = insurance.filter((i) => i.status === 'APPROVED' || i.status === 'ACTIVE');
  const estate = (inputs.estate ?? {}) as Record<string, boolean>;
  const estateDone = Object.values(estate).filter(Boolean).length;

  const steps: RoadmapStep[] = [
    {
      key: 'emergency_fund', title: 'A safety net', why: 'Three to six months of expenses is what lets everything else stay invested through a bad year.', href: '/dashboard/finance/invest#emergency',
      status: emergencyProgress >= 1 ? 'done' : emergency ? 'in_progress' : 'next',
      detail: emergency ? `${Math.round(emergencyProgress * 100)}% of ${money(num(emergency.targetAmount))} saved.` : 'Size it and track it as a savings goal.',
    },
    {
      key: 'expensive_debt', title: 'Cards and personal loans', why: 'Interest around 20% beats any return you could earn, so clearing it is the best investment available.', href: '/dashboard/finance/debt',
      status: holdings.length === 0 ? 'later' : expensiveDebt > 0 ? 'next' : 'done',
      detail: holdings.length === 0 ? 'Add what you owe on the investing page and this step will read it.' : expensiveDebt > 0 ? `${money(expensiveDebt)} of card and loan debt to plan around.` : 'No expensive debt recorded.',
    },
    {
      key: 'super', title: 'Super, tracked and topped up', why: 'The contributions that close the gap a career break opens, at 15% tax instead of your marginal rate.', href: superAccounts > 0 ? '/dashboard/finance/tax/plan#super' : '/dashboard/finance/super',
      status: superAccounts > 0 && plan('TAX') ? 'done' : superAccounts > 0 ? 'in_progress' : 'next',
      detail: superAccounts > 0 ? (plan('TAX') ? 'Account tracked and the contribution plan saved.' : 'Account tracked. Work out the contribution moves in the tax plan.') : 'Add your fund so the projection and the tax plan can use it.',
    },
    {
      key: 'insurance', title: 'Income protection', why: 'If you could not work for a year, this is what pays the rent. It matters more than life cover when nobody depends on you.', href: '/dashboard/finance/insurance',
      status: activeCover.length > 0 ? 'done' : insurance.length > 0 ? 'in_progress' : 'next',
      detail: activeCover.length > 0 ? `${activeCover.length} cover${activeCover.length === 1 ? '' : 's'} in place.` : insurance.length > 0 ? 'An application is in progress.' : 'Size the cover you need, then compare policies.',
    },
    {
      key: 'investing', title: 'A mix that suits you', why: 'Once the net is there, money left over should be working. The six questions give you the split, and net worth shows you against it.', href: '/dashboard/finance/invest#profile',
      status: result.profile ? 'done' : 'next',
      detail: result.profile ? `${String(result.label ?? result.profile)} mix saved; net worth reads it.` : 'Answer the six questions and save the plan.',
    },
    {
      key: 'housing', title: 'Somewhere of your own', why: 'Rent you can carry now, and a deposit plan with a date on it if buying is the goal.', href: '/dashboard/housing/plan',
      status: plan('HOUSING') ? 'done' : 'later',
      detail: plan('HOUSING') ? 'Housing plan saved.' : 'Work the deposit, the loan and rent-or-buy when you are ready.',
    },
  ];
  if (registrations > 0 || plan('BUSINESS')) {
    steps.push({
      key: 'business', title: 'The business, on a footing', why: 'The structure, the quarterly set-aside and what it is worth, before the paperwork.', href: '/dashboard/business/strategy',
      status: plan('BUSINESS') ? 'done' : 'next',
      detail: plan('BUSINESS') ? 'Business strategy saved.' : `${registrations} registration${registrations === 1 ? '' : 's'} started; the strategy is not saved yet.`,
    });
  }
  steps.push({
    key: 'estate', title: 'A will, and who gets the super', why: 'Super does not pass under a will unless the fund is told. Six things, an afternoon, done once.', href: '/dashboard/finance/invest#estate',
    status: estateDone >= 5 ? 'done' : estateDone > 0 ? 'in_progress' : 'later',
    detail: estateDone > 0 ? `${estateDone} of 6 done.` : 'The checklist is on the investing page.',
  });

  // One thing at a time: the first open step is next, the rest wait.
  let nextGiven = false;
  for (const s of steps) {
    if (s.status === 'next') {
      if (nextGiven) s.status = 'later';
      nextGiven = true;
    }
  }

  return {
    steps,
    completed: steps.filter((s) => s.status === 'done').length,
    total: steps.length,
    personalRunwayMonths: expenses ? round2(cash / expenses) : null,
    cash: round(cash),
    monthlyExpenses: expenses,
  };
}

export interface PeerSnapshot {
  members: number;
  enough: boolean;
  emergencyFund: { withGoalPct: number; medianProgressPct: number; reachedPct: number } | null;
  superTrackedPct: number | null;
  investingPlanPct: number | null;
  note: string;
}

const MIN_MEMBERS = 20;

export async function peerSnapshot(): Promise<PeerSnapshot> {
  const [members, efGoals, superUsers, investingPlans] = await Promise.all([
    prisma.user.count({ where: { isActive: true } }),
    prisma.savingsGoal.findMany({ where: { type: 'EMERGENCY_FUND' }, select: { userId: true, currentAmount: true, targetAmount: true }, take: 10000 }),
    prisma.superannuationAccount.findMany({ distinct: ['userId'], select: { userId: true }, take: 10000 }),
    prisma.strategyPlan.count({ where: { area: 'INVESTMENT' } }),
  ]);
  if (members < MIN_MEMBERS) {
    return { members, enough: false, emergencyFund: null, superTrackedPct: null, investingPlanPct: null, note: `Peer figures appear once there are ${MIN_MEMBERS} members, so nobody can be picked out.` };
  }
  const best = new Map<string, number>();
  for (const g of efGoals) {
    const p = Math.min(1, num(g.currentAmount) / Math.max(1, num(g.targetAmount)));
    best.set(g.userId, Math.max(best.get(g.userId) ?? 0, p));
  }
  const progresses = [...best.values()].sort((a, b) => a - b);
  const median = progresses.length ? progresses[Math.floor(progresses.length / 2)] : 0;
  const pct = (n: number) => round2((n / members) * 100);
  return {
    members,
    enough: true,
    emergencyFund: { withGoalPct: pct(best.size), medianProgressPct: round2(median * 100), reachedPct: pct(progresses.filter((p) => p >= 1).length) },
    superTrackedPct: pct(superUsers.length),
    investingPlanPct: pct(investingPlans),
    note: 'Across all members, anonymous. Nobody sees anyone else’s numbers.',
  };
}
