import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';

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
    return { id: existingConversationId, isNew: false };
  }

  const conversation = await prisma.conversation.create({
    data: {
      participants: {
        create: [
          { userId: senderId },
          { userId: receiverId },
        ],
      },
    },
    select: { id: true },
  });

  return { id: conversation.id, isNew: true };
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

  return {
    conversation,
    participantIds,
    receiverId,
  };
}
