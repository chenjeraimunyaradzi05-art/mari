/**
 * In-app notifications for the social graph: likes, comments and follows.
 *
 * Rules every caller gets for free:
 *
 * 1. Nobody is notified about their own action. Liking your own post or
 *    replying to yourself produced a "Someone liked your post" row before.
 * 2. The actor is named by their display name, never by their email. The
 *    follow notification used to say "jane@example.com started following you",
 *    which handed every member's email address to anyone they followed.
 * 3. A failed write never fails the request that caused it. The like or the
 *    comment has already been stored; the notification is a courtesy.
 * 4. Nobody on either side of a block rings the other's bell. The mention, the
 *    reply, the repost and the follow each came from a different route, and
 *    most of them checked nothing, so a man she had blocked could still send
 *    her a notification, and a push, by naming her under somebody else's
 *    post. Here is the one place every one of them passes, so the rule is
 *    here and no caller can forget it. The check fails closed: if it cannot
 *    be read, the notification is not sent.
 * 5. One account cannot ring the same member's bell again and again, and a
 *    crowd of strangers turning on one member does not ring it at all (see
 *    services/pile-on.service). Both only hold back the notification. The
 *    comment or the mention itself is still where she can see it and deal
 *    with it.
 *
 * Links point at routes the web client actually serves: /posts/:id for a post,
 * /explore?video=:id for a reel, /profile/:id for a member.
 */

import { NotificationType } from '@prisma/client';
import { prisma } from './prisma';
import { logger } from './logger';
import { memberWantsSocialNotification } from '../services/notification-preferences.service';
import { pushToUser } from '../services/push.service';
import { emitToUserRoom } from '../services/socket.service';
import { isBlockedEitherWay } from '../services/audience.service';
import { quietedByPileOn } from '../services/pile-on.service';
import { withinTargetLimit } from '../middleware/socialLimits';
import { publicName } from './member-display';

// The kinds worth waking a phone for. A like is shown in the app, not pushed.
const PUSHED_KINDS = new Set<NotificationType>(['COMMENT', 'MENTION', 'FOLLOW', 'FOLLOW_REQUEST', 'REPOST']);

// The kinds that are one member reaching for another's attention, and so the
// ones a pile-on is made of. A like is a reaction to something she posted, not
// a contact, and a crowd of likes is a good day.
const CONTACT_KINDS = new Set<NotificationType>(['COMMENT', 'MENTION', 'FOLLOW', 'FOLLOW_REQUEST', 'REPOST']);

export async function actorDisplayName(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { displayName: true, firstName: true },
  });
  // Her public name, else her first name: the notification is read by the member she acted on.
  return publicName(user, 'Someone');
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
    if (await isBlockedEitherWay(input.recipientId, input.actorId)) return;

    // Counted before her preferences are read: a member who has switched
    // follow alerts off is still being followed by a crowd, and staff should
    // hear about that whether or not her phone would have rung.
    if (CONTACT_KINDS.has(input.type) && (await quietedByPileOn(input.recipientId, input.actorId))) return;

    const name = await actorDisplayName(input.actorId);

    // The recipient may have switched this kind off.
    if (!(await memberWantsSocialNotification(input.recipientId, input.type))) return;

    // The same account, again and again, for the same member.
    if (!(await withinTargetLimit(input.type === 'MENTION' ? 'mention' : 'notice', input.actorId, input.recipientId))) return;
    const notification = await prisma.notification.create({
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

    // Live to any client she has open. Before, a like, comment, follow,
    // mention or repost reached web and mobile only on their next poll, since
    // the only emitters of notifications:new were createNotification and the
    // go-live notice. The user room only: every socket joins user:<id> when
    // it connects, and emitting to notifications:<id> as well would deliver
    // twice to a socket in both.
    emitToUserRoom(input.recipientId, 'notifications:new', notification);

    // After the row exists: the same news on the recipient's phone, subject
    // to their push preferences. Never awaited into the request.
    if (PUSHED_KINDS.has(input.type)) {
      void pushToUser(input.recipientId, input.type, {
        title: input.title,
        body: input.message(name),
        link: input.link,
        data: { type: input.type, actorId: input.actorId },
      });
    }
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
