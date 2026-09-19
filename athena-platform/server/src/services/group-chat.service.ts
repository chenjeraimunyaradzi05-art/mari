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

/** A banned row: kept so the ban outlives leaving, shown only to admins. */
export interface BannedGroupMember {
  userId: string;
  displayName: string;
  avatar: string | null;
  bannedReason: string | null;
}

const GROUP_LINK = (groupId: string) => `/dashboard/groups/${groupId}`;

/** Admins and moderators, who both act on join requests. */
const GROUP_STAFF: GroupRole[] = ['ADMIN', 'MODERATOR'];

/** Only rows that are not banned count as members, for capacity and for "last admin". */
const ACTIVE_MEMBER = { isBanned: false } as const;

/**
 * The actor's own row, refused when she is not in the group or is banned
 * from it. Returned so the caller can read her role without a second query.
 */
async function requireActiveMember(groupId: string, userId: string) {
  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    include: { group: { select: { allowMemberInvites: true } } },
  });
  if (!member) throw new ApiError(403, 'You are not a member of this group');
  if (member.isBanned) throw new ApiError(403, 'You are banned from this group');
  return member;
}

/** Who to name in a notification: display name, full name, or "Someone". */
async function displayNamesFor(userIds: string[]): Promise<Map<string, string>> {
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, displayName: true, firstName: true, lastName: true },
  });
  const names = new Map<string, string>();
  for (const user of users) {
    const full = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    names.set(user.id, user.displayName?.trim() || full || 'Someone');
  }
  return names;
}

/** A notification is a courtesy on top of a write that already happened; it never fails the request. */
function notifyQuietly(data: Parameters<typeof sendNotification>[0]): void {
  void sendNotification(data).catch((error) => {
    logger.warn('Group notification failed', { userId: data.userId, error: error instanceof Error ? error.message : String(error) });
  });
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
 * Add a member to a group by name.
 *
 * An admin or moderator adds her straight away (they are the ones who would
 * approve a request anyway). A plain member's suggestion becomes a pending
 * join request when the group is private or asks for approval, and the
 * admins and moderators are told; otherwise it joins her directly. Links go
 * to the group page the web app serves, /dashboard/groups/:id.
 */
export async function addMember(
  groupId: string,
  inviterId: string,
  userId: string,
  role: GroupRole = 'MEMBER'
): Promise<GroupMember | null> {
  try {
    const inviter = await requireActiveMember(groupId, inviterId);
    const inviterRole = inviter.role as GroupRole;
    const canInvite = inviterRole === 'MEMBER' ? inviter.group.allowMemberInvites : hasPermission(inviterRole, 'invite_members');
    if (!canInvite) {
      throw new ApiError(403, "You don't have permission to invite members");
    }
    if (userId === inviterId) {
      throw new ApiError(400, 'You are already here');
    }

    // Check group capacity
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        _count: { select: { members: { where: ACTIVE_MEMBER } } },
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
        throw new ApiError(400, 'That person is banned from this group');
      }
      throw new ApiError(400, 'They are already a member');
    }

    // Only admins can add moderators/admins
    if (role !== 'MEMBER' && !hasPermission(inviterRole, 'manage_roles')) {
      throw new ApiError(403, "You don't have permission to manage roles");
    }

    const inviterIsStaff = GROUP_STAFF.includes(inviterRole);
    const needsApproval = (group.requireApproval || group.privacy === 'PRIVATE') && role === 'MEMBER' && !inviterIsStaff;
    const names = await displayNamesFor([inviterId, userId]);
    const inviterName = names.get(inviterId) || 'Someone';
    const inviteeName = names.get(userId) || 'Someone';

    if (needsApproval) {
      // A suggestion from a member waits for an admin, like any other request.
      await prisma.groupJoinRequest.upsert({
        where: { groupId_userId: { groupId, userId } },
        update: { status: 'PENDING', reviewedAt: null, reviewedById: null, invitedById: inviterId },
        create: { groupId, userId, invitedById: inviterId, status: 'PENDING' },
      });

      const staff = await prisma.groupMember.findMany({
        where: { groupId, role: { in: GROUP_STAFF }, ...ACTIVE_MEMBER },
        select: { userId: true },
      });
      for (const member of staff) {
        notifyQuietly({
          userId: member.userId,
          type: 'SYSTEM',
          title: 'Someone asked to join',
          message: `${inviterName} suggested ${inviteeName} for ${group.name}`,
          link: `${GROUP_LINK(groupId)}?tab=requests`,
        });
      }

      logger.info('Member suggested for group, awaiting approval', { groupId, userId, inviterId });
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

    // A request she had open is answered by being let in.
    await prisma.groupJoinRequest.updateMany({
      where: { groupId, userId, status: 'PENDING' },
      data: { status: 'APPROVED', reviewedAt: new Date(), reviewedById: inviterId },
    });

    // Notify the new member
    notifyQuietly({
      userId,
      type: 'SYSTEM',
      title: 'Added to a group',
      message: `${inviterName} added you to ${group.name}`,
      link: GROUP_LINK(groupId),
    });

    logger.info('Member added to group', { groupId, userId, role, inviterId });

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
 * Update member role. This is the one role-change path (the duplicate in
 * group.routes.ts was retired), so the last-admin guard lives here: a
 * group is never left without an admin.
 */
export async function updateMemberRole(
  groupId: string,
  actorId: string,
  userId: string,
  newRole: GroupRole
): Promise<{ groupId: string; userId: string; role: GroupRole }> {
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

    if (!member || member.isBanned) {
      throw new ApiError(404, 'Member not found');
    }

    if (member.role === 'ADMIN' && newRole !== 'ADMIN') {
      const adminCount = await prisma.groupMember.count({ where: { groupId, role: 'ADMIN', ...ACTIVE_MEMBER } });
      if (adminCount <= 1) {
        throw new ApiError(400, 'Group must have at least one admin');
      }
    }

    // Update role
    const updated = await prisma.groupMember.update({
      where: { groupId_userId: { groupId, userId } },
      data: { role: newRole },
      select: { groupId: true, userId: true, role: true },
    });

    logger.info('Member role updated', { groupId, userId, newRole, actorId });
    return { groupId: updated.groupId, userId: updated.userId, role: updated.role as GroupRole };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.error('Failed to update member role', { error, groupId, userId });
    throw error;
  }
}

/** "24 hours", "2 hours", "45 minutes": how long a mute lasts, in words. */
function muteDurationLabel(durationMinutes?: number): string {
  if (!durationMinutes) return 'until an admin lifts it';
  if (durationMinutes % 60 === 0) {
    const hours = durationMinutes / 60;
    return hours === 1 ? 'for an hour' : `for ${hours} hours`;
  }
  return `for ${durationMinutes} minutes`;
}

/**
 * Mute a member. The reason is not a column on GroupMember, so it is kept
 * in the audit log and told to the member herself, which is what a reason
 * is for.
 */
export async function muteMember(
  groupId: string,
  actorId: string,
  userId: string,
  durationMinutes?: number,
  reason?: string
): Promise<void> {
  try {
    await enforcePermission(groupId, actorId, 'mute_members');
    if (actorId === userId) {
      throw new ApiError(400, 'You cannot mute yourself');
    }

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

    const group = await prisma.group.findUnique({ where: { id: groupId }, select: { name: true } });
    notifyQuietly({
      userId,
      type: 'SYSTEM',
      title: 'Muted in a group',
      message: `You've been muted in ${group?.name ?? 'a group'} ${muteDurationLabel(durationMinutes)}${reason ? `: ${reason}` : '.'} You can still read along.`,
      link: GROUP_LINK(groupId),
    });

    logger.info('Member muted', { groupId, userId, actorId, durationMinutes, reason: reason || null });
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
 * Ban a member. The row stays in GroupMember with isBanned set, which is
 * what makes the ban hold after she leaves: Join reads it and refuses. A
 * banned admin is demoted so the row carries no standing.
 */
export async function banMember(
  groupId: string,
  actorId: string,
  userId: string,
  reason?: string
): Promise<void> {
  try {
    await enforcePermission(groupId, actorId, 'ban_members');
    if (actorId === userId) {
      throw new ApiError(400, 'You cannot ban yourself');
    }

    const existing = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
      select: { role: true, isBanned: true },
    });
    if (existing && existing.role === 'ADMIN' && !existing.isBanned) {
      const adminCount = await prisma.groupMember.count({ where: { groupId, role: 'ADMIN', ...ACTIVE_MEMBER } });
      if (adminCount <= 1) {
        throw new ApiError(400, 'Group must have at least one admin');
      }
    }

    // Keep the row, mark it banned
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
        role: 'MEMBER',
        isBanned: true,
        bannedReason: reason,
        isMuted: false,
        mutedUntil: null,
      },
    });

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { name: true },
    });

    notifyQuietly({
      userId,
      type: 'SYSTEM',
      title: 'Banned from a group',
      message: `You've been banned from ${group?.name ?? 'a group'}${reason ? `: ${reason}` : '.'}`,
    });

    logger.info('Member banned', { groupId, userId, actorId, reason: reason || null });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.error('Failed to ban member', { error, groupId, userId });
    throw error;
  }
}

