import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/**
 * The accelerator's places, end to end.
 *
 * Until now nothing but a founder's own routes and the payment service wrote
 * an AcceleratorEnrollment: staff could not free a seat held by an unpaid
 * click, withdraw a certificate that should not stand, or record that a
 * cancelled cohort's fee had gone back. A cancelled cohort left every place
 * ACTIVE, so a paid founder could tick every week and — once the end date
 * passed — be handed a public certificate saying the cohort "ran to" a date
 * for a cohort that never ran. And the enrol, payment and progress routes had
 * no tests at all.
 */

jest.mock('../../utils/prisma', () => ({
  prisma: {
    $transaction: jest.fn(async (ops: any) => Promise.all(ops)),
    auditLog: { create: jest.fn(async () => ({})) },
    acceleratorCohort: { findUnique: jest.fn(), update: jest.fn() },
    acceleratorEnrollment: {
      findMany: jest.fn(async () => []),
      findUnique: jest.fn(),
      create: jest.fn(async ({ data }: any) => ({ id: 'e-new', ...data, cohort: {} })),
      update: jest.fn(async ({ data }: any) => ({ id: 'e1', ...data })),
      updateMany: jest.fn(async () => ({ count: 0 })),
      delete: jest.fn(async () => ({})),
    },
    notification: { create: jest.fn(async () => ({})), createMany: jest.fn(async () => ({ count: 1 })) },
    user: {
      findUnique: jest.fn(async () => ({ email: 'fern@example.com', firstName: 'Fern' })),
      findMany: jest.fn(async () => [{ id: 'staff' }]),
    },
  },
}));

jest.mock('../../middleware/auth', () => {
  const actual: any = jest.requireActual('../../middleware/auth');
  return {
    ...actual,
    authenticate: (req: any, _res: any, next: any) => {
      req.user = { id: req.headers['x-test-user'] || 'staff', role: req.headers['x-test-role'] || 'ADMIN', email: 'x@athena.com' };
      next();
    },
    optionalAuth: (_req: any, _res: any, next: any) => next(),
  };
});

jest.mock('../../utils/email', () => ({ sendEmail: jest.fn(async () => true) }));
jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;
const DAY = 24 * 60 * 60 * 1000;
const member = { 'x-test-user': 'founder-1', 'x-test-role': 'USER' };

function enrolmentRow(over: Record<string, unknown> = {}) {
  return {
    id: 'e1',
    cohortId: 'c1',
    userId: 'founder-1',
    status: 'ACTIVE',
    paymentStatus: 'PAID',
    completedWeeks: 0,
    completedAt: null,
    deliverables: null,
    cohort: { id: 'c1', name: 'Summer 2026' },
    ...over,
  };
}

