/**
 * The public reporting mechanism, which is the one the Online Safety Act 2021
 * (Cth) actually requires and the one a woman uses when she has just been
 * targeted and cannot or will not sign in.
 *
 * Three things were wrong with it and all three are safety, not cosmetics. It
 * threw away the contact address, the evidence links and the urgency flag the
 * form collects, under a confirmation screen promising to write back to that
 * address and to answer a critical report in 24 hours. It stamped one uniform
 * 48-hour deadline on everything. And it ran none of the consequences the
 * in-app report dialog runs — no auto-hide when several women report the same
 * post, no safety score, no Trust & Safety alert, and no authority referral for
 * CSAM or terrorism.
 */

import express from 'express';
import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

let currentUser: { id: string; role: string; email: string } | null = null;

jest.mock('../../utils/prisma', () => ({
  prisma: {
    post: { findUnique: jest.fn() },
    contentReport: { create: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn() },
    safetyIncident: { create: jest.fn(), findFirst: jest.fn() },
    subprocessor: { findMany: jest.fn(async () => []) },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = currentUser ?? { id: 'member-1', role: 'USER', email: 'member-1@example.com' };
    next();
  },
  optionalAuth: (req: any, _res: any, next: any) => {
    if (currentUser) req.user = currentUser;
    next();
  },
  requireRole: (..._roles: string[]) => (_req: any, _res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  redactSensitive: (value: unknown) => value,
}));

jest.mock('../../services/content-report.service', () => {
  const actual: any = jest.requireActual('../../services/content-report.service');
  return { ...actual, runReportIntakeConsequences: jest.fn(async () => undefined) };
});

jest.mock('../../services/moderation-threshold.service', () => {
  const actual: any = jest.requireActual('../../services/moderation-threshold.service');
  return { ...actual, reviewReportedContent: jest.fn(async () => false) };
});

jest.mock('../../services/safety-score.service', () => {
  const actual: any = jest.requireActual('../../services/safety-score.service');
  return { ...actual, handleUserReport: jest.fn(async () => undefined) };
});

jest.mock('../../services/trust.service', () => {
  const actual: any = jest.requireActual('../../services/trust.service');
  return { ...actual, recordSafetyReport: jest.fn(async () => undefined) };
});

import complianceRoutes from '../compliance.routes';
import { errorHandler } from '../../middleware/errorHandler';
import { prisma as prismaTyped } from '../../utils/prisma';
import { runReportIntakeConsequences } from '../../services/content-report.service';
import { reviewReportedContent } from '../../services/moderation-threshold.service';
import { handleUserReport } from '../../services/safety-score.service';
import { recordSafetyReport } from '../../services/trust.service';

// The compliance router on its own, so these tests answer for this route and
// are not taken down by a module elsewhere in the app failing to load.
const app = express();
app.use(express.json());
app.use('/api/compliance', complianceRoutes);
app.use(errorHandler);

const prisma: any = prismaTyped;
const intakeConsequences = runReportIntakeConsequences as jest.Mock;
const autoHide = reviewReportedContent as jest.Mock;
const safetyScore = handleUserReport as jest.Mock;
const trustScore = recordSafetyReport as jest.Mock;

const body = (overrides: Record<string, unknown> = {}) => ({
  contentType: 'post',
  contentId: 'post-1',
  reason: 'harassment',
  details: 'She has been posting my address.',
  ...overrides,
});

describe('POST /api/compliance/report-content', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentUser = null;
    prisma.post.findUnique.mockResolvedValue({ authorId: 'reported-1' });
    prisma.contentReport.create.mockImplementation(async ({ data }: any) => ({
      id: 'report-1',
      status: 'PENDING',
      ...data,
    }));
    prisma.safetyIncident.create.mockImplementation(async ({ data }: any) => ({
      id: 'incident-1',
      ...data,
    }));
  });

  it('keeps the contact address, the evidence links and the urgency flag the form collects', async () => {
    currentUser = { id: 'member-1', role: 'USER', email: 'member-1@example.com' };

    const res = await request(app)
      .post('/api/compliance/report-content')
      .send(
        body({
          evidenceUrls: ['https://example.test/screenshot.png'],
          contactEmail: 'reporter@example.test',
          isUrgent: true,
        })
      );

    expect(res.status).toBe(201);
    const written = prisma.contentReport.create.mock.calls[0][0].data.evidence;
    expect(written.urls).toEqual(['https://example.test/screenshot.png']);
    expect(written.contactEmail).toBe('reporter@example.test');
    expect(written.isUrgent).toBe(true);
    // The reference the confirmation screen tells her to keep.
    expect(written.ticketId).toMatch(/^RPT-/);
    expect(res.body.data.reference).toBe(written.ticketId);
  });

  it('gives an urgent report the 24-hour clock the confirmation screen promises', async () => {
    currentUser = { id: 'member-1', role: 'USER', email: 'member-1@example.com' };

    const urgent = await request(app)
      .post('/api/compliance/report-content')
      .send(body({ reason: 'csam' }));

    expect(urgent.body.message).toContain('24 hours');
    expect(urgent.body.data.priority).toBe('critical');

    const ordinary = await request(app)
      .post('/api/compliance/report-content')
      .send(body({ reason: 'spam' }));

    expect(ordinary.body.message).toContain('48 hours');
  });

  it('refuses an evidence link that is not a web address rather than storing it for a moderator to click', async () => {
    currentUser = { id: 'member-1', role: 'USER', email: 'member-1@example.com' };

    const res = await request(app)
      .post('/api/compliance/report-content')
      .send(body({ evidenceUrls: ['javascript:alert(1)'] }));

    expect(res.status).toBe(400);
    expect(prisma.contentReport.create).not.toHaveBeenCalled();
  });

  it('runs the same consequences the in-app report dialog runs', async () => {
    currentUser = { id: 'member-1', role: 'USER', email: 'member-1@example.com' };

    await request(app).post('/api/compliance/report-content').send(body());

    expect(trustScore).toHaveBeenCalledWith('member-1', 'reported-1');
    expect(safetyScore).toHaveBeenCalledWith(
      'reported-1',
      'member-1',
      'HARASSMENT',
      'post-1',
      'POST'
    );
    expect(autoHide).toHaveBeenCalledWith('post', 'post-1');
    expect(intakeConsequences).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'HARASSMENT', contentId: 'post-1' })
    );
  });

  it('alerts and refers an anonymous report too, and counts it towards the auto-hide', async () => {
    currentUser = null;

    const res = await request(app)
      .post('/api/compliance/report-content')
      .send(body({ reason: 'csam' }));

    expect(res.status).toBe(201);
    expect(prisma.safetyIncident.create).toHaveBeenCalled();
    expect(autoHide).toHaveBeenCalledWith('post', 'post-1');
    expect(intakeConsequences).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'CSAM', priority: 'critical' })
    );
    // There is no reporter to weigh, so no trust score moves.
    expect(trustScore).not.toHaveBeenCalled();
  });

  it('puts an illegal-content report on the 24-hour clock, and tells the acknowledgment the same', async () => {
    currentUser = null;
    const before = Date.now();

    const res = await request(app)
      .post('/api/compliance/report-content')
      .send(body({ reason: 'illegal', contactEmail: 'reporter@example.test' }));

    expect(res.status).toBe(201);
    // Priority high, and the deadline used to follow the priority: 48 hours.
    expect(res.body.data.priority).toBe('high');
    expect(res.body.message).toContain('24 hours');
    const deadline = new Date(res.body.data.reviewDeadline).getTime();
    expect(Math.round((deadline - before) / 3_600_000)).toBe(24);
    expect(intakeConsequences).toHaveBeenCalledWith(expect.objectContaining({ reviewHours: 24 }));
  });

  it('refuses a reason that is not one either report door offers', async () => {
    currentUser = { id: 'member-1', role: 'USER', email: 'member-1@example.com' };

    const res = await request(app)
      .post('/api/compliance/report-content')
      .send(body({ reason: 'i just do not like her' }));

    expect(res.status).toBe(400);
    expect(prisma.contentReport.create).not.toHaveBeenCalled();
    expect(intakeConsequences).not.toHaveBeenCalled();
  });

  it('refuses a description past the cap instead of mailing it to Trust & Safety', async () => {
    currentUser = null;

    const res = await request(app)
      .post('/api/compliance/report-content')
      .send(body({ details: 'x'.repeat(5001) }));

    expect(res.status).toBe(400);
    expect(prisma.safetyIncident.create).not.toHaveBeenCalled();
  });

  it('holds a signed-in member to the in-app report limit, with or without Redis', async () => {
    // The Redis limiters stand down in tests exactly as they do in a deployment
    // with no REDIS_URL, so this is the floor under them doing the work.
    currentUser = { id: 'flooder', role: 'USER', email: 'flooder@example.com' };

    const statuses: number[] = [];
    for (let i = 0; i < 16; i += 1) {
      statuses.push((await request(app).post('/api/compliance/report-content').send(body({ reason: 'csam' }))).status);
    }

    expect(statuses.slice(0, 15).every((status) => status === 201)).toBe(true);
    expect(statuses[15]).toBe(429);
    // The sixteenth never reached the referral queue.
    expect(intakeConsequences).toHaveBeenCalledTimes(15);
  });
});

