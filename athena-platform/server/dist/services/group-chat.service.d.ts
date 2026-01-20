/**
 * Group Chat Service
 * Role validation and management for group conversations
 * Phase 2: Backend Logic & Integrations
 */
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
/**
 * Check if a role has a specific permission
 */
export declare function hasPermission(role: GroupRole, permission: string): boolean;
/**
 * Validate user has permission in a group
 */
export declare function validatePermission(groupId: string, userId: string, permission: string): Promise<boolean>;
/**
 * Enforce permission (throws if not allowed)
 */
export declare function enforcePermission(groupId: string, userId: string, permission: string): Promise<void>;
/**
 * Create a new group conversation
 */
export declare function createGroup(creatorId: string, settings: GroupSettings): Promise<any>;
/**
 * Add a member to a group
 */
export declare function addMember(groupId: string, inviterId: string, userId: string, role?: GroupRole): Promise<GroupMember | null>;
/**
 * Remove a member from a group
 */
export declare function removeMember(groupId: string, actorId: string, userId: string, reason?: string): Promise<void>;
/**
 * Update member role
 */
export declare function updateMemberRole(groupId: string, actorId: string, userId: string, newRole: GroupRole): Promise<void>;
/**
 * Mute a member
 */
export declare function muteMember(groupId: string, actorId: string, userId: string, durationMinutes?: number): Promise<void>;
/**
 * Ban a member
 */
export declare function banMember(groupId: string, actorId: string, userId: string, reason?: string): Promise<void>;
/**
 * Get group members with roles
 */
export declare function getGroupMembers(groupId: string, userId: string): Promise<GroupMember[]>;
/**
 * Validate user can send message in group
 */
export declare function canSendMessage(groupId: string, userId: string): Promise<{
    allowed: boolean;
    reason?: string;
}>;
export declare const groupChatService: {
    hasPermission: typeof hasPermission;
    validatePermission: typeof validatePermission;
    enforcePermission: typeof enforcePermission;
    createGroup: typeof createGroup;
    addMember: typeof addMember;
    removeMember: typeof removeMember;
    updateMemberRole: typeof updateMemberRole;
    muteMember: typeof muteMember;
    banMember: typeof banMember;
    getGroupMembers: typeof getGroupMembers;
    canSendMessage: typeof canSendMessage;
};
//# sourceMappingURL=group-chat.service.d.ts.map