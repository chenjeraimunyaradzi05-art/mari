/**
 * The investment strategy: a risk profile from a short questionnaire, the
 * mix that profile points to, what a member owns against it, and where the
 * numbers go over ten or twenty years if she keeps going.
 *
 * This is general information. The profiles and the mixes are the ordinary
 * ones a super fund would show, the return figures are long-run assumptions
 * named as such, and no product is recommended. A member who wants advice
 * on her own situation needs a licensed adviser, and the pages say so.
 */

import { INFLATION_ASSUMPTION_PCT, RATES_AS_AT, RETURN_ASSUMPTIONS, SUPER } from './au-rates';
import { round, round2 } from './tax-plan.service';

const clamp0 = (n: number) => Math.max(0, n);

// ------------------------------------------------------------- profile

export type RiskProfile = 'conservative' | 'cautious' | 'balanced' | 'growth' | 'high_growth';
export type AssetClass = 'cash' | 'bonds' | 'auShares' | 'intlShares' | 'property';

export const RISK_QUESTIONS: Array<{ id: string; text: string; options: Array<{ score: number; label: string }> }> = [
  { id: 'horizon', text: 'When will you need most of this money?', options: [{ score: 1, label: 'Within 3 years' }, { score: 2, label: '3 to 5 years' }, { score: 3, label: '5 to 10 years' }, { score: 4, label: 'More than 10 years' }] },
  { id: 'drop', text: 'Your investments fall 20% in a bad year. You would...', options: [{ score: 1, label: 'Sell so it cannot fall further' }, { score: 2, label: 'Move some to cash' }, { score: 3, label: 'Hold on' }, { score: 4, label: 'Buy more while it is cheap' }] },
  { id: 'experience', text: 'How much investing have you done?', options: [{ score: 1, label: 'None, this is new' }, { score: 2, label: 'A little, mostly savings' }, { score: 3, label: 'Some shares or ETFs' }, { score: 4, label: 'Comfortable with a portfolio' }] },
  { id: 'income', text: 'How steady is your income?', options: [{ score: 1, label: 'Irregular, or between jobs' }, { score: 2, label: 'Casual or part-time' }, { score: 3, label: 'Steady' }, { score: 4, label: 'Steady, with savings to spare' }] },
  { id: 'goal', text: 'What matters more?', options: [{ score: 1, label: 'Never losing money' }, { score: 2, label: 'Mostly steady, some growth' }, { score: 3, label: 'Growth, with some bumps' }, { score: 4, label: 'The most growth over time' }] },
  { id: 'access', text: 'Could you leave it alone through a downturn?', options: [{ score: 1, label: 'No, I may need it' }, { score: 2, label: 'Probably not' }, { score: 3, label: 'Yes, for a year or two' }, { score: 4, label: 'Yes, for as long as it takes' }] },
];

const PROFILES: Record<RiskProfile, { label: string; growthPct: number; allocation: Record<AssetClass, number>; summary: string }> = {
  conservative: { label: 'Conservative', growthPct: 30, allocation: { cash: 30, bonds: 40, auShares: 12, intlShares: 13, property: 5 }, summary: 'Mostly cash and bonds. Small moves, small returns, and the money is there when you reach for it.' },
  cautious: { label: 'Cautious', growthPct: 45, allocation: { cash: 20, bonds: 35, auShares: 18, intlShares: 20, property: 7 }, summary: 'A little under half in growth assets. Some years will be down, most will be up.' },
  balanced: { label: 'Balanced', growthPct: 60, allocation: { cash: 10, bonds: 30, auShares: 24, intlShares: 28, property: 8 }, summary: 'The middle of the road, and the default in most super funds for a reason.' },
  growth: { label: 'Growth', growthPct: 75, allocation: { cash: 5, bonds: 20, auShares: 28, intlShares: 37, property: 10 }, summary: 'Three quarters in shares and property. Bigger swings, and time on your side to ride them out.' },
  high_growth: { label: 'High growth', growthPct: 90, allocation: { cash: 2, bonds: 8, auShares: 32, intlShares: 46, property: 12 }, summary: 'Almost all growth assets. For money you will not touch for a decade or more.' },
};

export const ASSET_CLASS_LABELS: Record<AssetClass, string> = { cash: 'Cash', bonds: 'Bonds', auShares: 'Australian shares', intlShares: 'International shares', property: 'Property' };

export interface RiskProfileInput {
  answers: Record<string, number>;
  age?: number;
}

