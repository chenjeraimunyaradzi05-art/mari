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

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';
import { runReportIntakeConsequences } from '../../services/content-report.service';
import { reviewReportedContent } from '../../services/moderation-threshold.service';
import { handleUserReport } from '../../services/safety-score.service';
import { recordSafetyReport } from '../../services/trust.service';

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

  it('says so plainly when the reference is not one of ours', async () => {
    const res = await request(app).get('/api/compliance/report-status/RPT-NOPE');

    expect(res.status).toBe(404);
  });
});
