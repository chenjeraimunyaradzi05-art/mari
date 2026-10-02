/**
 * The lock service on its own, for the cases the route suite reaches only
 * indirectly: an account that is already locked, one that does not exist, and a
 * mail provider that fails or throws. A lock must never be undone by a mail
 * outage, and a second press must not send a second email.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const prismaMock: any = {
  user: { findUnique: jest.fn(), updateMany: jest.fn() },
  verificationToken: { create: jest.fn(), findFirst: jest.fn(), deleteMany: jest.fn() },
  $transaction: jest.fn(async (work: any) => work(prismaMock)),
};

jest.mock('../../utils/prisma', () => ({ prisma: prismaMock }));
jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../../utils/audit', () => ({ logAudit: jest.fn(async () => undefined) }));
jest.mock('../session.service', () => ({
  sessionService: { revokeAllUserSessions: jest.fn(async () => ({ count: 1 })) },
}));
jest.mock('../../utils/email', () => ({ sendAccountLockedEmail: jest.fn(async () => true) }));

import { logAudit } from '../../utils/audit';
import { sendAccountLockedEmail } from '../../utils/email';
import { sessionService } from '../session.service';
import { hashOpaqueToken } from '../../utils/opaqueToken';
import {
  LOCK_LINK_TOKEN_TYPE,
  UNLOCK_TOKEN_TYPE,
  issueLockLink,
  lockAccount,
  lockAccountByLink,
  mailUnlockLink,
  unlockAccount,
} from '../account-lock.service';

const revokeAll = sessionService.revokeAllUserSessions as unknown as jest.Mock<(...args: any[]) => Promise<unknown>>;
const sendMail = sendAccountLockedEmail as unknown as jest.Mock<(...args: any[]) => Promise<boolean>>;
const audit = logAudit as unknown as jest.Mock<(...args: any[]) => Promise<void>>;

const ACCOUNT = { id: 'her', email: 'her@ourdomain.org', firstName: 'Maya', lockedAt: null as Date | null };

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.user.findUnique.mockResolvedValue({ ...ACCOUNT });
  prismaMock.user.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.verificationToken.create.mockResolvedValue({ id: 'link-1', createdAt: new Date() });
  prismaMock.verificationToken.deleteMany.mockResolvedValue({ count: 0 });
  sendMail.mockResolvedValue(true);
});

describe('lockAccount', () => {
  it('answers null for an account that does not exist, and does nothing', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(lockAccount('ghost', 'settings')).resolves.toBeNull();

    expect(prismaMock.user.updateMany).not.toHaveBeenCalled();
    expect(revokeAll).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('locks only an account that is not already locked, so two presses agree on who locked it', async () => {
    await lockAccount('her', 'settings');

    expect(prismaMock.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'her', lockedAt: null },
      data: { lockedAt: expect.any(Date) },
    });
  });

  it('on an account that is already locked: ends the sessions again, sends no second email, writes no second audit row', async () => {
    prismaMock.user.updateMany.mockResolvedValue({ count: 0 });

    const outcome = await lockAccount('her', 'email-link');

    expect(outcome).toEqual({ alreadyLocked: true, unlockEmailSent: false });
    expect(revokeAll).toHaveBeenCalledWith('her', { reason: 'locked' });
    expect(sendMail).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('is still locked when the mail provider throws, and says the email was not sent', async () => {
    sendMail.mockRejectedValue(new Error('provider down'));

    const outcome = await lockAccount('her', 'settings');

    expect(outcome).toEqual({ alreadyLocked: false, unlockEmailSent: false });
    expect(revokeAll).toHaveBeenCalledTimes(1);
  });

  it('does not make a lock wait on the mail provider for half a minute: two quick tries, well inside ten seconds', async () => {
    await lockAccount('her', 'settings');

    const policy = sendMail.mock.calls[0][3] as { maxAttempts: number; attemptTimeoutMs: number; backoffMs: number[] };
    expect(policy).toBeDefined();
    // The slowest it can be, with the backoff's quarter either way, is shorter than the ten seconds
    // after which the web host and the phone app give up and report a lock that happened as one that did not.
    const worstCase =
      policy.maxAttempts * policy.attemptTimeoutMs +
      policy.backoffMs.slice(1, policy.maxAttempts).reduce((total, wait) => total + wait * 1.25, 0);
    expect(worstCase).toBeLessThan(10_000);
  });

  it('records where the lock came from', async () => {
    await lockAccount('her', 'email-link', { ipAddress: '203.0.113.9', userAgent: 'Mail app' });

    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ACCOUNT_LOCKED',
        ipAddress: '203.0.113.9',
        userAgent: 'Mail app',
        metadata: { source: 'email-link', unlockEmailSent: true },
      })
    );
  });
});

describe('mailUnlockLink', () => {
  it('retires older links only after the new one has been accepted by the provider', async () => {
    const createdAt = new Date('2026-10-01T00:00:00Z');
    prismaMock.verificationToken.create.mockResolvedValue({ id: 'new', createdAt });

    await expect(mailUnlockLink(ACCOUNT)).resolves.toBe(true);

    expect(prismaMock.verificationToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'her', type: UNLOCK_TOKEN_TYPE, createdAt: { lt: createdAt } },
    });
  });

  it('withdraws only its own link when the mail was refused, so a link she already holds still works', async () => {
    sendMail.mockResolvedValue(false);

    await expect(mailUnlockLink(ACCOUNT)).resolves.toBe(false);

    expect(prismaMock.verificationToken.deleteMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.verificationToken.deleteMany).toHaveBeenCalledWith({ where: { id: 'link-1' } });
  });

  it('keeps the default delivery for a caller that is not being waited on, such as a request for a new link', async () => {
    await mailUnlockLink(ACCOUNT);

    expect(sendMail.mock.calls[0][3]).toBeUndefined();
  });

  it('never throws: a database failure is a mail that did not go', async () => {
    prismaMock.verificationToken.create.mockRejectedValue(new Error('db away'));
    await expect(mailUnlockLink(ACCOUNT)).resolves.toBe(false);
  });

  it('stores only the hash of the token it mails', async () => {
    await mailUnlockLink(ACCOUNT);

    const mailed = sendMail.mock.calls[0][2] as string;
    expect(prismaMock.verificationToken.create.mock.calls[0][0].data).toMatchObject({
      userId: 'her',
      type: UNLOCK_TOKEN_TYPE,
      token: hashOpaqueToken(mailed),
    });
  });
});

describe('issueLockLink', () => {
  it('returns a token that exists only in the email and stores its hash with the lock-link type', async () => {
    const token = await issueLockLink('her');

    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(prismaMock.verificationToken.create.mock.calls[0][0].data).toMatchObject({
      userId: 'her',
      type: LOCK_LINK_TOKEN_TYPE,
      token: hashOpaqueToken(token),
    });
  });
});

describe('lockAccountByLink', () => {
  const TOKEN = 'd'.repeat(64);
  const LINK = { id: 'lock-link-1', userId: 'her' };

  it('looks the link up by its hash and its type, and locks nothing for one that is not there', async () => {
    prismaMock.verificationToken.findFirst.mockResolvedValue(null);

    await expect(lockAccountByLink(TOKEN)).resolves.toBeNull();

    expect(prismaMock.verificationToken.findFirst.mock.calls[0][0].where).toMatchObject({
      token: hashOpaqueToken(TOKEN),
      type: LOCK_LINK_TOKEN_TYPE,
    });
    expect(prismaMock.user.updateMany).not.toHaveBeenCalled();
    expect(revokeAll).not.toHaveBeenCalled();
  });

  it('locks the account and then spends the link', async () => {
    prismaMock.verificationToken.findFirst.mockResolvedValue(LINK);

    const outcome = await lockAccountByLink(TOKEN, { ipAddress: '203.0.113.9' });

    expect(outcome).toEqual({ alreadyLocked: false, unlockEmailSent: true });
    expect(prismaMock.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'her', lockedAt: null },
      data: { lockedAt: expect.any(Date) },
    });
    expect(prismaMock.verificationToken.deleteMany).toHaveBeenCalledWith({ where: { id: 'lock-link-1' } });
    // The lock, then the spending: not the other way round.
    const locked = prismaMock.user.updateMany.mock.invocationCallOrder[0];
    const spent = prismaMock.verificationToken.deleteMany.mock.invocationCallOrder.at(-1);
    expect(locked).toBeLessThan(spent);
  });

  it('leaves the link good for another try when the lock fails part-way, so she is not told it is invalid for an account that is still open', async () => {
    prismaMock.verificationToken.findFirst.mockResolvedValue(LINK);
    prismaMock.user.findUnique.mockRejectedValue(new Error('db away'));

    await expect(lockAccountByLink(TOKEN)).rejects.toThrow('db away');

    expect(prismaMock.verificationToken.deleteMany).not.toHaveBeenCalledWith({ where: { id: 'lock-link-1' } });
  });

  it('answers both when one link is opened twice at once, mails the unlock link once, and says the second found it locked', async () => {
    prismaMock.verificationToken.findFirst.mockResolvedValue(LINK);
    // The conditional write lets exactly one request do the locking.
    prismaMock.user.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });

    const outcomes = await Promise.all([lockAccountByLink(TOKEN), lockAccountByLink(TOKEN)]);

    expect(outcomes.map((outcome) => outcome?.alreadyLocked).sort()).toEqual([false, true]);
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it('answers null for a link whose account has gone, and still spends the link', async () => {
    prismaMock.verificationToken.findFirst.mockResolvedValue(LINK);
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(lockAccountByLink(TOKEN)).resolves.toBeNull();

    expect(prismaMock.verificationToken.deleteMany).toHaveBeenCalledWith({ where: { id: 'lock-link-1' } });
  });
});

describe('unlockAccount', () => {
  it('looks the link up by its hash and by its type, so no other kind of link will do', async () => {
    prismaMock.verificationToken.findFirst.mockResolvedValue(null);

    await expect(unlockAccount('c'.repeat(64))).resolves.toBeNull();

    expect(prismaMock.verificationToken.findFirst.mock.calls[0][0].where).toMatchObject({
      token: hashOpaqueToken('c'.repeat(64)),
      type: UNLOCK_TOKEN_TYPE,
    });
    expect(prismaMock.user.updateMany).not.toHaveBeenCalled();
  });

  it('does not unlock when another request spent the link first', async () => {
    prismaMock.verificationToken.findFirst.mockResolvedValue({ id: 'link-1', userId: 'her' });
    prismaMock.verificationToken.deleteMany.mockResolvedValue({ count: 0 });

    await expect(unlockAccount('c'.repeat(64))).resolves.toBeNull();

    expect(prismaMock.user.updateMany).not.toHaveBeenCalled();
    expect(revokeAll).not.toHaveBeenCalled();
  });

  it('spends the link and clears the lock in one transaction, then ends any session that slipped in', async () => {
    prismaMock.verificationToken.findFirst.mockResolvedValue({ id: 'link-1', userId: 'her' });
    prismaMock.verificationToken.deleteMany.mockResolvedValue({ count: 1 });

    await expect(unlockAccount('c'.repeat(64))).resolves.toEqual({ userId: 'her' });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.user.updateMany).toHaveBeenCalledWith({ where: { id: 'her' }, data: { lockedAt: null } });
    expect(revokeAll).toHaveBeenCalledWith('her', { reason: 'locked' });
  });
});
