import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    verificationBadge: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    notification: {
      create: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
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
    prismaAny.verificationBadge.findUnique.mockResolvedValue({ metadata: { provider: 'stripe_identity' } });
    prismaAny.verificationBadge.update.mockResolvedValue({ id: 'badge-1', userId: 'user-123', type: 'IDENTITY' });

    const response = await request(app)
      .patch('/api/verification/badges/badge-1')
      .send({ status: 'APPROVED', reason: 'Verified' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(prismaAny.user.update).toHaveBeenCalled();
  });

  // A women-gate submission wears type IDENTITY and lives in the same table.
  // Approving it here would set the verified mark and leave the gate shut, so
  // it is sent to the queue that holds the evidence.
  it('PATCH /api/verification/badges/:id refuses a women-gate submission', async () => {
    prismaAny.verificationBadge.findUnique.mockResolvedValue({ metadata: { purpose: 'WOMAN_GATE', provider: 'manual' } });

    await request(app)
      .patch('/api/verification/badges/badge-2')
      .send({ status: 'APPROVED' })
      .expect(409);

    expect(prismaAny.verificationBadge.update).not.toHaveBeenCalled();
  });

  it('GET /api/verification/woman-gate/requests carries what each member submitted', async () => {
    prismaAny.user.findMany.mockResolvedValue([
      { id: 'ana', email: 'ana@example.com', firstName: 'Ana', lastName: 'M', womanVerificationStatus: 'PENDING' },
    ]);
    prismaAny.user.count.mockResolvedValue(1);
    prismaAny.verificationBadge.findMany.mockResolvedValue([
      {
        id: 'b1',
        userId: 'ana',
        status: 'PENDING',
        submittedAt: '2026-09-20T00:00:00.000Z',
        reason: null,
        metadata: { purpose: 'WOMAN_GATE', provider: 'manual', statement: 'A sentence long enough to be read.' },
      },
    ]);

    const response = await request(app).get('/api/verification/woman-gate/requests').expect(200);

    expect(response.body.data.users[0].submission.evidence).toMatchObject({ provider: 'manual' });
  });

  // The whole point of the queue: a decision has to be made against something.
  it('PATCH /api/verification/woman-gate/:userId refuses an approval with no evidence behind it', async () => {
    prismaAny.user.findUnique.mockResolvedValue({ id: 'ana' });
    prismaAny.verificationBadge.findFirst.mockResolvedValue(null);

    await request(app)
      .patch('/api/verification/woman-gate/ana')
      .send({ status: 'VERIFIED' })
      .expect(409);

    expect(prismaAny.user.update).not.toHaveBeenCalled();
  });

  it('PATCH /api/verification/woman-gate/:userId approves against real evidence', async () => {
    prismaAny.user.findUnique.mockResolvedValue({ id: 'ana' });
    prismaAny.verificationBadge.findFirst.mockResolvedValue({
      id: 'b1',
      metadata: {
        purpose: 'WOMAN_GATE',
        provider: 'stripe_identity',
        documentCheckPassedAt: '2026-09-21T00:00:00.000Z',
      },
    });

    const response = await request(app)
      .patch('/api/verification/woman-gate/ana')
      .send({ status: 'VERIFIED' })
      .expect(200);

    expect(response.body.data.womanVerificationStatus).toBe('VERIFIED');
    expect(prismaAny.user.update).toHaveBeenCalled();
  });
});
