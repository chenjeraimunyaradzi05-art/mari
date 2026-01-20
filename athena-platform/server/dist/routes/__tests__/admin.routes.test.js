"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const globals_1 = require("@jest/globals");
// Mocks must be defined before imports that use them
globals_1.jest.mock('../../utils/prisma', () => ({
    prisma: {
        $transaction: globals_1.jest.fn(),
        user: {
            count: globals_1.jest.fn(),
            findMany: globals_1.jest.fn(),
            findUnique: globals_1.jest.fn(),
            update: globals_1.jest.fn(),
            delete: globals_1.jest.fn(),
            groupBy: globals_1.jest.fn(),
        },
        job: {
            count: globals_1.jest.fn(),
        },
        post: {
            count: globals_1.jest.fn(),
        },
        comment: {
            count: globals_1.jest.fn(),
        },
        like: {
            count: globals_1.jest.fn(),
        },
        jobApplication: {
            count: globals_1.jest.fn(),
        },
        course: {
            count: globals_1.jest.fn(),
        },
        mentorProfile: {
            count: globals_1.jest.fn(),
        },
        subscription: {
            count: globals_1.jest.fn(),
        },
        group: {
            count: globals_1.jest.fn(),
            findMany: globals_1.jest.fn(),
            findUnique: globals_1.jest.fn(),
            create: globals_1.jest.fn(),
            update: globals_1.jest.fn(),
            delete: globals_1.jest.fn(),
        },
        groupMember: {
            upsert: globals_1.jest.fn(),
            findUnique: globals_1.jest.fn(),
            count: globals_1.jest.fn(),
        },
        groupPost: {
            findUnique: globals_1.jest.fn(),
            delete: globals_1.jest.fn(),
        },
        event: {
            count: globals_1.jest.fn(),
            findMany: globals_1.jest.fn(),
            findUnique: globals_1.jest.fn(),
            create: globals_1.jest.fn(),
            update: globals_1.jest.fn(),
            delete: globals_1.jest.fn(),
        },
        auditLog: {
            create: globals_1.jest.fn(),
        },
    },
}));
globals_1.jest.mock('../../middleware/auth', () => ({
    authenticate: (req, res, next) => {
        req.user = { id: 'admin-123', role: 'ADMIN', email: 'admin@athena.com' };
        next();
    },
    requireRole: (role) => (req, res, next) => {
        next(); // Pass through
    },
    optionalAuth: (req, res, next) => {
        next(); // Pass through
    },
    requirePremium: (req, res, next) => {
        next(); // Pass through
    },
}));
// Import App after mocks
const index_1 = __importDefault(require("../../index"));
const prisma_1 = require("../../utils/prisma");
(0, globals_1.describe)('Admin Routes', () => {
    (0, globals_1.beforeEach)(() => {
        globals_1.jest.clearAllMocks();
    });
    (0, globals_1.describe)('GET /api/admin/stats', () => {
        (0, globals_1.it)('should return dashboard statistics', async () => {
            // Setup mock returns - using 'any' to bypass strict jest.Mock typing issues
            prisma_1.prisma.user.count.mockResolvedValue(100);
            prisma_1.prisma.job.count.mockResolvedValue(50);
            prisma_1.prisma.post.count.mockResolvedValue(200);
            prisma_1.prisma.course.count.mockResolvedValue(10);
            prisma_1.prisma.mentorProfile.count.mockResolvedValue(5);
            prisma_1.prisma.subscription.count.mockResolvedValue(20);
            prisma_1.prisma.user.groupBy.mockResolvedValue([]);
            const response = await (0, supertest_1.default)(index_1.default).get('/api/admin/stats');
            (0, globals_1.expect)(response.status).toBe(200);
            // The response is direct, not wrapped in { success, data }
            (0, globals_1.expect)(response.body).toEqual(globals_1.expect.objectContaining({
                overview: globals_1.expect.objectContaining({
                    totalUsers: 100,
                    totalJobs: 50,
                    totalPosts: 200,
                    totalCourses: 10,
                    totalMentors: 5
                }),
                subscriptions: globals_1.expect.objectContaining({
                    total: 20
                })
            }));
            // Verify all counts were called
            (0, globals_1.expect)(prisma_1.prisma.user.count).toHaveBeenCalledTimes(2); // total + new users
        });
    });
    (0, globals_1.describe)('GET /api/admin/users', () => {
        (0, globals_1.it)('should return paginated users', async () => {
            const mockUsers = [
                { id: '1', email: 'user1@test.com', role: 'USER' },
                { id: '2', email: 'user2@test.com', role: 'USER' },
            ];
            prisma_1.prisma.user.count.mockResolvedValue(2);
            prisma_1.prisma.user.findMany.mockResolvedValue(mockUsers);
            const response = await (0, supertest_1.default)(index_1.default).get('/api/admin/users');
            (0, globals_1.expect)(response.status).toBe(200);
            (0, globals_1.expect)(response.body.users).toHaveLength(2); // Direct property
            (0, globals_1.expect)(response.body.pagination.total).toBe(2);
        });
    });
    (0, globals_1.describe)('Admin Groups CRUD', () => {
        (0, globals_1.it)('GET /api/admin/groups returns paginated groups', async () => {
            prisma_1.prisma.group.findMany.mockResolvedValue([
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
            prisma_1.prisma.group.count.mockResolvedValue(1);
            const response = await (0, supertest_1.default)(index_1.default).get('/api/admin/groups').expect(200);
            (0, globals_1.expect)(response.body.groups).toHaveLength(1);
            (0, globals_1.expect)(response.body.pagination.total).toBe(1);
        });
        (0, globals_1.it)('PATCH /api/admin/groups/:id maps privacy and flags', async () => {
            prisma_1.prisma.group.findUnique.mockResolvedValue({ id: 'g1' });
            prisma_1.prisma.group.update.mockResolvedValue({ id: 'g1', privacy: 'PRIVATE', isFeatured: true, isPinned: false });
            const response = await (0, supertest_1.default)(index_1.default)
                .patch('/api/admin/groups/g1')
                .send({ privacy: 'private', isFeatured: true, isPinned: false })
                .expect(200);
            (0, globals_1.expect)(response.body.id).toBe('g1');
            (0, globals_1.expect)(prisma_1.prisma.group.update).toHaveBeenCalledWith(globals_1.expect.objectContaining({
                where: { id: 'g1' },
                data: globals_1.expect.objectContaining({ privacy: 'PRIVATE', isFeatured: true, isPinned: false }),
            }));
        });
    });
    (0, globals_1.describe)('Admin Events CRUD', () => {
        (0, globals_1.it)('GET /api/admin/events returns paginated events', async () => {
            prisma_1.prisma.event.findMany.mockResolvedValue([{ id: 'e1', title: 'Event 1' }]);
            prisma_1.prisma.event.count.mockResolvedValue(1);
            const response = await (0, supertest_1.default)(index_1.default).get('/api/admin/events').expect(200);
            (0, globals_1.expect)(response.body.events).toHaveLength(1);
            (0, globals_1.expect)(response.body.pagination.total).toBe(1);
        });
        (0, globals_1.it)('POST /api/admin/events creates event with enum mapping', async () => {
            prisma_1.prisma.event.create.mockResolvedValue({ id: 'e1', title: 'My Event', type: 'WEBINAR', format: 'IN_PERSON' });
            const response = await (0, supertest_1.default)(index_1.default)
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
            (0, globals_1.expect)(response.body.id).toBe('e1');
            (0, globals_1.expect)(prisma_1.prisma.event.create).toHaveBeenCalledWith(globals_1.expect.objectContaining({
                data: globals_1.expect.objectContaining({
                    type: 'WEBINAR',
                    format: 'IN_PERSON',
                    isFeatured: true,
                    date: globals_1.expect.any(Date),
                }),
            }));
        });
    });
    (0, globals_1.describe)('Admin Analytics', () => {
        (0, globals_1.it)('GET /api/admin/analytics/engagement supports days window', async () => {
            prisma_1.prisma.post.count.mockResolvedValue(3);
            prisma_1.prisma.comment.count.mockResolvedValue(5);
            prisma_1.prisma.like.count.mockResolvedValue(7);
            prisma_1.prisma.jobApplication.count.mockResolvedValue(2);
            prisma_1.prisma.user.count.mockResolvedValue(11);
            const response = await (0, supertest_1.default)(index_1.default).get('/api/admin/analytics/engagement?days=7').expect(200);
            (0, globals_1.expect)(response.body.period).toEqual(globals_1.expect.objectContaining({
                days: 7,
                label: '7 days',
                start: globals_1.expect.any(String),
                end: globals_1.expect.any(String),
            }));
            (0, globals_1.expect)(response.body.metrics).toEqual(globals_1.expect.objectContaining({
                newPosts: 3,
                newComments: 5,
                newLikes: 7,
                newApplications: 2,
                activeUsers: 11,
            }));
        });
    });
});
//# sourceMappingURL=admin.routes.test.js.map