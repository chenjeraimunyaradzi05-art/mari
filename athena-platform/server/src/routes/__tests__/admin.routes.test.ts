import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mocks must be defined before imports that use them
jest.mock('../../utils/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    user: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      groupBy: jest.fn(),
    },
    job: {
      count: jest.fn(),
    },
    post: {
      count: jest.fn(),
    },
    comment: {
      count: jest.fn(),
    },
    like: {
      count: jest.fn(),
    },
    jobApplication: {
      count: jest.fn(),
    },
    course: {
      count: jest.fn(),
    },
    mentorProfile: {
      count: jest.fn(),
    },
    subscription: {
      count: jest.fn(),
    },
    group: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    groupMember: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    groupPost: {
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    event: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, res: any, next: any) => {
    req.user = { id: 'admin-123', role: 'ADMIN', email: 'admin@athena.com' };
    next();
  },
  requireRole: (role: string) => (req: any, res: any, next: any) => {
    next(); // Pass through
  },
  optionalAuth: (req: any, res: any, next: any) => {
    next(); // Pass through
  },
  requirePremium: (req: any, res: any, next: any) => {
    next(); // Pass through
  },
}));

// Import App after mocks
import app from '../../index';
import { prisma } from '../../utils/prisma';

describe('Admin Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/admin/stats', () => {
    it('should return dashboard statistics', async () => {
      // Setup mock returns - using 'any' to bypass strict jest.Mock typing issues
      (prisma.user.count as any).mockResolvedValue(100);
      (prisma.job.count as any).mockResolvedValue(50);
      (prisma.post.count as any).mockResolvedValue(200);
      (prisma.course.count as any).mockResolvedValue(10);
      (prisma.mentorProfile.count as any).mockResolvedValue(5);
      (prisma.subscription.count as any).mockResolvedValue(20);
      
      (prisma.user.groupBy as any).mockResolvedValue([]);

      const response = await request(app).get('/api/admin/stats');

      expect(response.status).toBe(200);
      // The response is direct, not wrapped in { success, data }
      expect(response.body).toEqual(expect.objectContaining({
        overview: expect.objectContaining({
            totalUsers: 100,
            totalJobs: 50,
            totalPosts: 200,
            totalCourses: 10,
            totalMentors: 5
        }),
        subscriptions: expect.objectContaining({
             total: 20
        })
      }));
      
      // Verify all counts were called
      expect(prisma.user.count).toHaveBeenCalledTimes(2); // total + new users
    });
  });

  describe('GET /api/admin/users', () => {
    it('should return paginated users', async () => {
      const mockUsers = [
        { id: '1', email: 'user1@test.com', role: 'USER' },
        { id: '2', email: 'user2@test.com', role: 'USER' },
      ];

      (prisma.user.count as any).mockResolvedValue(2);
      (prisma.user.findMany as any).mockResolvedValue(mockUsers);

      const response = await request(app).get('/api/admin/users');

      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(2); // Direct property
      expect(response.body.pagination.total).toBe(2);
    });
  });

  describe('Admin Groups CRUD', () => {
    it('GET /api/admin/groups returns paginated groups', async () => {
      (prisma.group.findMany as any).mockResolvedValue([
        {
          id: 'g1',
          name: 'Group 1',
          description: 'Desc',
          privacy: 'PUBLIC',
          isFeatured: false,
          isPinned: true,
          isHidden: false,
          createdById: 'u1',
          createdAt: new Date('2026-01-10T00:00:00.000Z'),
          updatedAt: new Date('2026-01-10T00:00:00.000Z'),
          _count: { members: 3, posts: 1 },
        },
      ]);
      (prisma.group.count as any).mockResolvedValue(1);

      const response = await request(app).get('/api/admin/groups').expect(200);
      expect(response.body.groups).toHaveLength(1);
      expect(response.body.pagination.total).toBe(1);
    });

    it('PATCH /api/admin/groups/:id maps privacy and flags', async () => {
      (prisma.group.findUnique as any).mockResolvedValue({ id: 'g1' });
      (prisma.group.update as any).mockResolvedValue({ id: 'g1', privacy: 'PRIVATE', isFeatured: true, isPinned: false });

      const response = await request(app)
        .patch('/api/admin/groups/g1')
        .send({ privacy: 'private', isFeatured: true, isPinned: false })
        .expect(200);

      expect(response.body.id).toBe('g1');
      expect(prisma.group.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'g1' },
          data: expect.objectContaining({ privacy: 'PRIVATE', isFeatured: true, isPinned: false }),
        })
      );
    });
  });

  describe('Admin Events CRUD', () => {
    it('GET /api/admin/events returns paginated events', async () => {
      (prisma.event.findMany as any).mockResolvedValue([{ id: 'e1', title: 'Event 1' }]);
      (prisma.event.count as any).mockResolvedValue(1);

      const response = await request(app).get('/api/admin/events').expect(200);
      expect(response.body.events).toHaveLength(1);
      expect(response.body.pagination.total).toBe(1);
    });

    it('POST /api/admin/events creates event with enum mapping', async () => {
      (prisma.event.create as any).mockResolvedValue({ id: 'e1', title: 'My Event', type: 'WEBINAR', format: 'IN_PERSON' });

      const response = await request(app)
        .post('/api/admin/events')
        .send({
          title: 'My Event',
          description: 'Desc',
          type: 'webinar',
          format: 'in-person',
          date: '2026-01-20T00:00:00.000Z',
          startTime: '10:00 AM',
          endTime: '11:00 AM',
          image: 'https://img',
          host: { name: 'Host', title: 'Title', avatar: 'https://ava' },
          tags: ['Tech'],
          isFeatured: true,
        })
        .expect(201);

      expect(response.body.id).toBe('e1');
      expect(prisma.event.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'WEBINAR',
            format: 'IN_PERSON',
            isFeatured: true,
            date: expect.any(Date),
          }),
        })
      );
    });
  });

  describe('Admin Analytics', () => {
    it('GET /api/admin/analytics/engagement supports days window', async () => {
      (prisma.post.count as any).mockResolvedValue(3);
      (prisma.comment.count as any).mockResolvedValue(5);
      (prisma.like.count as any).mockResolvedValue(7);
      (prisma.jobApplication.count as any).mockResolvedValue(2);
      (prisma.user.count as any).mockResolvedValue(11);

      const response = await request(app).get('/api/admin/analytics/engagement?days=7').expect(200);

      expect(response.body.period).toEqual(
        expect.objectContaining({
          days: 7,
          label: '7 days',
          start: expect.any(String),
          end: expect.any(String),
        })
      );
      expect(response.body.metrics).toEqual(
        expect.objectContaining({
          newPosts: 3,
          newComments: 5,
          newLikes: 7,
          newApplications: 2,
          activeUsers: 11,
        })
      );
    });
  });
});
