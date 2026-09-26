/**
 * Who is told that a member has come online.
 *
 * The socket layer used to announce presence:user_online and
 * presence:user_offline to every connected socket on the platform, with no
 * block, no "hide my online status" and no Safe Mode, so any account at all —
 * including a man she had blocked — could watch her come and go by user id.
 * These pin the audience that replaced it: the people she has an established
 * thread with, never across a block, and nobody while she hides.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

type Query = jest.Mock<(args?: any) => Promise<unknown>>;

const participantFindMany = jest.fn() as Query;
const userFindMany = jest.fn() as Query;
const blockedIds = jest.fn() as jest.Mock<(userId: string) => Promise<string[]>>;
const emitToUserRoom = jest.fn();

jest.mock('../../utils/prisma', () => ({
  prisma: {
    conversationParticipant: { findMany: participantFindMany },
    user: { findMany: userFindMany },
  },
}));

jest.mock('../../utils/safety-store', () => ({
  getBlockedRelationshipIds: blockedIds,
}));

jest.mock('../socket.service', () => ({
  emitToUserRoom,
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import {
  announcePresence,
  onlineCounterpartsFor,
  presenceAudience,
  presenceService,
  withdrawPresence,
} from '../presence.service';
import { logger } from '../../utils/logger';

/** Her threads, as the participant query returns the other side of each. */
const threadsWith = (...userIds: string[]) => userIds.map((userId) => ({ userId }));

/** Settings rows for the hidden check. Anyone not listed hides nothing. */
const settings = (rows: Array<{ id: string; hide?: boolean; dvSafeMode?: boolean; profileSafeMode?: boolean }>) =>
  rows.map((row) => ({
    id: row.id,
    safetySettings: row.hide === undefined ? null : { hideOnlineStatus: row.hide },
    dvSafetyProfile: row.dvSafeMode === undefined ? null : { isSafeMode: row.dvSafeMode },
    profile: row.profileSafeMode === undefined ? null : { isSafeMode: row.profileSafeMode },
  }));

const toldOnline = () =>
  emitToUserRoom.mock.calls.filter((call) => call[1] === 'presence:user_online').map((call) => call[0]);
const toldOffline = () =>
  emitToUserRoom.mock.calls.filter((call) => call[1] === 'presence:user_offline').map((call) => call[0]);

