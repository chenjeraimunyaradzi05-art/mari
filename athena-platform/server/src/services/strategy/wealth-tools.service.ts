/**
 * The smaller wealth tools the blueprint's financial engine lists: a goal
 * broken into a monthly amount, the round-ups a month of spending would
 * have saved, the insurance a household actually needs, super carried to
 * retirement with the gap a career break opens, and what the holdings have
 * gained or lost and what that means for capital gains tax.
 */

import { INFLATION_ASSUMPTION_PCT, RATES_AS_AT, SUPER } from './au-rates';
import { marginalWithMedicare, round, round2 } from './tax-plan.service';

const clamp0 = (n: number) => Math.max(0, n);

// ---------------------------------------------------------------- goals

export interface GoalPlanInput {
  target: number;
  current?: number;
  targetDate?: string;
  months?: number;
  ratePct?: number;
}

export interface GoalPlanResult {
  target: number;
  current: number;
  gap: number;
  months: number;
  monthlyNeeded: number;
  weeklyNeeded: number;
  fortnightlyNeeded: number;
  milestones: Array<{ pct: number; amount: number; month: number }>;
  note: string;
}

export function planGoal(input: GoalPlanInput): GoalPlanResult {
  const target = clamp0(input.target);
  const current = Math.min(target, clamp0(input.current ?? 0));
  const gap = target - current;
  let months = input.months ?? 0;
  if (!months && input.targetDate) {
    const days = (new Date(input.targetDate).getTime() - Date.now()) / 86400000;
    months = Math.max(1, Math.round(days / 30.44));
  }
  months = Math.min(600, Math.max(1, Math.round(months || 12)));
  const r = clamp0(input.ratePct ?? 0) / 100 / 12;
  const growth = Math.pow(1 + r, months);
  const monthly = r === 0 ? gap / months : clamp0((target - current * growth) * r / (growth - 1));

  const milestones = [25, 50, 75, 100].map((pct) => {
    const amount = target * (pct / 100);
    let balance = current;
    let m = 0;
    while (balance < amount && m < months) { m += 1; balance = balance * (1 + r) + monthly; }
    return { pct, amount: round(amount), month: balance >= amount ? m : months };
  });

  return {
    target: round(target),
    current: round(current),
    gap: round(gap),
    months,
    monthlyNeeded: round(monthly),
    weeklyNeeded: round((monthly * 12) / 52),
    fortnightlyNeeded: round((monthly * 12) / 26),
    milestones,
    note: gap === 0 ? 'Already there.' : `$${round(monthly).toLocaleString('en-AU')} a month reaches $${round(target).toLocaleString('en-AU')} in ${months} months${r > 0 ? ', with interest helping' : ''}.`,
  };
}

// ------------------------------------------------------------- round-ups

export interface RoundUpLine {
  description: string;
  amountCents: number;
  postedAt: Date | string;
}

export interface RoundUpResult {
  roundTo: number;
  days: number;
  purchases: number;
  total: number;
  monthlyEstimate: number;
  yearlyEstimate: number;
  yearlyWithReturn: number;
  examples: Array<{ description: string; spent: number; roundUp: number }>;
  note: string;
}

/** What rounding every purchase up would have put aside. */
export function roundUpPotential(lines: RoundUpLine[], roundTo: 1 | 5 | 10 = 5, days = 30, returnPct = 4.5): RoundUpResult {
  const spends = lines.filter((l) => l.amountCents < 0);
  const step = roundTo * 100;
  let total = 0;
  const examples: RoundUpResult['examples'] = [];
  for (const l of spends) {
    const cents = Math.abs(l.amountCents);
    const up = (step - (cents % step)) % step;
    total += up;
    if (up > 0 && examples.length < 5) examples.push({ description: l.description, spent: cents / 100, roundUp: up / 100 });
  }
  const monthly = days > 0 ? (total / 100) * (30.44 / days) : 0;
  const yearly = monthly * 12;
  const r = returnPct / 100 / 12;
  const yearlyWithReturn = r > 0 ? monthly * ((Math.pow(1 + r, 12) - 1) / r) : yearly;
  return {
    roundTo,
    days,
    purchases: spends.length,
    total: round2(total / 100),
    monthlyEstimate: round(monthly),
    yearlyEstimate: round(yearly),
    yearlyWithReturn: round(yearlyWithReturn),
    examples,
    note: spends.length === 0 ? 'No purchases in the period to round up.' : `Rounding ${spends.length} purchases up to the nearest $${roundTo} would have put aside $${round2(total / 100).toLocaleString('en-AU')} in ${days} days, about $${round(monthly).toLocaleString('en-AU')} a month.`,
  };
}

// --------------------------------------------------------------- insurance

