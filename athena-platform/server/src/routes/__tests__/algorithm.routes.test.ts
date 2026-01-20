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
});
