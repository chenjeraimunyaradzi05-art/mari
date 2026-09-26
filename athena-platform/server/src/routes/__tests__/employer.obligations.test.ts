import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// The employer routes that create obligations — an organisation, a job in its
// name, an edit to a live job, and a woman agreeing to join a team — had no
// suite. Each of these tests is a promise one of them makes.

jest.mock('../../utils/prisma', () => {
  const tx = {
    organization: { create: jest.fn() },
    organizationMember: { create: jest.fn() },
  };
  return {
    prisma: {
      __tx: tx,
      organization: { findUnique: jest.fn() },
      organizationMember: { findUnique: jest.fn(), update: jest.fn() },
      job: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      skill: { findMany: jest.fn(), createMany: jest.fn() },
      jobSkill: { deleteMany: jest.fn(), createMany: jest.fn() },
      $transaction: jest.fn(async (work: any) => work(tx)),
    },
  };
});

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: req.headers['x-test-user'] || 'member-1', role: 'USER', email: 'm@example.com' };
    next();
  },
  optionalAuth: (_req: any, _res: any, next: any) => next(),
  requireRole: (..._roles: string[]) => (_req: any, _res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;
const tx = prisma.__tx;
const ORG = 'org-A';

function asMember(overrides: Record<string, unknown>) {
  prisma.organizationMember.findUnique.mockResolvedValue({
    id: 'mem-1', organizationId: ORG, userId: 'member-1', role: 'OWNER',
    canPostJobs: false, canManageTeam: false, canViewAnalytics: true, acceptedAt: new Date('2026-01-05'),
    ...overrides,
  });
}

describe('Creating an organisation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.organization.findUnique.mockResolvedValue(null);
    tx.organization.create.mockImplementation(async ({ data }: any) => ({ id: 'org-new', ...data }));
    tx.organizationMember.create.mockResolvedValue({});
  });

  it('makes her its accepted owner in the same transaction', async () => {
    const res = await request(app).post('/api/employer/organizations').send({ name: 'Harbour Health', type: 'company' }).expect(201);

    expect(res.body.data).toMatchObject({ id: 'org-new', name: 'Harbour Health', country: 'Australia' });
    const owner = tx.organizationMember.create.mock.calls[0][0].data;
    expect(owner).toMatchObject({ organizationId: 'org-new', userId: 'member-1', role: 'OWNER', canManageTeam: true });
    expect(owner.acceptedAt).toBeInstanceOf(Date);
  });

  it('refuses an organisation type outside the list', async () => {
    await request(app).post('/api/employer/organizations').send({ name: 'X', type: 'cartel' }).expect(400);
    expect(tx.organization.create).not.toHaveBeenCalled();
  });
});

describe('Posting a job in the organisation’s name', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.job.findUnique.mockResolvedValue(null);
    prisma.job.create.mockImplementation(async ({ data }: any) => ({ id: 'job-new', ...data }));
  });

  it('is refused to a recruiter without posting rights', async () => {
    asMember({ role: 'RECRUITER', canPostJobs: false });
    await request(app)
      .post(`/api/employer/organizations/${ORG}/jobs`)
      .send({ title: 'Nurse', description: 'Night shifts', type: 'FULL_TIME' })
      .expect(403);
    expect(prisma.job.create).not.toHaveBeenCalled();
  });

  it('is refused to someone whose invitation is still unanswered', async () => {
    asMember({ role: 'ADMIN', canPostJobs: true, acceptedAt: null });
    await request(app)
      .post(`/api/employer/organizations/${ORG}/jobs`)
      .send({ title: 'Nurse', description: 'Night shifts', type: 'FULL_TIME' })
      .expect(403);
    expect(prisma.job.create).not.toHaveBeenCalled();
  });

  it('starts as a draft under the organisation, posted by her', async () => {
    asMember({ role: 'ADMIN' });
    await request(app)
      .post(`/api/employer/organizations/${ORG}/jobs`)
      .send({ title: 'Nurse', description: 'Night shifts', type: 'FULL_TIME' })
      .expect(201);

    expect(prisma.job.create.mock.calls[0][0].data).toMatchObject({
      organizationId: ORG,
      postedById: 'member-1',
      status: 'DRAFT',
      publishedAt: null,
    });
  });
});

describe('Editing a job', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.job.findUnique.mockResolvedValue({
      id: 'job-1', organizationId: ORG, postedById: 'member-1', status: 'DRAFT', _count: { applications: 0 }, skills: [],
    });
    prisma.job.update.mockImplementation(async ({ data }: any) => ({ id: 'job-1', ...data }));
  });

  it('is refused to a VIEWER, who can read the draft but not publish it', async () => {
    asMember({ role: 'VIEWER', canPostJobs: false });

    await request(app).get('/api/employer/jobs/job-1').expect(200);
    await request(app).patch('/api/employer/jobs/job-1').send({ status: 'ACTIVE' }).expect(403);
    expect(prisma.job.update).not.toHaveBeenCalled();
  });

  it('stamps publication when an owner takes it live', async () => {
    asMember({ role: 'OWNER' });

    await request(app).patch('/api/employer/jobs/job-1').send({ status: 'ACTIVE' }).expect(200);
    expect(prisma.job.update.mock.calls[0][0].data.publishedAt).toBeInstanceOf(Date);
  });
});

describe('Accepting an invitation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.organizationMember.update.mockImplementation(async ({ data }: any) => ({ id: 'mem-pending', ...data }));
  });

  it('is hers to accept, and makes the membership real', async () => {
    prisma.organizationMember.findUnique.mockResolvedValue({
      id: 'mem-pending', userId: 'invitee-1', acceptedAt: null, organization: { name: 'Harbour Health' },
    });

    const res = await request(app)
      .post('/api/employer/invitations/mem-pending/accept')
      .set({ 'x-test-user': 'invitee-1' })
      .expect(200);

    expect(prisma.organizationMember.update.mock.calls[0][0].data.acceptedAt).toBeInstanceOf(Date);
    expect(res.body.message).toBe('You have joined Harbour Health');
  });

  it('cannot be accepted by anyone else, and says so as a 404', async () => {
    prisma.organizationMember.findUnique.mockResolvedValue({
      id: 'mem-pending', userId: 'invitee-1', acceptedAt: null, organization: { name: 'Harbour Health' },
    });

    await request(app).post('/api/employer/invitations/mem-pending/accept').set({ 'x-test-user': 'someone' }).expect(404);
    expect(prisma.organizationMember.update).not.toHaveBeenCalled();
  });
});
