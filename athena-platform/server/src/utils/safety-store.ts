import { prisma } from './prisma';
import { DEFAULT_MESSAGE_AUDIENCE } from '../services/message-permissions.service';

export interface BlockedUserRecord {
  id: string;
  blockedUserId: string;
  createdAt: string;
}

// Blocks live on UserSafetySettings.blockedUsers. Every read and write of that
// array goes through this module so callers never have to know the shape, and
// so enforcement always sees the same list the Safety Center shows.

export async function getBlockedUserIds(userId: string): Promise<string[]> {
  const settings = await prisma.userSafetySettings.findUnique({
    where: { userId },
    select: { blockedUsers: true },
  });

  return settings?.blockedUsers ?? [];
}

export async function listBlockedUsers(userId: string): Promise<BlockedUserRecord[]> {
  const settings = await prisma.userSafetySettings.findUnique({
    where: { userId },
    select: { blockedUsers: true, updatedAt: true },
  });

  if (!settings) {
    return [];
  }

  // The array carries no per-entry timestamp, so the only date we can report is
  // the last time the list itself changed.
  const changedAt = settings.updatedAt.toISOString();

  return settings.blockedUsers.map((blockedUserId) => ({
    id: blockedUserId,
    blockedUserId,
    createdAt: changedAt,
  }));
}

/**
 * Every user whose content must be hidden from this user: the ones they blocked
 * and the ones who blocked them. Blocking is symmetric, so enforcement points
 * only ever need this one list.
 */
export async function getBlockedRelationshipIds(userId: string): Promise<string[]> {
  const [own, blockedBy] = await Promise.all([
    prisma.userSafetySettings.findUnique({
      where: { userId },
      select: { blockedUsers: true },
    }),
    prisma.userSafetySettings.findMany({
      where: { blockedUsers: { has: userId } },
      select: { userId: true },
    }),
  ]);

  return Array.from(new Set([...(own?.blockedUsers ?? []), ...blockedBy.map((row) => row.userId)]));
}

export async function isBlockedRelationship(userId: string, otherUserId: string): Promise<boolean> {
  if (userId === otherUserId) {
    return false;
  }

  const rows = await prisma.userSafetySettings.findMany({
    where: {
      OR: [
        { userId, blockedUsers: { has: otherUserId } },
        { userId: otherUserId, blockedUsers: { has: userId } },
      ],
    },
    select: { userId: true },
    take: 1,
  });

  return rows.length > 0;
}

export async function blockUser(userId: string, blockedUserId: string): Promise<{ created: boolean }> {
  const settings = await prisma.userSafetySettings.findUnique({
    where: { userId },
    select: { blockedUsers: true },
  });

  if (settings?.blockedUsers.includes(blockedUserId)) {
    return { created: false };
  }

  if (settings) {
    await prisma.userSafetySettings.update({
      where: { userId },
      data: { blockedUsers: { push: blockedUserId } },
    });
  } else {
    // The audience is named, not left to the column default: a member who blocks
    // someone has not chosen who else may write to her, and the default of the
    // column ('connections') is not what the server does for a member with no
    // row (message-permissions.service).
    await prisma.userSafetySettings.create({
      data: { userId, blockedUsers: [blockedUserId], allowMessagesFrom: DEFAULT_MESSAGE_AUDIENCE },
    });
  }

  await severTies(userId, blockedUserId);

  return { created: true };
}

/**
 * Blocking ends the relationship in both directions: neither follows the
 * other, no follow request stays pending, neither is on the other's
 * close-friends list, and neither is on the guest list of an event the other
 * hosts (the list names each registrant to the host, and a registration is what
 * gives a member the joining link of a member's event). Best-effort, so a
 * failure here never undoes the block.
 */
export async function severTies(userId: string, otherUserId: string): Promise<void> {
  const pair = [
    { a: userId, b: otherUserId },
    { a: otherUserId, b: userId },
  ];
  try {
    await Promise.all([
      prisma.follow.deleteMany({
        where: { OR: pair.map(({ a, b }) => ({ followerId: a, followingId: b })) },
      }),
      prisma.followRequest.deleteMany({
        where: { OR: pair.map(({ a, b }) => ({ requesterId: a, targetId: b })) },
      }),
      prisma.closeFriend.deleteMany({
        where: { OR: pair.map(({ a, b }) => ({ userId: a, friendId: b })) },
      }),
      prisma.eventRegistration.deleteMany({
        where: { OR: pair.map(({ a, b }) => ({ userId: a, event: { hostUserId: b } })) },
      }),
    ]);
  } catch {
    // The block itself is already recorded; the rest is hygiene.
  }
}

/**
 * Lifts a block from both places a block can be written.
 *
 * The Safety Centre writes the platform-wide list (UserSafetySettings), and the
 * DV safety page writes it too and then mirrors the member into her DV safety
 * profile (DvSafetyProfile.blockedUserIds). Unblocking used to edit only the
 * first. The second kept the person: search, the feeds, reels and profiles went
 * on hiding her from the woman who had unblocked her, and anything that read
 * only the platform list let her back in, so the two answered differently about
 * the same pair of people. A block she has lifted is lifted in both, and the
 * second half runs even when the first found nothing to do, so a block left in
 * the DV list alone (a mirror that was written and a platform write that was not)
 * can still be lifted from here and a retry after a failure finishes the job.
 */
export async function unblockUser(userId: string, blockedUserId: string): Promise<void> {
  const settings = await prisma.userSafetySettings.findUnique({
    where: { userId },
    select: { blockedUsers: true },
  });

  if (settings?.blockedUsers.includes(blockedUserId)) {
    await prisma.userSafetySettings.update({
      where: { userId },
      data: { blockedUsers: { set: settings.blockedUsers.filter((id) => id !== blockedUserId) } },
    });
  }

  const dv = await prisma.dvSafetyProfile.findUnique({
    where: { userId },
    select: { blockedUserIds: true },
  });

  if (dv?.blockedUserIds.includes(blockedUserId)) {
    await prisma.dvSafetyProfile.update({
      where: { userId },
      data: { blockedUserIds: { set: dv.blockedUserIds.filter((id) => id !== blockedUserId) } },
    });
  }
}
