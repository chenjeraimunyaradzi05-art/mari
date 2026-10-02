import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/**
 * A mentoring session or a marketplace order a buyer says was not delivered.
 *
 * Only a car purchase and an hourly booking had a way to say so. A mentor closing
 * a session took the mentee's card at once and a buyer who thought a delivery was
 * wrong could ask for a revision or let the hold lapse. What is pinned here is the
 * rule the whole flow stands on: while a dispute is open nothing is captured, the
 * buyer cannot approve, the provider cannot deliver, and only a member of staff
 * decides, releasing the payment or giving it back, once, with a record of who.
 */

jest.mock('../../utils/prisma', () => {
  const prisma: any = {
    serviceOrder: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findMany: jest.fn(async () => []),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    skillService: { update: jest.fn(async () => ({})) },
    mentorSession: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findMany: jest.fn(async () => []),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    mentorProfile: { update: jest.fn(async () => ({})), updateMany: jest.fn(async () => ({ count: 1 })) },
    escrowPayment: { findUnique: jest.fn(), findMany: jest.fn(async () => []) },
    paymentDispute: { findMany: jest.fn(async () => []) },
    notification: { create: jest.fn(async () => ({})) },
    $transaction: jest.fn(async (work: (tx: unknown) => Promise<unknown>) => work(prisma)),
  };
  return { prisma };
});

jest.mock('../../services/stripe-connect.service', () => ({
  createEscrowPayment: jest.fn(),
  captureEscrowPayment: jest.fn(async () => ({ status: 'captured' })),
  cancelEscrowPayment: jest.fn(async () => ({ status: 'refunded' })),
  getEscrowClientSecret: jest.fn(async () => 'pi_1_secret'),
  openCardDisputeOn: jest.fn(async () => null),
  PLATFORM_ESCROW_ACTOR: { id: 'system', role: 'ADMIN' },
  stripeConnectService: {},
}));

jest.mock('../../services/mentor-payment-release.service', () => ({
  captureSessionHold: jest.fn(async () => ({ capturedAt: new Date() })),
  cancelSessionHold: jest.fn(async () => undefined),
  paymentReleaseTimeFor: jest.fn(() => null),
  releaseDueMentorSessions: jest.fn(async () => ({ released: 0, failed: 0 })),
}));

jest.mock('../../services/admin-notify.service', () => ({ notifyAdmins: jest.fn(async () => 1) }));
jest.mock('../../services/admin-audit.service', () => ({
  ...(jest.requireActual('../../services/admin-audit.service') as object),
  auditAfterCommit: jest.fn(async () => undefined),
  recordAdminAction: jest.fn(async () => undefined),
}));

// The caller's id and role come from headers so one suite can be buyer, provider or staff.
jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: req.headers['x-test-user'] || 'buyer', role: req.headers['x-test-role'] || 'USER', email: 'x@athena.com' };
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
import { cancelEscrowPayment, captureEscrowPayment, openCardDisputeOn } from '../../services/stripe-connect.service';
import { cancelSessionHold, captureSessionHold } from '../../services/mentor-payment-release.service';
import { notifyAdmins } from '../../services/admin-notify.service';
import { recordAdminAction } from '../../services/admin-audit.service';

const prisma: any = prismaTyped;
const as = (userId: string, role = 'USER') => ({ 'x-test-user': userId, 'x-test-role': role });
const staff = as('staff-1', 'ADMIN');

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// Admin routes carry the row's id in the path and refuse anything that is not one.
const ORDER_ID = '11111111-1111-4111-8111-111111111111';
const SESSION_ID = '22222222-2222-4222-8222-222222222222';

const orderRow = (status: string, over: Record<string, unknown> = {}) => ({
  id: ORDER_ID,
  clientId: 'buyer',
  serviceId: 'svc-1',
  status,
  dueAt: new Date(Date.now() + 3 * DAY),
  totalAmount: 300,
  providerPayout: 255,
  packageName: 'Standard',
  deliveredAt: new Date(),
  disputeResponse: null,
  service: { id: 'svc-1', title: 'Brand identity', providerId: 'seller' },
  escrow: { status: 'AUTHORIZED', paymentIntentId: 'pi_order' },
  ...over,
});

