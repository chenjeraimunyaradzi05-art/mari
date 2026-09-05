import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';

// How many messages the opener of a message request may send before the other
// person accepts. Enough to say who you are and why; not enough to flood.
export const MESSAGE_REQUEST_LIMIT = 3;

export async function assertCanMessageUser(senderId: string, receiverId: string) {
  if (senderId === receiverId) {
    throw new ApiError(400, 'Cannot message yourself');
  }

  const receiver = await prisma.user.findUnique({
    where: { id: receiverId },
    select: { id: true, allowMessages: true },
  });

  if (!receiver) {
    throw new ApiError(404, 'User not found');
  }

  if (!receiver.allowMessages) {
    throw new ApiError(403, 'This user is not accepting messages');
  }

  return receiver;
}

export async function findDirectConversation(userIdA: string, userIdB: string): Promise<string | null> {
  const conversations = await prisma.conversation.findMany({
    where: {
      AND: [
        { participants: { some: { userId: userIdA } } },
        { participants: { some: { userId: userIdB } } },
      ],
    },
    select: {
      id: true,
      participants: { select: { userId: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 10,
  });

  const participantSet = new Set([userIdA, userIdB]);
  const directConversation = conversations.find((conversation) => {
    const participants = conversation.participants.map((participant) => participant.userId);
    return participants.length === 2 && participants.every((participantId) => participantSet.has(participantId));
  });

  return directConversation?.id ?? null;
}

export async function getOrCreateDirectConversation(senderId: string, receiverId: string) {
  await assertCanMessageUser(senderId, receiverId);

  const existingConversationId = await findDirectConversation(senderId, receiverId);
  if (existingConversationId) {
    return { id: existingConversationId, isNew: false, isRequest: false };
  }

  // A thread opened by someone the recipient does not follow is a request: it
  // waits in their Requests tab until they accept it.
  const receiverFollowsSender = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: receiverId, followingId: senderId } },
    select: { followerId: true },
  });
  const isRequest = !receiverFollowsSender;

  const conversation = await prisma.conversation.create({
    data: {
      requestedById: isRequest ? senderId : null,
      participants: {
        create: [
          { userId: senderId },
          { userId: receiverId },
        ],
      },
    },
    select: { id: true },
  });

  return { id: conversation.id, isNew: true, isRequest };
}

/**
 * The request state of a thread from one participant's side. isRequest: this
 * person is being asked. requestPending: this person asked and is waiting.
 * requestDeclined: the answer was no.
 */
export function requestStateFor(
  conversation: { requestedById: string | null; requestAcceptedAt: Date | null; requestDeclinedAt: Date | null },
  viewerId: string
) {
  const pending = Boolean(conversation.requestedById) && !conversation.requestAcceptedAt && !conversation.requestDeclinedAt;
  return {
    isRequest: pending && conversation.requestedById !== viewerId,
    requestPending: pending && conversation.requestedById === viewerId,
    requestDeclined: Boolean(conversation.requestDeclinedAt),
  };
}

export async function assertCanSendInConversation(conversationId: string, senderId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { participants: true },
  });

  if (!conversation) {
    throw new ApiError(404, 'Conversation not found');
  }

  const participantIds = conversation.participants.map((participant) => participant.userId);
  if (!participantIds.includes(senderId)) {
    throw new ApiError(403, 'Not a participant');
  }

  if (participantIds.length !== 2) {
    throw new ApiError(400, 'Use the group chat endpoint for group messages');
  }

  const receiverId = participantIds.find((participantId) => participantId !== senderId);
  if (!receiverId) {
    throw new ApiError(500, 'Recipient not found');
  }

  await assertCanMessageUser(senderId, receiverId);

  // The opener of a request gets a few messages to introduce themselves, then
  // waits. A declined request is closed to them for good.
  if (conversation.requestedById === senderId && !conversation.requestAcceptedAt) {
    if (conversation.requestDeclinedAt) {
      throw new ApiError(403, 'They declined your message request');
    }
    const sent = await prisma.message.count({ where: { conversationId, senderId } });
    if (sent >= MESSAGE_REQUEST_LIMIT) {
      throw new ApiError(403, 'Wait for them to accept your message request before sending more');
    }
  }

  return {
    conversation,
    participantIds,
    receiverId,
  };
}
