import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/**
 * The yearly re-check, as the admins and the practitioner see it. The admins
 * get every verified practitioner with when she was last checked and when she
 * lapses, most urgent first; the practitioner's own page says when she was
 * checked and when the next check falls, so a listing coming down is never a
 * surprise. Who checked her is the admins' business, not hers.
 */

const verified = (id: string, over: Record<string, unknown> = {}) => ({
  id, slug: `dr-${id}`, name: `Dr ${id}`, kind: 'PSYCHOLOGIST', headline: 'A perinatal psychologist', bio: 'Twenty years of perinatal work in Brisbane.',
  qualifications: ['MPsych'], modalities: [], specialties: [], languages: ['English'], suburb: null, city: 'Brisbane', state: 'QLD',
  telehealth: true, inPerson: false, bulkBilling: false, medicareRebate: true, privateHealth: false, feeFrom: null, feeNote: null,
  ahpraNumber: 'PSY0001234567', website: null, phone: null, bookingUrl: null, availability: null, slotMinutes: 50, acceptsBookings: true,
  ownerUserId: `owner-${id}`, isVerified: true, isActive: true, ratingAvg: 0, ratingCount: 0, createdAt: new Date('2025-01-01T00:00:00Z'),
  ...over,
});

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn(async () => ({ timezone: 'Australia/Brisbane' })), findMany: jest.fn(async () => []) },
    healthPractitioner: { findMany: jest.fn(async () => []), findUnique: jest.fn(async () => null) },
    healthBooking: { groupBy: jest.fn(async () => []) },
    auditLog: { findMany: jest.fn(async () => []), create: jest.fn(async () => ({})) },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: req.headers['x-test-user'] || 'member', role: req.headers['x-test-role'] || 'USER', email: 'x@athena.com' };
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
const as = (userId: string, role = 'USER') => ({ 'x-test-user': userId, 'x-test-role': role });
const DAY = 24 * 60 * 60 * 1000;
const approval = (id: string, at: Date, check?: Record<string, unknown>) => ({ createdAt: at, actorUserId: 'admin-7', metadata: { resourceType: 'HealthPractitioner', resourceId: id, ...(check ? { check } : {}) } });

beforeEach(() => {
  jest.clearAllMocks();
});

describe('The re-check list', () => {
  it('is closed to members and moderators', async () => {
    // requireRole here is the real one from middleware/roles, so the role is checked.
    await request(app).get('/api/wellness/practitioners/rechecks').set(as('member')).expect(403);
    await request(app).get('/api/wellness/practitioners/rechecks').set(as('mod', 'MODERATOR')).expect(403);
    expect(prisma.healthPractitioner.findMany).not.toHaveBeenCalled();
  });

  it('lists every verified practitioner with where her check stands, the one lapsing soonest first', async () => {
    prisma.healthPractitioner.findMany.mockResolvedValue([verified('recent'), verified('old')]);
    prisma.auditLog.findMany.mockResolvedValue([
      approval('recent', new Date(Date.now() - 10 * DAY), { register: 'PROFESSIONAL_BODY', registerName: 'PACFA', note: 'Clinical member, name and location match.' }),
      // A row from before the register was recorded: still a check, with nothing to say about where the admin looked.
      approval('old', new Date(Date.now() - 380 * DAY)),
    ]);

    const res = await request(app).get('/api/wellness/practitioners/rechecks').set(as('boss', 'ADMIN')).expect(200);

    expect(prisma.healthPractitioner.findMany.mock.calls[0][0].where).toEqual({ isVerified: true });
    const { rechecks, rules } = res.body.data;
    expect(rules).toEqual({ recheckAfterDays: 365, graceDays: 30 });
    expect(rechecks.map((r: any) => r.id)).toEqual(['old', 'recent']);
    expect(rechecks[0].verification).toMatchObject({ status: 'DUE', checkedById: 'admin-7', recordMissing: false });
    expect(rechecks[0].verification.checkedAgainst).toBeUndefined();
    expect(rechecks[1].verification).toMatchObject({ status: 'CURRENT', checkedAgainst: 'PACFA' });
    // The admin's note is for the audit row, not the list.
    expect(JSON.stringify(rechecks)).not.toContain('Clinical member');
  });
});

describe('The practice page', () => {
  it('tells a verified practitioner when she was checked and when the next check falls, without naming the admin', async () => {
    const checkedAt = new Date(Date.now() - 30 * DAY);
    prisma.healthPractitioner.findUnique.mockResolvedValue(verified('me', { ownerUserId: 'doctor' }));
    prisma.auditLog.findMany.mockResolvedValue([approval('me', checkedAt)]);

    const res = await request(app).get('/api/wellness/practice').set(as('doctor')).expect(200);

    const { verification } = res.body.data.profile;
    expect(verification).toEqual({
      checkedAt: checkedAt.toISOString(),
      dueAt: new Date(checkedAt.getTime() + 365 * DAY).toISOString(),
      lapsesAt: new Date(checkedAt.getTime() + 395 * DAY).toISOString(),
      status: 'CURRENT',
    });
    // One practitioner, so the audit read asks for her row alone.
    expect(prisma.auditLog.findMany.mock.calls[0][0].take).toBe(1);
  });

  it('has no verification for a profile still waiting for its first check', async () => {
    prisma.healthPractitioner.findUnique.mockResolvedValue(verified('new', { ownerUserId: 'doctor', isVerified: false }));
    const res = await request(app).get('/api/wellness/practice').set(as('doctor')).expect(200);
    expect(res.body.data.profile.verification).toBeNull();
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
  });
});
