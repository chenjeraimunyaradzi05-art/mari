/**
 * Group Chat Service
 * Role validation and management for group conversations
 * Phase 2: Backend Logic & Integrations
 */

import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { ApiError } from '../middleware/errorHandler';
import { sendNotification } from './socket.service';

// ==========================================
// TYPES
// ==========================================

export type GroupRole = 'ADMIN' | 'MODERATOR' | 'MEMBER';

export interface GroupMember {
  userId: string;
  role: GroupRole;
  displayName: string;
  avatar: string | null;
  joinedAt: Date;
  isMuted?: boolean;
}

export interface GroupSettings {
  name: string;
  description?: string;
  avatar?: string;
  isPrivate: boolean;
  allowMemberInvites: boolean;
  requireApproval: boolean;
  maxMembers: number;
}

// ==========================================
// ROLE PERMISSIONS
// ==========================================

const ROLE_PERMISSIONS: Record<GroupRole, string[]> = {
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
export function hasPermission(role: GroupRole, permission: string): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) || false;
}

/**
 * Validate user has permission in a group
 */
export async function validatePermission(
  groupId: string,
  userId: string,
  permission: string
): Promise<boolean> {
  const member = await prisma.groupMember.findUnique({
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
    throw new ApiError(403, 'You are not a member of this group');
  }
  
  if (member.isBanned) {
    throw new ApiError(403, 'You are banned from this group');
  }
  
  const role = member.role as GroupRole;
  
  // Special case: invite_members depends on group settings for MEMBER role
  if (permission === 'invite_members' && role === 'MEMBER') {
    return member.group.allowMemberInvites;
  }
  
  return hasPermission(role, permission);
}

/**
 * Enforce permission (throws if not allowed)
 */
export async function enforcePermission(
  groupId: string,
  userId: string,
  permission: string
): Promise<void> {
  const allowed = await validatePermission(groupId, userId, permission);
  
  if (!allowed) {
    throw new ApiError(403, `You don't have permission to ${permission.replace(/_/g, ' ')}`);
  }
}

// ==========================================
// GROUP OPERATIONS
// ==========================================

/**
 * Create a new group conversation
 */
export async function createGroup(
  creatorId: string,
  settings: GroupSettings
): Promise<any> {
  try {
    // Create the group
    const group = await prisma.group.create({
      data: {
        name: settings.name,
        description: settings.description || '',
        privacy: settings.isPrivate ? 'PRIVATE' : 'PUBLIC',
        allowMemberInvites: settings.allowMemberInvites,
        requireApproval: settings.requireApproval,
        maxMembers: settings.maxMembers,
        createdById: creatorId,
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
    
    logger.info('Group created', { groupId: group.id, creatorId });
    
    return group;
  } catch (error) {
    logger.error('Failed to create group', { error, creatorId });
    throw error;
  }
}

/**
 * Add a member to a group
 */
export async function addMember(
  groupId: string,
  inviterId: string,
  userId: string,
  role: GroupRole = 'MEMBER'
): Promise<GroupMember | null> {
  try {
    // Check inviter has permission
    await enforcePermission(groupId, inviterId, 'invite_members');
    
    // Check group capacity
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        _count: { select: { members: true } },
      },
    });
    
    if (!group) {
      throw new ApiError(404, 'Group not found');
    }
    
    if (group._count.members >= group.maxMembers) {
      throw new ApiError(400, 'Group is at maximum capacity');
    }
    
    // Check if already a member
    const existing = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    
    if (existing) {
      if (existing.isBanned) {
        throw new ApiError(400, 'User is banned from this group');
      }
      throw new ApiError(400, 'User is already a member');
    }
    
    // Only admins can add moderators/admins
    if (role !== 'MEMBER') {
      await enforcePermission(groupId, inviterId, 'manage_roles');
    }
    
    // Handle approval requirement
    if (group.requireApproval && role === 'MEMBER') {
      // Create pending request
      await prisma.groupJoinRequest.create({
        data: {
          groupId,
          userId,
          invitedById: inviterId,
          status: 'PENDING',
        },
      });
      
      // Notify admins
      const admins = await prisma.groupMember.findMany({
        where: { groupId, role: 'ADMIN' },
        select: { userId: true },
      });
      
      for (const admin of admins) {
        await sendNotification({
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
    const member = await prisma.groupMember.create({
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
    await sendNotification({
      userId,
      type: 'SYSTEM',
      title: 'Added to Group',
      message: `You've been added to "${group.name}"`,
      link: `/groups/${groupId}`,
    });
    
    logger.info('Member added to group', { groupId, userId, role });
    
    return {
      userId: member.userId,
      role: member.role as GroupRole,
      displayName: member.user.displayName || '',
      avatar: member.user.avatar,
      joinedAt: member.joinedAt,
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.error('Failed to add member', { error, groupId, userId });
    throw error;
  }
}

/**
 * Remove a member from a group
 */
export async function removeMember(
  groupId: string,
  actorId: string,
  userId: string,
  reason?: string
): Promise<void> {
  try {
    // Users can leave themselves
    if (actorId !== userId) {
      await enforcePermission(groupId, actorId, 'kick_members');
    }
    
    // Get member to remove
    const member = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    
    if (!member) {
      throw new ApiError(404, 'Member not found');
    }
    
    // Can't kick someone with higher/equal role (unless leaving)
    if (actorId !== userId) {
      const actor = await prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId: actorId } },
      });
      
      const roleHierarchy: Record<string, number> = { ADMIN: 3, MODERATOR: 2, MEMBER: 1 };
      if (roleHierarchy[member.role] >= roleHierarchy[actor?.role || 'MEMBER']) {
        throw new ApiError(403, 'Cannot remove member with equal or higher role');
      }
    }
    
    // Remove member
    await prisma.groupMember.delete({
      where: { groupId_userId: { groupId, userId } },
    });
    
    // Notify if kicked (not leaving)
    if (actorId !== userId) {
      const group = await prisma.group.findUnique({
        where: { id: groupId },
        select: { name: true },
      });
      
      await sendNotification({
        userId,
        type: 'SYSTEM',
        title: 'Removed from Group',
        message: `You've been removed from "${group?.name}"${reason ? `: ${reason}` : ''}`,
      });
    }
    
    logger.info('Member removed from group', { groupId, userId, actorId });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.error('Failed to remove member', { error, groupId, userId });
    throw error;
  }
}

/**
 * Update member role
 */
export async function updateMemberRole(
  groupId: string,
  actorId: string,
  userId: string,
  newRole: GroupRole
): Promise<void> {
  try {
    await enforcePermission(groupId, actorId, 'manage_roles');
    
    // Can't change own role (must transfer ownership)
    if (actorId === userId) {
      throw new ApiError(400, 'Cannot change your own role');
    }
    
    // Check member exists
    const member = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    
    if (!member) {
      throw new ApiError(404, 'Member not found');
    }
    
    // Update role
    await prisma.groupMember.update({
      where: { groupId_userId: { groupId, userId } },
      data: { role: newRole },
    });
    
    logger.info('Member role updated', { groupId, userId, newRole });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.error('Failed to update member role', { error, groupId, userId });
    throw error;
  }
}

/**
 * Mute a member
 */
export async function muteMember(
  groupId: string,
  actorId: string,
  userId: string,
  durationMinutes?: number
): Promise<void> {
  try {
    await enforcePermission(groupId, actorId, 'mute_members');
    
    const muteUntil = durationMinutes
      ? new Date(Date.now() + durationMinutes * 60 * 1000)
      : null; // Indefinite
    
    await prisma.groupMember.update({
      where: { groupId_userId: { groupId, userId } },
      data: {
        isMuted: true,
        mutedUntil: muteUntil,
      },
    });
    
    logger.info('Member muted', { groupId, userId, durationMinutes });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.error('Failed to mute member', { error, groupId, userId });
    throw error;
  }
}

/**
 * Unmute a member
 */
export async function unmuteMember(
  groupId: string,
  actorId: string,
  userId: string
): Promise<void> {
  try {
    await enforcePermission(groupId, actorId, 'mute_members');

    await prisma.groupMember.update({
      where: { groupId_userId: { groupId, userId } },
      data: {
        isMuted: false,
        mutedUntil: null,
      },
    });

    logger.info('Member unmuted', { groupId, userId });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.error('Failed to unmute member', { error, groupId, userId });
    throw error;
  }
}

/**
 * Ban a member
 */
export async function banMember(
  groupId: string,
  actorId: string,
  userId: string,
  reason?: string
): Promise<void> {
  try {
    await enforcePermission(groupId, actorId, 'ban_members');
    
    // Remove from group and mark as banned
    await prisma.groupMember.upsert({
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
    
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { name: true },
    });
    
    await sendNotification({
      userId,
      type: 'SYSTEM',
      title: 'Banned from Group',
      message: `You've been banned from "${group?.name}"${reason ? `: ${reason}` : ''}`,
    });
    
    logger.info('Member banned', { groupId, userId, reason });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.error('Failed to ban member', { error, groupId, userId });
    throw error;
  }
}

/**
 * Get group members with roles
 */
export async function getGroupMembers(
  groupId: string,
  userId: string
): Promise<GroupMember[]> {
  // Verify requester is a member
  const isMember = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  
  if (!isMember) {
    throw new ApiError(403, 'You are not a member of this group');
  }
  
  const members = await prisma.groupMember.findMany({
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
      { joinedAt: 'asc' },
    ],
  });
  
  return members.map((m) => ({
    userId: m.userId,
    role: m.role as GroupRole,
    displayName: m.user.displayName || '',
    avatar: m.user.avatar,
    joinedAt: m.joinedAt,
    isMuted: m.isMuted,
  }));
}

/**
 * Validate user can send message in group
 */
export async function canSendMessage(
  groupId: string,
  userId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const member = await prisma.groupMember.findUnique({
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
    await prisma.groupMember.update({
      where: { groupId_userId: { groupId, userId } },
      data: { isMuted: false, mutedUntil: null },
    });
  }
  
  return { allowed: true };
}

export const groupChatService = {
  hasPermission,
  validatePermission,
  enforcePermission,
  createGroup,
  addMember,
  removeMember,
  updateMemberRole,
  muteMember,
  unmuteMember,
  banMember,
  getGroupMembers,
  canSendMessage,
};