/**
 * Lift a ban. The row goes: she is no longer banned and no longer a member,
 * so a private group's Join asks again rather than letting her straight in.
 */
export async function unbanMember(
  groupId: string,
  actorId: string,
  userId: string
): Promise<void> {
  try {
    await enforcePermission(groupId, actorId, 'ban_members');

    const existing = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
      select: { isBanned: true },
    });
    if (!existing || !existing.isBanned) {
      throw new ApiError(404, 'That person is not banned');
    }

    await prisma.groupMember.delete({ where: { groupId_userId: { groupId, userId } } });

    const group = await prisma.group.findUnique({ where: { id: groupId }, select: { name: true } });
    notifyQuietly({
      userId,
      type: 'SYSTEM',
      title: 'Welcome back',
      message: `You can join ${group?.name ?? 'the group'} again.`,
      link: GROUP_LINK(groupId),
    });

    logger.info('Member unbanned', { groupId, userId, actorId });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.error('Failed to unban member', { error, groupId, userId });
    throw error;
  }
}

/**
 * The banned rows, for an admin to review or reverse.
 */
export async function getBannedMembers(
  groupId: string,
  actorId: string
): Promise<BannedGroupMember[]> {
  await enforcePermission(groupId, actorId, 'ban_members');

  const rows = await prisma.groupMember.findMany({
    where: { groupId, isBanned: true },
    include: { user: { select: { id: true, displayName: true, avatar: true } } },
    orderBy: { joinedAt: 'asc' },
  });

  return rows.map((m) => ({
    userId: m.userId,
    displayName: m.user.displayName || '',
    avatar: m.user.avatar,
    bannedReason: m.bannedReason ?? null,
  }));
}

/**
 * Get group members with roles
 */
export async function getGroupMembers(
  groupId: string,
  userId: string
): Promise<GroupMember[]> {
  // Verify requester is a member; a banned row does not count.
  await requireActiveMember(groupId, userId);

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
  unbanMember,
  getBannedMembers,
  getGroupMembers,
  canSendMessage,
};
