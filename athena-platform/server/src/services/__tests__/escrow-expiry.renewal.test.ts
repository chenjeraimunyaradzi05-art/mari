/**
 * A package can take longer to deliver than a card hold lasts. The one thing
 * that keeps the provider paid is the buyer authorising a fresh hold before the
 * first runs out, so that is what she is asked for, and not to "release" money
 * for work she has not been given. And when Stripe has said the real deadline of
 * an authorisation, that is the date the sweep and the notices use.
 */

jest.mock('../../utils/prisma', () => ({
  prisma: {
    escrowPayment: { findMany: jest.fn() },
    mentorSession: { findMany: jest.fn(async () => []), findUnique: jest.fn(async () => null), update: jest.fn(async () => ({})) },
    user: { findMany: jest.fn(async () => []) },
    notification: { findFirst: jest.fn(async () => null), create: jest.fn(async () => ({})) },
  },
}));

jest.mock('../../utils/redis', () => ({
  runExclusively: jest.fn(async (_key: string, fn: () => Promise<unknown>) => fn()),
}));

jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../stripe-connect.service', () => ({
  captureEscrowPayment: jest.fn(async () => ({ status: 'succeeded', amountCaptured: 1000 })),
  cancelEscrowPayment: jest.fn(async () => ({ status: 'canceled' })),
  PLATFORM_ESCROW_ACTOR: { id: 'system', role: 'ADMIN' },
  resolveLapsedEscrowHold: jest.fn(async () => ({ state: 'still_held' })),
  adoptUnledgeredMentorSessionHold: jest.fn(async () => true),
  createEscrowPayment: jest.fn(),
  minorUnitScale: () => 100,
}));

jest.mock('../../utils/stripe', () => ({
  isStripeConfigured: jest.fn(() => false),
}));

jest.mock('../stripe-reconciliation.service', () => ({
  startStripeReconciler: jest.fn(),
  stopStripeReconciler: jest.fn(),
}));

import { prisma } from '../../utils/prisma';
import * as stripeConnect from '../stripe-connect.service';
import { runEscrowExpirySweep } from '../escrow-expiry.service';

const prismaAny: any = prisma;
const captureMock = stripeConnect.captureEscrowPayment as jest.Mock;
const cancelMock = stripeConnect.cancelEscrowPayment as jest.Mock;
const resolveMock = stripeConnect.resolveLapsedEscrowHold as jest.Mock;

const NOW = new Date('2026-09-17T00:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY);
const inDays = (days: number) => new Date(NOW.getTime() + days * DAY).toISOString();

const hold = (overrides: Record<string, unknown> = {}) => ({
  id: 'escrow-1',
  paymentIntentId: 'pi_1',
  buyerId: 'buyer-1',
  sellerId: 'seller-1',
  amount: 25000,
  currency: 'AUD',
  createdAt: daysAgo(6),
  description: 'Logo design — Standard',
  status: 'AUTHORIZED',
  sessionType: null,
  metadata: null,
  serviceOrder: null,
  ...overrides,
});

const order = (status: string | undefined, overrides: Record<string, unknown> = {}) =>
  hold({ sessionType: 'service_order', serviceOrder: { id: 'order-7', status }, ...overrides });

const noticesTo = (userId: string) =>
  prismaAny.notification.create.mock.calls.map((call: any[]) => call[0].data).filter((d: any) => d.userId === userId);

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.ESCROW_CAPTURE_BEFORE_EXPIRY;
  prismaAny.mentorSession.findMany.mockResolvedValue([]);
  prismaAny.user.findMany.mockResolvedValue([]);
  prismaAny.notification.findFirst.mockResolvedValue(null);
  resolveMock.mockResolvedValue({ state: 'still_held' });
});

