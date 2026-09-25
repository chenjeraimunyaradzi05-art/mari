jest.mock('../../utils/prisma', () => ({
  prisma: {
    escrowPayment: {
      findMany: jest.fn(),
    },
    mentorSession: {
      findMany: jest.fn(async () => []),
    },
    user: {
      findMany: jest.fn(async () => []),
    },
    notification: {
      // The sweep checks for a notification it has already sent before sending
      // another, so this has to answer as well as create. Null is "nothing sent
      // recently", which is the state every test below wants unless it says
      // otherwise.
      findFirst: jest.fn(async () => null),
      create: jest.fn(async () => ({})),
    },
  },
}));

jest.mock('../../utils/redis', () => ({
  runExclusively: jest.fn(async (_key: string, fn: () => Promise<unknown>) => fn()),
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../stripe-connect.service', () => ({
  captureEscrowPayment: jest.fn(async () => ({ status: 'succeeded', amountCaptured: 1000 })),
}));

import { prisma } from '../../utils/prisma';
import { logger } from '../../utils/logger';
import * as stripeConnect from '../stripe-connect.service';
import { runEscrowExpirySweep } from '../escrow-expiry.service';

const prismaAny: any = prisma;
const captureMock = stripeConnect.captureEscrowPayment as jest.Mock;
const errorMock = logger.error as jest.Mock;
const warnMock = logger.warn as jest.Mock;

const NOW = new Date('2026-09-17T00:00:00.000Z');

const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);

const hold = (overrides: Record<string, unknown> = {}) => ({
  id: 'escrow-1',
  paymentIntentId: 'pi_1',
  buyerId: 'buyer-1',
  sellerId: 'seller-1',
  amount: 25000,
  currency: 'AUD',
  createdAt: daysAgo(6),
  description: 'Car inspection',
  ...overrides,
});

