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
    const plan = await prisma.strategyPlan.upsert({
      where: { userId_area: { userId, area } },
      create: { userId, area, title: data.title, inputs: data.inputs as object, result: data.result as object },
      update: { title: data.title, inputs: data.inputs as object, result: data.result as object },
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
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  notes: z.string().max(500).optional(),
});

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
    const holding = await prisma.portfolioHolding.create({ data: { userId: req.user!.id, kind, category: data.category, name: data.name, value: data.value, costBase: data.costBase, currency: data.currency ?? 'AUD', notes: data.notes } });
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
    const holding = await prisma.portfolioHolding.update({ where: { id: req.params.id }, data: { ...data, ...(kind ? { kind } : {}) } });
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
      savingsBalance: goals.reduce((s, g) => s + Number(g.currentAmount), 0),
      profile,
      emergencyFundTarget: q.emergencyFundTarget ?? (emergencyGoal ? Number(emergencyGoal.targetAmount) : undefined),
    });
    ok(res, { ...result, profile: profile ?? null, holdingsCount: holdings.length, superAccounts: superAccounts.length, savingsGoals: goals.length });
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
