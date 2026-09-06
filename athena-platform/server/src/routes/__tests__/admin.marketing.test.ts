import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: { count: jest.fn(async () => 0), findMany: jest.fn(async () => []) },
    notification: { create: jest.fn(async () => ({})) },
    subscription: { count: jest.fn(async () => 0) },
    referral: { count: jest.fn(async () => 0) },
    lead: {
      count: jest.fn(async () => 0),
      groupBy: jest.fn(async () => []),
      findMany: jest.fn(async () => []),
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(async () => ({})),
      delete: jest.fn(async () => ({})),
    },
    marketingCampaign: { count: jest.fn(async () => 0), findMany: jest.fn(async () => []), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    gtmInitiative: { findMany: jest.fn(async () => []), count: jest.fn(async () => 0), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
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

jest.mock('../../middleware/rateLimiter', () => {
  const actual: any = jest.requireActual('../../middleware/rateLimiter');
  return { ...actual, createRateLimiter: () => (_req: any, _res: any, next: any) => next() };
});

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../utils/email', () => ({
  sendEmail: jest.fn(async () => true),
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;

describe('Marketing hub', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('the overview counts the funnel from the platform’s own tables', async () => {
    prisma.user.count.mockImplementation(async ({ where }: any) => (where.lastLoginAt ? 40 : where.emailVerified ? 25 : 30));
    prisma.subscription.count.mockResolvedValue(6);
    prisma.lead.count.mockResolvedValue(120);
    prisma.lead.groupBy.mockImplementation(async ({ by }: any) => (by[0] === 'source' ? [{ source: 'WAITLIST', _count: { _all: 120 } }, { source: 'PRESS', _count: { _all: 3 } }] : [{ status: 'NEW', _count: { _all: 100 } }]));
    prisma.marketingCampaign.count.mockImplementation(async (args: any) => (args?.where ? 2 : 5));
    prisma.referral.count.mockImplementation(async (args: any) => (args?.where?.rewardGranted ? 4 : args?.where ? 7 : 12));

    const res = await request(app).get('/api/admin/marketing/overview').expect(200);
    expect(res.body.data.funnel).toEqual({ waitlist: 120, registered30d: 30, verified30d: 25, active30d: 40, paid: 6 });
    expect(res.body.data.leads.bySource).toEqual({ WAITLIST: 120, PRESS: 3 });
    expect(res.body.data.campaigns).toEqual({ active: 2, total: 5 });
    expect(res.body.data.referrals).toEqual({ total: 12, completed: 7, rewarded: 4 });
  });

  it('is the admin’s alone', async () => {
    await request(app).get('/api/admin/marketing/overview').set('x-test-role', 'MODERATOR').expect(403);
    await request(app).get('/api/admin/marketing/leads').set('x-test-role', 'USER').expect(403);
  });

  it('a campaign needs a name and a channel, and its utm name is made safe', async () => {
    await request(app).post('/api/admin/marketing/campaigns').send({ name: 'Spring launch' }).expect(400);
    prisma.marketingCampaign.create.mockImplementation(async ({ data }: any) => ({ id: 'c1', ...data }));
    const res = await request(app)
      .post('/api/admin/marketing/campaigns')
      .send({ name: 'Spring launch', channel: 'EMAIL', utmCampaign: 'Spring Launch 2026!', budgetCents: 250000, startsAt: '2026-09-15' })
      .expect(201);
    expect(res.body.data).toMatchObject({ name: 'Spring launch', channel: 'EMAIL', utmCampaign: 'spring-launch-2026-', budgetCents: 250000, createdById: 'staff' });
  });

  it('pasted rows become leads once each; bad emails are skipped', async () => {
    prisma.lead.upsert.mockResolvedValue({});
    const res = await request(app)
      .post('/api/admin/marketing/leads/import')
      .send({ source: 'PARTNER', rows: [{ email: 'Ana@Byte.co', organisation: 'Byte' }, { email: 'not-an-email' }, { email: 'ana@byte.co' }] })
      .expect(200);
    expect(res.body.data).toEqual({ imported: 2, skipped: 1 });
    expect(prisma.lead.upsert.mock.calls[0][0].where).toEqual({ email_source: { email: 'ana@byte.co', source: 'PARTNER' } });
  });

  it('moving a lead to contacted stamps the time', async () => {
    prisma.lead.findUnique.mockResolvedValue({ id: 'l1', status: 'NEW' });
    prisma.lead.update.mockImplementation(async ({ data }: any) => ({ id: 'l1', ...data }));
    const res = await request(app).patch('/api/admin/marketing/leads/l1').send({ status: 'CONTACTED', notes: 'Called, keen' }).expect(200);
    expect(res.body.data.status).toBe('CONTACTED');
    expect(new Date(res.body.data.lastContactedAt).getTime()).toBeGreaterThan(0);
  });

  it('an initiative takes the next position in its area and DONE stamps completion', async () => {
    prisma.gtmInitiative.count.mockResolvedValue(3);
    prisma.gtmInitiative.create.mockImplementation(async ({ data }: any) => ({ id: 'g1', ...data }));
    const created = await request(app).post('/api/admin/marketing/initiatives').send({ title: 'Lock launch channels', area: 'channels' }).expect(201);
    expect(created.body.data).toMatchObject({ area: 'channels', position: 3, status: 'PLANNED' });

    prisma.gtmInitiative.findUnique.mockResolvedValue({ id: 'g1' });
    prisma.gtmInitiative.update.mockImplementation(async ({ data }: any) => ({ id: 'g1', ...data }));
    const done = await request(app).patch('/api/admin/marketing/initiatives/g1').send({ status: 'DONE' }).expect(200);
    expect(done.body.data.completedAt).toBeTruthy();
  });
});

describe('Leads from the site', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('a waitlist signup is recorded once and told its place in the queue', async () => {
    prisma.marketingCampaign.findUnique.mockResolvedValue({ id: 'c1' });
    prisma.lead.upsert.mockResolvedValue({ id: 'l1', createdAt: new Date('2026-09-01T00:00:00Z') });
    prisma.lead.count.mockResolvedValue(41);

    const res = await request(app)
      .post('/api/marketing/leads')
      .send({ email: 'Mei@Example.com', source: 'WAITLIST', name: 'Mei', interest: 'Founder', utmCampaign: 'spring-launch' })
      .expect(201);

    expect(res.body.data.position).toBe(42);
    const upsert = prisma.lead.upsert.mock.calls[0][0];
    expect(upsert.where).toEqual({ email_source: { email: 'mei@example.com', source: 'WAITLIST' } });
    expect(upsert.create).toMatchObject({ email: 'mei@example.com', source: 'WAITLIST', name: 'Mei', campaignId: 'c1' });

    await request(app).post('/api/marketing/leads').send({ email: 'nope', source: 'WAITLIST' }).expect(400);
    await request(app).post('/api/marketing/leads').send({ email: 'x@example.com', source: 'IMPORT' }).expect(400);
  });

  it('a sales enquiry reaches every admin, and the alert inbox when one is set; a waitlist signup does not', async () => {
    const { sendEmail } = jest.requireMock('../../utils/email') as { sendEmail: jest.Mock };
    prisma.user.findMany.mockResolvedValue([{ id: 'admin1' }, { id: 'admin2' }]);
    prisma.lead.upsert.mockResolvedValue({ id: 'l2', email: 'ana@byte.co', source: 'CONTACT_SALES', name: 'Ana', organisation: 'Byte', message: 'We want 40 seats <b>now</b>', createdAt: new Date() });
    process.env.LEAD_ALERT_EMAIL = 'sales@example.com';

    await request(app).post('/api/marketing/leads').send({ email: 'ana@byte.co', source: 'CONTACT_SALES', name: 'Ana', organisation: 'Byte', message: 'We want 40 seats <b>now</b>' }).expect(201);
    await new Promise((r) => setTimeout(r, 20));

    expect(prisma.notification.create).toHaveBeenCalledTimes(2);
    const note = prisma.notification.create.mock.calls[0][0].data;
    expect(note).toMatchObject({ userId: 'admin1', type: 'SYSTEM', title: 'Sales enquiry from Ana, Byte', link: '/admin/marketing/leads?source=CONTACT_SALES' });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const mail = sendEmail.mock.calls[0][0] as { to: string; subject: string; html: string };
    expect(mail.to).toBe('sales@example.com');
    expect(mail.subject).toBe('Sales enquiry: Ana, Byte');
    expect(mail.html).toContain('&lt;b&gt;now&lt;/b&gt;');

    jest.clearAllMocks();
    delete process.env.LEAD_ALERT_EMAIL;
    prisma.lead.upsert.mockResolvedValue({ id: 'l3', email: 'mei@example.com', source: 'WAITLIST', createdAt: new Date() });
    prisma.lead.count.mockResolvedValue(0);
    await request(app).post('/api/marketing/leads').send({ email: 'mei@example.com', source: 'WAITLIST' }).expect(201);
    await new Promise((r) => setTimeout(r, 20));
    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
