/**
 * Push delivery, in process.
 *
 * The mobile app registers Expo push tokens; they are delivered through Expo's
 * push API over plain HTTPS, so nothing has to be installed or provisioned
 * for a notification to reach a phone. Firebase Cloud Messaging tokens are
 * delivered through firebase-admin when that is configured, as before. A
 * token the provider says is dead is switched off so it is never tried again.
 *
 * Callers pass the kind of notification; the member's push preferences decide
 * whether it goes, the same way the email channel decides.
 */

import type { NotificationType } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

export const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';
/** Expo accepts at most this many messages per request. */
export const EXPO_BATCH_SIZE = 100;
const EXPO_TIMEOUT_MS = 10_000;

export interface PushMessage {
  title: string;
  body: string;
  /** Where the app should go when the notification is opened. */
  link?: string;
  data?: Record<string, unknown>;
  badge?: number;
  sound?: 'default' | null;
  priority?: 'default' | 'high';
}

export interface PushDelivery {
  attempted: number;
  sent: number;
  failed: number;
  /** Tokens the provider reported as no longer valid; already deactivated. */
  deactivated: number;
  skipped?: 'no-tokens' | 'preferences' | 'no-provider';
}

type StoredToken = { id: string; token: string; platform: string };

/** Expo tokens are self-describing: ExponentPushToken[...] or ExpoPushToken[...]. */
export function isExpoPushToken(token: string): boolean {
  return /^Expo(nent)?PushToken\[[^\]\s]+\]$/.test(token);
}

/** The preference key a notification kind is filed under on the settings page. */
const PUSH_PREFERENCE_KEY: Partial<Record<NotificationType, 'jobMatches' | 'applications' | 'messages' | 'mentions'>> = {
  JOB_MATCH: 'jobMatches',
  APPLICATION_UPDATE: 'applications',
  MESSAGE: 'mentions',
  MENTION: 'mentions',
  COMMENT: 'mentions',
  FOLLOW: 'mentions',
  FOLLOW_REQUEST: 'mentions',
  REPOST: 'mentions',
  LIKE: 'mentions',
};
// Messages have their own switch.
PUSH_PREFERENCE_KEY.MESSAGE = 'messages';

/** Whether a member's saved preferences allow this kind of push. Missing means yes. */
export function wantsPush(preferences: unknown, type: NotificationType): boolean {
  if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) return true;
  const push = (preferences as { push?: Record<string, unknown> }).push;
  if (!push || typeof push !== 'object') return true;
  const key = PUSH_PREFERENCE_KEY[type];
  if (!key) return true;
  return push[key] !== false;
}

async function activeTokensOf(userId: string): Promise<StoredToken[]> {
  const rows = await prisma.pushToken.findMany({
    where: { userId, isActive: true },
    select: { id: true, token: true, platform: true },
  });
  return Array.isArray(rows) ? rows : [];
}

async function deactivate(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  try {
    await prisma.pushToken.updateMany({ where: { id: { in: ids } }, data: { isActive: false } });
  } catch (error) {
    logger.warn('Could not deactivate dead push tokens', { count: ids.length, error: error instanceof Error ? error.message : String(error) });
  }
}

type ExpoTicket =
  | { status: 'ok'; id?: string }
  | { status: 'error'; message?: string; details?: { error?: string } };

/** Errors Expo returns for a token that will never work again. */
const DEAD_TOKEN_ERRORS = new Set(['DeviceNotRegistered', 'InvalidCredentials']);

/**
 * Sends one message to a set of Expo tokens, in batches of EXPO_BATCH_SIZE.
 * Returns which tokens Expo accepted and which it declared dead.
 */
export async function sendExpoPush(
  tokens: StoredToken[],
  message: PushMessage
): Promise<{ sent: string[]; failed: string[]; dead: string[] }> {
  const sent: string[] = [];
  const failed: string[] = [];
  const dead: string[] = [];

  const headers: Record<string, string> = {
    accept: 'application/json',
    'content-type': 'application/json',
  };
  if (process.env.EXPO_ACCESS_TOKEN) {
    headers.authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
  }

  for (let start = 0; start < tokens.length; start += EXPO_BATCH_SIZE) {
    const batch = tokens.slice(start, start + EXPO_BATCH_SIZE);
    const payload = batch.map((row) => ({
      to: row.token,
      title: message.title,
      body: message.body,
      data: { ...(message.data ?? {}), ...(message.link ? { link: message.link } : {}) },
      sound: message.sound === null ? undefined : 'default',
      ...(typeof message.badge === 'number' ? { badge: message.badge } : {}),
      priority: message.priority ?? 'high',
      channelId: 'default',
    }));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), EXPO_TIMEOUT_MS);
    try {
      const response = await fetch(EXPO_PUSH_ENDPOINT, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        logger.warn('Expo push request refused', { status: response.status, body: text.slice(0, 200) });
        failed.push(...batch.map((row) => row.id));
        continue;
      }
      const parsed = (await response.json()) as { data?: ExpoTicket[] | ExpoTicket };
      const tickets = Array.isArray(parsed.data) ? parsed.data : parsed.data ? [parsed.data] : [];
      batch.forEach((row, index) => {
        const ticket = tickets[index];
        if (ticket && ticket.status === 'ok') {
          sent.push(row.id);
          return;
        }
        const code = ticket && ticket.status === 'error' ? ticket.details?.error : undefined;
        if (code && DEAD_TOKEN_ERRORS.has(code)) dead.push(row.id);
        else failed.push(row.id);
      });
    } catch (error) {
      logger.warn('Expo push request failed', { error: error instanceof Error ? error.message : String(error) });
      failed.push(...batch.map((row) => row.id));
    } finally {
      clearTimeout(timer);
    }
  }

  return { sent, failed, dead };
}

