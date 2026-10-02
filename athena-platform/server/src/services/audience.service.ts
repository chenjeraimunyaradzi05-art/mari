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
import { getBlockedRelationshipIds, isBlockedRelationship } from '../utils/safety-store';

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

/**
 * Members who approve their followers are everyone not fully public, and every
 * member in Safe Mode whatever her profile says: an immediate follow would let
 * anyone who held her id become one of the connections her discreet profile is
 * kept for.
 */
export async function approvesFollowers(userId: string): Promise<boolean> {
  if ((await profileVisibilityOf(userId)) !== 'public') return true;
  return isDiscreet(userId);
}

export async function isFollower(viewerId: string, targetId: string): Promise<boolean> {
  if (viewerId === targetId) return true;
  const row = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: viewerId, followingId: targetId } },
    select: { followerId: true },
  });
  return Boolean(row);
}

// ==========================================
// DISCREET MEMBERS
// ==========================================
/*
 * A member in Safe Mode is discreet: hidden from the public, and known only to
 * the connections she has chosen. The blueprint's promise is a profile that is
 * "hidden from the public and searchable only by verified connections", and it
 * was kept for search alone — suggestions, the leaderboard, a link to her
 * profile, her posts in the feed and her reels all went on naming her to
 * strangers, because each asked a different question.
 *
 * The rule is written here, once, so that it is the same wherever it is asked:
 *
 *   discreet            Safe Mode is on, in either of the two places it is
 *                       stored. Hide-from-search alone does not make a member
 *                       discreet: that switch is also the mentor directory's
 *                       "show me" setting, and a mentor who leaves it must not
 *                       lose her profile as a result.
 *   verified connection a member who follows her and has passed the women-only
 *                       check. Following a discreet member always needs her
 *                       approval from the moment she is discreet (see
 *                       approvesFollowers), but whoever followed her before she
 *                       turned Safe Mode on is a follower too and stays a
 *                       connection: no one has been asked to approve them, and
 *                       the platform has no way yet to remove a follower, so a
 *                       block is how she closes the door on one. Which
 *                       conditions the owner wants is a product decision;
 *                       changing it means changing verifiedFollowerWhere and
 *                       nothing else.
 *   herself             always sees herself.
 *
 * Everyone else is told nothing: the profile is closed, her posts and reels do
 * not surface for them, and she is not offered to them by name.
 */

/**
 * Safe Mode, read the way womanGateState and presence.service read it: either
 * the DV safety profile's flag (the DV page and its one-tap switch) or the
 * member profile's (the Safety Centre). A woman who switched it on in either
 * place was told she is protected, and a rule that read one column would keep
 * that promise for half of them.
 */
export const discreetMemberWhere: Prisma.UserWhereInput = {
  OR: [{ dvSafetyProfile: { is: { isSafeMode: true } } }, { profile: { is: { isSafeMode: true } } }],
};

/** Members who are not discreet: the ones any viewer may be shown. */
export const notDiscreetMemberWhere: Prisma.UserWhereInput = { NOT: discreetMemberWhere };

/**
 * Members whose profile is a closed door to everyone else. A list that offers
 * members by name to people who have not looked for them leaves these out.
 */
export const notPrivateProfileWhere: Prisma.UserWhereInput = {
  NOT: { safetySettings: { is: { profileVisibility: 'private' } } },
};

/** The follow rows that make a viewer a verified connection of whoever she follows. */
export function verifiedFollowerWhere(viewerId: string): Prisma.FollowWhereInput {
  return { followerId: viewerId, follower: { womanVerificationStatus: 'VERIFIED' } };
}

/**
 * The members this viewer may be shown: everyone who is not discreet, herself,
 * and the discreet members she is a verified connection of. A User filter, so
 * it serves a list of members and, as `author`, a list of posts or reels.
 */
export function mayBeShownToWhere(viewerId?: string): Prisma.UserWhereInput {
  const shown: Prisma.UserWhereInput = viewerId
    ? { OR: [notDiscreetMemberWhere, { id: viewerId }, { followers: { some: verifiedFollowerWhere(viewerId) } }] }
    : notDiscreetMemberWhere;
  return { AND: [openAccountWhere, shown] };
}

/**
 * An account that is neither suspended nor banned.
 *
 * Both are set by a moderator's decision (admin.routes, content-report.service)
 * and neither touches isActive, which is why every list that asked only
 * `isActive: true` went on offering a suspended member by name and her posts and
 * reels in search, on topic pages and in suggestions, and a banned one too. It is
 * part of the rule for "may this member be shown to this viewer" rather than a
 * clause each list is trusted to add, so a list added later cannot be the one
 * that forgot: a person who was removed for threatening someone does not stay
 * findable by the woman she threatened, and a suspension is not undone by
 * typing the name.
 */
