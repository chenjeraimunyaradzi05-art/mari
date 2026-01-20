"use strict";
/**
 * Group Chat Service
 * Role validation and management for group conversations
 * Phase 2: Backend Logic & Integrations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.groupChatService = void 0;
exports.hasPermission = hasPermission;
exports.validatePermission = validatePermission;
exports.enforcePermission = enforcePermission;
exports.createGroup = createGroup;
exports.addMember = addMember;
exports.removeMember = removeMember;
exports.updateMemberRole = updateMemberRole;
exports.muteMember = muteMember;
exports.banMember = banMember;
exports.getGroupMembers = getGroupMembers;
exports.canSendMessage = canSendMessage;
const prisma_1 = require("../utils/prisma");
const logger_1 = require("../utils/logger");
const errorHandler_1 = require("../middleware/errorHandler");
const socket_service_1 = require("./socket.service");
// ==========================================
// ROLE PERMISSIONS
// ==========================================
const ROLE_PERMISSIONS = {
    ADMIN: [
        'manage_settings',
        'manage_members',
        'manage_roles',
        'delete_group',
        'kick_members',
        'ban_members',
        'mute_members',
        'pin_messages',
        'delete_messages',
        'send_messages',
        'invite_members',
    ],
    MODERATOR: [
        'kick_members',
        'mute_members',
        'pin_messages',
        'delete_messages',
        'send_messages',
        'invite_members',
    ],
    MEMBER: [
        'send_messages',
        'invite_members', // If allowed by settings
    ],
};
/**
 * Check if a role has a specific permission
 */
function hasPermission(role, permission) {
    return ROLE_PERMISSIONS[role]?.includes(permission) || false;
}
/**
 * Validate user has permission in a group
 */
async function validatePermission(groupId, userId, permission) {
    const member = await prisma_1.prisma.groupMember.findUnique({
        where: {
            groupId_userId: { groupId, userId },
        },
        include: {
            group: {
                select: {
                    allowMemberInvites: true,
                },
            },
        },
    });
    if (!member) {
        throw new errorHandler_1.ApiError(403, 'You are not a member of this group');
    }
    if (member.isBanned) {
        throw new errorHandler_1.ApiError(403, 'You are banned from this group');
    }
    const role = member.role;
    // Special case: invite_members depends on group settings for MEMBER role
    if (permission === 'invite_members' && role === 'MEMBER') {
        return member.group.allowMemberInvites;
    }
    return hasPermission(role, permission);
}
/**
 * Enforce permission (throws if not allowed)
 */
async function enforcePermission(groupId, userId, permission) {
    const allowed = await validatePermission(groupId, userId, permission);
    if (!allowed) {
        throw new errorHandler_1.ApiError(403, `You don't have permission to ${permission.replace(/_/g, ' ')}`);
    }
}
// ==========================================
// GROUP OPERATIONS
// ==========================================
/**
 * Create a new group conversation
 */
async function createGroup(creatorId, settings) {
    try {
        // Create the group
        const group = await prisma_1.prisma.group.create({
            data: {
                name: settings.name,
                description: settings.description,
                avatar: settings.avatar,
                privacy: settings.isPrivate ? 'PRIVATE' : 'PUBLIC',
                allowMemberInvites: settings.allowMemberInvites,
                requireApproval: settings.requireApproval,
                maxMembers: settings.maxMembers,
                creatorId,
                members: {
                    create: {
                        userId: creatorId,
                        role: 'ADMIN',
                    },
                },
            },
            include: {
                members: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                displayName: true,
                                avatar: true,
                            },
                        },
                    },
                },
            },
        });
        logger_1.logger.info('Group created', { groupId: group.id, creatorId });
        return group;
    }
    catch (error) {
        logger_1.logger.error('Failed to create group', { error, creatorId });
        throw error;
    }
}
/**
 * Add a member to a group
 */
