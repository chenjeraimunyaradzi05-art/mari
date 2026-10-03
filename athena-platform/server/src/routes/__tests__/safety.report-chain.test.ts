/**
 * Report, decide, appeal, reverse: the whole chain, on one set of rows.
 *
 * Every link had a test of its own: the intake routes, the decision, the
 * appeal route. None of them could say whether the links met. A report whose
 * reference the appeal could not use, a decision that told the reporter and not
 * the member whose post came down, an appeal that could not find the report it
 * was about: each passes its own suite and leaves a woman with nowhere to go.
 * Here the same rows run all the way through, in a small in-memory database that
 * stands where Prisma does, so a link that does not meet the next one fails.
 *
 *   a member reports a post or an event, in the app
 *   -> a reference, a review clock and a priority are stamped, and she can look
 *      the report up by the reference
 *   -> a moderator decides "remove": the content comes down, she is told, and
 *      the member it belonged to is told, with the reference and the way to appeal
 *   -> that member appeals, naming the reference
 *   -> a moderator upholds the appeal: the content is back, the report no longer
 *      stands against her, and she is told
 *
 * and the guard on the way back: an appeal that names a reference about someone
 * else's account puts nothing back.
 */

import express from 'express';
import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => {
  type Row = Record<string, any>;
  const state = {
    users: new Map<string, Row>(),
    posts: new Map<string, Row>(),
    events: new Map<string, Row>(),
    reports: [] as Row[],
    notifications: [] as Row[],
    appeals: [] as Row[],
    moderationLog: [] as Row[],
    counter: 0,
  };

  /** What Prisma does with a data object, for the shapes these routes write. */
  const apply = (row: Row, data: Row) => {
    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === 'object' && !(value instanceof Date) && 'increment' in value) {
        row[key] = (row[key] ?? 0) + (value as { increment: number }).increment;
      } else {
        row[key] = value;
      }
    }
    row.updatedAt = new Date();
    return row;
  };
  const next = (prefix: string) => `${prefix}-${++state.counter}`;

  const prisma = {
    user: {
      findUnique: async ({ where }: Row) => state.users.get(where.id) ?? null,
      update: async ({ where, data }: Row) => apply(state.users.get(where.id)!, data),
    },
    post: {
      findUnique: async ({ where }: Row) => {
        const post = state.posts.get(where.id);
        return post ? { authorId: post.authorId } : null;
      },
      update: async ({ where, data }: Row) => apply(state.posts.get(where.id)!, data),
      updateMany: async ({ where, data }: Row) => {
        const post = state.posts.get(where.id);
        if (post) apply(post, data);
        return { count: post ? 1 : 0 };
      },
    },
    event: {
      findUnique: async ({ where }: Row) => {
        const event = state.events.get(where.id);
        return event ? { hostUserId: event.hostUserId, isHidden: event.isHidden } : null;
      },
      updateMany: async ({ where, data }: Row) => {
        const event = state.events.get(where.id);
        if (event) apply(event, data);
        return { count: event ? 1 : 0 };
      },
    },
    contentReport: {
      create: async ({ data }: Row) => {
        const row = { id: next('report'), createdAt: new Date(), updatedAt: new Date(), ...data };
        state.reports.push(row);
        return row;
      },
      findUnique: async ({ where }: Row) => state.reports.find((r) => r.id === where.id) ?? null,
      findFirst: async ({ where }: Row) =>
        state.reports.find((r) => {
          if (where.id !== undefined && r.id !== where.id) return false;
          if (where.reportedUserId !== undefined && r.reportedUserId !== where.reportedUserId) return false;
          if (where.evidence?.path) return r.evidence?.[where.evidence.path[0]] === where.evidence.equals;
          return true;
        }) ?? null,
      update: async ({ where, data }: Row) => apply(state.reports.find((r) => r.id === where.id)!, data),
    },
    moderationLog: {
      create: async ({ data }: Row) => {
        state.moderationLog.push(data);
        return data;
      },
    },
    notification: {
      create: async ({ data }: Row) => {
        const row = { id: next('notification'), ...data };
        state.notifications.push(row);
        return row;
      },
    },
    appeal: {
      create: async ({ data }: Row) => {
        const row = { id: next('appeal'), createdAt: new Date(), updatedAt: new Date(), ...data };
        state.appeals.push(row);
        return row;
      },
      findUnique: async ({ where }: Row) => state.appeals.find((a) => a.id === where.id) ?? null,
      update: async ({ where, data }: Row) => apply(state.appeals.find((a) => a.id === where.id)!, data),
    },
    auditLog: { create: async () => ({}) },
    bannedIdentity: { deleteMany: async () => ({ count: 0 }) },
  };

  return { prisma, __state: state };
});

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, res: any, next: any) => {
    const id = req.headers['x-test-user'];
    if (!id) return res.status(401).json({ success: false, message: 'Authentication required' });
    req.user = { id, role: req.headers['x-test-role'] || 'USER', email: `${id}@athena.test`, twoFactorEnabled: true };
    next();
  },
  optionalAuth: (req: any, _res: any, next: any) => {
    const id = req.headers['x-test-user'];
    if (id) req.user = { id, role: req.headers['x-test-role'] || 'USER', email: `${id}@athena.test` };
    next();
  },
  requireRole:
    (...roles: string[]) =>
    (req: any, res: any, next: any) =>
      roles.includes(req.user?.role) ? next() : res.status(403).json({ success: false, message: 'Forbidden' }),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  redactSensitive: (value: unknown) => value,
}));

