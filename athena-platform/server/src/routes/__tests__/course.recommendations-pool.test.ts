import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/**
 * The personalised list used to score only the fifty newest courses, because
 * the reported-outcome ordering in front of them does nothing while no course
 * has a reported outcome. A course whose title was exactly her job, listed
 * before the latest fifty, never reached the scorer. And the keyword match was
 * a substring match, so "art" scored in "start" and "smart".
 */

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    userSkill: { findMany: jest.fn(async () => []) },
    courseEnrollment: { findMany: jest.fn(async () => []) },
    course: { findMany: jest.fn(async () => []), count: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn() },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-1', role: 'USER', email: 'u@athena.com', persona: 'CREATOR' };
    next();
  },
  optionalAuth: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-1', role: 'USER', email: 'u@athena.com', persona: 'CREATOR' };
    next();
  },
  requireRole: (..._roles: string[]) => (_req: any, _res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;

const course = (id: string, title: string, over: Record<string, unknown> = {}) => ({
  id,
  title,
  description: '',
  type: null,
  studyMode: [],
  employmentRate: null,
  createdAt: new Date('2026-01-01'),
  organization: null,
  ...over,
});

describe('Personalised course recommendations: the pool and the match', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue({
      persona: 'CREATOR',
      currentJobTitle: 'Ceramic artist',
      headline: 'Painting and ceramics',
      profile: { remotePreference: null },
    });
  });

  it('asks the database for the courses that match her own words, as well as the newest', async () => {
    prisma.course.findMany
      // The relevance half: an older course that is exactly her work.
      .mockResolvedValueOnce([course('old-ceramics', 'Ceramics for working artists', { createdAt: new Date('2024-02-01') })])
      // The newest fifty, none of which is.
      .mockResolvedValueOnce([course('new-1', 'Start your business'), course('new-2', 'Smart spreadsheets')]);

    const res = await request(app).get('/api/courses/recommendations/for-me').expect(200);

    const relevanceQuery = prisma.course.findMany.mock.calls[0][0];
    const clauses = relevanceQuery.where.AND[1].OR;
    expect(clauses).toContainEqual({ type: { in: ['bootcamp', 'short_course', 'certificate'] } });
    expect(clauses).toContainEqual({ title: { contains: 'ceramics', mode: 'insensitive' } });
    // Stopwords are not keywords.
    expect(clauses).not.toContainEqual({ title: { contains: 'and', mode: 'insensitive' } });

    expect(res.body.data[0].id).toBe('old-ceramics');
  });

  it('matches a keyword as a word, so "art" does not score in "start"', async () => {
    prisma.user.findUnique.mockResolvedValue({ persona: 'MENTOR', currentJobTitle: 'Art teacher', headline: null, profile: null });
    prisma.course.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        course('start', 'Start and scale a small business', { createdAt: new Date('2026-03-01') }),
        course('art', 'Art therapy foundations', { createdAt: new Date('2026-02-01') }),
      ]);

    const res = await request(app).get('/api/courses/recommendations/for-me').expect(200);
    expect(res.body.data.map((c: any) => c.id)).toEqual(['art', 'start']);
  });
});
