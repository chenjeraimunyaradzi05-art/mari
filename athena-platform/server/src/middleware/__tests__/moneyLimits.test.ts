import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// No Redis at all: a money ceiling that allows everything when its store is
// missing is not a ceiling, so these must hold on the in-process window.
jest.mock('../../utils/cache', () => ({ getRedisClient: jest.fn(() => null) }));
jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../../utils/prisma', () => ({
  prisma: { escrowPayment: { count: jest.fn() } },
}));

import { prisma } from '../../utils/prisma';
import { resetMemoryRateLimits } from '../rateLimiter';
import {
  MONEY_LIMITS,
  assertRoomForAnotherHold,
  declinedCardGuard,
  giftCeiling,
  isPausedForDeclines,
  noteDeclinedPayment,
  payoutCeiling,
  recentDeclines,
  resetMoneyLimits,
  startingAPayment,
} from '../moneyLimits';

const db: any = prisma;
const HOUR = 60 * 60 * 1000;

/** An app whose caller is whoever the x-test-user header says, with the given limits in front of one route. */
function appWith(...handlers: express.RequestHandler[]) {
  const app = express();
  app.use((req, _res, next) => {
    const id = req.headers['x-test-user'];
    if (typeof id === 'string') (req as any).user = { id };
    next();
  });
  app.post('/pay', ...handlers, (_req, res) => res.json({ ok: true }));
  app.use((err: any, _req: any, res: any, _next: any) => res.status(err?.statusCode || 500).json({ message: err?.message }));
  return app;
}

function post(app: express.Express, member: string) {
  return request(app).post('/pay').set('x-test-user', member);
}

beforeEach(() => {
  jest.clearAllMocks();
  resetMemoryRateLimits();
  resetMoneyLimits();
  delete process.env.REDIS_URL;
});

describe('Starting a payment', () => {
  it('lets a member start as many payments an hour as the ceiling says, and no more', async () => {
    const app = appWith(startingAPayment);

    for (let i = 0; i < MONEY_LIMITS.intent.max; i += 1) {
      await (post(app, 'ada')).expect(200);
    }
    const refused = await (post(app, 'ada')).expect(429);

    expect(refused.body.success).toBe(false);
    expect(refused.body.message).toMatch(/started a lot of payments/i);
    expect(refused.headers['retry-after']).toBeDefined();
  });

  it('keeps members apart: one woman’s loop does not stop another', async () => {
    const app = appWith(startingAPayment);
    for (let i = 0; i < MONEY_LIMITS.intent.max + 1; i += 1) await post(app, 'ada');

    await (post(app, 'ada')).expect(429);
    await (post(app, 'grace')).expect(200);
  });

  it('is keyed on the member and not the address, so a shared network is not penalised', async () => {
    const app = appWith(startingAPayment);
    for (let i = 0; i < MONEY_LIMITS.intent.max; i += 1) {
      // The same address, a different member each time.
      await (post(app, `member-${i}`)).expect(200);
    }
    await (post(app, 'member-last')).expect(200);
  });

  it('counts a payment started on any route, because a script does not care which door it uses', async () => {
    const one = appWith(startingAPayment);
    const two = appWith(startingAPayment);
    for (let i = 0; i < MONEY_LIMITS.intent.max / 2; i += 1) {
      await (post(one, 'ada')).expect(200);
      await (post(two, 'ada')).expect(200);
    }

    await (post(one, 'ada')).expect(429);
    await (post(two, 'ada')).expect(429);
  });
});

describe('Gifts and withdrawals', () => {
  it('stops a run of gifts, with a message a person can act on', async () => {
    const app = appWith(giftCeiling);
    for (let i = 0; i < MONEY_LIMITS.gift.max; i += 1) await (post(app, 'ada')).expect(200);

    const refused = await (post(app, 'ada')).expect(429);

    expect(refused.body.message).toMatch(/sending gifts very quickly/i);
  });

  it('allows three withdrawals a day and refuses the fourth, saying the earnings are safe', async () => {
    const app = appWith(payoutCeiling);
    for (let i = 0; i < MONEY_LIMITS.payout.max; i += 1) await (post(app, 'ada')).expect(200);

    const refused = await (post(app, 'ada')).expect(429);

    expect(MONEY_LIMITS.payout.max).toBe(3);
    expect(refused.body.message).toMatch(/earnings are safe/i);
  });

  it('keeps the three ceilings separate: gifts do not use up withdrawals', async () => {
    const gifts = appWith(giftCeiling);
    const payouts = appWith(payoutCeiling);
    for (let i = 0; i < MONEY_LIMITS.gift.max + 1; i += 1) await post(gifts, 'ada');

    await (post(payouts, 'ada')).expect(200);
  });
});

