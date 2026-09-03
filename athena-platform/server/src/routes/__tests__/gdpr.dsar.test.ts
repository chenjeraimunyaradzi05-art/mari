import request from 'supertest';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    dSARRequest: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    consentRecord: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
      updateMany: jest.fn(),
    },
    cookieConsent: { findUnique: jest.fn(), upsert: jest.fn() },
    privacyAuditLog: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
    auditLog: { create: jest.fn() },
    retentionPolicy: { findMany: jest.fn() },
    processingActivity: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    dPIA: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    user: { findUnique: jest.fn(), update: jest.fn() },
    legalHold: { findFirst: jest.fn() },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-123', role: 'ADMIN', email: 'user@athena.com' };
    next();
  },
  optionalAuth: (req: any, _res: any, next: any) => next(),
  requireRole: (..._roles: string[]) => (_req: any, __res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';
import { gdprService } from '../../services/gdpr.service';

const prisma: any = prismaTyped;

/** A restriction in force over the named processing. */
function restrictionRow(processingTypes: string[], overrides: Record<string, unknown> = {}) {
  return {
    id: 'dsar-restrict-1',
    userId: 'user-123',
    type: 'RESTRICTION',
    status: 'COMPLETED',
    requestDetails: JSON.stringify({ processingTypes, reason: 'Accuracy disputed' }),
    processingNotes: `Restriction in force over: ${processingTypes.join(', ')}`,
    requestedAt: new Date('2026-01-01T00:00:00.000Z'),
    completedAt: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides,
  };
}

/**
 * The restriction reader and the request history both go through findMany, so
 * the mock answers on the filter rather than on call order.
 */
function withRestrictions(restrictions: any[], history: any[] = []) {
  prisma.dSARRequest.findMany.mockImplementation((args: any) =>
    Promise.resolve(args?.where?.type === 'RESTRICTION' ? restrictions : history)
  );
}

/** Audit rows are written after the response is flushed. */
const flushAudit = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  jest.clearAllMocks();
  withRestrictions([]);
  prisma.privacyAuditLog.create.mockResolvedValue({ id: 'privacy-log-1' });
  prisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('GET /api/gdpr/retention-policies', () => {
  it('serves the retention policies actually on record', async () => {
    prisma.retentionPolicy.findMany.mockResolvedValue([
      {
        dataType: 'audit_logs',
        description: 'System and admin audit logs',
        dataCategory: 'TECHNICAL',
        retentionDays: 2555,
        retentionReason: 'Legal compliance requirement',
        legalBasis: 'LEGAL_OBLIGATION',
        anonymizeInstead: false,
        purgeJobName: 'anonymizeOldAuditLogs',
        lastPurgeAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);

    const res = await request(app).get('/api/gdpr/retention-policies').expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      dataType: 'audit_logs',
      retentionDays: 2555,
      legalBasis: 'LEGAL_OBLIGATION',
    });
    // Which job runs the purge is operational detail, not transparency.
    expect(res.body.data[0].purgeJobName).toBeUndefined();
    expect(res.body.data[0].lastPurgeAt).toBeUndefined();
  });

  it('returns an empty list rather than inventing policies', async () => {
    prisma.retentionPolicy.findMany.mockResolvedValue([]);

    const res = await request(app).get('/api/gdpr/retention-policies').expect(200);

    expect(res.body.data).toEqual([]);
  });
});

describe('POST /api/gdpr/dsar/restrict', () => {
  it('refuses processing it cannot actually switch off', async () => {
    const res = await request(app)
      .post('/api/gdpr/dsar/restrict')
      .send({ processingTypes: ['EVERYTHING'] })
      .expect(400);

    expect(res.body.error).toContain('EVERYTHING');
    expect(prisma.dSARRequest.create).not.toHaveBeenCalled();
  });

  it('refuses a request that names no processing at all', async () => {
    const res = await request(app).post('/api/gdpr/dsar/restrict').send({}).expect(400);

    expect(res.body.error).toContain('ANALYTICS');
    expect(prisma.dSARRequest.create).not.toHaveBeenCalled();
  });

  it('puts the restriction into force instead of only recording it', async () => {
    prisma.dSARRequest.create.mockResolvedValue({ id: 'dsar-restrict-1', userId: 'user-123' });
    prisma.dSARRequest.findUnique.mockResolvedValue({
      id: 'dsar-restrict-1',
      userId: 'user-123',
      type: 'RESTRICTION',
      status: 'PENDING',
    });
    prisma.dSARRequest.update.mockResolvedValue({});

    const res = await request(app)
      .post('/api/gdpr/dsar/restrict')
      .send({ processingTypes: ['ANALYTICS', 'ANALYTICS', 'MARKETING'], reason: 'Accuracy disputed' })
      .expect(200);

    expect(res.body.data.status).toBe('COMPLETED');
    expect(res.body.data.processingTypes).toEqual(['ANALYTICS', 'MARKETING']);

    expect(prisma.dSARRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'dsar-restrict-1' },
        data: expect.objectContaining({ status: 'COMPLETED' }),
      })
    );

    const auditRow = prisma.auditLog.create.mock.calls[0][0].data;
    expect(auditRow.action).toBe('DATA_ACCESS');
    expect(auditRow.metadata).toMatchObject({
      resourceId: 'dsar-restrict-1',
      dsarType: 'RESTRICTION',
      processingTypes: ['ANALYTICS', 'MARKETING'],
    });
  });
});

