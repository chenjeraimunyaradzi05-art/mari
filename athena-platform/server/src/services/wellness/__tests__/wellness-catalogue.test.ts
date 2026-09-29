/**
 * What a boot may write into the wellness directory.
 *
 * The start-up upsert used to set isVerified and isActive on every run, so an
 * admin who took a seeded service out of the directory saw it return at the
 * next restart, and every seeded service carried a Verified chip no check had
 * earned. A boot now refreshes the words and nothing else.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../../utils/prisma', () => ({
  prisma: {
    wellnessForum: { upsert: jest.fn(async () => ({})) },
    healthPractitioner: { upsert: jest.fn(async () => ({})) },
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { prisma as prismaTyped } from '../../../utils/prisma';
import { ensureWellnessCatalogue } from '../wellness-catalogue';
import { FORUM_SEEDS, SERVICE_SEEDS } from '../wellness-library';

const prisma: any = prismaTyped;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ensureWellnessCatalogue', () => {
  it('creates a seeded service unverified, so it waits for staff like any other listing', async () => {
    await ensureWellnessCatalogue();

    expect(prisma.healthPractitioner.upsert).toHaveBeenCalledTimes(SERVICE_SEEDS.length);
    for (const [args] of prisma.healthPractitioner.upsert.mock.calls as any[]) {
      expect(args.create.isVerified).toBe(false);
    }
  });

  it('never overrides a staff decision to delist, unverify or close on a restart', async () => {
    await ensureWellnessCatalogue();

    for (const [args] of prisma.healthPractitioner.upsert.mock.calls as any[]) {
      expect(args.update).not.toHaveProperty('isVerified');
      expect(args.update).not.toHaveProperty('isActive');
      // The words still follow the code, which is what the upsert is for.
      expect(args.update).toHaveProperty('headline');
    }
    expect(prisma.wellnessForum.upsert).toHaveBeenCalledTimes(FORUM_SEEDS.length);
    for (const [args] of prisma.wellnessForum.upsert.mock.calls as any[]) {
      expect(args.update).not.toHaveProperty('isActive');
    }
  });
});