export const openAccountWhere: Prisma.UserWhereInput = { isSuspended: false, bannedAt: null };

/**
 * Whether this member is in Safe Mode. Not best-effort: a lookup that fails
 * throws and the request fails with it, because answering "not discreet" when
 * the answer could not be read is how her profile is handed to a stranger.
 */
export async function isDiscreet(userId: string): Promise<boolean> {
  const row = await prisma.user.findFirst({
    where: { id: userId, ...discreetMemberWhere },
    select: { id: true },
  });
  return Boolean(row);
}

/** Whether the viewer is a follower of the target whom the discreet rule counts as verified. */
export async function isVerifiedConnection(viewerId: string, targetId: string): Promise<boolean> {
  const row = await prisma.follow.findFirst({
    where: { followingId: targetId, ...verifiedFollowerWhere(viewerId) },
    select: { followerId: true },
  });
  return Boolean(row);
}

/**
 * Whether this viewer may be shown this one member's reel or post: always when
 * the member is not discreet, and otherwise only to herself and her verified
 * connections. For the single-item routes; the lists use mayBeShownToWhere.
 */
export async function mayBeShownMember(viewerId: string | undefined, memberId: string): Promise<boolean> {
  if (viewerId === memberId) return true;
  if (!(await isDiscreet(memberId))) return true;
  return viewerId ? isVerifiedConnection(viewerId, memberId) : false;
}

/**
 * Whether this viewer may open a page that is one member's alone by its link: a
 * mentor's page, a creator's. The directories and the searches already leave
 * out a member who hid herself, who is in Safe Mode, or who is on either side of
 * a block with the viewer; the page itself answered anyone holding her id. The
 * caller answers as a page that does not exist, for the same reason the profile
 * and the reel do: a refusal would confirm who she is. Staff reach it through
 * moderation. Not best-effort: a lookup that fails fails the request.
 */
export async function mayOpenMemberPage(
  viewer: { id: string; role?: string } | undefined,
  memberId: string
): Promise<boolean> {
  if (viewer?.role === 'ADMIN') return true;
  if (viewer && (await isBlockedEitherWay(viewer.id, memberId))) return false;
  return mayBeShownMember(viewer?.id, memberId);
}

/**
 * Whether either of two members has blocked the other, in either store.
 *
 * A block is written to the platform-wide list (UserSafetySettings) and, from
 * the DV safety page, to DvSafetyProfile.blockedUserIds as well; the mirror
 * between them is best-effort, so both are read, in both directions. Not
 * best-effort itself: a lookup that fails throws, and the caller's request
 * fails with it, because answering "not blocked" when the answer could not be
 * read is how a blocked man gets back to her profile.
 */
export async function isBlockedEitherWay(userId: string, otherUserId: string): Promise<boolean> {
  if (userId === otherUserId) return false;
  const [platform, dv] = await Promise.all([
    isBlockedRelationship(userId, otherUserId),
    prisma.dvSafetyProfile.findFirst({
      where: {
        OR: [
          { userId, blockedUserIds: { has: otherUserId } },
          { userId: otherUserId, blockedUserIds: { has: userId } },
        ],
      },
      select: { userId: true },
    }),
  ]);
  return platform || Boolean(dv);
}

/**
 * Every member on either side of a block with this one, as a list of ids: the
 * ones she blocked and the ones who blocked her, in the platform-wide list and
 * in the DV safety profile, so a block written to only one of the two stores
 * (the mirror between them is best-effort) still holds.
 *
 * For the places that need the ids themselves rather than a yes or no about one
 * member: the room a message is broadcast to, a list of messages, the
 * reactions on a post. Not best-effort, for the reason isBlockedEitherWay gives:
 * a lookup that fails throws, and an empty list standing in for one that could
 * not be read is how he comes back.
 */
export async function blockedEitherWayIds(userId: string): Promise<string[]> {
  const [platform, dvOwn, dvBlockedBy] = await Promise.all([
    getBlockedRelationshipIds(userId),
    prisma.dvSafetyProfile.findUnique({ where: { userId }, select: { blockedUserIds: true } }),
    prisma.dvSafetyProfile.findMany({ where: { blockedUserIds: { has: userId } }, select: { userId: true } }),
  ]);
  return Array.from(
    new Set([...platform, ...(dvOwn?.blockedUserIds ?? []), ...dvBlockedBy.map((row) => row.userId)])
  ).filter((id) => id !== userId);
}

