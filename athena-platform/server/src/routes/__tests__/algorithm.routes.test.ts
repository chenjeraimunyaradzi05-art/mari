import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    userSkill: {
      findMany: jest.fn(),
    },
    job: {
      findMany: jest.fn(),
    },
    course: {
      findMany: jest.fn(),
    },
    event: {
      findMany: jest.fn(),
    },
    mentorProfile: {
      findMany: jest.fn(),
    },
    // Read by viewerContextFor (search.service) for Mentor Match's block and
    // hide-from-search filter.
    userSafetySettings: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    dvSafetyProfile: {
      findUnique: jest.fn(),
    },
    follow: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-123', role: 'USER', email: 'user@athena.com' };
    next();
  },
  optionalAuth: (req: any, _res: any, next: any) => {
    if (req.headers['x-test-auth'] === '1') {
      req.user = { id: 'user-123', role: 'USER', email: 'user@athena.com' };
    }
    next();
  },
  requireRole: (..._roles: string[]) => (_req: any, __res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/opensearch', () => ({
  initializeOpenSearch: jest.fn(),
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import app from '../../index';
import { prisma } from '../../utils/prisma';

const prismaAny: any = prisma;

describe('Algorithm Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaAny.userSafetySettings.findUnique.mockResolvedValue(null);
    prismaAny.userSafetySettings.findMany.mockResolvedValue([]);
    prismaAny.dvSafetyProfile.findUnique.mockResolvedValue(null);
    prismaAny.follow.findMany.mockResolvedValue([]);
  });

  it('GET /api/algorithms/career-compass returns skill gaps and courses', async () => {
    prismaAny.user.findUnique.mockResolvedValue({ currentJobTitle: 'Engineer', persona: 'EARLY_CAREER' });
    prismaAny.userSkill.findMany.mockResolvedValue([{ skill: { name: 'javascript' } }]);
    prismaAny.job.findMany.mockResolvedValue([
      {
        id: 'job-1',
        title: 'Software Engineer',
        city: 'Sydney',
        state: 'NSW',
        country: 'Australia',
        organization: { name: 'Acme' },
        skills: [{ skill: { name: 'javascript' } }, { skill: { name: 'react' } }],
      },
    ]);
    prismaAny.course.findMany.mockResolvedValue([
      { id: 'course-1', title: 'React Basics', providerName: 'Uni', type: 'bootcamp', cost: 100 },
    ]);

    const response = await request(app).get('/api/algorithms/career-compass').expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.targetRole).toBe('Engineer');
    expect(response.body.data.skillGaps).toEqual(expect.arrayContaining(['react']));
    expect(response.body.data.recommendedCourses).toHaveLength(1);
  });

  it('GET /api/algorithms/opportunity-scan returns jobs, courses, and events', async () => {
    prismaAny.job.findMany.mockResolvedValue([
      { id: 'job-1', title: 'Analyst', city: null, state: null, country: 'Australia', organization: { name: 'Org' } },
    ]);
    prismaAny.course.findMany.mockResolvedValue([
      { id: 'course-1', title: 'Data 101', providerName: 'TAFE', type: 'certificate' },
    ]);
    prismaAny.event.findMany.mockResolvedValue([
      { id: 'event-1', title: 'Career Fair', date: new Date(), location: 'Sydney', isFeatured: false },
    ]);

    const response = await request(app).get('/api/algorithms/opportunity-scan').expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.jobs).toHaveLength(1);
    expect(response.body.data.courses).toHaveLength(1);
    expect(response.body.data.events).toHaveLength(1);
    // A called-off event keeps its row for the women who registered, and is
    // not advertised to anyone else as something coming up.
    expect(prismaAny.event.findMany.mock.calls[0][0].where).toMatchObject({ isHidden: false, cancelledAt: null });
  });

  it('GET /api/algorithms/salary-equity returns market median', async () => {
    prismaAny.user.findUnique.mockResolvedValue({
      currentJobTitle: 'Designer',
      profile: { salaryMin: 80000, salaryMax: 100000 },
    });
    prismaAny.job.findMany.mockResolvedValue([
      { salaryMin: 70000, salaryMax: 90000 },
      { salaryMin: 80000, salaryMax: 100000 },
      { salaryMin: 90000, salaryMax: 110000 },
    ]);

    const response = await request(app).get('/api/algorithms/salary-equity').expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.marketMedian).toBeGreaterThan(0);
    expect(response.body.data.sampleSize).toBe(3);
  });

  it('GET /api/algorithms/mentor-match returns ranked mentors', async () => {
    prismaAny.userSkill.findMany.mockResolvedValue([{ skill: { name: 'product' } }]);
    prismaAny.mentorProfile.findMany.mockResolvedValue([
      {
        id: 'mentor-1',
        userId: 'mentor-user-1',
        specializations: ['product', 'strategy'],
        yearsExperience: 8,
        rating: 4.8,
        user: { firstName: 'Jane', lastName: 'Doe', avatar: null, headline: 'PM Leader' },
      },
    ]);

    const response = await request(app).get('/api/algorithms/mentor-match').expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.mentors).toHaveLength(1);
    expect(response.body.data.mentors[0].matchScore).toBeGreaterThan(0);
  });

  it('GET /api/algorithms/mentor-match does not rank or describe mentors by a rating nobody gave', async () => {
    prismaAny.userSkill.findMany.mockResolvedValue([{ skill: { name: 'product' } }]);
    prismaAny.mentorProfile.findMany.mockResolvedValue([
      {
        id: 'rated',
        userId: 'mentor-rated',
        specializations: ['strategy'],
        yearsExperience: 5,
        rating: 5,
        user: { firstName: 'Rated', lastName: 'Mentor', avatar: null, headline: null },
      },
      {
        id: 'shared-skill',
        userId: 'mentor-shared',
        specializations: ['product'],
        yearsExperience: 5,
        rating: null,
        user: { firstName: 'Shared', lastName: 'Skill', avatar: null, headline: null },
      },
    ]);

    const response = await request(app).get('/api/algorithms/mentor-match').expect(200);
    const mentors = response.body.data.mentors;

    // A shared skill is worth 3, five years of experience 1 either way; the
    // seeded 5.0 on the first mentor used to lift her above the one who shares a skill.
    expect(mentors.map((m: { id: string }) => m.id)).toEqual(['shared-skill', 'rated']);
    expect(mentors[1].matchScore).toBe(1);
    for (const mentor of mentors) {
      expect(mentor).not.toHaveProperty('rating');
      expect(mentor.matchReasons.join(' ')).not.toMatch(/rated/i);
    }
  });

  it('GET /api/algorithms/mentor-match leaves out blocked, hidden and suspended mentors, and her', async () => {
    prismaAny.userSkill.findMany.mockResolvedValue([]);
    prismaAny.mentorProfile.findMany.mockResolvedValue([]);
    // She blocked one man; another member blocked her.
    prismaAny.userSafetySettings.findUnique.mockResolvedValue({ blockedUsers: ['blocked-by-her'] });
    prismaAny.userSafetySettings.findMany.mockResolvedValue([{ userId: 'blocked-her' }]);

    await request(app).get('/api/algorithms/mentor-match').expect(200);

    const where = prismaAny.mentorProfile.findMany.mock.calls[0][0].where;
    expect(where.isAvailable).toBe(true);
    expect(where.userId).toEqual({ not: 'user-123' });
    expect(where.user.isSuspended).toBe(false);
    const conditions = JSON.stringify(where.user.AND);
    expect(conditions).toContain('blocked-by-her');
    expect(conditions).toContain('blocked-her');
    expect(conditions).toContain('hideFromSearch');
  });
});
