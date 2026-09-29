/**
 * A block closes a profile.
 *
 * The public shortcut in profileAccess used to answer before anything asked
 * about blocks, so a man a member had blocked could still read her full
 * profile — her real name, city, employer, education and work history — as
 * long as she had left it public. Both block stores are read, in both
 * directions, and a lookup that fails is an error rather than "not blocked".
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    userSafetySettings: { findUnique: jest.fn(), findMany: jest.fn() },
    dvSafetyProfile: { findFirst: jest.fn() },
    follow: { findUnique: jest.fn() },
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  redactSensitive: (value: unknown) => value,
}));

import { canViewAuthor, profileAccess } from '../audience.service';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma = prismaTyped as unknown as {
  userSafetySettings: { findUnique: jest.Mock; findMany: jest.Mock };
  dvSafetyProfile: { findFirst: jest.Mock };
  follow: { findUnique: jest.Mock };
};

describe('profileAccess and blocks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // A public profile, nobody blocked, nobody following.
    prisma.userSafetySettings.findUnique.mockImplementation(async () => null);
    prisma.userSafetySettings.findMany.mockImplementation(async () => []);
    prisma.dvSafetyProfile.findFirst.mockImplementation(async () => null);
    prisma.follow.findUnique.mockImplementation(async () => null);
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
