import request from 'supertest';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    dataBreach: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    legalHold: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    authorityEscalation: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    contentReport: {
      findMany: jest.fn(),
    },
    moderationLog: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    privacyAuditLog: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    featureFlag: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'admin-123', role: 'ADMIN', email: 'admin@athena.com' };
    next();
  },
  optionalAuth: (_req: any, _res: any, next: any) => next(),
  requireRole: (..._roles: string[]) => (_req: any, __res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/email', () => ({
  sendEmail: jest.fn(async () => true),
  sendVerificationEmail: jest.fn(async () => true),
  sendPasswordResetEmail: jest.fn(async () => true),
  sendWelcomeEmail: jest.fn(async () => true),
}));

jest.mock('../../utils/opensearch', () => ({
  initializeOpenSearch: jest.fn(),
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import app from '../../index';
import { prisma } from '../../utils/prisma';
import { sendEmail } from '../../utils/email';
import { resetMaintenanceCache } from '../../services/feature-flags.service';

const prismaAny: any = prisma;
const sendEmailMock = sendEmail as unknown as jest.Mock;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** A breach from before the regime list existed: no jurisdiction, so the 72-hour clock is kept. */
const breachRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'breach-1',
  title: 'Exported CV bucket left public',
  description: 'A storage bucket holding CV uploads was readable without credentials.',
  detectedAt: new Date(Date.now() - 2 * HOUR_MS),
  detectedBy: 'admin-123',
  severity: 'HIGH',
  status: 'DETECTED',
  dataCategories: ['PII'],
  notificationRequired: true,
  regulatorNotifiedAt: null,
  jurisdictions: [],
  jurisdiction: null,
  assessmentDueAt: null,
  assessmentComplete: false,
  seriousHarmLikely: null,
  remediedBeforeHarm: false,
  statementRecommendedSteps: null,
  statementLodgedAt: null,
  containmentActions: [],
  remediationActions: [],
  rootCause: null,
  ...overrides,
});

/** An Australian breach whose assessment found an eligible data breach. */
const assessedAuRow = (overrides: Record<string, unknown> = {}) =>
  breachRow({
    jurisdictions: ['AU'],
    jurisdiction: 'AU',
    assessmentDueAt: new Date(Date.now() + 20 * DAY_MS),
    assessmentComplete: true,
    seriousHarmLikely: true,
    remediedBeforeHarm: false,
    notificationRequired: true,
    ...overrides,
  });

const oaicStatement = {
  entityContact: 'ATHENA Platform Pty Ltd, Queensland, Australia. Privacy contact through the privacy centre.',
  description: 'CV uploads were readable without credentials for six hours.',
  informationKinds: ['names', 'employment history'],
  recommendedSteps: 'Watch for unexpected recruiter contact and report anything odd through the privacy centre.',
};

describe('Admin operational routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // The maintenance gate runs ahead of every /api route, so each test starts
    // from a platform that is open rather than from the previous test's state.
    resetMaintenanceCache();
    prismaAny.featureFlag.findUnique.mockResolvedValue(null);
  });

  afterEach(() => {
    resetMaintenanceCache();
  });

  describe('Breach notification', () => {
    it('POST /api/admin/breaches records a UK breach and reports its 72-hour position', async () => {
      prismaAny.dataBreach.create.mockResolvedValue(breachRow({ jurisdictions: ['UK'], jurisdiction: 'UK' }));
      prismaAny.privacyAuditLog.create.mockResolvedValue({});

      const response = await request(app)
        .post('/api/admin/breaches')
        .send({
          title: 'Exported CV bucket left public',
          description: 'A storage bucket holding CV uploads was readable without credentials.',
          severity: 'HIGH',
          dataCategories: ['PII'],
          affectedUsers: 12,
          jurisdictions: ['UK'],
        })
        .expect(201);

      expect(response.body.notificationDeadline.state).toBe('ON_TRACK');
      expect(response.body.notificationDeadline.hoursRemaining).toBeGreaterThan(69);
      expect(prisma.dataBreach.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            severity: 'HIGH',
            detectedBy: 'admin-123',
            jurisdictions: ['UK'],
            notificationRequired: true,
          }),
        })
      );
    });

    it('POST /api/admin/breaches defaults to Australia, opens the assessment window at intake and runs no 72-hour clock', async () => {
      prismaAny.dataBreach.create.mockImplementation(async ({ data }: any) => breachRow({ ...data, id: 'breach-au' }));
      prismaAny.privacyAuditLog.create.mockResolvedValue({});

      const response = await request(app)
        .post('/api/admin/breaches')
        .send({
          title: 'Mentoring note attached to the wrong member',
          description: 'A session note was saved against another member and visible to her for a day.',
          severity: 'CRITICAL',
          dataCategories: ['PII', 'SENSITIVE'],
        })
        .expect(201);

      expect(response.body.notificationDeadline).toEqual({
        deadlineAt: null,
        hoursRemaining: null,
        state: 'NOT_APPLICABLE',
      });

      const data = prismaAny.dataBreach.create.mock.calls[0][0].data;
      expect(data.jurisdictions).toEqual(['AU']);
      expect(data.jurisdiction).toBe('AU');
      // CRITICAL with sensitive data would be notifiable under the GDPR
      // heuristic. Under the NDB scheme the assessment decides, not severity.
      expect(data.notificationRequired).toBe(false);
      expect(data.assessmentComplete).toBe(false);
      expect(data.assessmentDueAt.getTime() - data.detectedAt.getTime()).toBe(30 * DAY_MS);
      expect(prisma.privacyAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'NDB_ASSESSMENT_STARTED', resourceId: 'breach-au' }),
        })
      );
    });

    it('POST /api/admin/breaches rejects a regime it does not know', async () => {
      const response = await request(app)
        .post('/api/admin/breaches')
        .send({
          title: 'Something happened',
          description: 'Details',
          severity: 'HIGH',
          dataCategories: ['PII'],
          jurisdictions: ['AU', 'US'],
        })
        .expect(400);

      expect(response.body.message).toContain('AU, UK, EU');
      expect(prisma.dataBreach.create).not.toHaveBeenCalled();
    });

    it('POST /api/admin/breaches rejects a severity outside the enum', async () => {
      const response = await request(app)
        .post('/api/admin/breaches')
        .send({
          title: 'Something happened',
          description: 'Details',
          severity: 'CATASTROPHIC',
          dataCategories: ['PII'],
        })
        .expect(400);

      expect(response.body.message).toContain('severity must be one of');
      expect(prisma.dataBreach.create).not.toHaveBeenCalled();
    });

    it('GET /api/admin/breaches/deadlines puts the most overdue breach first', async () => {
      prismaAny.dataBreach.findMany.mockResolvedValue([
        breachRow({ id: 'due-soon', detectedAt: new Date(Date.now() - 60 * HOUR_MS) }),
        breachRow({ id: 'overdue', detectedAt: new Date(Date.now() - 90 * HOUR_MS) }),
      ]);

      const response = await request(app).get('/api/admin/breaches/deadlines').expect(200);

      expect(response.body.breaches.map((b: any) => b.id)).toEqual(['overdue', 'due-soon']);
      expect(response.body.breaches[0].notificationDeadline.state).toBe('OVERDUE');
      expect(response.body.breaches[1].notificationDeadline.state).toBe('DUE_SOON');
      expect(response.body.summary).toEqual({
        awaitingNotification: 2,
        overdue: 1,
        dueWithin24Hours: 1,
      });
    });

    it('GET /api/admin/breaches marks a late notification as MISSED rather than met', async () => {
      prismaAny.dataBreach.findMany.mockResolvedValue([
        breachRow({
          detectedAt: new Date(Date.now() - 100 * HOUR_MS),
          regulatorNotifiedAt: new Date(Date.now() - 10 * HOUR_MS),
          status: 'NOTIFIED',
        }),
      ]);

      const response = await request(app).get('/api/admin/breaches').expect(200);

      expect(response.body.breaches[0].notificationDeadline.state).toBe('MISSED');
      expect(response.body.summary.notifiedLate).toBe(1);
    });

    it('POST /api/admin/breaches/:id/notify-regulator refuses to notify twice', async () => {
      prismaAny.dataBreach.findUnique.mockResolvedValue(
        breachRow({ regulatorNotifiedAt: new Date() })
      );

      await request(app)
        .post('/api/admin/breaches/breach-1/notify-regulator')
        .send({
          regulatorName: 'ICO',
          regulatorEmail: 'casework@ico.example',
          notificationContent: 'Full description of the breach.',
        })
        .expect(409);

      expect(prisma.dataBreach.update).not.toHaveBeenCalled();
    });

    it('PATCH /api/admin/breaches/:id will not let NOTIFIED be set by hand', async () => {
      await request(app)
        .patch('/api/admin/breaches/breach-1')
        .send({ status: 'NOTIFIED' })
        .expect(400);

      expect(prisma.dataBreach.update).not.toHaveBeenCalled();
    });

    it('GET /api/admin/breaches/deadlines leaves an Australian breach off the 72-hour monitor', async () => {
      prismaAny.dataBreach.findMany.mockResolvedValue([
        breachRow({ id: 'au-only', jurisdictions: ['AU'], jurisdiction: 'AU', detectedAt: new Date(Date.now() - 90 * HOUR_MS) }),
        breachRow({ id: 'uk', jurisdictions: ['UK'], jurisdiction: 'UK', detectedAt: new Date(Date.now() - 60 * HOUR_MS) }),
      ]);

      const response = await request(app).get('/api/admin/breaches/deadlines').expect(200);

      expect(response.body.breaches.map((b: any) => b.id)).toEqual(['uk']);
      expect(response.body.summary).toEqual({
        awaitingNotification: 1,
        overdue: 0,
        dueWithin24Hours: 1,
      });
      // The query itself asks only for rows the clock applies to; the route
      // filter above is the belt to that brace.
      const where = prismaAny.dataBreach.findMany.mock.calls[0][0].where;
      expect(where.OR).toEqual(
        expect.arrayContaining([expect.objectContaining({ jurisdictions: { hasSome: ['UK', 'EU'] } })])
      );
    });

    it('GET /api/admin/breaches counts Overdue and Notified late only against breaches on the 72-hour clock', async () => {
      prismaAny.dataBreach.findMany.mockResolvedValue([
        // Would have read OVERDUE against a clock it never had.
        breachRow({ id: 'au-open', jurisdictions: ['AU'], jurisdiction: 'AU', detectedAt: new Date(Date.now() - 100 * HOUR_MS), notificationRequired: true }),
        // Notified the OAIC on day 20 of the assessment: not late under the scheme.
        breachRow({
          id: 'au-notified',
          jurisdictions: ['AU'],
          jurisdiction: 'AU',
          detectedAt: new Date(Date.now() - 20 * DAY_MS),
          regulatorNotifiedAt: new Date(Date.now() - 10 * HOUR_MS),
          status: 'NOTIFIED',
          notificationRequired: true,
        }),
        breachRow({
          id: 'uk-late',
          jurisdictions: ['UK'],
          jurisdiction: 'UK',
          detectedAt: new Date(Date.now() - 100 * HOUR_MS),
          regulatorNotifiedAt: new Date(Date.now() - 10 * HOUR_MS),
          status: 'NOTIFIED',
        }),
      ]);

      const response = await request(app).get('/api/admin/breaches').expect(200);

      const states = Object.fromEntries(
        response.body.breaches.map((b: any) => [b.id, b.notificationDeadline.state])
      );
      expect(states).toEqual({ 'au-open': 'NOT_APPLICABLE', 'au-notified': 'NOT_APPLICABLE', 'uk-late': 'MISSED' });
      expect(response.body.summary).toEqual({
        total: 3,
        overdue: 0,
        dueWithin24Hours: 0,
        notifiedLate: 1,
        onSeventyTwoHourClock: 1,
      });
    });

    it('POST /api/admin/breaches/:id/notify-regulator will not notify the OAIC before the assessment finds an eligible data breach', async () => {
      prismaAny.dataBreach.findUnique.mockResolvedValue(
        assessedAuRow({ assessmentComplete: false, seriousHarmLikely: null, notificationRequired: false })
      );

      const response = await request(app)
        .post('/api/admin/breaches/breach-1/notify-regulator')
        .send({
          regulatorName: 'Office of the Australian Information Commissioner',
          regulatorEmail: 'enquiries@oaic.gov.au',
          jurisdiction: 'AU',
          statement: oaicStatement,
        })
        .expect(409);

      expect(response.body.message).toContain('assessment has not been completed');
      expect(prisma.dataBreach.update).not.toHaveBeenCalled();
      expect(sendEmailMock).not.toHaveBeenCalled();
    });

    it('POST /api/admin/breaches/:id/notify-regulator requires the four parts of the OAIC statement', async () => {
      prismaAny.dataBreach.findUnique.mockResolvedValue(assessedAuRow());

      const response = await request(app)
        .post('/api/admin/breaches/breach-1/notify-regulator')
        .send({
          regulatorName: 'Office of the Australian Information Commissioner',
          regulatorEmail: 'enquiries@oaic.gov.au',
          jurisdiction: 'AU',
          statement: { ...oaicStatement, recommendedSteps: '' },
        })
        .expect(400);

      expect(response.body.message).toContain('statement.recommendedSteps');
      expect(prisma.dataBreach.update).not.toHaveBeenCalled();
    });

    it('POST /api/admin/breaches/:id/notify-regulator records the OAIC statement without the Article 33 wording', async () => {
      const row = assessedAuRow();
      prismaAny.dataBreach.findUnique.mockResolvedValue(row);
      prismaAny.privacyAuditLog.findFirst.mockResolvedValue({ createdAt: new Date(Date.now() - 2 * DAY_MS) });
      prismaAny.dataBreach.update.mockImplementation(async ({ data }: any) => ({ ...row, ...data }));
      prismaAny.privacyAuditLog.create.mockResolvedValue({});

      const response = await request(app)
        .post('/api/admin/breaches/breach-1/notify-regulator')
        .send({
          regulatorName: 'Office of the Australian Information Commissioner',
          regulatorEmail: 'enquiries@oaic.gov.au',
          jurisdiction: 'AU',
          statement: oaicStatement,
        })
        .expect(200);

      expect(response.body.status).toBe('NOTIFIED');
      expect(response.body.notificationDeadline.state).toBe('NOT_APPLICABLE');

      const data = prismaAny.dataBreach.update.mock.calls[0][0].data;
      expect(data.statementInformationKinds).toEqual(['names', 'employment history']);
      expect(data.statementRecommendedSteps).toBe(oaicStatement.recommendedSteps);
      expect(data.statementLodgedAt).toBeInstanceOf(Date);

      const email = sendEmailMock.mock.calls[0][0] as { subject: string; html: string };
      expect(email.subject).toContain('Eligible data breach statement');
      expect(email.html).not.toContain('72 Hours');

      expect(prisma.privacyAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'REGULATOR_NOTIFIED',
            details: expect.not.objectContaining({ within72Hours: expect.anything() }),
          }),
        })
      );
    });

    it('POST /api/admin/breaches/:id/notify-users will not tell Australians about a breach without telling them what to do', async () => {
      prismaAny.dataBreach.findUnique.mockResolvedValue(assessedAuRow({ statementRecommendedSteps: null }));

      const response = await request(app)
        .post('/api/admin/breaches/breach-1/notify-users')
        .send({ userIds: ['user-1'], notificationContent: 'Your CV was exposed for six hours.' })
        .expect(400);

      expect(response.body.message).toContain('26WL');
      expect(sendEmailMock).not.toHaveBeenCalled();
    });
  });

  describe('Legal holds', () => {
    it('POST /api/admin/legal-holds creates the hold and records who authorised it', async () => {
      prismaAny.user.findMany.mockResolvedValue([{ id: 'user-1' }]);
      prismaAny.legalHold.create.mockResolvedValue({
        id: 'hold-1',
        name: 'Smith v ATHENA',
        caseReference: 'QLD-2026-114',
        affectedUserIds: ['user-1'],
        affectedDataTypes: ['messages'],
      });
      prismaAny.privacyAuditLog.create.mockResolvedValue({});

      const response = await request(app)
        .post('/api/admin/legal-holds')
        .send({
          name: 'Smith v ATHENA',
          reason: 'Preservation notice served on 2 September 2026.',
          caseReference: 'QLD-2026-114',
          affectedUserIds: ['user-1'],
          affectedDataTypes: ['Messages'],
        })
        .expect(201);

      expect(response.body.id).toBe('hold-1');
      expect(response.body.unrecognisedDataTypes).toEqual([]);
      expect(prisma.legalHold.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            authorizedBy: 'admin-123',
            // Lower-cased on the way in, because the purge jobs match exactly.
            affectedDataTypes: ['messages'],
          }),
        })
      );
      expect(prisma.privacyAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'LEGAL_HOLD_CREATED', resourceId: 'hold-1' }),
        })
      );
    });

    it('POST /api/admin/legal-holds refuses a hold on a user id that does not exist', async () => {
      prismaAny.user.findMany.mockResolvedValue([{ id: 'user-1' }]);

      const response = await request(app)
        .post('/api/admin/legal-holds')
        .send({
          name: 'Smith v ATHENA',
          reason: 'Preservation notice.',
          affectedUserIds: ['user-1', 'typo-id'],
        })
        .expect(400);

      expect(response.body.message).toContain('typo-id');
      expect(prisma.legalHold.create).not.toHaveBeenCalled();
    });

    it('POST /api/admin/legal-holds/:id/release requires a reason', async () => {
      await request(app).post('/api/admin/legal-holds/hold-1/release').send({}).expect(400);
      expect(prisma.legalHold.update).not.toHaveBeenCalled();
    });

    it('POST /api/admin/legal-holds/:id/release lifts the hold once', async () => {
      prismaAny.legalHold.findUnique.mockResolvedValue({
        id: 'hold-1',
        name: 'Smith v ATHENA',
        caseReference: 'QLD-2026-114',
        isActive: true,
        affectedUserIds: ['user-1'],
      });
      prismaAny.legalHold.update.mockResolvedValue({ id: 'hold-1', isActive: false });
      prismaAny.privacyAuditLog.create.mockResolvedValue({});

      await request(app)
        .post('/api/admin/legal-holds/hold-1/release')
        .send({ releaseReason: 'Matter settled, preservation notice withdrawn.' })
        .expect(200);

      expect(prisma.legalHold.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: false, releasedBy: 'admin-123' }),
        })
      );
      expect(prisma.privacyAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'LEGAL_HOLD_RELEASED' }) })
      );
    });

    it('POST /api/admin/legal-holds/:id/release will not release a released hold', async () => {
      prismaAny.legalHold.findUnique.mockResolvedValue({ id: 'hold-1', isActive: false });

      await request(app)
        .post('/api/admin/legal-holds/hold-1/release')
        .send({ releaseReason: 'Already done' })
        .expect(409);

      expect(prisma.legalHold.update).not.toHaveBeenCalled();
    });

    it('GET /api/admin/legal-holds flags an active hold whose end date has passed', async () => {
      prismaAny.legalHold.findMany.mockResolvedValue([
        { id: 'hold-1', isActive: true, endDate: new Date(Date.now() - 24 * HOUR_MS) },
        { id: 'hold-2', isActive: true, endDate: null },
      ]);
      prismaAny.legalHold.count.mockResolvedValue(2);

      const response = await request(app).get('/api/admin/legal-holds?active=true').expect(200);

      expect(response.body.holds[0].expired).toBe(true);
      expect(response.body.holds[1].expired).toBe(false);
    });
  });

  describe('Maintenance mode', () => {
    const enabledFlag = {
      key: 'maintenance_mode',
      name: 'Maintenance mode',
      description: null,
      enabled: true,
      rolloutPercentage: 100,
      allowList: [],
      denyList: [],
      tags: ['ops', 'maintenance'],
      metadata: {
        message: 'Launching soon...',
        startedAt: new Date().toISOString(),
        endsAt: null,
        updatedBy: 'admin-123',
        updatedAt: new Date().toISOString(),
      },
    };

    it('POST /api/admin/maintenance closes the platform and the gate starts refusing traffic', async () => {
      prismaAny.featureFlag.upsert.mockResolvedValue(enabledFlag);

      const toggled = await request(app)
        .post('/api/admin/maintenance')
        .send({ enabled: true, message: 'Launching soon...' })
        .expect(200);

      expect(toggled.body).toEqual(
        expect.objectContaining({ enabled: true, message: 'Launching soon...' })
      );

      const blocked = await request(app).get('/api/posts').expect(503);
      expect(blocked.body.maintenance.enabled).toBe(true);
      expect(blocked.body.message).toBe('Launching soon...');
      expect(blocked.headers['retry-after']).toBe('60');

      // The operator who closed it still has to be able to open it again.
      await request(app).get('/api/admin/maintenance').expect(200);
    });

    it('GET /api/maintenance is public and answers while the platform is open', async () => {
      const response = await request(app).get('/api/maintenance').expect(200);
      expect(response.body.enabled).toBe(false);
    });

    it('POST /api/admin/maintenance rejects a non-boolean enabled', async () => {
      await request(app).post('/api/admin/maintenance').send({ enabled: 'yes' }).expect(400);
      expect(prisma.featureFlag.upsert).not.toHaveBeenCalled();
    });
  });

  describe('Authority escalation queue', () => {
    const escalation = {
      id: 'esc-1',
      ticketId: 'RPT-ABC-1234',
      reason: 'csam',
      contentType: 'post',
      contentId: 'post-1',
      escalatedAt: new Date(Date.now() - 5 * HOUR_MS),
      reportedTo: 'IWF',
      referenceNumber: null,
      status: 'reported',
    };

    it('GET /api/admin/moderation/escalations returns the queue with its age and counts', async () => {
      prismaAny.authorityEscalation.findMany.mockResolvedValue([escalation]);
      prismaAny.authorityEscalation.count
        .mockResolvedValueOnce(1) // total
        .mockResolvedValueOnce(1) // reported
        .mockResolvedValueOnce(0) // acknowledged
        .mockResolvedValueOnce(0); // resolved
      prismaAny.contentReport.findMany.mockResolvedValue([
        {
          id: 'report-1',
          status: 'REVIEWING',
          action: 'ESCALATED',
          reviewerId: 'admin-123',
          reportedUserId: 'user-9',
          description: 'Reported content',
          evidence: { ticketId: 'RPT-ABC-1234' },
        },
      ]);

      const response = await request(app).get('/api/admin/moderation/escalations').expect(200);

      expect(response.body.escalations).toHaveLength(1);
      expect(response.body.escalations[0].ageHours).toBe(5);
      expect(response.body.escalations[0].report.id).toBe('report-1');
      expect(response.body.summary).toEqual({
        total: 1,
        reported: 1,
        acknowledged: 0,
        resolved: 0,
      });
    });

    it('PATCH /api/admin/moderation/escalations/:id will not acknowledge without a reference number', async () => {
      prismaAny.authorityEscalation.findUnique.mockResolvedValue(escalation);

      const response = await request(app)
        .patch('/api/admin/moderation/escalations/esc-1')
        .send({ status: 'acknowledged' })
        .expect(409);

      expect(response.body.message).toContain('reference number');
      expect(prisma.authorityEscalation.update).not.toHaveBeenCalled();
    });

    it('PATCH /api/admin/moderation/escalations/:id acknowledges and logs the moderator', async () => {
      prismaAny.authorityEscalation.findUnique.mockResolvedValue(escalation);
      prismaAny.authorityEscalation.update.mockResolvedValue({
        ...escalation,
        status: 'acknowledged',
        referenceNumber: 'IWF-778812',
      });
      prismaAny.moderationLog.create.mockResolvedValue({});

      const response = await request(app)
        .patch('/api/admin/moderation/escalations/esc-1')
        .send({ status: 'acknowledged', referenceNumber: 'IWF-778812', notes: 'Filed by hand.' })
        .expect(200);

      expect(response.body.previousStatus).toBe('reported');
      expect(response.body.escalation.status).toBe('acknowledged');
      expect(prisma.moderationLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ticketId: 'RPT-ABC-1234',
            action: 'escalation_acknowledged',
            moderatorId: 'admin-123',
          }),
        })
      );
    });

    it('PATCH /api/admin/moderation/escalations/:id refuses to walk a referral backwards', async () => {
      prismaAny.authorityEscalation.findUnique.mockResolvedValue({
        ...escalation,
        status: 'resolved',
        referenceNumber: 'IWF-778812',
      });

      await request(app)
        .patch('/api/admin/moderation/escalations/esc-1')
        .send({ status: 'acknowledged' })
        .expect(409);

      expect(prisma.authorityEscalation.update).not.toHaveBeenCalled();
    });
  });
});
