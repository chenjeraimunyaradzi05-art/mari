/**
 * The strategy routes: housing, business, tax and investment.
 *
 * The calculators are open, so the public housing and finance pages can run
 * them before anyone signs up; nothing they compute is stored. Saving a
 * plan, keeping holdings and matching grants need a member, because those
 * read and write her own records.
 */

import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { AU_STATES, RATES_AS_AT } from '../services/strategy/au-rates';
import {
  assessRentAffordability,
  calculateMortgage,
  calculateStampDuty,
  compareRentVsBuy,
  estimateBorrowingPower,
  housingReference,
  planDeposit,
} from '../services/strategy/housing-plan.service';
import {
  compareStructures,
  industries,
  modelRaise,
  projectRunway,
  rankGrants,
  valueBusiness,
} from '../services/strategy/business-plan.service';
import {
  estimateIndividualTax,
  planDeductions,
  planQuarterlySetAside,
  planSuperContributions,
} from '../services/strategy/tax-plan.service';
import {
  ASSET_CATEGORIES,
  LIABILITY_CATEGORIES,
  assessNetWorth,
  assessRiskProfile,
  investmentReference,
  planEmergencyFund,
  projectWealth,
  type RiskProfile,
  type WealthCategory,
} from '../services/strategy/investment-plan.service';
import { assessInvestmentProperty, compareLoans } from '../services/strategy/property-finance.service';
import { estimateRentAssistance, rentAssistanceReference, type Household } from '../services/strategy/rent-assistance.service';
import { checkPitch, rankInvestors } from '../services/strategy/investor-match.service';
import { planHelpDebt } from '../services/strategy/help-debt.service';
import { scanForDeductions } from '../services/strategy/deduction-finder.service';
import { planDebtPayoff } from '../services/strategy/debt-payoff.service';
import { assessInsuranceNeeds, planGoal, projectSuper, reviewHoldings, roundUpPotential } from '../services/strategy/wealth-tools.service';
import { buildRoadmap, peerSnapshot } from '../services/strategy/roadmap.service';
import { launchChecklist, pickVendors, type Structure } from '../services/strategy/launch-package.service';
import { buildDeckOutline } from '../services/strategy/deck-outline.service';
import { buildEarningsStatement } from '../services/strategy/earnings-statement.service';
import { listTransactions } from '../services/open-banking.service';
import { logger } from '../utils/logger';

const router = Router();

const money = z.coerce.number().min(0).max(1_000_000_000);
const optMoney = money.optional();
const pctNum = z.coerce.number().min(-100).max(1000);
const optPct = pctNum.optional();
const optBool = z.coerce.boolean().optional();
const state = z.enum(AU_STATES as [string, ...string[]]);
const riskProfiles = ['conservative', 'cautious', 'balanced', 'growth', 'high_growth'] as const;

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ApiError(400, issue ? `${issue.path.join('.') || 'input'}: ${issue.message}` : 'Invalid input');
  }
  return parsed.data;
}

const ok = (res: Response, data: unknown, status = 200) => res.status(status).json({ success: true, data });

// -------------------------------------------------------------- reference

router.get('/reference', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    ok(res, { asAt: RATES_AS_AT, housing: housingReference(), investing: investmentReference(), industries: industries() });
  } catch (error) {
    next(error);
  }
});

// ------------------------------------------------------------ saved plans

const AREAS = ['HOUSING', 'BUSINESS', 'TAX', 'INVESTMENT'] as const;
const areaSchema = z.enum(AREAS);

router.get('/plans', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const plans = await prisma.strategyPlan.findMany({ where: { userId: req.user!.id }, orderBy: { updatedAt: 'desc' } });
    ok(res, plans);
  } catch (error) {
    next(error);
  }
});

const savePlanSchema = z.object({
  title: z.string().max(120).optional(),
  inputs: z.record(z.unknown()),
  result: z.record(z.unknown()),
});

