/**
 * A block closes a profile, and so does Safe Mode.
 *
 * The public shortcut in profileAccess used to answer before anything asked
 * about blocks, so a man a member had blocked could still read her full
 * profile — her real name, city, employer, education and work history — as
 * long as she had left it public. Both block stores are read, in both
 * directions, and a lookup that fails is an error rather than "not blocked".
 *
 * A woman in Safe Mode is discreet. Her profile visibility is a separate
 * setting that Safe Mode never touched, so a link to her profile went on
 * showing everything to anyone who held her id.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    userSafetySettings: { findUnique: jest.fn(), findMany: jest.fn() },
    dvSafetyProfile: { findFirst: jest.fn() },
    follow: { findUnique: jest.fn(), findFirst: jest.fn() },
    user: { findFirst: jest.fn() },
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  redactSensitive: (value: unknown) => value,
}));

import { approvesFollowers, canViewAuthor, isDiscreet, mayBeShownMember, profileAccess } from '../audience.service';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma = prismaTyped as unknown as {
  userSafetySettings: { findUnique: jest.Mock; findMany: jest.Mock };
  dvSafetyProfile: { findFirst: jest.Mock };
  follow: { findUnique: jest.Mock; findFirst: jest.Mock };
  user: { findFirst: jest.Mock };
};

describe('profileAccess and blocks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // A public profile, nobody blocked, nobody following, nobody in Safe Mode.
    prisma.userSafetySettings.findUnique.mockImplementation(async () => null);
    prisma.userSafetySettings.findMany.mockImplementation(async () => []);
    prisma.dvSafetyProfile.findFirst.mockImplementation(async () => null);
    prisma.follow.findUnique.mockImplementation(async () => null);
    prisma.follow.findFirst.mockImplementation(async () => null);
    prisma.user.findFirst.mockImplementation(async () => null);
  });

  it('a public profile is open to someone with no block either way', async () => {
    await expect(profileAccess('viewer', 'her')).resolves.toMatchObject({ access: 'full' });
  });

  it('a platform block in either direction closes a public profile', async () => {
    prisma.userSafetySettings.findMany.mockImplementation(async () => [{ userId: 'her' }]);

    await expect(profileAccess('viewer', 'her')).resolves.toEqual({
      visibility: 'public',
      access: 'closed',
      isFollower: false,
    });
    await expect(canViewAuthor('viewer', 'her')).resolves.toBe(false);

    const where = prisma.userSafetySettings.findMany.mock.calls[0][0] as { where: { OR: unknown[] } };
    expect(where.where.OR).toEqual([
      { userId: 'viewer', blockedUsers: { has: 'her' } },
      { userId: 'her', blockedUsers: { has: 'viewer' } },
    ]);
  });

  it('a block made from her DV safety page closes it too, before it reaches the platform list', async () => {
    prisma.dvSafetyProfile.findFirst.mockImplementation(async () => ({ userId: 'her' }));

    await expect(profileAccess('viewer', 'her')).resolves.toMatchObject({ access: 'closed' });

    expect(prisma.dvSafetyProfile.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [
          { userId: 'viewer', blockedUserIds: { has: 'her' } },
          { userId: 'her', blockedUserIds: { has: 'viewer' } },
        ],
      },
      select: { userId: true },
    });
  });

  it('a block lookup that fails is an error, not an open profile', async () => {
    prisma.dvSafetyProfile.findFirst.mockImplementation(async () => {
      throw new Error('database unavailable');
    });

    await expect(profileAccess('viewer', 'her')).rejects.toThrow('database unavailable');
  });

  it('her own profile is always open to her, and a signed-out visitor is not checked for blocks', async () => {
    await expect(profileAccess('her', 'her')).resolves.toMatchObject({ access: 'full' });
    await expect(profileAccess(undefined, 'her')).resolves.toMatchObject({ access: 'full' });
    expect(prisma.dvSafetyProfile.findFirst).not.toHaveBeenCalled();
  });
});

describe('profileAccess and Safe Mode', () => {
  /** Members in Safe Mode, and the followers each has, with whether the follower has passed the women-only check. */
  let safeMode: Set<string>;
  let followers: Array<{ followerId: string; followingId: string; verified: boolean }>;

  beforeEach(() => {
    jest.clearAllMocks();
    safeMode = new Set(['her']);
    followers = [];
    prisma.userSafetySettings.findUnique.mockImplementation(async () => null);
    prisma.userSafetySettings.findMany.mockImplementation(async () => []);
    prisma.dvSafetyProfile.findFirst.mockImplementation(async () => null);
    prisma.follow.findUnique.mockImplementation(async (args: any) => {
      const { followerId, followingId } = args.where.followerId_followingId;
      return followers.some((f) => f.followerId === followerId && f.followingId === followingId) ? { followerId } : null;
    });
    // Answers as the database would for the clause the service sends: a row
    // only when the follower is the viewer, follows the target and is verified.
    prisma.follow.findFirst.mockImplementation(async (args: any) => {
      const { followingId, followerId, follower } = args.where;
      const hit = followers.find(
        (f) => f.followingId === followingId && f.followerId === followerId && (follower?.womanVerificationStatus !== 'VERIFIED' || f.verified)
      );
      return hit ? { followerId: hit.followerId } : null;
    });
    prisma.user.findFirst.mockImplementation(async (args: any) => (safeMode.has(args.where.id) ? { id: args.where.id } : null));
  });

  it('closes a public profile in Safe Mode to a stranger', async () => {
    await expect(profileAccess('stranger', 'her')).resolves.toEqual({ visibility: 'public', access: 'closed', isFollower: false });
    await expect(canViewAuthor('stranger', 'her')).resolves.toBe(false);
  });

  it('asks about Safe Mode in both places it is stored', async () => {
    await profileAccess('stranger', 'her');

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'her',
        OR: [{ dvSafetyProfile: { is: { isSafeMode: true } } }, { profile: { is: { isSafeMode: true } } }],
      },
      select: { id: true },
    });
  });

  it('closes it to a signed-out visitor too, who is a stranger to her as much as anyone', async () => {
    await expect(profileAccess(undefined, 'her')).resolves.toMatchObject({ access: 'closed' });
  });

  it('closes it, rather than showing the limited card, to a follower who has not passed the women-only check', async () => {
    followers = [{ followerId: 'friend', followingId: 'her', verified: false }];

    const answer = await profileAccess('friend', 'her');

    // The limited card is the name, picture, headline and city that Safe Mode withholds.
    expect(answer).toEqual({ visibility: 'public', access: 'closed', isFollower: false });
  });

  it('opens it to a follower she approved who has passed the women-only check', async () => {
    followers = [{ followerId: 'friend', followingId: 'her', verified: true }];

    await expect(profileAccess('friend', 'her')).resolves.toMatchObject({ visibility: 'public', access: 'full' });
    await expect(canViewAuthor('friend', 'her')).resolves.toBe(true);
  });

  it('asks for the verified follower in the query itself', async () => {
    followers = [{ followerId: 'friend', followingId: 'her', verified: true }];

    await profileAccess('friend', 'her');

    expect(prisma.follow.findFirst).toHaveBeenCalledWith({
      where: { followingId: 'her', followerId: 'friend', follower: { womanVerificationStatus: 'VERIFIED' } },
      select: { followerId: true },
    });
  });

  it('is full for herself and for a member who is not in Safe Mode, exactly as before', async () => {
    await expect(profileAccess('her', 'her')).resolves.toMatchObject({ access: 'full', isFollower: true });
    await expect(profileAccess('stranger', 'plain')).resolves.toMatchObject({ access: 'full' });
    // Herself is not asked about: the question is for a stranger at her door.
    expect(prisma.user.findFirst).toHaveBeenCalledTimes(1);
  });

  it('still honours a block for a verified connection, and a private profile stays closed to her too', async () => {
    followers = [{ followerId: 'friend', followingId: 'her', verified: true }];
    prisma.dvSafetyProfile.findFirst.mockImplementation(async () => ({ userId: 'her' }));
    await expect(profileAccess('friend', 'her')).resolves.toMatchObject({ access: 'closed' });

    prisma.dvSafetyProfile.findFirst.mockImplementation(async () => null);
    prisma.userSafetySettings.findUnique.mockImplementation(async () => ({ profileVisibility: 'private' }));
    await expect(profileAccess('friend', 'her')).resolves.toMatchObject({ visibility: 'private', access: 'closed' });
  });

  it('a lookup that cannot say whether she is in Safe Mode is an error, never an open profile', async () => {
    prisma.user.findFirst.mockImplementation(async () => {
      throw new Error('database unavailable');
    });

    await expect(profileAccess('stranger', 'her')).rejects.toThrow('database unavailable');
    await expect(isDiscreet('her')).rejects.toThrow('database unavailable');
  });

  it('following a member in Safe Mode needs her approval, whatever her profile visibility says', async () => {
    // Public visibility (no settings row), but in Safe Mode.
    await expect(approvesFollowers('her')).resolves.toBe(true);
    await expect(approvesFollowers('plain')).resolves.toBe(false);
  });

  it('answers the single-item question the reels routes ask', async () => {
    followers = [{ followerId: 'friend', followingId: 'her', verified: true }];

    await expect(mayBeShownMember('stranger', 'her')).resolves.toBe(false);
    await expect(mayBeShownMember(undefined, 'her')).resolves.toBe(false);
    await expect(mayBeShownMember('friend', 'her')).resolves.toBe(true);
    await expect(mayBeShownMember('her', 'her')).resolves.toBe(true);
    await expect(mayBeShownMember('stranger', 'plain')).resolves.toBe(true);
  });
});
