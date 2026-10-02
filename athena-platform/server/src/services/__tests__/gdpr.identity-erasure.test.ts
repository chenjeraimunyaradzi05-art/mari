/**
 * Erasing an account deletes the member's verification badges, and the session
 * id on each is the only handle there is to the photo ID and selfie Stripe holds
 * for her. If the badges went first, her document would stay at Stripe for as
 * long as Stripe's own terms allow with nothing here that could ever find it. So
 * Stripe is asked to erase the checks before the rows are deleted, and the
 * request never holds the erasure up.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const order: string[] = [];

jest.mock('../../utils/prisma', () => {
  const dedicated: Record<string, any> = {
    user: { findUnique: jest.fn() },
    legalHold: { findFirst: jest.fn() },
    privacyAuditLog: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  const prisma = new Proxy(dedicated, {
    get: (target, name: string) => {
      if (!(name in target)) target[name] = { findMany: jest.fn(async () => []) };
      return target[name];
    },
  });
  return { prisma };
});

const redactBeforeErasure = jest.fn<(userId: string) => Promise<void>>();
jest.mock('../identity-verification.service', () => ({
  redactIdentityChecksBeforeErasure: (userId: string) => redactBeforeErasure(userId),
  redactIdentitySession: jest.fn(async () => true),
}));

// Ending the billing has its own tests (erasure-billing.service.test.ts and
// gdpr.erasure-billing.test.ts); here it is a step that succeeds.
jest.mock('../erasure-billing.service', () => ({
  endBillingBeforeErasure: jest.fn(async () => ({ subscriptionCancelled: false, payoutBalanceFlagged: false })),
}));

jest.mock('../../utils/session-events', () => ({ sessionEvents: { announceRevoked: jest.fn() } }));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { gdprService } from '../gdpr.service';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;

const OUTCOME = { requestId: 'ADMIN-ERASURE-her', status: 'COMPLETED', accountRemoved: true, retainedSections: [], rowsRemoved: 3 };

beforeEach(() => {
  jest.clearAllMocks();
  order.length = 0;
  prisma.user.findUnique.mockResolvedValue({ id: 'her' });
  prisma.legalHold.findFirst.mockResolvedValue(null);
  prisma.privacyAuditLog.create.mockResolvedValue({});
  prisma.$transaction.mockImplementation(async () => {
    order.push('transaction');
    return OUTCOME;
  });
  redactBeforeErasure.mockImplementation(async () => {
    order.push('redact');
  });
});

describe('erasing an account and the photo ID checks held at Stripe', () => {
  it('asks Stripe to erase the member’s checks before the erasure transaction deletes her badges', async () => {
    const outcome = await gdprService.eraseAccountByAdmin('her', { adminId: 'admin-1' });

    expect(outcome.status).toBe('COMPLETED');
    expect(redactBeforeErasure).toHaveBeenCalledWith('her');
    expect(order).toEqual(['redact', 'transaction']);
  });

  it('goes on with the erasure when the redaction fails, whatever the reason', async () => {
    redactBeforeErasure.mockRejectedValue(new Error('Stripe is down'));

    const outcome = await gdprService.eraseAccountByAdmin('her', { adminId: 'admin-1' });

    expect(outcome.status).toBe('COMPLETED');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('asks nothing of Stripe when the erasure is refused for a legal hold', async () => {
    prisma.legalHold.findFirst.mockResolvedValue({ id: 'hold-1' });

    const outcome = await gdprService.eraseAccountByAdmin('her', { adminId: 'admin-1' });

    expect(outcome.status).toBe('REJECTED');
    expect(redactBeforeErasure).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