router.put('/plans/:area', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const area = parse(areaSchema, req.params.area.toUpperCase());
    const data = parse(savePlanSchema, req.body);
    const userId = req.user!.id;
    const result: Record<string, unknown> = { ...data.result };

    // A business plan keeps the valuation each time it is saved, so the
    // founder can see what the business has been worth over the months.
    if (area === 'BUSINESS') {
      const existing = await prisma.strategyPlan.findUnique({ where: { userId_area: { userId, area } } });
      const previous = ((existing?.result as { valuationHistory?: unknown } | null)?.valuationHistory ?? []) as Array<{ date: string; valuationMid: number; revenue?: number; profit?: number }>;
      const mid = Number(result.valuationMid);
      const inputs = data.inputs as Record<string, unknown>;
      const history = Array.isArray(previous) ? previous.filter((h) => h && typeof h.date === 'string') : [];
      if (Number.isFinite(mid) && mid > 0) {
        const today = new Date().toISOString().slice(0, 10);
        const entry = { date: today, valuationMid: mid, revenue: Number(inputs.revenue) || undefined, profit: Number(inputs.annualProfit) || undefined };
        const kept = history.filter((h) => h.date !== today);
        kept.push(entry);
        result.valuationHistory = kept.slice(-36);
      } else {
        result.valuationHistory = history;
      }
    }

    const plan = await prisma.strategyPlan.upsert({
      where: { userId_area: { userId, area } },
      create: { userId, area, title: data.title, inputs: data.inputs as object, result: result as object },
      update: { title: data.title, inputs: data.inputs as object, result: result as object },
    });
    ok(res, plan);
  } catch (error) {
    next(error);
  }
});

router.delete('/plans/:area', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const area = parse(areaSchema, req.params.area.toUpperCase());
    await prisma.strategyPlan.deleteMany({ where: { userId: req.user!.id, area } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------- housing

router.post('/housing/rent', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const input = parse(z.object({ annualIncome: money, partnerAnnualIncome: optMoney, weeklyRent: optMoney, otherWeeklyCommitments: optMoney }), req.body);
    ok(res, assessRentAffordability(input));
  } catch (error) {
    next(error);
  }
});

router.post('/housing/stamp-duty', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const input = parse(z.object({ state, price: money, firstHome: optBool, newHome: optBool, regional: optBool }), req.body);
    ok(res, calculateStampDuty({ ...input, state: input.state as (typeof AU_STATES)[number] }));
  } catch (error) {
    next(error);
  }
});

router.post('/housing/mortgage', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const input = parse(z.object({ principal: money, annualRatePct: z.coerce.number().min(0).max(30), years: z.coerce.number().min(1).max(40), frequency: z.enum(['monthly', 'fortnightly', 'weekly']).optional(), extraRepayment: optMoney }), req.body);
    ok(res, calculateMortgage(input));
  } catch (error) {
    next(error);
  }
});

router.post('/housing/borrowing-power', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const input = parse(z.object({ annualIncome: money, partnerAnnualIncome: optMoney, monthlyLivingExpenses: optMoney, monthlyOtherRepayments: optMoney, creditCardLimits: optMoney, dependants: z.coerce.number().min(0).max(12).optional(), annualRatePct: z.coerce.number().min(0).max(30).optional(), years: z.coerce.number().min(5).max(30).optional() }), req.body);
    ok(res, estimateBorrowingPower(input));
  } catch (error) {
    next(error);
  }
});

router.post('/housing/deposit', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const input = parse(z.object({ state, price: money, regional: optBool, firstHome: optBool, newHome: optBool, currentSavings: optMoney, monthlySaving: optMoney, savingsRatePct: z.coerce.number().min(0).max(20).optional(), targetDepositPct: z.coerce.number().min(1).max(100).optional(), useHomeGuarantee: optBool }), req.body);
    ok(res, planDeposit({ ...input, state: input.state as (typeof AU_STATES)[number] }));
  } catch (error) {
    next(error);
  }
});

