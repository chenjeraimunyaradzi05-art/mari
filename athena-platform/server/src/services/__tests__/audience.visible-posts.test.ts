/**
 * The one rule for who may be shown a post, and who is on either side of a block.
 *
 * Every list of posts, reels and messages narrows its query with these, so the
 * rule is written once. The clauses are run over a small world in
 * tests/post-visibility.test.ts and tests/search.routes.test.ts; these pin the
 * parts that are about the shape of an answer: which ids a block names, in which
 * store and which direction, and that a lookup that fails fails the request
 * rather than answering with nobody blocked.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    userSafetySettings: { findUnique: jest.fn(), findMany: jest.fn() },
    dvSafetyProfile: { findUnique: jest.fn(), findMany: jest.fn() },
    user: { findMany: jest.fn() },
    follow: { findMany: jest.fn() },
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  redactSensitive: (value: unknown) => value,
}));

import {
  authorAudienceWhere,
  authorVisibleWhere,
  authorsHiddenFrom,
  blockedEitherWayIds,
  groupPostReadableWhere,
  mayBeShownToWhere,
  postsShownToWhere,
  visiblePostWhere,
} from '../audience.service';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma = prismaTyped as unknown as {
  userSafetySettings: { findUnique: jest.Mock; findMany: jest.Mock };
  dvSafetyProfile: { findUnique: jest.Mock; findMany: jest.Mock };
  user: { findMany: jest.Mock };
  follow: { findMany: jest.Mock };
};

beforeEach(() => {
  jest.resetAllMocks();
  prisma.userSafetySettings.findUnique.mockImplementation(async () => null);
  prisma.userSafetySettings.findMany.mockImplementation(async () => []);
  prisma.dvSafetyProfile.findUnique.mockImplementation(async () => null);
  prisma.dvSafetyProfile.findMany.mockImplementation(async () => []);
  prisma.user.findMany.mockImplementation(async () => []);
  prisma.follow.findMany.mockImplementation(async () => []);
});

describe('blockedEitherWayIds', () => {
  it('is empty when nobody is blocked either way', async () => {
    await expect(blockedEitherWayIds('her')).resolves.toEqual([]);
  });

  it('names everyone on either side of a block, in both stores, once each', async () => {
    prisma.userSafetySettings.findUnique.mockImplementation(async () => ({ blockedUsers: ['him', 'both'] }));
    prisma.userSafetySettings.findMany.mockImplementation(async () => [{ userId: 'blocked-her' }, { userId: 'both' }]);
    prisma.dvSafetyProfile.findUnique.mockImplementation(async () => ({ blockedUserIds: ['dv-only', 'him'] }));
    prisma.dvSafetyProfile.findMany.mockImplementation(async () => [{ userId: 'dv-blocked-her' }]);

    const ids = await blockedEitherWayIds('her');

    expect([...ids].sort()).toEqual(['blocked-her', 'both', 'dv-blocked-her', 'dv-only', 'him']);
  });

  it('reads the DV profile in the direction the id list cannot name: whoever lists her', async () => {
    await blockedEitherWayIds('her');

    expect((prisma.dvSafetyProfile.findMany.mock.calls[0][0] as any).where).toEqual({ blockedUserIds: { has: 'her' } });
    expect((prisma.userSafetySettings.findMany.mock.calls[0][0] as any).where).toEqual({ blockedUsers: { has: 'her' } });
  });

  it('never names her to herself', async () => {
    prisma.userSafetySettings.findUnique.mockImplementation(async () => ({ blockedUsers: ['her', 'him'] }));

    await expect(blockedEitherWayIds('her')).resolves.toEqual(['him']);
  });

  it.each(['userSafetySettings.findMany', 'dvSafetyProfile.findMany', 'dvSafetyProfile.findUnique'])(
    'fails, rather than answering with nobody blocked, when %s fails',
    async (call) => {
      const [model, method] = call.split('.') as ['userSafetySettings' | 'dvSafetyProfile', 'findMany' | 'findUnique'];
      prisma[model][method].mockImplementation(async () => {
        throw new Error('connection reset');
      });

      await expect(blockedEitherWayIds('her')).rejects.toThrow('connection reset');
    }
  );
});

describe('visiblePostWhere', () => {
  it('asks for a post that is not hidden, is public or hers, and whose author lets her read it', () => {
    expect(visiblePostWhere('her', ['mei'])).toEqual({
      AND: [
        { isHidden: false },
        { OR: [{ isPublic: true }, { authorId: 'her' }] },
        authorAudienceWhere('her', ['mei']),
      ],
    });
  });

  it('asks only for public posts when nobody is signed in', () => {
    expect(visiblePostWhere(undefined)).toEqual({
      AND: [{ isHidden: false }, { OR: [{ isPublic: true }] }, authorAudienceWhere(undefined, [])],
    });
  });

  it('keeps the audience rule in its own AND clause, so a caller adding an authorId or a type cannot replace it', () => {
    const where = visiblePostWhere('her', ['mei']);

    expect(Object.keys(where)).toEqual(['AND']);
    expect(Array.isArray(where.AND)).toBe(true);
  });
});

describe('authorVisibleWhere', () => {
  const audienceOf = (where: any) => where.AND[0].OR;

  it('lets a stranger see an author with no settings row or a public profile, and nobody else', () => {
    expect(audienceOf(authorVisibleWhere(undefined))).toEqual([
      { safetySettings: { is: null } },
      { safetySettings: { is: { profileVisibility: 'public' } } },
    ]);
  });

  it('adds herself, and a connections-only author she follows, for a signed-in viewer', () => {
    expect(audienceOf(authorVisibleWhere('her'))).toEqual([
      { safetySettings: { is: null } },
      { safetySettings: { is: { profileVisibility: 'public' } } },
      { id: 'her' },
      { safetySettings: { is: { profileVisibility: 'connections' } }, followers: { some: { followerId: 'her' } } },
    ]);
  });

  it('has Safe Mode’s rule beside it, so a discreet member is shown only to her connections', () => {
    expect(authorVisibleWhere('her').AND).toContainEqual(mayBeShownToWhere('her'));
    expect(authorVisibleWhere(undefined).AND).toContainEqual(mayBeShownToWhere(undefined));
  });

  it('names no private profile in any branch: a private author is never shown', () => {
    expect(JSON.stringify(audienceOf(authorVisibleWhere('her')))).not.toContain('private');
  });
});

describe('authorsHiddenFrom', () => {
  it('asks nothing for nobody, or for the viewer’s own id', async () => {
    await expect(authorsHiddenFrom('her', [])).resolves.toEqual(new Set());
    await expect(authorsHiddenFrom('her', ['her', ''])).resolves.toEqual(new Set());

    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('hides an author the audience rule leaves out, and one across a block, and no one else', async () => {
    prisma.user.findMany.mockImplementation(async () => [{ id: 'open' }, { id: 'blocked' }]);
    prisma.userSafetySettings.findUnique.mockImplementation(async () => ({ blockedUsers: ['blocked'] }));

    const hidden = await authorsHiddenFrom('her', ['open', 'closed', 'blocked']);

    expect([...hidden].sort()).toEqual(['blocked', 'closed']);
    expect((prisma.user.findMany.mock.calls[0][0] as any).where).toEqual({
      id: { in: ['open', 'closed', 'blocked'] },
      ...authorVisibleWhere('her'),
    });
  });

  it('reads no block list for a signed-out viewer', async () => {
    prisma.user.findMany.mockImplementation(async () => [{ id: 'open' }]);

    const hidden = await authorsHiddenFrom(undefined, ['open', 'closed']);

    expect([...hidden]).toEqual(['closed']);
    expect(prisma.userSafetySettings.findUnique).not.toHaveBeenCalled();
  });
});

describe('groupPostReadableWhere and postsShownToWhere', () => {
  it('opens a public group to anyone, and a private one only to a member who has not been banned', () => {
    expect(groupPostReadableWhere(undefined)).toEqual({
      groupId: { not: null },
      group: { isHidden: false, OR: [{ privacy: { not: 'PRIVATE' } }] },
    });
    expect(groupPostReadableWhere('her')).toEqual({
      groupId: { not: null },
      group: {
        isHidden: false,
        OR: [{ privacy: { not: 'PRIVATE' } }, { members: { some: { userId: 'her', isBanned: false } } }],
      },
    });
  });

  it('shows community posts by the audience rule and group posts by the group’s, and blocks hold in both', async () => {
    prisma.userSafetySettings.findUnique.mockImplementation(async () => ({ blockedUsers: ['him'] }));
    prisma.dvSafetyProfile.findMany.mockImplementation(async () => [{ userId: 'dv-blocked-her' }]);
    prisma.follow.findMany.mockImplementation(async () => [{ followingId: 'mei' }]);

    const where: any = await postsShownToWhere('her');

    expect([...where.AND[0].authorId.notIn].sort()).toEqual(['dv-blocked-her', 'him']);
    expect(where.AND[1].OR[0]).toEqual(visiblePostWhere('her', ['mei']));
    expect(where.AND[1].OR[1].AND).toContainEqual(groupPostReadableWhere('her'));
  });

  it('asks for no block clause when nobody is blocked', async () => {
    const where: any = await postsShownToWhere('her');

    expect(where.AND).toHaveLength(1);
    expect(where.AND[0].OR).toHaveLength(2);
  });
});
