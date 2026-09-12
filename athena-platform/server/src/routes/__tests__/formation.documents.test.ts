import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    businessRegistration: { findUnique: jest.fn(), update: jest.fn(async ({ data }: any) => ({ id: 'r1', ...data })) },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: req.headers['x-test-user'] || 'ana', role: 'USER', email: 'x@athena.com' };
    next();
  },
  optionalAuth: (_req: any, _res: any, next: any) => next(),
  requireRole: (..._roles: string[]) => (_req: any, __res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;

const registration = { id: 'r1', userId: 'ana', type: 'PARTNERSHIP', businessName: 'Two Sisters Catering', abn: null, acn: null, status: 'DRAFT', documents: null, data: { partners: ['Ana Silva', 'Bea Ngata'] } };

describe('Formation documents', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.businessRegistration.findUnique.mockResolvedValue(registration);
  });

  it('lists what would be produced before anything is generated', async () => {
    const res = await request(app).get('/api/formation/r1/documents').expect(200);
    expect(res.body.data.generatedAt).toBeNull();
    expect(res.body.data.items).toEqual([]);
    expect(res.body.data.available.map((d: any) => d.key)).toEqual(['getting-started', 'partnership-agreement', 'record-keeping']);
  });

  it('generates and keeps the documents on the registration, then serves one for download', async () => {
    const res = await request(app).post('/api/formation/r1/documents').expect(201);
    expect(res.body.data.items).toHaveLength(3);
    const saved = prisma.businessRegistration.update.mock.calls[0][0].data.documents;
    expect(saved.items[1].content).toMatch(/Ana Silva 50%, Bea Ngata 50%/);

    prisma.businessRegistration.findUnique.mockResolvedValue({ ...registration, documents: saved });
    const file = await request(app).get('/api/formation/r1/documents/partnership-agreement').expect(200);
    expect(file.headers['content-type']).toMatch(/markdown/);
    expect(file.headers['content-disposition']).toMatch(/two-sisters-catering-partnership-agreement\.md/);
    expect(file.text).toMatch(/# Partnership agreement/);
    await request(app).get('/api/formation/r1/documents/nothing').expect(404);
  });

  it('keeps another member out', async () => {
    await request(app).get('/api/formation/r1/documents').set('x-test-user', 'bea').expect(403);
  });
});
