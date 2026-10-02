/**
 * What a member may write to her own profile, and nothing she did not name.
 *
 * `PATCH /api/users/me/profile` handed the request body to `prisma.profile.upsert`
 * as it arrived, and Prisma reads a nested `user` object as a write on the
 * member's own account row. `{ "user": { "update": { "role": "SUPER_ADMIN" } } }`
 * from any signed-in member therefore made her an administrator, and
 * `twoFactorEnabled: true` switched off the staff two-factor refusal that would
 * have caught it. The experience and education routes spread the body after the
 * owner, so a body `userId` planted an entry on someone else's public profile.
 *
 * The routes now read the body through a strict schema. These tests post the
 * overposted bodies and assert that nothing reaches the database; the
 * Prisma mock is what an overpost would have reached.
 */

import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    profile: { upsert: jest.fn() },
    dvSafetyProfile: { updateMany: jest.fn(async () => ({ count: 0 })) },
    workExperience: { create: jest.fn() },
    education: { create: jest.fn() },
    moneyTransaction: { create: jest.fn(), findMany: jest.fn(async () => []) },
    organizationMember: { findFirst: jest.fn(async () => null) },
  },
}));

jest.mock('../../middleware/auth', () => {
  const actual: any = jest.requireActual('../../middleware/auth');
  return {
    ...actual,
    authenticate: (req: any, _res: any, next: any) => {
      req.user = { id: 'ada', role: 'USER', email: 'ada@athena.com', persona: 'EARLY_CAREER' };
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

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;

describe('PATCH /api/users/me/profile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.profile.upsert.mockImplementation(async ({ create }: any) => ({ id: 'p1', ...create }));
  });

  it('refuses a nested write on the member’s own account, and writes nothing', async () => {
    const res = await request(app)
      .patch('/api/users/me/profile')
      .send({ user: { update: { role: 'SUPER_ADMIN', twoFactorEnabled: true } } })
      .expect(400);

    expect(res.body.message).toMatch(/unknown field/i);
    expect(res.body.message).toContain('user');
    expect(prisma.profile.upsert).not.toHaveBeenCalled();
  });

  it('refuses a body that names another member as the owner', async () => {
    const res = await request(app)
      .patch('/api/users/me/profile')
      .send({ userId: 'someone-else', aboutMe: 'x' })
      .expect(400);

    expect(res.body.message).toContain('userId');
    expect(prisma.profile.upsert).not.toHaveBeenCalled();
  });

  it('refuses the other columns of the profile row a form never sends', async () => {
    for (const body of [{ id: 'another-profile' }, { createdAt: '2020-01-01T00:00:00Z' }, { user: { connect: { id: 'x' } } }]) {
      await request(app).patch('/api/users/me/profile').send(body).expect(400);
    }
    expect(prisma.profile.upsert).not.toHaveBeenCalled();
  });

  it('saves the named fields for the caller, and for the caller only', async () => {
    const res = await request(app)
      .patch('/api/users/me/profile')
      .send({
        aboutMe: '  Builder of small things  ',
        linkedinUrl: 'https://www.linkedin.com/in/ada',
        openToWork: true,
        salaryMin: 90000,
        salaryMax: 120000,
        remotePreference: 'hybrid',
        preferredJobTypes: ['FULL_TIME', 'CONTRACT'],
        isSafeMode: true,
        hideFromSearch: true,
      })
      .expect(200);

    expect(prisma.profile.upsert).toHaveBeenCalledTimes(1);
    const call = prisma.profile.upsert.mock.calls[0][0];
    expect(call.where).toEqual({ userId: 'ada' });
    expect(call.create.userId).toBe('ada');
    expect(call.update).toEqual({
      aboutMe: 'Builder of small things',
      linkedinUrl: 'https://www.linkedin.com/in/ada',
      openToWork: true,
      salaryMin: 90000,
      salaryMax: 120000,
      remotePreference: 'hybrid',
      preferredJobTypes: ['FULL_TIME', 'CONTRACT'],
      isSafeMode: true,
      hideFromSearch: true,
    });
    // The owner is never part of what an update may change.
    expect(call.update).not.toHaveProperty('userId');
    expect(res.body.success).toBe(true);
    // Safe Mode and hide-from-search are mirrored into the DV page's copy, if she has one.
    expect(prisma.dvSafetyProfile.updateMany).toHaveBeenCalledWith({
      where: { userId: 'ada' },
      data: { isSafeMode: true, hideFromSearch: true },
    });
  });

  it('leaves the DV page copy alone when neither switch is part of the change', async () => {
    await request(app).patch('/api/users/me/profile').send({ aboutMe: 'Builder' }).expect(200);

    expect(prisma.dvSafetyProfile.updateMany).not.toHaveBeenCalled();
  });

  it('turns an empty link into a cleared one', async () => {
    await request(app).patch('/api/users/me/profile').send({ websiteUrl: '' }).expect(200);
    expect(prisma.profile.upsert.mock.calls[0][0].update).toEqual({ websiteUrl: null });
  });

  it('refuses a link a browser would run rather than follow', async () => {
    await request(app).patch('/api/users/me/profile').send({ websiteUrl: 'javascript:alert(1)' }).expect(400);
    await request(app).patch('/api/users/me/profile').send({ twitterUrl: 'data:text/html,<b>x</b>' }).expect(400);
    expect(prisma.profile.upsert).not.toHaveBeenCalled();
  });

  it('refuses a salary range that runs backwards, a negative one and an unknown job type', async () => {
    await request(app).patch('/api/users/me/profile').send({ salaryMin: 150000, salaryMax: 90000 }).expect(400);
    await request(app).patch('/api/users/me/profile').send({ salaryMin: -1 }).expect(400);
    await request(app).patch('/api/users/me/profile').send({ preferredJobTypes: ['PIRATE'] }).expect(400);
    await request(app).patch('/api/users/me/profile').send({ remotePreference: 'anywhere' }).expect(400);
    expect(prisma.profile.upsert).not.toHaveBeenCalled();
  });
});

describe('POST /api/users/me/experience', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.workExperience.create.mockImplementation(async ({ data }: any) => ({ id: 'w1', ...data }));
  });

  it('refuses a body that names another member, so nothing lands on her public profile', async () => {
    const res = await request(app)
      .post('/api/users/me/experience')
      .send({ userId: 'bea', company: 'Acme', title: 'Engineer', startDate: '2024-01-01' })
      .expect(400);

    expect(res.body.message).toContain('userId');
    expect(prisma.workExperience.create).not.toHaveBeenCalled();
  });

  it('creates the entry for the caller and parses its dates', async () => {
    await request(app)
      .post('/api/users/me/experience')
      .send({ company: 'Acme', title: 'Engineer', startDate: '2024-01-01', endDate: '2025-06-30', description: 'Built it' })
      .expect(201);

    const { data } = prisma.workExperience.create.mock.calls[0][0];
    expect(data.userId).toBe('ada');
    expect(data.company).toBe('Acme');
    expect(data.startDate).toEqual(new Date('2024-01-01'));
    expect(data.endDate).toEqual(new Date('2025-06-30'));
  });

  it('keeps no end date on a role that is still current', async () => {
    await request(app)
      .post('/api/users/me/experience')
      .send({ company: 'Acme', title: 'Engineer', startDate: '2024-01-01', endDate: '2025-06-30', current: true })
      .expect(201);
    expect(prisma.workExperience.create.mock.calls[0][0].data.endDate).toBeNull();
  });

  it('refuses a missing company, a date that is not one, and an end before the start', async () => {
    const base = { company: 'Acme', title: 'Engineer', startDate: '2024-01-01' };
    await request(app).post('/api/users/me/experience').send({ ...base, company: '' }).expect(400);
    await request(app).post('/api/users/me/experience').send({ ...base, startDate: 'tomorrow' }).expect(400);
    await request(app).post('/api/users/me/experience').send({ ...base, startDate: 20240101 }).expect(400);
    await request(app).post('/api/users/me/experience').send({ ...base, endDate: '2023-01-01' }).expect(400);
    expect(prisma.workExperience.create).not.toHaveBeenCalled();
  });
});

