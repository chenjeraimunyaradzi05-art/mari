/**
 * Where a staff action is filed in the audit log.
 *
 * Every row recordAdminAction wrote used to be DATA_ACCESS with the real verb
 * in metadata, so a privacy officer asking who read member data was handed
 * flag flips and blog edits, and "who changed the platform's configuration"
 * could only be answered by reading the JSON of every row. Each verb is now
 * filed under the enum value it belongs to, and still carries itself in
 * metadata so the precise verb is never lost.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: { auditLog: { create: jest.fn(async () => ({ id: 'audit-1' })) } },
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  redactSensitive: (value: unknown) => value,
}));

import { prisma as prismaTyped } from '../../utils/prisma';
import type { AuthRequest } from '../../middleware/auth';
import {
  ADMIN_AUDIT_ACTION_NAMES,
  LEGACY_ADMIN_AUDIT_ACTION,
  adminVerbsFiledUnder,
  auditActionFor,
  isAdminAuditAction,
  recordAdminAction,
} from '../admin-audit.service';

const prisma: any = prismaTyped;

function staffRequest(): AuthRequest {
  return {
    user: { id: 'admin-1', role: 'ADMIN', email: 'admin@athena.test' },
    ip: '203.0.113.9',
    get: () => 'jest',
  } as unknown as AuthRequest;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('recordAdminAction', () => {
  it.each([
    ['FEATURE_FLAG_UPDATED', 'ADMIN_CONFIG_UPDATE'],
    ['MAINTENANCE_MODE_CHANGED', 'ADMIN_CONFIG_UPDATE'],
    ['DV_SERVICE_UPDATED', 'ADMIN_CONTENT_UPDATE'],
    ['ACCELERATOR_ENROLLMENT_REVOKED', 'ADMIN_CONTENT_UPDATE'],
    ['CAR_PURCHASE_DISPUTE_RESOLVED', 'ADMIN_CONTENT_UPDATE'],
    ['SAFETY_REPORT_UPHELD', 'SAFETY_REPORT_DECIDED'],
  ] as const)('files %s under %s and keeps the verb in metadata', async (verb, filedUnder) => {
    await recordAdminAction(staffRequest(), verb, { resourceType: 'Thing', resourceId: 'thing-1' });

    const row = prisma.auditLog.create.mock.calls[0][0].data;
    expect(row.action).toBe(filedUnder);
    expect(row.metadata).toMatchObject({ adminAction: verb, resourceType: 'Thing', resourceId: 'thing-1' });
    expect(row.actorUserId).toBe('admin-1');
  });

  it('files nothing new under the old catch-all', () => {
    for (const verb of ADMIN_AUDIT_ACTION_NAMES) {
      expect(auditActionFor(verb)).not.toBe(LEGACY_ADMIN_AUDIT_ACTION);
    }
  });
});

describe('adminVerbsFiledUnder', () => {
  it('lists the verbs a filter on an enum value must also look for among older rows', () => {
    const config = adminVerbsFiledUnder('ADMIN_CONFIG_UPDATE');
    expect(config).toContain('FEATURE_FLAG_CREATED');
    expect(config).not.toContain('BLOG_ARTICLE_UPDATED');
    expect(adminVerbsFiledUnder('DATA_ACCESS')).toEqual([]);
  });

  it('knows its own vocabulary', () => {
    expect(isAdminAuditAction('GRANT_APPLICATION_DECIDED')).toBe(true);
    expect(isAdminAuditAction('toString')).toBe(false);
  });
});
