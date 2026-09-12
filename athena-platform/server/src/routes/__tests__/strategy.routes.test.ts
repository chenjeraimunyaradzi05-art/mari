import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    strategyPlan: { findMany: jest.fn(async () => []), upsert: jest.fn(), deleteMany: jest.fn(async () => ({ count: 1 })), findUnique: jest.fn(async () => null), count: jest.fn(async () => 0) },
    portfolioHolding: { findMany: jest.fn(async () => []), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    netWorthSnapshot: { upsert: jest.fn(async () => ({})), findMany: jest.fn(async () => []) },
    superannuationAccount: { findMany: jest.fn(async () => []), count: jest.fn(async () => 0) },
    savingsGoal: { findMany: jest.fn(async () => []) },
    insuranceApplication: { findMany: jest.fn(async () => []) },
    businessRegistration: { count: jest.fn(async () => 0) },
    grant: { findMany: jest.fn(async () => []) },
    investor: { findMany: jest.fn(async () => []) },
    vendor: { findMany: jest.fn(async () => []) },
    acceleratorEnrollment: { findUnique: jest.fn(async () => null) },
    giftTransaction: { findMany: jest.fn(async () => []) },
    mentorSession: { findMany: jest.fn(async () => []) },
    creatorProfile: { findUnique: jest.fn(async () => null) },
    creatorPayout: { findMany: jest.fn(async () => []) },
    user: { count: jest.fn(async () => 3) },
    bankConnection: { findMany: jest.fn(async () => []) },
    bankTransaction: { findMany: jest.fn(async () => []) },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: req.headers['x-test-user'] || 'member', role: 'USER', email: 'x@athena.com' };
    next();
  },
  optionalAuth: (_req: any, _res: any, next: any) => next(),
  requireRole: (..._roles: string[]) => (_req: any, __res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;
const as = (userId: string) => ({ 'x-test-user': userId });

describe('The strategy routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('runs the open calculators without a member', async () => {
    const duty = await request(app).post('/api/strategy/housing/stamp-duty').send({ state: 'NSW', price: 800000, firstHome: true }).expect(200);
    expect(duty.body.data.dutyPayable).toBe(0);

    const tax = await request(app).post('/api/strategy/tax/estimate').send({ grossIncome: '100000' }).expect(200);
    expect(tax.body.data.taxableIncome).toBe(100000);

    const structures = await request(app).post('/api/strategy/business/structures').send({ profit: 120000 }).expect(200);
    expect(structures.body.data.options).toHaveLength(4);

    const profile = await request(app).post('/api/strategy/investing/risk-profile').send({ answers: { horizon: 4, drop: 3, experience: 3, income: 3, goal: 3, access: 3 } }).expect(200);
    expect(profile.body.data.profile).toBe('growth');

    const reference = await request(app).get('/api/strategy/reference').expect(200);
    expect(reference.body.data.housing.states).toContain('QLD');
    expect(reference.body.data.investing.questions.length).toBeGreaterThan(3);
  });

  it('runs the second set of open calculators too', async () => {
    const loans = await request(app).post('/api/strategy/housing/compare-loans').send({ principal: 400000, years: 30, loans: [{ name: 'A', ratePct: 6 }, { name: 'B', ratePct: 5.8, annualFee: 400 }] }).expect(200);
    expect(loans.body.data.loans).toHaveLength(2);
    const help = await request(app).get('/api/strategy/housing/rent-help').expect(200);
    expect(help.body.data.bondHelp).toHaveLength(8);
    const rent = await request(app).post('/api/strategy/housing/rent-assistance').send({ fortnightlyRent: 400, household: 'single' }).expect(200);
    expect(rent.body.data.estimateFortnightly).toBe(186.3);
    const hecs = await request(app).post('/api/strategy/tax/help-debt').send({ balance: 20000, income: 80000 }).expect(200);
    expect(hecs.body.data.scenarios).toHaveLength(3);
    const debts = await request(app).post('/api/strategy/investing/debts').send({ debts: [{ name: 'Card', balance: 3000, ratePct: 20 }] }).expect(200);
    expect(debts.body.data.chosen.months).not.toBeNull();
    const goal = await request(app).post('/api/strategy/investing/goal-plan').send({ target: 6000, months: 6 }).expect(200);
    expect(goal.body.data.monthlyNeeded).toBe(1000);
    const pitch = await request(app).post('/api/strategy/business/pitch-check').send({ text: 'We are raising $500,000.' }).expect(200);
    expect(pitch.body.data.found.map((f: any) => f.key)).toContain('ask');
    const sup = await request(app).post('/api/strategy/investing/super-projection').send({ age: 30, balance: 40000, salary: 80000 }).expect(200);
    expect(sup.body.data.scenarios).toHaveLength(3);
  });

  it('refuses bad input with a reason', async () => {
    const res = await request(app).post('/api/strategy/housing/stamp-duty').send({ state: 'XX', price: 100 }).expect(400);
    expect(res.body.message || res.body.error).toMatch(/state/);
    await request(app).post('/api/strategy/housing/mortgage').send({ principal: 100000, annualRatePct: 6, years: 99 }).expect(400);
    await request(app).post('/api/strategy/investing/debts').send({ debts: [] }).expect(400);
  });

  it('saves one plan per area for the member and lists them', async () => {
    prisma.strategyPlan.upsert.mockImplementation(async ({ create }: any) => ({ id: 'p1', ...create }));
    const res = await request(app).put('/api/strategy/plans/housing').set(as('ana')).send({ title: 'Brisbane by 2028', inputs: { price: 700000 }, result: { cashNeeded: 50000 } }).expect(200);
    expect(res.body.data.area).toBe('HOUSING');
    const call = prisma.strategyPlan.upsert.mock.calls[0][0];
    expect(call.where).toEqual({ userId_area: { userId: 'ana', area: 'HOUSING' } });
    expect(call.update.inputs).toEqual({ price: 700000 });

    await request(app).put('/api/strategy/plans/holiday').set(as('ana')).send({ inputs: {}, result: {} }).expect(400);

    prisma.strategyPlan.findMany.mockResolvedValue([{ id: 'p1', area: 'HOUSING' }]);
    const list = await request(app).get('/api/strategy/plans').set(as('ana')).expect(200);
    expect(prisma.strategyPlan.findMany.mock.calls[0][0].where).toEqual({ userId: 'ana' });
    expect(list.body.data).toHaveLength(1);

    await request(app).delete('/api/strategy/plans/housing').set(as('ana')).expect(204);
    expect(prisma.strategyPlan.deleteMany.mock.calls[0][0].where).toEqual({ userId: 'ana', area: 'HOUSING' });
  });

  it('keeps holdings to their owner', async () => {
    prisma.portfolioHolding.create.mockImplementation(async ({ data }: any) => ({ id: 'h1', ...data }));
    const created = await request(app).post('/api/strategy/investing/holdings').set(as('ana')).send({ name: 'Card', category: 'CREDIT_CARD', value: 2500 }).expect(201);
    expect(created.body.data.kind).toBe('LIABILITY');
    expect(created.body.data.userId).toBe('ana');

    const dated = await request(app).post('/api/strategy/investing/holdings').set(as('ana')).send({ name: 'ETF', category: 'INTL_SHARES', value: 9000, costBase: 8000, acquiredAt: '2024-05-01' }).expect(201);
    expect(new Date(dated.body.data.acquiredAt).toISOString().slice(0, 10)).toBe('2024-05-01');

    prisma.portfolioHolding.findUnique.mockResolvedValue({ id: 'h1', userId: 'ana' });
    await request(app).patch('/api/strategy/investing/holdings/h1').set(as('bea')).send({ value: 1 }).expect(403);
    await request(app).delete('/api/strategy/investing/holdings/h1').set(as('bea')).expect(403);
    expect(prisma.portfolioHolding.update).not.toHaveBeenCalled();
    expect(prisma.portfolioHolding.delete).not.toHaveBeenCalled();

    prisma.portfolioHolding.update.mockResolvedValue({ id: 'h1', value: 1 });
    await request(app).patch('/api/strategy/investing/holdings/h1').set(as('ana')).send({ value: 1 }).expect(200);
    await request(app).delete('/api/strategy/investing/holdings/h1').set(as('ana')).expect(204);
  });

  it('builds net worth from holdings, super and savings, using the saved profile, and keeps the day’s figure', async () => {
    prisma.portfolioHolding.findMany.mockResolvedValue([{ id: 'h1', name: 'ETF', kind: 'ASSET', category: 'INTL_SHARES', value: '10000' }]);
    prisma.superannuationAccount.findMany.mockResolvedValue([{ balance: '55000' }]);
    prisma.savingsGoal.findMany.mockResolvedValue([{ type: 'EMERGENCY_FUND', currentAmount: '8000', targetAmount: '12000' }]);
    prisma.strategyPlan.findUnique.mockResolvedValue({ result: { profile: 'growth' } });

    const res = await request(app).get('/api/strategy/investing/net-worth').set(as('ana')).expect(200);
    expect(res.body.data.totalAssets).toBe(73000);
    expect(res.body.data.profile).toBe('growth');
    expect(res.body.data.investable).toBe(10000);
    expect(res.body.data.warnings.some((w: string) => /emergency fund/i.test(w))).toBe(true);
    expect(prisma.netWorthSnapshot.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.netWorthSnapshot.upsert.mock.calls[0][0].create.netWorth).toBe(73000);

    prisma.netWorthSnapshot.findMany.mockResolvedValue([{ day: new Date('2026-08-01'), netWorth: '60000', totalAssets: '60000', totalLiabilities: '0' }, { day: new Date('2026-09-10'), netWorth: '73000', totalAssets: '73000', totalLiabilities: '0' }]);
    const history = await request(app).get('/api/strategy/investing/net-worth-history').set(as('ana')).expect(200);
    expect(history.body.data.change).toBe(13000);
    expect(history.body.data.milestones.find((m: any) => m.amount === 50000).reachedOn).toBe('2026-08-01');
  });

  it('ranks the listed grants against the member’s profile and drops closed ones', async () => {
    prisma.grant.findMany.mockResolvedValue([
      { id: 'g1', name: 'Open', stages: ['EARLY'], industries: [], regions: ['National'], isRolling: true, tags: ['women'] },
      { id: 'g2', name: 'Closed', stages: [], industries: [], regions: [], deadline: new Date('2020-01-01'), tags: [] },
    ]);
    const res = await request(app).get('/api/strategy/business/grant-matches?stage=EARLY&state=QLD&amountNeeded=20000').set(as('ana')).expect(200);
    expect(res.body.data.matches.map((g: any) => g.id)).toEqual(['g1']);
    expect(res.body.data.matches[0].match.score).toBeGreaterThan(70);
    expect(prisma.grant.findMany.mock.calls[0][0].where).toEqual({ isActive: true });
  });

  it('ranks the listed investors the same way', async () => {
    prisma.investor.findMany.mockResolvedValue([
      { id: 'i1', name: 'Angel', type: 'ANGEL', stages: ['Seed'], industries: ['Health'], regions: ['National'], minCheckSize: '25000', maxCheckSize: '250000', isVerified: true },
      { id: 'i2', name: 'Late fund', type: 'VC', stages: ['Series B'], industries: ['Mining'], regions: ['WA'], minCheckSize: '5000000', maxCheckSize: '20000000' },
    ]);
    const res = await request(app).get('/api/strategy/business/investor-matches?stage=Seed&industry=Health&state=QLD&raiseAmount=200000&investorTypes=ANGEL').set(as('ana')).expect(200);
    expect(res.body.data.matches[0].id).toBe('i1');
    expect(res.body.data.matches[0].match.score).toBeGreaterThan(res.body.data.matches[1].match.score);
  });

  it('keeps the valuation history on a business plan as it is saved', async () => {
    prisma.strategyPlan.findUnique.mockResolvedValue({ result: { valuationHistory: [{ date: '2026-06-01', valuationMid: 400000 }] } });
    prisma.strategyPlan.upsert.mockImplementation(async ({ create }: any) => ({ id: 'p2', ...create }));
    const res = await request(app).put('/api/strategy/plans/business').set(as('ana')).send({ inputs: { revenue: '500000', annualProfit: '120000' }, result: { valuationMid: 450000 } }).expect(200);
    const history = res.body.data.result.valuationHistory;
    expect(history).toHaveLength(2);
    expect(history[0]).toEqual({ date: '2026-06-01', valuationMid: 400000 });
    expect(history[1]).toMatchObject({ valuationMid: 450000, revenue: 500000, profit: 120000 });
  });

  it('assembles the launch package from the checklist and the listed vendors', async () => {
    prisma.vendor.findMany.mockResolvedValue([{ id: 'v1', name: 'Books & Co', category: 'ACCOUNTING_TAX', isPartner: true, discountPct: 15, avgRating: '4.8', reviewCount: 12 }]);
    const res = await request(app).get('/api/strategy/business/launch-package?structure=COMPANY&employees=true').expect(200);
    expect(res.body.data.checklist.map((s: any) => s.key)).toContain('asic');
    expect(res.body.data.checklist.map((s: any) => s.key)).toContain('payroll');
    const accounting = res.body.data.vendors.find((g: any) => g.category === 'ACCOUNTING_TAX');
    expect(accounting.picks[0]).toMatchObject({ name: 'Books & Co', discountPct: 15, isPartner: true });
  });

  it('turns the pitch into a deck outline', async () => {
    const res = await request(app).post('/api/strategy/business/deck-outline').send({ businessName: 'Bright Path', sections: { ask: 'We are raising $600,000.' } }).expect(200);
    expect(res.body.data.slides).toHaveLength(12);
    expect(res.body.data.markdown).toMatch(/# Bright Path: pitch deck outline/);
  });

  it('issues an accelerator certificate only for a completed enrolment', async () => {
    prisma.acceleratorEnrollment.findUnique.mockResolvedValue({ id: 'e1', status: 'ENROLLED', completedAt: null, completedWeeks: 4, cohort: { name: 'Cohort 3', startDate: new Date('2026-02-01'), endDate: new Date('2026-04-26') }, user: { firstName: 'Ana', lastName: 'Silva' } });
    await request(app).get('/api/strategy/business/accelerator-certificates/e1').expect(404);
    prisma.acceleratorEnrollment.findUnique.mockResolvedValue({ id: 'e1', status: 'COMPLETED', completedAt: new Date('2026-04-26'), completedWeeks: 12, cohort: { name: 'Cohort 3', startDate: new Date('2026-02-01'), endDate: new Date('2026-04-26') }, user: { firstName: 'Ana', lastName: 'Silva' } });
    const res = await request(app).get('/api/strategy/business/accelerator-certificates/e1').expect(200);
    expect(res.body.data).toMatchObject({ code: 'e1', holder: 'Ana Silva', weeks: 12 });
  });

  it('sums what the platform paid the member for a financial year', async () => {
    prisma.giftTransaction.findMany.mockResolvedValue([{ giftValue: 10000, creatorShare: 7000, platformShare: 3000 }, { giftValue: 5000, creatorShare: 3500, platformShare: 1500 }]);
    prisma.mentorSession.findMany.mockResolvedValue([{ sessionAmount: '150', platformFee: '22.5', mentorPayout: '127.5' }]);
    prisma.creatorProfile.findUnique.mockResolvedValue({ id: 'cp1' });
    prisma.creatorPayout.findMany.mockResolvedValue([{ amount: 90 }]);
    const res = await request(app).get('/api/strategy/tax/earnings-statement?fy=2026').set(as('ana')).expect(200);
    expect(res.body.data.fy).toBe('FY2026');
    expect(res.body.data.from).toBe('2025-07-01');
    expect(res.body.data.assessableIncome).toBe(105 + 127.5);
    expect(res.body.data.platformFees).toBe(45 + 22.5);
    expect(res.body.data.paidToBank).toBe(90);
    expect(prisma.giftTransaction.findMany.mock.calls[0][0].where.receiverId).toBe('ana');
    expect(prisma.mentorSession.findMany.mock.calls[0][0].where.mentorProfile).toEqual({ userId: 'ana' });
  });

  it('builds the roadmap from the member’s own records', async () => {
    prisma.savingsGoal.findMany.mockResolvedValue([{ type: 'EMERGENCY_FUND', status: 'ACTIVE', currentAmount: '3000', targetAmount: '12000' }]);
    prisma.portfolioHolding.findMany.mockResolvedValue([{ kind: 'LIABILITY', category: 'CREDIT_CARD', value: '2000' }]);
    prisma.superannuationAccount.count.mockResolvedValue(1);
    prisma.strategyPlan.findMany.mockResolvedValue([{ area: 'INVESTMENT', inputs: { expenses: '3000', estate: { will: true } }, result: { profile: 'balanced', label: 'Balanced' } }]);

    const res = await request(app).get('/api/strategy/roadmap').set(as('ana')).expect(200);
    const byKey = Object.fromEntries(res.body.data.steps.map((s: any) => [s.key, s.status]));
    expect(byKey.emergency_fund).toBe('in_progress');
    expect(byKey.expensive_debt).toBe('next');
    expect(byKey.super).toBe('in_progress');
    expect(byKey.insurance).toBe('later');
    expect(byKey.investing).toBe('done');
    expect(byKey.estate).toBe('in_progress');
    expect(res.body.data.personalRunwayMonths).toBe(1);

    const peers = await request(app).get('/api/strategy/peers').set(as('ana')).expect(200);
    expect(peers.body.data.enough).toBe(false);
  });
});