describe('GET /api/gdpr/dsar/restrictions', () => {
  it('reads the restrictions back with what they cover', async () => {
    withRestrictions([restrictionRow(['ANALYTICS'])]);

    const res = await request(app).get('/api/gdpr/dsar/restrictions').expect(200);

    expect(res.body.data.restrictions).toEqual([
      expect.objectContaining({
        requestId: 'dsar-restrict-1',
        processingTypes: ['ANALYTICS'],
        reason: 'Accuracy disputed',
      }),
    ]);
    expect(res.body.data.restrictable).toContain('THIRD_PARTY_SHARING');
  });
});

describe('Article 18 restriction gates consent', () => {
  it('reports a restricted consent as off even though the record says granted', async () => {
    withRestrictions([restrictionRow(['ANALYTICS'])]);
    prisma.consentRecord.findMany.mockResolvedValue([
      { consentType: 'ANALYTICS', status: 'GRANTED' },
      { consentType: 'MARKETING_EMAIL', status: 'GRANTED' },
    ]);

    const res = await request(app).get('/api/gdpr/consents').expect(200);

    expect(res.body.data.ANALYTICS).toBe(false);
    expect(res.body.data.MARKETING_EMAIL).toBe(true);
  });

  it('will not let a toggle re-grant restricted processing', async () => {
    withRestrictions([restrictionRow(['MARKETING'])]);

    const res = await request(app)
      .post('/api/gdpr/consents/MARKETING_EMAIL')
      .send({ granted: true })
      .expect(409);

    expect(res.body.code).toBe('PROCESSING_RESTRICTED');
    expect(prisma.consentRecord.upsert).not.toHaveBeenCalled();
  });

  it('still allows withdrawing an unrelated consent', async () => {
    withRestrictions([restrictionRow(['MARKETING'])]);
    prisma.consentRecord.upsert.mockResolvedValue({ id: 'consent-1', consentType: 'ANALYTICS' });

    await request(app)
      .post('/api/gdpr/consents/ANALYTICS')
      .send({ granted: false })
      .expect(200);

    expect(prisma.consentRecord.upsert).toHaveBeenCalled();
  });
});

describe('DELETE /api/gdpr/dsar/restrict/:requestId', () => {
  it('lifts a restriction the member owns', async () => {
    prisma.dSARRequest.findUnique.mockResolvedValue(restrictionRow(['ANALYTICS']));
    prisma.dSARRequest.update.mockResolvedValue({});

    const res = await request(app)
      .delete('/api/gdpr/dsar/restrict/dsar-restrict-1')
      .expect(200);

    expect(res.body.data.processingTypes).toEqual(['ANALYTICS']);
    expect(prisma.dSARRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'EXPIRED' }) })
    );
  });

  it('reports somebody else’s restriction as absent', async () => {
    prisma.dSARRequest.findUnique.mockResolvedValue(
      restrictionRow(['ANALYTICS'], { userId: 'user-999' })
    );

    await request(app).delete('/api/gdpr/dsar/restrict/dsar-restrict-1').expect(404);

    expect(prisma.dSARRequest.update).not.toHaveBeenCalled();
  });
});

