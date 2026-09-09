import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    strategyPlan: { findMany: jest.fn(async () => []), upsert: jest.fn(), deleteMany: jest.fn(async () => ({ count: 1 })), findUnique: jest.fn(async () => null) },
    portfolioHolding: { findMany: jest.fn(async () => []), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    superannuationAccount: { findMany: jest.fn(async () => []) },
    savingsGoal: { findMany: jest.fn(async () => []) },
    grant: { findMany: jest.fn(async () => []) },
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

  it('refuses bad input with a reason', async () => {
    const res = await request(app).post('/api/strategy/housing/stamp-duty').send({ state: 'XX', price: 100 }).expect(400);
    expect(res.body.message || res.body.error).toMatch(/state/);
    await request(app).post('/api/strategy/housing/mortgage').send({ principal: 100000, annualRatePct: 6, years: 99 }).expect(400);
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

    prisma.portfolioHolding.findUnique.mockResolvedValue({ id: 'h1', userId: 'ana' });
    await request(app).patch('/api/strategy/investing/holdings/h1').set(as('bea')).send({ value: 1 }).expect(403);
    await request(app).delete('/api/strategy/investing/holdings/h1').set(as('bea')).expect(403);
    expect(prisma.portfolioHolding.update).not.toHaveBeenCalled();
    expect(prisma.portfolioHolding.delete).not.toHaveBeenCalled();

    prisma.portfolioHolding.update.mockResolvedValue({ id: 'h1', value: 1 });
    await request(app).patch('/api/strategy/investing/holdings/h1').set(as('ana')).send({ value: 1 }).expect(200);
    await request(app).delete('/api/strategy/investing/holdings/h1').set(as('ana')).expect(204);
  });

  it('builds net worth from holdings, super and savings, using the saved profile', async () => {
    prisma.portfolioHolding.findMany.mockResolvedValue([{ id: 'h1', name: 'ETF', kind: 'ASSET', category: 'INTL_SHARES', value: '10000' }]);
    prisma.superannuationAccount.findMany.mockResolvedValue([{ balance: '55000' }]);
    prisma.savingsGoal.findMany.mockResolvedValue([{ type: 'EMERGENCY_FUND', currentAmount: '8000', targetAmount: '12000' }]);
    prisma.strategyPlan.findUnique.mockResolvedValue({ result: { profile: 'growth' } });

    const res = await request(app).get('/api/strategy/investing/net-worth').set(as('ana')).expect(200);
    expect(res.body.data.totalAssets).toBe(73000);
    expect(res.body.data.profile).toBe('growth');
    expect(res.body.data.investable).toBe(10000);
    expect(res.body.data.warnings.some((w: string) => /emergency fund/i.test(w))).toBe(true);
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
});
