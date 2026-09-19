import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// The role the signed-in caller carries; each test picks it.
let role = 'ADMIN';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    grant: {
      findMany: jest.fn(async () => []),
      findFirst: jest.fn(async () => null),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'staff-1', role, email: 'staff@example.com' };
    next();
  },
  optionalAuth: (_req: any, _res: any, next: any) => next(),
  // Enforced here, unlike most route tests: this router's whole point is who may write.
  requireRole:
    (...roles: string[]) =>
    (req: any, res: any, next: any) =>
      roles.includes(req.user?.role) ? next() : res.status(403).json({ success: false, message: 'Insufficient permissions' }),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;

const programme = (overrides: Record<string, unknown> = {}) => ({
  name: 'Female Founders Co-Investment Fund',
  description: 'Co-investment for women-founded Queensland startups raising their first round.',
  provider: 'Queensland Government',
  providerType: 'STATE',
  minFunding: 50000,
  maxFunding: 200000,
  industries: ['Technology', 'Technology'],
  stages: ['Startup', 'Early'],
  regions: ['QLD'],
  tags: ['women'],
  applicationUrl: 'https://www.business.qld.gov.au/female-founders',
  deadline: '2099-06-30',
  isRolling: false,
  requirements: 'Majority women-owned, Queensland-based, less than five years trading.',
  ...overrides,
});

