import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    verificationBadge: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    user: {
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

describe('Verification Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /api/verification/badges returns badges', async () => {
    prismaAny.verificationBadge.findMany.mockResolvedValue([{ id: 'badge-1', type: 'IDENTITY' }]);

    const response = await request(app).get('/api/verification/badges').expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(1);
  });

  it('POST /api/verification/badges creates badge', async () => {
    prismaAny.verificationBadge.create.mockResolvedValue({ id: 'badge-1', type: 'IDENTITY', status: 'PENDING' });

    const response = await request(app)
      .post('/api/verification/badges')
      .send({ type: 'IDENTITY', metadata: { doc: 'url' } })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe('badge-1');
  });

  it('PATCH /api/verification/badges/:id approves badge', async () => {
    prismaAny.verificationBadge.update.mockResolvedValue({ id: 'badge-1', userId: 'user-123', type: 'IDENTITY' });

    const response = await request(app)
      .patch('/api/verification/badges/badge-1')
      .send({ status: 'APPROVED', reason: 'Verified' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(prismaAny.user.update).toHaveBeenCalled();
  });
});
