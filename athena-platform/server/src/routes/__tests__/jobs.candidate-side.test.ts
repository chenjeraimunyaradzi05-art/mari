import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    job: { findUnique: jest.fn(), update: jest.fn() },
    jobApplication: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn(), groupBy: jest.fn() },
    organizationMember: { findFirst: jest.fn(), findMany: jest.fn() },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: req.headers['x-test-user'] || 'candidate-1', role: 'USER', email: 'u@a.com' };
    next();
  },
  optionalAuth: (req: any, _res: any, next: any) => {
    if (req.headers['x-test-user']) {
      req.user = { id: req.headers['x-test-user'], role: 'USER', email: 'u@a.com' };
    }
    next();
  },
  requireRole: (..._r: string[]) => (_req: any, _res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

const notify = jest.fn();
jest.mock('../../services/notification.service', () => ({
  ...(jest.requireActual('../../services/notification.service') as object),
  notificationService: { notify: (...a: unknown[]) => notify(...a) },
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';
import { resetJobViewMemory } from '../../services/job-view-count.service';

const prisma: any = prismaTyped;
const CANDIDATE = 'candidate-1';
const BROWSER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';

const JOB = {
  id: 'j1',
  title: 'Electrician',
  status: 'ACTIVE',
  organizationId: 'org-1',
  postedById: 'recruiter-1',
};

describe('The employer-side twins are no longer mounted here', () => {
  // Nothing called them, and the applicant list and status route authorised on
  // the listing's creator alone. The console's routes are the one door now.
  it.each([
    ['post', '/api/jobs'],
    ['patch', '/api/jobs/j1'],
    ['post', '/api/jobs/j1/publish'],
    ['get', '/api/jobs/j1/applications'],
    ['patch', '/api/jobs/j1/applications/a1'],
  ] as const)('%s %s answers 404', async (method, path) => {
    const res = await (request(app) as any)[method](path).set({ 'x-test-user': 'recruiter-1' }).send({ status: 'REVIEWED' });
    expect(res.status).toBe(404);
    expect(prisma.jobApplication.update).not.toHaveBeenCalled();
  });
});

describe('Applying, withdrawing and applying again', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.job.findUnique.mockResolvedValue({ ...JOB, organization: { name: 'Sparkco' } });
    prisma.job.update.mockResolvedValue({});
    prisma.jobApplication.create.mockImplementation(async ({ data }: any) => ({ id: 'a-new', ...data }));
    prisma.jobApplication.update.mockImplementation(async ({ data }: any) => ({ id: 'a1', ...data }));
    prisma.organizationMember.findMany.mockResolvedValue([{ userId: 'recruiter-2', organizationId: 'org-1' }]);
    (notify as any).mockResolvedValue(undefined);
  });

  it('reopens a withdrawn application in place rather than calling it a duplicate', async () => {
    prisma.jobApplication.findUnique.mockResolvedValue({ id: 'a1', status: 'WITHDRAWN', userId: CANDIDATE, jobId: 'j1' });

    await request(app).post('/api/jobs/j1/apply').set({ 'x-test-user': CANDIDATE }).send({ coverLetter: 'Second try' }).expect(201);

    expect(prisma.jobApplication.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'a1' },
        data: expect.objectContaining({ status: 'PENDING', coverLetter: 'Second try' }),
      })
    );
    expect(prisma.jobApplication.create).not.toHaveBeenCalled();
    // She was counted the first time.
    expect(prisma.job.update).not.toHaveBeenCalled();
  });

  it('still refuses an application that is in progress', async () => {
    prisma.jobApplication.findUnique.mockResolvedValue({ id: 'a1', status: 'SHORTLISTED', userId: CANDIDATE, jobId: 'j1' });

    await request(app).post('/api/jobs/j1/apply').set({ 'x-test-user': CANDIDATE }).send({}).expect(400);
    expect(prisma.jobApplication.update).not.toHaveBeenCalled();
  });

  it('tells the organisation’s hiring team, not whoever created the listing, and links to a real page', async () => {
    prisma.jobApplication.findUnique.mockResolvedValue(null);

    await request(app).post('/api/jobs/j1/apply').set({ 'x-test-user': CANDIDATE }).send({}).expect(201);

    const staffQuery = prisma.organizationMember.findMany.mock.calls[0][0].where;
    expect(staffQuery).toMatchObject({ organizationId: { in: ['org-1'] }, acceptedAt: { not: null } });
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'recruiter-2', link: '/employer/organizations/org-1/applications' })
    );
    expect(notify).not.toHaveBeenCalledWith(expect.objectContaining({ userId: 'recruiter-1' }));
  });
});

