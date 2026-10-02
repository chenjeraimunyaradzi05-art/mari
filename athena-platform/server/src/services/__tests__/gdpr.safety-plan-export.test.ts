/**
 * A safety plan is kept sealed, so a data export that copied the row as it
 * stands would hand her back ciphertext: a file that satisfies the request in
 * name and tells her nothing. The export has to open the plan the way her own
 * page does, and never put a sealed string in the bundle.
 */

jest.mock('../../utils/prisma', () => {
  const dedicated: Record<string, any> = {
    dSARRequest: { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn(async () => []) },
    user: { findUnique: jest.fn() },
    privacyAuditLog: { create: jest.fn(), findMany: jest.fn(async () => []) },
    safetyPlan: { findMany: jest.fn() },
  };
  // Every other table in the register reads as empty.
  const prisma = new Proxy(dedicated, {
    get: (target, name: string) => {
      if (!(name in target)) target[name] = { findMany: jest.fn(async () => []) };
      return target[name];
    },
  });
  return { prisma };
});

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { gdprService } from '../gdpr.service';
import { prisma as prismaTyped } from '../../utils/prisma';
import { sealPlanLines } from '../../utils/safety-plan-seal';

const prisma: any = prismaTyped;

describe('The data export and the safety plan', () => {
  const env = { ...process.env };
  beforeEach(() => {
    process.env = { ...env, NODE_ENV: 'test', DV_ENCRYPTION_KEY: 'a'.repeat(64) };
    prisma.dSARRequest.findUnique.mockResolvedValue({ id: 'dsar-1', userId: 'her' });
    prisma.dSARRequest.update.mockResolvedValue({});
    prisma.user.findUnique.mockResolvedValue({ id: 'her', email: 'her@athena.test' });
    prisma.privacyAuditLog.create.mockResolvedValue({});
  });
  afterEach(() => {
    process.env = env;
  });

  it('puts her plan in the bundle as plain text, not as sealed strings', async () => {
    prisma.safetyPlan.findMany.mockResolvedValue([
      {
        id: 'plan-1',
        userId: 'her',
        safeLocations: sealPlanLines(['12 Wattle St, Ipswich']),
        exitStrategies: sealPlanLines(['Take the 6pm bus', 'Bag is in the shed']),
        legalContacts: ['Women’s Legal Service'],
      },
    ]);

    const { data } = await gdprService.processExportRequest('dsar-1');

    const plan: any = data.records.safetyPlan[0];
    expect(plan.safeLocations).toEqual(['12 Wattle St, Ipswich']);
    expect(plan.exitStrategies).toEqual(['Take the 6pm bus', 'Bag is in the shed']);
    expect(plan.legalContacts).toEqual(['Women’s Legal Service']);
    expect(JSON.stringify(data)).not.toContain('enc:v1:');
    expect(prisma.safetyPlan.findMany).toHaveBeenCalledWith({ where: { userId: 'her' } });
  });

  it('says so, rather than showing bytes, when a part cannot be opened', async () => {
    process.env.DV_ENCRYPTION_KEY = 'b'.repeat(64);
    const sealedElsewhere = sealPlanLines(['Old address']);
    process.env.DV_ENCRYPTION_KEY = 'a'.repeat(64);
    prisma.safetyPlan.findMany.mockResolvedValue([{ id: 'plan-1', userId: 'her', safeLocations: sealedElsewhere }]);

    const { data } = await gdprService.processExportRequest('dsar-1');

    const plan: any = data.records.safetyPlan[0];
    expect(plan.safeLocations).toBeNull();
    expect(plan.unreadableParts).toEqual(['safeLocations']);
    expect(JSON.stringify(data)).not.toContain('enc:v1:');
  });
});