/**
 * Firebase Cloud Messaging for tokens that are not Expo's. Only when the
 * Firebase credentials are configured and the package is installed; otherwise
 * those tokens are skipped and counted as failed.
 */
async function sendFcmPush(
  tokens: StoredToken[],
  message: PushMessage
): Promise<{ sent: string[]; failed: string[]; dead: string[] }> {
  if (!process.env.FIREBASE_PROJECT_ID || tokens.length === 0) {
    return { sent: [], failed: tokens.map((t) => t.id), dead: [] };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let admin: any;
  try {
    // @ts-expect-error - firebase-admin is an optional dependency
    admin = await import('firebase-admin');
  } catch {
    logger.warn('firebase-admin is not installed; FCM tokens skipped', { count: tokens.length });
    return { sent: [], failed: tokens.map((t) => t.id), dead: [] };
  }
  try {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
    }
    const response = await admin.messaging().sendEachForMulticast({
      tokens: tokens.map((t) => t.token),
      notification: { title: message.title, body: message.body },
      data: Object.fromEntries(
        Object.entries({ ...(message.data ?? {}), link: message.link ?? '' }).map(([k, v]) => [k, String(v)])
      ),
      android: { priority: message.priority === 'default' ? 'normal' : 'high', notification: { sound: 'default' } },
      apns: { payload: { aps: { sound: 'default', ...(typeof message.badge === 'number' ? { badge: message.badge } : {}) } } },
    });
    const sent: string[] = [];
    const failed: string[] = [];
    const dead: string[] = [];
    response.responses.forEach((resp: { success: boolean; error?: { code: string } }, index: number) => {
      if (resp.success) {
        sent.push(tokens[index].id);
        return;
      }
      const code = resp.error?.code ?? '';
      if (code === 'messaging/invalid-registration-token' || code === 'messaging/registration-token-not-registered') {
        dead.push(tokens[index].id);
      } else {
        failed.push(tokens[index].id);
      }
    });
    return { sent, failed, dead };
  } catch (error) {
    logger.error('FCM push failed', { error: error instanceof Error ? error.message : String(error) });
    return { sent: [], failed: tokens.map((t) => t.id), dead: [] };
  }
}

/**
 * Pushes one message to every active device a member has, honouring their
 * push preferences for this kind of notification. Never throws: a push is a
 * courtesy on top of the in-app notification that already exists.
 */
export async function pushToUser(userId: string, type: NotificationType, message: PushMessage): Promise<PushDelivery> {
  const none: PushDelivery = { attempted: 0, sent: 0, failed: 0, deactivated: 0 };
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { notificationPreferences: true } });
    if (!wantsPush(user?.notificationPreferences, type)) {
      return { ...none, skipped: 'preferences' };
    }

    const tokens = await activeTokensOf(userId);
    if (tokens.length === 0) {
      return { ...none, skipped: 'no-tokens' };
    }

    const expo = tokens.filter((t) => isExpoPushToken(t.token));
    const others = tokens.filter((t) => !isExpoPushToken(t.token));

    const [viaExpo, viaFcm] = await Promise.all([
      expo.length ? sendExpoPush(expo, message) : Promise.resolve({ sent: [], failed: [], dead: [] }),
      others.length ? sendFcmPush(others, message) : Promise.resolve({ sent: [], failed: [], dead: [] }),
    ]);

    const dead = [...viaExpo.dead, ...viaFcm.dead];
    await deactivate(dead);

    const delivery: PushDelivery = {
      attempted: tokens.length,
      sent: viaExpo.sent.length + viaFcm.sent.length,
      failed: viaExpo.failed.length + viaFcm.failed.length,
      deactivated: dead.length,
    };
    logger.debug('Push delivered', { userId, type, ...delivery });
    return delivery;
  } catch (error) {
    logger.warn('Push not delivered', { userId, type, error: error instanceof Error ? error.message : String(error) });
    return none;
  }
}

/** The first line of a message as it should read on a lock screen. */
export function pushPreview(text: string | null | undefined, fallback = 'Sent you a message', max = 120): string {
  const plain = (text ?? '')
    .replace(/@\[([^\]\n]{1,80})\]\([0-9a-fA-F-]{36}\)/g, '@$1')
    .replace(/\s+/g, ' ')
    .trim();
  if (!plain) return fallback;
  return plain.length > max ? `${plain.slice(0, max - 1)}…` : plain;
}
