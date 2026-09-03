import { prisma } from './prisma';

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
    await prisma.userSafetySettings.create({
      data: { userId, blockedUsers: [blockedUserId] },
    });
  }

  return { created: true };
}

export async function unblockUser(userId: string, blockedUserId: string): Promise<void> {
  const settings = await prisma.userSafetySettings.findUnique({
    where: { userId },
    select: { blockedUsers: true },
  });

  if (!settings || !settings.blockedUsers.includes(blockedUserId)) {
    return;
  }

  await prisma.userSafetySettings.update({
    where: { userId },
    data: { blockedUsers: { set: settings.blockedUsers.filter((id) => id !== blockedUserId) } },
  });
}
