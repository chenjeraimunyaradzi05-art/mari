/**
 * Reporting, blocking, and what happens to a report afterwards.
 *
 * The staff flag queue and the settings each had tests; the paths a member
 * actually uses when someone is hurting her did not. A report has to name an
 * account a moderator can act on, a block has to count once, and — new here —
 * a report now gets decided: upheld, or dismissed so that it stops counting
 * against the person it was about. The pre-post content check is covered
 * too, since it now asks for a signed-in member and a length it can carry.
 */

import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn(), findMany: jest.fn(async () => []), update: jest.fn() },
    post: { findUnique: jest.fn(), update: jest.fn(async () => ({})) },
    comment: { findUnique: jest.fn(), update: jest.fn(async () => ({})) },
    contentReport: { create: jest.fn(), findMany: jest.fn(async () => []) },
    safetyIncident: { findMany: jest.fn(async () => []), findUnique: jest.fn(), count: jest.fn(async () => 0) },
    auditLog: { create: jest.fn(async () => ({})) },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, res: any, next: any) => {
    const id = req.headers['x-test-user'];
    if (!id) return res.status(401).json({ success: false, message: 'Authentication required' });
    req.user = { id, role: req.headers['x-test-role'] || 'USER', email: `${id}@athena.test`, twoFactorEnabled: true };
    next();
  },
  optionalAuth: (_req: any, _res: any, next: any) => next(),
  requireRole: (..._roles: string[]) => (_req: any, _res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

const scoring = {
  handleUserReport: jest.fn(async (..._args: unknown[]) => undefined),
  handleUserBlock: jest.fn(async (..._args: unknown[]) => undefined),
  verifyReport: jest.fn(async (..._args: unknown[]) => undefined),
  getSafetyStatus: jest.fn(async () => ({ score: 60, level: 'GOOD', badges: [], assessedAt: new Date('2026-09-20T00:00:00Z') })),
  calculateSafetyScore: jest.fn(async () => ({ score: 55, factors: [{ category: 'incident', impact: -10, details: 'REPORT - spam (recent)' }], riskLevel: 'MEDIUM', restrictions: ['rate_limited'], lastUpdated: new Date() })),
};
jest.mock('../../services/safety-score.service', () => scoring);

jest.mock('../../services/trust.service', () => ({
  recordSafetyReport: jest.fn(async () => undefined),
  recordUserBlock: jest.fn(async () => undefined),
}));

jest.mock('../../services/moderation-threshold.service', () => ({
  reviewReportedContent: jest.fn(async () => false),
}));

const store = {
  blockUser: jest.fn(async () => ({ created: true })),
  listBlockedUsers: jest.fn(async () => [] as any[]),
  unblockUser: jest.fn(async () => undefined),
};
jest.mock('../../utils/safety-store', () => store);

const evaluateSafetyScore = jest.fn(async (_content: string) => ({ score: 100, signals: [] }));
jest.mock('../../services/moderation.service', () => ({
  ...(jest.requireActual('../../services/moderation.service') as object),
  evaluateSafetyScore: (content: string) => evaluateSafetyScore(content),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  redactSensitive: (value: unknown) => value,
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;
const as = (id: string, role = 'USER') => ({ 'x-test-user': id, 'x-test-role': role });

beforeEach(() => {
  jest.clearAllMocks();
  store.blockUser.mockResolvedValue({ created: true });
  store.listBlockedUsers.mockResolvedValue([]);
  prisma.safetyIncident.count.mockResolvedValue(0);
});

describe('POST /api/safety (checking text before it is posted)', () => {
  it('is closed to anyone not signed in, so a stranger cannot spend the moderation budget', async () => {
    await request(app).post('/api/safety').send({ content: 'hello' }).expect(401);
    expect(evaluateSafetyScore).not.toHaveBeenCalled();
  });

  it('refuses text longer than anything a member can post', async () => {
    await request(app).post('/api/safety').set(as('her')).send({ content: 'x'.repeat(10_001) }).expect(400);
    expect(evaluateSafetyScore).not.toHaveBeenCalled();
  });

  it('checks the text for a signed-in member', async () => {
    await request(app).post('/api/safety').set(as('her')).send({ content: 'hello' }).expect(200);
    expect(evaluateSafetyScore).toHaveBeenCalledWith('hello');
  });
});

describe('POST /api/safety/reports', () => {
  it('refuses a report the moderation queue could not route to an account', async () => {
    prisma.post.findUnique.mockResolvedValue(null);

    await request(app).post('/api/safety/reports').set(as('her')).send({ targetType: 'post', targetId: 'gone', reason: 'harassment' }).expect(400);

    expect(prisma.contentReport.create).not.toHaveBeenCalled();
    expect(scoring.handleUserReport).not.toHaveBeenCalled();
  });

  it('files a report against the author of the post, from the signed-in reporter', async () => {
    prisma.post.findUnique.mockResolvedValue({ authorId: 'him' });
    prisma.contentReport.create.mockImplementation(async ({ data }: any) => ({ id: 'rep-1', ...data, createdAt: new Date(), updatedAt: new Date() }));

    const res = await request(app)
      .post('/api/safety/reports')
      .set(as('her'))
      .send({ targetType: 'post', targetId: 'post-1', reason: 'harassment', details: 'He keeps posting my address' })
      .expect(201);

    expect(prisma.contentReport.create.mock.calls[0][0].data).toMatchObject({ reporterId: 'her', reportedUserId: 'him', contentType: 'POST', contentId: 'post-1' });
    expect(scoring.handleUserReport).toHaveBeenCalledWith('him', 'her', 'harassment', 'post-1', 'post');
    expect(res.body.data.status).toBe('SUBMITTED');
  });
});

describe('POST /api/safety/blocks', () => {
  it('will not let her block herself', async () => {
    await request(app).post('/api/safety/blocks').set(as('her')).send({ blockedUserId: 'her' }).expect(400);
    expect(store.blockUser).not.toHaveBeenCalled();
  });

  it('answers 404 for an account that does not exist', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await request(app).post('/api/safety/blocks').set(as('her')).send({ blockedUserId: 'nobody' }).expect(404);
    expect(store.blockUser).not.toHaveBeenCalled();
  });

  it('counts a block against the blocked account once, however many times she presses it', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'him' });
    store.listBlockedUsers.mockResolvedValue([{ blockedUserId: 'him', createdAt: new Date().toISOString() }]);

    await request(app).post('/api/safety/blocks').set(as('her')).send({ blockedUserId: 'him' }).expect(201);
    expect(scoring.handleUserBlock).toHaveBeenCalledWith('him', 'her');

    store.blockUser.mockResolvedValue({ created: false });
    await request(app).post('/api/safety/blocks').set(as('her')).send({ blockedUserId: 'him' }).expect(200);
    expect(scoring.handleUserBlock).toHaveBeenCalledTimes(1);
  });
});