describe('POST /api/users/me/education', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.education.create.mockImplementation(async ({ data }: any) => ({ id: 'e1', ...data }));
  });

  it('refuses a body that names another member', async () => {
    const res = await request(app)
      .post('/api/users/me/education')
      .send({ userId: 'bea', institution: 'QUT' })
      .expect(400);

    expect(res.body.message).toContain('userId');
    expect(prisma.education.create).not.toHaveBeenCalled();
  });

  it('creates the entry for the caller, with the optional dates left empty', async () => {
    await request(app)
      .post('/api/users/me/education')
      .send({ institution: 'QUT', degree: 'BIT', fieldOfStudy: 'Software' })
      .expect(201);

    const { data } = prisma.education.create.mock.calls[0][0];
    expect(data).toMatchObject({ userId: 'ada', institution: 'QUT', degree: 'BIT', startDate: null, endDate: null });
  });

  it('refuses a missing institution and an end before the start', async () => {
    await request(app).post('/api/users/me/education').send({ degree: 'BIT' }).expect(400);
    await request(app)
      .post('/api/users/me/education')
      .send({ institution: 'QUT', startDate: '2024-01-01', endDate: '2023-01-01' })
      .expect(400);
    expect(prisma.education.create).not.toHaveBeenCalled();
  });
});

describe('POST /api/money/transactions', () => {
  const OTHER_ORG = '22222222-2222-4222-8222-222222222222';
  const body = (organizationId?: string) => ({
    ...(organizationId ? { organizationId } : {}),
    amount: 120.5,
    type: 'PAYMENT',
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.organizationMember.findFirst.mockResolvedValue(null);
    prisma.moneyTransaction.create.mockResolvedValue({ id: 't1' });
  });

  it('will not file a row into an organisation the caller has not joined', async () => {
    await request(app).post('/api/money/transactions').send(body(OTHER_ORG)).expect(403);
    expect(prisma.moneyTransaction.create).not.toHaveBeenCalled();
  });

  it('files it once she is an accepted member', async () => {
    prisma.organizationMember.findFirst.mockResolvedValue({ id: 'm1' });
    await request(app).post('/api/money/transactions').send(body(OTHER_ORG)).expect(201);
    expect(prisma.organizationMember.findFirst.mock.calls[0][0].where).toMatchObject({
      organizationId: OTHER_ORG,
      userId: 'ada',
    });
    expect(prisma.moneyTransaction.create).toHaveBeenCalledTimes(1);
  });

  it('asks nothing about membership for a row that is only her own', async () => {
    await request(app).post('/api/money/transactions').send(body()).expect(201);
    expect(prisma.organizationMember.findFirst).not.toHaveBeenCalled();
  });
});
