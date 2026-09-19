import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    verificationBadge: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    organizationMember: {
      findUnique: jest.fn(),
      findMany: jest.fn(async () => []),
    },
    organization: {
      update: jest.fn(async () => ({})),
    },
    notification: {
      create: jest.fn(async () => ({})),
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
    req.user = { id: 'admin-1', role: 'ADMIN', email: 'admin@athena.com' };
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
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import app from '../../index';
import { prisma } from '../../utils/prisma';

const prismaAny: any = prisma;

const ORG = { id: 'org-1', name: 'Brisbane Robotics', isVerified: false };

const badge = (overrides: Record<string, unknown> = {}) => ({
  id: 'badge-1',
  userId: 'owner-1',
  type: 'EMPLOYER',
  status: 'APPROVED',
  metadata: { organizationId: 'org-1', abn: '51824753556', website: 'https://brisbanerobotics.example' },
  ...overrides,
});

const membership = (role: string) => ({ role, organization: ORG });

describe('Organisation verification through the badge review', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaAny.organizationMember.findMany.mockResolvedValue([{ userId: 'owner-1' }]);
    prismaAny.organization.update.mockResolvedValue({ ...ORG, isVerified: true });
  });

  describe('approving an EMPLOYER badge that names an organisation', () => {
    it('verifies the organisation when the holder owns it', async () => {
      prismaAny.verificationBadge.update.mockResolvedValue(badge());
      prismaAny.organizationMember.findUnique.mockResolvedValue(membership('OWNER'));

      const res = await request(app).patch('/api/verification/badges/badge-1').send({ status: 'APPROVED' }).expect(200);

      expect(prismaAny.organizationMember.findUnique.mock.calls[0][0].where).toEqual({
        organizationId_userId: { organizationId: 'org-1', userId: 'owner-1' },
      });
      expect(prismaAny.organization.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'org-1' }, data: { isVerified: true } }));
      expect(res.body.data.organization).toEqual({ organizationId: 'org-1', name: 'Brisbane Robotics', verified: true });
    });

    it('verifies it for an organisation ADMIN too', async () => {
      prismaAny.verificationBadge.update.mockResolvedValue(badge());
      prismaAny.organizationMember.findUnique.mockResolvedValue(membership('ADMIN'));

      await request(app).patch('/api/verification/badges/badge-1').send({ status: 'APPROVED' }).expect(200);

      expect(prismaAny.organization.update).toHaveBeenCalledTimes(1);
    });

    it('tells the owner, once, even when the holder is that owner', async () => {
      prismaAny.verificationBadge.update.mockResolvedValue(badge());
      prismaAny.organizationMember.findUnique.mockResolvedValue(membership('OWNER'));

      await request(app).patch('/api/verification/badges/badge-1').send({ status: 'APPROVED' }).expect(200);

      expect(prismaAny.notification.create).toHaveBeenCalledTimes(1);
      expect(prismaAny.notification.create.mock.calls[0][0].data).toMatchObject({
        userId: 'owner-1',
        link: '/employer/organizations/org-1',
      });
    });

    it('also tells a separate owner when an admin applied', async () => {
      prismaAny.verificationBadge.update.mockResolvedValue(badge({ userId: 'admin-2' }));
      prismaAny.organizationMember.findUnique.mockResolvedValue(membership('ADMIN'));
      prismaAny.organizationMember.findMany.mockResolvedValue([{ userId: 'owner-1' }]);

      await request(app).patch('/api/verification/badges/badge-1').send({ status: 'APPROVED' }).expect(200);

      const told = prismaAny.notification.create.mock.calls.map((c: any) => c[0].data.userId).sort();
      expect(told).toEqual(['admin-2', 'owner-1']);
    });

    it('leaves the organisation alone when the holder is only a recruiter, and says so', async () => {
      prismaAny.verificationBadge.update.mockResolvedValue(badge());
      prismaAny.organizationMember.findUnique.mockResolvedValue(membership('RECRUITER'));

      const res = await request(app).patch('/api/verification/badges/badge-1').send({ status: 'APPROVED' }).expect(200);

      expect(prismaAny.organization.update).not.toHaveBeenCalled();
      expect(prismaAny.notification.create).not.toHaveBeenCalled();
      expect(res.body.data.organization).toMatchObject({ organizationId: 'org-1', verified: false });
      expect(res.body.data.organization.reason).toMatch(/owner or admin/);
    });

    it('leaves it alone when the holder is not a member at all', async () => {
      prismaAny.verificationBadge.update.mockResolvedValue(badge());
      prismaAny.organizationMember.findUnique.mockResolvedValue(null);

      const res = await request(app).patch('/api/verification/badges/badge-1').send({ status: 'APPROVED' }).expect(200);

      expect(prismaAny.organization.update).not.toHaveBeenCalled();
      expect(res.body.data.organization).toMatchObject({ verified: false });
      expect(res.body.data.status).toBe('APPROVED');
    });

    it('does nothing on rejection', async () => {
      prismaAny.verificationBadge.update.mockResolvedValue(badge({ status: 'REJECTED' }));

      const res = await request(app).patch('/api/verification/badges/badge-1').send({ status: 'REJECTED', reason: 'ABN belongs to a different entity' }).expect(200);

      expect(prismaAny.organizationMember.findUnique).not.toHaveBeenCalled();
      expect(prismaAny.organization.update).not.toHaveBeenCalled();
      expect(res.body.data.organization).toBeNull();
    });
  });

  it('an EDUCATOR badge verifies a TAFE the same way', async () => {
    prismaAny.verificationBadge.update.mockResolvedValue(badge({ type: 'EDUCATOR' }));
    prismaAny.organizationMember.findUnique.mockResolvedValue(membership('OWNER'));

    await request(app).patch('/api/verification/badges/badge-1').send({ status: 'APPROVED' }).expect(200);

    expect(prismaAny.organization.update).toHaveBeenCalledTimes(1);
  });

  it('a MENTOR badge never touches an organisation, whatever its metadata says', async () => {
    prismaAny.verificationBadge.update.mockResolvedValue(badge({ type: 'MENTOR' }));
    prismaAny.organizationMember.findUnique.mockResolvedValue(membership('OWNER'));

    await request(app).patch('/api/verification/badges/badge-1').send({ status: 'APPROVED' }).expect(200);

    expect(prismaAny.organizationMember.findUnique).not.toHaveBeenCalled();
    expect(prismaAny.organization.update).not.toHaveBeenCalled();
  });

  it('an EMPLOYER badge with no organisation is approved for the person only', async () => {
    prismaAny.verificationBadge.update.mockResolvedValue(badge({ metadata: { organisation: 'Typed by hand', role: 'Talent lead' } }));

    const res = await request(app).patch('/api/verification/badges/badge-1').send({ status: 'APPROVED' }).expect(200);

    expect(prismaAny.organization.update).not.toHaveBeenCalled();
    expect(res.body.data.organization).toBeNull();
  });

  describe('applying on behalf of an organisation', () => {
    it('is refused up front when the applicant does not run it', async () => {
      prismaAny.organizationMember.findUnique.mockResolvedValue(membership('VIEWER'));

      const res = await request(app)
        .post('/api/verification/badges')
        .send({ type: 'EMPLOYER', metadata: { organizationId: 'org-1', abn: '51824753556' } });

      expect(res.status).toBe(403);
      expect(prismaAny.verificationBadge.create).not.toHaveBeenCalled();
    });

    it('goes through for an owner', async () => {
      prismaAny.organizationMember.findUnique.mockResolvedValue(membership('OWNER'));
      prismaAny.verificationBadge.create.mockResolvedValue({ id: 'badge-2', type: 'EMPLOYER', status: 'PENDING' });

      const res = await request(app)
        .post('/api/verification/badges')
        .send({ type: 'EMPLOYER', metadata: { organizationId: 'org-1', abn: '51824753556', website: 'https://brisbanerobotics.example' } });

      expect(res.status).toBe(201);
      expect(prismaAny.verificationBadge.create.mock.calls[0][0].data.metadata).toMatchObject({ organizationId: 'org-1' });
    });

    it('is pointless for an organisation already verified', async () => {
      prismaAny.organizationMember.findUnique.mockResolvedValue({ role: 'OWNER', organization: { ...ORG, isVerified: true } });

      const res = await request(app).post('/api/verification/badges').send({ type: 'EMPLOYER', metadata: { organizationId: 'org-1' } });

      expect(res.status).toBe(409);
    });

    it('cannot ride on a MENTOR badge', async () => {
      const res = await request(app).post('/api/verification/badges').send({ type: 'MENTOR', metadata: { organizationId: 'org-1' } });

      expect(res.status).toBe(400);
      expect(prismaAny.organizationMember.findUnique).not.toHaveBeenCalled();
    });
  });
});
