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
  MAX_LISTING_IMAGES,
  SAFETY_CHECK_QUEUE_WHERE,
  alertOverdueSafetyChecks,
  checkRequestedAt,
  cleanListingImages,
  confidentialTextProblem,
  listingImagesProblem,
  planHousingImport,
  publicFeatures,
  safetyCheckClock,
  staffListingData,
  staffListingSchema,
  takenDownByStaff,
  withCheckedNote,
  withSafetyCheckRequest,
  withStaffTakedown,
  withoutSafetyCheckRequest,
  withoutStaffTakedown,
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

describe('the staff take-down mark', () => {
  const marked = withStaffTakedown(['Garden', 'dv-safe-note:quiet'], now);

  it('is written once, beside what the listing already carries, and is not a feature a member sees', () => {
    expect(marked).toEqual(['Garden', 'dv-safe-note:quiet', `staff-takedown:${now.toISOString()}`]);
    expect(withStaffTakedown(marked, new Date(now.getTime() + HOUR))).toHaveLength(3);
    expect(takenDownByStaff(marked)).toBe(true);
    expect(publicFeatures(marked)).toEqual(['Garden']);
  });

  it('is on only where staff put it: no features, a list of plain features, or something that is not a list', () => {
    expect(takenDownByStaff(['Garden'])).toBe(false);
    expect(takenDownByStaff([])).toBe(false);
    expect(takenDownByStaff(null)).toBe(false);
    expect(takenDownByStaff('staff-takedown:x')).toBe(false);
  });

  it('is carried over by every helper that rebuilds the features, so asking for a check does not wash it off', () => {
    expect(takenDownByStaff(withSafetyCheckRequest(marked, 'new note', now))).toBe(true);
    expect(takenDownByStaff(withoutSafetyCheckRequest(marked))).toBe(true);
    expect(takenDownByStaff(withCheckedNote(marked, 'checked'))).toBe(true);
    expect(withSafetyCheckRequest(marked, 'new note', now).filter((f) => f.startsWith('staff-takedown:'))).toHaveLength(1);
  });

  it('is taken off only by staff putting the listing back, and nothing else goes with it', () => {
    expect(withoutStaffTakedown(marked)).toEqual(['Garden', 'dv-safe-note:quiet']);
    expect(withoutStaffTakedown(undefined)).toEqual([]);
  });

  it('cannot be written by a member, or by a spreadsheet a partner sent', () => {
    expect(publicFeatures(['Garden', 'staff-takedown:2026-01-01T00:00:00.000Z'])).toEqual(['Garden']);
    const input = staffListingSchema.parse({ title: 'Unit', description: 'Quiet', type: 'RENTAL', features: ['Garden', 'staff-takedown:2026-01-01T00:00:00.000Z'] });
    expect(staffListingData(input, 'lister', { safetyVerified: false }).features).toEqual(['Garden']);
    const held = staffListingData({ ...input, type: 'EMERGENCY' }, 'lister', { safetyVerified: false, now });
    expect(takenDownByStaff(held.features)).toBe(false);
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

/**
 * The words on a confidential listing: every eligible member reads them before
 * the lister has answered anyone, which is when the address is withheld, so
 * they carry neither the street address nor a phone number to ring for it.
 */
describe('the words on a confidential listing', () => {
  it.each([
    'Secure unit at 12 Example Street, Ashgrove',
    'Flat 3/12 Example St',
    'Unit 4, 12 Example Street',
    'No. 7 Hidden Lane, behind the shops',
    'Lot 15 Settlers Rd',
    'Level 2, 45 Example Ave',
  ])('reads "%s" as a street address', (text) => {
    expect(confidentialTextProblem(text)).toMatchObject({ found: 'a street address', message: expect.stringContaining('Leave the street address out') });
  });

  it.each([
    'Two bedrooms, 5 min walk to the shops and 10 min drive to the city',
    '2 bedrooms close to transport, 3 beds, 1 bath',
    'Ten minutes to the station on Oxford St',
    '100m to the park',
    'Available for 6 weeks from March, $450 a week',
    'Lifts, 4 levels, and a quiet way in',
  ])('does not read "%s" as one', (text) => {
    expect(confidentialTextProblem(text)).toBeNull();
  });

  it.each(['Ring 0400 000 000 for the address', 'Call (07) 3123 4567', 'Text +61 400 000 000', 'Phone 1800 123 456 any time'])('reads "%s" as a phone number', (text) => {
    expect(confidentialTextProblem(text)).toMatchObject({ found: 'a phone number', message: expect.stringContaining('Leave phone numbers out') });
  });

  it('leaves a rent, a bond, a postcode and a date alone', () => {
    expect(confidentialTextProblem('$450 a week, bond $1800, Ashgrove 4060, free from 02/11/2026')).toBeNull();
  });

  it('reads the title and the description together, and nothing when both are empty', () => {
    expect(confidentialTextProblem('Quiet unit', 'at 12 Example Street')).toMatchObject({ found: 'a street address' });
    expect(confidentialTextProblem('', null, undefined)).toBeNull();
  });

  it("holds a partner's sheet to the same rule, on confidential rows only", () => {
    const row = { title: 'Unit', description: 'Secure unit at 12 Example Street', type: 'EMERGENCY' };
    const refused = staffListingSchema.safeParse(row);
    expect(refused.success).toBe(false);
    if (!refused.success) expect(refused.error.issues[0]).toMatchObject({ path: ['description'], message: expect.stringContaining('carries a street address') });
    expect(staffListingSchema.safeParse({ ...row, type: 'RENTAL' }).success).toBe(true);
  });
});

describe('the pictures on a listing', () => {
  it('takes nothing, or a short list of http(s) links, and says what is wrong otherwise', () => {
    expect(listingImagesProblem(undefined)).toBeNull();
    expect(listingImagesProblem(null)).toBeNull();
    expect(listingImagesProblem(['https://cdn.example.com/a.jpg'])).toBeNull();
    expect(listingImagesProblem('https://cdn.example.com/a.jpg')).toContain('list of links');
    expect(listingImagesProblem(['javascript:alert(1)'])).toContain('http or https');
    expect(listingImagesProblem(['data:image/png;base64,AAAA'])).toContain('http or https');
    expect(listingImagesProblem([{ url: 'https://cdn.example.com/a.jpg' }])).toContain('http or https');
    expect(listingImagesProblem([`https://cdn.example.com/${'a'.repeat(600)}.jpg`])).toContain('http or https');
    expect(listingImagesProblem(Array.from({ length: MAX_LISTING_IMAGES + 1 }, () => 'https://cdn.example.com/a.jpg'))).toContain(`at most ${MAX_LISTING_IMAGES}`);
  });

  it('stores the links trimmed, and nothing when none were given', () => {
    expect(cleanListingImages([' https://cdn.example.com/a.jpg '])).toEqual(['https://cdn.example.com/a.jpg']);
    expect(cleanListingImages(undefined)).toBeUndefined();
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