router.post('/housing/rent-vs-buy', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const input = parse(z.object({ state, price: money, weeklyRent: money, depositPct: z.coerce.number().min(5).max(100).optional(), annualRatePct: z.coerce.number().min(0).max(30).optional(), years: z.coerce.number().min(1).max(30).optional(), propertyGrowthPct: optPct, rentGrowthPct: optPct, investmentReturnPct: optPct, firstHome: optBool, regional: optBool }), req.body);
    ok(res, compareRentVsBuy({ ...input, state: input.state as (typeof AU_STATES)[number] }));
  } catch (error) {
    next(error);
  }
});

// --------------------------------------------------------------- business

router.post('/business/structures', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const input = parse(z.object({
      profit: money, otherIncome: optMoney, hasCoFounders: optBool, partners: z.coerce.number().min(2).max(20).optional(), beneficiaries: z.coerce.number().min(1).max(10).optional(), retainPct: z.coerce.number().min(0).max(100).optional(), turnover: optMoney,
      priorities: z.object({ assetProtection: optBool, raisingCapital: optBool, simplicity: optBool, flexibleDistribution: optBool }).optional(),
    }), req.body);
    ok(res, compareStructures(input));
  } catch (error) {
    next(error);
  }
});

router.post('/business/valuation', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const input = parse(z.object({
      annualRevenue: money, annualProfit: z.coerce.number().min(-1_000_000_000).max(1_000_000_000), growthPct: optPct,
      industry: z.enum(['saas', 'services', 'professional', 'retail', 'ecommerce', 'hospitality', 'health', 'education', 'manufacturing', 'creative', 'other']).optional(),
      recurringRevenuePct: z.coerce.number().min(0).max(100).optional(), ownerDependence: z.enum(['low', 'medium', 'high']).optional(), yearsOperating: z.coerce.number().min(0).max(100).optional(), netAssets: optMoney,
    }), req.body);
    ok(res, valueBusiness(input));
  } catch (error) {
    next(error);
  }
});

router.post('/business/raise', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const input = parse(z.object({ preMoney: money, raiseAmount: money, optionPoolPct: z.coerce.number().min(0).max(30).optional(), founderOwnershipPct: z.coerce.number().min(0).max(100).optional(), existingShares: z.coerce.number().min(0).optional() }), req.body);
    ok(res, modelRaise(input));
  } catch (error) {
    next(error);
  }
});

router.post('/business/runway', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const input = parse(z.object({ cashOnHand: money, monthlyRevenue: money, monthlyExpenses: money, revenueGrowthPct: z.coerce.number().min(-50).max(100).optional(), expenseGrowthPct: z.coerce.number().min(-50).max(100).optional() }), req.body);
    ok(res, projectRunway(input));
  } catch (error) {
    next(error);
  }
});

router.get('/business/grant-matches', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const q = parse(z.object({
      stage: z.string().max(60).optional(), industry: z.string().max(60).optional(), state: z.string().max(10).optional(), amountNeeded: optMoney,
      womenLed: optBool, indigenous: optBool, regional: optBool, includeClosed: optBool,
    }), req.query);
    const grants = await prisma.grant.findMany({ where: { isActive: true } });
    const ranked = rankGrants(grants, { ...q, womenLed: q.womenLed ?? true });
    const open = q.includeClosed ? ranked : ranked.filter((g) => !g.match.gaps.includes('Applications have closed'));
    ok(res, { profile: q, matches: open });
  } catch (error) {
    next(error);
  }
});

// -------------------------------------------------------------------- tax

router.post('/tax/estimate', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const input = parse(z.object({ grossIncome: money, deductions: optMoney, salarySacrifice: optMoney, hasHelpDebt: optBool, helpBalance: optMoney }), req.body);
    ok(res, estimateIndividualTax(input));
  } catch (error) {
    next(error);
  }
});