export interface RiskProfileResult {
  asAt: string;
  score: number;
  maxScore: number;
  profile: RiskProfile;
  label: string;
  summary: string;
  growthPct: number;
  defensivePct: number;
  allocation: Array<{ assetClass: AssetClass; label: string; pct: number }>;
  expectedReturnPct: number;
  volatilityPct: number;
  cappedBy: string | null;
  notes: string[];
}

export function assessRiskProfile(input: RiskProfileInput): RiskProfileResult {
  let score = 0;
  for (const q of RISK_QUESTIONS) {
    const answer = Number(input.answers?.[q.id]);
    score += Math.min(4, Math.max(1, Number.isFinite(answer) ? Math.round(answer) : 2));
  }
  const maxScore = RISK_QUESTIONS.length * 4;
  let profile: RiskProfile = score <= 9 ? 'conservative' : score <= 13 ? 'cautious' : score <= 17 ? 'balanced' : score <= 21 ? 'growth' : 'high_growth';

  // A short horizon overrides appetite: money needed soon cannot ride out a fall.
  const order: RiskProfile[] = ['conservative', 'cautious', 'balanced', 'growth', 'high_growth'];
  let cappedBy: string | null = null;
  const horizon = Number(input.answers?.horizon);
  const cap = (max: RiskProfile, why: string) => {
    if (order.indexOf(profile) > order.indexOf(max)) { profile = max; cappedBy = why; }
  };
  if (horizon === 1) cap('cautious', 'Money needed within three years');
  else if (horizon === 2) cap('balanced', 'Money needed within five years');
  if (input.age !== undefined && input.age >= 60) cap('balanced', 'Close to drawing on it');

  const p = PROFILES[profile];
  const assumptions = RETURN_ASSUMPTIONS[profile];
  return {
    asAt: RATES_AS_AT,
    score,
    maxScore,
    profile,
    label: p.label,
    summary: p.summary,
    growthPct: p.growthPct,
    defensivePct: 100 - p.growthPct,
    allocation: (Object.keys(p.allocation) as AssetClass[]).map((k) => ({ assetClass: k, label: ASSET_CLASS_LABELS[k], pct: p.allocation[k] })),
    expectedReturnPct: assumptions.returnPct,
    volatilityPct: assumptions.volatilityPct,
    cappedBy,
    notes: [
      'This is general information about how risk profiles are usually built, not a recommendation for you. A licensed financial adviser can give personal advice.',
      'Expected return is a long-run assumption before fees and tax; in any one year the result can be well above or below it.',
      'Low-cost, diversified funds are how most people hold each of these classes; the platform does not sell or recommend any.',
    ],
  };
}

export function allocationFor(profile: RiskProfile): Record<AssetClass, number> {
  return PROFILES[profile]?.allocation ?? PROFILES.balanced.allocation;
}

// ------------------------------------------------------------ net worth

export type WealthCategory =
  | 'CASH' | 'BONDS' | 'AU_SHARES' | 'INTL_SHARES' | 'PROPERTY' | 'SUPER' | 'CRYPTO' | 'BUSINESS' | 'OTHER_ASSET'
  | 'MORTGAGE' | 'HECS' | 'CREDIT_CARD' | 'PERSONAL_LOAN' | 'OTHER_LIABILITY';

export const ASSET_CATEGORIES: WealthCategory[] = ['CASH', 'BONDS', 'AU_SHARES', 'INTL_SHARES', 'PROPERTY', 'SUPER', 'CRYPTO', 'BUSINESS', 'OTHER_ASSET'];
export const LIABILITY_CATEGORIES: WealthCategory[] = ['MORTGAGE', 'HECS', 'CREDIT_CARD', 'PERSONAL_LOAN', 'OTHER_LIABILITY'];

export const CATEGORY_LABELS: Record<WealthCategory, string> = {
  CASH: 'Cash and savings', BONDS: 'Bonds and fixed interest', AU_SHARES: 'Australian shares', INTL_SHARES: 'International shares', PROPERTY: 'Property', SUPER: 'Superannuation', CRYPTO: 'Crypto', BUSINESS: 'Business equity', OTHER_ASSET: 'Other asset',
  MORTGAGE: 'Mortgage', HECS: 'HELP debt', CREDIT_CARD: 'Credit card', PERSONAL_LOAN: 'Personal or car loan', OTHER_LIABILITY: 'Other debt',
};

