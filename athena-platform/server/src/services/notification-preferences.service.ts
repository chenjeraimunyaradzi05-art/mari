/**
 * Whether a member wants a given kind of social notification. Read from
 * User.notificationPreferences, the object the settings page saves; a
 * missing value means yes. "In-app: all" off silences every social kind.
 */

import { prisma } from '../utils/prisma';
import { bestEffort } from '../utils/best-effort';

export type SocialNotificationType = 'LIKE' | 'COMMENT' | 'FOLLOW' | 'FOLLOW_REQUEST' | 'MENTION' | 'REPOST';

const KEY_FOR: Record<SocialNotificationType, 'likes' | 'comments' | 'follows' | 'mentions' | 'reposts'> = {
  LIKE: 'likes',
  COMMENT: 'comments',
  FOLLOW: 'follows',
  FOLLOW_REQUEST: 'follows',
  MENTION: 'mentions',
  REPOST: 'reposts',
};

export function wantsSocialNotification(preferences: unknown, type: SocialNotificationType): boolean {
  const inApp =
    preferences && typeof preferences === 'object' && !Array.isArray(preferences)
      ? (preferences as { inApp?: Record<string, unknown> }).inApp
      : undefined;
  if (!inApp || typeof inApp !== 'object') return true;
  if (inApp.all === false) return false;
  const value = inApp[KEY_FOR[type]];
  return value !== false;
}

/**
 * This read fails OPEN: when the preferences cannot be read the answer is yes,
 * send it. A notification that was never written is invisible — it looks
 * exactly like nobody having liked or commented — whereas one sent to a member
 * who had switched that kind off is a single line she can switch off again, so
 * the harm runs the wrong way if a database blip silences a feed.
 *
 * The `catch { return true }` that used to be here gave that same answer and
 * threw the reason away with it, which is the bug: an unreachable database
 * looked identical to a member with no preferences set, and the quiet feed left
 * nothing behind to explain itself. The fallback is spelled out as the third
 * argument so that the direction this fails in is visible at the call.
 */
export async function memberWantsSocialNotification(userId: string, type: SocialNotificationType): Promise<boolean> {
  return bestEffort(
    `notification-preferences.social-read.${type}`,
    async () => {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { notificationPreferences: true },
      });
      return wantsSocialNotification(user?.notificationPreferences, type);
    },
    true
  );
}