export interface InsuranceNeedsInput {
  income: number;
  monthlyExpenses: number;
  debts?: number;
  dependants?: number;
  yearsOfSupport?: number;
  partnerIncome?: number;
  savings?: number;
  superBalance?: number;
  existingLife?: number;
  existingTpd?: number;
  existingIncomeProtectionMonthly?: number;
  emergencyFundMonths?: number;
}

export interface InsuranceNeedsResult {
  asAt: string;
  incomeProtection: { monthlyBenefit: number; existing: number; gap: number; waitingPeriodDays: number; benefitPeriod: string; note: string };
  life: { need: number; existing: number; gap: number; breakdown: Array<{ label: string; amount: number }> };
  tpd: { need: number; existing: number; gap: number };
  trauma: { suggested: number; note: string };
  notes: string[];
}

export function assessInsuranceNeeds(input: InsuranceNeedsInput): InsuranceNeedsResult {
  const income = clamp0(input.income);
  const expensesAnnual = clamp0(input.monthlyExpenses) * 12;
  const dependants = Math.round(clamp0(input.dependants ?? 0));
  const years = Math.round(clamp0(input.yearsOfSupport ?? (dependants > 0 ? 15 : 5)));
  const partner = clamp0(input.partnerIncome ?? 0);
  const liquid = clamp0(input.savings ?? 0);
  const superBalance = clamp0(input.superBalance ?? 0);
  const debts = clamp0(input.debts ?? 0);

  const ipMonthly = (income * 0.7) / 12;
  const ipExisting = clamp0(input.existingIncomeProtectionMonthly ?? 0);
  const efMonths = clamp0(input.emergencyFundMonths ?? 0);
  const waiting = efMonths >= 3 ? 90 : efMonths >= 1 ? 30 : 14;

  // What the household would need if the income stopped for good.
  const shortfall = clamp0(expensesAnnual - partner * 0.7);
  const breakdown = [
    { label: 'Clear the debts', amount: debts },
    { label: `${years} years of the household shortfall`, amount: shortfall * years },
    { label: 'Education and care for dependants', amount: dependants * 60000 },
    { label: 'Funeral and final costs', amount: 15000 },
    { label: 'Less savings and super already there', amount: -(liquid + superBalance) },
  ];
  const lifeNeed = clamp0(breakdown.reduce((s, b) => s + b.amount, 0));
  const lifeExisting = clamp0(input.existingLife ?? 0);
  const tpdNeed = clamp0(lifeNeed + 250000); // the person is still here and needs care and a home that works
  const tpdExisting = clamp0(input.existingTpd ?? 0);

  return {
    asAt: RATES_AS_AT,
    incomeProtection: {
      monthlyBenefit: round(ipMonthly),
      existing: round(ipExisting),
      gap: round(clamp0(ipMonthly - ipExisting)),
      waitingPeriodDays: waiting,
      benefitPeriod: dependants > 0 || income > 90000 ? 'To age 65' : 'Two to five years',
      note: `Policies replace up to 70% of income. With ${efMonths} months of emergency fund a ${waiting}-day waiting period keeps the premium down; the fund carries you until it starts.`,
    },
    life: { need: round(lifeNeed), existing: round(lifeExisting), gap: round(clamp0(lifeNeed - lifeExisting)), breakdown: breakdown.map((b) => ({ ...b, amount: round(b.amount) })) },
    tpd: { need: round(tpdNeed), existing: round(tpdExisting), gap: round(clamp0(tpdNeed - tpdExisting)) },
    trauma: { suggested: round(Math.min(250000, Math.max(50000, expensesAnnual * 2))), note: 'A lump sum on a serious diagnosis, for treatment and time off; the one cover that helps while you are still working.' },
    notes: [
      'Most super funds include some life and TPD cover; check the statement before buying more, and whether it is enough.',
      'Income protection outside super is tax deductible and usually pays for longer; inside super it is cheaper but capped and taxed on the way out.',
      dependants === 0 && debts === 0 ? 'With no dependants and no debt, income protection matters far more than life cover.' : '',
      'This sizes the cover; a licensed adviser or the insurer sets the premium and the terms.',
    ].filter(Boolean),
  };
}

// ------------------------------------------------------------------- super

export interface SuperProjectionInput {
  age: number;
  retirementAge?: number;
  balance: number;
  salary: number;
  salaryGrowthPct?: number;
  extraMonthly?: number;
  returnPct?: number;
  feesPct?: number;
  inflationPct?: number;
  careerBreakYears?: number;
  breakAtAge?: number;
  partTimeYears?: number;
  partTimeFraction?: number;
}

