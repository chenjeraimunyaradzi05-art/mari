import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    apprenticeship: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn(), groupBy: jest.fn() },
    apprenticeshipApplication: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    apprenticeshipBookmark: { findMany: jest.fn() },
    user: { findUnique: jest.fn() },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = {
      id: req.headers['x-test-user'] || 'applicant-1',
      role: req.headers['x-test-role'] || 'USER',
      email: 'u@athena.com',
    };
    next();
  },
  optionalAuth: (req: any, _res: any, next: any) => {
    if (req.headers['x-test-user']) {
      req.user = {
        id: req.headers['x-test-user'],
        role: req.headers['x-test-role'] || 'USER',
        email: 'u@athena.com',
      };
    }
    next();
  },
  requireRole: (..._roles: string[]) => (_req: any, __res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;

const APPLICANT = 'applicant-1';
const OTHER = 'other-1';

const as = (userId: string, role = 'USER') => ({ 'x-test-user': userId, 'x-test-role': role });

function mockApplication(overrides: Record<string, unknown> = {}) {
  (prisma.apprenticeshipApplication.findUnique as any).mockResolvedValue({
    id: 'a1',
    apprenticeshipId: 'ap1',
    userId: APPLICANT,
    status: 'SUBMITTED',
    ...overrides,
  });
}

describe('Apprenticeship categories and recommendations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.apprenticeship.findMany as any).mockResolvedValue([]);
  });

  it('GET /categories is not read as an apprenticeship id', async () => {
    (prisma.apprenticeship.groupBy as any)
      .mockResolvedValueOnce([{ framework: 'Electrotechnology', _count: { _all: 4 } }])
      .mockResolvedValueOnce([{ level: 'CERTIFICATE_III', _count: { _all: 4 } }]);

    const res = await request(app).get('/api/apprenticeships/categories').expect(200);

    expect(prisma.apprenticeship.findUnique).not.toHaveBeenCalled();
    expect(res.body.data.frameworks).toEqual([{ name: 'Electrotechnology', count: 4 }]);
    expect(res.body.data.levels).toEqual([{ level: 'CERTIFICATE_III', count: 4 }]);
  });

  it('GET /recommended prefers frameworks and levels the viewer has engaged with', async () => {
    (prisma.apprenticeshipBookmark.findMany as any).mockResolvedValue([
      { apprenticeship: { framework: 'Electrotechnology', level: 'CERTIFICATE_III' } },
    ]);
    (prisma.apprenticeshipApplication.findMany as any).mockResolvedValue([]);
    (prisma.user.findUnique as any).mockResolvedValue({ city: 'Perth', state: 'WA', country: 'Australia' });
    (prisma.apprenticeship.findMany as any).mockResolvedValue([{ id: 'ap9' }]);

    const res = await request(app).get('/api/apprenticeships/recommended').set(as(APPLICANT)).expect(200);

    expect(res.body.personalized).toBe(true);
    const where = (prisma.apprenticeship.findMany as any).mock.calls[0][0].where;
    expect(where.status).toBe('OPEN');
    expect(where.OR).toContainEqual({ framework: { in: ['Electrotechnology'] } });
    expect(where.OR).toContainEqual({ city: 'Perth' });
  });

  it('GET /recommended never suggests something already applied to', async () => {
    (prisma.apprenticeshipBookmark.findMany as any).mockResolvedValue([]);
    (prisma.apprenticeshipApplication.findMany as any).mockResolvedValue([
      { apprenticeshipId: 'ap-applied', apprenticeship: { framework: 'F', level: 'CERTIFICATE_III' } },
    ]);
    (prisma.user.findUnique as any).mockResolvedValue({ city: null, state: null, country: 'Australia' });

    await request(app).get('/api/apprenticeships/recommended').set(as(APPLICANT)).expect(200);

    const where = (prisma.apprenticeship.findMany as any).mock.calls[0][0].where;
    expect(where.id).toEqual({ notIn: ['ap-applied'] });
  });

  it('GET /recommended still returns openings for a viewer with no history', async () => {
    (prisma.apprenticeshipBookmark.findMany as any).mockResolvedValue([]);
    (prisma.apprenticeshipApplication.findMany as any).mockResolvedValue([]);
    (prisma.user.findUnique as any).mockResolvedValue({ city: null, state: null, country: 'Australia' });
    (prisma.apprenticeship.findMany as any).mockResolvedValue([{ id: 'ap1' }, { id: 'ap2' }]);

    const res = await request(app).get('/api/apprenticeships/recommended').set(as(APPLICANT)).expect(200);

    expect(res.body.personalized).toBe(false);
    expect(res.body.data).toHaveLength(2);
  });
});