jest.mock('../../utils/ops-metrics', () => ({ recordFailure: jest.fn() }));

const sentEmails: Array<{ to: string; subject: string; text?: string; html?: string }> = [];
jest.mock('../../utils/email', () => ({
  ...(jest.requireActual('../../utils/email') as object),
  sendEmail: jest.fn(async (message: { to: string; subject: string }) => {
    sentEmails.push(message);
    return true;
  }),
}));

// What these checks are not about: the scoring and auto-hide consequences of a
// report, each with their own tests, and the safety lists, which a report does
// not touch.
jest.mock('../../services/safety-score.service', () => ({
  ...(jest.requireActual('../../services/safety-score.service') as object),
  handleUserReport: jest.fn(async () => undefined),
}));
jest.mock('../../services/trust.service', () => ({
  ...(jest.requireActual('../../services/trust.service') as object),
  recordSafetyReport: jest.fn(async () => undefined),
}));
jest.mock('../../services/moderation-threshold.service', () => ({
  ...(jest.requireActual('../../services/moderation-threshold.service') as object),
  reviewReportedContent: jest.fn(async () => false),
}));
jest.mock('../../services/unwanted-contact.service', () => ({ reviewUnwantedContact: jest.fn(async () => false) }));
jest.mock('../../utils/safety-store', () => ({
  blockUser: jest.fn(),
  listBlockedUsers: jest.fn(async () => []),
  unblockUser: jest.fn(),
  isBlockedRelationship: jest.fn(async () => false),
  getBlockedRelationshipIds: jest.fn(async () => []),
}));

// The real intake (reference, priority, clock) and the real decision and
// reversal, with only the consequences that send mail and write referrals to
// the authorities replaced, so the test can see what they were handed.
const intakeConsequences = jest.fn(async (_record: unknown) => undefined);
jest.mock('../../services/content-report.service', () => ({
  ...(jest.requireActual('../../services/content-report.service') as object),
  runReportIntakeConsequences: (record: unknown) => intakeConsequences(record),
}));

import safetyRoutes from '../safety.routes';
import complianceRoutes from '../compliance.routes';
import appealRoutes from '../appeal.routes';
import { errorHandler } from '../../middleware/errorHandler';
import { processReportById } from '../../services/content-report.service';
import * as prismaModule from '../../utils/prisma';

const state = (prismaModule as any).__state;

const app = express();
app.use(express.json());
app.use('/api/safety', safetyRoutes);
app.use('/api/compliance', complianceRoutes);
app.use('/api/appeals', appealRoutes);
app.use(errorHandler);

const as = (id: string, role = 'USER') => ({ 'x-test-user': id, 'x-test-role': role });

