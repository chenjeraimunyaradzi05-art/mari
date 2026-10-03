/**
 * Taking two-factor off an account whose owner has lost both ways through it.
 *
 * A member who loses her phone and her saved recovery codes together could not
 * sign in, and nothing on the platform could help her: the second factor was
 * only ever cleared by herself, from inside a session she no longer had, or by
 * erasing the account. A staff account in that position was worse off, because
 * staff cannot use any staff power without a factor.
 *
 * This is the one way in, and it is deliberately narrow:
 *
 *   - it is a staff action on the admin console (an administrator, never a
 *     moderator), and an administrator cannot do it to herself, so removing a
 *     staff member's factor always takes two people;
 *   - it removes the factor and the recovery codes and nothing else. It does not
 *     touch the password, so whoever asks still has to know it, and it does not
 *     sign anybody in;
 *   - every session on the account is ended, because a reset follows "I have
 *     lost the device", and a session on a lost device must not outlive it;
 *   - the member is told, in the app and by email to the address on the account,
 *     whoever asked, so a reset she did not ask for is the first thing she hears
 *     about; when the account is staff, the other administrators are told too;
 *   - the route that calls this writes the audit row with the reason given.
 *
 * Who may be reset, and what proof of identity staff must see first, is a
 * decision for the owner and is written down in docs/runbooks/TWO-FACTOR-RESET.md.
 */

import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { bestEffort } from '../utils/best-effort';
import { sendEmail } from '../utils/email';
import { sessionService } from './session.service';
import { notifyAdmins } from './admin-notify.service';

const STAFF_ROLES: ReadonlySet<string> = new Set(['MODERATOR', 'ADMIN']);

export type TwoFactorReset = {
  userId: string;
  /** The account is staff, so the other administrators were told as well. */
  targetWasStaff: boolean;
  /** How many recovery codes went with the factor. */
  recoveryCodesCleared: number;
  /** Whether the email to the member was accepted by the mail provider. */
  emailSent: boolean;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const SECURITY_PATH = '/dashboard/settings/security';

function resetEmail(firstName: string, securityUrl: string) {
  const name = escapeHtml(firstName || 'there');
  return {
    subject: 'Two-factor sign-in was removed from your ATHENA account',
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1f2937; line-height: 1.6;">
<p>Hi ${name},</p>
<p>A member of the ATHENA team removed two-factor sign-in from your account, and signed you out on every device. That is what happens when someone has lost their authenticator app and their recovery codes and asked us for help.</p>
<p>Your password has not changed, and neither has any Google or Facebook sign-in you use. You can sign in the way you usually do, and then turn two-factor back on from <a href="${escapeHtml(securityUrl)}">your security settings</a>.</p>
<p><strong>If you did not ask for this, treat your account as at risk.</strong> Choose a new password straight away, and contact us so we can look into who did.</p>
</body></html>`,
    text: `Hi ${firstName || 'there'}, a member of the ATHENA team removed two-factor sign-in from your account and signed you out on every device. That is what happens when someone has lost their authenticator app and recovery codes and asked us for help. Your password has not changed, and neither has any Google or Facebook sign-in you use. You can sign in the way you usually do, then turn two-factor back on at ${securityUrl}. If you did not ask for this, treat your account as at risk: choose a new password straight away and contact us.`,
  };
}

/**
 * Removes the second factor from `targetUserId`, on `actorId`'s authority.
 *
 * Refusals, each with nothing changed: the account is the actor's own (409), it
 * does not exist (404), or it has no second factor to remove (409).
 */
export async function resetTwoFactor(params: { targetUserId: string; actorId: string }): Promise<TwoFactorReset> {
  const { targetUserId, actorId } = params;

  if (targetUserId === actorId) {
    throw new ApiError(
      409,
      'You cannot reset your own two-factor sign-in. Another administrator has to do it, so that taking a factor off an account always takes two people.'
    );
  }

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      email: true,
      firstName: true,
      role: true,
      twoFactorEnabled: true,
      twoFactorSecret: true,
      twoFactorRecoveryCodes: true,
    },
  });
  if (!target) {
    throw new ApiError(404, 'There is no account with that id.');
  }
  if (!target.twoFactorEnabled && !target.twoFactorSecret) {
    throw new ApiError(409, 'That account has no two-factor sign-in to reset.');
  }

  await prisma.user.update({
    where: { id: target.id },
    data: {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorEnabledAt: null,
      twoFactorRecoveryCodes: { set: [] },
    },
  });

  // After the write, and best effort: the factor is already gone, and failing
  // the request now would tell the administrator it was not.
  await bestEffort('end the sessions of an account whose two-factor was reset', () =>
    sessionService.revokeAllUserSessions(target.id, { reason: 'revoked' })
  );

  const targetWasStaff = STAFF_ROLES.has(String(target.role));

  await bestEffort('tell a member her two-factor was reset (in the app)', () =>
    prisma.notification.create({
      data: {
        userId: target.id,
        type: 'SYSTEM',
        title: 'Two-factor sign-in was removed from your account',
        message:
          'A member of the ATHENA team removed two-factor sign-in at your request and signed you out everywhere. If you did not ask for this, choose a new password now and contact us.',
        link: SECURITY_PATH,
      },
    })
  );

  const clientUrl = (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '');
  const emailSent = await bestEffort(
    'tell a member her two-factor was reset (by email)',
    () => sendEmail({ to: target.email, ...resetEmail(target.firstName, `${clientUrl}${SECURITY_PATH}`) }),
    false
  );

  if (targetWasStaff) {
    await notifyAdmins({
      title: 'Two-factor was reset on a staff account',
      message: 'An administrator removed the second factor from a moderator or administrator account. If you were not told to expect this, find out why before anything else.',
      link: '/admin/audit-logs',
      data: { targetUserId: target.id, actorId },
    });
  }

  logger.warn('Two-factor reset by staff', { targetUserId: target.id, actorId, targetWasStaff });

  return {
    userId: target.id,
    targetWasStaff,
    recoveryCodesCleared: target.twoFactorRecoveryCodes.length,
    emailSent: emailSent === true,
  };
}
