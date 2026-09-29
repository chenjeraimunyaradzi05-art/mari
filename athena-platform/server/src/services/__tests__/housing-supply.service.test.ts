import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/**
 * The supply side of housing, without HTTP: the check clock, the rules a
 * staff-entered listing is written by, a partner's spreadsheet, and the sweep
 * that tells admins a DV-safe listing has waited too long.
 */

jest.mock('../../utils/prisma', () => ({
  prisma: {
    housingListing: { findMany: jest.fn() },
    user: { findMany: jest.fn() },
    notification: { createMany: jest.fn() },
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../utils/ops-metrics', () => ({ recordFailure: jest.fn() }));

import { prisma as prismaTyped } from '../../utils/prisma';
import { recordFailure } from '../../utils/ops-metrics';
import {
  SAFETY_CHECK_QUEUE_WHERE,
  alertOverdueSafetyChecks,
  checkRequestedAt,
  planHousingImport,
  publicFeatures,
  safetyCheckClock,
  staffListingData,
  staffListingSchema,
  withSafetyCheckRequest,
} from '../housing-supply.service';

const prisma: any = prismaTyped;
const HOUR = 60 * 60 * 1000;
const now = new Date('2026-09-26T00:00:00.000Z');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('the check clock', () => {
  it('starts when the check was asked for, not when the listing was made', () => {
    const asked = new Date(now.getTime() - 10 * HOUR);
    const listing = { createdAt: new Date(now.getTime() - 500 * HOUR), features: withSafetyCheckRequest(['Garden'], 'note', asked) };
    expect(checkRequestedAt(listing)?.toISOString()).toBe(asked.toISOString());
    expect(safetyCheckClock(listing, now)).toEqual({
      requestedAt: asked.toISOString(),
      dueAt: new Date(asked.getTime() + 48 * HOUR).toISOString(),
      overdue: false,
      hoursWaiting: 10,
    });
  });

  it('reads a listing held before the clock existed as waiting since it was made', () => {
    const created = new Date(now.getTime() - 49 * HOUR);
    expect(safetyCheckClock({ createdAt: created, features: ['dv-safe-note:x'] }, now)).toMatchObject({ overdue: true, hoursWaiting: 49 });
  });

  it('keeps both tags out of what a member sees, and a second request replaces the first', () => {
    const first = withSafetyCheckRequest(['Garden'], 'one', new Date(now.getTime() - HOUR));
    const second = withSafetyCheckRequest(first, 'two', now);
    expect(second).toEqual(['Garden', 'dv-safe-note:two', `dv-safe-check-requested:${now.toISOString()}`]);
    expect(publicFeatures(second)).toEqual(['Garden']);
    expect(publicFeatures(['ok', 3, null])).toEqual(['ok']);
  });
});

describe('a listing staff enter', () => {
  const base = staffListingSchema.parse({ title: 'Unit', description: 'Quiet', type: 'RENTAL' });

  it('is live at once when it claims nothing', () => {
    expect(staffListingData(base, 'lister', { safetyVerified: false, now })).toMatchObject({ agentId: 'lister', status: 'ACTIVE', dvSafe: false, safetyVerified: false, features: [] });
  });

  it('claiming DV-safe unchecked is held with its clock; checked it is live and nothing waits', () => {
    const claim = staffListingSchema.parse({ title: 'Unit', description: 'Quiet', type: 'RENTAL', dvSafe: 'yes', dvSafeNote: 'On-site staff' });
    const held = staffListingData(claim, 'lister', { safetyVerified: false, now });
    expect(held).toMatchObject({ status: 'PENDING', safetyVerified: false });
    expect(held.features).toContain(`dv-safe-check-requested:${now.toISOString()}`);

    const live = staffListingData(claim, 'lister', { safetyVerified: true, now });
    expect(live).toMatchObject({ status: 'ACTIVE', safetyVerified: true, features: ['dv-safe-note:On-site staff'] });
  });

  it('never marks checked a listing that does not claim to be DV-safe', () => {
    expect(staffListingData(base, 'lister', { safetyVerified: true, now })).toMatchObject({ safetyVerified: false, status: 'ACTIVE' });
  });
});

describe("a partner's spreadsheet", () => {
  it('reads quoted cells, dollar amounts and yes/no, and lists features split by a bar', () => {
    const plan = planHousingImport('title,description,type,rentWeekly,features,petFriendly\n"Room, Toowong","Two ""quiet"" housemates",SHARE,"$1,050",Garden | Parking,Yes\n');
    expect(plan.errors).toEqual([]);
    expect(plan.rows).toHaveLength(1);
    expect(plan.rows[0].input).toMatchObject({ title: 'Room, Toowong', description: 'Two "quiet" housemates', type: 'SHARE', rentWeekly: 1050, features: ['Garden', 'Parking'], petFriendly: true });
  });

  it('says which line and which field is wrong', () => {
    const plan = planHousingImport('title,description,type,bedrooms,petFriendly\nA,B,RENTAL,two,no\nC,D,RENTAL,1,perhaps\n');
    expect(plan.rows).toEqual([]);
    expect(plan.errors).toEqual([
      { line: 2, title: 'A', message: 'bedrooms is a whole number' },
      { line: 3, title: 'C', message: 'petFriendly is yes or no' },
    ]);
  });

  it('refuses a sheet without the required columns, or with a column twice, before reading a row', () => {
    expect(planHousingImport('title,description\nA,B\n').errors[0].message).toBe('Required columns missing: type');
    expect(planHousingImport('title,description,type,type\nA,B,RENTAL,SHARE\n').errors[0].message).toContain('A column appears twice: type');
    expect(planHousingImport('').errors[0].message).toBe('The file is empty');
  });

  it('catches a row whose commas were not quoted', () => {
    const plan = planHousingImport('title,description,type\nRoom,Near the train, the bus and shops,RENTAL\n');
    expect(plan.errors[0]).toMatchObject({ line: 2, message: expect.stringContaining('needs the cell in double quotes') });
  });

  it('will not take more than one partner-sized batch', () => {
    const rows = Array.from({ length: 201 }, (_v, i) => `Room ${i},Desc,RENTAL`).join('\n');
    expect(planHousingImport(`title,description,type\n${rows}\n`).errors[0].message).toContain('more than one import takes (200)');
  });
});

describe('the overdue sweep', () => {
  const waiting = (id: string, hoursAgo: number) => ({ id, title: `Listing ${id}`, city: 'Brisbane', features: [], createdAt: new Date(now.getTime() - hoursAgo * HOUR) });

  it('reads the same queue the admin page shows', async () => {
    prisma.housingListing.findMany.mockResolvedValue([]);
    await alertOverdueSafetyChecks(now);
    expect(prisma.housingListing.findMany.mock.calls[0][0].where).toBe(SAFETY_CHECK_QUEUE_WHERE);
  });

  it('tells nobody when nothing is late', async () => {
    prisma.housingListing.findMany.mockResolvedValue([waiting('a', 5)]);
    await expect(alertOverdueSafetyChecks(now)).resolves.toEqual({ waiting: 1, overdue: 0, notified: 0 });
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });

  it('tells every active admin how many are late, naming the one that has waited longest', async () => {
    prisma.housingListing.findMany.mockResolvedValue([waiting('a', 50), waiting('b', 72), waiting('c', 3)]);
    prisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }, { id: 'admin-2' }]);
    prisma.notification.createMany.mockResolvedValue({ count: 2 });

    await expect(alertOverdueSafetyChecks(now)).resolves.toEqual({ waiting: 3, overdue: 2, notified: 2 });

    expect(prisma.user.findMany.mock.calls[0][0].where).toEqual({ role: 'ADMIN', isActive: true });
    const rows = prisma.notification.createMany.mock.calls[0][0].data;
    expect(rows.map((r: any) => r.userId)).toEqual(['admin-1', 'admin-2']);
    expect(rows[0].title).toBe('2 safe-housing checks are overdue');
    expect(rows[0].message).toContain('"Listing b" in Brisbane, has waited 72 hours');
    expect(rows[0].data).toEqual({ kind: 'HOUSING_SAFETY_CHECK_OVERDUE', overdue: 2, listingIds: ['b', 'a'] });
  });

  it('puts a late queue with no admin to tell, or a failed send, on the operations screen instead of throwing', async () => {
    prisma.housingListing.findMany.mockResolvedValue([waiting('a', 50)]);
    prisma.user.findMany.mockResolvedValue([]);
    await expect(alertOverdueSafetyChecks(now)).resolves.toEqual({ waiting: 1, overdue: 1, notified: 0 });
    expect(recordFailure).toHaveBeenCalledWith('housing.safety-check-overdue', expect.any(Error));

    prisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);
    prisma.notification.createMany.mockRejectedValue(new Error('db down'));
    await expect(alertOverdueSafetyChecks(now)).resolves.toEqual({ waiting: 1, overdue: 1, notified: 0 });
    expect(recordFailure).toHaveBeenCalledTimes(2);
  });
});
