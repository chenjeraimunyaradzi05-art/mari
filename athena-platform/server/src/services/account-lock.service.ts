/**
 * A member locking her own account.
 *
 * "Sign out everywhere" ends the sessions that exist, and nothing more: whoever
 * holds her password signs straight back in. When she thinks someone has her
 * account she needs to stop the account, not just the devices, and she needs
 * to be able to do it from the phone in her hand or, if she has already been
 * shut out, from the email that told her about the stranger's sign-in.
 *
 * Locking sets User.lockedAt, ends every session (live sockets included) and
 * mails the address on the account a one-time link that is the only way back.
 * While lockedAt is set every sign-in route refuses (login, Google, Facebook,
 * refresh) and so does the authentication middleware, so a session that slipped
 * in while the lock was being made is refused too. It is her own state, not a
 * moderation one: it has its own column and its own wording, no appeal sits
 * behind it, and staff do not lift it.
 *
 * Two kinds of one-time link live in VerificationToken, which keeps a free
 * string for its type:
 *   ACCOUNT_LOCK_LINK  in a new-device sign-in email, "this was not me": locks
 *                      the account without a session. Seven days, because the
 *                      alert may be read days after it was sent.
 *   ACCOUNT_UNLOCK     in the email sent when the account is locked: unlocks
 *                      it. One day, and a new one can be asked for from the
 *                      sign-in page, so a stale one is not a way in.
 * Both are stored hashed, as every emailed token here is, and both are spent
 * by deleting the row, so a link works once even when two requests carry it.
 */

import crypto from 'crypto';
import { AuditAction } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { logAudit } from '../utils/audit';
import { bestEffort } from '../utils/best-effort';
import { hashOpaqueToken } from '../utils/opaqueToken';
import { logger } from '../utils/logger';
import { sendAccountLockedEmail, type DeliveryPolicy } from '../utils/email';
import { sessionService } from './session.service';

export const UNLOCK_TOKEN_TYPE = 'ACCOUNT_UNLOCK';
export const LOCK_LINK_TOKEN_TYPE = 'ACCOUNT_LOCK_LINK';

export const UNLOCK_LINK_LIFETIME_MS = 24 * 60 * 60 * 1000;
export const LOCK_LINK_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

/** Where a lock came from, for the audit row. */
export type LockSource = 'settings' | 'email-link';

export interface LockContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface LockOutcome {
  /** The account was already locked, so nothing changed except that its sessions were ended again. */
  alreadyLocked: boolean;
  /** Whether the unlock email was accepted by the mail provider; false when it was not sent at all. */
  unlockEmailSent: boolean;
}

/**
 * How hard the unlock email is tried when somebody is waiting for the answer to
 * a lock. The default policy rides out a provider that is slow for up to half a
 * minute, which is right for mail that nothing waits on and wrong here: the web
 * app reaches this API through a host that gives up on a request after about ten
 * seconds, and the phone app after ten, and a lock that has already happened
 * must not be reported as one that did not. Two quick tries, seven seconds at
 * the very worst; what is not delivered is said so, and a new link is one
 * request away from the sign-in page.
 */
const LOCK_MAIL_DELIVERY: DeliveryPolicy = { maxAttempts: 2, attemptTimeoutMs: 3_500, backoffMs: [0, 500] };

const newToken = (): string => crypto.randomBytes(32).toString('hex');

type MailableAccount = { id: string; email: string; firstName: string };

/**
 * Makes a fresh unlock link, mails it and only then retires the older ones. A
 * mail the provider refused withdraws only the link it was about, so a link she
 * already holds still works. Returns whether the mail was accepted, and never
 * throws: a mail outage must not undo a lock. `policy` is how hard the mail is
 * tried; left out it is the default, for a caller that is not being waited on.
 */
