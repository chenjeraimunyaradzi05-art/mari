/**
 * Whether a member wants a given kind of social notification. Read from
 * User.notificationPreferences, the object the settings page saves; a
 * missing value means yes. "In-app: all" off silences every social kind.
 */

import { prisma } from '../utils/prisma';

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

export async function memberWantsSocialNotification(userId: string, type: SocialNotificationType): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { notificationPreferences: true },
    });
    return wantsSocialNotification(user?.notificationPreferences, type);
  } catch {
    return true;
  }
}
