/**
 * GET /api/messages/presence: who in your threads is online right now.
 *
 * Nothing used to tell a client who was already online when it connected, so
 * a chat with someone who had been on for an hour read "Offline". The answer
 * has to follow the same rule as the live presence events, or seeding from it
 * would show a member to exactly the people she hides from.
 */

import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    conversationParticipant: { findMany: jest.fn(async () => []) },
    user: { findMany: jest.fn(async () => []) },
    userSafetySettings: { findUnique: jest.fn(async () => null), findMany: jest.fn(async () => []) },
  },
}));

jest.mock('../../services/socket.service', () => {
  const actual = jest.requireActual('../../services/socket.service') as Record<string, unknown>;
  return { ...actual, isUserOnline: jest.fn(() => false), emitToUserRoom: jest.fn() };
});

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'me', role: 'USER', email: 'me@athena.com' };
    next();
  },
  optionalAuth: (_req: any, _res: any, next: any) => next(),
  requireRole: (..._roles: string[]) => (_req: any, __res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';
import { isUserOnline as isUserOnlineTyped } from '../../services/socket.service';

const prisma: any = prismaTyped;
const isUserOnline = isUserOnlineTyped as unknown as jest.Mock<(userId: string) => boolean>;

describe('GET /api/messages/presence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.userSafetySettings.findUnique.mockResolvedValue(null);
    prisma.userSafetySettings.findMany.mockResolvedValue([]);
    prisma.user.findMany.mockResolvedValue([]);
  });

  it('names the people in your established threads who are online, and nobody hidden, blocked or offline', async () => {
    prisma.conversationParticipant.findMany.mockResolvedValue([
      { userId: 'online-friend' },
      { userId: 'offline-friend' },
      { userId: 'hiding-friend' },
      { userId: 'safe-mode-friend' },
      { userId: 'blocked-him' },
    ]);
    // I blocked him; blocking is read in both directions.
    prisma.userSafetySettings.findUnique.mockResolvedValue({ blockedUsers: ['blocked-him'] });
    prisma.user.findMany.mockResolvedValue([
      { id: 'online-friend', safetySettings: null, dvSafetyProfile: null, profile: null },
      { id: 'hiding-friend', safetySettings: { hideOnlineStatus: true }, dvSafetyProfile: null, profile: null },
      { id: 'safe-mode-friend', safetySettings: null, dvSafetyProfile: { isSafeMode: true }, profile: null },
    ]);
    const connected = new Set(['online-friend', 'hiding-friend', 'safe-mode-friend', 'blocked-him', 'stranger']);
    isUserOnline.mockImplementation((id) => connected.has(id));

    const res = await request(app).get('/api/messages/presence').expect(200);

    expect(res.body).toEqual({ success: true, data: { online: ['online-friend'] } });
    // Only threads that are established count: a request she has not
    // accepted does not let its sender see her.
    const where = prisma.conversationParticipant.findMany.mock.calls[0][0].where;
    expect(where.conversation).toMatchObject({
      participants: { some: { userId: 'me' } },
      requestDeclinedAt: null,
      OR: [{ requestedById: null }, { requestAcceptedAt: { not: null } }],
    });
  });

  it('answers an empty list, not an error, when nobody is on', async () => {
    prisma.conversationParticipant.findMany.mockResolvedValue([{ userId: 'friend' }]);
    const res = await request(app).get('/api/messages/presence').expect(200);
    expect(res.body.data.online).toEqual([]);
  });

  it('fails as a failure, not as "nobody is online"', async () => {
    prisma.conversationParticipant.findMany.mockRejectedValue(new Error('database unavailable'));
    const res = await request(app).get('/api/messages/presence');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
