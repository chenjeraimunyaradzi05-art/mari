/**
 * The business strategy: which structure to trade under, what the business
 * is worth, what a raise costs in ownership, how long the cash lasts, and
 * which grants are actually a fit.
 *
 * The structure comparison runs the same individual tax scale the tax
 * engine uses, so a sole trader's figure here matches her tax estimate. The
 * valuation is three ordinary methods shown side by side with the drivers
 * named, not a formal valuation. The grant matcher scores the grants the
 * platform already lists against a profile, which is the "top matches with
 * a compatibility score" the blueprint describes.
 */

import { COMPANY_TAX, RATES_AS_AT } from './au-rates';
import { individualTaxOn, marginalWithMedicare, round, round2 } from './tax-plan.service';

const clamp0 = (n: number) => Math.max(0, n);
const pct = (part: number, whole: number) => (whole > 0 ? round2((part / whole) * 100) : 0);

// -------------------------------------------------------------- structures

export type StructureType = 'SOLE_TRADER' | 'PARTNERSHIP' | 'COMPANY' | 'TRUST';

export interface StructureInput {
  profit: number;
  otherIncome?: number;
  hasCoFounders?: boolean;
  partners?: number;
  beneficiaries?: number;
  retainPct?: number;
  turnover?: number;
  priorities?: { assetProtection?: boolean; raisingCapital?: boolean; simplicity?: boolean; flexibleDistribution?: boolean };
}

export interface StructureOption {
  type: StructureType;
  label: string;
  taxOnProfit: number;
  effectiveRate: number;
  yourTax: number;
  setupCost: { low: number; high: number };
  annualCost: { low: number; high: number };
  complexity: 1 | 2 | 3;
  assetProtection: 1 | 2 | 3;
  raisingCapital: 1 | 2 | 3;
  distributionFlexibility: 1 | 2 | 3;
  canRetainProfits: boolean;
  available: boolean;
  unavailableReason?: string;
  pros: string[];
  cons: string[];
  taxNote: string;
  score: number;
}

export interface StructureResult {
  asAt: string;
  profit: number;
  yourMarginalRate: number;
  options: StructureOption[];
  recommended: StructureType;
  reasons: string[];
  notes: string[];
}

