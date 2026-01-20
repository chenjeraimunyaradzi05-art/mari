import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: {
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    userSkill: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    skill: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-123', role: 'USER', email: 'user@athena.com' };
    next();
  },
  optionalAuth: (req: any, _res: any, next: any) => {
    next();
  },
  requireRole: (..._roles: string[]) => (_req: any, __res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/opensearch', () => ({
  initializeOpenSearch: jest.fn(),
  indexDocument: jest.fn(),
  deleteDocument: jest.fn(),
  IndexNames: { USERS: 'users' },
}));

import { app } from '../../index';
import { prisma } from '../../utils/prisma';

const prismaAny: any = prisma;

describe('User contract tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('PATCH /api/users/me rejects invalid yearsExperience', async () => {
    const res = await request(app)
      .patch('/api/users/me')
      .send({ yearsExperience: '5-10' })
      .expect(400);

    expect(res.body?.message || res.body?.error || '').toBeTruthy();
  });

  it('PATCH /api/users/me accepts valid profile payload', async () => {
    prismaAny.user.update.mockResolvedValue({
      id: 'user-123',
      email: 'user@athena.com',
      firstName: 'Test',
      lastName: 'User',
      displayName: 'Test User',
      avatar: null,
      bio: 'Bio',
      headline: 'Headline',
      role: 'USER',
      persona: 'EARLY_CAREER',
      city: 'Sydney',
      state: null,
      country: 'Australia',
      currentJobTitle: 'Engineer',
      currentCompany: 'Company',
      yearsExperience: 5,
      isPublic: true,
    });
    prismaAny.userSkill.findMany.mockResolvedValue([]);

    const res = await request(app)
      .patch('/api/users/me')
      .send({
        headline: 'Headline',
        bio: 'Bio',
        city: 'Sydney',
        currentJobTitle: 'Engineer',
        currentCompany: 'Company',
        yearsExperience: 5,
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(expect.objectContaining({ yearsExperience: 5 }));
  });

  it('POST /api/users/me/skills requires skillName', async () => {
    const res = await request(app)
      .post('/api/users/me/skills')
      .send({ level: 2 })
      .expect(400);

    expect(res.body?.message || res.body?.error || '').toBeTruthy();
  });

  it('POST /api/users/me/skills accepts skillName payload', async () => {
    prismaAny.skill.findUnique.mockResolvedValue(null);
    prismaAny.skill.create.mockResolvedValue({ id: 'skill-1', name: 'javascript' });
    prismaAny.userSkill.upsert.mockResolvedValue({
      id: 'us-1',
      userId: 'user-123',
      skillId: 'skill-1',
      level: 3,
      skill: { name: 'javascript' },
    });
    prismaAny.userSkill.findMany.mockResolvedValue([{ skill: { name: 'javascript' } }]);

    const res = await request(app)
      .post('/api/users/me/skills')
      .send({ skillName: 'JavaScript', level: 3 })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(prismaAny.userSkill.upsert).toHaveBeenCalled();
  });
});
