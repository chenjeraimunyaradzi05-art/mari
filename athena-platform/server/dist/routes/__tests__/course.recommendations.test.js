"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const globals_1 = require("@jest/globals");
globals_1.jest.mock('../../utils/prisma', () => ({
    prisma: {
        user: {
            findUnique: globals_1.jest.fn(),
        },
        userSkill: {
            findMany: globals_1.jest.fn(),
        },
        courseEnrollment: {
            findMany: globals_1.jest.fn(),
        },
        course: {
            findMany: globals_1.jest.fn(),
            count: globals_1.jest.fn(),
            findFirst: globals_1.jest.fn(),
            findUnique: globals_1.jest.fn(),
        },
    },
}));
globals_1.jest.mock('../../middleware/auth', () => ({
    authenticate: (req, _res, next) => {
        req.user = { id: 'user-123', role: 'USER', email: 'user@athena.com', persona: 'EARLY_CAREER' };
        next();
    },
    optionalAuth: (req, _res, next) => {
        // Default: no user unless test sets header flag.
        if (req.headers['x-test-auth'] === '1') {
            req.user = { id: 'user-123', role: 'USER', email: 'user@athena.com', persona: 'EARLY_CAREER' };
        }
        next();
    },
    requireRole: (..._roles) => (_req, _res, next) => next(),
    requirePremium: (_req, _res, next) => next(),
}));
const index_1 = require("../../index");
const prisma_1 = require("../../utils/prisma");
(0, globals_1.describe)('Course recommendations', () => {
    (0, globals_1.beforeEach)(() => {
        globals_1.jest.clearAllMocks();
    });
    (0, globals_1.it)('GET /api/courses/recommendations/for-me returns popular courses when anonymous', async () => {
        const mockCourses = [{ id: 'c1' }, { id: 'c2' }];
        prisma_1.prisma.course.findMany.mockResolvedValue(mockCourses);
        const res = await (0, supertest_1.default)(index_1.app).get('/api/courses/recommendations/for-me').expect(200);
        (0, globals_1.expect)(res.body.success).toBe(true);
        (0, globals_1.expect)(res.body.data).toHaveLength(2);
        (0, globals_1.expect)(prisma_1.prisma.course.findMany).toHaveBeenCalledWith(globals_1.expect.objectContaining({
            take: 10,
            orderBy: { employmentRate: 'desc' },
        }));
        (0, globals_1.expect)(prisma_1.prisma.user.findUnique).not.toHaveBeenCalled();
    });
    (0, globals_1.it)('GET /api/courses/recommendations/for-me personalizes for authenticated user', async () => {
        prisma_1.prisma.user.findUnique.mockResolvedValue({
            persona: 'EARLY_CAREER',
            currentJobTitle: 'Data Analyst',
            headline: 'Analytics and insights',
            profile: { remotePreference: 'remote' },
        });
        prisma_1.prisma.courseEnrollment.findMany.mockResolvedValue([{ courseId: 'enrolled-1' }]);
        prisma_1.prisma.userSkill.findMany.mockResolvedValue([{ skill: { name: 'data' } }]);
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
        prisma_1.prisma.course.findMany.mockResolvedValue([degreeOnsite, bootcampOnline]);
        const res = await (0, supertest_1.default)(index_1.app)
            .get('/api/courses/recommendations/for-me')
            .set('x-test-auth', '1')
            .expect(200);
        (0, globals_1.expect)(res.body.success).toBe(true);
        (0, globals_1.expect)(res.body.data[0].id).toBe('bootcamp-online');
        (0, globals_1.expect)(prisma_1.prisma.courseEnrollment.findMany).toHaveBeenCalled();
        (0, globals_1.expect)(prisma_1.prisma.course.findMany).toHaveBeenCalledWith(globals_1.expect.objectContaining({
            take: 50,
            orderBy: [{ employmentRate: 'desc' }, { createdAt: 'desc' }],
        }));
    });
});
//# sourceMappingURL=course.recommendations.test.js.map