/**
 * What the shared erasure does about billing, through each door that reaches it.
 *
 * eraseUser is behind the member's own deletion, the data-rights request, the
 * sweep of requests that have come due (written, and tested here, but not yet
 * scheduled anywhere) and a staff erasure. Ending the
 * Stripe billing is its first step, so none of them can leave a card being
 * charged for an account that is gone, and a failure to end it leaves the
 * account, and everything in it, exactly as it was.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const order: string[] = [];

jest.mock('../../utils/prisma', () => {
  const dedicated: Record<string, any> = {
    user: { findUnique: jest.fn() },
    legalHold: { findFirst: jest.fn() },
    dSARRequest: { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    privacyAuditLog: { create: jest.fn(), findFirst: jest.fn() },
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

const endBilling = jest.fn<(userId: string) => Promise<unknown>>();
jest.mock('../erasure-billing.service', () => ({
  endBillingBeforeErasure: (userId: string) => endBilling(userId),
}));

const redactBeforeErasure = jest.fn<(userId: string) => Promise<void>>();
jest.mock('../identity-verification.service', () => ({
  redactIdentityChecksBeforeErasure: (userId: string) => redactBeforeErasure(userId),
  redactIdentitySession: jest.fn(async () => true),
}));

const announceRevoked = jest.fn();
jest.mock('../../utils/session-events', () => ({ sessionEvents: { announceRevoked: (event: unknown) => announceRevoked(event) } }));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { gdprService } from '../gdpr.service';
import { ApiError } from '../../middleware/errorHandler';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;

const OUTCOME = { requestId: 'dsar-1', status: 'COMPLETED', accountRemoved: false, retainedSections: ['subscriptions'], rowsRemoved: 9 };
const REFUSAL = new ApiError(409, 'We could not end your membership billing just now, so your account has not been deleted.');

beforeEach(() => {
  jest.clearAllMocks();
  order.length = 0;
  prisma.user.findUnique.mockResolvedValue({ id: 'her' });
  prisma.legalHold.findFirst.mockResolvedValue(null);
  prisma.dSARRequest.findUnique.mockResolvedValue({ id: 'dsar-1', userId: 'her', type: 'DELETION', status: 'PENDING' });
  prisma.dSARRequest.update.mockResolvedValue({});
  prisma.privacyAuditLog.create.mockResolvedValue({});
  prisma.$transaction.mockImplementation(async () => {
    order.push('transaction');
    return OUTCOME;
  });
  endBilling.mockImplementation(async () => {
    order.push('billing');
    return { subscriptionCancelled: true, payoutBalanceFlagged: false };
  });
  redactBeforeErasure.mockImplementation(async () => {
    order.push('redact');
  });
});

describe('a member’s own erasure request', () => {
  it('ends the billing before it redacts her identity checks or writes anything', async () => {
    const outcome = await gdprService.processDeletionRequest('dsar-1');

    expect(outcome.status).toBe('COMPLETED');
    expect(endBilling).toHaveBeenCalledWith('her');
    expect(order).toEqual(['billing', 'redact', 'transaction']);
  });

  it('is refused with the 409, and nothing is erased, when billing could not be ended', async () => {
    endBilling.mockRejectedValue(REFUSAL);

    await expect(gdprService.processDeletionRequest('dsar-1')).rejects.toBe(REFUSAL);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(redactBeforeErasure).not.toHaveBeenCalled();
    // And nobody is told her sockets were closed for an account that still stands.
    expect(announceRevoked).not.toHaveBeenCalled();
    expect(prisma.privacyAuditLog.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'DSAR_ERASURE_COMPLETED' }) })
    );
  });

  it('goes back to waiting, with the reason, instead of staying "in progress" for work nobody is doing', async () => {
    endBilling.mockRejectedValue(REFUSAL);

    await expect(gdprService.processDeletionRequest('dsar-1')).rejects.toBe(REFUSAL);

    const updates = prisma.dSARRequest.update.mock.calls.map((call: any[]) => call[0].data);
    expect(updates[0]).toMatchObject({ status: 'IN_PROGRESS' });
    expect(updates[updates.length - 1]).toMatchObject({ status: 'PENDING' });
    expect(updates[updates.length - 1].processingNotes).toMatch(/membership billing/);
  });

  it('is not asked about billing at all when a legal hold refuses the erasure', async () => {
    prisma.legalHold.findFirst.mockResolvedValue({ id: 'hold-1' });

    const outcome = await gdprService.processDeletionRequest('dsar-1');

    expect(outcome.status).toBe('REJECTED');
    expect(endBilling).not.toHaveBeenCalled();
  });

  it('can be tried again after a refusal, and then goes through', async () => {
    endBilling.mockRejectedValueOnce(REFUSAL);
    await expect(gdprService.processDeletionRequest('dsar-1')).rejects.toBe(REFUSAL);

    const outcome = await gdprService.processDeletionRequest('dsar-1');

    expect(outcome.status).toBe('COMPLETED');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe('a staff erasure', () => {
  it('ends the billing first, the same as the member’s own', async () => {
    const outcome = await gdprService.eraseAccountByAdmin('her', { adminId: 'admin-1' });

    expect(outcome.status).toBe('COMPLETED');
    expect(order).toEqual(['billing', 'redact', 'transaction']);
  });

  it('is refused the same way, with nothing erased', async () => {
    endBilling.mockRejectedValue(REFUSAL);

    await expect(gdprService.eraseAccountByAdmin('her', { adminId: 'admin-1' })).rejects.toBe(REFUSAL);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('the sweep of requests that have come due (not yet scheduled)', () => {
  it('leaves a request it could not carry out waiting, and counts it as failed', async () => {
    prisma.dSARRequest.findMany.mockResolvedValue([{ id: 'dsar-1' }]);
    endBilling.mockRejectedValue(REFUSAL);

    const result = await gdprService.processDueDeletionRequests();

    expect(result).toEqual({ processed: 0, failed: 1 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    const last = prisma.dSARRequest.update.mock.calls.at(-1)[0];
    expect(last.data.status).toBe('PENDING');
  });
});
