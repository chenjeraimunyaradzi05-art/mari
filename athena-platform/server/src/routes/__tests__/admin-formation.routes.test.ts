import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import express from 'express';

/**
 * The other half of the formation transaction.
 *
 * A registration that had paid up to A$699 reached SUBMITTED and stopped:
 * SUBMITTED's only exit is MARK_UNDER_REVIEW and nothing in the platform had
 * ever called it, so UNDER_REVIEW, APPROVED, REJECTED and COMPLETED were
 * unreachable, no ABN was ever recorded, and there was no refund path of any
 * kind. These are the tests for the router that closes that loop.
 */

const refunds = { create: jest.fn(async (..._args: any[]): Promise<any> => ({ id: 're_1', amount: 49900 })) };

jest.mock('../../utils/prisma', () => ({
  prisma: {
    businessRegistration: { findUnique: jest.fn(), findMany: jest.fn(async () => []), update: jest.fn() },
    user: { findMany: jest.fn(async () => []) },
    notification: { createMany: jest.fn() },
  },
}));

jest.mock('../../utils/stripe', () => ({
  STRIPE_API_VERSION: '2023-10-16',
  isStripeConfigured: () => true,
  getStripe: () => ({ refunds }),
}));

jest.mock('../../services/notification.service', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({ notify: jest.fn() })),
  notificationService: { notify: jest.fn() },
}));

// Only authenticate is replaced, so requireRole really refuses a member.
let currentUser = { id: 'admin-1', role: 'ADMIN', email: 'admin@athena.com', twoFactorEnabled: true };
jest.mock('../../middleware/auth', () => {
  const actual: any = jest.requireActual('../../middleware/auth');
  return {
    ...actual,
    authenticate: (req: any, _res: any, next: any) => {
      req.user = { ...currentUser };
      next();
    },
  };
});

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import adminFormationRoutes from '../admin-formation.routes';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminFormationRoutes);
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(err?.statusCode || 500).json({ success: false, message: err?.message || 'Internal Server Error' });
  });
  return app;
}

/** A registration that reads back whatever was last written to it. */
function stubRegistration(initial: Record<string, any>) {
  const registration: Record<string, any> = { ...initial };

  prisma.businessRegistration.findUnique.mockImplementation(async () => ({
    ...registration,
    user: { id: registration.userId, email: 'founder@example.com', firstName: 'Fay' },
  }));

  prisma.businessRegistration.update.mockImplementation(async ({ data }: any) => {
    Object.assign(registration, data);
    return { ...registration };
  });

  return registration;
}

const submittedCompany = () => ({
  id: 'reg-1',
  userId: 'user-1',
  type: 'COMPANY',
  status: 'SUBMITTED',
  businessName: 'Kestrel Consulting',
  abn: null,
  acn: null,
  data: { paymentId: 'pi_formation', formationFeeCents: 49900 },
  stateHistory: [],
});

