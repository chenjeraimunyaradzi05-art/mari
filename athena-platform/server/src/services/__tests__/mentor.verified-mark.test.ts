/**
 * The mentor directory and a mentor's page draw the Verified mark from
 * User.isVerified, which only an approved identity check sets. Neither read it
 * before, so no mentor could show one; and a mentor's own badge (reviewed by a
 * person, with no rule behind it) must not be drawn as the same thing.
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
import { getMentorProfileById, getMentors } from '../mentor.service';

const prisma: any = prismaTyped;

describe('the Verified mark on mentors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('is asked for by the directory and by a mentor\'s own page', async () => {
    prisma.mentorProfile.findUnique.mockResolvedValue(null);

    await getMentors({}, 1, 20, 'viewer-1');
    await getMentorProfileById('mp-1');

    expect(prisma.mentorProfile.findMany.mock.calls[0][0].select.user.select.isVerified).toBe(true);
    expect(prisma.mentorProfile.findUnique.mock.calls[0][0].select.user.select.isVerified).toBe(true);
  });

  it('comes through on the profile exactly as the column has it', async () => {
    const row = (isVerified: boolean) => ({
      id: 'mp-1',
      userId: 'u1',
      specializations: [],
      yearsExperience: 5,
      hourlyRate: null,
      isAvailable: true,
      sessionCount: 0,
      isMonetized: false,
      stripeAccountId: null,
      createdAt: new Date('2026-09-01T00:00:00Z'),
      user: { id: 'u1', displayName: 'Ana M.', avatar: null, isVerified, headline: null, bio: null, experience: [], education: [] },
    });

    prisma.mentorProfile.findUnique.mockResolvedValue(row(true));
    await expect(getMentorProfileById('mp-1')).resolves.toMatchObject({ user: { isVerified: true } });

    prisma.mentorProfile.findUnique.mockResolvedValue(row(false));
    await expect(getMentorProfileById('mp-1')).resolves.toMatchObject({ user: { isVerified: false } });
  });
});
