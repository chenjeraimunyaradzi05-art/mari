import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    pushToken: { findMany: jest.fn(), updateMany: jest.fn(async () => ({ count: 0 })) },
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { prisma as prismaTyped } from '../../utils/prisma';
import { EXPO_PUSH_ENDPOINT, isExpoPushToken, pushPreview, pushToUser, wantsPush } from '../push.service';

const prisma: any = prismaTyped;
const realFetch = globalThis.fetch;

function expoAnswers(tickets: Array<Record<string, unknown>>) {
  const calls: Array<{ url: string; body: any; headers: Record<string, string> }> = [];
  globalThis.fetch = jest.fn(async (url: any, init: any) => {
    calls.push({ url: String(url), body: JSON.parse(init.body), headers: init.headers });
    return new Response(JSON.stringify({ data: tickets.splice(0, calls[calls.length - 1].body.length) }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as any;
  return calls;
}

describe('isExpoPushToken', () => {
  it('recognises both Expo token spellings and nothing else', () => {
    expect(isExpoPushToken('ExponentPushToken[abc123]')).toBe(true);
    expect(isExpoPushToken('ExpoPushToken[xyz]')).toBe(true);
    expect(isExpoPushToken('fcm-token-xyz')).toBe(false);
    expect(isExpoPushToken('ExponentPushToken[]')).toBe(false);
  });
});

describe('wantsPush', () => {
  it('reads the member’s push switches, defaulting to yes', () => {
    expect(wantsPush(undefined, 'MESSAGE')).toBe(true);
    expect(wantsPush({ push: { messages: false } }, 'MESSAGE')).toBe(false);
    expect(wantsPush({ push: { messages: false } }, 'COMMENT')).toBe(true);
    expect(wantsPush({ push: { mentions: false } }, 'FOLLOW')).toBe(false);
    expect(wantsPush({ push: { jobMatches: false } }, 'JOB_MATCH')).toBe(false);
    // Kinds with no switch always go.
    expect(wantsPush({ push: { mentions: false } }, 'SYSTEM')).toBe(true);
  });
});

describe('pushPreview', () => {
  it('reads mentions aloud, collapses whitespace and trims long text', () => {
    expect(pushPreview('Thanks @[Mei Chen](11111111-1111-4111-8111-111111111111)\n\nsee you')).toBe('Thanks @Mei Chen see you');
    expect(pushPreview('')).toBe('Sent you a message');
    expect(pushPreview('x'.repeat(200)).length).toBe(120);
  });
});

describe('pushToUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue({ notificationPreferences: null });
    delete process.env.EXPO_ACCESS_TOKEN;
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('does nothing for a member with no devices', async () => {
    prisma.pushToken.findMany.mockResolvedValue([]);
    globalThis.fetch = jest.fn() as any;
    await expect(pushToUser('u1', 'MESSAGE', { title: 'Mei', body: 'hi' })).resolves.toMatchObject({ skipped: 'no-tokens' });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('respects a member who turned this kind of push off', async () => {
    prisma.user.findUnique.mockResolvedValue({ notificationPreferences: { push: { messages: false } } });
    prisma.pushToken.findMany.mockResolvedValue([{ id: 't1', token: 'ExponentPushToken[a]', platform: 'ios' }]);
    globalThis.fetch = jest.fn() as any;
    await expect(pushToUser('u1', 'MESSAGE', { title: 'Mei', body: 'hi' })).resolves.toMatchObject({ skipped: 'preferences' });
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(prisma.pushToken.findMany).not.toHaveBeenCalled();
  });

  it('sends Expo tokens to Expo with the link in data, and switches off a dead device', async () => {
    prisma.pushToken.findMany.mockResolvedValue([
      { id: 't1', token: 'ExponentPushToken[live]', platform: 'ios' },
      { id: 't2', token: 'ExponentPushToken[gone]', platform: 'android' },
    ]);
    const calls = expoAnswers([
      { status: 'ok', id: 'r1' },
      { status: 'error', message: 'not registered', details: { error: 'DeviceNotRegistered' } },
    ]);

    const result = await pushToUser('u1', 'MESSAGE', {
      title: 'Mei Chen',
      body: 'Are you free Thursday?',
      link: '/dashboard/messages?user=mei',
      data: { conversationId: 'c1' },
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(EXPO_PUSH_ENDPOINT);
    expect(calls[0].headers.authorization).toBeUndefined();
    expect(calls[0].body[0]).toMatchObject({
      to: 'ExponentPushToken[live]',
      title: 'Mei Chen',
      body: 'Are you free Thursday?',
      data: { conversationId: 'c1', link: '/dashboard/messages?user=mei' },
      sound: 'default',
      priority: 'high',
    });
    expect(result).toMatchObject({ attempted: 2, sent: 1, failed: 0, deactivated: 1 });
    expect(prisma.pushToken.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['t2'] } }, data: { isActive: false } });
  });

  it('batches more than a hundred devices into several requests', async () => {
    const tokens = Array.from({ length: 150 }, (_, i) => ({ id: `t${i}`, token: `ExponentPushToken[${i}]`, platform: 'ios' }));
    prisma.pushToken.findMany.mockResolvedValue(tokens);
    const calls = expoAnswers(tokens.map(() => ({ status: 'ok' })));

    const result = await pushToUser('u1', 'COMMENT', { title: 'New comment', body: 'Priya commented' });

    expect(calls.map((c) => c.body.length)).toEqual([100, 50]);
    expect(result).toMatchObject({ attempted: 150, sent: 150, failed: 0 });
  });

  it('carries the Expo access token when one is configured', async () => {
    process.env.EXPO_ACCESS_TOKEN = 'expo-secret';
    prisma.pushToken.findMany.mockResolvedValue([{ id: 't1', token: 'ExponentPushToken[a]', platform: 'ios' }]);
    const calls = expoAnswers([{ status: 'ok' }]);
    await pushToUser('u1', 'MENTION', { title: 'Mentioned', body: 'Mei mentioned you' });
    expect(calls[0].headers.authorization).toBe('Bearer expo-secret');
  });

  it('counts a refused request as failed and never throws', async () => {
    prisma.pushToken.findMany.mockResolvedValue([{ id: 't1', token: 'ExponentPushToken[a]', platform: 'ios' }]);
    globalThis.fetch = jest.fn(async () => new Response('rate limited', { status: 429 })) as any;
    await expect(pushToUser('u1', 'MESSAGE', { title: 'x', body: 'y' })).resolves.toMatchObject({ attempted: 1, sent: 0, failed: 1 });
  });

  it('skips non-Expo tokens when Firebase is not configured, counting them as failed', async () => {
    delete process.env.FIREBASE_PROJECT_ID;
    prisma.pushToken.findMany.mockResolvedValue([{ id: 't1', token: 'fcm:abc', platform: 'android' }]);
    globalThis.fetch = jest.fn() as any;
    await expect(pushToUser('u1', 'MESSAGE', { title: 'x', body: 'y' })).resolves.toMatchObject({ attempted: 1, sent: 0, failed: 1 });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