describe('Deciding a report', () => {
  const incident = (overrides: Record<string, unknown> = {}) => ({
    id: 'inc-1',
    userId: 'him',
    type: 'REPORT',
    severity: 'MEDIUM',
    reason: 'harassment',
    reporterId: 'her',
    contentId: 'post-1',
    contentType: 'post',
    verified: false,
    resolvedAt: null,
    resolvedById: null,
    createdAt: new Date('2026-09-10T00:00:00Z'),
    updatedAt: new Date('2026-09-10T00:00:00Z'),
    ...overrides,
  });

  it('lists the reports still waiting for a decision, oldest first', async () => {
    prisma.safetyIncident.findMany.mockResolvedValue([incident()]);
    prisma.safetyIncident.count.mockResolvedValue(1);

    const res = await request(app).get('/api/safety/moderation/incidents').set(as('mod', 'MODERATOR')).expect(200);

    const query = prisma.safetyIncident.findMany.mock.calls[0][0];
    expect(query.where).toEqual({ type: 'REPORT', resolvedAt: null });
    expect(query.orderBy).toEqual({ createdAt: 'asc' });
    expect(query.take).toBeLessThanOrEqual(100);
    expect(res.body.data[0]).toMatchObject({ id: 'inc-1', decided: false, upheld: null });
  });

  it('is not open to members', async () => {
    await request(app).get('/api/safety/moderation/incidents').set(as('her')).expect(403);
    await request(app).post('/api/safety/moderation/incidents/inc-1/decision').set(as('her')).send({ upheld: true }).expect(403);
    expect(scoring.verifyReport).not.toHaveBeenCalled();
  });

  it('records the decision, says who made it, and returns the score it left', async () => {
    prisma.safetyIncident.findUnique.mockResolvedValue(incident());

    const res = await request(app)
      .post('/api/safety/moderation/incidents/inc-1/decision')
      .set(as('mod', 'MODERATOR'))
      .send({ upheld: false, notes: 'Screenshot shows a joke between friends' })
      .expect(200);

    expect(scoring.verifyReport).toHaveBeenCalledWith('inc-1', false, 'mod');
    expect(res.body.data).toMatchObject({ upheld: false, score: 60 });
    const audit = prisma.auditLog.create.mock.calls[0][0].data;
    expect(audit).toMatchObject({ actorUserId: 'mod', targetUserId: 'him' });
    expect(audit.metadata).toMatchObject({ adminAction: 'SAFETY_REPORT_DISMISSED', resourceId: 'inc-1' });
  });

  it('will not decide a report twice, or one that does not exist', async () => {
    prisma.safetyIncident.findUnique.mockResolvedValue(incident({ resolvedAt: new Date(), verified: true }));
    await request(app).post('/api/safety/moderation/incidents/inc-1/decision').set(as('mod', 'MODERATOR')).send({ upheld: false }).expect(409);

    prisma.safetyIncident.findUnique.mockResolvedValue(null);
    await request(app).post('/api/safety/moderation/incidents/nope/decision').set(as('mod', 'MODERATOR')).send({ upheld: true }).expect(404);

    // A block is not a report and has nothing to rule on.
    prisma.safetyIncident.findUnique.mockResolvedValue(incident({ type: 'BLOCK' }));
    await request(app).post('/api/safety/moderation/incidents/inc-1/decision').set(as('mod', 'MODERATOR')).send({ upheld: true }).expect(404);

    expect(scoring.verifyReport).not.toHaveBeenCalled();
  });

  it('insists on a yes or a no', async () => {
    await request(app).post('/api/safety/moderation/incidents/inc-1/decision').set(as('mod', 'MODERATOR')).send({}).expect(400);
    expect(scoring.verifyReport).not.toHaveBeenCalled();
  });

  it('shows a moderator why a score is what it is, beside the score the platform is acting on', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'him', firstName: 'Him', lastName: null, displayName: null, isSuspended: false });

    const res = await request(app).get('/api/safety/moderation/members/him/safety-score').set(as('mod', 'MODERATOR')).expect(200);

    expect(res.body.data.stored).toMatchObject({ score: 60, level: 'GOOD' });
    expect(res.body.data.current.factors[0]).toMatchObject({ impact: -10 });

    prisma.user.findUnique.mockResolvedValue(null);
    await request(app).get('/api/safety/moderation/members/nobody/safety-score').set(as('mod', 'MODERATOR')).expect(404);
  });
});