router.post('/tax/deductions', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const input = parse(z.object({
      taxableIncome: money, homeOfficeHoursPerWeek: z.coerce.number().min(0).max(80).optional(), weeksWorkedFromHome: z.coerce.number().min(0).max(52).optional(), carWorkKm: z.coerce.number().min(0).max(100000).optional(),
      selfEducation: optMoney, toolsAndEquipment: optMoney, professionalFees: optMoney, donations: optMoney, incomeProtectionPremiums: optMoney, phoneAndInternet: optMoney, phoneWorkUsePct: z.coerce.number().min(0).max(100).optional(), workClothing: optMoney, personalSuperContributions: optMoney, other: optMoney,
    }), req.body);
    ok(res, planDeductions(input));
  } catch (error) {
    next(error);
  }
});

router.post('/tax/super', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const input = parse(z.object({ income: money, superBalance: optMoney, employerContributions: optMoney, salarySacrifice: optMoney, personalDeductible: optMoney, personalAfterTax: optMoney, spouseIncome: optMoney, spouseContribution: optMoney }), req.body);
    ok(res, planSuperContributions(input));
  } catch (error) {
    next(error);
  }
});

router.post('/tax/set-aside', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const input = parse(z.object({ businessProfit: money, businessSales: optMoney, businessExpenses: optMoney, otherIncome: optMoney, gstRegistered: optBool, hasHelpDebt: optBool }), req.body);
    ok(res, planQuarterlySetAside(input));
  } catch (error) {
    next(error);
  }
});

// -------------------------------------------------------------- investing

router.post('/investing/risk-profile', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const input = parse(z.object({ answers: z.record(z.coerce.number().min(1).max(4)), age: z.coerce.number().min(16).max(110).optional() }), req.body);
    ok(res, assessRiskProfile(input));
  } catch (error) {
    next(error);
  }
});

const categories = [...ASSET_CATEGORIES, ...LIABILITY_CATEGORIES] as [WealthCategory, ...WealthCategory[]];
const holdingSchema = z.object({
  name: z.string().min(1).max(120),
  category: z.enum(categories),
  value: money,
  costBase: optMoney,
  acquiredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}/).nullable().optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  notes: z.string().max(500).optional(),
});

const acquiredDate = (v: string | null | undefined) => (v === undefined ? undefined : v === null ? null : new Date(v));

router.get('/investing/holdings', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const holdings = await prisma.portfolioHolding.findMany({ where: { userId: req.user!.id }, orderBy: [{ kind: 'asc' }, { value: 'desc' }] });
    ok(res, holdings);
  } catch (error) {
    next(error);
  }
});

router.post('/investing/holdings', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = parse(holdingSchema, req.body);
    const kind = LIABILITY_CATEGORIES.includes(data.category) ? 'LIABILITY' : 'ASSET';
    const holding = await prisma.portfolioHolding.create({ data: { userId: req.user!.id, kind, category: data.category, name: data.name, value: data.value, costBase: data.costBase, acquiredAt: acquiredDate(data.acquiredAt) ?? undefined, currency: data.currency ?? 'AUD', notes: data.notes } });
    ok(res, holding, 201);
  } catch (error) {
    next(error);
  }
});

async function ownHolding(userId: string, id: string) {
  const holding = await prisma.portfolioHolding.findUnique({ where: { id } });
  if (!holding) throw new ApiError(404, 'Holding not found');
  if (holding.userId !== userId) throw new ApiError(403, 'Not authorized');
  return holding;
}

router.patch('/investing/holdings/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await ownHolding(req.user!.id, req.params.id);
    const data = parse(holdingSchema.partial(), req.body);
    const kind = data.category ? (LIABILITY_CATEGORIES.includes(data.category) ? 'LIABILITY' : 'ASSET') : undefined;
    const holding = await prisma.portfolioHolding.update({ where: { id: req.params.id }, data: { ...data, acquiredAt: acquiredDate(data.acquiredAt), ...(kind ? { kind } : {}) } });
    ok(res, holding);
  } catch (error) {
    next(error);
  }
});