export interface SuperScenario {
  key: 'base' | 'break' | 'extra';
  label: string;
  endBalance: number;
  endBalanceToday: number;
  series: Array<{ age: number; balance: number }>;
}

export interface SuperProjectionResult {
  asAt: string;
  retirementAge: number;
  yearsToGo: number;
  scenarios: SuperScenario[];
  comfortableStandard: { single: number; couple: number; asAt: string };
  gapToComfortable: number;
  careerBreakCost: number;
  catchUpMonthly: number;
  notes: string[];
}

export const ASFA_COMFORTABLE = { single: 595000, couple: 690000, asAt: 'ASFA Retirement Standard, 2024' };

function runSuper(input: SuperProjectionInput, opts: { breakYears: number; breakAt: number; partTimeYears: number; partTimeFraction: number; extra: number }): SuperScenario['series'] {
  const retirement = Math.max(input.age + 1, Math.round(input.retirementAge ?? 67));
  const net = (clamp0(input.returnPct ?? 6.5) - clamp0(input.feesPct ?? 0.7)) / 100;
  let balance = clamp0(input.balance);
  let salary = clamp0(input.salary);
  const growth = (input.salaryGrowthPct ?? 3) / 100;
  const series: SuperScenario['series'] = [{ age: input.age, balance: round(balance) }];
  let partTimeLeft = opts.partTimeYears;
  for (let age = input.age + 1; age <= retirement; age += 1) {
    const onBreak = age > opts.breakAt && age <= opts.breakAt + opts.breakYears;
    let fraction = onBreak ? 0 : 1;
    if (!onBreak && partTimeLeft > 0 && age > opts.breakAt + opts.breakYears) { fraction = opts.partTimeFraction; partTimeLeft -= 1; }
    const employer = salary * fraction * SUPER.guaranteeRate * (1 - SUPER.contributionsTax);
    const extra = onBreak ? 0 : opts.extra * 12 * (1 - SUPER.contributionsTax);
    balance = balance * (1 + net) + employer + extra;
    series.push({ age, balance: round(balance) });
    if (!onBreak) salary *= 1 + growth;
  }
  return series;
}

export function projectSuper(input: SuperProjectionInput): SuperProjectionResult {
  const retirement = Math.max(input.age + 1, Math.round(input.retirementAge ?? 67));
  const years = retirement - input.age;
  const inflation = clamp0(input.inflationPct ?? INFLATION_ASSUMPTION_PCT) / 100;
  const breakYears = clamp0(input.careerBreakYears ?? 0);
  const breakAt = input.breakAtAge ?? input.age + 2;
  const extra = clamp0(input.extraMonthly ?? 0);
  const toToday = (n: number) => round(n / Math.pow(1 + inflation, years));

  const base = runSuper(input, { breakYears: 0, breakAt, partTimeYears: 0, partTimeFraction: 1, extra: 0 });
  const withBreak = runSuper(input, { breakYears: breakYears || 2, breakAt, partTimeYears: clamp0(input.partTimeYears ?? 0), partTimeFraction: Math.min(1, Math.max(0.1, input.partTimeFraction ?? 0.6)), extra: 0 });
  const withExtra = runSuper(input, { breakYears: 0, breakAt, partTimeYears: 0, partTimeFraction: 1, extra: extra || 200 });

  const end = (s: SuperScenario['series']) => s[s.length - 1].balance;
  const breakCost = end(base) - end(withBreak);
  const gap = clamp0(ASFA_COMFORTABLE.single - toToday(end(base)));

  // The monthly amount, after contributions tax, that closes the break's gap by retirement.
  const net = (clamp0(input.returnPct ?? 6.5) - clamp0(input.feesPct ?? 0.7)) / 100 / 12;
  const months = years * 12;
  const factor = net > 0 ? (Math.pow(1 + net, months) - 1) / net : months;
  const catchUp = breakCost > 0 ? breakCost / factor / (1 - SUPER.contributionsTax) : 0;

  return {
    asAt: RATES_AS_AT,
    retirementAge: retirement,
    yearsToGo: years,
    scenarios: [
      { key: 'base', label: 'Working through', endBalance: end(base), endBalanceToday: toToday(end(base)), series: base },
      { key: 'break', label: `A ${breakYears || 2}-year break${input.partTimeYears ? ` then ${input.partTimeYears} years part-time` : ''}`, endBalance: end(withBreak), endBalanceToday: toToday(end(withBreak)), series: withBreak },
      { key: 'extra', label: `$${(extra || 200).toLocaleString('en-AU')} a month extra`, endBalance: end(withExtra), endBalanceToday: toToday(end(withExtra)), series: withExtra },
    ],
    comfortableStandard: ASFA_COMFORTABLE,
    gapToComfortable: gap,
    careerBreakCost: round(breakCost),
    catchUpMonthly: round(catchUp),
    notes: [
      `Employer contributions at ${Math.round(SUPER.guaranteeRate * 100)}% less 15% tax, returns of ${input.returnPct ?? 6.5}% less ${input.feesPct ?? 0.7}% fees, salary growing ${input.salaryGrowthPct ?? 3}% a year.`,
      'Women retire with about a quarter less super than men on average, and the gap is mostly the years out of paid work. The break scenario shows what those years cost, and the catch-up amount what closes it.',
      `The comfortable standard is what ASFA says a home-owning single needs at 67, in today's dollars, alongside a part pension.`,
      'Concessional catch-up contributions can use unused cap from the previous five years while the balance is under $500,000.',
    ],
  };
}

