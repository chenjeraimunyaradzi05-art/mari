import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    salaryDataPoint: { findMany: jest.fn(), count: jest.fn(), create: jest.fn() },
    job: { findMany: jest.fn() },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'member-1', role: 'USER', email: 'm@example.com' };
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

describe('/api/salary without its uncalled twins', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // One woman has reported pay for this narrow role and city. The removed
    // pay-gap route used to hand back her exact figure, minus a dollar.
    prisma.salaryDataPoint.findMany.mockResolvedValue([
      { baseSalary: 91234, totalComp: 91234, gender: 'WOMAN', yearsExperience: 6, submittedAt: new Date() },
    ]);
  });

  it.each([
    ['post', '/api/salary/analyze-gap', { role: 'Harbour pilot', location: 'Gladstone', currentSalary: 1 }],
    ['get', '/api/salary/benchmark?role=Harbour%20pilot&location=Gladstone', {}],
    ['get', '/api/salary/range?role=Harbour%20pilot&location=Gladstone&level=senior', {}],
    ['post', '/api/salary/submit', { role: 'x', level: 'y', industry: 'z', location: 'w', baseSalary: 1, totalCompensation: 1 }],
  ] as const)('%s %s is gone', async (method, path, body) => {
    const res = await (request(app) as any)[method](path).send(body);

    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain('91234');
    expect(prisma.salaryDataPoint.findMany).not.toHaveBeenCalled();
    expect(prisma.salaryDataPoint.create).not.toHaveBeenCalled();
  });

  it('keeps the two routes the salary page calls', async () => {
    await request(app)
      .post('/api/salary/negotiation-script')
      .send({ targetSalary: 120000, role: 'Engineer', scenario: 'raise', currentSalary: 100000 })
      .expect(200);

    prisma.job.findMany.mockResolvedValue([{ salaryMin: 100000, salaryMax: 120000 }]);
    prisma.salaryDataPoint.count.mockResolvedValue(0);
    const res = await request(app).get('/api/salary/company/Sparkco/transparency').expect(200);
    expect(res.body.score).toBe(100);
  });
});
