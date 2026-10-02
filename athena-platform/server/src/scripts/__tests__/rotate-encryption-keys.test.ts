/**
 * The last step of a key rotation: seal again, under the current key, what a
 * retired key sealed. It touches the most sensitive rows on the platform, so
 * what matters is what it refuses to do: write under a key anyone can read,
 * touch a value it cannot read, overwrite a row she changed while it ran, or
 * leave a value that no longer opens. The tables here are in memory and apply
 * the same conditional writes the database would, with the real encryption.
 */

jest.mock('../../utils/prisma', () => ({
  prisma: {
    dvSafeMessage: { findMany: jest.fn(), updateMany: jest.fn() },
    healthEntry: { findMany: jest.fn(), updateMany: jest.fn() },
    medication: { findMany: jest.fn(), updateMany: jest.fn() },
    healthNote: { findMany: jest.fn(), updateMany: jest.fn() },
    healthBooking: { findMany: jest.fn(), updateMany: jest.fn() },
    user: { findMany: jest.fn(), updateMany: jest.fn() },
    safetyPlan: { findMany: jest.fn(), updateMany: jest.fn() },
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { rotateEncryptionKeys } from '../rotate-encryption-keys';
import { prisma } from '../../utils/prisma';
import { openText, sealText } from '../../utils/encryption-key';
import { encryptJson, decryptJson } from '../../services/wellness/health-crypto';
import { encryptMessage } from '../../services/dv-safe.service';
import { readPlanPart, sealPlanLines } from '../../utils/safety-plan-seal';
import { openSecret, sealSecret } from '../../utils/secret-box';

const db: any = prisma;

const OLD_KEY = '21c983cb1baec38efae62af1e84dc644fdc9306f8b190a8e76dd98eed44be44b';
const NEW_KEY = '1e7668712a2dfacf98da6906a9b348287f7013dbba1cd6f6421e36f7273132e1';
const LOST_KEY = '9d3f0b1c7a5e48d2b6c1f04e8a7d92b35c6e1f0a48b7d3c29e5a6f1b08c4d7e2';
const at = new Date('2026-09-01T00:00:00Z');

type Row = Record<string, any> & { id: string };

/**
 * A table that answers findMany and updateMany the way the database does for the
 * calls the script makes: ordered by id, cursor and skip, a `not: null` filter,
 * a select, and an updateMany that only writes the rows its where clause matches.
 */
function table(rows: Row[], hooks: { afterRead?: () => void } = {}) {
  const matches = (row: Row, where: Record<string, any>) =>
    Object.entries(where).every(([key, value]) =>
      value instanceof Date ? row[key] instanceof Date && row[key].getTime() === value.getTime() : row[key] === value
    );

  return {
    rows,
    findMany: async (args: any) => {
      let found = [...rows].sort((a, b) => (a.id < b.id ? -1 : 1));
      for (const [key, value] of Object.entries(args.where ?? {})) {
        if ((value as any)?.not === null) found = found.filter((row) => row[key] !== null && row[key] !== undefined);
      }
      if (args.cursor) found = found.slice(found.findIndex((row) => row.id === args.cursor.id) + (args.skip ?? 0));
      found = found.slice(0, args.take);
      const read = found.map((row) => {
        if (!args.select) return { ...row };
        return Object.fromEntries(Object.keys(args.select).map((key) => [key, row[key]]));
      });
      hooks.afterRead?.();
      return read;
    },
    updateMany: async ({ where, data }: any) => {
      const hit = rows.filter((row) => matches(row, where));
      for (const row of hit) Object.assign(row, data);
      return { count: hit.length };
    },
  };
}

function use(model: string, rows: Row[], hooks: { afterRead?: () => void } = {}) {
  const fake = table(rows, hooks);
  db[model].findMany.mockImplementation(fake.findMany);
  db[model].updateMany.mockImplementation(jest.fn(fake.updateMany));
  return fake;
}

/** Everything sealed under OLD_KEY, then the environment a rotation runs in: new key current, old key previous. */
function sealedUnder(key: string, make: () => string): string {
  process.env.DV_ENCRYPTION_KEY = key;
  delete process.env.DV_ENCRYPTION_KEY_PREVIOUS;
  return make();
}

function rotationEnvironment() {
  process.env.DV_ENCRYPTION_KEY = NEW_KEY;
  process.env.DV_ENCRYPTION_KEY_PREVIOUS = OLD_KEY;
}

describe('Sealing again, after a key rotation', () => {
  const env = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...env, NODE_ENV: 'test' };
    delete process.env.HEALTH_ENCRYPTION_KEY;
    delete process.env.TOTP_ENCRYPTION_KEY;
    delete process.env.HEALTH_ENCRYPTION_KEY_PREVIOUS;
    delete process.env.TOTP_ENCRYPTION_KEY_PREVIOUS;
    for (const model of ['dvSafeMessage', 'healthEntry', 'medication', 'healthNote', 'healthBooking', 'user', 'safetyPlan']) {
      use(model, []);
    }
  });
  afterEach(() => {
    process.env = env;
  });

  it('refuses to run without a real key, even outside production, and reads nothing', async () => {
    delete process.env.DV_ENCRYPTION_KEY;
    await expect(rotateEncryptionKeys({ dryRun: false })).rejects.toThrow(/DV_ENCRYPTION_KEY must be set/);

    process.env.DV_ENCRYPTION_KEY = 'not-hex';
    await expect(rotateEncryptionKeys({ dryRun: false })).rejects.toThrow(/64-character hex key/);

    expect(db.dvSafeMessage.findMany).not.toHaveBeenCalled();
    expect(db.dvSafeMessage.updateMany).not.toHaveBeenCalled();
  });

  it('refuses to seal under a placeholder key, though NODE_ENV is not production and the key is valid hex', async () => {
    // A shell that runs this against the real database rarely has NODE_ENV set,
    // and sealText only refuses a placeholder in production. Without this check
    // an operator who typed a pattern would write every row under a key the API
    // then refuses to start with.
    for (const weak of ['0'.repeat(64), 'a'.repeat(64), 'deadbeef'.repeat(8)]) {
      process.env.DV_ENCRYPTION_KEY = weak;
      await expect(rotateEncryptionKeys({ dryRun: false })).rejects.toThrow(/nothing is sealed under it/);
    }
    // A placeholder on the key of its own is refused too, naming that variable.
    process.env.DV_ENCRYPTION_KEY = NEW_KEY;
    process.env.HEALTH_ENCRYPTION_KEY = '1'.repeat(64);
    await expect(rotateEncryptionKeys({ dryRun: false })).rejects.toThrow(/HEALTH_ENCRYPTION_KEY is made of a repeating pattern/);

    expect(db.dvSafeMessage.findMany).not.toHaveBeenCalled();
    expect(db.dvSafeMessage.updateMany).not.toHaveBeenCalled();
  });

  it('is a dry run unless it is told otherwise: it counts what it would seal again and writes nothing', async () => {
    const underOld = sealedUnder(OLD_KEY, () => encryptMessage('Leave Tuesday'));
    rotationEnvironment();
    const messages = use('dvSafeMessage', [
      { id: 'm1', content: underOld },
      { id: 'm2', content: encryptMessage('written after the rotation') },
    ]);

    const summary = await rotateEncryptionKeys();

    expect(summary.dryRun).toBe(true);
    expect(summary.columns.safeChatMessages).toMatchObject({ seen: 2, resealed: 1, current: 1, unreadable: 0, skipped: 0 });
    expect(db.dvSafeMessage.updateMany).not.toHaveBeenCalled();
    expect(messages.rows[0].content).toBe(underOld);
  });

  it('seals again each value only a retired key could open, and every one still reads back', async () => {
    const message = sealedUnder(OLD_KEY, () => encryptMessage('Leave Tuesday'));
    const entry = sealedUnder(OLD_KEY, () => encryptJson({ mood: 2, note: 'a hard week' }));
    const medication = sealedUnder(OLD_KEY, () => encryptJson({ name: 'Iron', dose: '50 mg' }));
    const note = sealedUnder(OLD_KEY, () => encryptJson({ title: 'GP', body: 'Ask about bloods' }));
    const reason = sealedUnder(OLD_KEY, () => encryptJson({ text: 'Trouble sleeping' }));
    const seed = sealedUnder(OLD_KEY, () => sealSecret('GEZDGNBVGY3TQOJQ'));
    rotationEnvironment();

    const messages = use('dvSafeMessage', [{ id: 'm1', content: message }]);
    const entries = use('healthEntry', [{ id: 'e1', payload: entry, updatedAt: at }]);
    const meds = use('medication', [{ id: 'd1', details: medication, updatedAt: at }]);
    const notes = use('healthNote', [{ id: 'n1', content: note, updatedAt: at }]);
    const bookings = use('healthBooking', [{ id: 'b1', reason, updatedAt: at }, { id: 'b2', reason: null, updatedAt: at }]);
    const users = use('user', [{ id: 'u1', twoFactorSecret: seed, updatedAt: at }, { id: 'u2', twoFactorSecret: null, updatedAt: at }]);

    const summary = await rotateEncryptionKeys({ dryRun: false });

    expect(summary.dryRun).toBe(false);
    for (const label of ['safeChatMessages', 'healthEntries', 'medications', 'healthNotes', 'bookingReasons', 'authenticatorSeeds']) {
      expect(summary.columns[label]).toMatchObject({ resealed: 1, unreadable: 0, skipped: 0 });
    }

    // Retire the old key: everything must open under the new one alone.
    delete process.env.DV_ENCRYPTION_KEY_PREVIOUS;
    expect(openText('safe-chat', messages.rows[0].content)).toBe('Leave Tuesday');
    expect(decryptJson(entries.rows[0].payload)).toEqual({ mood: 2, note: 'a hard week' });
    expect(decryptJson(meds.rows[0].details)).toEqual({ name: 'Iron', dose: '50 mg' });
    expect(decryptJson(notes.rows[0].content)).toEqual({ title: 'GP', body: 'Ask about bloods' });
    expect(decryptJson(bookings.rows[0].reason)).toEqual({ text: 'Trouble sleeping' });
    expect(bookings.rows[1].reason).toBeNull();
    expect(openSecret(users.rows[0].twoFactorSecret)).toBe('GEZDGNBVGY3TQOJQ');
    expect(users.rows[1].twoFactorSecret).toBeNull();
  });

  it('does not move a record’s updatedAt, so a rotation does not make everything look just edited', async () => {
    const entry = sealedUnder(OLD_KEY, () => encryptJson({ mood: 2 }));
    const message = sealedUnder(OLD_KEY, () => encryptMessage('hello'));
    rotationEnvironment();
    use('healthEntry', [{ id: 'e1', payload: entry, updatedAt: at }]);
    use('dvSafeMessage', [{ id: 'm1', content: message }]);

    await rotateEncryptionKeys({ dryRun: false });

    expect(db.healthEntry.updateMany.mock.calls[0][0].data.updatedAt).toEqual(at);
    // A safe-chat message has no updatedAt to carry.
    expect(db.dvSafeMessage.updateMany.mock.calls[0][0].data).not.toHaveProperty('updatedAt');
  });

  it('leaves alone what the current key already opens, and so a second run changes nothing', async () => {
    const underOld = sealedUnder(OLD_KEY, () => encryptJson({ mood: 4 }));
    rotationEnvironment();
    const entries = use('healthEntry', [
      { id: 'e1', payload: underOld, updatedAt: at },
      { id: 'e2', payload: encryptJson({ mood: 5 }), updatedAt: at },
    ]);

    const first = await rotateEncryptionKeys({ dryRun: false });
    expect(first.columns.healthEntries).toMatchObject({ seen: 2, resealed: 1, current: 1 });
    const afterFirst = entries.rows.map((row) => row.payload);

    const second = await rotateEncryptionKeys({ dryRun: false });
    expect(second.columns.healthEntries).toMatchObject({ seen: 2, resealed: 0, current: 2 });
    expect(entries.rows.map((row) => row.payload)).toEqual(afterFirst);
    expect(db.healthEntry.updateMany).toHaveBeenCalledTimes(1);
  });

  it('never touches a value no configured key opens, and counts it so the old key is not retired', async () => {
    const lost = sealedUnder(LOST_KEY, () => encryptMessage('sealed under a key nobody listed'));
    const underOld = sealedUnder(OLD_KEY, () => encryptMessage('sealed under the old key'));
    rotationEnvironment();
    const messages = use('dvSafeMessage', [
      { id: 'm1', content: lost },
      { id: 'm2', content: underOld },
    ]);

    const summary = await rotateEncryptionKeys({ dryRun: false });

    expect(summary.columns.safeChatMessages).toMatchObject({ seen: 2, unreadable: 1, resealed: 1 });
    expect(messages.rows[0].content).toBe(lost);
    expect(openText('safe-chat', messages.rows[1].content)).toBe('sealed under the old key');
  });

  it('reports everything as unreadable, and writes nothing, when the old key was never listed as previous', async () => {
    const underOld = sealedUnder(OLD_KEY, () => encryptMessage('hello'));
    process.env.DV_ENCRYPTION_KEY = NEW_KEY;
    const messages = use('dvSafeMessage', [{ id: 'm1', content: underOld }]);

    const summary = await rotateEncryptionKeys({ dryRun: false });

    expect(summary.columns.safeChatMessages).toMatchObject({ unreadable: 1, resealed: 0 });
    expect(db.dvSafeMessage.updateMany).not.toHaveBeenCalled();
    expect(messages.rows[0].content).toBe(underOld);
  });

  it('skips a row she changed while it ran, and does not overwrite her newer value', async () => {
    const underOld = sealedUnder(OLD_KEY, () => encryptJson({ mood: 1 }));
    rotationEnvironment();
    const newer = encryptJson({ mood: 5, note: 'edited just now' });
    const entries = use('healthEntry', [{ id: 'e1', payload: underOld, updatedAt: at }], {
      afterRead: () => {
        entries.rows[0].payload = newer;
      },
    });

    const summary = await rotateEncryptionKeys({ dryRun: false });

    expect(summary.columns.healthEntries).toMatchObject({ resealed: 0, skipped: 1 });
    expect(entries.rows[0].payload).toBe(newer);
  });

  it('leaves an authenticator seed from before sealing existed as it is', async () => {
    rotationEnvironment();
    const users = use('user', [{ id: 'u1', twoFactorSecret: 'GEZDGNBVGY3TQOJQ', updatedAt: at }]);

    const summary = await rotateEncryptionKeys({ dryRun: false });

    expect(summary.columns.authenticatorSeeds).toMatchObject({ seen: 1, unsealed: 1, resealed: 0 });
    expect(users.rows[0].twoFactorSecret).toBe('GEZDGNBVGY3TQOJQ');
  });

  it('works through every row when there are more than one batch', async () => {
    const rows: Row[] = [];
    for (let i = 1; i <= 5; i += 1) {
      rows.push({ id: `m${i}`, content: sealedUnder(OLD_KEY, () => encryptMessage(`message ${i}`)) });
    }
    rotationEnvironment();
    const messages = use('dvSafeMessage', rows);

    const summary = await rotateEncryptionKeys({ dryRun: false, batchSize: 2 });

    expect(summary.columns.safeChatMessages).toMatchObject({ seen: 5, resealed: 5 });
    delete process.env.DV_ENCRYPTION_KEY_PREVIOUS;
    expect(messages.rows.map((row) => openText('safe-chat', row.content))).toEqual([1, 2, 3, 4, 5].map((i) => `message ${i}`));
  });

  describe('safety plans', () => {
    const plan = (id: string, parts: Record<string, unknown>) => ({ id, userId: `user-${id}`, updatedAt: at, ...parts });

    it('seals each sealed part again, keeps her words, and leaves plain and empty parts for the other script', async () => {
      const safeLocations = sealedUnder(OLD_KEY, () => sealPlanLines(['12 Wattle St']));
      const exitStrategies = sealedUnder(OLD_KEY, () => sealPlanLines(['Take the 6pm bus']));
      rotationEnvironment();
      const plans = use('safetyPlan', [
        plan('1', { safeLocations, exitStrategies, legalContacts: ['Women’s Legal Service'], warningTriggers: null }),
      ]);

      const summary = await rotateEncryptionKeys({ dryRun: false });

      expect(summary.columns.safetyPlanParts).toMatchObject({ seen: 2, resealed: 2, unreadable: 0 });
      delete process.env.DV_ENCRYPTION_KEY_PREVIOUS;
      expect(readPlanPart(plans.rows[0].safeLocations)).toEqual({ lines: ['12 Wattle St'], state: 'sealed' });
      expect(readPlanPart(plans.rows[0].exitStrategies)).toEqual({ lines: ['Take the 6pm bus'], state: 'sealed' });
      // Not sealed yet, and not this script's to seal.
      expect(plans.rows[0].legalContacts).toEqual(['Women’s Legal Service']);
      expect(plans.rows[0].warningTriggers).toBeNull();
    });

    it('is matched on when she last saved the plan, so a plan she saved a moment ago is not replaced', async () => {
      const safeLocations = sealedUnder(OLD_KEY, () => sealPlanLines(['Old address']));
      rotationEnvironment();
      const saved = new Date('2026-09-30T10:00:00Z');
      const plans = use('safetyPlan', [plan('1', { safeLocations })], {
        afterRead: () => {
          plans.rows[0].updatedAt = saved;
          plans.rows[0].safeLocations = sealPlanLines(['New address, saved just now']);
        },
      });

      const summary = await rotateEncryptionKeys({ dryRun: false });

      expect(db.safetyPlan.updateMany.mock.calls[0][0].where).toEqual({ id: '1', updatedAt: at });
      expect(summary.columns.safetyPlanParts).toMatchObject({ resealed: 0, skipped: 1 });
      expect(readPlanPart(plans.rows[0].safeLocations).lines).toEqual(['New address, saved just now']);
    });

    it('never touches a part no configured key opens', async () => {
      const lost = sealedUnder(LOST_KEY, () => sealPlanLines(['Somewhere']));
      rotationEnvironment();
      const plans = use('safetyPlan', [plan('1', { safeLocations: lost })]);

      const summary = await rotateEncryptionKeys({ dryRun: false });

      expect(summary.columns.safetyPlanParts).toMatchObject({ unreadable: 1, resealed: 0 });
      expect(db.safetyPlan.updateMany).not.toHaveBeenCalled();
      expect(plans.rows[0].safeLocations).toBe(lost);
    });

    it('keys a plan from the safe-chat key only, so rotating the authenticator key cannot lose one', async () => {
      const safeLocations = sealedUnder(OLD_KEY, () => sealPlanLines(['12 Wattle St']));
      rotationEnvironment();
      process.env.TOTP_ENCRYPTION_KEY = LOST_KEY;
      const plans = use('safetyPlan', [plan('1', { safeLocations })]);

      await rotateEncryptionKeys({ dryRun: false });

      delete process.env.DV_ENCRYPTION_KEY_PREVIOUS;
      expect(readPlanPart(plans.rows[0].safeLocations).lines).toEqual(['12 Wattle St']);
    });
  });

  it('seals under the current key only, never a retired one', async () => {
    const underOld = sealedUnder(OLD_KEY, () => encryptMessage('hello'));
    rotationEnvironment();
    const messages = use('dvSafeMessage', [{ id: 'm1', content: underOld }]);

    await rotateEncryptionKeys({ dryRun: false });

    process.env.DV_ENCRYPTION_KEY = OLD_KEY;
    delete process.env.DV_ENCRYPTION_KEY_PREVIOUS;
    expect(openText('safe-chat', messages.rows[0].content)).toBeNull();
    expect(sealText('safe-chat', 'x')).toMatch(/^enc:v1:/);
  });
});
