/**
 * The other ways into a private group.
 *
 * A private group may ask a completed women-only check of everyone in it, once
 * the founder has switched that surface on (config/woman-gate-policy.ts). The
 * member who asks to join is held to it at the join route, and an admin who
 * approves a request is held to it there. This is the third door: an admin
 * adding someone, or a member suggesting someone into a room that approves.
 * Without it the promise about who is in the room is only kept at the front.
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const prismaMock: any = {
  user: { findUnique: jest.fn(), findMany: jest.fn() },
  group: { findUnique: jest.fn() },
  groupMember: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn() },
  groupJoinRequest: { upsert: jest.fn(), updateMany: jest.fn() },
};

jest.mock('../../utils/prisma', () => ({ prisma: prismaMock }));
jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../socket.service', () => ({ sendNotification: jest.fn(async () => undefined) }));
jest.mock('../search.service', () => ({ viewerContextFor: jest.fn(async () => ({ blockedIds: [], followingIds: [] })) }));
// Nobody adding anybody is on either side of a block here (the rule has its own suite in group-chat.routes.test.ts).
jest.mock('../audience.service', () => ({ isBlockedEitherWay: jest.fn(async () => false) }));

import { WOMAN_VERIFIED_REQUIRED_ENV } from '../../config/woman-gate-policy';
import { ADMISSION_REFUSED_MESSAGE } from '../../middleware/woman-gate-surfaces';
import { addMember } from '../group-chat.service';

const original = process.env;

const GROUP = {
  id: 'g1',
  name: 'Welders',
  privacy: 'PRIVATE',
  requireApproval: false,
  maxMembers: 50,
  _count: { members: 3 },
};

/** `inviter` is the signed-in actor and `newcomer` the person being added. */
function setUp(options: { inviterRole: 'ADMIN' | 'MEMBER'; privacy?: 'PRIVATE' | 'PUBLIC'; newcomer: string }) {
  prismaMock.groupMember.findUnique.mockImplementation(async ({ where }: any) => {
    if (where.groupId_userId.userId === 'inviter') {
      return { role: options.inviterRole, isBanned: false, group: { allowMemberInvites: true } };
    }
    return null;
  });
  prismaMock.group.findUnique.mockResolvedValue({ ...GROUP, privacy: options.privacy ?? 'PRIVATE' });
  prismaMock.user.findUnique.mockImplementation(async () => ({
    womanVerificationStatus: options.newcomer,
    dvSafetyProfile: null,
    profile: null,
  }));
  prismaMock.user.findMany.mockResolvedValue([]);
  prismaMock.groupMember.create.mockResolvedValue({
    userId: 'newcomer',
    role: 'MEMBER',
    joinedAt: new Date('2026-10-01T00:00:00Z'),
    user: { id: 'newcomer', displayName: 'Mei', avatar: null },
  });
  prismaMock.groupJoinRequest.upsert.mockResolvedValue({});
  prismaMock.groupJoinRequest.updateMany.mockResolvedValue({ count: 0 });
  prismaMock.groupMember.findMany.mockResolvedValue([]);
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...original };
  delete process.env[WOMAN_VERIFIED_REQUIRED_ENV];
});

afterEach(() => {
  process.env = original;
});

describe('adding someone to a private group', () => {
  it('adds an unreviewed member while the surface is off, and reads nobody’s standing', async () => {
    setUp({ inviterRole: 'ADMIN', newcomer: 'UNVERIFIED' });

    await expect(addMember('g1', 'inviter', 'newcomer')).resolves.toMatchObject({ userId: 'newcomer' });

    expect(prismaMock.groupMember.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it('refuses an admin who adds an unreviewed member once it is on, in words for the admin, and adds nothing', async () => {
    process.env[WOMAN_VERIFIED_REQUIRED_ENV] = 'private_groups';
    setUp({ inviterRole: 'ADMIN', newcomer: 'UNVERIFIED' });

    await expect(addMember('g1', 'inviter', 'newcomer')).rejects.toMatchObject({
      statusCode: 409,
      message: ADMISSION_REFUSED_MESSAGE,
    });

    expect(prismaMock.groupMember.create).not.toHaveBeenCalled();
  });

  it('refuses a member’s suggestion of an unreviewed member as well, so no request is filed that could not be approved', async () => {
    process.env[WOMAN_VERIFIED_REQUIRED_ENV] = 'private_groups';
    setUp({ inviterRole: 'MEMBER', newcomer: 'PENDING' });

    await expect(addMember('g1', 'inviter', 'newcomer')).rejects.toMatchObject({ statusCode: 409 });

    expect(prismaMock.groupJoinRequest.upsert).not.toHaveBeenCalled();
    expect(prismaMock.groupMember.create).not.toHaveBeenCalled();
  });

  it('asks about the person being added, not the person adding them', async () => {
    process.env[WOMAN_VERIFIED_REQUIRED_ENV] = 'private_groups';
    setUp({ inviterRole: 'ADMIN', newcomer: 'UNVERIFIED' });

    await expect(addMember('g1', 'inviter', 'newcomer')).rejects.toBeDefined();

    const asked = prismaMock.user.findUnique.mock.calls.map((call: any[]) => call[0].where.id);
    expect(asked).toEqual(['newcomer']);
  });

  it('adds a reviewed member once it is on', async () => {
    process.env[WOMAN_VERIFIED_REQUIRED_ENV] = 'private_groups';
    setUp({ inviterRole: 'ADMIN', newcomer: 'VERIFIED' });

    await expect(addMember('g1', 'inviter', 'newcomer')).resolves.toMatchObject({ userId: 'newcomer' });
  });

  it('never asks it of a group that is not private', async () => {
    process.env[WOMAN_VERIFIED_REQUIRED_ENV] = 'all';
    setUp({ inviterRole: 'ADMIN', privacy: 'PUBLIC', newcomer: 'UNVERIFIED' });

    await expect(addMember('g1', 'inviter', 'newcomer')).resolves.toMatchObject({ userId: 'newcomer' });

    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it('does not read a standing it could not read as permission', async () => {
    process.env[WOMAN_VERIFIED_REQUIRED_ENV] = 'private_groups';
    setUp({ inviterRole: 'ADMIN', newcomer: 'VERIFIED' });
    prismaMock.user.findUnique.mockRejectedValue(new Error('db away'));

    await expect(addMember('g1', 'inviter', 'newcomer')).rejects.toThrow('db away');

    expect(prismaMock.groupMember.create).not.toHaveBeenCalled();
  });
});
