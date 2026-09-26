import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// An in-memory PushToken table, so the tests exercise what the rows end up as
// rather than which Prisma calls were made on the way.
type Row = { id: string; userId: string; token: string; platform: string; deviceId: string | null; isActive: boolean; createdAt: number };
const table: Row[] = [];
let nextId = 1;
let clock = 1;

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    dvSafetyProfile: { findUnique: jest.fn() },
    pushToken: {
      findMany: jest.fn(async (args: any) =>
        table
          .filter((row) => row.token === args.where.token)
          .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
          .map((row) => ({ id: row.id, userId: row.userId, deviceId: row.deviceId }))
      ),
      create: jest.fn(async (args: any) => {
        const row: Row = { id: `pt${nextId++}`, createdAt: clock++, deviceId: null, ...args.data };
        table.push(row);
        return { id: row.id };
      }),
      update: jest.fn(async (args: any) => {
        const row = table.find((r) => r.id === args.where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, args.data);
        return row;
      }),
      updateMany: jest.fn(async () => ({ count: 0 })),
      deleteMany: jest.fn(async (args: any) => {
        const ids: string[] = args.where.id.in;
        let count = 0;
        for (let i = table.length - 1; i >= 0; i--) {
          if (ids.includes(table[i].id)) {
            table.splice(i, 1);
            count++;
          }
        }
        return { count };
      }),
    },
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { logger } from '../../utils/logger';
import { deviceFingerprint, issueDeviceKey, registerPushToken } from '../push.service';

const TOKEN = 'ExponentPushToken[abcdefghijklmnop]';

function seed(row: Partial<Row> & Pick<Row, 'userId'>): Row {
  const full: Row = {
    id: `pt${nextId++}`,
    token: TOKEN,
    platform: 'ios',
    deviceId: null,
    isActive: true,
    createdAt: clock++,
    ...row,
  };
  table.push(full);
  return full;
}

beforeEach(() => {
  table.length = 0;
  nextId = 1;
  clock = 1;
  jest.clearAllMocks();
});

