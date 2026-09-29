/**
 * A mentor staff have suspended or banned cannot be found or booked.
 *
 * Suspending an account stopped her signing in and nothing else: her profile
 * stayed in the directory, her page offered times, and a mentee could have her
 * card held for a session with someone staff had just taken off the platform.
 * The mentor agreement now says a suspended mentor cannot be booked.
 */

jest.mock('../../utils/prisma', () => ({
  prisma: {
    mentorProfile: { findUnique: jest.fn(), findMany: jest.fn(async () => []), count: jest.fn(async () => 0) },
    mentorSession: { findMany: jest.fn(async () => []) },
    dvSafetyProfile: { findUnique: jest.fn(async () => null) },
    userSafetySettings: { findUnique: jest.fn(async () => null), findMany: jest.fn(async () => []) },
    follow: { findMany: jest.fn(async () => []) },
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  redactSensitive: (value: unknown) => value,
}));

import { prisma as prismaTyped } from '../../utils/prisma';
import { getMentorProfileById, getMentors, requestSession } from '../mentor.service';
import { getAvailableSlots } from '../mentor-scheduling.service';

const prisma: any = prismaTyped;

const SUSPENDED = { OR: [{ isSuspended: true }, { bannedAt: { not: null } }] };

describe('A suspended or banned mentor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('is left out of the directory', async () => {
    await getMentors({}, 1, 20, 'viewer-1');

    const where = prisma.mentorProfile.findMany.mock.calls[0][0].where;
    expect(where.user.AND).toContainEqual({ NOT: SUSPENDED });
  });

  it('has no public profile', async () => {
    prisma.mentorProfile.findUnique.mockResolvedValue(null);

    await expect(getMentorProfileById('mp-1')).resolves.toBeNull();
    expect(prisma.mentorProfile.findUnique.mock.calls[0][0].where).toEqual({ id: 'mp-1', user: { NOT: SUSPENDED } });
  });

  it('cannot be asked for a session', async () => {
    prisma.mentorProfile.findUnique.mockResolvedValue(null);

    await expect(
      requestSession('mentee-1', 'mp-1', { scheduledAt: new Date(Date.now() + 86_400_000) })
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(prisma.mentorProfile.findUnique.mock.calls[0][0].where).toEqual({ id: 'mp-1', user: { NOT: SUSPENDED } });
  });

  it('offers no times', async () => {
    prisma.mentorProfile.findUnique.mockResolvedValue({
      id: 'mp-1',
      isAvailable: true,
      user: { timezone: 'Australia/Brisbane', isSuspended: true, bannedAt: null },
    });

    await expect(getAvailableSlots('mp-1', new Date(), 'Australia/Brisbane')).resolves.toEqual([]);
    expect(prisma.mentorSession.findMany).not.toHaveBeenCalled();
  });
});