async function addMember(groupId, inviterId, userId, role = 'MEMBER') {
    try {
        // Check inviter has permission
        await enforcePermission(groupId, inviterId, 'invite_members');
        // Check group capacity
        const group = await prisma_1.prisma.group.findUnique({
            where: { id: groupId },
            include: {
                _count: { select: { members: true } },
            },
        });
        if (!group) {
            throw new errorHandler_1.ApiError(404, 'Group not found');
        }
        if (group._count.members >= group.maxMembers) {
            throw new errorHandler_1.ApiError(400, 'Group is at maximum capacity');
        }
        // Check if already a member
        const existing = await prisma_1.prisma.groupMember.findUnique({
            where: { groupId_userId: { groupId, userId } },
        });
        if (existing) {
            if (existing.isBanned) {
                throw new errorHandler_1.ApiError(400, 'User is banned from this group');
            }
            throw new errorHandler_1.ApiError(400, 'User is already a member');
        }
        // Only admins can add moderators/admins
        if (role !== 'MEMBER') {
            await enforcePermission(groupId, inviterId, 'manage_roles');
        }
        // Handle approval requirement
        if (group.requireApproval && role === 'MEMBER') {
            // Create pending request
            await prisma_1.prisma.groupJoinRequest.create({
                data: {
                    groupId,
                    userId,
                    invitedById: inviterId,
                    status: 'PENDING',
                },
            });
            // Notify admins
            const admins = await prisma_1.prisma.groupMember.findMany({
                where: { groupId, role: 'ADMIN' },
                select: { userId: true },
            });
            for (const admin of admins) {
                await (0, socket_service_1.sendNotification)({
                    userId: admin.userId,
                    type: 'SYSTEM',
                    title: 'New Join Request',
                    message: `Someone wants to join "${group.name}"`,
                    link: `/groups/${groupId}/requests`,
                });
            }
            return null; // Pending approval
        }
        // Add member directly
        const member = await prisma_1.prisma.groupMember.create({
            data: {
                groupId,
                userId,
                role,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        displayName: true,
                        avatar: true,
                    },
                },
            },
        });
        // Notify the new member
        await (0, socket_service_1.sendNotification)({
            userId,
            type: 'SYSTEM',
            title: 'Added to Group',
            message: `You've been added to "${group.name}"`,
            link: `/groups/${groupId}`,
        });
        logger_1.logger.info('Member added to group', { groupId, userId, role });
        return {
            userId: member.userId,
            role: member.role,
            displayName: member.user.displayName,
            avatar: member.user.avatar,
            joinedAt: member.createdAt,
        };
    }
    catch (error) {
        if (error instanceof errorHandler_1.ApiError)
            throw error;
        logger_1.logger.error('Failed to add member', { error, groupId, userId });
        throw error;
    }
}
/**
 * Remove a member from a group
 */
async function removeMember(groupId, actorId, userId, reason) {
    try {
        // Users can leave themselves
        if (actorId !== userId) {
            await enforcePermission(groupId, actorId, 'kick_members');
        }
        // Get member to remove
        const member = await prisma_1.prisma.groupMember.findUnique({
            where: { groupId_userId: { groupId, userId } },
        });
        if (!member) {
            throw new errorHandler_1.ApiError(404, 'Member not found');
        }
        // Can't kick someone with higher/equal role (unless leaving)
        if (actorId !== userId) {
            const actor = await prisma_1.prisma.groupMember.findUnique({
                where: { groupId_userId: { groupId, actorId } },
            });
            const roleHierarchy = { ADMIN: 3, MODERATOR: 2, MEMBER: 1 };
            if (roleHierarchy[member.role] >= roleHierarchy[actor?.role || 'MEMBER']) {
                throw new errorHandler_1.ApiError(403, 'Cannot remove member with equal or higher role');
            }
        }
        // Remove member
        await prisma_1.prisma.groupMember.delete({
            where: { groupId_userId: { groupId, userId } },
        });
        // Notify if kicked (not leaving)
        if (actorId !== userId) {
            const group = await prisma_1.prisma.group.findUnique({
                where: { id: groupId },
                select: { name: true },
            });
            await (0, socket_service_1.sendNotification)({
                userId,
                type: 'SYSTEM',
                title: 'Removed from Group',
                message: `You've been removed from "${group?.name}"${reason ? `: ${reason}` : ''}`,
            });
        }
        logger_1.logger.info('Member removed from group', { groupId, userId, actorId });
    }
    catch (error) {
        if (error instanceof errorHandler_1.ApiError)
            throw error;
        logger_1.logger.error('Failed to remove member', { error, groupId, userId });
        throw error;
    }
}
/**
 * Update member role
 */
