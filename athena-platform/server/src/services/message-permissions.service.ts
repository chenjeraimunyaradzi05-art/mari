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

export type MessageAudience = 'all' | 'connections' | 'none';

export async function messageAudienceOf(userId: string): Promise<MessageAudience> {
  try {
    const row = await prisma.userSafetySettings.findUnique({
      where: { userId },
      select: { allowMessagesFrom: true },
    });
    const value = row?.allowMessagesFrom;
    return value === 'connections' || value === 'none' ? value : 'all';
  } catch {
    return 'all';
  }
}

async function existingDirectThread(a: string, b: string): Promise<boolean> {
  try {
    const row = await prisma.conversation.findFirst({
      where: {
        AND: [{ participants: { some: { userId: a } } }, { participants: { some: { userId: b } } }],
      },
      select: { id: true },
    });
    return Boolean(row);
  } catch {
    return false;
  }
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
