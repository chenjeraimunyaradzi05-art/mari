/**
 * New-device sign-in alerts.
 *
 * When an account signs in from a browser and network it has never used, the
 * owner is told: an in-app notification pointing at the security settings,
 * where the session can be ended, and an email when mail is configured. The
 * first ever session says nothing (it is the owner setting up), and a device
 * that has been seen before, even in a session since revoked, is familiar.
 *
 * Runs after the sign-in has been answered, and never fails it.
 */

import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { sendEmail } from '../utils/email';

export interface SignInEvent {
  userId: string;
  /** The session this sign-in created; excluded when looking for earlier devices. */
  sessionId: string;
  userAgent?: string | string[];
  ipAddress?: string;
  method: 'password' | 'Google' | 'Facebook';
}

const SECURITY_SETTINGS_PATH = '/dashboard/settings/security';

/** "Chrome on Windows", from a user-agent string; "an unknown device" when it says nothing. */
export function describeDevice(userAgent: string | undefined): string {
  if (!userAgent) return 'an unknown device';
  const ua = userAgent;
  let browser = 'a browser';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\//.test(ua)) browser = 'Opera';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Safari\//.test(ua)) browser = 'Safari';
  else if (/Expo|okhttp|Dalvik/i.test(ua)) browser = 'the ATHENA app';

  let os: string | null = null;
  if (/Windows/.test(ua)) os = 'Windows';
  else if (/iPhone|iPad/.test(ua)) os = 'iOS';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/Mac OS X|Macintosh/.test(ua)) os = 'macOS';
  else if (/Linux/.test(ua)) os = 'Linux';

  return os ? `${browser} on ${os}` : browser;
}

function agentOf(userAgent: string | string[] | undefined): string | undefined {
  const value = Array.isArray(userAgent) ? userAgent[0] : userAgent;
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 512) : undefined;
}

/**
 * Whether this device is new to the account: no earlier session, live or
 * revoked, was opened from the same browser and address. Undefined when the
 * account has never signed in before, so the very first session is quiet.
 */
export async function isUnfamiliarDevice(event: SignInEvent): Promise<boolean | undefined> {
  const userAgent = agentOf(event.userAgent);
  const earlier = await prisma.session.count({
    where: { userId: event.userId, id: { not: event.sessionId } },
  });
  if (earlier === 0) return undefined;
  const familiar = await prisma.session.count({
    where: {
      userId: event.userId,
      id: { not: event.sessionId },
      userAgent: userAgent ?? null,
      ipAddress: event.ipAddress ?? null,
    },
  });
  return familiar === 0;
}

export async function noteSignIn(event: SignInEvent): Promise<void> {
  try {
    const unfamiliar = await isUnfamiliarDevice(event);
    if (!unfamiliar) return;

    const device = describeDevice(agentOf(event.userAgent));
    const where = event.ipAddress ? ` (IP ${event.ipAddress})` : '';
    const how = event.method === 'password' ? '' : ` with ${event.method}`;
    const when = new Date().toLocaleString('en-AU', {
      timeZone: 'Australia/Brisbane',
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    await prisma.notification.create({
      data: {
        userId: event.userId,
        type: 'SYSTEM',
        title: 'New sign-in to your account',
        message: `Your account was signed into${how} from ${device}${where} on ${when} (Brisbane time). If this was you, there is nothing to do. If not, end that session and change your password.`,
        link: SECURITY_SETTINGS_PATH,
        data: {
          kind: 'new-device-sign-in',
          sessionId: event.sessionId,
          device,
          ipAddress: event.ipAddress ?? null,
          method: event.method,
        },
      },
    });

    const user = await prisma.user.findUnique({
      where: { id: event.userId },
      select: { email: true, firstName: true },
    });
    if (user?.email) {
      const base = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
      const link = `${base}${SECURITY_SETTINGS_PATH}`;
      const greeting = user.firstName ? `Hi ${user.firstName},` : 'Hi,';
      await sendEmail({
        to: user.email,
        subject: 'New sign-in to your ATHENA account',
        text: `${greeting}\n\nYour ATHENA account was signed into${how} from ${device}${where} on ${when} (Brisbane time).\n\nIf this was you, there is nothing to do. If it was not, end that session and change your password here: ${link}\n\nATHENA`,
        html: `<p>${greeting}</p><p>Your ATHENA account was signed into${how} from <strong>${device}</strong>${where} on ${when} (Brisbane time).</p><p>If this was you, there is nothing to do. If it was not, <a href="${link}">end that session and change your password</a>.</p><p>ATHENA</p>`,
      });
    }
  } catch (error) {
    logger.warn('Sign-in alert not sent', {
      userId: event.userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
