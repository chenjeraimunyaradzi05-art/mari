/**
 * "Who can message me", from the safety settings the settings page has always
 * saved (UserSafetySettings.allowMessagesFrom):
 *
 *   all          anyone can open a thread
 *   connections  only people the member follows (they chose them)
 *   none         nobody; the member reaches out first
 *
 * A thread that already exists stays open either way, so a setting changed
 * later never cuts a conversation in half. Blocking is checked separately.
 */

import { prisma } from '../utils/prisma';
import { bestEffort } from '../utils/best-effort';

export type MessageAudience = 'all' | 'connections' | 'none';

/**
 * This read fails OPEN: a settings row that cannot be read falls through the
 * last line to 'all', the same answer a member who never changed the setting
 * gets. That is the weaker of the two directions and is deliberate — the
 * alternative would let one database blip close every inbox on the platform —
 * and it is not the only thing standing between a member and an unwanted
 * message, because blocking is enforced separately and applies to a thread
 * opened this way like any other.
 *
 * What the `catch { return 'all' }` here cost was the knowing: an outage that
 * quietly widened everyone's audience to "anyone can message me" reached that
 * answer in complete silence, so the widening was unobservable while it lasted.
 */
export async function messageAudienceOf(userId: string): Promise<MessageAudience> {
  const row = await bestEffort('message-permissions.audience-setting', () =>
    prisma.userSafetySettings.findUnique({
      where: { userId },
      select: { allowMessagesFrom: true },
    })
  );
  const value = row?.allowMessagesFrom;
  return value === 'connections' || value === 'none' ? value : 'all';
}

/**
 * This read fails CLOSED: when the lookup fails the answer is "no, there is no
 * thread between these two", which withdraws the exemption above and sends the
 * caller back to the member's own setting. For a member who chose 'none' or
 * 'connections' that means the message is refused, and refusing a message that
 * should have been allowed is the mistake she can recover from — the sender
 * simply tries again — where delivering one she had shut out is not.
 *
 * The `catch { return false }` this replaces held that line without ever
 * recording that it had been reached, so a database blip that turned every
 * ongoing conversation into a refusal for as long as it lasted looked, from the
 * log, like members quietly tightening their settings. The fallback is spelled
 * out as the third argument so the direction is visible at the call.
 */
async function existingDirectThread(a: string, b: string): Promise<boolean> {
  return bestEffort(
    'message-permissions.existing-thread',
    async () => {
      const row = await prisma.conversation.findFirst({
        where: {
          AND: [{ participants: { some: { userId: a } } }, { participants: { some: { userId: b } } }],
        },
        select: { id: true },
      });
      return Boolean(row);
    },
    false
  );
}

export async function canOpenConversation(
  senderId: string,
  receiverId: string
): Promise<{ allowed: true } | { allowed: false; reason: string }> {
  if (senderId === receiverId) return { allowed: true };
  const audience = await messageAudienceOf(receiverId);
  if (audience === 'all') return { allowed: true };
  if (await existingDirectThread(senderId, receiverId)) return { allowed: true };
  if (audience === 'none') {
    return { allowed: false, reason: 'This member is not accepting new messages' };
  }
  const follows = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: receiverId, followingId: senderId } },
    select: { followerId: true },
  });
  return follows
    ? { allowed: true }
    : { allowed: false, reason: 'This member only accepts messages from people they follow' };
}