async function updateMemberRole(groupId, actorId, userId, newRole) {
    try {
        await enforcePermission(groupId, actorId, 'manage_roles');
        // Can't change own role (must transfer ownership)
        if (actorId === userId) {
            throw new errorHandler_1.ApiError(400, 'Cannot change your own role');
        }
        // Check member exists
        const member = await prisma_1.prisma.groupMember.findUnique({
            where: { groupId_userId: { groupId, userId } },
        });
        if (!member) {
            throw new errorHandler_1.ApiError(404, 'Member not found');
        }
        // Update role
        await prisma_1.prisma.groupMember.update({
            where: { groupId_userId: { groupId, userId } },
            data: { role: newRole },
        });
        logger_1.logger.info('Member role updated', { groupId, userId, newRole });
    }
    catch (error) {
        if (error instanceof errorHandler_1.ApiError)
            throw error;
        logger_1.logger.error('Failed to update member role', { error, groupId, userId });
        throw error;
    }
}
/**
 * Mute a member
 */
async function muteMember(groupId, actorId, userId, durationMinutes) {
    try {
        await enforcePermission(groupId, actorId, 'mute_members');
        const muteUntil = durationMinutes
            ? new Date(Date.now() + durationMinutes * 60 * 1000)
            : null; // Indefinite
        await prisma_1.prisma.groupMember.update({
            where: { groupId_userId: { groupId, userId } },
            data: {
                isMuted: true,
                mutedUntil: muteUntil,
            },
        });
        logger_1.logger.info('Member muted', { groupId, userId, durationMinutes });
    }
    catch (error) {
        if (error instanceof errorHandler_1.ApiError)
            throw error;
        logger_1.logger.error('Failed to mute member', { error, groupId, userId });
        throw error;
    }
}
/**
 * Ban a member
 */
async function banMember(groupId, actorId, userId, reason) {
    try {
        await enforcePermission(groupId, actorId, 'ban_members');
        // Remove from group and mark as banned
        await prisma_1.prisma.groupMember.upsert({
            where: { groupId_userId: { groupId, userId } },
            create: {
                groupId,
                userId,
                role: 'MEMBER',
                isBanned: true,
                bannedReason: reason,
            },
            update: {
                isBanned: true,
                bannedReason: reason,
            },
        });
        const group = await prisma_1.prisma.group.findUnique({
            where: { id: groupId },
            select: { name: true },
        });
        await (0, socket_service_1.sendNotification)({
            userId,
            type: 'SYSTEM',
            title: 'Banned from Group',
            message: `You've been banned from "${group?.name}"${reason ? `: ${reason}` : ''}`,
        });
        logger_1.logger.info('Member banned', { groupId, userId, reason });
    }
    catch (error) {
        if (error instanceof errorHandler_1.ApiError)
            throw error;
        logger_1.logger.error('Failed to ban member', { error, groupId, userId });
        throw error;
    }
}
/**
 * Get group members with roles
 */
async function getGroupMembers(groupId, userId) {
    // Verify requester is a member
    const isMember = await prisma_1.prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId } },
    });
    if (!isMember) {
        throw new errorHandler_1.ApiError(403, 'You are not a member of this group');
    }
    const members = await prisma_1.prisma.groupMember.findMany({
        where: {
            groupId,
            isBanned: false,
        },
        include: {
            user: {
                select: {
                    id: true,
                    displayName: true,
                    avatar: true,
                },
            },
        },
        orderBy: [
            { role: 'asc' }, // Admins first
            { createdAt: 'asc' },
        ],
    });
    return members.map((m) => ({
        userId: m.userId,
        role: m.role,
        displayName: m.user.displayName,
        avatar: m.user.avatar,
        joinedAt: m.createdAt,
        isMuted: m.isMuted,
    }));
}
/**
 * Validate user can send message in group
 */
async function canSendMessage(groupId, userId) {
    const member = await prisma_1.prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId } },
    });
    if (!member) {
        return { allowed: false, reason: 'Not a member of this group' };
    }
    if (member.isBanned) {
        return { allowed: false, reason: 'You are banned from this group' };
    }
    if (member.isMuted) {
        if (member.mutedUntil && member.mutedUntil > new Date()) {
            return { allowed: false, reason: 'You are muted in this group' };
        }
        // Mute expired, unmute
        await prisma_1.prisma.groupMember.update({
            where: { groupId_userId: { groupId, userId } },
            data: { isMuted: false, mutedUntil: null },
        });
    }
    return { allowed: true };
}
exports.groupChatService = {
    hasPermission,
    validatePermission,
    enforcePermission,
    createGroup,
    addMember,
    removeMember,
    updateMemberRole,
    muteMember,
    banMember,
    getGroupMembers,
    canSendMessage,
};
//# sourceMappingURL=group-chat.service.js.map