describe('presence audience', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await presenceService.cleanup();
    participantFindMany.mockResolvedValue([]);
    userFindMany.mockResolvedValue([]);
    blockedIds.mockResolvedValue([]);
  });

  it('is the people she has an established thread with, and never a request she has not accepted', async () => {
    participantFindMany.mockResolvedValue(threadsWith('friend', 'colleague', 'friend'));

    await expect(presenceAudience('her')).resolves.toEqual(['friend', 'colleague']);

    const where = participantFindMany.mock.calls[0][0].where;
    expect(where).toEqual({
      userId: { not: 'her' },
      conversation: {
        participants: { some: { userId: 'her' } },
        requestDeclinedAt: null,
        OR: [{ requestedById: null }, { requestAcceptedAt: { not: null } }],
      },
    });
  });

  it('never crosses a block, in either direction', async () => {
    participantFindMany.mockResolvedValue(threadsWith('friend', 'him', 'blocked-her'));
    blockedIds.mockResolvedValue(['him', 'blocked-her']);

    await announcePresence('her', 'online');

    expect(toldOnline()).toEqual(['friend']);
    expect(emitToUserRoom).toHaveBeenCalledWith('friend', 'presence:user_online', { userId: 'her' });
    expect(emitToUserRoom).not.toHaveBeenCalledWith('him', expect.anything(), expect.anything());
    expect(emitToUserRoom).not.toHaveBeenCalledWith('blocked-her', expect.anything(), expect.anything());
  });

  it('tells nobody at all while she hides her online status, coming or going', async () => {
    userFindMany.mockResolvedValue(settings([{ id: 'her', hide: true }]));
    participantFindMany.mockResolvedValue(threadsWith('friend'));

    await expect(announcePresence('her', 'online')).resolves.toBe(0);
    await expect(announcePresence('her', 'offline')).resolves.toBe(0);

    expect(emitToUserRoom).not.toHaveBeenCalled();
    // Hidden is decided before her threads are even read.
    expect(participantFindMany).not.toHaveBeenCalled();
  });

  it('treats Safe Mode in either store as hiding', async () => {
    participantFindMany.mockResolvedValue(threadsWith('friend'));

    userFindMany.mockResolvedValue(settings([{ id: 'her', dvSafeMode: true }]));
    await expect(presenceAudience('her')).resolves.toEqual([]);

    userFindMany.mockResolvedValue(settings([{ id: 'her', hide: false, profileSafeMode: true }]));
    await expect(presenceAudience('her')).resolves.toEqual([]);

    userFindMany.mockResolvedValue(settings([{ id: 'her', hide: false, dvSafeMode: false, profileSafeMode: false }]));
    await expect(presenceAudience('her')).resolves.toEqual(['friend']);
  });

  it('does not re-read her threads for a reconnect a moment later, and an offline resets that', async () => {
    participantFindMany.mockResolvedValue(threadsWith('friend'));

    await announcePresence('her', 'online');
    await announcePresence('her', 'online');
    expect(toldOnline()).toEqual(['friend']);
    expect(participantFindMany).toHaveBeenCalledTimes(1);

    await announcePresence('her', 'offline');
    expect(toldOffline()).toEqual(['friend']);

    await announcePresence('her', 'online');
    expect(toldOnline()).toEqual(['friend', 'friend']);
  });

  it('a failed lookup is logged, tells nobody, and does not swallow the next announcement', async () => {
    participantFindMany.mockRejectedValueOnce(new Error('database unavailable'));

    await expect(announcePresence('her', 'online')).resolves.toBe(0);
    expect(emitToUserRoom).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith('Presence not announced', expect.objectContaining({ userId: 'her', state: 'online' }));

    participantFindMany.mockResolvedValue(threadsWith('friend'));
    await announcePresence('her', 'online');
    expect(toldOnline()).toEqual(['friend']);
  });

  it('withdrawing takes back an "online" she has just asked to hide, but still not across a block', async () => {
    // She has just switched hiding on, so her audience is now empty; the
    // people who saw her come online a moment ago are told she has gone.
    userFindMany.mockResolvedValue(settings([{ id: 'her', hide: true }]));
    participantFindMany.mockResolvedValue(threadsWith('friend', 'him'));
    blockedIds.mockResolvedValue(['him']);

    await expect(withdrawPresence('her')).resolves.toBe(1);
    expect(toldOffline()).toEqual(['friend']);
    expect(toldOnline()).toEqual([]);
  });
});

describe('who is online, for a member who has just connected', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await presenceService.cleanup();
    blockedIds.mockResolvedValue([]);
    userFindMany.mockResolvedValue([]);
  });

  it('is the same rule read from the other end: connected, unblocked, established, and not hiding', async () => {
    participantFindMany.mockResolvedValue(threadsWith('friend', 'offline-friend', 'hiding-friend', 'him'));
    blockedIds.mockResolvedValue(['him']);
    userFindMany.mockResolvedValue(settings([{ id: 'hiding-friend', hide: true }, { id: 'friend', hide: false }]));
    const connected = new Set(['friend', 'hiding-friend', 'him', 'stranger']);

    const online = await onlineCounterpartsFor('viewer', (id) => connected.has(id));

    expect(online).toEqual(['friend']);
    // The hidden check reads only the people who are actually connected.
    expect(userFindMany.mock.calls[0][0].where).toEqual({ id: { in: ['friend', 'hiding-friend'] } });
  });

  it('asks nothing more when none of her people are connected', async () => {
    participantFindMany.mockResolvedValue(threadsWith('friend'));
    await expect(onlineCounterpartsFor('viewer', () => false)).resolves.toEqual([]);
    expect(userFindMany).not.toHaveBeenCalled();
  });
});