describe('Accelerator places: staff actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('is for staff only', async () => {
    await request(app).get('/api/admin/accelerator/cohorts/c1/enrollments').set(member).expect(403);
    await request(app).patch('/api/admin/accelerator/enrollments/e1').set(member).send({ action: 'release', reason: 'Never paid' }).expect(403);
  });

  it('lists who is in a cohort, with how each place stands', async () => {
    prisma.acceleratorCohort.findUnique.mockResolvedValue({ id: 'c1', name: 'Summer 2026', status: 'ENROLLING', maxParticipants: 30 });
    prisma.acceleratorEnrollment.findMany.mockResolvedValue([enrolmentRow({ user: { id: 'founder-1', firstName: 'Fern' } })]);
    const res = await request(app).get('/api/admin/accelerator/cohorts/c1/enrollments').expect(200);
    expect(res.body.data.enrollments).toHaveLength(1);
    expect(prisma.acceleratorEnrollment.findMany.mock.calls[0][0].where).toEqual({ cohortId: 'c1' });
  });

  it('releases an unpaid place so the seat is free, and never a paid one', async () => {
    prisma.acceleratorEnrollment.findUnique.mockResolvedValue(enrolmentRow({ status: 'PENDING', paymentStatus: 'PENDING' }));
    await request(app)
      .patch('/api/admin/accelerator/enrollments/e1')
      .send({ action: 'release', reason: 'The place was held for three weeks without payment.' })
      .expect(200);
    expect(prisma.acceleratorEnrollment.delete).toHaveBeenCalledWith({ where: { id: 'e1' } });
    expect(prisma.notification.create.mock.calls[0][0].data).toMatchObject({ userId: 'founder-1' });
    expect(prisma.notification.create.mock.calls[0][0].data.message).toMatch(/not been charged/);
    expect(JSON.stringify(prisma.auditLog.create.mock.calls[0][0].data)).toContain('ENROLLMENT_RELEASE');

    prisma.acceleratorEnrollment.delete.mockClear();
    prisma.acceleratorEnrollment.findUnique.mockResolvedValue(enrolmentRow({ paymentStatus: 'PAID' }));
    await request(app).patch('/api/admin/accelerator/enrollments/e1').send({ action: 'release', reason: 'Tidy up' }).expect(409);
    expect(prisma.acceleratorEnrollment.delete).not.toHaveBeenCalled();
  });

  it('withdraws a completion certificate, and only from a completed place', async () => {
    prisma.acceleratorEnrollment.findUnique.mockResolvedValue(enrolmentRow({ status: 'COMPLETED', completedAt: new Date() }));
    await request(app)
      .patch('/api/admin/accelerator/enrollments/e1')
      .send({ action: 'revoke', reason: 'The cohort did not run as recorded.' })
      .expect(200);
    expect(prisma.acceleratorEnrollment.update.mock.calls[0][0].data).toEqual({ status: 'DROPPED', completedAt: null });

    prisma.acceleratorEnrollment.findUnique.mockResolvedValue(enrolmentRow({ status: 'ACTIVE' }));
    await request(app).patch('/api/admin/accelerator/enrollments/e1').send({ action: 'revoke', reason: 'x'.repeat(10) }).expect(409);
  });

  it('records a refund only with a reference, and only against money actually taken', async () => {
    prisma.acceleratorEnrollment.findUnique.mockResolvedValue(enrolmentRow({ status: 'DROPPED', paymentStatus: 'PAID' }));
    await request(app).patch('/api/admin/accelerator/enrollments/e1').send({ action: 'record_refund', reason: 'Cohort cancelled' }).expect(400);
    expect(prisma.acceleratorEnrollment.update).not.toHaveBeenCalled();

    await request(app)
      .patch('/api/admin/accelerator/enrollments/e1')
      .send({ action: 'record_refund', reason: 'Cohort cancelled', reference: 're_3PqX' })
      .expect(200);
    expect(prisma.acceleratorEnrollment.update.mock.calls[0][0].data).toEqual({ paymentStatus: 'REFUNDED', status: 'DROPPED' });
    expect(prisma.notification.create.mock.calls[0][0].data.message).toMatch(/re_3PqX/);
    expect(JSON.stringify(prisma.auditLog.create.mock.calls[0][0].data)).toContain('re_3PqX');

    prisma.acceleratorEnrollment.update.mockClear();
    prisma.acceleratorEnrollment.findUnique.mockResolvedValue(enrolmentRow({ paymentStatus: 'PENDING' }));
    await request(app)
      .patch('/api/admin/accelerator/enrollments/e1')
      .send({ action: 'record_refund', reason: 'x'.repeat(5), reference: 'bank 123' })
      .expect(409);
    expect(prisma.acceleratorEnrollment.update).not.toHaveBeenCalled();
  });

  it('a completed place keeps its completion when a goodwill refund is recorded', async () => {
    prisma.acceleratorEnrollment.findUnique.mockResolvedValue(enrolmentRow({ status: 'COMPLETED', paymentStatus: 'PAID' }));
    await request(app)
      .patch('/api/admin/accelerator/enrollments/e1')
      .send({ action: 'record_refund', reason: 'Goodwill', reference: 'bank 123' })
      .expect(200);
    expect(prisma.acceleratorEnrollment.update.mock.calls[0][0].data).toEqual({ paymentStatus: 'REFUNDED' });
  });
});

describe('Accelerator certificates for a cohort that never ran', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('are refused, even for a place that reached COMPLETED', async () => {
    const completed = {
      id: 'e1',
      status: 'COMPLETED',
      completedAt: new Date('2026-04-26'),
      completedWeeks: 12,
      cohort: { name: 'Cohort 3', status: 'CANCELLED', startDate: new Date('2026-02-01'), endDate: new Date('2026-04-26'), _count: { sessions: 12 } },
      user: { firstName: 'Ana', lastName: 'Silva' },
    };
    prisma.acceleratorEnrollment.findUnique.mockResolvedValue(completed);
    await request(app).get('/api/strategy/business/accelerator-certificates/e1').expect(404);

    prisma.acceleratorEnrollment.findUnique.mockResolvedValue({ ...completed, cohort: { ...completed.cohort, status: 'COMPLETED' } });
    await request(app).get('/api/strategy/business/accelerator-certificates/e1').expect(200);
  });
});

