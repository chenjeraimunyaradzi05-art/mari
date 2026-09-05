/**
 * Who may see whose posts.
 *
 * A member's profile visibility (UserSafetySettings.profileVisibility) decides
 * how far their posts travel and whether following them needs their approval:
 *
 *   public       anyone; following is immediate
 *   connections  followers only; following needs approval; others see a
 *                limited profile with a "request to follow" button
 *   private      the member alone; the profile is a closed door to everyone
 *                else and nothing of theirs surfaces in anyone's feed
 *
 * Every feed and list route narrows its query with authorAudienceWhere so the
 * rule holds in one place.
 */

import type { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';

export type ProfileVisibility = 'public' | 'connections' | 'private';

export async function profileVisibilityOf(userId: string): Promise<ProfileVisibility> {
  try {
    const row = await prisma.userSafetySettings.findUnique({
      where: { userId },
      select: { profileVisibility: true },
    });
    const value = row?.profileVisibility;
    return value === 'connections' || value === 'private' ? value : 'public';
  } catch {
    return 'public';
  }
}

/** Members who approve their followers are everyone not fully public. */
export async function approvesFollowers(userId: string): Promise<boolean> {
  return (await profileVisibilityOf(userId)) !== 'public';
}

export async function isFollower(viewerId: string, targetId: string): Promise<boolean> {
  if (viewerId === targetId) return true;
  const row = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: viewerId, followingId: targetId } },
    select: { followerId: true },
  });
  return Boolean(row);
}

/**
 * What a viewer may see of a member's profile and posts.
 *   full     everything
 *   limited  name, picture, headline, counts and a request-to-follow button
 *   closed   nothing beyond "this profile is private"
 */
export async function profileAccess(
  viewerId: string | undefined,
  targetId: string
): Promise<{ visibility: ProfileVisibility; access: 'full' | 'limited' | 'closed'; isFollower: boolean }> {
  const visibility = await profileVisibilityOf(targetId);
  if (viewerId === targetId) return { visibility, access: 'full', isFollower: true };
  if (visibility === 'public') return { visibility, access: 'full', isFollower: false };
  const follower = viewerId ? await isFollower(viewerId, targetId) : false;
  if (visibility === 'private') return { visibility, access: 'closed', isFollower: follower };
  return { visibility, access: follower ? 'full' : 'limited', isFollower: follower };
}

/**
 * Prisma filter for posts whose author the viewer is allowed to read:
 * public authors, the viewer's own posts, and connections-only authors the
 * viewer follows. Private authors never surface.
 */
export function authorAudienceWhere(viewerId?: string, followingIds: string[] = []): Prisma.PostWhereInput {
  const allowed: Prisma.PostWhereInput[] = [
    { author: { safetySettings: { is: null } } },
    { author: { safetySettings: { is: { profileVisibility: 'public' } } } },
  ];
  if (viewerId) allowed.push({ authorId: viewerId });
  const followed = followingIds.filter((id) => id !== viewerId);
  if (followed.length > 0) {
    allowed.push({
      authorId: { in: followed },
      author: { safetySettings: { is: { profileVisibility: 'connections' } } },
    });
  }
  // A group's posts stay on the group's page.
  return { groupId: null, OR: allowed };
}

/**
 * Whether a viewer may read a group's posts: anyone for a public group,
 * members (and admins) for a private one. Null groupId means not a group post.
 */
export async function canViewGroupPosts(viewerId: string | undefined, groupId: string | null | undefined, isAdmin = false): Promise<boolean> {
  if (!groupId) return true;
  if (isAdmin) return true;
  try {
    const group = await prisma.group.findUnique({ where: { id: groupId }, select: { privacy: true, isHidden: true } });
    if (!group || group.isHidden) return false;
    if (String(group.privacy).toUpperCase() !== 'PRIVATE') return true;
    if (!viewerId) return false;
    const member = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: viewerId } },
      select: { isBanned: true },
    });
    return Boolean(member) && !member!.isBanned;
  } catch {
    return false;
  }
}

/** The ids the viewer follows, for authorAudienceWhere. */
export async function followingIdsOf(viewerId?: string): Promise<string[]> {
  if (!viewerId) return [];
  try {
    const rows = await prisma.follow.findMany({ where: { followerId: viewerId }, select: { followingId: true } });
    return Array.isArray(rows) ? rows.map((r) => r.followingId) : [];
  } catch {
    return [];
  }
}

/** Whether a single post's author is within the viewer's audience. */
export async function canViewAuthor(viewerId: string | undefined, authorId: string): Promise<boolean> {
  if (viewerId === authorId) return true;
  const { access } = await profileAccess(viewerId, authorId);
  return access === 'full';
}