describe('GET /api/gdpr/dsar', () => {
  it('keeps internal handling notes out of the subject’s own copy', async () => {
    withRestrictions([], [
      {
        id: 'dsar-1',
        userId: 'user-123',
        type: 'EXPORT',
        status: 'COMPLETED',
        assignedTo: 'admin-77',
        processingNotes: 'Escalated to the DPO',
        auditLogId: 'audit-9',
        dueDate: new Date('2026-02-01T00:00:00.000Z'),
      },
    ]);

    const res = await request(app).get('/api/gdpr/dsar').expect(200);

    expect(res.body.data[0].id).toBe('dsar-1');
    expect(res.body.data[0].status).toBe('COMPLETED');
    expect(res.body.data[0].assignedTo).toBeUndefined();
    expect(res.body.data[0].processingNotes).toBeUndefined();
    expect(res.body.data[0].userId).toBeUndefined();
  });

  it('writes a DATA_ACCESS row for the read', async () => {
    withRestrictions([], []);

    await request(app).get('/api/gdpr/dsar').expect(200);
    await flushAudit();

    const actions = prisma.auditLog.create.mock.calls.map((call: any) => call[0].data.action);
    expect(actions).toContain('DATA_ACCESS');
  });
});

describe('DSAR export and erasure leave an audit trail', () => {
  it('records DSAR_EXPORT against the member', async () => {
    jest
      .spyOn(gdprService, 'createDSARRequest')
      .mockResolvedValue({ id: 'dsar-export-1' } as any);
    jest.spyOn(gdprService, 'processExportRequest').mockResolvedValue({
      requestId: 'dsar-export-1',
      downloadToken: 'token',
      downloadUrl: '/api/gdpr/download/token',
      expiresAt: new Date('2026-01-05T00:00:00.000Z'),
      data: {
        metadata: {
          exportedAt: '2026-01-02T00:00:00.000Z',
          requestId: 'dsar-export-1',
          format: 'JSON',
          sections: 4,
        },
        account: {},
        records: {},
        excluded: [],
      },
    } as any);

    await request(app).post('/api/gdpr/dsar/export').expect(200);

    const auditRow = prisma.auditLog.create.mock.calls[0][0].data;
    expect(auditRow.action).toBe('DSAR_EXPORT');
    expect(auditRow.actorUserId).toBe('user-123');
    expect(auditRow.metadata).toMatchObject({ requestId: 'dsar-export-1', sections: 4 });
  });

  it('records ACCOUNT_DELETE without naming the member it erased', async () => {
    jest
      .spyOn(gdprService, 'createDSARRequest')
      .mockResolvedValue({ id: 'dsar-delete-1' } as any);
    jest.spyOn(gdprService, 'processDeletionRequest').mockResolvedValue({
      requestId: 'dsar-delete-1',
      status: 'COMPLETED',
      accountRemoved: true,
      retainedSections: [],
      rowsRemoved: 42,
    } as any);

    await request(app)
      .post('/api/gdpr/dsar/delete')
      .send({ confirmation: 'DELETE_MY_ACCOUNT' })
      .expect(200);

    const auditRow = prisma.auditLog.create.mock.calls[0][0].data;
    expect(auditRow.action).toBe('ACCOUNT_DELETE');
    expect(auditRow.actorUserId).toBeNull();
    expect(auditRow.targetUserId).toBeNull();
    expect(auditRow.ipAddress).toBeNull();
    expect(auditRow.metadata).toMatchObject({ requestId: 'dsar-delete-1', accountRemoved: true });
  });
});