const INVESTABLE: Partial<Record<WealthCategory, AssetClass>> = { CASH: 'cash', BONDS: 'bonds', AU_SHARES: 'auShares', INTL_SHARES: 'intlShares', PROPERTY: 'property' };

export interface HoldingLike {
  id?: string;
  name: string;
  kind: 'ASSET' | 'LIABILITY';
  category: WealthCategory;
  value: unknown;
}

export interface NetWorthInput {
  holdings: HoldingLike[];
  superBalance?: number;
  superAccounts?: Array<{ balance: unknown; investmentOpt?: string | null }>;
  savingsBalance?: number;
  profile?: RiskProfile;
  emergencyFundTarget?: number;
}

/** The growth share a super fund's option implies, from its name. */
export function superOptionGrowthPct(option: string | null | undefined): number {
  const o = (option ?? '').toLowerCase();
  if (/high/.test(o)) return 90;
  if (/growth|aggressive/.test(o)) return 75;
  if (/conservative|stable|defensive|cash/.test(o)) return 30;
  if (/index|ethical|sustainable|socially/.test(o)) return 70;
  return 60;
}

/** Typical income yields by category, for the estimate of what the holdings pay. */
export const INCOME_YIELDS: Partial<Record<WealthCategory, number>> = { CASH: 4.5, BONDS: 4.0, AU_SHARES: 4.0, INTL_SHARES: 2.0, PROPERTY: 4.0 };

export interface NetWorthResult {
  asAt: string;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  byCategory: Array<{ category: WealthCategory; label: string; kind: 'ASSET' | 'LIABILITY'; value: number; pctOfAssets: number }>;
  investable: number;
  allocation: Array<{ assetClass: AssetClass; label: string; value: number; currentPct: number; targetPct: number; drift: number; move: number }>;
  crypto: number;
  suggestions: string[];
  warnings: string[];
  wholeOfWealth: { growthPct: number; defensivePct: number; targetGrowthPct: number; superGrowthPct: number | null; superBalance: number; note: string };
  incomeEstimate: { annual: number; monthly: number; byCategory: Array<{ category: WealthCategory; label: string; value: number; yieldPct: number; income: number }>; note: string };
}

