/**
 * "New here? Start with these" (GET /api/feed/cold-start).
 *
 * The job query asked Prisma for `location` and `experienceLevel`, which are
 * not Job columns, and every member has a country, so every call failed and
 * the rail never showed. Behind that failure sat picks that would have been
 * unsafe the day it worked: members offered as "people to meet" whatever
 * their hide-from-search switch, block list or profile privacy said, mentors
 * ordered by a rating nobody can give, posts outside their author's audience,
 * and groups moderators had hidden. The assertions are on the where clauses,
 * because each of these has to be filtered in the query, not after it.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn(), findMany: jest.fn() },
    userSkill: { findMany: jest.fn() },
    post: { findMany: jest.fn() },
    course: { findMany: jest.fn() },
    job: { findMany: jest.fn() },
    mentorProfile: { findMany: jest.fn() },
    group: { findMany: jest.fn() },
    dvSafetyProfile: { findUnique: jest.fn() },
    userSafetySettings: { findUnique: jest.fn(), findMany: jest.fn() },
    follow: { findMany: jest.fn() },
  },
}));

jest.mock('../../utils/opensearch', () => ({
  getOpenSearchClient: () => null,
  IndexNames: {},
}));

jest.mock('../../utils/cache', () => ({
  cacheGetOrSet: jest.fn(),
  CacheKeys: {},
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { prisma as prismaTyped } from '../../utils/prisma';
import { getColdStartRecommendations } from '../cold-start.service';

const prisma: any = prismaTyped;

/** Every Job scalar a where clause may name. `location` and `experienceLevel` are not among them. */
const JOB_FIELDS = new Set([
  'id', 'title', 'slug', 'description', 'organizationId', 'postedById', 'type', 'status', 'city', 'state',
  'country', 'isRemote', 'salaryMin', 'salaryMax', 'salaryType', 'showSalary', 'experienceMin', 'experienceMax',
  'deadline', 'publishedAt', 'closedAt', 'viewCount', 'applicationCount', 'isSponsored', 'isFeatured',
  'createdAt', 'updatedAt', 'AND', 'OR', 'NOT',
]);

describe('getColdStartRecommendations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue({
      id: 'viewer-1',
      persona: 'EARLY_CAREER',
      city: 'Brisbane',
      country: 'Australia',
      skills: [{ skill: { name: 'Communication' } }],
    });
    prisma.userSkill.findMany.mockResolvedValue([{ skill: { name: 'Communication' } }]);
    prisma.userSafetySettings.findUnique.mockResolvedValue({ blockedUsers: ['blocked-by-her'] });
    prisma.userSafetySettings.findMany.mockResolvedValue([{ userId: 'blocked-her' }]);
    prisma.dvSafetyProfile.findUnique.mockResolvedValue(null);
    prisma.follow.findMany.mockResolvedValue([{ followingId: 'already-followed' }]);
    prisma.post.findMany.mockResolvedValue([]);
    prisma.course.findMany.mockResolvedValue([]);
    prisma.mentorProfile.findMany.mockResolvedValue([]);
    prisma.user.findMany.mockResolvedValue([]);
    prisma.group.findMany.mockResolvedValue([]);
    prisma.job.findMany.mockImplementation(async (args: { where: { city?: unknown } }) =>
      args.where.city
        ? [{ id: 'job-local', title: 'Junior analyst', city: 'Brisbane' }]
        : [{ id: 'job-elsewhere', title: 'Graduate engineer', city: 'Cairns' }]
    );
  });

  it('asks for jobs only by columns Job has, and says where a role is only when it is there', async () => {
    const picks = await getColdStartRecommendations('viewer-1');

    for (const [args] of prisma.job.findMany.mock.calls) {
      for (const key of Object.keys(args.where)) expect(JOB_FIELDS.has(key)).toBe(true);
    }
    expect(prisma.job.findMany.mock.calls[0][0].where.city).toEqual({ equals: 'Brisbane', mode: 'insensitive' });

    const jobs = picks.filter((pick) => pick.type === 'JOB');
    expect(jobs.find((pick) => pick.id === 'job-local')?.reason).toBe('In Brisbane');
    expect(jobs.find((pick) => pick.id === 'job-elsewhere')?.reason).toBe('Recently posted role');
  });

  it('offers no one as a person to meet who is blocked either way, hidden, private, suspended, followed or her', async () => {
    await getColdStartRecommendations('viewer-1');

    const where = prisma.user.findMany.mock.calls[0][0].where;
    const text = JSON.stringify(where);
    expect(text).toContain('blocked-by-her');
    expect(text).toContain('blocked-her');
    expect(text).toContain('hideFromSearch');
    expect(text).toContain('"profileVisibility":"private"');
    expect(text).toContain('"isSuspended":false');
    expect(text).toContain('already-followed');
    expect(text).toContain('viewer-1');
  });

  it('takes mentors from Mentor Match, filtered the same way and never ordered by rating', async () => {
    prisma.mentorProfile.findMany.mockResolvedValue([
      {
        id: 'mentor-1',
        userId: 'mentor-user-1',
        specializations: ['communication'],
        yearsExperience: 6,
        rating: 5,
        user: { firstName: 'Mai', lastName: 'Tran', avatar: null, headline: null },
      },
    ]);

    const picks = await getColdStartRecommendations('viewer-1');

    const args = prisma.mentorProfile.findMany.mock.calls[0][0];
    expect(JSON.stringify(args.orderBy ?? null)).not.toContain('rating');
    expect(args.where.user.isSuspended).toBe(false);
    expect(JSON.stringify(args.where.user)).toContain('blocked-by-her');

    const mentor = picks.find((pick) => pick.type === 'MENTOR');
    expect(mentor?.title).toBe('Mai Tran');
    expect(mentor?.reason).toBe('Shared skills: communication');
  });

  it('keeps posts inside their author’s audience and away from blocks', async () => {
    await getColdStartRecommendations('viewer-1');

    const where = prisma.post.findMany.mock.calls[0][0].where;
    expect(where.isPublic).toBe(true);
    expect(where.isHidden).toBe(false);
    const text = JSON.stringify(where);
    expect(text).toContain('profileVisibility');
    expect(text).toContain('"groupId":null');
    expect(text).toContain('blocked-her');
  });

  it('suggests no group that moderators hid, she is already in, or a blocked member started', async () => {
    await getColdStartRecommendations('viewer-1');

    const where = prisma.group.findMany.mock.calls[0][0].where;
    expect(where.isHidden).toBe(false);
    expect(where.members).toEqual({ none: { userId: 'viewer-1' } });
    expect(where.createdById.notIn).toEqual(expect.arrayContaining(['blocked-by-her', 'blocked-her']));
  });
});