// ---------------------------------------------------------------- holdings

export interface ReviewHolding {
  id?: string;
  name: string;
  category: string;
  value: unknown;
  costBase?: unknown;
  acquiredAt?: Date | string | null;
}

export interface HoldingReview {
  id?: string;
  name: string;
  category: string;
  value: number;
  costBase: number | null;
  gain: number | null;
  gainPct: number | null;
  heldMonths: number | null;
  discountEligible: boolean;
  taxIfSold: number | null;
}

export interface HoldingsReviewResult {
  asAt: string;
  holdings: HoldingReview[];
  unrealisedGains: number;
  unrealisedLosses: number;
  netPosition: number;
  taxIfAllSold: number;
  marginalRate: number;
  harvest: Array<{ name: string; loss: number; note: string }>;
  notes: string[];
}

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Gains, losses and the tax on them, from cost base and purchase date. */
export function reviewHoldings(holdings: ReviewHolding[], taxableIncome: number, now = new Date()): HoldingsReviewResult {
  const marginal = marginalWithMedicare(clamp0(taxableIncome));
  const rows: HoldingReview[] = holdings.map((h) => {
    const value = num(h.value);
    const costBase = h.costBase === null || h.costBase === undefined || h.costBase === '' ? null : num(h.costBase);
    const acquired = h.acquiredAt ? new Date(h.acquiredAt) : null;
    const heldMonths = acquired ? Math.floor((now.getTime() - acquired.getTime()) / (30.44 * 86400000)) : null;
    const gain = costBase === null ? null : value - costBase;
    const discountEligible = heldMonths !== null && heldMonths >= 12;
    const taxable = gain === null ? null : gain > 0 ? gain * (discountEligible ? 0.5 : 1) : gain;
    return {
      id: h.id, name: h.name, category: h.category, value: round(value), costBase: costBase === null ? null : round(costBase),
      gain: gain === null ? null : round(gain), gainPct: gain === null || !costBase ? null : round2((gain / costBase) * 100),
      heldMonths, discountEligible, taxIfSold: taxable === null ? null : round(Math.max(0, taxable) * marginal),
    };
  });

  const gains = rows.filter((r) => (r.gain ?? 0) > 0);
  const losses = rows.filter((r) => (r.gain ?? 0) < 0);
  const unrealisedGains = gains.reduce((s, r) => s + (r.gain ?? 0), 0);
  const unrealisedLosses = losses.reduce((s, r) => s + (r.gain ?? 0), 0);
  const taxableGains = gains.reduce((s, r) => s + (r.gain ?? 0) * (r.discountEligible ? 0.5 : 1), 0);
  const taxIfAllSold = clamp0(taxableGains + unrealisedLosses) * marginal;

  const harvest = losses
    .filter(() => gains.length > 0)
    .map((l) => ({ name: l.name, loss: round(-(l.gain ?? 0)), note: `Selling would realise a $${round(-(l.gain ?? 0)).toLocaleString('en-AU')} loss to set against gains this year, worth about $${round(-(l.gain ?? 0) * marginal).toLocaleString('en-AU')} in tax. Only if you would not buy it straight back.` }));

  return {
    asAt: RATES_AS_AT,
    holdings: rows,
    unrealisedGains: round(unrealisedGains),
    unrealisedLosses: round(unrealisedLosses),
    netPosition: round(unrealisedGains + unrealisedLosses),
    taxIfAllSold: round(taxIfAllSold),
    marginalRate: marginal,
    harvest,
    notes: [
      'A gain on something held over twelve months is halved before it is taxed; a loss offsets gains in the same year, or carries forward.',
      'Selling to realise a loss and buying the same thing back is a wash sale the ATO can unwind. Switch to something similar, or wait.',
      'Tax is only on what you sell. Nothing here is owed while you hold.',
      'Super and your own home are outside this: super is taxed inside the fund and the home is exempt.',
    ],
  };
}