export function compareStructures(input: StructureInput): StructureResult {
  const profit = clamp0(input.profit);
  const other = clamp0(input.otherIncome ?? 0);
  const partners = Math.min(20, Math.max(2, Math.round(input.partners ?? 2)));
  const beneficiaries = Math.min(10, Math.max(1, Math.round(input.beneficiaries ?? 1)));
  const hasCoFounders = Boolean(input.hasCoFounders);
  const retainPct = Math.min(100, Math.max(0, input.retainPct ?? 50)) / 100;
  const companyRate = clamp0(input.turnover ?? 0) < COMPANY_TAX.baseRateTurnoverLimit ? COMPANY_TAX.baseRate : COMPANY_TAX.fullRate;
  const p = input.priorities ?? {};

  const taxOnOther = individualTaxOn(other);

  // Sole trader: every dollar lands on your own return.
  const soleYourTax = individualTaxOn(other + profit) - taxOnOther;

  // Partnership: an equal split; the other partners are assumed to have no
  // other income, which is the kindest case for them.
  const share = profit / partners;
  const partnershipYourTax = individualTaxOn(other + share) - taxOnOther;
  const partnershipTotal = partnershipYourTax + (partners - 1) * individualTaxOn(share);

  // Company: tax at the company rate, then a franked dividend on what is
  // paid out. Your top-up is your tax on the grossed-up dividend less the
  // credit, which can go negative and come back as a refund.
  const companyTax = profit * companyRate;
  const afterTax = profit - companyTax;
  const distributed = afterTax * (1 - retainPct);
  const credits = distributed * (companyRate / (1 - companyRate));
  const topUp = individualTaxOn(other + distributed + credits) - taxOnOther - credits;
  const companyYourTax = topUp;
  const companyTotal = companyTax + topUp;

  // Discretionary trust: profit is streamed to beneficiaries and taxed in
  // their hands; nothing can be kept back without paying the top rate.
  const trustShare = profit / beneficiaries;
  const trustYourTax = individualTaxOn(other + trustShare) - taxOnOther;
  const trustTotal = trustYourTax + (beneficiaries - 1) * individualTaxOn(trustShare);

  const options: StructureOption[] = [
    {
      type: 'SOLE_TRADER', label: 'Sole trader',
      taxOnProfit: round(soleYourTax), effectiveRate: pct(soleYourTax, profit), yourTax: round(soleYourTax),
      setupCost: { low: 0, high: 100 }, annualCost: { low: 0, high: 600 },
      complexity: 1, assetProtection: 1, raisingCapital: 1, distributionFlexibility: 1, canRetainProfits: false, available: true,
      pros: ['Free to set up with an ABN', 'One tax return, your own', 'Losses can offset other income'],
      cons: ['You are personally liable for every debt', 'All profit taxed at your marginal rate', 'Hard to bring in a co-owner or investor'],
      taxNote: 'Profit is added to your other income and taxed on your own return.',
      score: 0,
    },
    {
      type: 'PARTNERSHIP', label: 'Partnership',
      taxOnProfit: round(partnershipTotal), effectiveRate: pct(partnershipTotal, profit), yourTax: round(partnershipYourTax),
      setupCost: { low: 100, high: 500 }, annualCost: { low: 300, high: 1500 },
      complexity: 2, assetProtection: 1, raisingCapital: 1, distributionFlexibility: 1, canRetainProfits: false, available: hasCoFounders, unavailableReason: hasCoFounders ? undefined : 'Needs at least one co-founder to share the profit with.',
      pros: ['Cheap to start with co-founders', 'Profit is split across returns, so more of it sits in low brackets', 'Simple to wind up'],
      cons: ['Each partner is liable for the others’ business debts', 'A written agreement is essential and often skipped', 'Split is fixed by the agreement, not by who needs it'],
      taxNote: `Profit is split ${partners} ways and each partner is taxed on her share.`,
      score: 0,
    },
    {
      type: 'COMPANY', label: 'Company (Pty Ltd)',
      taxOnProfit: round(companyTotal), effectiveRate: pct(companyTotal, profit), yourTax: round(companyYourTax),
      setupCost: { low: 600, high: 1500 }, annualCost: { low: 1500, high: 4000 },
      complexity: 2, assetProtection: 3, raisingCapital: 3, distributionFlexibility: 2, canRetainProfits: true, available: true,
      pros: [`Flat ${Math.round(companyRate * 100)}% on profit kept in the business`, 'Separate legal entity: your home is not on the line', 'Shares are what investors and grants for companies expect'],
      cons: ['ASIC fees and a director’s duties every year', 'Money taken out is taxed again in your hands (with a credit)', 'Losses stay inside the company'],
      taxNote: `${Math.round(companyRate * 100)}% company tax, then a franked dividend on the ${Math.round((1 - retainPct) * 100)}% paid out.`,
      score: 0,
    },
    {
      type: 'TRUST', label: 'Discretionary trust',
      taxOnProfit: round(trustTotal), effectiveRate: pct(trustTotal, profit), yourTax: round(trustYourTax),
      setupCost: { low: 1500, high: 3000 }, annualCost: { low: 2000, high: 5000 },
      complexity: 3, assetProtection: 3, raisingCapital: 1, distributionFlexibility: 3, canRetainProfits: false, available: true,
      pros: ['Profit can go to whichever beneficiary pays the least tax', 'Assets held by the trustee, away from personal claims', 'The 50% capital gains discount is kept'],
      cons: ['Accountant required, every year', 'Undistributed profit is taxed at the top rate', 'Investors cannot buy in'],
      taxNote: `Profit streamed to ${beneficiaries} ${beneficiaries === 1 ? 'beneficiary' : 'beneficiaries'} and taxed at their rates.`,
      score: 0,
    },
  ];

  // Score: tax paid matters most, then whatever the founder said she cares about.
  const candidates = options.filter((o) => o.available);
  const lowestTax = Math.min(...candidates.map((o) => o.taxOnProfit));
  const highestTax = Math.max(...candidates.map((o) => o.taxOnProfit));
  for (const o of options) {
    const taxScore = highestTax === lowestTax ? 40 : 40 * (1 - (o.taxOnProfit - lowestTax) / (highestTax - lowestTax));
    const costScore = 10 * (1 - Math.min(1, (o.annualCost.high + o.setupCost.high) / 8000));
    let priorityScore = 0;
    if (p.assetProtection) priorityScore += o.assetProtection * 8;
    if (p.raisingCapital) priorityScore += o.raisingCapital * 8;
    if (p.simplicity) priorityScore += (4 - o.complexity) * 8;
    if (p.flexibleDistribution) priorityScore += o.distributionFlexibility * 6;
    o.score = round(taxScore + costScore + priorityScore);
  }
  const recommended = [...candidates].sort((a, b) => b.score - a.score)[0];

  const reasons: string[] = [];
  if (recommended.taxOnProfit === lowestTax) reasons.push('It pays the least tax on this profit.');
  else reasons.push(`It pays $${round(recommended.taxOnProfit - lowestTax).toLocaleString('en-AU')} more tax than the cheapest option, but scores higher on what you said matters.`);
  if (p.assetProtection && recommended.assetProtection === 3) reasons.push('It keeps your personal assets out of reach of business creditors.');
  if (p.raisingCapital && recommended.raisingCapital === 3) reasons.push('It is the structure investors can buy into.');
  if (p.simplicity && recommended.complexity === 1) reasons.push('It is the simplest to run.');
  if (recommended.type === 'SOLE_TRADER' && profit > 135000) reasons.push('Once profit passes $135,000 a company starts to pay for its own running costs; revisit this next year.');

  return {
    asAt: RATES_AS_AT,
    profit: round(profit),
    yourMarginalRate: marginalWithMedicare(other + profit),
    options,
    recommended: recommended.type,
    reasons,
    notes: [
      'Tax figures use the resident scale, Medicare levy and low income offset, and assume any partners or other beneficiaries have no other income. A trust only beats a sole trader when there is a lower-income adult to stream profit to.',
      'A company’s advantage is deferral: profit kept inside is taxed at the company rate until you take it out.',
      'This compares tax and running costs. Licensing, insurance and what a lender will accept can tip it; a registered tax agent should confirm before you register.',
    ],
  };
}