router.delete('/investing/holdings/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await ownHolding(req.user!.id, req.params.id);
    await prisma.portfolioHolding.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.get('/investing/net-worth', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const q = parse(z.object({ profile: z.enum(riskProfiles).optional(), emergencyFundTarget: optMoney }), req.query);
    const [holdings, superAccounts, goals, plan] = await Promise.all([
      prisma.portfolioHolding.findMany({ where: { userId } }),
      prisma.superannuationAccount.findMany({ where: { userId } }),
      prisma.savingsGoal.findMany({ where: { userId, status: 'ACTIVE' } }),
      prisma.strategyPlan.findUnique({ where: { userId_area: { userId, area: 'INVESTMENT' } } }),
    ]);
    const savedProfile = (plan?.result as { profile?: string } | null)?.profile;
    const profile = (q.profile ?? (riskProfiles.includes(savedProfile as RiskProfile) ? (savedProfile as RiskProfile) : undefined)) as RiskProfile | undefined;
    const emergencyGoal = goals.find((g) => g.type === 'EMERGENCY_FUND');
    const result = assessNetWorth({
      holdings: holdings.map((h) => ({ id: h.id, name: h.name, kind: h.kind, category: h.category, value: Number(h.value) })),
      superBalance: superAccounts.reduce((s, a) => s + Number(a.balance), 0),
      superAccounts: superAccounts.map((a) => ({ balance: a.balance, investmentOpt: a.investmentOpt })),
      savingsBalance: goals.reduce((s, g) => s + Number(g.currentAmount), 0),
      profile,
      emergencyFundTarget: q.emergencyFundTarget ?? (emergencyGoal ? Number(emergencyGoal.targetAmount) : undefined),
    });
    // Today's figure is kept so the page can show where net worth has gone.
    if (holdings.length + superAccounts.length + goals.length > 0) {
      const day = new Date(new Date().toISOString().slice(0, 10));
      const snapshot = { totalAssets: result.totalAssets, totalLiabilities: result.totalLiabilities, netWorth: result.netWorth, investable: result.investable };
      await prisma.netWorthSnapshot.upsert({ where: { userId_day: { userId, day } }, create: { userId, day, ...snapshot }, update: snapshot }).catch((err: Error) => logger.debug('Net worth snapshot skipped', { error: err.message }));
    }
    ok(res, { ...result, profile: profile ?? null, holdingsCount: holdings.length, superAccounts: superAccounts.length, savingsGoals: goals.length });
  } catch (error) {
    next(error);
  }
});

router.get('/investing/net-worth-history', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const rows = await prisma.netWorthSnapshot.findMany({ where: { userId: req.user!.id }, orderBy: { day: 'asc' }, take: 400 });
    const points = rows.map((r) => ({ day: r.day.toISOString().slice(0, 10), netWorth: Number(r.netWorth), totalAssets: Number(r.totalAssets), totalLiabilities: Number(r.totalLiabilities) }));
    const first = points[0];
    const last = points[points.length - 1];
    const milestones = [10000, 50000, 100000, 250000, 500000, 1000000].map((amount) => ({ amount, reachedOn: points.find((p) => p.netWorth >= amount)?.day ?? null }));
    ok(res, { points, change: first && last ? last.netWorth - first.netWorth : 0, since: first?.day ?? null, milestones });
  } catch (error) {
    next(error);
  }
});

router.get('/investing/holdings-review', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const q = parse(z.object({ taxableIncome: optMoney }), req.query);
    const holdings = await prisma.portfolioHolding.findMany({ where: { userId: req.user!.id, kind: 'ASSET' } });
    ok(res, reviewHoldings(holdings.map((h) => ({ id: h.id, name: h.name, category: h.category, value: Number(h.value), costBase: h.costBase === null ? null : Number(h.costBase), acquiredAt: h.acquiredAt })), q.taxableIncome ?? 90000));
  } catch (error) {
    next(error);
  }
});

