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
    courseEnrollment: {
      findMany: jest.fn(),
    },
    course: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-123', role: 'USER', email: 'user@athena.com', persona: 'EARLY_CAREER' };
    next();
  },
  optionalAuth: (req: any, _res: any, next: any) => {
    // Default: no user unless test sets header flag.
    if (req.headers['x-test-auth'] === '1') {
      req.user = { id: 'user-123', role: 'USER', email: 'user@athena.com', persona: 'EARLY_CAREER' };
    }
    next();
  },
  requireRole: (..._roles: string[]) => (_req: any, _res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

import { app } from '../../index';
import { prisma } from '../../utils/prisma';

describe('Course recommendations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // The anonymous list is ordered on how many members have enrolled, then on a
  // reported outcome rate where a provider has given one, then on newest. It
  // used to order on employmentRate alone and call that popularity — which was
  // an arbitrary order in practice, because nothing in the product writes
  // employmentRate and Postgres sorts nulls first on a DESC order.
  it('GET /api/courses/recommendations/for-me ranks anonymous visitors by enrolment, not by a column nobody writes', async () => {
    const mockCourses = [{ id: 'c1' }, { id: 'c2' }];
    (prisma.course.findMany as any).mockResolvedValue(mockCourses);

    const res = await request(app).get('/api/courses/recommendations/for-me').expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);

    expect(prisma.course.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 10,
        orderBy: [
          { enrollments: { _count: 'desc' } },
          { employmentRate: { sort: 'desc', nulls: 'last' } },
          { createdAt: 'desc' },
        ],
      }),
    );

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('GET /api/courses/recommendations/for-me personalizes for authenticated user', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      persona: 'EARLY_CAREER',
      currentJobTitle: 'Data Analyst',
      headline: 'Analytics and insights',
      profile: { remotePreference: 'remote' },
    });

    (prisma.courseEnrollment.findMany as any).mockResolvedValue([{ courseId: 'enrolled-1' }]);
    (prisma.userSkill.findMany as any).mockResolvedValue([{ skill: { name: 'data' } }]);

    const degreeOnsite = {
      id: 'degree-onsite',
      title: 'Leadership Degree',
      description: 'Learn management and leadership fundamentals.',
      isActive: true,
      type: 'degree',
      studyMode: ['full-time'],
      employmentRate: 95,
      createdAt: new Date('2026-01-01'),
      organization: { id: 'o1', name: 'Org', logo: null },
    };

    const bootcampOnline = {
      id: 'bootcamp-online',
      title: 'Data Analytics Bootcamp',
      description: 'Hands-on analytics, SQL, dashboards, and data storytelling.',
      isActive: true,
      type: 'bootcamp',
      studyMode: ['online'],
      employmentRate: 70,
      createdAt: new Date('2026-01-02'),
      organization: { id: 'o1', name: 'Org', logo: null },
    };

    (prisma.course.findMany as any).mockResolvedValue([degreeOnsite, bootcampOnline]);

    const res = await request(app)
      .get('/api/courses/recommendations/for-me')
      .set('x-test-auth', '1')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data[0].id).toBe('bootcamp-online');

    expect(prisma.courseEnrollment.findMany).toHaveBeenCalled();
    expect(prisma.course.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 50,
        // Nulls last, or the fifty-row pool the scorer works from is fifty
        // rows with no reported outcome picked in whatever order the database
        // returned them.
        orderBy: [{ employmentRate: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      }),
    );
  });
});
