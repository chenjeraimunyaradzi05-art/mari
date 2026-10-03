/**
 * Every route that starts a payment, sends a gift or asks for a withdrawal is
 * behind the ceiling for it.
 *
 * The ceilings themselves are tested in middleware/__tests__/moneyLimits.test.ts.
 * What that cannot say is that a route still carries one: a limiter that is
 * mounted nowhere limits nothing, and a refactor that drops the argument from
 * one route's list reads, in every other test, as a clean pass. So this reads
 * each router's own stack and checks the handler is in front of the route's.
 */

import { describe, expect, it, jest } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({ prisma: {} }));
jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../../utils/cache', () => ({ getRedisClient: jest.fn(() => null) }));
jest.mock('../../utils/stripe', () => {
  const actual: any = jest.requireActual('../../utils/stripe');
  return { ...actual, isStripeConfigured: () => false, getStripe: jest.fn() };
});

import { giftCeiling, payoutCeiling, startingAPayment } from '../../middleware/moneyLimits';
import connectRouter from '../connect.routes';
import creatorRouter from '../creator.routes';
import mentorRouter from '../mentor.routes';
import subscriptionRouter from '../subscription.routes';
import businessRouter from '../business.routes';
import formationRouter from '../formation.routes';
import livestreamRouter from '../livestream.routes';
import skillsMarketplaceRouter from '../skills-marketplace.routes';
import paymentsRouter from '../payments.routes';

type Layer = { route?: { path: string; methods: Record<string, boolean>; stack: { handle: unknown }[] } };

/** The handlers a route runs, in order, or null when the router has no such route. */
function handlersFor(router: unknown, method: string, path: string): unknown[] | null {
  const layer = ((router as { stack: Layer[] }).stack as Layer[]).find(
    (l) => l.route?.path === path && l.route.methods[method]
  );
  return layer?.route ? layer.route.stack.map((s) => s.handle) : null;
}

/** The ceiling has to run before the route's own handler, which is last. */
function expectCeiling(router: unknown, method: string, path: string, ceiling: unknown) {
  const handlers = handlersFor(router, method, path);
  expect(handlers).not.toBeNull();
  const at = handlers!.indexOf(ceiling);
  expect(at).toBeGreaterThanOrEqual(0);
  expect(at).toBeLessThan(handlers!.length - 1);
}

describe('Routes that start a payment', () => {
  const cases: Array<[string, unknown, string, string]> = [
    ['a generic Connect hold', connectRouter, 'post', '/escrow'],
    ['a gift balance top-up', creatorRouter, 'post', '/balance/purchase'],
    ['a mentor session booking', mentorRouter, 'post', '/:mentorId/book'],
    ['a membership checkout', subscriptionRouter, 'post', '/checkout'],
    ['an accelerator place', businessRouter, 'post', '/accelerators/enrollments/:id/payment'],
    ['a formation fee', formationRouter, 'post', '/:id/payment-intent'],
    // Submitting is where the fee's intent is first made.
    ['a formation submission', formationRouter, 'post', '/:id/submit'],
    ['an hourly booking', skillsMarketplaceRouter, 'post', '/services/:id/book'],
    ['a package order', skillsMarketplaceRouter, 'post', '/services/:id/order'],
    ['a renewed hold on an order', skillsMarketplaceRouter, 'post', '/orders/:id/payment/renew'],
  ];

  it.each(cases)('%s carries the payment ceiling', (_name, router, method, path) => {
    expectCeiling(router, method, path, startingAPayment);
  });
});

describe('Routes that send gifts', () => {
  it.each([
    ['a gift to a creator', creatorRouter, '/gifts/send'],
    ['a gift in a live stream', livestreamRouter, '/:id/gift'],
  ] as Array<[string, unknown, string]>)('%s carries the gift ceiling', (_name, router, path) => {
    expectCeiling(router, 'post', path, giftCeiling);
  });
});

describe('Routes that ask for a withdrawal', () => {
  it.each([
    ['a creator payout request', creatorRouter, '/payouts/request'],
    ['a Connect payout', connectRouter, '/payout'],
    ['a payout from the payments service', paymentsRouter, '/payout'],
  ] as Array<[string, unknown, string]>)('%s carries the payout ceiling', (_name, router, path) => {
    expectCeiling(router, 'post', path, payoutCeiling);
  });
});

describe('There is no open door for a charge', () => {
  it('has no generic POST /api/payments/process', () => {
    expect(handlersFor(paymentsRouter, 'post', '/process')).toBeNull();
  });
});
