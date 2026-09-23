/**
 * The staff safety queue.
 *
 * AdminFlag had two writers and no reader: crisis language in a wellness
 * forum post and a safety score falling below 25 both wrote a HIGH-severity
 * row, and nothing on the platform ever read one. These tests hold the two
 * things that make the reader worth having — that a HIGH-severity flag cannot
 * be pushed off the page by newer minor ones, and that closing a flag is
 * attributable to the member of staff who closed it.
 */

import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    adminFlag: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), count: jest.fn() },
    user: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    profile: { findUnique: jest.fn(), upsert: jest.fn() },
    userSafetySettings: { findUnique: jest.fn(), upsert: jest.fn() },
    auditLog: { create: jest.fn() },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'mod-1', role: 'MODERATOR', email: 'mod@athena.com', twoFactorEnabled: true };
    next();
  },
  optionalAuth: (req: any, _res: any, next: any) => next(),
  requireRole: (..._roles: string[]) => (_req: any, __res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  redactSensitive: (value: unknown) => value,
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;

const flag = (overrides: Record<string, unknown> = {}) => ({
  id: 'flag-1',
  userId: 'member-1',
  type: 'SAFETY_CONCERN',
  reason: 'Language about suicide or self-harm in a wellness forum post; the crisis lines were shown to the author',
  severity: 'HIGH',
  flaggedById: 'member-1',
  notes: 'Post post-1',
  resolvedAt: null,
  resolvedById: null,
  isActive: true,
  createdAt: new Date('2026-09-01T00:00:00Z'),
  updatedAt: new Date('2026-09-01T00:00:00Z'),
  ...overrides,
});

describe('GET /api/safety/moderation/flags', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findMany.mockResolvedValue([
      { id: 'member-1', firstName: 'Sarah', lastName: null, displayName: null, email: 'sarah@example.com', isSuspended: false },
    ]);
    prisma.adminFlag.count.mockResolvedValue(2);
  });

  it('puts the urgent flags above everything else, whatever their dates', async () => {
    // The urgent query is asked first and the remainder fills the page
    // underneath it. Severity is a plain string column, so a single
    // orderBy on it would sort LOW above MEDIUM and could bury a HIGH
    // safety concern under a pile of newer minor flags.
    prisma.adminFlag.findMany
      .mockResolvedValueOnce([flag({ id: 'flag-old-high', createdAt: new Date('2026-01-01T00:00:00Z') })])
      .mockResolvedValueOnce([
        flag({ id: 'flag-new-low', severity: 'LOW', type: 'POLICY_VIOLATION', createdAt: new Date('2026-09-20T00:00:00Z') }),
      ]);

    const res = await request(app).get('/api/safety/moderation/flags').expect(200);

    expect(res.body.flags.map((row: any) => row.id)).toEqual(['flag-old-high', 'flag-new-low']);
    expect(res.body.flags[0]).toMatchObject({ isUrgent: true, severity: 'HIGH' });
    expect(res.body.flags[1].isUrgent).toBe(false);
    expect(prisma.adminFlag.findMany.mock.calls[0][0].where).toMatchObject({
      resolvedAt: null,
      severity: { in: ['CRITICAL', 'HIGH'] },
    });
  });

  it('names the member the flag is about, and says when the platform raised it itself', async () => {
    prisma.adminFlag.findMany
      .mockResolvedValueOnce([flag({ id: 'flag-score', type: 'SAFETY_CRITICAL', flaggedById: 'system' })])
      .mockResolvedValueOnce([]);

    const res = await request(app).get('/api/safety/moderation/flags').expect(200);

    expect(res.body.flags[0].member).toMatchObject({ id: 'member-1', email: 'sarah@example.com' });
    // 'system' is not a user id, so nothing is found for it and the flag is
    // presented as the platform's own rather than as a member's report.
    expect(res.body.flags[0]).toMatchObject({ raisedBySystem: true, raisedBy: null });
  });
});

describe('POST /api/safety/moderation/flags/:id/resolve', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.auditLog.create.mockResolvedValue({});
  });

  it('closes the flag, keeps the original note and records who closed it', async () => {
    prisma.adminFlag.findUnique.mockResolvedValue(flag());
    prisma.adminFlag.update.mockResolvedValue({ id: 'flag-1', resolvedAt: new Date() });

    await request(app)
      .post('/api/safety/moderation/flags/flag-1/resolve')
      .send({ notes: 'Rang her, she is with her sister tonight' })
      .expect(200);

    const written = prisma.adminFlag.update.mock.calls[0][0].data;
    expect(written).toMatchObject({ resolvedById: 'mod-1', isActive: false });
    expect(written.resolvedAt).toBeInstanceOf(Date);
    // The original note says which post raised the flag. Replacing it would
    // leave the row unreadable a month later.
    expect(written.notes).toContain('Post post-1');
    expect(written.notes).toContain('Rang her, she is with her sister tonight');

    expect(prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
      actorUserId: 'mod-1',
      targetUserId: 'member-1',
      metadata: expect.objectContaining({ adminAction: 'SAFETY_FLAG_RESOLVED', resourceId: 'flag-1' }),
    });
  });

  it('refuses to close a flag twice, so one moderator cannot overwrite another', async () => {
    prisma.adminFlag.findUnique.mockResolvedValue(flag({ resolvedAt: new Date('2026-09-02T00:00:00Z'), resolvedById: 'mod-2' }));

    await request(app).post('/api/safety/moderation/flags/flag-1/resolve').send({}).expect(409);

    expect(prisma.adminFlag.update).not.toHaveBeenCalled();
  });

  it('answers 404 for a flag that is not there', async () => {
    prisma.adminFlag.findUnique.mockResolvedValue(null);

    await request(app).post('/api/safety/moderation/flags/nope/resolve').send({}).expect(404);
  });
});