export function assessNetWorth(input: NetWorthInput): NetWorthResult {
  const totals = new Map<WealthCategory, number>();
  const add = (c: WealthCategory, v: number) => totals.set(c, (totals.get(c) ?? 0) + clamp0(v));
  for (const h of input.holdings) add(h.category, Number(h.value) || 0);
  if (input.superBalance) add('SUPER', input.superBalance);
  if (input.savingsBalance) add('CASH', input.savingsBalance);

  let assets = 0;
  let liabilities = 0;
  for (const [c, v] of totals) {
    if (LIABILITY_CATEGORIES.includes(c)) liabilities += v;
    else assets += v;
  }

  const byCategory = [...totals.entries()]
    .filter(([, v]) => v > 0)
    .map(([category, value]) => ({ category, label: CATEGORY_LABELS[category], kind: (LIABILITY_CATEGORIES.includes(category) ? 'LIABILITY' : 'ASSET') as 'ASSET' | 'LIABILITY', value: round(value), pctOfAssets: assets > 0 && !LIABILITY_CATEGORIES.includes(category) ? round2((value / assets) * 100) : 0 }))
    .sort((a, b) => b.value - a.value);

  const target = allocationFor(input.profile ?? 'balanced');
  const emergency = clamp0(input.emergencyFundTarget ?? 0);
  const classValues: Record<AssetClass, number> = { cash: 0, bonds: 0, auShares: 0, intlShares: 0, property: 0 };
  for (const [c, v] of totals) {
    const cls = INVESTABLE[c];
    if (cls) classValues[cls] += v;
  }
  // The emergency fund is not an investment; it sits outside the mix.
  classValues.cash = clamp0(classValues.cash - emergency);
  const investable = (Object.values(classValues) as number[]).reduce((s, v) => s + v, 0);

  const allocation = (Object.keys(classValues) as AssetClass[]).map((k) => {
    const currentPct = investable > 0 ? (classValues[k] / investable) * 100 : 0;
    const targetPct = target[k];
    return { assetClass: k, label: ASSET_CLASS_LABELS[k], value: round(classValues[k]), currentPct: round2(currentPct), targetPct, drift: round2(currentPct - targetPct), move: round(((targetPct - currentPct) / 100) * investable) };
  });

  const suggestions: string[] = [];
  const over = allocation.filter((a) => a.drift > 5).sort((a, b) => b.drift - a.drift);
  const under = allocation.filter((a) => a.drift < -5).sort((a, b) => a.drift - b.drift);
  if (investable > 0 && over.length && under.length) {
    suggestions.push(`Move about $${Math.abs(under[0].move).toLocaleString('en-AU')} from ${over[0].label.toLowerCase()} toward ${under[0].label.toLowerCase()} to get back to the mix.`);
  } else if (investable > 0) {
    suggestions.push('The mix is within five points of the target on every class. Nothing to move.');
  } else {
    suggestions.push('Add what you hold, or link a savings goal, and the mix will show here.');
  }
  if (investable > 0 && under.length > 1) suggestions.push(`New money could go to ${under.map((u) => u.label.toLowerCase()).join(' and ')} first, which rebalances without selling.`);

  const crypto = totals.get('CRYPTO') ?? 0;
  const warnings: string[] = [];
  if (assets > 0 && crypto / assets > 0.1) warnings.push(`Crypto is ${round2((crypto / assets) * 100)}% of your assets. Most guidance keeps speculative holdings under 5 to 10%.`);
  const cc = totals.get('CREDIT_CARD') ?? 0;
  if (cc > 0) warnings.push('Card debt costs around 20% a year; paying it down beats any investment return.');
  if (emergency > 0 && (totals.get('CASH') ?? 0) < emergency) warnings.push('Cash is below your emergency fund target; fill that before investing more.');

  // Super and personal investments together: the diversification the blueprint
  // asks for is the growth share across the whole of what she has.
  const superAccounts = input.superAccounts ?? [];
  const superTotal = superAccounts.reduce((s, a) => s + clamp0(Number(a.balance) || 0), 0) || clamp0(input.superBalance ?? 0);
  const superGrowthDollars = superAccounts.length
    ? superAccounts.reduce((s, a) => s + clamp0(Number(a.balance) || 0) * (superOptionGrowthPct(a.investmentOpt) / 100), 0)
    : superTotal * 0.6;
  const investableGrowthDollars = classValues.auShares + classValues.intlShares + classValues.property + crypto;
  const whole = investable + crypto + superTotal;
  const wholeGrowthPct = whole > 0 ? ((investableGrowthDollars + superGrowthDollars) / whole) * 100 : 0;
  const targetGrowthPct = PROFILES[input.profile ?? 'balanced'].growthPct;
  const wholeOfWealth = {
    growthPct: round2(wholeGrowthPct),
    defensivePct: round2(whole > 0 ? 100 - wholeGrowthPct : 0),
    targetGrowthPct,
    superGrowthPct: superAccounts.length ? round2((superGrowthDollars / Math.max(1, superTotal)) * 100) : null,
    superBalance: round(superTotal),
    note: whole === 0 ? 'Add holdings or a super account to see the split.' : Math.abs(wholeGrowthPct - targetGrowthPct) <= 10 ? `Across super and everything else you are ${round(wholeGrowthPct)}% in growth assets, close to the ${targetGrowthPct}% your mix points to.` : wholeGrowthPct > targetGrowthPct ? `Across super and everything else you are ${round(wholeGrowthPct)}% in growth assets, above the ${targetGrowthPct}% your mix points to; the super option is the easiest lever.` : `Across super and everything else you are ${round(wholeGrowthPct)}% in growth assets, below the ${targetGrowthPct}% your mix points to; check the super option before moving anything else.`,
  };

  const incomeByCategory = (Object.keys(INCOME_YIELDS) as WealthCategory[])
    .map((category) => {
      const value = totals.get(category) ?? 0;
      const yieldPct = INCOME_YIELDS[category] ?? 0;
      return { category, label: CATEGORY_LABELS[category], value: round(value), yieldPct, income: round(value * (yieldPct / 100)) };
    })
    .filter((r) => r.value > 0);
  const annualIncome = incomeByCategory.reduce((s, r) => s + r.income, 0);
  const incomeEstimate = {
    annual: round(annualIncome),
    monthly: round(annualIncome / 12),
    byCategory: incomeByCategory,
    note: 'Typical yields, not your funds’ figures: cash and bonds at today’s rates, Australian shares before franking credits, international shares lower, property net of costs. Super is not counted because it cannot be drawn.',
  };

  return {
    asAt: RATES_AS_AT,
    totalAssets: round(assets),
    totalLiabilities: round(liabilities),
    netWorth: round(assets - liabilities),
    byCategory,
    investable: round(investable),
    allocation,
    crypto: round(crypto),
    suggestions,
    warnings,
    wholeOfWealth,
    incomeEstimate,
  };
}

