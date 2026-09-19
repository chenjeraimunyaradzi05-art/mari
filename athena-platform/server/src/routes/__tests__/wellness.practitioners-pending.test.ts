import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// The practitioner approval queue: who may read it, what it lists, and that
// a new practice reaches the admins at all.

const row = {
  id: 'pr-new', slug: 'dr-new', name: 'Dr New', kind: 'PSYCHOLOGIST', headline: 'A perinatal psychologist', bio: 'Twenty years of perinatal work in Brisbane.',
  qualifications: ['MPsych'], modalities: [], specialties: [], languages: ['English'], suburb: null, city: 'Brisbane', state: 'QLD',
  telehealth: true, inPerson: false, bulkBilling: false, medicareRebate: true, privateHealth: false, feeFrom: null, feeNote: null,
  ahpraNumber: 'PSY0001234567', website: 'https://example.org', phone: null, bookingUrl: null, availability: null, slotMinutes: 50, acceptsBookings: true,
  ownerUserId: 'doctor', isVerified: false, isActive: true, ratingAvg: 0, ratingCount: 0, createdAt: new Date('2026-09-01T00:00:00Z'),
  owner: { id: 'doctor', firstName: 'Kate', lastName: 'New', displayName: null, email: 'kate@example.org' },
};

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn(async () => ({ timezone: 'Australia/Brisbane' })), findMany: jest.fn(async () => [{ id: 'admin-1' }, { id: 'admin-2' }]) },
    healthPractitioner: {
      findMany: jest.fn(async () => [row]),
      findUnique: jest.fn(async () => null),
      create: jest.fn(async ({ data }: any) => ({ ...row, ...data, id: 'pr-created' })),
      update: jest.fn(async ({ where, data }: any) => ({ ...row, id: where.id, ...data })),
    },
    notification: { create: jest.fn(async () => ({})), createMany: jest.fn(async () => ({ count: 2 })) },
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

describe('The practitioner approval queue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('is closed to members and moderators', async () => {
    // requireRole here is the real one from middleware/roles, so the role is checked.
    await request(app).get('/api/wellness/practitioners/pending').set(as('member')).expect(403);
    await request(app).get('/api/wellness/practitioners/pending').set(as('mod', 'MODERATOR')).expect(403);
    expect(prisma.healthPractitioner.findMany).not.toHaveBeenCalled();
  });

  it('lists only active, unverified profiles for an admin, oldest first, with what the check needs', async () => {
    const res = await request(app).get('/api/wellness/practitioners/pending').set(as('boss', 'ADMIN')).expect(200);

    const query = prisma.healthPractitioner.findMany.mock.calls[0][0];
    expect(query.where).toEqual({ isActive: true, isVerified: false });
    expect(query.orderBy).toEqual({ createdAt: 'asc' });

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ id: 'pr-new', name: 'Dr New', kindLabel: 'Psychologist', ahpraNumber: 'PSY0001234567', qualifications: ['MPsych'], state: 'QLD', website: 'https://example.org' });
    expect(res.body.data[0].owner).toEqual({ id: 'doctor', name: 'Kate New', email: 'kate@example.org' });
    // "pending" is a queue, not a slug: the slug route was never consulted.
    expect(prisma.healthPractitioner.findUnique).not.toHaveBeenCalled();
  });

  it('tells every admin when a practice is created, and says where the queue is', async () => {
    const res = await request(app)
      .put('/api/wellness/practice')
      .set(as('doctor'))
      .send({ name: 'Dr New', kind: 'PSYCHOLOGIST', headline: 'A perinatal psychologist', bio: 'Twenty years of perinatal work in Brisbane.', ahpraNumber: 'PSY0001234567' })
      .expect(201);

    expect(res.body.data.pendingVerification).toBe(true);
    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { role: 'ADMIN' } }));
    const notices = prisma.notification.createMany.mock.calls[0][0].data;
    expect(notices.map((n: any) => n.userId)).toEqual(['admin-1', 'admin-2']);
    expect(notices[0]).toMatchObject({ title: 'A practitioner wants to join the directory', link: '/admin/practitioners', data: { kind: 'WELLNESS_PRACTITIONER_VERIFY', practitionerId: 'pr-created' } });
  });

  it('verifying tells the owner she is live; hiding takes the profile out of the queue too', async () => {
    await request(app).patch('/api/wellness/practitioners/pr-new/verify').set(as('member')).send({ isVerified: true }).expect(403);

    await request(app).patch('/api/wellness/practitioners/pr-new/verify').set(as('boss', 'ADMIN')).send({ isVerified: true }).expect(200);
    expect(prisma.healthPractitioner.update).toHaveBeenCalledWith({ where: { id: 'pr-new' }, data: { isVerified: true } });
    expect(prisma.notification.create.mock.calls[0][0].data).toMatchObject({ userId: 'doctor', title: 'Your practice profile is live', link: '/dashboard/wellness/practice' });

    await request(app).patch('/api/wellness/practitioners/pr-new/verify').set(as('boss', 'ADMIN')).send({ isVerified: false, isActive: false }).expect(200);
    expect(prisma.healthPractitioner.update).toHaveBeenLastCalledWith({ where: { id: 'pr-new' }, data: { isVerified: false, isActive: false } });
    expect(prisma.notification.create.mock.calls[1][0].data).toMatchObject({ userId: 'doctor', title: 'Your practice profile is hidden' });
  });
});
