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
import { bestEffort } from '../utils/best-effort';

export type ProfileVisibility = 'public' | 'connections' | 'private';

/**
 * A member's own setting, or 'public' for the many members who have never
 * opened the safety page and so have no row at all.
 *
 * When the lookup itself fails the answer is 'public' as well, and that is a
 * deliberately fail-OPEN decision: an error here widens a member's audience
 * instead of narrowing it, so that one unavailable table does not empty every
 * feed on the platform. That decision is left exactly as it was; what it never
 * did was admit to itself. The catch discarded the reason, so this lookup
 * could have been failing for every member at once — showing the profiles and
 * posts of people who had set themselves to connections-only or private to
 * anyone who asked — and the first sign of it would have been one of them
 * noticing. bestEffort keeps the 'public' answer and puts the failure in the
 * log, which is the only way anyone finds out that the openness being served
 * is an error rather than a setting.
 */
export async function profileVisibilityOf(userId: string): Promise<ProfileVisibility> {
  return bestEffort(
    'audience.profile-visibility-lookup',
    async () => {
      const row = await prisma.userSafetySettings.findUnique({
        where: { userId },
        select: { profileVisibility: true },
      });
      const value = row?.profileVisibility;
      return value === 'connections' || value === 'private' ? value : 'public';
    },
    'public'
  );
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
 *
 * A failed lookup answers false, and unlike profileVisibilityOf above that is
 * fail-CLOSED on purpose: an error here refuses to show posts rather than
 * risking a private group's conversation being shown to someone who was never
 * in it. The cost of the error is a public group looking empty for as long as
 * it lasts, which is the cheaper of the two mistakes and is why it is kept.
 * Until now that was the whole story the log told, which is to say none of it:
 * a membership lookup that was failing was indistinguishable from a member who
 * had been removed from the group, so "I can't see my own group any more" had
 * nothing to be traced back to. bestEffort keeps the refusal and records why.
 */
export async function canViewGroupPosts(viewerId: string | undefined, groupId: string | null | undefined, isAdmin = false): Promise<boolean> {
  if (!groupId) return true;
  if (isAdmin) return true;
  return bestEffort(
    'audience.group-post-visibility-check',
    async () => {
      const group = await prisma.group.findUnique({ where: { id: groupId }, select: { privacy: true, isHidden: true } });
      if (!group || group.isHidden) return false;
      if (String(group.privacy).toUpperCase() !== 'PRIVATE') return true;
      if (!viewerId) return false;
      const member = await prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId: viewerId } },
        select: { isBanned: true },
      });
      return Boolean(member) && !member!.isBanned;
    },
    false
  );
}

/**
 * The ids the viewer follows, for authorAudienceWhere.
 *
 * The empty list on failure is fail-CLOSED in the same way: with nobody
 * followed, authorAudienceWhere keeps public authors and the viewer's own
 * posts and drops the connections-only ones, so an error loses posts rather
 * than showing posts to someone outside the author's audience. Kept as it was.
 * What was lost with the error was any way to tell the two apart: a viewer
 * whose feed had quietly dropped every connections-only post she follows read
 * exactly like a viewer who follows nobody, in the database and in the log.
 */
export async function followingIdsOf(viewerId?: string): Promise<string[]> {
  if (!viewerId) return [];
  return bestEffort(
    'audience.following-ids-lookup',
    async () => {
      const rows = await prisma.follow.findMany({ where: { followerId: viewerId }, select: { followingId: true } });
      return Array.isArray(rows) ? rows.map((r) => r.followingId) : [];
    },
    []
  );
}

/** Whether a single post's author is within the viewer's audience. */
export async function canViewAuthor(viewerId: string | undefined, authorId: string): Promise<boolean> {
  if (viewerId === authorId) return true;
  const { access } = await profileAccess(viewerId, authorId);
  return access === 'full';
}