// ----------------------------------------------------------- projection

export interface ProjectionInput {
  currentInvestments?: number;
  currentSuper?: number;
  monthlyContribution?: number;
  salary?: number;
  salaryGrowthPct?: number;
  returnPct?: number;
  superReturnPct?: number;
  years?: number;
  inflationPct?: number;
  extraMonthly?: number;
  careerBreak?: { startYear: number; years: number };
  profile?: RiskProfile;
}

export interface ProjectionPoint {
  year: number;
  investments: number;
  superBalance: number;
  total: number;
  contributed: number;
  realTotal: number;
}

export interface ProjectionScenario {
  key: 'base' | 'boosted' | 'careerBreak';
  label: string;
  series: ProjectionPoint[];
  endTotal: number;
  endRealTotal: number;
  totalContributed: number;
  growth: number;
  milestones: Array<{ amount: number; year: number | null }>;
}

export interface ProjectionResult {
  asAt: string;
  years: number;
  returnPct: number;
  superReturnPct: number;
  inflationPct: number;
  scenarios: ProjectionScenario[];
  notes: string[];
}

const MILESTONES = [100000, 250000, 500000, 1000000];

function run(input: ProjectionInput, opts: { extra: number; breakStart: number | null; breakYears: number }): ProjectionPoint[] {
  const years = Math.min(40, Math.max(1, Math.round(input.years ?? 10)));
  const r = clamp0(input.returnPct ?? 6.5) / 100 / 12;
  const rs = clamp0(input.superReturnPct ?? input.returnPct ?? 6.5) / 100 / 12;
  const inflation = clamp0(input.inflationPct ?? INFLATION_ASSUMPTION_PCT) / 100;
  let investments = clamp0(input.currentInvestments ?? 0);
  let superBalance = clamp0(input.currentSuper ?? 0);
  let salary = clamp0(input.salary ?? 0);
  const salaryGrowth = (input.salaryGrowthPct ?? 3) / 100;
  let contributed = 0;
  const series: ProjectionPoint[] = [];

  for (let y = 1; y <= years; y += 1) {
    const onBreak = opts.breakStart !== null && y >= opts.breakStart && y < opts.breakStart + opts.breakYears;
    const monthly = onBreak ? 0 : clamp0(input.monthlyContribution ?? 0) + opts.extra;
    const superMonthly = onBreak ? 0 : (salary * SUPER.guaranteeRate * (1 - SUPER.contributionsTax)) / 12;
    for (let m = 0; m < 12; m += 1) {
      investments = investments * (1 + r) + monthly;
      superBalance = superBalance * (1 + rs) + superMonthly;
      contributed += monthly + superMonthly;
    }
    if (!onBreak) salary *= 1 + salaryGrowth;
    const total = investments + superBalance;
    series.push({ year: y, investments: round(investments), superBalance: round(superBalance), total: round(total), contributed: round(contributed), realTotal: round(total / Math.pow(1 + inflation, y)) });
  }
  return series;
}

function scenario(key: ProjectionScenario['key'], label: string, input: ProjectionInput, series: ProjectionPoint[]): ProjectionScenario {
  const start = clamp0(input.currentInvestments ?? 0) + clamp0(input.currentSuper ?? 0);
  const end = series[series.length - 1];
  return {
    key,
    label,
    series,
    endTotal: end.total,
    endRealTotal: end.realTotal,
    totalContributed: end.contributed,
    growth: round(end.total - start - end.contributed),
    milestones: MILESTONES.map((amount) => ({ amount, year: series.find((p) => p.total >= amount)?.year ?? null })),
  };
}

