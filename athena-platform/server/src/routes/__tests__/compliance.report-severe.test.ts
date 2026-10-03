/**
 * An intimate image shared without consent, and a threat to hurt someone.
 *
 * Neither had a name on either door into the report queue. A woman reporting
 * either had to guess "sexual content" or "violence", and was filed at high
 * priority on the harmful-content clock, where a report of an image of her
 * waited two days and hid nothing. They are named now, critical, on the 24-hour
 * illegal-content clock, and hide the content the moment one signed-in member
 * reports it. This holds the public form (POST /api/compliance/report-content);
 * the in-app dialog's door is in safety.reports-incidents.test.ts.
 *
 * Its own file, because the report limiters are counted per process and the
 * intake suite is close to using its allowance.
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

const app = express();
app.use(express.json());
app.use('/api/compliance', complianceRoutes);
app.use(errorHandler);

const prisma: any = prismaTyped;
const intakeConsequences = runReportIntakeConsequences as jest.Mock;
const autoHide = reviewReportedContent as jest.Mock;

const body = (reason: string) => ({
  contentType: 'post',
  contentId: 'post-1',
  reason,
  details: 'It is a picture of me that I did not agree to share.',
});

describe.each(['intimate_image', 'threat'])('a report of %s on the public form', (reason) => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentUser = null;
    prisma.post.findUnique.mockResolvedValue({ authorId: 'reported-1' });
    prisma.contentReport.create.mockImplementation(async ({ data }: any) => ({ id: 'report-1', status: 'PENDING', ...data }));
    prisma.safetyIncident.create.mockImplementation(async ({ data }: any) => ({ id: 'incident-1', ...data }));
  });

  it('is accepted by name, critical, and on the 24-hour illegal-content clock', async () => {
    currentUser = { id: `member-${reason}`, role: 'USER', email: 'member@example.com' };
    const before = Date.now();

    const res = await request(app).post('/api/compliance/report-content').send(body(reason));

    expect(res.status).toBe(201);
    expect(res.body.data.priority).toBe('critical');
    expect(res.body.message).toContain('24 hours');
    expect(Math.round((new Date(res.body.data.reviewDeadline).getTime() - before) / 3_600_000)).toBe(24);
    expect(prisma.contentReport.create.mock.calls[0][0].data).toMatchObject({
      reason: reason.toUpperCase(),
      priority: 'URGENT',
      status: 'PENDING',
    });
    expect(intakeConsequences).toHaveBeenCalledWith(
      expect.objectContaining({ reason: reason.toUpperCase(), priority: 'critical', reviewHours: 24 })
    );
  });

  it('tells the threshold service what it is, who is asking and which report it was, which is what hides it at once', async () => {
    currentUser = { id: `member-hide-${reason}`, role: 'USER', email: 'member@example.com' };

    await request(app).post('/api/compliance/report-content').send(body(reason));

    expect(autoHide).toHaveBeenCalledWith('post', 'post-1', { reason, ticketId: expect.stringMatching(/^RPT-/) });
  });

  it('from no account is critical and urgent in the anonymous queue, and is passed as anonymous so it never hides alone', async () => {
    const res = await request(app).post('/api/compliance/report-content').send(body(reason));

    expect(res.status).toBe(201);
    expect(res.body.data.priority).toBe('critical');
    expect(prisma.safetyIncident.create.mock.calls[0][0].data).toMatchObject({ severity: 'CRITICAL', reason: reason.toUpperCase() });
    expect(autoHide).toHaveBeenCalledWith('post', 'post-1', { reason, anonymous: true });
  });
});