// ------------------------------------------------- the rest of the housing plan

router.get('/housing/rent-help', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    ok(res, rentAssistanceReference());
  } catch (error) {
    next(error);
  }
});

router.post('/housing/rent-assistance', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const input = parse(z.object({ fortnightlyRent: money, household: z.enum(['single', 'single_sharer', 'couple', 'single_children_1_2', 'single_children_3', 'couple_children_1_2', 'couple_children_3']) }), req.body);
    ok(res, estimateRentAssistance({ fortnightlyRent: input.fortnightlyRent, household: input.household as Household }));
  } catch (error) {
    next(error);
  }
});

router.post('/housing/compare-loans', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const input = parse(z.object({
      principal: money, years: z.coerce.number().min(1).max(40), horizonYears: z.coerce.number().min(1).max(40).optional(), offsetBalance: optMoney,
      loans: z.array(z.object({ name: z.string().min(1).max(60), ratePct: z.coerce.number().min(0).max(30), annualFee: optMoney, upfrontFee: optMoney, offset: optBool, fixedYears: z.coerce.number().min(0).max(10).optional(), revertRatePct: z.coerce.number().min(0).max(30).optional() })).min(1).max(6),
    }), req.body);
    ok(res, compareLoans(input));
  } catch (error) {
    next(error);
  }
});

router.post('/housing/investment-property', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const input = parse(z.object({
      state, price: money, weeklyRent: money, depositPct: z.coerce.number().min(0).max(100).optional(), ratePct: z.coerce.number().min(0).max(30).optional(), interestOnly: optBool, years: z.coerce.number().min(1).max(40).optional(),
      taxableIncome: money, managementPct: z.coerce.number().min(0).max(20).optional(), vacancyWeeks: z.coerce.number().min(0).max(52).optional(), annualCosts: optMoney, depreciation: optMoney, growthPct: optPct, rentGrowthPct: optPct, horizonYears: z.coerce.number().min(1).max(30).optional(),
    }), req.body);
    ok(res, assessInvestmentProperty({ ...input, state: input.state as (typeof AU_STATES)[number] }));
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------- the rest of the business plan

router.get('/business/investor-matches', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const q = parse(z.object({ stage: z.string().max(60).optional(), industry: z.string().max(60).optional(), state: z.string().max(10).optional(), raiseAmount: optMoney, investorTypes: z.string().max(200).optional() }), req.query);
    const investors = await prisma.investor.findMany({ where: { isActive: true } });
    const ranked = rankInvestors(investors, { ...q, investorTypes: q.investorTypes ? q.investorTypes.split(',').map((s) => s.trim()).filter(Boolean) : undefined });
    ok(res, { profile: q, matches: ranked });
  } catch (error) {
    next(error);
  }
});

router.post('/business/pitch-check', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const input = parse(z.object({ text: z.string().max(20000).optional(), sections: z.record(z.string().max(4000)).optional() }), req.body);
    ok(res, checkPitch(input as Parameters<typeof checkPitch>[0]));
  } catch (error) {
    next(error);
  }
});

// --------------------------------------------------- the rest of the tax plan

router.post('/tax/help-debt', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const input = parse(z.object({ balance: money, income: money, incomeGrowthPct: z.coerce.number().min(-20).max(50).optional(), indexationPct: z.coerce.number().min(0).max(20).optional(), lumpSum: optMoney, extraMonthly: optMoney, investReturnPct: z.coerce.number().min(0).max(30).optional() }), req.body);
    ok(res, planHelpDebt(input));
  } catch (error) {
    next(error);
  }
});

