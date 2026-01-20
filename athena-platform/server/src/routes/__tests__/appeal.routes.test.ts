import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    appeal: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-123', role: 'ADMIN', email: 'admin@athena.com' };
    next();
  },
  optionalAuth: (_req: any, _res: any, next: any) => next(),
  requireRole: (..._roles: string[]) => (_req: any, __res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/opensearch', () => ({
  initializeOpenSearch: jest.fn(),
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import app from '../../index';
import { prisma } from '../../utils/prisma';

const prismaAny: any = prisma;

describe('Appeal Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('POST /api/appeals creates appeal', async () => {
    prismaAny.appeal.create.mockResolvedValue({ id: 'appeal-1', status: 'PENDING' });

    const response = await request(app)
      .post('/api/appeals')
      .send({ type: 'CONTENT_MODERATION', reason: 'Review this', metadata: { postId: 'p1' } })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe('appeal-1');
  });

  it('GET /api/appeals/me lists appeals', async () => {
    prismaAny.appeal.findMany.mockResolvedValue([{ id: 'appeal-1' }]);

    const response = await request(app).get('/api/appeals/me').expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(1);
  });

  it('PATCH /api/appeals/:id updates appeal decision', async () => {
    prismaAny.appeal.update.mockResolvedValue({ id: 'appeal-1', userId: 'user-123', status: 'APPROVED' });

    const response = await request(app)
      .patch('/api/appeals/appeal-1')
      .send({ status: 'APPROVED', decisionNote: 'Approved' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('APPROVED');
  });
});