describe('A single apprenticeship application', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.apprenticeshipApplication.update as any).mockImplementation(async (args: any) => ({
      id: 'a1',
      ...args.data,
    }));
  });

  it('the applicant can read their own application', async () => {
    mockApplication();

    const res = await request(app)
      .get('/api/apprenticeships/applications/a1')
      .set(as(APPLICANT))
      .expect(200);

    expect(res.body.data.id).toBe('a1');
  });

  it('an unrelated user cannot read it', async () => {
    mockApplication();

    await request(app).get('/api/apprenticeships/applications/a1').set(as(OTHER)).expect(403);
  });

  it('provider staff can read it', async () => {
    mockApplication();

    await request(app)
      .get('/api/apprenticeships/applications/a1')
      .set(as(OTHER, 'EDUCATION_PROVIDER'))
      .expect(200);
  });

  it('/applications/me is not captured by /applications/:applicationId', async () => {
    (prisma.apprenticeshipApplication.findMany as any).mockResolvedValue([]);

    await request(app).get('/api/apprenticeships/applications/me').set(as(APPLICANT)).expect(200);

    expect(prisma.apprenticeshipApplication.findUnique).not.toHaveBeenCalled();
    expect(prisma.apprenticeshipApplication.findMany).toHaveBeenCalled();
  });
});

describe('Withdrawing an application', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.apprenticeshipApplication.update as any).mockImplementation(async (args: any) => ({
      id: 'a1',
      ...args.data,
    }));
  });

  it('marks the row WITHDRAWN rather than deleting it', async () => {
    mockApplication({ status: 'SCREENING' });

    const res = await request(app)
      .delete('/api/apprenticeships/applications/a1')
      .set(as(APPLICANT))
      .expect(200);

    expect((prisma.apprenticeshipApplication.update as any).mock.calls[0][0].data).toEqual({
      status: 'WITHDRAWN',
    });
    expect(res.body.data.status).toBe('WITHDRAWN');
  });

  it('is idempotent', async () => {
    mockApplication({ status: 'WITHDRAWN' });

    await request(app)
      .delete('/api/apprenticeships/applications/a1')
      .set(as(APPLICANT))
      .expect(200);

    expect(prisma.apprenticeshipApplication.update).not.toHaveBeenCalled();
  });

  it('refuses to withdraw an accepted place through this route', async () => {
    mockApplication({ status: 'ACCEPTED' });

    await request(app)
      .delete('/api/apprenticeships/applications/a1')
      .set(as(APPLICANT))
      .expect(400);
  });

  it("refuses to withdraw somebody else's application", async () => {
    mockApplication({ userId: OTHER });

    await request(app)
      .delete('/api/apprenticeships/applications/a1')
      .set(as(APPLICANT))
      .expect(403);

    expect(prisma.apprenticeshipApplication.update).not.toHaveBeenCalled();
  });

  it('404s for an application that does not exist', async () => {
    (prisma.apprenticeshipApplication.findUnique as any).mockResolvedValue(null);

    await request(app)
      .delete('/api/apprenticeships/applications/nope')
      .set(as(APPLICANT))
      .expect(404);
  });
});