describe('POST /api/admin/formation/:id/decision', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentUser = { id: 'admin-1', role: 'ADMIN', email: 'admin@athena.com', twoFactorEnabled: true };
    refunds.create.mockResolvedValue({ id: 're_1', amount: 49900 });
  });

  it('moves a submitted registration into review', async () => {
    const registration = stubRegistration(submittedCompany());

    const res = await request(createTestApp())
      .post('/api/admin/formation/reg-1/decision')
      .send({ decision: 'MARK_UNDER_REVIEW' })
      .expect(200);

    expect(registration.status).toBe('UNDER_REVIEW');
    expect(res.body.data.currentState).toBe('UNDER_REVIEW');
    expect(registration.stateHistory.at(-1)).toMatchObject({ event: 'MARK_UNDER_REVIEW', data: expect.objectContaining({ reviewedBy: 'admin-1' }) });
  });

  it('records the ACN and the registration number on an approval', async () => {
    const registration = stubRegistration({ ...submittedCompany(), status: 'UNDER_REVIEW' });

    await request(createTestApp())
      .post('/api/admin/formation/reg-1/decision')
      .send({ decision: 'APPROVE', registrationNumber: '0123456789', acn: '004085616' })
      .expect(200);

    expect(registration.status).toBe('APPROVED');
    expect(registration.data.registrationNumber).toBe('0123456789');
    expect(registration.acn).toBe('004085616');
    expect(registration.approvedAt).toBeInstanceOf(Date);
  });

  it('refuses an approval with no registration number, which the state machine requires', async () => {
    stubRegistration({ ...submittedCompany(), status: 'UNDER_REVIEW' });

    const res = await request(createTestApp())
      .post('/api/admin/formation/reg-1/decision')
      .send({ decision: 'APPROVE', acn: '004085616' })
      .expect(400);

    expect(res.body.message).toMatch(/registration number is required/i);
    expect(prisma.businessRegistration.update).not.toHaveBeenCalled();
  });

  it('refuses an ACN that does not pass its checksum', async () => {
    stubRegistration({ ...submittedCompany(), status: 'UNDER_REVIEW' });

    await request(createTestApp())
      .post('/api/admin/formation/reg-1/decision')
      .send({ decision: 'APPROVE', registrationNumber: '0123456789', acn: '123456789' })
      .expect(400);

    expect(prisma.businessRegistration.update).not.toHaveBeenCalled();
  });

  it('refunds the fee before it records a refusal', async () => {
    const registration = stubRegistration({ ...submittedCompany(), status: 'UNDER_REVIEW' });

    await request(createTestApp())
      .post('/api/admin/formation/reg-1/decision')
      .send({ decision: 'REJECT', note: 'The company name is already registered to someone else.' })
      .expect(200);

    expect(refunds.create).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: 'pi_formation' }),
      { idempotencyKey: 'formation-refund-reg-1' }
    );
    expect(registration.data.refund).toMatchObject({ refundId: 're_1', status: 'refunded' });
    expect(registration.status).toBe('REJECTED');
    expect(registration.data.rejectionReason).toMatch(/already registered/);
  });

  it('does not record a refusal it could not refund', async () => {
    const registration = stubRegistration({ ...submittedCompany(), status: 'UNDER_REVIEW' });
    refunds.create.mockRejectedValueOnce(new Error('charge already refunded'));

    const res = await request(createTestApp())
      .post('/api/admin/formation/reg-1/decision')
      .send({ decision: 'REJECT', note: 'Not eligible' })
      .expect(502);

    expect(res.body.message).toMatch(/could not be refunded/i);
    expect(registration.status).toBe('UNDER_REVIEW');
  });

  it('will not refuse a registration without telling her why', async () => {
    stubRegistration({ ...submittedCompany(), status: 'UNDER_REVIEW' });

    await request(createTestApp())
      .post('/api/admin/formation/reg-1/decision')
      .send({ decision: 'REJECT' })
      .expect(400);

    expect(refunds.create).not.toHaveBeenCalled();
  });

  it('refunds only once, however many times it is asked', async () => {
    stubRegistration({
      ...submittedCompany(),
      status: 'UNDER_REVIEW',
      data: { paymentId: 'pi_formation', refund: { refundId: 're_1', status: 'refunded' } },
    });

    const res = await request(createTestApp())
      .post('/api/admin/formation/reg-1/refund')
      .send({ note: 'Asked again' })
      .expect(200);

    expect(res.body.data.status).toBe('already_refunded');
    expect(refunds.create).not.toHaveBeenCalled();
  });

  it('refuses a member', async () => {
    currentUser = { id: 'member-1', role: 'USER', email: 'member@example.com', twoFactorEnabled: false };
    stubRegistration(submittedCompany());

    await request(createTestApp())
      .post('/api/admin/formation/reg-1/decision')
      .send({ decision: 'MARK_UNDER_REVIEW' })
      .expect(403);

    expect(prisma.businessRegistration.update).not.toHaveBeenCalled();
  });
});

describe('GET /api/admin/formation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentUser = { id: 'admin-1', role: 'ADMIN', email: 'admin@athena.com', twoFactorEnabled: true };
  });

  it('lists everything waiting on a person, approvals included', async () => {
    await request(createTestApp()).get('/api/admin/formation').expect(200);

    expect(prisma.businessRegistration.findMany.mock.calls[0][0].where).toEqual({
      status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'ADDITIONAL_INFO_REQUIRED', 'APPROVED'] },
    });
  });

  it('refuses a status that is not a waiting stage', async () => {
    await request(createTestApp()).get('/api/admin/formation?status=COMPLETED').expect(400);
    expect(prisma.businessRegistration.findMany).not.toHaveBeenCalled();
  });
});