describe('registerPushToken', () => {
  it('registers an unknown device to the caller and hands back a key it must keep', async () => {
    const result = await registerPushToken({ userId: 'mei', token: TOKEN, platform: 'ios' });

    expect(result.outcome).toBe('registered');
    if (result.outcome === 'held-by-another-account') throw new Error('unreachable');
    expect(result.deviceKey).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(table).toHaveLength(1);
    expect(table[0]).toMatchObject({ userId: 'mei', isActive: true, deviceId: deviceFingerprint(result.deviceKey!) });
    // The key itself is never stored.
    expect(table[0].deviceId).not.toContain(result.deviceKey!);
  });

  it('will not move a device another member holds when the caller cannot prove she holds it', async () => {
    const key = issueDeviceKey();
    seed({ userId: 'victim', deviceId: deviceFingerprint(key) });

    const noKey = await registerPushToken({ userId: 'attacker', token: TOKEN, platform: 'android' });
    const wrongKey = await registerPushToken({ userId: 'attacker', token: TOKEN, platform: 'android', deviceKey: issueDeviceKey() });
    const junkKey = await registerPushToken({ userId: 'attacker', token: TOKEN, platform: 'android', deviceKey: 'x' });

    for (const result of [noKey, wrongKey, junkKey]) expect(result).toEqual({ outcome: 'held-by-another-account' });
    // Still hers, still active, still the same device, and nothing new written.
    expect(table).toHaveLength(1);
    expect(table[0]).toMatchObject({ userId: 'victim', isActive: true, deviceId: deviceFingerprint(key), platform: 'ios' });
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('refused'), expect.objectContaining({ userId: 'attacker', heldBy: ['victim'] }));
  });

  it('will not move a row written before device keys existed to another account, even a signed-out one', async () => {
    seed({ userId: 'first', deviceId: null, isActive: false });

    const result = await registerPushToken({ userId: 'second', token: TOKEN, platform: 'ios', deviceKey: issueDeviceKey() });

    expect(result).toEqual({ outcome: 'held-by-another-account' });
    expect(table[0]).toMatchObject({ userId: 'first', deviceId: null, isActive: false });
  });

  it('moves a shared phone to the next member when the phone presents its key', async () => {
    const key = issueDeviceKey();
    seed({ userId: 'first', deviceId: deviceFingerprint(key), isActive: false });

    const result = await registerPushToken({ userId: 'second', token: TOKEN, platform: 'ios', deviceKey: key });

    expect(result).toEqual({ outcome: 'moved', id: table[0].id, platform: 'ios' });
    expect(table).toHaveLength(1);
    expect(table[0]).toMatchObject({ userId: 'second', isActive: true, deviceId: deviceFingerprint(key) });
  });

  it('moves every duplicate on a handover, so none stays active under the previous member', async () => {
    const key = issueDeviceKey();
    seed({ userId: 'first', deviceId: deviceFingerprint(key) });
    seed({ userId: 'first', deviceId: deviceFingerprint(key) });

    const result = await registerPushToken({ userId: 'second', token: TOKEN, platform: 'ios', deviceKey: key });

    expect(result.outcome).toBe('moved');
    expect(table).toHaveLength(1);
    expect(table.filter((row) => row.userId === 'first')).toEqual([]);
  });

  it('refreshes the caller’s own device, giving a row from before device keys a key of its own', async () => {
    seed({ userId: 'mei', deviceId: null, isActive: false });
    seed({ userId: 'mei', deviceId: null });

    const result = await registerPushToken({ userId: 'mei', token: TOKEN, platform: 'android' });

    expect(result.outcome).toBe('refreshed');
    if (result.outcome === 'held-by-another-account') throw new Error('unreachable');
    expect(result.deviceKey).toBeDefined();
    expect(table).toHaveLength(1);
    expect(table[0]).toMatchObject({ userId: 'mei', isActive: true, platform: 'android', deviceId: deviceFingerprint(result.deviceKey!) });
  });

  it('keeps a presented key rather than issuing a new one, so the phone and the server never disagree', async () => {
    const key = issueDeviceKey();
    seed({ userId: 'mei', deviceId: deviceFingerprint(key) });

    const result = await registerPushToken({ userId: 'mei', token: TOKEN, platform: 'ios', deviceKey: key });

    expect(result).toEqual({ outcome: 'refreshed', id: table[0].id, platform: 'ios' });
    expect(table[0].deviceId).toBe(deviceFingerprint(key));
  });

  it('settles two registrations that both found nothing on the oldest row', async () => {
    const { prisma } = jest.requireMock('../../utils/prisma') as { prisma: any };
    // The other registration lands between this one's read and its write.
    prisma.pushToken.create.mockImplementationOnce(async (args: any) => {
      seed({ userId: 'mei', deviceId: null });
      const row: Row = { id: `pt${nextId++}`, createdAt: clock++, ...args.data };
      table.push(row);
      return { id: row.id };
    });

    const result = await registerPushToken({ userId: 'mei', token: TOKEN, platform: 'ios' });

    expect(result.outcome).toBe('refreshed');
    expect(table).toHaveLength(1);
    if (result.outcome === 'held-by-another-account') throw new Error('unreachable');
    expect(table[0]).toMatchObject({ id: result.id, userId: 'mei', deviceId: deviceFingerprint(result.deviceKey!) });
  });

  it('removes its own row when it loses that race to another account', async () => {
    const { prisma } = jest.requireMock('../../utils/prisma') as { prisma: any };
    const key = issueDeviceKey();
    prisma.pushToken.create.mockImplementationOnce(async (args: any) => {
      seed({ userId: 'victim', deviceId: deviceFingerprint(key) });
      const row: Row = { id: `pt${nextId++}`, createdAt: clock++, ...args.data };
      table.push(row);
      return { id: row.id };
    });

    const result = await registerPushToken({ userId: 'attacker', token: TOKEN, platform: 'ios' });

    expect(result).toEqual({ outcome: 'held-by-another-account' });
    expect(table).toHaveLength(1);
    expect(table[0].userId).toBe('victim');
  });

  it('is judged against the row that won when the token column refuses a duplicate', async () => {
    const { prisma } = jest.requireMock('../../utils/prisma') as { prisma: any };
    const key = issueDeviceKey();
    prisma.pushToken.create.mockImplementationOnce(async () => {
      seed({ userId: 'victim', deviceId: deviceFingerprint(key) });
      throw Object.assign(new Error('Unique constraint failed on the fields: (`token`)'), { code: 'P2002' });
    });

    const result = await registerPushToken({ userId: 'attacker', token: TOKEN, platform: 'ios', deviceKey: issueDeviceKey() });

    expect(result).toEqual({ outcome: 'held-by-another-account' });
    expect(table).toHaveLength(1);
    expect(table[0].userId).toBe('victim');
  });
});
