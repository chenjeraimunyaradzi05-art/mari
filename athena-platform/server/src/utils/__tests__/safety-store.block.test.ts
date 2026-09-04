import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../prisma', () => ({
  prisma: {
    userSafetySettings: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
    follow: { deleteMany: jest.fn(async () => ({ count: 0 })) },
    followRequest: { deleteMany: jest.fn(async () => ({ count: 0 })) },
    closeFriend: { deleteMany: jest.fn(async () => ({ count: 0 })) },
  },
}));

import { prisma as prismaTyped } from '../prisma';
import { blockUser } from '../safety-store';

const prisma: any = prismaTyped;

describe('Blocking ends the relationship both ways', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('records the block and removes follows, requests and close-friend entries in both directions', async () => {
    prisma.userSafetySettings.findUnique.mockResolvedValue({ blockedUsers: [] });
    prisma.userSafetySettings.update.mockResolvedValue({});

    const result = await blockUser('sarah', 'troll');

    expect(result).toEqual({ created: true });
    expect(prisma.userSafetySettings.update.mock.calls[0][0].data).toEqual({ blockedUsers: { push: 'troll' } });
    expect(prisma.follow.deleteMany.mock.calls[0][0].where.OR).toEqual([
      { followerId: 'sarah', followingId: 'troll' },
      { followerId: 'troll', followingId: 'sarah' },
    ]);
    expect(prisma.followRequest.deleteMany.mock.calls[0][0].where.OR).toEqual([
      { requesterId: 'sarah', targetId: 'troll' },
      { requesterId: 'troll', targetId: 'sarah' },
    ]);
    expect(prisma.closeFriend.deleteMany.mock.calls[0][0].where.OR).toEqual([
      { userId: 'sarah', friendId: 'troll' },
      { userId: 'troll', friendId: 'sarah' },
    ]);
  });

  it('a repeated block changes nothing', async () => {
    prisma.userSafetySettings.findUnique.mockResolvedValue({ blockedUsers: ['troll'] });
    expect(await blockUser('sarah', 'troll')).toEqual({ created: false });
    expect(prisma.follow.deleteMany).not.toHaveBeenCalled();
  });
});