describe('Declined payments pause new ones', () => {
  it('counts declines per member and reads them back', async () => {
    await noteDeclinedPayment('ada');
    await noteDeclinedPayment('ada');
    await noteDeclinedPayment('grace');

    expect(await recentDeclines('ada')).toBe(2);
    expect(await recentDeclines('grace')).toBe(1);
    expect(await recentDeclines('nobody')).toBe(0);
  });

  it('pauses new payments after five declines in an hour, for that member only', async () => {
    const app = appWith(startingAPayment);
    for (let i = 0; i < MONEY_LIMITS.declines.max - 1; i += 1) await noteDeclinedPayment('ada');
    await (post(app, 'ada')).expect(200);

    await noteDeclinedPayment('ada');
    const refused = await (post(app, 'ada')).expect(429);

    expect(refused.body.message).toMatch(/declined a few times/i);
    expect(refused.body.message).toMatch(/bank/i);
    expect(refused.headers['retry-after']).toBe(String(HOUR / 1000));
    await (post(app, 'grace')).expect(200);
  });

  it('lifts the pause once the declines have aged out of the hour', async () => {
    const t0 = 1_000_000_000_000;
    for (let i = 0; i < MONEY_LIMITS.declines.max; i += 1) await noteDeclinedPayment('ada', t0 + i);

    expect(await isPausedForDeclines('ada', t0 + 10)).toBe(true);
    expect(await isPausedForDeclines('ada', t0 + HOUR - 1)).toBe(true);
    // Three of the five have aged out of the hour, so fewer than five remain.
    expect(await isPausedForDeclines('ada', t0 + HOUR + 2)).toBe(false);
  });

  it('does not use up the ceiling for a payment it turned away', async () => {
    const app = appWith(startingAPayment);
    for (let i = 0; i < MONEY_LIMITS.declines.max; i += 1) await noteDeclinedPayment('ada');
    for (let i = 0; i < MONEY_LIMITS.intent.max + 5; i += 1) await (post(app, 'ada')).expect(429);

    // Declines age out; she is not still locked by the refused requests.
    resetMoneyLimits();
    await (post(app, 'ada')).expect(200);
  });

  it('has nothing to check on a request with no signed-in member, and refuses nobody', async () => {
    const app = appWith(declinedCardGuard);
    await request(app).post('/pay').expect(200);
  });
});

describe('Holds recorded per buyer', () => {
  it('counts the buyer’s holds in the last hour and refuses one more than the ceiling', async () => {
    db.escrowPayment.count.mockResolvedValue(MONEY_LIMITS.holdsPerBuyer.max);

    await expect(assertRoomForAnotherHold('ada')).rejects.toMatchObject({
      statusCode: 429,
      message: expect.stringMatching(/lot of payments in the last hour/i),
    });

    const where = db.escrowPayment.count.mock.calls[0][0].where;
    expect(where.buyerId).toBe('ada');
    const since = where.createdAt.gte as Date;
    expect(Date.now() - since.getTime()).toBeGreaterThanOrEqual(HOUR - 1000);
    expect(Date.now() - since.getTime()).toBeLessThan(HOUR + 5000);
  });

  it('allows the hold that is still inside the ceiling', async () => {
    db.escrowPayment.count.mockResolvedValue(MONEY_LIMITS.holdsPerBuyer.max - 1);

    await expect(assertRoomForAnotherHold('ada')).resolves.toBeUndefined();
  });

  it('lets the hold through when the count cannot be read: the hold is a write to the same database', async () => {
    db.escrowPayment.count.mockRejectedValue(new Error('connection reset'));

    await expect(assertRoomForAnotherHold('ada')).resolves.toBeUndefined();
  });
});