// ---------------------------------------------------------------- value

export type Industry = 'saas' | 'services' | 'professional' | 'retail' | 'ecommerce' | 'hospitality' | 'health' | 'education' | 'manufacturing' | 'creative' | 'other';

const INDUSTRY_MULTIPLES: Record<Industry, { revenue: [number, number]; earnings: [number, number]; label: string }> = {
  saas: { revenue: [3, 6], earnings: [5, 8], label: 'Software and subscriptions' },
  services: { revenue: [0.5, 1.2], earnings: [2, 3.5], label: 'Trades and personal services' },
  professional: { revenue: [0.8, 1.5], earnings: [2.5, 4], label: 'Professional services' },
  retail: { revenue: [0.3, 0.8], earnings: [2, 3], label: 'Retail' },
  ecommerce: { revenue: [0.8, 2], earnings: [3, 4.5], label: 'Online retail' },
  hospitality: { revenue: [0.3, 0.7], earnings: [1.5, 3], label: 'Cafes, food and hospitality' },
  health: { revenue: [1, 2], earnings: [3, 5], label: 'Health and allied health' },
  education: { revenue: [1, 2], earnings: [3, 5], label: 'Education and training' },
  manufacturing: { revenue: [0.5, 1.2], earnings: [3, 5], label: 'Manufacturing' },
  creative: { revenue: [0.6, 1.3], earnings: [2, 3.5], label: 'Creative and media' },
  other: { revenue: [0.5, 1.5], earnings: [2, 4], label: 'Other' },
};

export function industries() {
  return Object.entries(INDUSTRY_MULTIPLES).map(([id, v]) => ({ id, label: v.label }));
}

export interface ValuationInput {
  annualRevenue: number;
  annualProfit: number;
  growthPct?: number;
  industry?: Industry;
  recurringRevenuePct?: number;
  ownerDependence?: 'low' | 'medium' | 'high';
  yearsOperating?: number;
  netAssets?: number;
}

export interface ValuationResult {
  asAt: string;
  industry: string;
  methods: {
    revenueMultiple: { low: number; high: number; multipleLow: number; multipleHigh: number };
    earningsMultiple: { low: number; high: number; multipleLow: number; multipleHigh: number };
    discountedCashFlow: { value: number; discountRatePct: number; years: number };
    netAssets: number;
  };
  range: { low: number; mid: number; high: number };
  adjustmentPct: number;
  drivers: Array<{ label: string; effect: number; detail: string }>;
  notes: string[];
}