export function projectWealth(input: ProjectionInput): ProjectionResult {
  const returnPct = input.returnPct ?? (input.profile ? RETURN_ASSUMPTIONS[input.profile].returnPct : 6.5);
  const resolved = { ...input, returnPct, superReturnPct: input.superReturnPct ?? returnPct };
  const years = Math.min(40, Math.max(1, Math.round(input.years ?? 10)));
  const extra = clamp0(input.extraMonthly ?? 200);
  const brk = input.careerBreak ?? { startYear: 3, years: 2 };

  const scenarios: ProjectionScenario[] = [
    scenario('base', 'Keep going as you are', resolved, run(resolved, { extra: 0, breakStart: null, breakYears: 0 })),
    scenario('boosted', `Add $${extra.toLocaleString('en-AU')} a month`, resolved, run(resolved, { extra, breakStart: null, breakYears: 0 })),
    scenario('careerBreak', `A ${brk.years}-year break from year ${brk.startYear}`, resolved, run(resolved, { extra: 0, breakStart: Math.max(1, Math.round(brk.startYear)), breakYears: Math.max(0, Math.round(brk.years)) })),
  ];

  const base = scenarios[0];
  const breakCost = base.endTotal - scenarios[2].endTotal;
  return {
    asAt: RATES_AS_AT,
    years,
    returnPct,
    superReturnPct: resolved.superReturnPct,
    inflationPct: input.inflationPct ?? INFLATION_ASSUMPTION_PCT,
    scenarios,
    notes: [
      `Returns compound monthly at ${returnPct}% a year, an assumption for a ${input.profile ? PROFILES[input.profile].label.toLowerCase() : 'balanced'} mix, not a forecast.`,
      `Employer super is ${Math.round(SUPER.guaranteeRate * 100)}% of salary less 15% contributions tax, with salary growing ${input.salaryGrowthPct ?? 3}% a year.`,
      breakCost > 0 ? `The career break costs about $${breakCost.toLocaleString('en-AU')} by year ${years}: the missed contributions and everything they would have earned. Catch-up super contributions afterwards close part of that gap.` : '',
      '"In today’s dollars" strips out inflation so the end figure means what it sounds like.',
    ].filter(Boolean),
  };
}

// ------------------------------------------------------- emergency fund

export interface EmergencyFundInput {
  monthlyExpenses: number;
  months?: number;
  currentSavings?: number;
  monthlySaving?: number;
  incomeStability?: 'stable' | 'variable' | 'single_income_with_dependants';
}

export interface EmergencyFundResult {
  asAt: string;
  monthsRecommended: number;
  target: number;
  current: number;
  gap: number;
  progressPct: number;
  monthsToTarget: number | null;
  targetDate: string | null;
  milestones: Array<{ pct: number; amount: number; reached: boolean }>;
  notes: string[];
}

export function planEmergencyFund(input: EmergencyFundInput): EmergencyFundResult {
  const expenses = clamp0(input.monthlyExpenses);
  const recommended = input.months ?? (input.incomeStability === 'stable' ? 3 : input.incomeStability === 'variable' ? 6 : input.incomeStability === 'single_income_with_dependants' ? 6 : 4);
  const months = Math.min(12, Math.max(1, recommended));
  const target = expenses * months;
  const current = clamp0(input.currentSavings ?? 0);
  const gap = clamp0(target - current);
  const saving = clamp0(input.monthlySaving ?? 0);
  const monthsToTarget = gap === 0 ? 0 : saving > 0 ? Math.ceil(gap / saving) : null;

  return {
    asAt: RATES_AS_AT,
    monthsRecommended: months,
    target: round(target),
    current: round(current),
    gap: round(gap),
    progressPct: target > 0 ? Math.min(100, round2((current / target) * 100)) : 0,
    monthsToTarget,
    targetDate: monthsToTarget === null ? null : new Date(Date.now() + monthsToTarget * 30.44 * 86400000).toISOString().slice(0, 10),
    milestones: [25, 50, 75, 100].map((pct) => ({ pct, amount: round(target * (pct / 100)), reached: current >= target * (pct / 100) })),
    notes: [
      'Three months of expenses if your income is steady, six if it is not or one income supports the household.',
      'Keep it in a high-interest savings account or an offset, somewhere you can reach in a day but will not spend.',
      'A round-up or a payday transfer builds this without a decision each month.',
    ],
  };
}

export function investmentReference() {
  return {
    asAt: RATES_AS_AT,
    questions: RISK_QUESTIONS,
    profiles: (Object.keys(PROFILES) as RiskProfile[]).map((k) => ({ id: k, label: PROFILES[k].label, growthPct: PROFILES[k].growthPct, summary: PROFILES[k].summary, ...RETURN_ASSUMPTIONS[k] })),
    assetCategories: ASSET_CATEGORIES.map((c) => ({ id: c, label: CATEGORY_LABELS[c] })),
    liabilityCategories: LIABILITY_CATEGORIES.map((c) => ({ id: c, label: CATEGORY_LABELS[c] })),
    inflationPct: INFLATION_ASSUMPTION_PCT,
  };
}