/**
 * What a viewer may see of a member's profile and posts.
 *   full     everything
 *   limited  name, picture, headline, counts and a request-to-follow button
 *   closed   nothing beyond "this profile is private"
 *
 * A block closes it, whichever of the two pressed block and whatever the
 * profile's visibility. Before, the public shortcut answered first, so a
 * member who had blocked someone still had her full profile read by him:
 * her real name, city, employer, education and work history. The answer for
 * a block is the same "closed" a private profile gets, so the closed door
 * does not also tell him why it is closed.
 *
 * A discreet member's profile is closed in the same way to anyone who is not a
 * verified connection of hers, whatever her profile visibility says. The
 * visibility setting is one a woman may never have opened, and Safe Mode did
 * not touch it, so her profile stayed fully readable to anyone holding her id.
 * Closed rather than limited: the limited card is her name, picture, headline
 * and city, which is what Safe Mode exists to withhold from a stranger. A
 * verified connection is then answered as any member would be, so a private
 * profile is still closed to her too.
 */
export async function profileAccess(
  viewerId: string | undefined,
  targetId: string
): Promise<{ visibility: ProfileVisibility; access: 'full' | 'limited' | 'closed'; isFollower: boolean }> {
  const [visibility, discreet] = await Promise.all([
    profileVisibilityOf(targetId),
    viewerId === targetId ? Promise.resolve(false) : isDiscreet(targetId),
  ]);
  if (viewerId === targetId) return { visibility, access: 'full', isFollower: true };
  if (viewerId && (await isBlockedEitherWay(viewerId, targetId))) {
    return { visibility, access: 'closed', isFollower: false };
  }
  if (discreet && !(viewerId && (await isVerifiedConnection(viewerId, targetId)))) {
    return { visibility, access: 'closed', isFollower: false };
  }
  if (visibility === 'public') return { visibility, access: 'full', isFollower: false };
  const follower = viewerId ? await isFollower(viewerId, targetId) : false;
  if (visibility === 'private') return { visibility, access: 'closed', isFollower: follower };
  return { visibility, access: follower ? 'full' : 'limited', isFollower: follower };
}

/**
 * How much of a member a signed-out visitor may read.
 *
 *   card  her name, picture, headline and counts, and a prompt to sign in for
 *         the rest (the default)
 *   full  everything her profile publishes: employer, education, skills, work
 *         history and links. The behaviour before this setting existed.
 *
 * The profile used to answer every stranger, signed in or not, with the whole
 * record for any member whose profile was public, and a profile is public
 * unless its owner changed it (the column defaults to true). On a platform for
 * women that made every member readable, in bulk, by anyone with a script and
 * a list of ids: her real name, her city, who employs her and where she
 * studied. A scraper no longer needs an account to build that list, and a woman
 * who never opened a privacy setting is not asked to have opened one. A member
 * of the platform still reads the full profile of any public member, so nothing
 * a person signs in for is lost. The card is what a link shared outside the
 * platform shows; the rest is behind the door she walks through to join.
 *
 * Which of the two ATHENA wants is a product and privacy decision, so it is one
 * switch (PUBLIC_PROFILE_DETAIL) and not an edit to this file. An unrecognised
 * value is the cautious one.
 */
export type AnonymousProfileDetail = 'card' | 'full';

export function anonymousProfileDetail(): AnonymousProfileDetail {
  return process.env.PUBLIC_PROFILE_DETAIL?.trim().toLowerCase() === 'full' ? 'full' : 'card';
}

/** Whether this viewer, who is not signed in, is held to the card. */
export function seesOnlyTheCard(viewerId: string | undefined): boolean {
  return !viewerId && anonymousProfileDetail() === 'card';
}

/**
 * Prisma filter for posts whose author the viewer is allowed to read:
 * public authors, the viewer's own posts, and connections-only authors the
 * viewer follows. Private authors never surface.
 *
 * A discreet author's posts surface for her verified connections and for
 * herself and for nobody else, whatever her profile visibility says (see
 * mayBeShownToWhere). That reaches the feed, trending, the cold-start feed and
 * post search together, because each of them narrows its query with this.
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
  return { groupId: null, OR: allowed, AND: [{ author: mayBeShownToWhere(viewerId) }] };
}

/**
 * The one rule for a post to appear in a list that is not its author's own
 * page: not hidden, public (or the viewer's own), and its author within the
 * viewer's audience.
 *
 * authorAudienceWhere answers only the second half of that, who the author
 * lets read her posts. The feeds asked the first half separately, and two of
 * them (the personalised in-network query and the Following tab) did not ask it
 * at all, while the signed-in For You query asked for "public, or by anyone the
 * viewer follows" under a comment that said private posts from followed members
 * were meant to be included. A post whose author had unticked "Post publicly"
 * was therefore shown to every follower, although every route that opens a
 * single post treats it as hers alone. A list built from this cannot forget it.
 *
 * Returned as an AND list, so a caller can add its own keys (an `authorId`, a
 * `type`) without one of them replacing a clause here.
 */