describe('Her own applications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.jobApplication.findMany.mockResolvedValue([]);
    prisma.jobApplication.count.mockResolvedValue(130);
    prisma.jobApplication.groupBy.mockResolvedValue([{ status: 'INTERVIEW', _count: { _all: 4 } }]);
  });

  it('is paged, with the totals and the company slug the tracker links to', async () => {
    const res = await request(app).get('/api/jobs/me/applications?page=2&limit=50').set({ 'x-test-user': CANDIDATE }).expect(200);

    const args = prisma.jobApplication.findMany.mock.calls[0][0];
    expect(args.take).toBe(50);
    expect(args.skip).toBe(50);
    expect(args.include.job.include.organization.select).toMatchObject({ slug: true });
    expect(res.body.pagination).toMatchObject({ page: 2, total: 130, pages: 3 });
    expect(res.body.summary.byStatus).toEqual({ INTERVIEW: 4 });
  });

  it('defaults to the ceiling of 100 so older callers that count the list are not cut to 20', async () => {
    await request(app).get('/api/jobs/me/applications').set({ 'x-test-user': CANDIDATE }).expect(200);
    expect(prisma.jobApplication.findMany.mock.calls[0][0].take).toBe(100);
  });
});

describe('Counting a view of a listing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetJobViewMemory();
    prisma.job.update.mockResolvedValue({});
    prisma.jobApplication.findUnique.mockResolvedValue(null);
    prisma.organizationMember.findFirst.mockResolvedValue(null);
  });

  it('counts the same visitor once however many times she reloads', async () => {
    prisma.job.findUnique.mockResolvedValue(JOB);

    for (let i = 0; i < 5; i++) {
      await request(app).get('/api/jobs/j1').set('User-Agent', BROWSER).expect(200);
    }

    expect(prisma.job.update).toHaveBeenCalledTimes(1);
  });

  it('does not count a crawler or a script', async () => {
    prisma.job.findUnique.mockResolvedValue(JOB);

    await request(app).get('/api/jobs/j1').set('User-Agent', 'Googlebot/2.1 (+http://www.google.com/bot.html)').expect(200);
    await request(app).get('/api/jobs/j1').set('User-Agent', 'curl/8.4.0').expect(200);

    expect(prisma.job.update).not.toHaveBeenCalled();
  });

  it('does not count a draft or paused listing', async () => {
    prisma.job.findUnique.mockResolvedValue({ ...JOB, status: 'DRAFT' });

    await request(app).get('/api/jobs/j1').set('User-Agent', BROWSER).expect(200);

    expect(prisma.job.update).not.toHaveBeenCalled();
  });

  it('does not count the company looking at its own ad', async () => {
    prisma.job.findUnique.mockResolvedValue(JOB);
    prisma.organizationMember.findFirst.mockResolvedValue({ id: 'm1' });

    await request(app).get('/api/jobs/j1').set({ 'x-test-user': 'recruiter-2', 'User-Agent': BROWSER }).expect(200);

    expect(prisma.job.update).not.toHaveBeenCalled();
  });

  it('says a withdrawn application is not "applied", so she can apply again', async () => {
    prisma.job.findUnique.mockResolvedValue(JOB);
    prisma.jobApplication.findUnique.mockResolvedValue({ id: 'a1', status: 'WITHDRAWN' });

    const res = await request(app).get('/api/jobs/j1').set({ 'x-test-user': CANDIDATE, 'User-Agent': BROWSER }).expect(200);

    expect(res.body.data.hasApplied).toBe(false);
  });
});
