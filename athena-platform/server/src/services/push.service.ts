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

import { createHash, randomBytes } from 'crypto';
import type { NotificationType } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { secretMatches } from '../utils/secret-compare';
import { safeNotificationFor } from './dv-safe.service';

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
    orderBy: { createdAt: 'desc' },
    select: { id: true, token: true, platform: true },
  });
  if (!Array.isArray(rows)) return [];

  // One device, one notification.
  //
  // PushToken.token is indexed but not unique, and the register handler is a
  // findFirst followed by a create with no constraint behind it. The app calls
  // syncPushToken() twice in quick succession on a cold start that ends in a
  // sign-in — once from App.tsx on mount, once from AuthContext on login — so
  // the two registrations race and both create a row. The phone then had two
  // active rows and Expo was handed the same token twice in the same batch, so
  // every notification arrived twice: two buzzes for one message.
  //
  // De-duplicating here fixes the delivery for the rows that already exist.
  // registerPushToken below now folds a device's rows into one whenever it
  // registers, and the app no longer registers twice at once, but only
  // @unique on PushToken.token (a schema change) closes the race for good.
  const seen = new Set<string>();
  const unique: StoredToken[] = [];
  for (const row of rows) {
    if (seen.has(row.token)) continue;
    seen.add(row.token);
    unique.push(row);
  }
  return unique;
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
 *
 * A member who has asked for vague notifications gets the wording swapped here
 * rather than at each caller. Every push on the platform goes out through this
 * function, so this is the one place that cannot be forgotten — and it had been
 * forgotten everywhere else: the switch was saved, read back onto the settings
 * page, and enforced nowhere at all.
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

    const safe = await safeNotificationFor(userId, message.title, message.body);
    // The link and the payload still travel: the app opens on the right screen
    // once she is in it. What the lock screen shows is the title and the body,
    // and those are all anyone reading over her shoulder gets.
    const outgoing: PushMessage = { ...message, title: safe.title, body: safe.message };

    const expo = tokens.filter((t) => isExpoPushToken(t.token));
    const others = tokens.filter((t) => !isExpoPushToken(t.token));

    const [viaExpo, viaFcm] = await Promise.all([
      expo.length ? sendExpoPush(expo, outgoing) : Promise.resolve({ sent: [], failed: [], dead: [] }),
      others.length ? sendFcmPush(others, outgoing) : Promise.resolve({ sent: [], failed: [], dead: [] }),
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

// ===========================================
// DEVICE REGISTRATION
// ===========================================
//
// A push token is a device, and the register handler used to act as if
// knowing the token were proof of holding the device: it looked the row up by
// token alone and moved it onto whoever was calling. Any signed-in member who
// had learned another member's Expo token could therefore move that phone onto
// her own account. The phone stopped hearing about its owner's messages,
// safety notices included, and showed the caller's notifications instead, with
// nothing on either side saying it had happened. For a member whose abuser has
// had her phone in his hands for a minute, that is a real attack, not a
// theoretical one.
//
// Holding the device is now proved with a device key. The first time a device
// registers, the server issues a random key and hands it back once; the app
// keeps it in the phone's secure store and presents it every time it
// registers again. Only its fingerprint is stored, in PushToken.deviceId, so
// the database never holds the key itself. The rules:
//
//  - A token nobody holds is registered to the caller.
//  - A token the caller already holds is refreshed. She may present a new key
//    or none (an app from before this change): it is the same account either
//    way, so the stored fingerprint simply follows her.
//  - A token another account holds moves only when the caller presents the key
//    whose fingerprint every one of those rows carries. That is the shared
//    phone: one member signs out, or her session lapses, and the next person
//    signs in on the same handset, whose secure store still has the key. A
//    token presented without that proof stays where it is, and the caller is
//    told the device belongs to another account.
//
// The cost is carried by rows written before device keys existed: one held by
// another account has no fingerprint, so nothing can prove it and it cannot
// move to a new account. Its owner's next registration from that phone, which
// happens at every launch while she is signed in, gives it one. A legacy row
// whose owner signed out before updating the app stays hers until she signs in
// there again; a phone that misses notifications for a new account is the
// lesser harm next to a phone anyone can take.
//
// Every registration also folds the device's rows into one. Duplicate rows are
// what let a phone keep the previous member's notifications after a handover:
// the register handler moved the first row it found and left the other
// active under her.

const DEVICE_KEY_BYTES = 32;
/** base64url of DEVICE_KEY_BYTES, the only shape this server ever issues. */
const DEVICE_KEY_PATTERN = /^[A-Za-z0-9_-]{43}$/;
/** Marks a stored fingerprint, so it can never be mistaken for an id a client chose. */
const DEVICE_FINGERPRINT_PREFIX = 'dk1:';

export type PushTokenRegistration =
  | {
      outcome: 'registered' | 'refreshed' | 'moved';
      id: string;
      platform: string;
      /** Present only when a new key was issued; the device must keep it. */
      deviceKey?: string;
    }
  | { outcome: 'held-by-another-account' };

type RegisteredRow = { id: string; userId: string; deviceId: string | null };

const REGISTERED_ROW = { id: true, userId: true, deviceId: true } as const;

/** A fresh device key: random, and only ever sent to the device it is issued to. */
export function issueDeviceKey(): string {
  return randomBytes(DEVICE_KEY_BYTES).toString('base64url');
}

/** What is stored in place of a device key. */
export function deviceFingerprint(deviceKey: string): string {
  return DEVICE_FINGERPRINT_PREFIX + createHash('sha256').update(deviceKey).digest('hex');
}

/** A presented key, when it is one this server could have issued. */
function presentedDeviceKey(value: unknown): string | null {
  return typeof value === 'string' && DEVICE_KEY_PATTERN.test(value) ? value : null;
}

/** Whether every row another account holds carries the fingerprint of the presented key. */
function provesDevice(heldByOthers: RegisteredRow[], presentedKey: string | null): boolean {
  if (!presentedKey || heldByOthers.length === 0) return false;
  const fingerprint = deviceFingerprint(presentedKey);
  return heldByOthers.every((row) => secretMatches(fingerprint, row.deviceId));
}

function isUniqueViolation(error: unknown): boolean {
  return !!error && typeof error === 'object' && (error as { code?: unknown }).code === 'P2002';
}

/** Every row for a token, oldest first: the oldest is the one that is kept. */
async function rowsForToken(token: string): Promise<RegisteredRow[]> {
  const rows = await prisma.pushToken.findMany({
    where: { token },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: REGISTERED_ROW,
  });
  return Array.isArray(rows) ? rows : [];
}

/**
 * Registers a device's push token for a member, provided the device is hers
 * to register. See the section comment above for the rules; this never moves
 * a device another account holds unless the request proves it holds it.
 */
export async function registerPushToken(input: {
  userId: string;
  token: string;
  platform: string;
  deviceKey?: unknown;
}): Promise<PushTokenRegistration> {
  const presentedKey = presentedDeviceKey(input.deviceKey);
  const rows = await rowsForToken(input.token);
  if (rows.length > 0) return claimRows(rows, input.userId, input.platform, presentedKey, false);

  const deviceKey = presentedKey ?? issueDeviceKey();
  let createdId: string;
  try {
    const created = await prisma.pushToken.create({
      data: {
        userId: input.userId,
        token: input.token,
        platform: input.platform,
        deviceId: deviceFingerprint(deviceKey),
        isActive: true,
      },
      select: { id: true },
    });
    createdId = created.id;
  } catch (error) {
    // Only reachable once the token column is unique: another registration of
    // this token was written first, so this one is judged against it.
    if (!isUniqueViolation(error)) throw error;
    const winner = await rowsForToken(input.token);
    // Written and gone again between two statements: nothing sensible to
    // judge against, so the conflict is reported as it happened.
    if (winner.length === 0) throw error;
    return claimRows(winner, input.userId, input.platform, presentedKey, false);
  }

  // Without a unique constraint two registrations of one token can both find
  // nothing and both create. Whichever row is oldest stands, the same answer
  // from both sides; a registration whose row was not the oldest is judged
  // against the one that was, exactly as if it had arrived second, carrying
  // the key it has just been issued.
  const after = await rowsForToken(input.token);
  const survivor = after[0];
  if (!survivor || survivor.id === createdId) {
    await removeRows(after.slice(1).map((row) => row.id));
    return {
      outcome: 'registered',
      id: createdId,
      platform: input.platform,
      ...(presentedKey ? {} : { deviceKey }),
    };
  }
  const judged = await claimRows(after, input.userId, input.platform, deviceKey, !presentedKey);
  // Refused, the row this request wrote must not outlive the refusal: it
  // would leave the device delivering to two accounts at once.
  if (judged.outcome === 'held-by-another-account') await removeRows([createdId]);
  return judged;
}

/**
 * Takes over the rows a token already has, when the caller may. `keyIsNew`
 * says the key was issued by this request rather than presented by the
 * device, so it still has to be handed back.
 */
async function claimRows(
  rows: RegisteredRow[],
  userId: string,
  platform: string,
  presentedKey: string | null,
  keyIsNew: boolean
): Promise<PushTokenRegistration> {
  const heldByOthers = rows.filter((row) => row.userId !== userId);
  if (heldByOthers.length > 0 && !provesDevice(heldByOthers, keyIsNew ? null : presentedKey)) {
    // Worth a line: either a phone changed hands before its previous owner's
    // app ever recorded a device key, or someone is trying to take a device
    // they do not hold. The ids say which accounts; nothing here says whose
    // phone it is.
    logger.warn('Push token registration refused: the device is registered to another account and was not proved', {
      userId,
      heldBy: Array.from(new Set(heldByOthers.map((row) => row.userId))),
    });
    return { outcome: 'held-by-another-account' };
  }

  const [keep, ...duplicates] = rows;
  const deviceKey = presentedKey ?? issueDeviceKey();
  await prisma.pushToken.update({
    where: { id: keep.id },
    data: { userId, platform, deviceId: deviceFingerprint(deviceKey), isActive: true },
  });
  await removeRows(duplicates.map((row) => row.id));

  return {
    outcome: heldByOthers.length > 0 ? 'moved' : 'refreshed',
    id: keep.id,
    platform,
    ...(presentedKey && !keyIsNew ? {} : { deviceKey }),
  };
}

/** The extra rows one device has collected; the kept row speaks for it. */
async function removeRows(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await prisma.pushToken.deleteMany({ where: { id: { in: ids } } });
}