router.get('/tax/bank-deductions', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const q = parse(z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(), to: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional() }), req.query);
    const now = new Date();
    const fyStart = new Date(Date.UTC(now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1, 6, 1));
    const lines = await listTransactions(req.user!.id, { from: q.from ? new Date(q.from) : fyStart, to: q.to ? new Date(`${q.to}T23:59:59.999Z`) : now, limit: 3000 });
    ok(res, { ...scanForDeductions(lines), from: (q.from ? new Date(q.from) : fyStart).toISOString().slice(0, 10), to: (q.to ? new Date(q.to) : now).toISOString().slice(0, 10) });
  } catch (error) {
    next(error);
  }
});

// -------------------------------------------- the rest of the investing plan

router.post('/investing/debts', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const input = parse(z.object({
      debts: z.array(z.object({ name: z.string().min(1).max(60), balance: money, ratePct: z.coerce.number().min(0).max(100), minPayment: optMoney })).min(1).max(12),
      extraMonthly: optMoney, method: z.enum(['avalanche', 'snowball']).optional(), consolidationRatePct: z.coerce.number().min(0).max(100).optional(), consolidationYears: z.coerce.number().min(0.5).max(30).optional(), consolidationFee: optMoney,
    }), req.body);
    ok(res, planDebtPayoff(input));
  } catch (error) {
    next(error);
  }
});

router.post('/investing/goal-plan', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const input = parse(z.object({ target: money, current: optMoney, targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(), months: z.coerce.number().min(1).max(600).optional(), ratePct: z.coerce.number().min(0).max(20).optional() }), req.body);
    ok(res, planGoal(input));
  } catch (error) {
    next(error);
  }
});

router.get('/investing/round-ups', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const q = parse(z.object({ roundTo: z.coerce.number().optional(), days: z.coerce.number().min(7).max(365).optional() }), req.query);
    const roundTo = ([1, 5, 10] as const).find((v) => v === q.roundTo) ?? 5;
    const days = q.days ?? 30;
    const now = new Date();
    const lines = await listTransactions(req.user!.id, { from: new Date(now.getTime() - days * 86400000), to: now, limit: 3000 });
    ok(res, roundUpPotential(lines, roundTo, days));
  } catch (error) {
    next(error);
  }
});

router.post('/investing/insurance-needs', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const input = parse(z.object({ income: money, monthlyExpenses: money, debts: optMoney, dependants: z.coerce.number().min(0).max(12).optional(), yearsOfSupport: z.coerce.number().min(0).max(40).optional(), partnerIncome: optMoney, savings: optMoney, superBalance: optMoney, existingLife: optMoney, existingTpd: optMoney, existingIncomeProtectionMonthly: optMoney, emergencyFundMonths: z.coerce.number().min(0).max(24).optional() }), req.body);
    ok(res, assessInsuranceNeeds(input));
  } catch (error) {
    next(error);
  }
});

router.post('/investing/super-projection', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const input = parse(z.object({ age: z.coerce.number().min(15).max(80), retirementAge: z.coerce.number().min(55).max(80).optional(), balance: money, salary: money, salaryGrowthPct: z.coerce.number().min(-10).max(30).optional(), extraMonthly: optMoney, returnPct: z.coerce.number().min(0).max(20).optional(), feesPct: z.coerce.number().min(0).max(5).optional(), inflationPct: z.coerce.number().min(0).max(15).optional(), careerBreakYears: z.coerce.number().min(0).max(20).optional(), breakAtAge: z.coerce.number().min(15).max(80).optional(), partTimeYears: z.coerce.number().min(0).max(30).optional(), partTimeFraction: z.coerce.number().min(0.1).max(1).optional() }), req.body);
    ok(res, projectSuper(input));
  } catch (error) {
    next(error);
  }
});

// --------------------------------------------------------- launch and pitch

