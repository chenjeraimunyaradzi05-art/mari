import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    $transaction: jest.fn(async (ops: any) => Promise.all(ops)),
    // Staff actions on these catalogues are attributable now. Nine of the eleven
    // admin routers wrote nothing to the audit log before, on a platform holding
    // domestic-violence survivors' data.
    auditLog: { create: jest.fn(async () => ({})) },
    acceleratorCohort: {
      findMany: jest.fn(async () => []),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(async () => ({})),
      delete: jest.fn(async () => ({})),
    },
    acceleratorSession: {
      findMany: jest.fn(async () => []),
      findFirst: jest.fn(),
      create: jest.fn(async () => ({})),
      createMany: jest.fn(async () => ({ count: 12 })),
      update: jest.fn(async () => ({})),
      delete: jest.fn(async () => ({})),
      deleteMany: jest.fn(async () => ({ count: 0 })),
    },
    investor: {
      findMany: jest.fn(async () => []),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(async () => ({})),
      delete: jest.fn(async () => ({})),
    },
    investorIntroduction: {
      findMany: jest.fn(async () => []),
      findUnique: jest.fn(),
      update: jest.fn(async () => ({})),
    },
    insuranceProduct: {
      findMany: jest.fn(async () => []),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(async () => ({})),
      delete: jest.fn(async () => ({})),
    },
    acceleratorEnrollment: {
      findMany: jest.fn(async () => []),
      findUnique: jest.fn(),
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
      req.user = { id: 'staff', role: req.headers['x-test-role'] || 'ADMIN', email: 'staff@athena.com' };
      next();
    },
  };
});

jest.mock('../../utils/email', () => ({ sendEmail: jest.fn(async () => true) }));
jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';
import { sendEmail } from '../../utils/email';
import { DEFAULT_CURRICULUM, buildDefaultSessions } from '../admin-catalogue.routes';

const prisma: any = prismaTyped;
const DAY_MS = 24 * 60 * 60 * 1000;

