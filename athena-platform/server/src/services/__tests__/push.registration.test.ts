import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// An in-memory PushToken table, so the tests exercise what the rows end up as
// rather than which Prisma calls were made on the way. The token column is
// unique, as it is in the database: a second row for a token is refused with
// Prisma's P2002, the way the real constraint refuses it.
type Row = { id: string; userId: string; token: string; platform: string; deviceId: string | null; isActive: boolean; createdAt: number };
const table: Row[] = [];
let nextId = 1;
let clock = 1;

const uniqueViolation = () =>
  Object.assign(new Error('Unique constraint failed on the fields: (`token`)'), { code: 'P2002' });

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    dvSafetyProfile: { findUnique: jest.fn() },
    pushToken: {
      findUnique: jest.fn(async (args: any) => {
        const row = table.find((r) => r.token === args.where.token);
        return row ? { id: row.id, userId: row.userId, deviceId: row.deviceId } : null;
      }),
      create: jest.fn(async (args: any) => {
        if (table.some((r) => r.token === args.data.token)) throw uniqueViolation();
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
      deleteMany: jest.fn(async () => ({ count: 0 })),
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

  it('keeps the key an unknown device presents rather than issuing another', async () => {
    const key = issueDeviceKey();
    const result = await registerPushToken({ userId: 'mei', token: TOKEN, platform: 'ios', deviceKey: key });

    expect(result).toEqual({ outcome: 'registered', id: table[0].id, platform: 'ios' });
    expect(table[0].deviceId).toBe(deviceFingerprint(key));
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

  it('refreshes the caller’s own device, giving a row from before device keys a key of its own', async () => {
    seed({ userId: 'mei', deviceId: null, isActive: false });

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

  it('settles two registrations of her own device that both found nothing on the one row', async () => {
    const { prisma } = jest.requireMock('../../utils/prisma') as { prisma: any };
    // The other registration lands between this one's read and its write.
    prisma.pushToken.findUnique.mockImplementationOnce(async () => {
      seed({ userId: 'mei', deviceId: null });
      return null;
    });

    const result = await registerPushToken({ userId: 'mei', token: TOKEN, platform: 'ios' });

    expect(result.outcome).toBe('refreshed');
    expect(table).toHaveLength(1);
    if (result.outcome === 'held-by-another-account') throw new Error('unreachable');
    expect(table[0]).toMatchObject({ id: result.id, userId: 'mei', deviceId: deviceFingerprint(result.deviceKey!) });
  });

  it('is judged against the row that won when the token column refuses a duplicate', async () => {
    const { prisma } = jest.requireMock('../../utils/prisma') as { prisma: any };
    const key = issueDeviceKey();
    prisma.pushToken.findUnique.mockImplementationOnce(async () => {
      seed({ userId: 'victim', deviceId: deviceFingerprint(key) });
      return null;
    });

    const result = await registerPushToken({ userId: 'attacker', token: TOKEN, platform: 'ios', deviceKey: issueDeviceKey() });

    expect(result).toEqual({ outcome: 'held-by-another-account' });
    expect(table).toHaveLength(1);
    expect(table[0]).toMatchObject({ userId: 'victim', deviceId: deviceFingerprint(key) });
  });

  it('moves the device when the racing winner was another account and the phone proves its key', async () => {
    const { prisma } = jest.requireMock('../../utils/prisma') as { prisma: any };
    const key = issueDeviceKey();
    prisma.pushToken.findUnique.mockImplementationOnce(async () => {
      seed({ userId: 'first', deviceId: deviceFingerprint(key) });
      return null;
    });

    const result = await registerPushToken({ userId: 'second', token: TOKEN, platform: 'ios', deviceKey: key });

    expect(result).toEqual({ outcome: 'moved', id: table[0].id, platform: 'ios' });
    expect(table[0].userId).toBe('second');
  });

  it('passes on a failure that is not the token conflict', async () => {
    const { prisma } = jest.requireMock('../../utils/prisma') as { prisma: any };
    prisma.pushToken.create.mockImplementationOnce(async () => {
      throw new Error('connection reset');
    });

    await expect(registerPushToken({ userId: 'mei', token: TOKEN, platform: 'ios' })).rejects.toThrow('connection reset');
  });
});