const sessionRow = (status: string, over: Record<string, unknown> = {}) => ({
  id: SESSION_ID,
  menteeId: 'mentee',
  mentorProfileId: 'mp-1',
  status,
  scheduledAt: new Date(Date.now() - 2 * DAY),
  durationMinutes: 60,
  sessionAmount: 90,
  currency: 'AUD',
  paymentStatus: 'AUTHORIZED',
  paymentCapturedAt: null,
  completedAt: null,
  stripePaymentIntentId: 'pi_session',
  disputeResponse: null,
  mentorProfile: { userId: 'mentor' },
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  prisma.serviceOrder.updateMany.mockResolvedValue({ count: 1 });
  prisma.mentorSession.updateMany.mockResolvedValue({ count: 1 });
  prisma.mentorProfile.updateMany.mockResolvedValue({ count: 1 });
  prisma.serviceOrder.findUniqueOrThrow.mockImplementation(async () => ({ id: ORDER_ID, status: 'DISPUTED', disputeResolvedById: 'staff-1' }));
  prisma.mentorSession.findUniqueOrThrow.mockImplementation(async () => ({ id: SESSION_ID, status: 'DISPUTED', disputeResolvedById: 'staff-1' }));
  prisma.escrowPayment.findUnique.mockResolvedValue({ id: 'esc-1', status: 'AUTHORIZED' });
  (openCardDisputeOn as any).mockResolvedValue(null);
});