const KINDS = [
  {
    kind: 'post',
    targetId: 'post-1',
    seed: () => state.posts.set('post-1', { id: 'post-1', authorId: 'her-neighbour', isHidden: false, reportCount: 0 }),
    isUp: () => state.posts.get('post-1').isHidden === false,
    noun: 'your post',
  },
  {
    kind: 'event',
    targetId: 'event-1',
    seed: () => state.events.set('event-1', { id: 'event-1', hostUserId: 'her-neighbour', isHidden: false }),
    isUp: () => state.events.get('event-1').isHidden === false,
    noun: 'your event',
  },
] as const;

beforeEach(() => {
  jest.clearAllMocks();
  sentEmails.length = 0;
  for (const key of ['users', 'posts', 'events']) state[key].clear();
  for (const key of ['reports', 'notifications', 'appeals', 'moderationLog']) state[key].length = 0;
  state.counter = 0;
  for (const id of ['her', 'her-neighbour', 'a-stranger']) {
    state.users.set(id, { id, email: `${id}@athena.test`, firstName: id, isSuspended: false, bannedAt: null });
  }
});

describe.each(KINDS)('a $kind that is reported, removed, appealed and put back', ({ kind, targetId, seed, isUp, noun }) => {
  beforeEach(() => seed());

  /** Files the report and returns what she was given. */
  async function fileReport() {
    const res = await request(app)
      .post('/api/safety/reports')
      .set(as('her'))
      .send({ targetType: kind, targetId, reason: 'harassment', details: 'They keep naming my street.' })
      .expect(201);
    return res.body.data as { id: string; reference: string; reviewDeadline: string };
  }

  it('stamps a reference, a review clock and a priority on the report, and lets her look it up', async () => {
    const filed = await fileReport();

    expect(filed.reference).toMatch(/^RPT-/);
    const row = state.reports.find((r: any) => r.id === filed.id);
    expect(row).toMatchObject({
      reporterId: 'her',
      reportedUserId: 'her-neighbour',
      contentType: kind.toUpperCase(),
      contentId: targetId,
      status: 'PENDING',
    });
    expect(row.reviewDeadline).toBeInstanceOf(Date);
    expect(row.priority).toBeTruthy();
    expect(row.evidence.ticketId).toBe(filed.reference);
    // The consequences (the acknowledgment, the alert, any referral) were handed the same reference.
    expect(intakeConsequences).toHaveBeenCalledWith(expect.objectContaining({ ticketId: filed.reference, contentId: targetId }));

    const lookup = await request(app).get(`/api/compliance/report-status/${filed.reference}`).expect(200);
    expect(lookup.body.data).toMatchObject({ reference: filed.reference, status: 'PENDING' });
    expect(lookup.body.data.reviewDeadline).toBeTruthy();
  });

  it('comes down on a "remove" decision, and both the reporter and the member it belonged to are told', async () => {
    const filed = await fileReport();

    const outcome = await processReportById(filed.id, 'remove', 'moderator-1', 'Names her street');

    expect(outcome).toMatchObject({ status: 'RESOLVED', action: 'remove', reportedUserId: 'her-neighbour' });
    expect(isUp()).toBe(false);

    const toReporter = state.notifications.find((n: any) => n.userId === 'her');
    expect(toReporter.data).toMatchObject({ reference: filed.reference, action: 'remove' });

    const toAuthor = state.notifications.find((n: any) => n.userId === 'her-neighbour');
    expect(toAuthor).toMatchObject({ title: 'Something you shared was removed', link: '/help/appeal?type=content_removal' });
    expect(toAuthor.message).toContain(noun);
    // The reference to name in the appeal is the one the report carries, and the
    // notice says nothing of who reported.
    expect(toAuthor.message).toContain(filed.reference);
    expect(JSON.stringify(toAuthor)).not.toContain('"her"');

    // And the reporter's lookup now says it was decided.
    const lookup = await request(app).get(`/api/compliance/report-status/${filed.reference}`).expect(200);
    expect(lookup.body.data.status).toBe('RESOLVED');
  });

  it('is back, and no longer stands against her, when the appeal that names the reference is upheld', async () => {
    const filed = await fileReport();
    await processReportById(filed.id, 'remove', 'moderator-1', 'Names her street');
    expect(isUp()).toBe(false);

    const appeal = await request(app)
      .post('/api/appeals')
      .set(as('her-neighbour'))
      .send({
        type: 'CONTENT_MODERATION',
        reason: 'It was a picture of my own front gate.',
        metadata: { appealType: 'content_removal', referenceId: filed.reference },
      })
      .expect(201);
    expect(appeal.body.data).toMatchObject({ userId: 'her-neighbour', status: 'PENDING' });
    // Still down while it waits: filing an appeal puts nothing back.
    expect(isUp()).toBe(false);

    // A member cannot decide her own appeal.
    await request(app)
      .patch(`/api/appeals/${appeal.body.data.id}`)
      .set(as('her-neighbour'))
      .send({ status: 'APPROVED' })
      .expect(403);
    expect(isUp()).toBe(false);

    const decided = await request(app)
      .patch(`/api/appeals/${appeal.body.data.id}`)
      .set(as('moderator-2', 'MODERATOR'))
      .send({ status: 'APPROVED', decisionNote: 'Her gate, and no address in it.' })
      .expect(200);

    expect(decided.body.reversal).toMatchObject({ contentRestored: true, reportCleared: true });
    expect(isUp()).toBe(true);
    const report = state.reports.find((r: any) => r.id === filed.id);
    expect(report).toMatchObject({ status: 'DISMISSED', reviewNotes: 'Enforcement reversed on appeal' });

    // She is told in the app and by email, in words that say it was put back.
    const told = state.notifications.filter((n: any) => n.userId === 'her-neighbour' && n.data?.appealId);
    expect(told).toHaveLength(1);
    expect(told[0].title).toBe('Your appeal was upheld');
    expect(told[0].message).toMatch(/restored/i);
    expect(sentEmails.map((e) => e.to)).toContain('her-neighbour@athena.test');

    // The report's own lookup no longer says it was removed for a reason that stands.
    const lookup = await request(app).get(`/api/compliance/report-status/${filed.reference}`).expect(200);
    expect(lookup.body.data.status).toBe('DISMISSED');
  });

  it('is not put back by an appeal that names a reference about somebody else', async () => {
    const filed = await fileReport();
    await processReportById(filed.id, 'remove', 'moderator-1');

    const appeal = await request(app)
      .post('/api/appeals')
      .set(as('a-stranger'))
      .send({ type: 'CONTENT_MODERATION', reason: 'That is my post.', metadata: { referenceId: filed.reference } })
      .expect(201);
    const decided = await request(app)
      .patch(`/api/appeals/${appeal.body.data.id}`)
      .set(as('moderator-2', 'MODERATOR'))
      .send({ status: 'APPROVED' })
      .expect(200);

    // The reference is not an authorisation: it is looked up only among reports
    // about the appellant's own account.
    expect(decided.body.reversal).toMatchObject({ contentRestored: false, reportCleared: false });
    expect(isUp()).toBe(false);
    expect(state.reports.find((r: any) => r.id === filed.id).status).toBe('RESOLVED');
  });

  it('stays down, and the member is told so, when the appeal is not upheld', async () => {
    const filed = await fileReport();
    await processReportById(filed.id, 'remove', 'moderator-1');
    const appeal = await request(app)
      .post('/api/appeals')
      .set(as('her-neighbour'))
      .send({ type: 'CONTENT_MODERATION', reason: 'I disagree.', metadata: { referenceId: filed.reference } })
      .expect(201);

    await request(app)
      .patch(`/api/appeals/${appeal.body.data.id}`)
      .set(as('moderator-2', 'MODERATOR'))
      .send({ status: 'REJECTED' })
      .expect(200);

    expect(isUp()).toBe(false);
    const told = state.notifications.find((n: any) => n.userId === 'her-neighbour' && n.data?.appealId);
    expect(told.title).toBe('Your appeal was not upheld');
    // And it cannot be decided a second time into the opposite.
    await request(app)
      .patch(`/api/appeals/${appeal.body.data.id}`)
      .set(as('moderator-2', 'MODERATOR'))
      .send({ status: 'APPROVED' })
      .expect(409);
    expect(isUp()).toBe(false);
  });
});
