/**
 * Erasing an account takes the member's address off the email suppression list.
 *
 * EmailSuppression is written by SendGrid's event webhook and keyed by the
 * address, not the account, so the personal-data register walk cannot reach it.
 * Left alone it kept her address, in clear, after everything else that named
 * her had gone, which is not an erasure. The row is read off the account and
 * removed inside the erasure transaction, before the row that holds the
 * address is deleted or tombstoned.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../utils/prisma', () => {
  // Every model the erasure walk touches, with the methods it calls. The
  // register throws on a model with no findMany, so each has one.
  const delegateFor = () => ({
    findMany: jest.fn(async () => []),
    findUnique: jest.fn(async () => null),
    deleteMany: jest.fn(async () => ({ count: 0 })),
    updateMany: jest.fn(async () => ({ count: 0 })),
    update: jest.fn(async () => ({})),
    delete: jest.fn(async () => ({})),
    count: jest.fn(async () => 0),
  });
  const txModels: Record<string | symbol, any> = { $executeRaw: jest.fn(async () => 0) };
  const tx = new Proxy(txModels, {
    get: (target, name) => {
      if (!(name in target)) target[name] = delegateFor();
      return target[name];
    },
  });
  const dedicated: Record<string | symbol, any> = {
    user: { findUnique: jest.fn() },
    legalHold: { findFirst: jest.fn() },
    privacyAuditLog: { create: jest.fn() },
    // The real callback runs, against the transaction client above.
    $transaction: jest.fn(async (work: any) => work(tx)),
    __tx: tx,
  };
  const prisma = new Proxy(dedicated, {
    get: (target, name) => {
      if (!(name in target)) target[name] = { findMany: jest.fn(async () => []) };
      return target[name];
    },
  });
  return { prisma };
});

jest.mock('../identity-verification.service', () => ({
  redactIdentityChecksBeforeErasure: jest.fn(async () => undefined),
  redactIdentitySession: jest.fn(async () => true),
}));

jest.mock('../erasure-billing.service', () => ({
  endBillingBeforeErasure: jest.fn(async () => ({ subscriptionCancelled: false, payoutBalanceFlagged: false })),
}));

jest.mock('../chat-attachment-cleanup.service', () => ({
  chatFilesOfMember: jest.fn(async () => []),
  deleteChatAttachmentFiles: jest.fn(async () => undefined),
}));

jest.mock('../../utils/session-events', () => ({ sessionEvents: { announceRevoked: jest.fn() } }));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { gdprService } from '../gdpr.service';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;
const tx: any = prisma.__tx;

beforeEach(() => {
  jest.clearAllMocks();
  prisma.user.findUnique.mockResolvedValue({ id: 'her' });
  prisma.legalHold.findFirst.mockResolvedValue(null);
  prisma.privacyAuditLog.create.mockResolvedValue({});
  tx.user.findUnique.mockResolvedValue({ email: ' Her@Example.org ' });
  tx.emailSuppression.deleteMany.mockResolvedValue({ count: 1 });
  tx.user.delete.mockResolvedValue({});
});

describe('erasing an account and the email suppression list', () => {
  it('removes her address from the list, as it is stored, inside the erasure transaction and before her account row goes', async () => {
    const outcome = await gdprService.eraseAccountByAdmin('her', { adminId: 'admin-1' });

    expect(outcome.status).toBe('COMPLETED');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.emailSuppression.deleteMany).toHaveBeenCalledTimes(1);
    // Trimmed and lower-cased: the shape the webhook writes and the sender looks up.
    expect(tx.emailSuppression.deleteMany).toHaveBeenCalledWith({ where: { email: 'her@example.org' } });

    // The address is read, and the row removed, before the account row that
    // holds the address is deleted; afterwards there would be nothing to read.
    const readAt = tx.user.findUnique.mock.invocationCallOrder[0];
    const removedAt = tx.emailSuppression.deleteMany.mock.invocationCallOrder[0];
    const accountGoneAt = tx.user.delete.mock.invocationCallOrder[0];
    expect(readAt).toBeLessThan(removedAt);
    expect(removedAt).toBeLessThan(accountGoneAt);

    // Counted with the rest of what the erasure removed.
    expect(outcome.rowsRemoved).toBe(1);
  });

  it('asks nothing of the list when the account has no address to look up, and the erasure goes on', async () => {
    tx.user.findUnique.mockResolvedValue(null);

    const outcome = await gdprService.eraseAccountByAdmin('her', { adminId: 'admin-1' });

    expect(outcome.status).toBe('COMPLETED');
    expect(tx.emailSuppression.deleteMany).not.toHaveBeenCalled();
    expect(tx.user.delete).toHaveBeenCalledTimes(1);
  });

  it('is one transaction with the rest: a list that cannot be cleared fails the erasure rather than leaving the address behind', async () => {
    tx.emailSuppression.deleteMany.mockRejectedValue(new Error('connection reset'));

    await expect(gdprService.eraseAccountByAdmin('her', { adminId: 'admin-1' })).rejects.toThrow('connection reset');

    expect(tx.user.delete).not.toHaveBeenCalled();
  });
});