export function valueBusiness(input: ValuationInput): ValuationResult {
  const revenue = clamp0(input.annualRevenue);
  const profit = input.annualProfit;
  const growth = input.growthPct ?? 0;
  const industry = INDUSTRY_MULTIPLES[input.industry ?? 'other'] ?? INDUSTRY_MULTIPLES.other;
  const drivers: ValuationResult['drivers'] = [];
  let adjust = 1;

  const push = (label: string, effect: number, detail: string) => {
    drivers.push({ label, effect, detail });
    adjust *= 1 + effect;
  };
  if (growth >= 30) push('Fast growth', 0.25, `Growing ${growth}% a year earns a premium.`);
  else if (growth >= 15) push('Steady growth', 0.1, `Growing ${growth}% a year supports the top of the range.`);
  else if (growth < 0) push('Shrinking', -0.25, 'A falling top line is discounted heavily.');
  const recurring = clamp0(input.recurringRevenuePct ?? 0);
  if (recurring >= 70) push('Recurring revenue', 0.2, `${recurring}% of revenue repeats without a new sale.`);
  else if (recurring >= 40) push('Some recurring revenue', 0.1, `${recurring}% of revenue is on subscription or retainer.`);
  if (input.ownerDependence === 'high') push('Depends on you', -0.2, 'A buyer pays less for a business that stops when the founder does.');
  else if (input.ownerDependence === 'low') push('Runs without you', 0.1, 'Systems and a team make the earnings transferable.');
  if ((input.yearsOperating ?? 3) < 2) push('Young business', -0.15, 'Under two years of history leaves the numbers unproven.');
  if (profit <= 0) push('Not yet profitable', -0.1, 'Earnings methods cannot be used, so the revenue multiple carries the weight.');

  const revLow = revenue * industry.revenue[0] * adjust;
  const revHigh = revenue * industry.revenue[1] * adjust;
  const earnLow = clamp0(profit) * industry.earnings[0] * adjust;
  const earnHigh = clamp0(profit) * industry.earnings[1] * adjust;

  // A five-year cash flow at a small-business discount rate, growth easing
  // toward 5%, and a modest terminal value.
  const discount = input.ownerDependence === 'high' ? 0.3 : 0.25;
  const years = 5;
  let g = Math.min(Math.max(growth, -20), 40) / 100;
  let cash = clamp0(profit);
  let dcf = 0;
  for (let y = 1; y <= years; y += 1) {
    cash *= 1 + g;
    dcf += cash / Math.pow(1 + discount, y);
    g = g * 0.6 + 0.05 * 0.4;
  }
  const terminal = (cash * 1.03) / (discount - 0.03);
  dcf += terminal / Math.pow(1 + discount, years);

  const netAssets = clamp0(input.netAssets ?? 0);
  const lows = [revLow, ...(profit > 0 ? [earnLow, dcf * 0.85] : [])];
  const highs = [revHigh, ...(profit > 0 ? [earnHigh, dcf * 1.15] : [])];
  const low = Math.max(netAssets, lows.reduce((s, v) => s + v, 0) / lows.length);
  const high = Math.max(low, highs.reduce((s, v) => s + v, 0) / highs.length);

  return {
    asAt: RATES_AS_AT,
    industry: industry.label,
    methods: {
      revenueMultiple: { low: round(revLow), high: round(revHigh), multipleLow: round2(industry.revenue[0] * adjust), multipleHigh: round2(industry.revenue[1] * adjust) },
      earningsMultiple: { low: round(earnLow), high: round(earnHigh), multipleLow: round2(industry.earnings[0] * adjust), multipleHigh: round2(industry.earnings[1] * adjust) },
      discountedCashFlow: { value: round(dcf), discountRatePct: discount * 100, years },
      netAssets: round(netAssets),
    },
    range: { low: round(low), mid: round((low + high) / 2), high: round(high) },
    adjustmentPct: round((adjust - 1) * 100),
    drivers,
    notes: [
      'Multiples are typical ranges for small Australian businesses by industry; a buyer or investor will argue from their own.',
      'Profit here means owner’s earnings: what is left after costs but before your own wage and tax.',
      'A valuation for a sale, a shareholder dispute or the ATO needs a registered valuer.',
    ],
  };
}

// ---------------------------------------------------------------- raise

export interface RaiseInput {
  preMoney: number;
  raiseAmount: number;
  optionPoolPct?: number;
  founderOwnershipPct?: number;
  existingShares?: number;
}

