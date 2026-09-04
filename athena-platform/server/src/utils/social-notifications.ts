/**
 * In-app notifications for the social graph: likes, comments and follows.
 *
 * Three rules every caller gets for free:
 *
 * 1. Nobody is notified about their own action. Liking your own post or
 *    replying to yourself produced a "Someone liked your post" row before.
 * 2. The actor is named by their display name, never by their email. The
 *    follow notification used to say "jane@example.com started following you",
 *    which handed every member's email address to anyone they followed.
 * 3. A failed write never fails the request that caused it. The like or the
 *    comment has already been stored; the notification is a courtesy.
 *
 * Links point at routes the web client actually serves: /posts/:id for a post,
 * /explore?video=:id for a reel, /profile/:id for a member.
 */

import { NotificationType } from '@prisma/client';
import { prisma } from './prisma';
import { logger } from './logger';
import { memberWantsSocialNotification } from '../services/notification-preferences.service';

export async function actorDisplayName(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { displayName: true, firstName: true, lastName: true },
  });
  const full = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  return user?.displayName?.trim() || full || 'Someone';
}

export interface SocialNotificationInput {
  recipientId: string;
  actorId: string;
  type: Extract<NotificationType, 'LIKE' | 'COMMENT' | 'FOLLOW' | 'MENTION' | 'REPOST' | 'FOLLOW_REQUEST'>;
  title: string;
  /** Built from the actor's name so the row reads "Priya liked your post". */
  message: (actorName: string) => string;
  link: string;
}

export async function notifySocial(input: SocialNotificationInput): Promise<void> {
  if (input.recipientId === input.actorId) return;

  try {
    const name = await actorDisplayName(input.actorId);

    // The recipient may have switched this kind off.
    if (!(await memberWantsSocialNotification(input.recipientId, input.type))) return;
    await prisma.notification.create({
      data: {
        userId: input.recipientId,
        type: input.type,
        title: input.title,
        message: input.message(name),
        link: input.link,
        // Who did it, so several reactions to one post can be read as one row.
        data: { actorId: input.actorId, actorName: name },
      },
    });
  } catch (error) {
    logger.warn('Social notification not written', {
      type: input.type,
      recipientId: input.recipientId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export const socialLinks = {
  post: (postId: string) => `/posts/${postId}`,
  video: (videoId: string) => `/explore?video=${videoId}`,
  profile: (userId: string) => `/profile/${userId}`,
};