describe('Escrow holds approaching the end of their authorisation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.ESCROW_CAPTURE_BEFORE_EXPIRY;
  });

  it('warns about a hold that is close to lapsing without taking the money', async () => {
    prismaAny.escrowPayment.findMany.mockResolvedValue([hold()]);

    const result = await runEscrowExpirySweep(NOW);

    expect(result.expiringSoon).toBe(1);
    expect(result.captured).toBe(0);
    expect(captureMock).not.toHaveBeenCalled();
    expect(warnMock).toHaveBeenCalled();
  });

  it('reports a hold that has already outlived its authorisation as an error', async () => {
    prismaAny.escrowPayment.findMany.mockResolvedValue([hold({ createdAt: daysAgo(9) })]);

    const result = await runEscrowExpirySweep(NOW);

    expect(result.alreadyLapsed).toBe(1);
    expect(result.expiringSoon).toBe(0);
    expect(errorMock).toHaveBeenCalled();
  });

  it('captures early only when that has been switched on deliberately', async () => {
    process.env.ESCROW_CAPTURE_BEFORE_EXPIRY = 'true';
    prismaAny.escrowPayment.findMany.mockResolvedValue([hold()]);

    const result = await runEscrowExpirySweep(NOW);

    expect(result.captured).toBe(1);
    expect(captureMock).toHaveBeenCalledWith('pi_1', { id: 'system', role: 'ADMIN' });
  });

  it('counts a failed capture rather than letting it pass silently', async () => {
    process.env.ESCROW_CAPTURE_BEFORE_EXPIRY = 'true';
    prismaAny.escrowPayment.findMany.mockResolvedValue([hold()]);
    captureMock.mockRejectedValueOnce(new Error('card declined'));

    const result = await runEscrowExpirySweep(NOW);

    expect(result.failed).toBe(1);
    expect(result.captured).toBe(0);
    expect(errorMock).toHaveBeenCalled();
  });

  it('does not try to capture a hold with no payment intent behind it', async () => {
    process.env.ESCROW_CAPTURE_BEFORE_EXPIRY = 'true';
    prismaAny.escrowPayment.findMany.mockResolvedValue([hold({ paymentIntentId: null })]);

    const result = await runEscrowExpirySweep(NOW);

    expect(captureMock).not.toHaveBeenCalled();
    expect(result.expiringSoon).toBe(1);
  });

  // Mentor sessions booked before mentoring moved onto the shared escrow path
  // hold real money with no EscrowPayment row behind them. They were invisible
  // to this sweep, so a session booked a fortnight out lost its authorisation
  // in silence and the mentor was never paid.
  describe('mentor sessions with no escrow row', () => {
    const session = (overrides: Record<string, unknown> = {}) => ({
      id: 'session-1',
      stripePaymentIntentId: 'pi_session_1',
      sessionAmount: 180,
      currency: 'AUD',
      createdAt: daysAgo(6),
      ...overrides,
    });

    it('warns about one whose authorisation is about to lapse', async () => {
      prismaAny.escrowPayment.findMany.mockResolvedValue([]);
      prismaAny.mentorSession.findMany.mockResolvedValue([session()]);

      const result = await runEscrowExpirySweep(NOW);

      expect(result.checked).toBe(1);
      expect(result.expiringSoon).toBe(1);
      expect(warnMock).toHaveBeenCalled();
    });

    it('reports one that has already lapsed as an error', async () => {
      prismaAny.escrowPayment.findMany.mockResolvedValue([]);
      prismaAny.mentorSession.findMany.mockResolvedValue([session({ createdAt: daysAgo(9) })]);

      const result = await runEscrowExpirySweep(NOW);

      expect(result.alreadyLapsed).toBe(1);
      expect(errorMock).toHaveBeenCalled();
    });

    it('never captures one early, because nothing would record that the money moved', async () => {
      process.env.ESCROW_CAPTURE_BEFORE_EXPIRY = 'true';
      prismaAny.escrowPayment.findMany.mockResolvedValue([]);
      prismaAny.mentorSession.findMany.mockResolvedValue([session()]);

      const result = await runEscrowExpirySweep(NOW);

      expect(captureMock).not.toHaveBeenCalled();
      expect(result.captured).toBe(0);
    });

    it('counts a session that does have an escrow row only once', async () => {
      prismaAny.escrowPayment.findMany.mockResolvedValue([hold({ paymentIntentId: 'pi_session_1' })]);
      prismaAny.mentorSession.findMany.mockResolvedValue([session()]);

      const result = await runEscrowExpirySweep(NOW);

      expect(result.checked).toBe(1);
      expect(result.expiringSoon).toBe(1);
    });
  });

  it('tells administrators when holds have been lost', async () => {
    prismaAny.escrowPayment.findMany.mockResolvedValue([hold({ createdAt: daysAgo(9) })]);
    prismaAny.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);

    await runEscrowExpirySweep(NOW);

    expect(prismaAny.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'admin-1', type: 'SYSTEM' }),
      })
    );
  });

  // The escalation used to fire only once a hold had already outlived its
  // authorisation — that is, once the seller had most likely lost the money for
  // work she had already delivered. These two cover the warning that arrives
  // while somebody can still do something about it.
  describe('escalating while the money can still be collected', () => {
    it('tells administrators about a hold that is about to lapse, not only one that has', async () => {
      prismaAny.escrowPayment.findMany.mockResolvedValue([hold()]);
      prismaAny.mentorSession.findMany.mockResolvedValue([]);
      prismaAny.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);
      prismaAny.notification.findFirst.mockResolvedValue(null);

      const result = await runEscrowExpirySweep(NOW);

      expect(result.expiringSoon).toBe(1);
      expect(result.alreadyLapsed).toBe(0);
      expect(prismaAny.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'admin-1',
            title: 'Escrow holds are about to lapse',
          }),
        })
      );
    });

    it('does not raise the same condition again the same day', async () => {
      prismaAny.escrowPayment.findMany.mockResolvedValue([hold()]);
      prismaAny.mentorSession.findMany.mockResolvedValue([]);
      prismaAny.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);
      // The sweep runs every six hours and nothing in it resolves a hold, so
      // without this check one hold would notify every admin four times a day
      // until a human dealt with it.
      prismaAny.notification.findFirst.mockResolvedValue({ id: 'notif-1' });

      await runEscrowExpirySweep(NOW);

      expect(prismaAny.notification.create).not.toHaveBeenCalled();
    });
  });
});