export interface RaiseResult {
  preMoney: number;
  raiseAmount: number;
  postMoney: number;
  investorPct: number;
  optionPoolPct: number;
  founderPctBefore: number;
  founderPctAfter: number;
  founderValueAfter: number;
  pricePerShare: number | null;
  newShares: number | null;
  ifValuationLower: { preMoney: number; founderPctAfter: number };
  notes: string[];
}

export function modelRaise(input: RaiseInput): RaiseResult {
  const pre = clamp0(input.preMoney);
  const raise = clamp0(input.raiseAmount);
  const pool = Math.min(30, clamp0(input.optionPoolPct ?? 0)) / 100;
  const founderBefore = Math.min(100, clamp0(input.founderOwnershipPct ?? 100)) / 100;
  const post = pre + raise;
  const investorPct = post > 0 ? raise / post : 0;
  // The option pool is carved out before the round, so the founders wear it.
  const founderAfter = founderBefore * (1 - investorPct) * (1 - pool);
  const lowerPre = pre * 0.8;
  const lowerPost = lowerPre + raise;
  const lowerFounder = founderBefore * (1 - (lowerPost > 0 ? raise / lowerPost : 0)) * (1 - pool);
  const shares = input.existingShares && input.existingShares > 0 ? input.existingShares : null;
  const price = shares ? (pre * (1 - pool)) / shares : null;

  return {
    preMoney: round(pre),
    raiseAmount: round(raise),
    postMoney: round(post),
    investorPct: round2(investorPct * 100),
    optionPoolPct: round2(pool * 100),
    founderPctBefore: round2(founderBefore * 100),
    founderPctAfter: round2(founderAfter * 100),
    founderValueAfter: round(founderAfter * post),
    pricePerShare: price !== null ? round2(price) : null,
    newShares: price !== null && price > 0 ? round(raise / price) : null,
    ifValuationLower: { preMoney: round(lowerPre), founderPctAfter: round2(lowerFounder * 100) },
    notes: [
      'An option pool created before the round dilutes the founders, not the investor; negotiate its size with the valuation.',
      'A SAFE or convertible note converts at the next priced round, usually at a discount or cap, so the dilution shows up then.',
      'The ATO early stage investor incentive can make a company more attractive to angels; check the eligibility tests.',
    ],
  };
}

// --------------------------------------------------------------- runway

export interface RunwayInput {
  cashOnHand: number;
  monthlyRevenue: number;
  monthlyExpenses: number;
  revenueGrowthPct?: number;
  expenseGrowthPct?: number;
}

export interface RunwayResult {
  cashOnHand: number;
  monthlyBurn: number;
  runwayMonths: number | null;
  runwayEnds: string | null;
  breakEvenMonth: number | null;
  lowestCash: number;
  series: Array<{ month: number; revenue: number; expenses: number; cash: number }>;
  notes: string[];
}

export function projectRunway(input: RunwayInput): RunwayResult {
  let cash = clamp0(input.cashOnHand);
  let revenue = clamp0(input.monthlyRevenue);
  let expenses = clamp0(input.monthlyExpenses);
  const rg = (input.revenueGrowthPct ?? 0) / 100;
  const eg = (input.expenseGrowthPct ?? 0) / 100;
  const series: RunwayResult['series'] = [];
  let runway: number | null = null;
  let breakEven: number | null = null;
  let lowest = cash;

  for (let m = 1; m <= 36; m += 1) {
    cash += revenue - expenses;
    series.push({ month: m, revenue: round(revenue), expenses: round(expenses), cash: round(cash) });
    if (breakEven === null && revenue >= expenses) breakEven = m;
    if (runway === null && cash < 0) runway = m - 1;
    lowest = Math.min(lowest, cash);
    revenue *= 1 + rg;
    expenses *= 1 + eg;
  }

  const burn = clamp0(input.monthlyExpenses) - clamp0(input.monthlyRevenue);
  return {
    cashOnHand: round(input.cashOnHand),
    monthlyBurn: round(burn),
    runwayMonths: runway,
    runwayEnds: runway === null ? null : new Date(Date.now() + runway * 30.44 * 86400000).toISOString().slice(0, 10),
    breakEvenMonth: breakEven,
    lowestCash: round(lowest),
    series,
    notes: [
      burn <= 0 ? 'Revenue already covers expenses; the runway question is how much you can afford to invest in growth.' : 'A raise takes three to six months to close. Start when you have nine months of runway, not three.',
      'Grants and the R&D tax incentive are counted as cash only when they land, not when they are announced.',
    ],
  };
}

