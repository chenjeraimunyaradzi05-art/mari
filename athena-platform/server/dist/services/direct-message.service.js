"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertCanMessageUser = assertCanMessageUser;
exports.findDirectConversation = findDirectConversation;
exports.getOrCreateDirectConversation = getOrCreateDirectConversation;
exports.assertCanSendInConversation = assertCanSendInConversation;
const prisma_1 = require("../utils/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
async function assertCanMessageUser(senderId, receiverId) {
    if (senderId === receiverId) {
        throw new errorHandler_1.ApiError(400, 'Cannot message yourself');
    }
    const receiver = await prisma_1.prisma.user.findUnique({
        where: { id: receiverId },
        select: { id: true, allowMessages: true },
    });
    if (!receiver) {
        throw new errorHandler_1.ApiError(404, 'User not found');
    }
    if (!receiver.allowMessages) {
        throw new errorHandler_1.ApiError(403, 'This user is not accepting messages');
    }
    return receiver;
}
async function findDirectConversation(userIdA, userIdB) {
    const conversations = await prisma_1.prisma.conversation.findMany({
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
async function getOrCreateDirectConversation(senderId, receiverId) {
    await assertCanMessageUser(senderId, receiverId);
    const existingConversationId = await findDirectConversation(senderId, receiverId);
    if (existingConversationId) {
        return { id: existingConversationId, isNew: false };
    }
    const conversation = await prisma_1.prisma.conversation.create({
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
async function assertCanSendInConversation(conversationId, senderId) {
    const conversation = await prisma_1.prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { participants: true },
    });
    if (!conversation) {
        throw new errorHandler_1.ApiError(404, 'Conversation not found');
    }
    const participantIds = conversation.participants.map((participant) => participant.userId);
    if (!participantIds.includes(senderId)) {
        throw new errorHandler_1.ApiError(403, 'Not a participant');
    }
    if (participantIds.length !== 2) {
        throw new errorHandler_1.ApiError(400, 'Use the group chat endpoint for group messages');
    }
    const receiverId = participantIds.find((participantId) => participantId !== senderId);
    if (!receiverId) {
        throw new errorHandler_1.ApiError(500, 'Recipient not found');
    }
    await assertCanMessageUser(senderId, receiverId);
    return {
        conversation,
        participantIds,
        receiverId,
    };
}
//# sourceMappingURL=direct-message.service.js.map