describe('Admin catalogue: cohorts, investors, insurance products, introductions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CLIENT_URL = 'https://app.example';
    prisma.acceleratorCohort.create.mockImplementation(async ({ data }: any) => ({
      id: 'c1',
      ...data,
      sessions: data.sessions?.create ?? [],
      _count: { enrollments: 0, sessions: data.sessions?.create?.length ?? 0 },
    }));
    prisma.investor.create.mockImplementation(async ({ data }: any) => ({ id: 'inv1', ...data }));
    prisma.insuranceProduct.create.mockImplementation(async ({ data }: any) => ({ id: 'p1', ...data }));
  });

  it('is the platform admin’s alone', async () => {
    await request(app).get('/api/admin/investors').set('x-test-role', 'USER').expect(403);
    await request(app).get('/api/admin/investors').set('x-test-role', 'MODERATOR').expect(403);
    await request(app).post('/api/admin/accelerator/cohorts').set('x-test-role', 'USER').send({}).expect(403);
    await request(app).get('/api/admin/insurance/products').set('x-test-role', 'USER').expect(403);
    await request(app).get('/api/admin/investors').expect(200);
    expect(prisma.investor.findMany).toHaveBeenCalledTimes(1);
  });

  describe('accelerator cohorts', () => {
    it('creating a cohort seeds the blueprint’s twelve weeks, one a week from the first session', async () => {
      const start = '2026-10-07T08:00:00.000Z';
      const res = await request(app)
        .post('/api/admin/accelerator/cohorts')
        .send({ name: 'Spring 2026', startDate: start, endDate: '2026-12-30', priceAud: 2500 })
        .expect(201);

      const data = prisma.acceleratorCohort.create.mock.calls[0][0].data;
      const sessions = data.sessions.create;
      expect(sessions).toHaveLength(12);
      expect(sessions.map((s: any) => s.weekNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
      expect(sessions[0].scheduledAt).toEqual(new Date(start));
      expect(sessions[11].scheduledAt).toEqual(new Date(new Date(start).getTime() + 77 * DAY_MS));
      expect(sessions[0].title).toContain('Market Validation');
      expect(sessions[11].title).toContain('Launch & Scale');
      // The deliverable lands at the end of each two-week block, not on both weeks.
      expect(sessions[1].description).toContain('Deliverable due');
      expect(sessions[0].description).not.toContain('Deliverable due');
      expect(sessions.every((s: any) => s.durationMins === 120)).toBe(true);
      expect(data.curriculum).toEqual(DEFAULT_CURRICULUM);
      expect(data.priceAud).toBe(2500);
      expect(res.body.data.sessions).toHaveLength(12);
    });

    it('can start from nothing when staff say so', async () => {
      await request(app)
        .post('/api/admin/accelerator/cohorts')
        .send({ name: 'Bespoke', startDate: '2026-10-07', endDate: '2026-12-30', useDefaultCurriculum: false })
        .expect(201);
      const data = prisma.acceleratorCohort.create.mock.calls[0][0].data;
      expect(data.sessions).toBeUndefined();
      expect(data.curriculum).toBeUndefined();
    });

    it('refuses a cohort that ends before it starts, or with no name', async () => {
      await request(app)
        .post('/api/admin/accelerator/cohorts')
        .send({ name: 'Backwards', startDate: '2026-12-30', endDate: '2026-10-07' })
        .expect(400);
      await request(app).post('/api/admin/accelerator/cohorts').send({ startDate: '2026-10-07', endDate: '2026-12-30' }).expect(400);
      expect(prisma.acceleratorCohort.create).not.toHaveBeenCalled();
    });

    it('will not delete a cohort founders have enrolled in', async () => {
      prisma.acceleratorCohort.findUnique.mockResolvedValue({ id: 'c1', _count: { enrollments: 2, sessions: 12 } });
      await request(app).delete('/api/admin/accelerator/cohorts/c1').expect(409);
      expect(prisma.acceleratorCohort.delete).not.toHaveBeenCalled();

      prisma.acceleratorCohort.findUnique.mockResolvedValue({ id: 'c2', _count: { enrollments: 0, sessions: 12 } });
      await request(app).delete('/api/admin/accelerator/cohorts/c2').expect(200);
      expect(prisma.acceleratorSession.deleteMany).toHaveBeenCalledWith({ where: { cohortId: 'c2' } });
      expect(prisma.acceleratorCohort.delete).toHaveBeenCalledWith({ where: { id: 'c2' } });
    });

    it('adds the default twelve only to a cohort with no sessions yet', async () => {
      prisma.acceleratorCohort.findUnique.mockResolvedValue({ id: 'c1', startDate: new Date('2026-10-07T08:00:00.000Z'), _count: { enrollments: 0, sessions: 3 } });
      await request(app).post('/api/admin/accelerator/cohorts/c1/sessions/default').expect(409);
      expect(prisma.acceleratorSession.createMany).not.toHaveBeenCalled();

      prisma.acceleratorCohort.findUnique.mockResolvedValue({ id: 'c1', startDate: new Date('2026-10-07T08:00:00.000Z'), _count: { enrollments: 0, sessions: 0 } });
      await request(app).post('/api/admin/accelerator/cohorts/c1/sessions/default').expect(201);
      const rows = prisma.acceleratorSession.createMany.mock.calls[0][0].data;
      expect(rows).toHaveLength(12);
      expect(rows.every((r: any) => r.cohortId === 'c1')).toBe(true);
    });

    it('a session belongs to the cohort in the URL, and blank links are stored as null', async () => {
      prisma.acceleratorSession.findFirst.mockResolvedValue(null);
      await request(app).patch('/api/admin/accelerator/cohorts/c1/sessions/s9').send({ title: 'Renamed' }).expect(404);

      prisma.acceleratorSession.findFirst.mockResolvedValue({ id: 's1', cohortId: 'c1' });
      await request(app)
        .patch('/api/admin/accelerator/cohorts/c1/sessions/s1')
        .send({ meetingUrl: 'https://meet.example/abc', recordingUrl: '', scheduledAt: '2026-10-14T08:00:00.000Z' })
        .expect(200);
      const data = prisma.acceleratorSession.update.mock.calls[0][0].data;
      expect(data).toMatchObject({ meetingUrl: 'https://meet.example/abc', recordingUrl: null });
      expect(data.scheduledAt).toEqual(new Date('2026-10-14T08:00:00.000Z'));
      expect(data.title).toBeUndefined();

      await request(app).patch('/api/admin/accelerator/cohorts/c1/sessions/s1').send({ meetingUrl: 'not a url' }).expect(400);
    });

    // Cancelling a cohort used to write CANCELLED and return. A founder who had
    // paid kept an ACTIVE enrolment, a start date that would never come and a
    // calendar of sessions nobody would host; she would have found out by
    // turning up. The refund has to be made by hand — there is no refund path
    // on the platform — so the least this route can do is make sure the money
    // owed is named rather than lost.
    it('cancelling a cohort tells every enrolled founder, and puts the payments still to be returned in front of staff', async () => {
      prisma.acceleratorCohort.findUnique.mockResolvedValue({
        id: 'c1',
        name: 'Summer 2026',
        status: 'ENROLLING',
        startDate: new Date('2026-10-07T08:00:00.000Z'),
        endDate: new Date('2026-12-30T08:00:00.000Z'),
      });
      prisma.acceleratorCohort.update.mockResolvedValue({
        id: 'c1',
        name: 'Summer 2026',
        status: 'CANCELLED',
        priceAud: '2500',
        sessions: [],
        _count: { enrollments: 2, sessions: 12 },
      });
      prisma.acceleratorEnrollment.findMany.mockResolvedValue([
        { id: 'e1', userId: 'u1', paymentStatus: 'PAID' },
        { id: 'e2', userId: 'u2', paymentStatus: 'PENDING' },
      ]);

      await request(app).patch('/api/admin/accelerator/cohorts/c1').send({ status: 'CANCELLED' }).expect(200);

      const told = prisma.notification.create.mock.calls.map((call: any) => call[0].data);
      expect(told.map((n: any) => n.userId)).toEqual(['u1', 'u2']);
      // The woman who paid is told her money has not come back yet and where to
      // ask; no amount is quoted, because the enrolment does not store what she
      // was charged and the cohort price may have been edited since.
      expect(told[0].message).toMatch(/has not been refunded automatically/);
      expect(told[0].message).not.toMatch(/\$/);
      expect(told[0].link).toBe('/contact');
      expect(told[1].message).toMatch(/have not been charged/);
      expect(told[1].link).toBe('/dashboard/accelerator');

      // And the admins get the debt, not just the founder.
      const adminNotice = prisma.notification.createMany.mock.calls[0][0].data[0];
      expect(adminNotice.title).toMatch(/payments to return/);
      expect(adminNotice.data).toMatchObject({ kind: 'ACCELERATOR_COHORT_REFUNDS_DUE', enrollmentIds: ['e1'] });

      const audit = prisma.auditLog.create.mock.calls[0][0].data;
      expect(JSON.stringify(audit)).toContain('refundsOwedEnrollmentIds');

      // The places end with the cohort, so a paid founder cannot tick her way to
      // a certificate for a cohort that never ran. Completions are left alone.
      expect(prisma.acceleratorEnrollment.updateMany).toHaveBeenCalledWith({
        where: { cohortId: 'c1', status: { in: ['PENDING', 'ACTIVE'] } },
        data: { status: 'DROPPED' },
      });
    });

    it('an ordinary cohort edit tells nobody anything', async () => {
      prisma.acceleratorCohort.findUnique.mockResolvedValue({
        id: 'c1',
        name: 'Summer 2026',
        status: 'ENROLLING',
        startDate: new Date('2026-10-07T08:00:00.000Z'),
        endDate: new Date('2026-12-30T08:00:00.000Z'),
      });
      prisma.acceleratorCohort.update.mockResolvedValue({
        id: 'c1',
        name: 'Summer 2026 intake',
        status: 'ENROLLING',
        priceAud: '2500',
        sessions: [],
        _count: { enrollments: 2, sessions: 12 },
      });

      await request(app).patch('/api/admin/accelerator/cohorts/c1').send({ name: 'Summer 2026 intake' }).expect(200);

      expect(prisma.acceleratorEnrollment.findMany).not.toHaveBeenCalled();
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it('buildDefaultSessions covers every week of the curriculum exactly once', () => {
      const weeks = buildDefaultSessions(new Date('2026-10-07T08:00:00.000Z')).map((s) => s.weekNumber);
      expect(weeks).toEqual(DEFAULT_CURRICULUM.flatMap((block) => [...block.weeks]));
    });
  });

  describe('investors', () => {
    it('refuses a cheque range whose floor is above its ceiling', async () => {
      await request(app)
        .post('/api/admin/investors')
        .send({ name: 'Blackbird', type: 'VC', minCheckSize: 500000, maxCheckSize: 100000 })
        .expect(400);
      expect(prisma.investor.create).not.toHaveBeenCalled();
    });

    it('creates an investor with numeric cheque sizes, blank sizes as null and empty lists by default', async () => {
      await request(app)
        .post('/api/admin/investors')
        .send({ name: 'Blackbird', type: 'VC', minCheckSize: '100000', maxCheckSize: '', stages: ['Seed'], website: 'https://blackbird.vc' })
        .expect(201);
      const data = prisma.investor.create.mock.calls[0][0].data;
      expect(data).toMatchObject({ name: 'Blackbird', type: 'VC', minCheckSize: 100000, maxCheckSize: null, stages: ['Seed'], industries: [], regions: [], website: 'https://blackbird.vc' });
    });

    it('checks a patched cheque size against the one already stored', async () => {
      prisma.investor.findUnique.mockResolvedValue({ id: 'inv1', minCheckSize: '250000', maxCheckSize: '1000000' });
      await request(app).patch('/api/admin/investors/inv1').send({ maxCheckSize: 100000 }).expect(400);
      await request(app).patch('/api/admin/investors/inv1').send({ maxCheckSize: 2000000, isVerified: true }).expect(200);
      expect(prisma.investor.update.mock.calls[0][0].data).toEqual({ maxCheckSize: 2000000, isVerified: true });
    });

    it('rejects an unknown investor type', async () => {
      await request(app).post('/api/admin/investors').send({ name: 'Someone', type: 'BANK' }).expect(400);
    });

    it('will not delete an investor founders have asked to meet', async () => {
      prisma.investor.findUnique.mockResolvedValue({ id: 'inv1', _count: { introductions: 1 } });
      await request(app).delete('/api/admin/investors/inv1').expect(409);
      expect(prisma.investor.delete).not.toHaveBeenCalled();
    });
  });

  describe('introductions', () => {
    it('the introductions list is not swallowed by the investor id route', async () => {
      await request(app).get('/api/admin/investors/introductions?status=REQUESTED').expect(200);
      expect(prisma.investorIntroduction.findMany.mock.calls[0][0].where).toEqual({ status: 'REQUESTED' });
      expect(prisma.investor.findUnique).not.toHaveBeenCalled();
    });

    it('introducing a founder stamps the dates, keeps the note and tells her in the app and by email', async () => {
      prisma.investorIntroduction.findUnique.mockResolvedValue({
        id: 'i1',
        userId: 'u1',
        status: 'APPROVED',
        introducedAt: null,
        respondedAt: null,
        investor: { name: 'Blackbird' },
      });

      await request(app)
        .patch('/api/admin/investors/introductions/i1')
        .send({ status: 'INTRODUCED', outcome: 'Emailed both sides this morning.' })
        .expect(200);

      const data = prisma.investorIntroduction.update.mock.calls[0][0].data;
      expect(data).toMatchObject({ status: 'INTRODUCED', outcome: 'Emailed both sides this morning.' });
      expect(data.introducedAt).toBeInstanceOf(Date);
      expect(data.respondedAt).toBeInstanceOf(Date);

      const notification = prisma.notification.create.mock.calls[0][0].data;
      expect(notification).toMatchObject({ userId: 'u1', link: '/dashboard/investors' });
      expect(notification.message).toContain('Blackbird');
      expect(notification.message).toContain('Emailed both sides this morning.');

      const mail = (sendEmail as any).mock.calls[0][0];
      expect(mail.to).toBe('fern@example.com');
      expect(mail.text).toContain('https://app.example/dashboard/investors');
    });

    it('does not re-stamp dates already set, and refuses an unknown decision', async () => {
      const introducedAt = new Date('2026-09-01T00:00:00.000Z');
      prisma.investorIntroduction.findUnique.mockResolvedValue({
        id: 'i1',
        userId: 'u1',
        status: 'INTRODUCED',
        introducedAt,
        respondedAt: introducedAt,
        investor: { name: 'Blackbird' },
      });
      await request(app).patch('/api/admin/investors/introductions/i1').send({ status: 'MEETING_SCHEDULED' }).expect(200);
      const data = prisma.investorIntroduction.update.mock.calls[0][0].data;
      expect(data.introducedAt).toBeUndefined();
      expect(data.respondedAt).toBeUndefined();
      expect(data.outcome).toBeUndefined();

      await request(app).patch('/api/admin/investors/introductions/i1').send({ status: 'REQUESTED' }).expect(400);
      await request(app).patch('/api/admin/investors/introductions/i1').send({ status: 'FUNDED' }).expect(400);
    });
  });

  describe('insurance products', () => {
    it('creates a product and retires rather than deletes one members have applied for', async () => {
      await request(app)
        .post('/api/admin/insurance/products')
        .send({ provider: 'TAL', name: 'Income Protect', type: 'INCOME_PROTECTION', premiumMonthly: '82.5', waitingPeriod: 30, benefitPeriod: '', features: ['Own occupation'] })
        .expect(201);
      expect(prisma.insuranceProduct.create.mock.calls[0][0].data).toMatchObject({
        provider: 'TAL',
        name: 'Income Protect',
        type: 'INCOME_PROTECTION',
        premiumMonthly: 82.5,
        waitingPeriod: 30,
        benefitPeriod: null,
        features: ['Own occupation'],
        exclusions: [],
      });

      await request(app).post('/api/admin/insurance/products').send({ provider: 'TAL', name: 'Pet cover', type: 'PET' }).expect(400);

      prisma.insuranceProduct.findUnique.mockResolvedValue({ id: 'p1', _count: { applications: 3 } });
      await request(app).delete('/api/admin/insurance/products/p1').expect(409);
      expect(prisma.insuranceProduct.delete).not.toHaveBeenCalled();
    });
  });
});
