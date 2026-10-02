/**
 * The one-off script that seals plans written before plans were sealed. It
 * touches the most sensitive rows on the platform, so what matters is what it
 * refuses to do: write under a key anyone can read, overwrite a plan she saved
 * a moment ago, or touch a part it cannot read back.
 */

jest.mock('../../utils/prisma', () => ({
  prisma: { safetyPlan: { findMany: jest.fn(), updateMany: jest.fn() } },
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { sealSafetyPlans } from '../seal-safety-plans';
import { prisma } from '../../utils/prisma';
import { readPlanPart, sealPlanLines } from '../../utils/safety-plan-seal';
import { isSealed } from '../../utils/secret-box';

const db: any = prisma;
// A key that looks generated: the script refuses a run of one character or a
// repeating pattern, as the production API does.
const KEY = 'd41d8cd98f00b204e9800998ecf8427ea3f1c9e7b5d2048f6e1a7c3b9d5f0e24';
const at = new Date('2026-09-30T00:00:00Z');

const row = (id: string, parts: Record<string, unknown> = {}) => ({ id, userId: `user-${id}`, updatedAt: at, ...parts });

describe('Sealing the plans written before sealing existed', () => {
  const env = { ...process.env };
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...env, NODE_ENV: 'test', DV_ENCRYPTION_KEY: KEY };
    db.safetyPlan.updateMany.mockResolvedValue({ count: 1 });
  });
  afterEach(() => {
    process.env = env;
  });

  it('refuses to run without a real key, even outside production', async () => {
    delete process.env.DV_ENCRYPTION_KEY;
    await expect(sealSafetyPlans()).rejects.toThrow(/DV_ENCRYPTION_KEY/);

    process.env.DV_ENCRYPTION_KEY = 'not-hex';
    await expect(sealSafetyPlans()).rejects.toThrow(/64-character hex/);

    expect(db.safetyPlan.findMany).not.toHaveBeenCalled();
    expect(db.safetyPlan.updateMany).not.toHaveBeenCalled();
  });

  it('refuses the placeholder key an example file ships, which the production API would refuse to start with', async () => {
    // 64 valid hex characters, and a key anyone can read: sealing under it would
    // leave every plan unreadable on a host that has a real key.
    process.env.DV_ENCRYPTION_KEY = '0'.repeat(64);
    await expect(sealSafetyPlans()).rejects.toThrow(/repeating pattern/);

    process.env.DV_ENCRYPTION_KEY = 'abcdabcd'.repeat(8);
    await expect(sealSafetyPlans()).rejects.toThrow(/DV_ENCRYPTION_KEY/);

    expect(db.safetyPlan.findMany).not.toHaveBeenCalled();
    expect(db.safetyPlan.updateMany).not.toHaveBeenCalled();
  });

  it('seals each readable part, keeps the words, and leaves the other parts alone', async () => {
    db.safetyPlan.findMany.mockResolvedValueOnce([
      row('1', {
        safeLocations: ['12 Wattle St'],
        exitStrategies: 'Take the bus\nBag is in the shed',
        emergencyContacts: sealPlanLines(['Jo']),
        warningTriggers: null,
        importantDocs: [],
      }),
    ]);

    const summary = await sealSafetyPlans();

    expect(db.safetyPlan.updateMany).toHaveBeenCalledTimes(1);
    const { where, data } = db.safetyPlan.updateMany.mock.calls[0][0];
    expect(where).toEqual({ id: '1', updatedAt: at });
    expect(Object.keys(data).sort()).toEqual(['exitStrategies', 'safeLocations']);
    expect(isSealed(data.safeLocations)).toBe(true);
    expect(readPlanPart(data.safeLocations).lines).toEqual(['12 Wattle St']);
    expect(readPlanPart(data.exitStrategies).lines).toEqual(['Take the bus', 'Bag is in the shed']);
    expect(JSON.stringify(data)).not.toContain('Wattle');
    expect(summary).toMatchObject({ rowsSeen: 1, rowsSealed: 1, partsSealed: 2, partsAlreadySealed: 1, rowsSkipped: 0 });
  });

  it('does nothing to a row that is already sealed, so running it twice is harmless', async () => {
    db.safetyPlan.findMany.mockResolvedValueOnce([
      row('1', { safeLocations: sealPlanLines(['12 Wattle St']), financialPlan: null }),
    ]);

    const summary = await sealSafetyPlans();

    expect(db.safetyPlan.updateMany).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ rowsSeen: 1, rowsSealed: 0, partsSealed: 0, partsAlreadySealed: 1 });
  });

  it('writes nothing in a dry run, but counts what it would seal', async () => {
    db.safetyPlan.findMany.mockResolvedValueOnce([row('1', { safeLocations: ['a'], legalContacts: ['b'] })]);

    const summary = await sealSafetyPlans({ dryRun: true });

    expect(db.safetyPlan.updateMany).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ dryRun: true, rowsSealed: 1, partsSealed: 2 });
  });

  it('does not overwrite a plan she saved while it ran', async () => {
    db.safetyPlan.findMany.mockResolvedValueOnce([row('1', { safeLocations: ['a'] })]);
    db.safetyPlan.updateMany.mockResolvedValueOnce({ count: 0 });

    const summary = await sealSafetyPlans();

    // The write is matched on the updatedAt it was read with, so a newer save
    // makes it match nothing.
    expect(db.safetyPlan.updateMany.mock.calls[0][0].where).toEqual({ id: '1', updatedAt: at });
    expect(summary).toMatchObject({ rowsSealed: 0, partsSealed: 0, rowsSkipped: 1 });
  });

  it('leaves a part it cannot open, and a part that is not a list, exactly where it is', async () => {
    process.env.DV_ENCRYPTION_KEY = 'b'.repeat(64);
    const sealedElsewhere = sealPlanLines(['Old address']);
    process.env.DV_ENCRYPTION_KEY = KEY;
    db.safetyPlan.findMany.mockResolvedValueOnce([
      row('1', { safeLocations: sealedElsewhere, exitStrategies: { odd: 'shape' }, legalContacts: ['Solicitor'] }),
    ]);

    const summary = await sealSafetyPlans();

    const { data } = db.safetyPlan.updateMany.mock.calls[0][0];
    expect(Object.keys(data)).toEqual(['legalContacts']);
    expect(summary).toMatchObject({ partsUnreadable: 1, partsUnsupported: 1, partsSealed: 1 });
  });

  it('never throws part of a plan away: a list holding something that is not text is left exactly as it is', async () => {
    db.safetyPlan.findMany.mockResolvedValueOnce([
      row('1', { safeLocations: ['12 Wattle St', { street: '9 Fig Ave' }], emergencyContacts: [{ name: 'Jo' }], exitStrategies: ['Take the bus'] }),
    ]);

    const summary = await sealSafetyPlans();

    // Sealing the first would have kept one line and lost the other; the second would have read as empty.
    const { data } = db.safetyPlan.updateMany.mock.calls[0][0];
    expect(Object.keys(data)).toEqual(['exitStrategies']);
    expect(summary).toMatchObject({ partsUnsupported: 2, partsSealed: 1 });
  });

  it('walks every row, a page at a time, from where the last page ended', async () => {
    db.safetyPlan.findMany
      .mockResolvedValueOnce([row('a', { safeLocations: ['1'] }), row('b', { safeLocations: ['2'] })])
      .mockResolvedValueOnce([row('c', { safeLocations: ['3'] })]);

    const summary = await sealSafetyPlans({ batchSize: 2 });

    expect(db.safetyPlan.findMany).toHaveBeenCalledTimes(2);
    expect(db.safetyPlan.findMany.mock.calls[0][0]).toMatchObject({ orderBy: { id: 'asc' }, take: 2 });
    expect(db.safetyPlan.findMany.mock.calls[0][0].cursor).toBeUndefined();
    expect(db.safetyPlan.findMany.mock.calls[1][0]).toMatchObject({ cursor: { id: 'b' }, skip: 1 });
    expect(summary).toMatchObject({ rowsSeen: 3, rowsSealed: 3 });
  });

  it('reports only counts: no id and no word of a plan', async () => {
    db.safetyPlan.findMany.mockResolvedValueOnce([row('secret-id', { safeLocations: ['12 Wattle St'] })]);

    const summary = await sealSafetyPlans();

    expect(JSON.stringify(summary)).not.toContain('secret-id');
    expect(JSON.stringify(summary)).not.toContain('Wattle');
  });
});