describe('A buyer disputes a marketplace order', () => {
  const dispute = (id = ORDER_ID, userId = 'buyer', reason = 'The logo files I paid for never arrived.') =>
    request(app).post(`/api/skills-marketplace/orders/${id}/dispute`).set(as(userId)).send({ reason });

  it('puts a delivered order in dispute, keeps the hold exactly where it is, and tells the provider and the team', async () => {
    prisma.serviceOrder.findUnique.mockResolvedValue(orderRow('DELIVERED'));

    const res = await dispute().expect(201);

    // Conditional on the status just read, and nothing else changes.
    expect(prisma.serviceOrder.updateMany).toHaveBeenCalledWith({
      where: { id: ORDER_ID, status: 'DELIVERED' },
      data: expect.objectContaining({ status: 'DISPUTED', disputeReason: 'The logo files I paid for never arrived.', disputedAt: expect.any(Date) }),
    });
    expect(captureEscrowPayment).not.toHaveBeenCalled();
    expect(cancelEscrowPayment).not.toHaveBeenCalled();
    expect(prisma.notification.create.mock.calls[0][0].data).toMatchObject({ userId: 'seller', title: 'An order is in dispute' });
    expect(notifyAdmins).toHaveBeenCalledWith(expect.objectContaining({ link: '/admin/service-disputes' }));
    // Who on the team decided it is the team's business, not the buyer's.
    expect(res.body.data).not.toHaveProperty('disputeResolvedById');
  });

  it('lets her dispute an order whose due date has passed with nothing delivered, and not one that is still on time', async () => {
    prisma.serviceOrder.findUnique.mockResolvedValue(orderRow('ACCEPTED', { dueAt: new Date(Date.now() - DAY) }));
    await dispute().expect(201);

    prisma.serviceOrder.updateMany.mockClear();
    prisma.serviceOrder.findUnique.mockResolvedValue(orderRow('ACCEPTED'));
    const early = await dispute().expect(400);
    expect(early.body.message).toMatch(/not due yet/);
    expect(prisma.serviceOrder.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    ['PENDING', /has not accepted/],
    ['COMPLETED', /approved this order/],
    ['CANCELLED', /was cancelled/],
  ])('refuses an order that is %s, and says why', async (status, why) => {
    prisma.serviceOrder.findUnique.mockResolvedValue(orderRow(status));

    const res = await dispute().expect(400);

    expect(res.body.message).toMatch(why);
    expect(prisma.serviceOrder.updateMany).not.toHaveBeenCalled();
  });

  it('answers a stranger as if the order did not exist', async () => {
    prisma.serviceOrder.findUnique.mockResolvedValue(orderRow('DELIVERED'));

    await dispute(ORDER_ID, 'somebody-else').expect(404);
    await dispute(ORDER_ID, 'seller').expect(404);

    expect(prisma.serviceOrder.updateMany).not.toHaveBeenCalled();
  });

  it('is one dispute when it is asked twice, and refuses a hold that has ended or an order with no payment behind it', async () => {
    prisma.serviceOrder.findUnique.mockResolvedValue(orderRow('DISPUTED'));
    await dispute().expect(409);

    prisma.serviceOrder.findUnique.mockResolvedValue(orderRow('DELIVERED', { escrow: { status: 'CANCELED', paymentIntentId: 'pi_order' } }));
    const lapsed = await dispute().expect(409);
    expect(lapsed.body.message).toMatch(/hold on your card has ended/);

    prisma.serviceOrder.findUnique.mockResolvedValue(orderRow('DELIVERED', { escrow: null }));
    await dispute().expect(409);

    expect(prisma.serviceOrder.updateMany).not.toHaveBeenCalled();
  });

  it('does not write over an order the provider changed while the dispute was being filed', async () => {
    prisma.serviceOrder.findUnique.mockResolvedValue(orderRow('DELIVERED'));
    prisma.serviceOrder.updateMany.mockResolvedValue({ count: 0 });

    await dispute().expect(409);

    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(notifyAdmins).not.toHaveBeenCalled();
  });

  it('asks what went wrong: an empty reason is refused', async () => {
    prisma.serviceOrder.findUnique.mockResolvedValue(orderRow('DELIVERED'));

    await request(app).post(`/api/skills-marketplace/orders/${ORDER_ID}/dispute`).set(as('buyer')).send({ reason: '   ' }).expect(400);
    await request(app).post(`/api/skills-marketplace/orders/${ORDER_ID}/dispute`).set(as('buyer')).send({}).expect(400);

    expect(prisma.serviceOrder.updateMany).not.toHaveBeenCalled();
  });
});

describe('While an order is in dispute nothing moves the money but the team', () => {
  beforeEach(() => {
    prisma.serviceOrder.findUnique.mockResolvedValue({
      ...orderRow('DISPUTED'),
      client: { id: 'buyer', displayName: 'Buyer', avatar: null },
      escrow: { id: 'esc-1', status: 'AUTHORIZED', paymentIntentId: 'pi_order', amount: 30000, currency: 'aud', capturedAt: null, canceledAt: null, createdAt: new Date(), metadata: null },
      attachments: [],
    });
  });

  it.each([
    ['buyer', 'complete', {}],
    ['buyer', 'revision', { reason: 'Please change it' }],
    ['buyer', 'cancel', {}],
    ['seller', 'deliver', { message: 'Here it is' }],
    ['seller', 'cancel', {}],
    ['seller', 'accept', {}],
  ])('closes %s’s %s button', async (who, action, body) => {
    await request(app).post(`/api/skills-marketplace/orders/${ORDER_ID}/${action}`).set(as(who)).send(body).expect(400);

    expect(captureEscrowPayment).not.toHaveBeenCalled();
    expect(cancelEscrowPayment).not.toHaveBeenCalled();
    expect(prisma.serviceOrder.updateMany).not.toHaveBeenCalled();
  });

  it('shows both people the dispute and whether the buyer’s bank has also questioned the payment', async () => {
    (openCardDisputeOn as any).mockResolvedValue({ stripeDisputeId: 'dp_1', evidenceDueBy: null });

    const res = await request(app).get(`/api/skills-marketplace/orders/${ORDER_ID}`).set(as('seller')).expect(200);

    expect(res.body.data).toMatchObject({ status: 'DISPUTED', cardDisputeOpen: true, viewerRole: 'provider' });
    expect(res.body.data).not.toHaveProperty('disputeResolvedById');
  });
});

describe('A provider answers an order in dispute', () => {
  const answer = (userId = 'seller', response = 'The files were delivered on the 3rd; here is the link.') =>
    request(app).post(`/api/skills-marketplace/orders/${ORDER_ID}/dispute/respond`).set(as(userId)).send({ response });

  it('records one answer for the team to read, and tells the team', async () => {
    prisma.serviceOrder.findUnique.mockResolvedValue(orderRow('DISPUTED'));

    await answer().expect(200);

    expect(prisma.serviceOrder.updateMany).toHaveBeenCalledWith({
      where: { id: ORDER_ID, status: 'DISPUTED', disputeResponse: null },
      data: expect.objectContaining({ disputeResponse: 'The files were delivered on the 3rd; here is the link.', disputeRespondedAt: expect.any(Date) }),
    });
    expect(notifyAdmins).toHaveBeenCalledWith(expect.objectContaining({ title: 'A provider answered an order dispute' }));
  });

  it('is open only to the provider, once, and only while the order is in dispute', async () => {
    prisma.serviceOrder.findUnique.mockResolvedValue(orderRow('DISPUTED'));
    await answer('buyer').expect(404);

    prisma.serviceOrder.findUnique.mockResolvedValue(orderRow('DISPUTED', { disputeResponse: 'Already said.' }));
    await answer().expect(409);

    prisma.serviceOrder.findUnique.mockResolvedValue(orderRow('DELIVERED'));
    await answer().expect(409);

    expect(prisma.serviceOrder.updateMany).not.toHaveBeenCalled();
  });
});

describe('A mentee disputes a mentoring session', () => {
  const dispute = (userId = 'mentee', reason = 'My mentor never joined the call.') =>
    request(app).post(`/api/mentors/sessions/${SESSION_ID}/dispute`).set(as(userId)).send({ reason });

  it('puts a session whose hour has passed in dispute without touching the card hold', async () => {
    prisma.mentorSession.findUnique.mockResolvedValue(sessionRow('CONFIRMED'));

    const res = await dispute().expect(201);

    expect(prisma.mentorSession.updateMany).toHaveBeenCalledWith({
      where: { id: SESSION_ID, status: 'CONFIRMED', disputedAt: null },
      data: expect.objectContaining({ status: 'DISPUTED', disputeReason: 'My mentor never joined the call.' }),
    });
    expect(captureSessionHold).not.toHaveBeenCalled();
    expect(cancelSessionHold).not.toHaveBeenCalled();
    expect(prisma.notification.create.mock.calls[0][0].data).toMatchObject({ userId: 'mentor', title: 'A session is in dispute' });
    expect(notifyAdmins).toHaveBeenCalledWith(expect.objectContaining({ link: '/admin/service-disputes' }));
    expect(res.body.data).not.toHaveProperty('disputeResolvedById');
  });

  it('is open to her in the window after her mentor marks the session complete, which is the point of the window', async () => {
    prisma.mentorSession.findUnique.mockResolvedValue(sessionRow('COMPLETED', { paymentStatus: 'AUTHORIZED', completedAt: new Date() }));

    await dispute().expect(201);

    expect(prisma.mentorSession.updateMany.mock.calls[0][0].where).toEqual({ id: SESSION_ID, status: 'COMPLETED', disputedAt: null });
  });

  it('stays open for two weeks after the card was charged, and not for longer', async () => {
    prisma.mentorSession.findUnique.mockResolvedValue(
      sessionRow('COMPLETED', { paymentStatus: 'CAPTURED', paymentCapturedAt: new Date(Date.now() - 10 * DAY), completedAt: new Date(Date.now() - 10 * DAY) })
    );
    await dispute().expect(201);

    prisma.mentorSession.updateMany.mockClear();
    prisma.mentorSession.findUnique.mockResolvedValue(
      sessionRow('COMPLETED', { paymentStatus: 'CAPTURED', paymentCapturedAt: new Date(Date.now() - 30 * DAY), completedAt: new Date(Date.now() - 30 * DAY) })
    );
    const late = await dispute().expect(400);
    expect(late.body.message).toMatch(/contact support/);
    expect(prisma.mentorSession.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    ['a session that has not happened yet', sessionRow('CONFIRMED', { scheduledAt: new Date(Date.now() + DAY) }), /has not happened yet/],
    ['a request the mentor never accepted', sessionRow('REQUESTED'), /has not accepted/],
    ['a cancelled session', sessionRow('CANCELED'), /was cancelled/],
    ['a free session', sessionRow('CONFIRMED', { sessionAmount: 0, stripePaymentIntentId: null }), /Nothing was paid/],
    ['a session whose payment never went through', sessionRow('COMPLETED', { paymentStatus: 'FAILED' }), /Nothing was taken/],
  ])('refuses %s, and says why', async (_name, row, why) => {
    prisma.mentorSession.findUnique.mockResolvedValue(row);

    const res = await dispute().expect(400);

    expect(res.body.message).toMatch(why);
    expect(prisma.mentorSession.updateMany).not.toHaveBeenCalled();
  });

  it('answers anybody but the mentee as if the session did not exist, and is one dispute when asked twice', async () => {
    prisma.mentorSession.findUnique.mockResolvedValue(sessionRow('CONFIRMED'));
    await dispute('mentor').expect(404);
    await dispute('stranger').expect(404);

    prisma.mentorSession.findUnique.mockResolvedValue(sessionRow('DISPUTED'));
    await dispute().expect(409);

    expect(prisma.mentorSession.updateMany).not.toHaveBeenCalled();
  });

  it('does not write over a session its mentor just completed', async () => {
    prisma.mentorSession.findUnique.mockResolvedValue(sessionRow('CONFIRMED'));
    prisma.mentorSession.updateMany.mockResolvedValue({ count: 0 });

    await dispute().expect(409);

    expect(notifyAdmins).not.toHaveBeenCalled();
  });

  it('lets the mentor give her side once', async () => {
    const answer = (userId: string) =>
      request(app).post(`/api/mentors/sessions/${SESSION_ID}/dispute/respond`).set(as(userId)).send({ response: 'We spoke for the full hour.' });

    prisma.mentorSession.findUnique.mockResolvedValue(sessionRow('DISPUTED'));
    await answer('mentee').expect(404);
    await answer('mentor').expect(200);
    expect(prisma.mentorSession.updateMany).toHaveBeenCalledWith({
      where: { id: SESSION_ID, status: 'DISPUTED', disputeResponse: null },
      data: expect.objectContaining({ disputeResponse: 'We spoke for the full hour.' }),
    });

    prisma.mentorSession.findUnique.mockResolvedValue(sessionRow('DISPUTED', { disputeResponse: 'Already said.' }));
    await answer('mentor').expect(409);
  });
});

describe('The team’s side of a dispute', () => {
  const resolve = (kind: 'order' | 'session', id: string, outcome: string, note?: string, headers = staff) =>
    request(app).post(`/api/payments/admin/service-disputes/${kind}/${id}/resolve`).set(headers).send({ outcome, ...(note ? { note } : {}) });

  describe('listing what is waiting', () => {
    it('shows each dispute with what was said, the figures, and whether and until when the money can still move', async () => {
      const disputedAt = new Date(Date.now() - DAY);
      prisma.serviceOrder.findMany.mockResolvedValue([
        {
          id: ORDER_ID,
          packageName: 'Standard',
          totalAmount: 300,
          providerPayout: 255,
          disputedAt,
          disputeReason: 'Never arrived.',
          disputeResponse: 'It did.',
          disputeRespondedAt: new Date(),
          client: { id: 'buyer', displayName: 'Buyer B' },
          service: { title: 'Brand identity', provider: { id: 'seller', displayName: 'Seller S' } },
          escrow: { status: 'AUTHORIZED', createdAt: new Date(Date.now() - 3 * DAY), metadata: null, paymentIntentId: 'pi_order' },
        },
      ]);
      prisma.mentorSession.findMany.mockResolvedValue([
        {
          id: SESSION_ID,
          scheduledAt: new Date(Date.now() - 2 * DAY),
          durationMinutes: 60,
          sessionAmount: 90,
          mentorPayout: 72,
          currency: 'AUD',
          stripePaymentIntentId: 'pi_session',
          disputedAt: new Date(Date.now() - 2 * DAY),
          disputeReason: 'No show.',
          disputeResponse: null,
          disputeRespondedAt: null,
          mentee: { id: 'mentee', displayName: 'Mentee M' },
          mentorProfile: { user: { id: 'mentor', displayName: 'Mentor X' } },
        },
      ]);
      prisma.escrowPayment.findMany.mockResolvedValue([
        { status: 'CAPTURED', createdAt: new Date(Date.now() - 4 * DAY), metadata: null, paymentIntentId: 'pi_session' },
      ]);
      prisma.paymentDispute.findMany.mockResolvedValue([{ paymentIntentId: 'pi_session', stripeDisputeId: 'dp_9', evidenceDueBy: null }]);

      const res = await request(app).get('/api/payments/admin/service-disputes').set(staff).expect(200);

      const [first, second] = res.body.data.disputes;
      // Oldest first: the one that has waited longest is nearest to lapsing.
      expect(first).toMatchObject({
        kind: 'session',
        id: SESSION_ID,
        buyer: { name: 'Mentee M' },
        provider: { name: 'Mentor X' },
        amount: 90,
        providerPayout: 72,
        reason: 'No show.',
        response: null,
        hold: { status: 'CAPTURED', lapsesAt: null },
        cardDispute: { stripeDisputeId: 'dp_9' },
      });
      expect(second).toMatchObject({
        kind: 'order',
        id: ORDER_ID,
        title: 'Brand identity · Standard',
        amount: 300,
        response: 'It did.',
        cardDispute: null,
      });
      // A live hold says when it stops being collectable.
      expect(new Date(second.hold.lapsesAt).getTime()).toBeGreaterThan(Date.now());
    });

    it('is staff only', async () => {
      await request(app).get('/api/payments/admin/service-disputes').set(as('buyer')).expect(403);
      expect(prisma.serviceOrder.findMany).not.toHaveBeenCalled();
    });
  });

  describe('deciding an order', () => {
    const disputed = (over: Record<string, unknown> = {}) => orderRow('DISPUTED', over);

    it('releases the payment to the provider: the held money is taken as staff, the order is completed, both are told, and it is audited', async () => {
      prisma.serviceOrder.findUnique.mockResolvedValue(disputed());

      const res = await resolve('order', ORDER_ID, 'release', 'Delivery was fine.').expect(200);

      expect(captureEscrowPayment).toHaveBeenCalledWith('pi_order', { id: 'staff-1', role: 'ADMIN' });
      expect(prisma.serviceOrder.updateMany).toHaveBeenCalledWith({
        where: { id: ORDER_ID, status: 'DISPUTED' },
        data: expect.objectContaining({ status: 'COMPLETED', disputeResolution: 'RELEASED', disputeResolvedById: 'staff-1' }),
      });
      expect(prisma.skillService.update).toHaveBeenCalledWith({ where: { id: 'svc-1' }, data: { completedCount: { increment: 1 } } });
      const told = prisma.notification.create.mock.calls.map((c: any) => c[0].data.userId);
      expect(told).toEqual(expect.arrayContaining(['buyer', 'seller']));
      expect(recordAdminAction).toHaveBeenCalledWith(
        expect.anything(),
        'SERVICE_ORDER_DISPUTE_RESOLVED',
        expect.objectContaining({ resourceType: 'ServiceOrder', resourceId: ORDER_ID, targetUserId: 'buyer', outcome: 'released_to_provider' })
      );
      expect(res.body.data).toMatchObject({ kind: 'order', outcome: 'release' });
    });

    it('does not take the money twice: a payment already released is closed as paid, not captured again', async () => {
      prisma.serviceOrder.findUnique.mockResolvedValue(disputed({ escrow: { status: 'CAPTURED', paymentIntentId: 'pi_order' } }));
      prisma.escrowPayment.findUnique.mockResolvedValue({ id: 'esc-1', status: 'CAPTURED' });

      await resolve('order', ORDER_ID, 'release').expect(200);

      expect(captureEscrowPayment).not.toHaveBeenCalled();
      expect(prisma.serviceOrder.updateMany.mock.calls[0][0].data).toMatchObject({ status: 'COMPLETED' });
    });

    it('gives the payment back to the buyer: the hold is released, the order is cancelled with the team’s note, nothing is paid out', async () => {
      prisma.serviceOrder.findUnique.mockResolvedValue(disputed());

      await resolve('order', ORDER_ID, 'refund', 'Nothing was delivered.').expect(200);

      expect(cancelEscrowPayment).toHaveBeenCalledWith('pi_order', { id: 'staff-1', role: 'ADMIN' }, 'Nothing was delivered.');
      expect(captureEscrowPayment).not.toHaveBeenCalled();
      expect(prisma.serviceOrder.updateMany.mock.calls[0][0].data).toMatchObject({
        status: 'CANCELLED',
        cancellationReason: 'Nothing was delivered.',
        disputeResolution: 'REFUNDED',
      });
      expect(prisma.skillService.update).not.toHaveBeenCalled();
    });

    it('refunds a payment that was already taken, through the escrow service, which reverses the provider’s share', async () => {
      prisma.serviceOrder.findUnique.mockResolvedValue(disputed({ escrow: { status: 'CAPTURED', paymentIntentId: 'pi_order' } }));
      prisma.escrowPayment.findUnique.mockResolvedValue({ id: 'esc-1', status: 'CAPTURED' });

      await resolve('order', ORDER_ID, 'refund').expect(200);

      expect(cancelEscrowPayment).toHaveBeenCalledWith('pi_order', { id: 'staff-1', role: 'ADMIN' }, expect.any(String));
    });

    it('never refunds a payment the buyer’s bank is also disputing: that could return the money twice', async () => {
      prisma.serviceOrder.findUnique.mockResolvedValue(disputed({ escrow: { status: 'CAPTURED', paymentIntentId: 'pi_order' } }));
      (openCardDisputeOn as any).mockResolvedValue({ stripeDisputeId: 'dp_77', evidenceDueBy: null });

      const res = await resolve('order', ORDER_ID, 'refund').expect(409);

      expect(res.body.message).toContain('dp_77');
      expect(cancelEscrowPayment).not.toHaveBeenCalled();
      expect(prisma.serviceOrder.updateMany).not.toHaveBeenCalled();
      expect(recordAdminAction).not.toHaveBeenCalled();
    });

    it('cannot release a hold that has ended, but can close the dispute by giving it back without asking Stripe again', async () => {
      prisma.serviceOrder.findUnique.mockResolvedValue(disputed({ escrow: { status: 'CANCELED', paymentIntentId: 'pi_order' } }));
      prisma.escrowPayment.findUnique.mockResolvedValue({ id: 'esc-1', status: 'CANCELED' });

      const release = await resolve('order', ORDER_ID, 'release').expect(409);
      expect(release.body.message).toMatch(/hold on the buyer’s card has ended/);
      expect(captureEscrowPayment).not.toHaveBeenCalled();
      expect(prisma.serviceOrder.updateMany).not.toHaveBeenCalled();

      await resolve('order', ORDER_ID, 'refund').expect(200);
      expect(cancelEscrowPayment).not.toHaveBeenCalled();
      expect(prisma.serviceOrder.updateMany.mock.calls[0][0].data).toMatchObject({ status: 'CANCELLED' });
    });

    it('leaves the dispute open and says why when Stripe refuses the capture', async () => {
      prisma.serviceOrder.findUnique.mockResolvedValue(disputed());
      (captureEscrowPayment as any).mockRejectedValueOnce(Object.assign(new Error('Failed to capture payment'), { statusCode: 500 }));

      await resolve('order', ORDER_ID, 'release').expect(500);

      expect(prisma.serviceOrder.updateMany).not.toHaveBeenCalled();
      expect(recordAdminAction).not.toHaveBeenCalled();
    });

    it('decides a dispute once: an order not in dispute, or decided by somebody else a moment ago, is refused', async () => {
      prisma.serviceOrder.findUnique.mockResolvedValue(orderRow('DELIVERED'));
      await resolve('order', ORDER_ID, 'release').expect(409);
      expect(captureEscrowPayment).not.toHaveBeenCalled();

      prisma.serviceOrder.findUnique.mockResolvedValue(disputed());
      prisma.serviceOrder.updateMany.mockResolvedValue({ count: 0 });
      const raced = await resolve('order', ORDER_ID, 'refund').expect(409);
      expect(raced.body.message).toMatch(/decided by somebody else/);
      expect(recordAdminAction).not.toHaveBeenCalled();
    });

    it('asks for a real decision on a real order, from staff', async () => {
      await resolve('order', ORDER_ID, 'maybe').expect(400);
      await resolve('order', 'not-an-id', 'release').expect(400);
      await resolve('invoice' as never, ORDER_ID, 'release').expect(400);
      await resolve('order', ORDER_ID, 'release', undefined, as('seller')).expect(403);

      expect(captureEscrowPayment).not.toHaveBeenCalled();
      expect(prisma.serviceOrder.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('deciding a session', () => {
    const disputed = (over: Record<string, unknown> = {}) => sessionRow('DISPUTED', over);

    it('releases a held payment to the mentor, and counts the hour she gave, once', async () => {
      prisma.mentorSession.findUnique.mockResolvedValue(disputed());

      await resolve('session', SESSION_ID, 'release').expect(200);

      expect(captureEscrowPayment).toHaveBeenCalledWith('pi_session', { id: 'staff-1', role: 'ADMIN' });
      expect(prisma.mentorSession.updateMany).toHaveBeenCalledWith({
        where: { id: SESSION_ID, status: 'DISPUTED' },
        data: expect.objectContaining({ status: 'COMPLETED', disputeResolution: 'RELEASED', paymentStatus: 'CAPTURED', paymentReleaseAt: null }),
      });
      expect(prisma.mentorProfile.update).toHaveBeenCalledWith({ where: { id: 'mp-1' }, data: { sessionCount: { increment: 1 } } });
      expect(recordAdminAction).toHaveBeenCalledWith(
        expect.anything(),
        'MENTOR_SESSION_DISPUTE_RESOLVED',
        expect.objectContaining({ resourceType: 'MentorSession', targetUserId: 'mentee', providerId: 'mentor', outcome: 'released_to_provider' })
      );
    });

    it('does not count an hour twice when the mentor had already closed the session before it was disputed', async () => {
      prisma.mentorSession.findUnique.mockResolvedValue(disputed({ completedAt: new Date(Date.now() - DAY) }));

      await resolve('session', SESSION_ID, 'release').expect(200);

      expect(prisma.mentorProfile.update).not.toHaveBeenCalled();
    });

    it('gives a held payment back to the mentee, cancels the session and does not count it', async () => {
      prisma.mentorSession.findUnique.mockResolvedValue(disputed());

      await resolve('session', SESSION_ID, 'refund', 'The mentor did not join.').expect(200);

      expect(cancelEscrowPayment).toHaveBeenCalledWith('pi_session', { id: 'staff-1', role: 'ADMIN' }, 'The mentor did not join.');
      expect(prisma.mentorSession.updateMany.mock.calls[0][0].data).toMatchObject({
        status: 'CANCELED',
        disputeResolution: 'REFUNDED',
        paymentStatus: 'CANCELED',
        disputeResolvedById: 'staff-1',
      });
      expect(prisma.mentorProfile.update).not.toHaveBeenCalled();
      expect(prisma.mentorProfile.updateMany).not.toHaveBeenCalled();
    });

    it('refunds a payment that was already taken, and takes back the hour that had been counted', async () => {
      prisma.mentorSession.findUnique.mockResolvedValue(disputed({ paymentStatus: 'CAPTURED', completedAt: new Date(Date.now() - 3 * DAY) }));
      prisma.escrowPayment.findUnique.mockResolvedValue({ id: 'esc-1', status: 'CAPTURED' });

      await resolve('session', SESSION_ID, 'refund').expect(200);

      expect(cancelEscrowPayment).toHaveBeenCalled();
      expect(prisma.mentorSession.updateMany.mock.calls[0][0].data).toMatchObject({ status: 'CANCELED', paymentStatus: 'REFUNDED' });
      // Never below zero.
      expect(prisma.mentorProfile.updateMany).toHaveBeenCalledWith({
        where: { id: 'mp-1', sessionCount: { gt: 0 } },
        data: { sessionCount: { decrement: 1 } },
      });
    });

    it('never refunds a session payment the mentee’s bank is also disputing', async () => {
      prisma.mentorSession.findUnique.mockResolvedValue(disputed({ paymentStatus: 'CAPTURED' }));
      (openCardDisputeOn as any).mockResolvedValue({ stripeDisputeId: 'dp_5', evidenceDueBy: null });

      const res = await resolve('session', SESSION_ID, 'refund').expect(409);

      expect(res.body.message).toContain('dp_5');
      expect(cancelEscrowPayment).not.toHaveBeenCalled();
      expect(prisma.mentorSession.updateMany).not.toHaveBeenCalled();
    });

    it('handles a session booked before escrow rows existed by its intent, and will not refund one that was already taken', async () => {
      prisma.escrowPayment.findUnique.mockResolvedValue(null);
      prisma.mentorSession.findUnique.mockResolvedValue(disputed());

      await resolve('session', SESSION_ID, 'release').expect(200);
      expect(captureSessionHold).toHaveBeenCalledWith('pi_session');

      await resolve('session', SESSION_ID, 'refund').expect(200);
      expect(cancelSessionHold).toHaveBeenCalledWith('pi_session', expect.any(String));

      prisma.mentorSession.updateMany.mockClear();
      (cancelSessionHold as any).mockClear();
      prisma.mentorSession.findUnique.mockResolvedValue(disputed({ paymentStatus: 'CAPTURED' }));
      const taken = await resolve('session', SESSION_ID, 'refund').expect(409);
      expect(taken.body.message).toMatch(/Refund it in Stripe/);
      expect(cancelSessionHold).not.toHaveBeenCalled();
      expect(prisma.mentorSession.updateMany).not.toHaveBeenCalled();
    });

    it('decides a session once', async () => {
      prisma.mentorSession.findUnique.mockResolvedValue(sessionRow('COMPLETED'));
      await resolve('session', SESSION_ID, 'release').expect(409);

      prisma.mentorSession.findUnique.mockResolvedValue(disputed());
      prisma.mentorSession.updateMany.mockResolvedValue({ count: 0 });
      await resolve('session', SESSION_ID, 'release').expect(409);
      expect(prisma.mentorProfile.update).not.toHaveBeenCalled();
      expect(recordAdminAction).not.toHaveBeenCalled();
    });
  });
});