describe('GET /api/compliance/report-status/:reference', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentUser = null;
    prisma.contentReport.findFirst.mockResolvedValue(null);
    prisma.contentReport.findUnique.mockResolvedValue(null);
    prisma.safetyIncident.findFirst.mockResolvedValue(null);
  });

  it('answers a reporter who quotes her reference', async () => {
    prisma.contentReport.findFirst.mockResolvedValue({
      id: 'report-1',
      status: 'RESOLVED',
      action: 'CONTENT_REMOVED',
      updatedAt: new Date('2026-09-20T00:00:00.000Z'),
      evidence: { ticketId: 'RPT-ABC-1234', reviewDeadline: '2026-09-21T00:00:00.000Z' },
    });

    const res = await request(app).get('/api/compliance/report-status/RPT-ABC-1234');

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('RESOLVED');
    expect(res.body.data.outcome).toContain('removed the content');
  });

  it('never hands a moderator’s review notes to whoever holds the reference', async () => {
    prisma.contentReport.findFirst.mockResolvedValue({
      id: 'report-1',
      status: 'RESOLVED',
      action: 'SUSPENSION',
      updatedAt: new Date('2026-09-20T00:00:00.000Z'),
      evidence: { ticketId: 'RPT-ABC-1234' },
    });

    const res = await request(app).get('/api/compliance/report-status/RPT-ABC-1234');

    expect(JSON.stringify(res.body)).not.toMatch(/reviewNotes/);
    expect(prisma.contentReport.findFirst.mock.calls[0][0].select.reviewNotes).toBeUndefined();
  });

  it('finds an anonymous report by the RPT- reference her acknowledgment quoted', async () => {
    prisma.safetyIncident.findFirst.mockImplementation(async (args: any) =>
      JSON.stringify(args.where).includes('RPT-ANON-1')
        ? {
            id: 'incident-1',
            resolvedAt: null,
            updatedAt: new Date('2026-09-20T00:00:00.000Z'),
            metadata: { anonymous: true, ticketId: 'RPT-ANON-1', reviewDeadline: '2026-09-21T00:00:00.000Z' },
          }
        : null
    );

    const res = await request(app).get('/api/compliance/report-status/RPT-ANON-1');

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ reference: 'RPT-ANON-1', status: 'PENDING' });
    // Looked up through the metadata, never by treating the reference as a row id.
    expect(JSON.stringify(prisma.safetyIncident.findFirst.mock.calls[0][0].where)).toContain('ticketId');
  });

  it('says so plainly when the reference is not one of ours', async () => {
    const res = await request(app).get('/api/compliance/report-status/RPT-NOPE');

    expect(res.status).toBe(404);
  });
});
