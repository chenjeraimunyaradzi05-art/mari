/**
 * Feature flags: who sees a feature, and who can change that.
 *
 * Neither the routes nor the bucketing had a test. A flag decides which
 * members a feature reaches, so the things held here are the ones that would
 * put something in front of the wrong people: the admin gate, the input
 * checks, the deny list beating the allow list, the rollout share being
 * stable per member, a re-save never widening a partial rollout to everyone,
 * and every change leaving an audit row.
 */

import express from 'express';
import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

let role = 'ADMIN';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    featureFlag: {
      findMany: jest.fn(async () => []),
      findUnique: jest.fn(async () => null),
      upsert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    auditLog: { create: jest.fn(async () => ({ id: 'audit-1' })) },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'staff-1', role, email: 'staff@athena.test' };
    next();
  },
  optionalAuth: (req: any, _res: any, next: any) => {
    if (req.headers['x-test-user']) req.user = { id: req.headers['x-test-user'], role: 'USER' };
    next();
  },
  requireRole:
    (...roles: string[]) =>
    (req: any, res: any, next: any) =>
      roles.includes(req.user?.role) ? next() : res.status(403).json({ error: 'Forbidden' }),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  redactSensitive: (value: unknown) => value,
}));

import featureFlagRoutes from '../feature-flags.routes';
import { errorHandler } from '../../middleware/errorHandler';
import { prisma as prismaTyped } from '../../utils/prisma';
import { evaluateFeatureFlag } from '../../services/feature-flags.service';

const app = express();
app.use(express.json());
app.use('/api/feature-flags', featureFlagRoutes);
app.use(errorHandler);

const prisma: any = prismaTyped;

const flag = (overrides: Record<string, unknown> = {}) => ({
  id: 'flag-1',
  key: 'new_feed',
  name: 'New feed',
  description: null,
  enabled: true,
  rolloutPercentage: 20,
  allowList: [] as string[],
  denyList: [] as string[],
  tags: [] as string[],
  metadata: null,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  role = 'ADMIN';
});

describe('evaluateFeatureFlag', () => {
  it('keeps a disabled flag off for everyone, allow list included', () => {
    expect(evaluateFeatureFlag({ ...flag({ enabled: false, allowList: ['u1'] }) }, 'u1')).toBe(false);
  });

  it('lets the deny list win over the allow list', () => {
    expect(evaluateFeatureFlag(flag({ allowList: ['u1'], denyList: ['u1'], rolloutPercentage: 100 }), 'u1')).toBe(false);
  });

  it('lets the allow list through a zero rollout', () => {
    expect(evaluateFeatureFlag(flag({ allowList: ['u1'], rolloutPercentage: 0 }), 'u1')).toBe(true);
    expect(evaluateFeatureFlag(flag({ rolloutPercentage: 0 }), 'u2')).toBe(false);
  });

  it('never shows a partial rollout to a visitor with no account', () => {
    expect(evaluateFeatureFlag(flag({ rolloutPercentage: 99 }))).toBe(false);
    expect(evaluateFeatureFlag(flag({ rolloutPercentage: 100 }))).toBe(true);
  });

  it('gives each member the same answer every time, and roughly the share asked for', () => {
    const f = flag({ rolloutPercentage: 20 });
    const members = Array.from({ length: 2000 }, (_, i) => `member-${i}`);
    const first = members.map((id) => evaluateFeatureFlag(f, id));
    const second = members.map((id) => evaluateFeatureFlag(f, id));

    expect(second).toEqual(first);
    const share = first.filter(Boolean).length / members.length;
    expect(share).toBeGreaterThan(0.15);
    expect(share).toBeLessThan(0.25);
  });
});

describe('/api/feature-flags', () => {
  it('shows a member only the flags that are on for her', async () => {
    prisma.featureFlag.findMany.mockResolvedValue([
      flag({ key: 'for_her', allowList: ['member-7'], rolloutPercentage: 0 }),
      flag({ key: 'not_for_her', denyList: ['member-7'], rolloutPercentage: 100 }),
    ]);

    const res = await request(app).get('/api/feature-flags/active').set('x-test-user', 'member-7');

    expect(res.status).toBe(200);
    expect(res.body.flags.map((f: any) => f.key)).toEqual(['for_her']);
    // The allow and deny lists are other members' ids and never leave the server.
    expect(JSON.stringify(res.body)).not.toContain('allowList');
  });

  it('keeps the flag list and every change to admins', async () => {
    role = 'MODERATOR';

    await request(app).get('/api/feature-flags').expect(403);
    await request(app).post('/api/feature-flags').send({ key: 'x_flag', name: 'X' }).expect(403);
    expect(prisma.featureFlag.upsert).not.toHaveBeenCalled();
  });

  it('refuses a malformed key or an out-of-range rollout', async () => {
    await request(app).post('/api/feature-flags').send({ key: 'has spaces', name: 'X' }).expect(400);
    await request(app).post('/api/feature-flags').send({ key: 'ok_key', name: 'X', rolloutPercentage: 150 }).expect(400);
    expect(prisma.featureFlag.upsert).not.toHaveBeenCalled();
  });

  it('records who created a flag and for how many', async () => {
    prisma.featureFlag.upsert.mockResolvedValue(flag({ allowList: ['a', 'b'] }));

    const res = await request(app)
      .post('/api/feature-flags')
      .send({ key: 'new_feed', name: 'New feed', enabled: true, rolloutPercentage: 20, allowList: ['a', 'b'] });

    expect(res.status).toBe(201);
    const audit = prisma.auditLog.create.mock.calls[0][0].data;
    expect(audit.actorUserId).toBe('staff-1');
    expect(audit.metadata).toMatchObject({
      adminAction: 'FEATURE_FLAG_CREATED',
      resourceId: 'new_feed',
      rolloutPercentage: 20,
      allowListSize: 2,
    });
  });

  it('does not widen an existing partial rollout to everyone when the flag is re-saved', async () => {
    prisma.featureFlag.upsert.mockResolvedValue(flag());

    await request(app).post('/api/feature-flags').send({ key: 'new_feed', name: 'New feed, renamed' }).expect(201);

    const args = prisma.featureFlag.upsert.mock.calls[0][0];
    // A brand-new flag starts at 100; an existing one keeps its share.
    expect(args.create.rolloutPercentage).toBe(100);
    expect(args.update.rolloutPercentage).toBeUndefined();
  });

  it('answers 404 for a flag that is not there, and writes no audit row', async () => {
    prisma.featureFlag.findUnique.mockResolvedValue(null);

    await request(app).patch('/api/feature-flags/nope').send({ enabled: false }).expect(404);
    await request(app).delete('/api/feature-flags/nope').expect(404);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('records a deletion', async () => {
    prisma.featureFlag.findUnique.mockResolvedValue(flag());
    prisma.featureFlag.delete.mockResolvedValue(flag());

    await request(app).delete('/api/feature-flags/new_feed').expect(200);

    expect(prisma.auditLog.create.mock.calls[0][0].data.metadata).toMatchObject({
      adminAction: 'FEATURE_FLAG_DELETED',
      resourceId: 'new_feed',
    });
  });
});