describe('Asking the buyer to renew the hold behind an order still being worked on', () => {
  it.each(['PENDING', 'ACCEPTED', 'REVISION_REQUESTED'])(
    'asks her to renew, not to release, while the order is %s',
    async (status) => {
      prismaAny.escrowPayment.findMany.mockResolvedValue([order(status)]);

      const result = await runEscrowExpirySweep(NOW);

      expect(result.renewalsRequested).toBe(1);
      expect(result.buyersReminded).toBe(0);
      const [notice] = noticesTo('buyer-1');
      expect(notice.title).toBe('Your payment hold needs renewing');
      expect(notice.link).toBe('/skills-marketplace/orders/order-7');
      expect(notice.data).toMatchObject({ kind: 'ESCROW_RENEW_REQUEST', orderId: 'order-7', why: 'lapsing' });
      // The day it runs out, in Queensland time, and what renewing does and does not do.
      expect(notice.message).toMatch(/18 September/);
      expect(notice.message).toMatch(/nothing is taken/i);
      expect(notice.message).not.toMatch(/release it by/i);
    }
  );

  it('asks whether or not early capture is switched on, because early capture never takes undelivered work', async () => {
    process.env.ESCROW_CAPTURE_BEFORE_EXPIRY = 'true';
    prismaAny.escrowPayment.findMany.mockResolvedValue([order('ACCEPTED')]);

    const result = await runEscrowExpirySweep(NOW);

    expect(result.renewalsRequested).toBe(1);
    expect(captureMock).not.toHaveBeenCalled();
  });

  it('still asks her to release a delivered order, which is the other thing a lapsing hold needs', async () => {
    prismaAny.escrowPayment.findMany.mockResolvedValue([order('DELIVERED')]);

    const result = await runEscrowExpirySweep(NOW);

    expect(result.renewalsRequested).toBe(0);
    expect(result.buyersReminded).toBe(1);
  });

  it('asks about the same order once a day, not on every sweep', async () => {
    prismaAny.escrowPayment.findMany.mockResolvedValue([order('ACCEPTED')]);
    prismaAny.notification.findFirst.mockResolvedValue({ id: 'asked-this-morning' });

    const result = await runEscrowExpirySweep(NOW);

    expect(result.renewalsRequested).toBe(0);
    expect(noticesTo('buyer-1')).toHaveLength(0);
  });

  it('does not ask her to renew a hold she never authorised', async () => {
    prismaAny.escrowPayment.findMany.mockResolvedValue([order('PENDING', { status: 'PENDING' })]);

    expect((await runEscrowExpirySweep(NOW)).renewalsRequested).toBe(0);
  });

  it('gives back the hold on a cancelled order instead of asking her to renew it', async () => {
    prismaAny.escrowPayment.findMany.mockResolvedValue([order('CANCELLED')]);

    const result = await runEscrowExpirySweep(NOW);

    expect(result.renewalsRequested).toBe(0);
    expect(cancelMock).toHaveBeenCalled();
  });
});

describe('When Stripe has said the real deadline', () => {
  const withDeadline = (createdDaysAgo: number, deadlineInDays: number) =>
    hold({ createdAt: daysAgo(createdDaysAgo), metadata: { captureBefore: inDays(deadlineInDays) } });

  it('warns by Stripe’s deadline, which can be sooner than seven days after the hold was made', async () => {
    // Three days old, so the seven-day assumption would say four days to go and
    // say nothing; Stripe says it ends tomorrow.
    prismaAny.escrowPayment.findMany.mockResolvedValue([withDeadline(3, 1)]);

    const result = await runEscrowExpirySweep(NOW);

    expect(result.expiringSoon).toBe(1);
  });

  it('says nothing about a three-day-old hold with no recorded deadline, as before', async () => {
    prismaAny.escrowPayment.findMany.mockResolvedValue([hold({ createdAt: daysAgo(3) })]);

    const result = await runEscrowExpirySweep(NOW);

    expect(result.expiringSoon).toBe(0);
    expect(result.checked).toBe(0);
  });

  it('leaves a hold alone that Stripe says is good for another week', async () => {
    prismaAny.escrowPayment.findMany.mockResolvedValue([withDeadline(6, 7)]);

    expect((await runEscrowExpirySweep(NOW)).expiringSoon).toBe(0);
  });

  it('treats a hold past Stripe’s deadline as lapsed even though it is not seven days old', async () => {
    prismaAny.escrowPayment.findMany.mockResolvedValue([withDeadline(4, -1)]);

    expect((await runEscrowExpirySweep(NOW)).alreadyLapsed).toBe(1);
  });

  it('names Stripe’s date, not the seven-day one, when it asks her to renew', async () => {
    prismaAny.escrowPayment.findMany.mockResolvedValue([
      order('ACCEPTED', { createdAt: daysAgo(3), metadata: { captureBefore: inDays(1) } }),
    ]);

    await runEscrowExpirySweep(NOW);

    // Created three days before the 17th the seven-day rule would say the 21st.
    expect(noticesTo('buyer-1')[0].message).toMatch(/18 September/);
  });

  it('ignores a recorded deadline that cannot be right', async () => {
    // A year out is not an authorisation; the seven-day assumption stands.
    prismaAny.escrowPayment.findMany.mockResolvedValue([hold({ createdAt: daysAgo(6), metadata: { captureBefore: inDays(400) } })]);

    expect((await runEscrowExpirySweep(NOW)).expiringSoon).toBe(1);
  });
});

describe('A hold that has already run out under an order still being worked on', () => {
  it('tells the buyer how to renew and the provider to wait, instead of only that a person has been told', async () => {
    prismaAny.escrowPayment.findMany.mockResolvedValue([order('ACCEPTED', { createdAt: daysAgo(9) })]);
    resolveMock.mockResolvedValueOnce({ state: 'expired', changed: true });

    await runEscrowExpirySweep(NOW);

    const [buyer] = noticesTo('buyer-1');
    expect(buyer.title).toBe('A payment hold on your card has expired');
    expect(buyer.message).toMatch(/renew it from the order page/i);
    const [seller] = noticesTo('seller-1');
    expect(seller.message).toMatch(/wait for that before you hand the work over/i);
  });

  it('says what it always said for a hold with no order to renew it for', async () => {
    prismaAny.escrowPayment.findMany.mockResolvedValue([hold({ createdAt: daysAgo(9) })]);
    resolveMock.mockResolvedValueOnce({ state: 'expired', changed: true });

    await runEscrowExpirySweep(NOW);

    expect(noticesTo('buyer-1')[0].message).toMatch(/ATHENA's team has been told/);
  });
});