export function visiblePostWhere(viewerId?: string, followingIds: string[] = []): Prisma.PostWhereInput {
  const readable: Prisma.PostWhereInput[] = [{ isPublic: true }];
  if (viewerId) readable.push({ authorId: viewerId });
  return { AND: [{ isHidden: false }, { OR: readable }, authorAudienceWhere(viewerId, followingIds)] };
}

/**
 * The posts of a group a viewer may read: those of a public group, and those of
 * a private one only for a member who has not been banned. A hidden group has
 * none. The query form of canViewGroupPosts, for a list that mixes group posts
 * with the community's.
 */
export function groupPostReadableWhere(viewerId?: string): Prisma.PostWhereInput {
  const readable: Prisma.GroupWhereInput[] = [{ privacy: { not: 'PRIVATE' } }];
  if (viewerId) readable.push({ members: { some: { userId: viewerId, isBanned: false } } });
  return { groupId: { not: null }, group: { isHidden: false, OR: readable } };
}

/**
 * The posts a member may be shown in a list of her own pointing: the ones she
 * saved, the ones that mention her. Both lists were a bare lookup by her id, so
 * a post made private after she saved it, hidden by a moderator, written by
 * someone who has since blocked her (or whom she has blocked), or by a member
 * whose profile is closed to her, stayed in the list with its words, and a
 * private group's post stayed after she left the group.
 *
 * Community posts follow visiblePostWhere. A group's posts follow the group's
 * own rule, and the block still applies inside it: a group is a way round
 * neither a block nor a private post. Not best-effort: if the block lists
 * cannot be read the request fails.
 */
export async function postsShownToWhere(viewerId: string): Promise<Prisma.PostWhereInput> {
  const [blocked, followingIds] = await Promise.all([blockedEitherWayIds(viewerId), followingIdsOf(viewerId)]);
  return {
    AND: [
      ...(blocked.length > 0 ? [{ authorId: { notIn: blocked } }] : []),
      {
        OR: [
          visiblePostWhere(viewerId, followingIds),
          { AND: [{ isHidden: false }, { OR: [{ isPublic: true }, { authorId: viewerId }] }, groupPostReadableWhere(viewerId)] },
        ],
      },
    ],
  };
}

/**
 * The same audience rule as authorAudienceWhere, put to the author instead of
 * to the post, for a list of something that is not a Post: a member's reels, a
 * sound's page, a saved list. Public authors (and the many who have never
 * opened the safety page, so have no settings row), the viewer herself, and the
 * members whose profile is connections-only and who the viewer follows. A
 * private profile never surfaces, and a discreet member follows the Safe Mode
 * rule (mayBeShownToWhere).
 *
 * Followers are read as a relation rather than from a list of ids, so a list of
 * reels needs no round trip to learn who the viewer follows first.
 */
export function authorVisibleWhere(viewerId?: string): Prisma.UserWhereInput {
  const allowed: Prisma.UserWhereInput[] = [
    { safetySettings: { is: null } },
    { safetySettings: { is: { profileVisibility: 'public' } } },
  ];
  if (viewerId) {
    allowed.push({ id: viewerId });
    allowed.push({
      safetySettings: { is: { profileVisibility: 'connections' } },
      followers: { some: { followerId: viewerId } },
    });
  }
  return { AND: [{ OR: allowed }, mayBeShownToWhere(viewerId)] };
}

/**
 * Which of these authors a viewer may NOT be shown, for the places that hold
 * rows already loaded and cannot narrow a query: the original inside a repost,
 * for one. Both halves of the rule: either side of a block, and the audience
 * rule above. The viewer's own id is never in the answer.
 */
export async function authorsHiddenFrom(viewerId: string | undefined, authorIds: string[]): Promise<Set<string>> {
  const ids = Array.from(new Set(authorIds.filter((id) => id && id !== viewerId)));
  if (ids.length === 0) return new Set();
  const [blocked, shown] = await Promise.all([
    viewerId ? blockedEitherWayIds(viewerId) : Promise.resolve([] as string[]),
    prisma.user.findMany({ where: { id: { in: ids }, ...authorVisibleWhere(viewerId) }, select: { id: true } }),
  ]);
  const visible = new Set(shown.map((row) => row.id));
  const blockedSet = new Set(blocked);
  return new Set(ids.filter((id) => blockedSet.has(id) || !visible.has(id)));
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
