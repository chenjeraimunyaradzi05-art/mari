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
import { resetMaintenanceCache } from '../../services/feature-flags.service';

const prismaAny: any = prisma;

const HOUR_MS = 60 * 60 * 1000;

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
  containmentActions: [],
  remediationActions: [],
  rootCause: null,
  ...overrides,
});

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
    it('POST /api/admin/breaches records the breach and reports its 72-hour position', async () => {
      prismaAny.dataBreach.create.mockResolvedValue(breachRow());
      prismaAny.privacyAuditLog.create.mockResolvedValue({});

      const response = await request(app)
        .post('/api/admin/breaches')
        .send({
          title: 'Exported CV bucket left public',
          description: 'A storage bucket holding CV uploads was readable without credentials.',
          severity: 'HIGH',
          dataCategories: ['PII'],
          affectedUsers: 12,
        })
        .expect(201);

      expect(response.body.notificationDeadline.state).toBe('ON_TRACK');
      expect(response.body.notificationDeadline.hoursRemaining).toBeGreaterThan(69);
      expect(prisma.dataBreach.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            severity: 'HIGH',
            detectedBy: 'admin-123',
            notificationRequired: true,
          }),
        })
      );
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