describe('Record of processing activities', () => {
  it('refuses a legal basis the regulation does not have', async () => {
    await request(app)
      .post('/api/gdpr/ropa')
      .send({
        name: 'Candidate matching',
        description: 'Ranks jobs for members',
        department: 'Product',
        legalBasis: 'BECAUSE_WE_WANT_TO',
        retentionPeriod: '2 years after account closure',
      })
      .expect(400);

    expect(prisma.processingActivity.create).not.toHaveBeenCalled();
  });

  it('records an activity and who recorded it', async () => {
    prisma.processingActivity.create.mockResolvedValue({
      id: 'pa-1',
      name: 'Candidate matching',
      department: 'Product',
    });

    const res = await request(app)
      .post('/api/gdpr/ropa')
      .send({
        name: 'Candidate matching',
        description: 'Ranks jobs for members',
        department: 'Product',
        legalBasis: 'LEGITIMATE_INTERESTS',
        retentionPeriod: '2 years after account closure',
        dataCategories: ['PII', 'BEHAVIORAL'],
        purposes: ['Job recommendations'],
      })
      .expect(201);

    expect(res.body.data.id).toBe('pa-1');
    expect(prisma.processingActivity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        legalBasis: 'LEGITIMATE_INTERESTS',
        dataCategories: ['PII', 'BEHAVIORAL'],
        purposes: ['Job recommendations'],
      }),
    });
    expect(prisma.privacyAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'ROPA_ACTIVITY_CREATED',
          adminId: 'user-123',
          resourceId: 'pa-1',
        }),
      })
    );
  });

  it('retires an activity rather than removing it from the record', async () => {
    prisma.processingActivity.findUnique.mockResolvedValue({ id: 'pa-1', isActive: true });
    prisma.processingActivity.update.mockResolvedValue({ id: 'pa-1', isActive: false });

    const res = await request(app).delete('/api/gdpr/ropa/pa-1').expect(200);

    expect(res.body.data.isActive).toBe(false);
    expect(prisma.processingActivity.update).toHaveBeenCalledWith({
      where: { id: 'pa-1' },
      data: { isActive: false },
    });
  });

  it('answers 404 for an activity that is not there', async () => {
    prisma.processingActivity.findUnique.mockResolvedValue(null);

    await request(app).get('/api/gdpr/ropa/missing').expect(404);
  });
});

describe('DPIA', () => {
  it('opens an assessment', async () => {
    prisma.dPIA.create.mockResolvedValue({ id: 'dpia-1', title: 'Safety scoring' });

    const res = await request(app)
      .post('/api/gdpr/dpia')
      .send({
        title: 'Safety scoring',
        description: 'Scores accounts for safety signals',
        featureOrSystem: 'SafetyScore',
        necessity: 'Required to keep the community safe',
        proportionality: 'Limited to signals members already generate',
        residualRiskLevel: 'MEDIUM',
        risks: [{ description: 'False positives', likelihood: 'LOW', impact: 'MEDIUM' }],
        mitigations: [{ risk: 'False positives', measure: 'Appeals route', status: 'IN_PLACE' }],
      })
      .expect(201);

    expect(res.body.data.id).toBe('dpia-1');
  });

  it('rejects a residual risk level nothing else understands', async () => {
    await request(app)
      .post('/api/gdpr/dpia')
      .send({
        title: 'Safety scoring',
        description: 'Scores accounts for safety signals',
        featureOrSystem: 'SafetyScore',
        necessity: 'Required to keep the community safe',
        proportionality: 'Limited to signals members already generate',
        residualRiskLevel: 'CATASTROPHIC',
        risks: [],
        mitigations: [],
      })
      .expect(400);

    expect(prisma.dPIA.create).not.toHaveBeenCalled();
  });

  it('stamps sign-off server side', async () => {
    prisma.dPIA.findUnique.mockResolvedValue({ id: 'dpia-1', status: 'PENDING_REVIEW' });
    prisma.dPIA.update.mockResolvedValue({ id: 'dpia-1', status: 'APPROVED' });

    await request(app)
      .patch('/api/gdpr/dpia/dpia-1')
      .send({ status: 'APPROVED', approvedBy: 'somebody-else' })
      .expect(200);

    const written = prisma.dPIA.update.mock.calls[0][0].data;
    expect(written.approvedBy).toBe('user-123');
    expect(written.approvedAt).toBeInstanceOf(Date);
  });
});