export async function mailUnlockLink(account: MailableAccount, policy?: DeliveryPolicy): Promise<boolean> {
  try {
    const token = newToken();
    const link = await prisma.verificationToken.create({
      data: {
        userId: account.id,
        token: hashOpaqueToken(token),
        type: UNLOCK_TOKEN_TYPE,
        expiresAt: new Date(Date.now() + UNLOCK_LINK_LIFETIME_MS),
      },
      select: { id: true, createdAt: true },
    });

    const sent = await sendAccountLockedEmail(account.email, account.firstName, token, policy);
    if (sent) {
      await prisma.verificationToken.deleteMany({
        where: { userId: account.id, type: UNLOCK_TOKEN_TYPE, createdAt: { lt: link.createdAt } },
      });
    } else {
      logger.error('The unlock email was not accepted by the email provider and its link has been withdrawn', {
        userId: account.id,
      });
      // By id only: a filter with nothing in it would match every link.
      if (link?.id) {
        await prisma.verificationToken.deleteMany({ where: { id: link.id } });
      }
    }
    return sent === true;
  } catch (error) {
    logger.error('The unlock email could not be sent', {
      userId: account.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * A "this was not me" link for a new-device sign-in email. Returns the raw
 * token, which exists only in that email; the row holds its hash.
 */
export async function issueLockLink(userId: string): Promise<string> {
  const token = newToken();
  await prisma.verificationToken.create({
    data: {
      userId,
      token: hashOpaqueToken(token),
      type: LOCK_LINK_TOKEN_TYPE,
      expiresAt: new Date(Date.now() + LOCK_LINK_LIFETIME_MS),
    },
  });
  return token;
}

/**
 * Locks the account, ends every session, and mails the unlock link.
 *
 * Returns null when there is no such account. Calling it on an account that is
 * already locked is harmless: the original time is kept, the sessions are ended
 * again, and no second email is sent (a new link is one request away from the
 * sign-in page).
 */
export async function lockAccount(
  userId: string,
  source: LockSource,
  context: LockContext = {}
): Promise<LockOutcome | null> {
  const account = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, firstName: true, lockedAt: true },
  });
  if (!account) return null;

  // Conditional on not being locked, so two requests at once agree on who
  // locked it and only one of them mails the link.
  const locked = await prisma.user.updateMany({
    where: { id: account.id, lockedAt: null },
    data: { lockedAt: new Date() },
  });
  const alreadyLocked = locked.count === 0;

  // Whether or not it was already locked: this is what makes "lock" mean that
  // nobody is signed in, and a lock that failed half way is finished by
  // pressing it again.
  await sessionService.revokeAllUserSessions(account.id, { reason: 'locked' });

  // Every "this was not me" link for the account is spent by a lock, however it
  // came about; a fresh sign-in after she unlocks mints new ones.
  await prisma.verificationToken.deleteMany({ where: { userId: account.id, type: LOCK_LINK_TOKEN_TYPE } });

  let unlockEmailSent = false;
  if (!alreadyLocked) {
    unlockEmailSent = await mailUnlockLink(account, LOCK_MAIL_DELIVERY);
    await bestEffort(
      'account lock audit row',
      logAudit({
        action: AuditAction.ACCOUNT_LOCKED,
        actorUserId: account.id,
        targetUserId: account.id,
        ipAddress: context.ipAddress ?? null,
        userAgent: context.userAgent ?? null,
        metadata: { source, unlockEmailSent },
      })
    );
    logger.info('A member locked her own account', { userId: account.id, source, unlockEmailSent });
  }

  return { alreadyLocked, unlockEmailSent };
}

/**
 * Locks the account named by a "this was not me" link, with no session. The
 * link is spent whether or not the account was already locked. Returns null
 * for a link that is wrong, expired or already used.
 *
 * The lock is made first and the link spent after it, not the other way round:
 * a lock that fails part-way (the database, a mail provider) leaves the link
 * good for another try, where a link spent first is gone and the member, who
 * may have no session, is told it is invalid for an account that is still
 * open. Opening one link twice at the same moment is harmless, because
 * lockAccount agrees with itself (one request does the locking and mails the
 * unlock link, the other finds it locked and says so), and lockAccount spends
 * every "this was not me" link the account holds, this one included.
 */
export async function lockAccountByLink(token: string, context: LockContext = {}): Promise<LockOutcome | null> {
  const record = await prisma.verificationToken.findFirst({
    where: { token: hashOpaqueToken(token), type: LOCK_LINK_TOKEN_TYPE, expiresAt: { gt: new Date() } },
    select: { id: true, userId: true },
  });
  if (!record) return null;

  const outcome = await lockAccount(record.userId, 'email-link', context);

  // Already gone after a lock; this is for an account that no longer exists,
  // whose lock links the lock never got to.
  await prisma.verificationToken.deleteMany({ where: { id: record.id } });
  return outcome;
}

/**
 * Unlocks the account the link belongs to. It does not sign her in: she signs
 * in again with her password (and her second factor, if she has one). Every
 * session is ended once more here, because the lock refuses a session that
 * slipped in while it was being made and unlocking would otherwise bring that
 * session back to life.
 *
 * Returns null for a link that is wrong, expired or already used.
 */
export async function unlockAccount(token: string, context: LockContext = {}): Promise<{ userId: string } | null> {
  const record = await prisma.verificationToken.findFirst({
    where: { token: hashOpaqueToken(token), type: UNLOCK_TOKEN_TYPE, expiresAt: { gt: new Date() } },
    select: { id: true, userId: true },
  });
  if (!record) return null;

  const unlocked = await prisma.$transaction(async (tx) => {
    const spent = await tx.verificationToken.deleteMany({ where: { id: record.id } });
    if (spent.count !== 1) return false;

    await tx.user.updateMany({ where: { id: record.userId }, data: { lockedAt: null } });
    // Any other unlock link she was sent is spent along with this one.
    await tx.verificationToken.deleteMany({ where: { userId: record.userId, type: UNLOCK_TOKEN_TYPE } });
    return true;
  });
  if (!unlocked) return null;

  await sessionService.revokeAllUserSessions(record.userId, { reason: 'locked' });
  await bestEffort(
    'account unlock audit row',
    logAudit({
      action: AuditAction.ACCOUNT_UNLOCKED,
      actorUserId: record.userId,
      targetUserId: record.userId,
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
      metadata: { source: 'email-link' },
    })
  );
  logger.info('A member unlocked her own account', { userId: record.userId });

  return { userId: record.userId };
}
