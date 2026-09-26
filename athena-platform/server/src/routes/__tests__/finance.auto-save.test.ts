/**
 * Two claims the finance routes used to make on nothing.
 *
 * Auto-save: the invest page set `autoSaveEnabled` on the emergency fund and
 * told the member "Auto-save of $X a month set", and no job reads that flag or
 * can — ATHENA holds no mandate to move a member's money. The routes now refuse
 * to switch it on.
 *
 * Super: editing a super balance by hand stamped `lastSyncAt` with the current
 * time, so the API and the data export presented a typed-in number as synced
 * from the fund.
 */

import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    savingsGoal: {
      create: jest.fn(async ({ data }: any) => ({ id: 'goal-1', ...data })),
      findUnique: jest.fn(),
      update: jest.fn(async ({ data }: any) => ({ id: 'goal-1', ...data })),
    },
    superannuationAccount: {
      findUnique: jest.fn(),
      update: jest.fn(async ({ data }: any) => ({ id: 'super-1', ...data })),
    },
  },
}));

jest.mock('../../middleware/auth', () => {
  const actual: any = jest.requireActual('../../middleware/auth');
  return {
    ...actual,
    authenticate: (req: any, _res: any, next: any) => {
      req.user = { id: 'mei', role: 'USER', email: 'mei@example.com' };
      next();
    },
  };
});

jest.mock('../../middleware/rateLimiter', () => {
  const actual: any = jest.requireActual('../../middleware/rateLimiter');
  return { ...actual, createRateLimiter: () => (_req: any, _res: any, next: any) => next() };
});

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  redactSensitive: (value: unknown) => value,
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;

beforeEach(() => {
  jest.clearAllMocks();
  prisma.savingsGoal.findUnique.mockResolvedValue({ id: 'goal-1', userId: 'mei' });
  prisma.superannuationAccount.findUnique.mockResolvedValue({ id: 'super-1', userId: 'mei' });
});

describe('Auto-save cannot be switched on', () => {
  it('refuses a new goal with auto-save on, and says what to do instead', async () => {
    const res = await request(app)
      .post('/api/finance/savings-goals')
      .send({ name: 'Emergency fund', type: 'EMERGENCY_FUND', targetAmount: 5000, autoSaveEnabled: true })
      .expect(400);

    expect(JSON.stringify(res.body)).toMatch(/cannot move money into your savings automatically/);
    expect(prisma.savingsGoal.create).not.toHaveBeenCalled();
  });

  it('refuses to switch it on for an existing goal', async () => {
    await request(app)
      .patch('/api/finance/savings-goals/goal-1')
      .send({ autoSaveEnabled: true, autoSaveAmount: 40 })
      .expect(400);

    expect(prisma.savingsGoal.update).not.toHaveBeenCalled();
  });

  it('still lets a goal saved with it on be switched off', async () => {
    await request(app).patch('/api/finance/savings-goals/goal-1').send({ autoSaveEnabled: false }).expect(200);

    expect(prisma.savingsGoal.update.mock.calls[0][0].data).toMatchObject({ autoSaveEnabled: false });
  });

  it('accepts a monthly target, which is what the invest page now sets', async () => {
    await request(app).patch('/api/finance/savings-goals/goal-1').send({ monthlyTarget: 42 }).expect(200);

    expect(prisma.savingsGoal.update.mock.calls[0][0].data).toMatchObject({ monthlyTarget: 42 });
  });
});

describe('A super balance typed in by hand is not presented as synced', () => {
  it('does not stamp lastSyncAt on a manual edit', async () => {
    await request(app).patch('/api/finance/super/super-1').send({ balance: 81234 }).expect(200);

    const data = prisma.superannuationAccount.update.mock.calls[0][0].data;
    expect(data.balance).toBe(81234);
    expect(data).not.toHaveProperty('lastSyncAt');
  });
});
