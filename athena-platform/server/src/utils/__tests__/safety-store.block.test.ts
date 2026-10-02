import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../prisma', () => ({
  prisma: {
    userSafetySettings: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
    follow: { deleteMany: jest.fn(async () => ({ count: 0 })) },
    followRequest: { deleteMany: jest.fn(async () => ({ count: 0 })) },
    closeFriend: { deleteMany: jest.fn(async () => ({ count: 0 })) },
    eventRegistration: { deleteMany: jest.fn(async () => ({ count: 0 })) },
    dvSafetyProfile: { findUnique: jest.fn(async () => null), update: jest.fn(async () => ({})) },
  },
}));

import { prisma as prismaTyped } from '../prisma';
import { blockUser, unblockUser } from '../safety-store';

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

  it('takes each of them off the guest list of an event the other hosts', async () => {
    // A registration names her to the host and gives her the joining link of a
    // member's event, so a block that left it would leave a way in.
    prisma.userSafetySettings.findUnique.mockResolvedValue({ blockedUsers: [] });
    prisma.userSafetySettings.update.mockResolvedValue({});

    await blockUser('sarah', 'troll');

    expect(prisma.eventRegistration.deleteMany.mock.calls[0][0].where.OR).toEqual([
      { userId: 'sarah', event: { hostUserId: 'troll' } },
      { userId: 'troll', event: { hostUserId: 'sarah' } },
    ]);
  });

  it('is still a block when the tidying fails', async () => {
    prisma.userSafetySettings.findUnique.mockResolvedValue({ blockedUsers: [] });
    prisma.userSafetySettings.update.mockResolvedValue({});
    prisma.eventRegistration.deleteMany.mockRejectedValueOnce(new Error('database unavailable'));

    await expect(blockUser('sarah', 'troll')).resolves.toEqual({ created: true });
  });

  it('a repeated block changes nothing', async () => {
    prisma.userSafetySettings.findUnique.mockResolvedValue({ blockedUsers: ['troll'] });
    expect(await blockUser('sarah', 'troll')).toEqual({ created: false });
    expect(prisma.follow.deleteMany).not.toHaveBeenCalled();
  });
});

describe('Unblocking lifts the block from both lists it can be written to', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.userSafetySettings.update.mockResolvedValue({});
    prisma.dvSafetyProfile.findUnique.mockResolvedValue(null);
    prisma.dvSafetyProfile.update.mockResolvedValue({});
  });

  it('removes the member from the platform list and from her DV safety profile, and nobody else', async () => {
    prisma.userSafetySettings.findUnique.mockResolvedValue({ blockedUsers: ['troll', 'other'] });
    prisma.dvSafetyProfile.findUnique.mockResolvedValue({ blockedUserIds: ['troll', 'another'] });

    await unblockUser('sarah', 'troll');

    expect(prisma.userSafetySettings.update).toHaveBeenCalledWith({
      where: { userId: 'sarah' },
      data: { blockedUsers: { set: ['other'] } },
    });
    expect(prisma.dvSafetyProfile.update).toHaveBeenCalledWith({
      where: { userId: 'sarah' },
      data: { blockedUserIds: { set: ['another'] } },
    });
  });

  it('still lifts a block that is in the DV list alone', async () => {
    // The mirror between the two lists is best effort in one direction, and the
    // DV page used to write its own list first, so a block can exist in only one.
    prisma.userSafetySettings.findUnique.mockResolvedValue({ blockedUsers: [] });
    prisma.dvSafetyProfile.findUnique.mockResolvedValue({ blockedUserIds: ['troll'] });

    await unblockUser('sarah', 'troll');

    expect(prisma.userSafetySettings.update).not.toHaveBeenCalled();
    expect(prisma.dvSafetyProfile.update).toHaveBeenCalledWith({
      where: { userId: 'sarah' },
      data: { blockedUserIds: { set: [] } },
    });
  });

  it('touches neither list for someone she had not blocked', async () => {
    prisma.userSafetySettings.findUnique.mockResolvedValue({ blockedUsers: ['other'] });
    prisma.dvSafetyProfile.findUnique.mockResolvedValue({ blockedUserIds: ['another'] });

    await unblockUser('sarah', 'troll');

    expect(prisma.userSafetySettings.update).not.toHaveBeenCalled();
    expect(prisma.dvSafetyProfile.update).not.toHaveBeenCalled();
  });

  it('copes with a member who has neither a settings row nor a DV safety profile', async () => {
    prisma.userSafetySettings.findUnique.mockResolvedValue(null);

    await expect(unblockUser('sarah', 'troll')).resolves.toBeUndefined();

    expect(prisma.userSafetySettings.update).not.toHaveBeenCalled();
    expect(prisma.dvSafetyProfile.update).not.toHaveBeenCalled();
  });

  it('can be run again after the second list failed, and finishes the job', async () => {
    prisma.userSafetySettings.findUnique.mockResolvedValueOnce({ blockedUsers: ['troll'] });
    prisma.dvSafetyProfile.findUnique.mockResolvedValue({ blockedUserIds: ['troll'] });
    prisma.dvSafetyProfile.update.mockRejectedValueOnce(new Error('database unavailable'));

    await expect(unblockUser('sarah', 'troll')).rejects.toThrow('database unavailable');

    // The retry finds the platform list already clear and lifts the DV one.
    prisma.userSafetySettings.findUnique.mockResolvedValueOnce({ blockedUsers: [] });
    await expect(unblockUser('sarah', 'troll')).resolves.toBeUndefined();
    expect(prisma.dvSafetyProfile.update).toHaveBeenCalledTimes(2);
  });
});