// ---------------------------------------------------------------- grants

export interface GrantProfile {
  stage?: string;
  industry?: string;
  state?: string;
  amountNeeded?: number;
  womenLed?: boolean;
  indigenous?: boolean;
  regional?: boolean;
}

export interface GrantLike {
  id: string;
  name: string;
  minFunding?: unknown;
  maxFunding?: unknown;
  industries?: string[] | null;
  stages?: string[] | null;
  regions?: string[] | null;
  tags?: string[] | null;
  deadline?: Date | string | null;
  isRolling?: boolean | null;
}

export interface GrantMatch {
  grantId: string;
  score: number;
  reasons: string[];
  gaps: string[];
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const hasAny = (list: string[] | null | undefined, ...needles: string[]) => (list ?? []).some((v) => needles.some((n) => norm(v).includes(norm(n))));
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** How well one grant fits, out of 100, with the reasons and the gaps. */
export function scoreGrant(grant: GrantLike, profile: GrantProfile, now = new Date()): GrantMatch {
  let score = 0;
  const reasons: string[] = [];
  const gaps: string[] = [];

  const stages = grant.stages ?? [];
  if (profile.stage) {
    if (stages.length === 0 || hasAny(stages, 'any', 'all')) { score += 20; reasons.push('Open to any stage'); }
    else if (hasAny(stages, profile.stage)) { score += 30; reasons.push(`For ${profile.stage.replace(/_/g, ' ').toLowerCase()} businesses`); }
    else gaps.push(`Meant for ${stages.join(', ').toLowerCase()} businesses`);
  } else score += 15;

  const inds = grant.industries ?? [];
  if (profile.industry) {
    if (inds.length === 0 || hasAny(inds, 'any', 'all')) { score += 15; reasons.push('Any industry'); }
    else if (hasAny(inds, profile.industry)) { score += 25; reasons.push(`Targets ${profile.industry.toLowerCase()}`); }
    else gaps.push(`Industry focus is ${inds.join(', ').toLowerCase()}`);
  } else score += 12;

  const regions = grant.regions ?? [];
  if (profile.state) {
    if (regions.length === 0 || hasAny(regions, 'national', 'australia', 'all', 'any')) { score += 20; reasons.push('Available nationally'); }
    else if (hasAny(regions, profile.state)) { score += 20; reasons.push(`Runs in ${profile.state}`); }
    else gaps.push(`Only in ${regions.join(', ')}`);
  } else score += 12;

  const min = num(grant.minFunding);
  const max = num(grant.maxFunding);
  if (profile.amountNeeded && profile.amountNeeded > 0) {
    if (max > 0 && profile.amountNeeded > max) { score += 5; gaps.push(`Funds up to $${max.toLocaleString('en-AU')}, less than you need`); }
    else if (min > 0 && profile.amountNeeded < min) { score += 8; gaps.push(`Minimum award is $${min.toLocaleString('en-AU')}`); }
    else { score += 15; reasons.push('Award size fits what you need'); }
  } else score += 10;

  const deadline = grant.deadline ? new Date(grant.deadline) : null;
  if (grant.isRolling || !deadline) { score += 10; reasons.push('Rolling applications'); }
  else {
    const days = (deadline.getTime() - now.getTime()) / 86400000;
    if (days < 0) gaps.push('Applications have closed');
    else if (days <= 14) { score += 5; reasons.push(`Closes in ${Math.ceil(days)} days`); }
    else { score += 10; reasons.push(`Open until ${deadline.toISOString().slice(0, 10)}`); }
  }

  const tags = grant.tags ?? [];
  if (profile.womenLed && hasAny(tags, 'women', 'female', 'founders', 'gender')) { score += 10; reasons.push('Made for women-led businesses'); }
  if (profile.indigenous && hasAny(tags, 'indigenous', 'first nations', 'aboriginal')) { score += 10; reasons.push('For First Nations businesses'); }
  if (profile.regional && hasAny(tags, 'regional', 'rural', 'remote')) { score += 5; reasons.push('Regional focus'); }

  return { grantId: grant.id, score: Math.min(100, score), reasons, gaps };
}

export function rankGrants<T extends GrantLike>(grants: T[], profile: GrantProfile, now = new Date()): Array<T & { match: GrantMatch }> {
  return grants
    .map((g) => ({ ...g, match: scoreGrant(g, profile, now) }))
    .sort((a, b) => b.match.score - a.match.score);
}
