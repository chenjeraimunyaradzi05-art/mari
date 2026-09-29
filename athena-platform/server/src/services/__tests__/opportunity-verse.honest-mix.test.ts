/**
 * The OpportunityVerse mixer, which nothing serves today (both of its routes
 * answer 410) but which would serve the next caller exactly what it builds.
 *
 * It stamped every job `matchScore: 70` and every course 60 when nothing had
 * compared either with the member, described courses as filling "your skill
 * gap" when a course has no skill data to check, and mixed in posts from
 * people she had blocked. These pin the version that says only what is true.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    job: { findMany: jest.fn() },
    course: { findMany: jest.fn() },
    userSkill: { findMany: jest.fn() },
    dvSafetyProfile: { findUnique: jest.fn() },
    userSafetySettings: { findUnique: jest.fn(), findMany: jest.fn() },
    follow: { findMany: jest.fn() },
  },
}));

jest.mock('../feed.service', () => ({
  generateFeed: jest.fn(),
  getTrendingPosts: jest.fn(),
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
import * as feedTyped from '../feed.service';
import { getMixedFeed } from '../opportunity-verse.service';

const prisma: any = prismaTyped;
const feed: any = feedTyped;

const post = (id: string, authorId: string, reasons?: string[]) => ({
  id,
  authorId,
  type: 'TEXT',
  content: id,
  decayedScore: 1,
  ...(reasons && { reasons }),
});

describe('getMixedFeed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // She blocked one member; another member blocked her.
    prisma.userSafetySettings.findUnique.mockResolvedValue({ blockedUsers: ['blocked-by-her'] });
    prisma.userSafetySettings.findMany.mockResolvedValue([{ userId: 'blocked-her' }]);
    prisma.dvSafetyProfile.findUnique.mockResolvedValue({ blockedUserIds: ['dv-blocked'] });
    prisma.follow.findMany.mockResolvedValue([]);
    prisma.userSkill.findMany.mockResolvedValue([{ skill: { name: 'SQL' } }]);

    const organic = Array.from({ length: 30 }, (_, i) => post(`organic-${i}`, `author-${i}`, ['You follow Ana']));
    feed.generateFeed.mockImplementation(async (options: { algorithm: string }) => ({
      posts: options.algorithm === 'personalized' ? organic : [post('discovery-0', 'author-x')],
      hasMore: false,
      total: 31,
    }));
    feed.getTrendingPosts.mockResolvedValue([
      post('trend-from-blocked', 'blocked-by-her'),
      post('trend-from-blocker', 'blocked-her'),
      post('trend-from-dv-block', 'dv-blocked'),
      post('trend-ok', 'author-y'),
    ]);

    prisma.job.findMany.mockResolvedValue([
      { id: 'job-shared', title: 'Data analyst', skills: [{ skill: { name: 'sql' } }, { skill: { name: 'Python' } }] },
      { id: 'job-none', title: 'Barista', skills: [] },
    ]);
    prisma.course.findMany.mockResolvedValue([{ id: 'course-1', title: 'Bookkeeping' }]);
  });

  it('leaves out everyone on either side of a block, from the feed and from trending', async () => {
    const result = await getMixedFeed('viewer-1', 1, 30);

    for (const call of feed.generateFeed.mock.calls) {
      expect(call[0].excludeAuthorIds).toEqual(
        expect.arrayContaining(['blocked-by-her', 'blocked-her', 'dv-blocked'])
      );
    }
    const ids = result.items.map((item) => item.id);
    expect(ids).not.toContain('trend-from-blocked');
    expect(ids).not.toContain('trend-from-blocker');
    expect(ids).not.toContain('trend-from-dv-block');
  });

  it('puts no fit score on a job or course and says only what was compared', async () => {
    const result = await getMixedFeed('viewer-1', 1, 30);
    const opportunities = result.items.filter((item) => item.type === 'opportunity');

    expect(opportunities.length).toBeGreaterThan(0);
    for (const item of opportunities) {
      expect(item.data).not.toHaveProperty('matchScore');
      expect(item.reason).not.toMatch(/great match|skill gap/i);
    }

    const byId = new Map(opportunities.map((item) => [item.id, item]));
    // The listing names SQL, and SQL is on her profile.
    expect(byId.get('job-shared')?.reason).toBe('Lists 1 of your skills');
    // It comes before the job that shares nothing with her.
    expect(opportunities[0].id).toBe('job-shared');
    if (byId.has('job-none')) expect(byId.get('job-none')?.reason).toBe('Recently posted role');
    if (byId.has('course-1')) expect(byId.get('course-1')?.reason).toBe('Recently added course');
  });

  it('passes on the reasons the feed gave a post rather than inventing its own', async () => {
    const result = await getMixedFeed('viewer-1', 1, 30);
    const organic = result.items.find((item) => item.type === 'organic');

    expect(organic?.reason).toBe('You follow Ana');
    expect(result.items.map((item) => item.reason)).not.toContain('Popular in your network');
  });
});