describe('Admin grant programmes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    role = 'ADMIN';
    prisma.grant.findMany.mockResolvedValue([]);
    prisma.grant.findFirst.mockResolvedValue(null);
    prisma.grant.create.mockImplementation(async ({ data }: any) => ({ id: 'grant-1', ...data, _count: { applications: 0 } }));
    prisma.grant.update.mockImplementation(async ({ where, data }: any) => ({ id: where.id, ...data }));
  });

  describe('who may write', () => {
    it('refuses a member', async () => {
      role = 'USER';
      const res = await request(app).post('/api/admin/grants').send(programme());
      expect(res.status).toBe(403);
      expect(prisma.grant.create).not.toHaveBeenCalled();
    });

    it('refuses a moderator, who reviews people rather than programmes', async () => {
      role = 'MODERATOR';
      const res = await request(app).get('/api/admin/grants');
      expect(res.status).toBe(403);
    });

    it('lists paused programmes for staff as well as live ones', async () => {
      const res = await request(app).get('/api/admin/grants');
      expect(res.status).toBe(200);
      expect(prisma.grant.findMany.mock.calls[0][0].where).toEqual({});
    });

    it('narrows to paused programmes on request', async () => {
      await request(app).get('/api/admin/grants?active=false');
      expect(prisma.grant.findMany.mock.calls[0][0].where).toEqual({ isActive: false });
    });
  });

  describe('POST /api/admin/grants', () => {
    it('lists a programme from the funder page, deduplicating its tags', async () => {
      const res = await request(app).post('/api/admin/grants').send(programme());

      expect(res.status).toBe(201);
      const data = prisma.grant.create.mock.calls[0][0].data;
      expect(data.industries).toEqual(['Technology']);
      expect(data.providerType).toBe('STATE');
      expect(data.applicationUrl).toBe('https://www.business.qld.gov.au/female-founders');
      expect(data.requirements).toEqual({ text: 'Majority women-owned, Queensland-based, less than five years trading.' });
      expect(data.deadline).toBeInstanceOf(Date);
      expect(data.isActive).toBe(true);
    });

    it('rejects a javascript: application link', async () => {
      const res = await request(app)
        .post('/api/admin/grants')
        .send(programme({ applicationUrl: 'javascript:alert(document.cookie)' }));

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/applicationUrl/);
      expect(prisma.grant.create).not.toHaveBeenCalled();
    });

    it('rejects a bare domain, since the link is what the listing was taken from', async () => {
      const res = await request(app).post('/api/admin/grants').send(programme({ applicationUrl: 'business.qld.gov.au' }));
      expect(res.status).toBe(400);
    });

    it('requires the application link', async () => {
      const res = await request(app).post('/api/admin/grants').send(programme({ applicationUrl: undefined }));
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/applicationUrl/);
    });

    it('rejects a funding band whose floor is above its ceiling', async () => {
      const res = await request(app).post('/api/admin/grants').send(programme({ minFunding: 300000, maxFunding: 200000 }));
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/maxFunding/);
    });

    it('rejects a provider type the directory does not know', async () => {
      const res = await request(app).post('/api/admin/grants').send(programme({ providerType: 'COUNCIL' }));
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/providerType/);
    });

    it('will not list a programme whose closing date has already passed', async () => {
      const res = await request(app).post('/api/admin/grants').send(programme({ deadline: '2020-01-01' }));
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/deadline/);
    });

    it('clears the date on a rolling programme', async () => {
      const res = await request(app).post('/api/admin/grants').send(programme({ isRolling: true, deadline: '2099-06-30' }));
      expect(res.status).toBe(201);
      expect(prisma.grant.create.mock.calls[0][0].data.deadline).toBeNull();
    });

    it('refuses a duplicate of a programme already listed', async () => {
      prisma.grant.findFirst.mockResolvedValue({ id: 'grant-9', isActive: true });
      const res = await request(app).post('/api/admin/grants').send(programme());
      expect(res.status).toBe(409);
    });
  });

  describe('PATCH /api/admin/grants/:id', () => {
    it('pauses a programme without touching anything else', async () => {
      prisma.grant.findUnique.mockResolvedValue({ id: 'grant-1', isRolling: false });

      const res = await request(app).patch('/api/admin/grants/grant-1').send({ isActive: false });

      expect(res.status).toBe(200);
      expect(prisma.grant.update.mock.calls[0][0]).toMatchObject({ where: { id: 'grant-1' }, data: { isActive: false } });
      expect(Object.keys(prisma.grant.update.mock.calls[0][0].data)).toEqual(['isActive']);
    });

    it('reactivates a paused programme', async () => {
      prisma.grant.findUnique.mockResolvedValue({ id: 'grant-1', isRolling: false });
      await request(app).patch('/api/admin/grants/grant-1').send({ isActive: true });
      expect(prisma.grant.update.mock.calls[0][0].data).toEqual({ isActive: true });
    });

    it('answers 404 for a programme that does not exist', async () => {
      prisma.grant.findUnique.mockResolvedValue(null);
      const res = await request(app).patch('/api/admin/grants/missing').send({ isActive: false });
      expect(res.status).toBe(404);
      expect(prisma.grant.update).not.toHaveBeenCalled();
    });

    it('still refuses a javascript: link on edit', async () => {
      prisma.grant.findUnique.mockResolvedValue({ id: 'grant-1', isRolling: false });
      const res = await request(app).patch('/api/admin/grants/grant-1').send({ applicationUrl: 'javascript:void(0)' });
      expect(res.status).toBe(400);
      expect(prisma.grant.update).not.toHaveBeenCalled();
    });

    it('drops the date when a programme becomes rolling', async () => {
      prisma.grant.findUnique.mockResolvedValue({ id: 'grant-1', isRolling: false });
      await request(app).patch('/api/admin/grants/grant-1').send({ isRolling: true });
      expect(prisma.grant.update.mock.calls[0][0].data).toEqual({ isRolling: true, deadline: null });
    });

    it('refuses an empty edit', async () => {
      const res = await request(app).patch('/api/admin/grants/grant-1').send({});
      expect(res.status).toBe(400);
    });

    it('does not let the programme routes swallow the application review path', async () => {
      // PATCH /admin/grants/applications/:id belongs to admin.routes.ts; it has
      // three segments, so /grants/:id above never matches it.
      const res = await request(app).patch('/api/admin/grants/applications/app-1').send({ status: 'AWARDED' });
      expect(prisma.grant.findUnique).not.toHaveBeenCalled();
      expect(res.status).not.toBe(404);
    });
  });
});