router.get('/business/launch-package', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const q = parse(z.object({ structure: z.enum(['SOLE_TRADER', 'PARTNERSHIP', 'COMPANY', 'TRUST']).optional(), online: optBool, employees: optBool, premises: optBool }), req.query);
    const checklist = launchChecklist((q.structure ?? 'SOLE_TRADER') as Structure, { online: q.online, employees: q.employees, premises: q.premises });
    const categories = [...new Set(checklist.map((s) => s.vendorCategory).filter((c): c is string => Boolean(c)))];
    const vendors = await prisma.vendor.findMany({ where: { category: { in: categories as never[] } }, orderBy: [{ isPartner: 'desc' }, { avgRating: 'desc' }], take: 200 });
    ok(res, { structure: q.structure ?? 'SOLE_TRADER', checklist, vendors: pickVendors(vendors, categories) });
  } catch (error) {
    next(error);
  }
});

router.post('/business/deck-outline', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const input = parse(z.object({ businessName: z.string().max(120).optional(), text: z.string().max(20000).optional(), sections: z.record(z.string().max(4000)).optional() }), req.body);
    ok(res, buildDeckOutline(input as Parameters<typeof buildDeckOutline>[0]));
  } catch (error) {
    next(error);
  }
});

// A completion certificate anyone can check, keyed on the enrolment.
router.get('/business/accelerator-certificates/:enrollmentId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const enrollment = await prisma.acceleratorEnrollment.findUnique({
      where: { id: req.params.enrollmentId },
      include: { cohort: { select: { name: true, startDate: true, endDate: true, curriculum: true } }, user: { select: { firstName: true, lastName: true } } },
    });
    if (!enrollment || enrollment.status !== 'COMPLETED' || !enrollment.completedAt) throw new ApiError(404, 'No certificate for that enrolment');
    const holder = [enrollment.user.firstName, enrollment.user.lastName].filter(Boolean).join(' ') || 'A founder';
    ok(res, { code: enrollment.id, holder, cohort: { name: enrollment.cohort.name, startDate: enrollment.cohort.startDate, endDate: enrollment.cohort.endDate }, completedAt: enrollment.completedAt, weeks: Math.max(enrollment.completedWeeks, 12) });
  } catch (error) {
    next(error);
  }
});

// ------------------------------------------------------ what the platform paid

router.get('/tax/earnings-statement', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const q = parse(z.object({ fy: z.coerce.number().min(2020).max(2100).optional() }), req.query);
    ok(res, await buildEarningsStatement(req.user!.id, q.fy));
  } catch (error) {
    next(error);
  }
});

// ------------------------------------------------------------ the roadmap

router.get('/roadmap', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    ok(res, await buildRoadmap(req.user!.id));
  } catch (error) {
    next(error);
  }
});

router.get('/peers', authenticate, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    ok(res, await peerSnapshot());
  } catch (error) {
    next(error);
  }
});

router.post('/investing/projection', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const input = parse(z.object({
      currentInvestments: optMoney, currentSuper: optMoney, monthlyContribution: optMoney, salary: optMoney, salaryGrowthPct: z.coerce.number().min(-20).max(50).optional(),
      returnPct: z.coerce.number().min(0).max(30).optional(), superReturnPct: z.coerce.number().min(0).max(30).optional(), years: z.coerce.number().min(1).max(40).optional(), inflationPct: z.coerce.number().min(0).max(20).optional(),
      extraMonthly: optMoney, careerBreak: z.object({ startYear: z.coerce.number().min(1).max(40), years: z.coerce.number().min(0).max(20) }).optional(), profile: z.enum(riskProfiles).optional(),
    }), req.body);
    ok(res, projectWealth(input));
  } catch (error) {
    next(error);
  }
});

router.post('/investing/emergency-fund', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const input = parse(z.object({ monthlyExpenses: money, months: z.coerce.number().min(1).max(12).optional(), currentSavings: optMoney, monthlySaving: optMoney, incomeStability: z.enum(['stable', 'variable', 'single_income_with_dependants']).optional() }), req.body);
    ok(res, planEmergencyFund(input));
  } catch (error) {
    next(error);
  }
});

export default router;