describe('Accelerator enrol and progress (business routes)', () => {
  const sessions = [1, 2, 3].map((n) => ({ id: `s${n}`, weekNumber: n, title: `Week ${n}`, scheduledAt: new Date(Date.now() - 60 * DAY), durationMins: 120, meetingUrl: null, recordingUrl: null }));
  const endedCohort = { id: 'c1', name: 'Summer 2026', status: 'IN_PROGRESS', startDate: new Date(Date.now() - 90 * DAY), endDate: new Date(Date.now() - DAY), sessions };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.acceleratorEnrollment.update.mockImplementation(async ({ data }: any) => ({ ...enrolmentRow(), ...data, cohort: endedCohort }));
  });

  it('enrolling reserves an unpaid place, not a paid one', async () => {
    prisma.acceleratorCohort.findUnique.mockResolvedValue({ id: 'c1', status: 'ENROLLING', maxParticipants: 30, _count: { enrollments: 0 } });
    prisma.acceleratorEnrollment.findUnique.mockResolvedValue(null);
    await request(app).post('/api/business/accelerators/c1/enroll').set(member).expect(201);
    expect(prisma.acceleratorEnrollment.create.mock.calls[0][0].data).toMatchObject({ status: 'PENDING', paymentStatus: 'PENDING', userId: 'founder-1' });
  });

  it('refuses to enrol anyone in a cancelled cohort', async () => {
    prisma.acceleratorCohort.findUnique.mockResolvedValue({ id: 'c1', status: 'CANCELLED', maxParticipants: 30, _count: { enrollments: 0 } });
    await request(app).post('/api/business/accelerators/c1/enroll').set(member).expect(400);
    expect(prisma.acceleratorEnrollment.create).not.toHaveBeenCalled();
  });

  it('will not record a week against an unpaid place', async () => {
    prisma.acceleratorEnrollment.findUnique.mockResolvedValue(enrolmentRow({ paymentStatus: 'PENDING', cohort: endedCohort }));
    await request(app).post('/api/business/accelerators/enrollments/e1/progress').set(member).send({ weekNumber: 1 }).expect(400);
    expect(prisma.acceleratorEnrollment.update).not.toHaveBeenCalled();
  });

  it('makes a place COMPLETED only when every week is done and the cohort has ended', async () => {
    const twoDone = { weeks: [1, 2].map((n) => ({ weekNumber: n, completedAt: new Date().toISOString() })) };

    // The last week, after the end date: completed.
    prisma.acceleratorEnrollment.findUnique.mockResolvedValue(enrolmentRow({ deliverables: twoDone, cohort: endedCohort }));
    await request(app).post('/api/business/accelerators/enrollments/e1/progress').set(member).send({ weekNumber: 3 }).expect(200);
    expect(prisma.acceleratorEnrollment.update.mock.calls[0][0].data).toMatchObject({ completedWeeks: 3, status: 'COMPLETED' });

    // The same tick-through before the end date is her record, not a graduation.
    prisma.acceleratorEnrollment.update.mockClear();
    const running = { ...endedCohort, endDate: new Date(Date.now() + 30 * DAY) };
    prisma.acceleratorEnrollment.findUnique.mockResolvedValue(enrolmentRow({ deliverables: twoDone, cohort: running }));
    await request(app).post('/api/business/accelerators/enrollments/e1/progress').set(member).send({ weekNumber: 3 }).expect(200);
    expect(prisma.acceleratorEnrollment.update.mock.calls[0][0].data.status).toBeUndefined();
  });

  it('never makes a place that has ended COMPLETED, however many weeks are ticked', async () => {
    const twoDone = { weeks: [1, 2].map((n) => ({ weekNumber: n, completedAt: new Date().toISOString() })) };
    prisma.acceleratorEnrollment.findUnique.mockResolvedValue(enrolmentRow({ status: 'DROPPED', deliverables: twoDone, cohort: endedCohort }));
    await request(app).post('/api/business/accelerators/enrollments/e1/progress').set(member).send({ weekNumber: 3 }).expect(200);
    expect(prisma.acceleratorEnrollment.update.mock.calls[0][0].data.status).toBeUndefined();
  });

  it('keeps one founder out of another founder’s place', async () => {
    prisma.acceleratorEnrollment.findUnique.mockResolvedValue(enrolmentRow({ userId: 'someone-else', cohort: endedCohort }));
    await request(app).post('/api/business/accelerators/enrollments/e1/progress').set(member).send({ weekNumber: 1 }).expect(403);
    await request(app).get('/api/business/accelerators/enrollments/e1/progress').set(member).expect(403);
  });
});
