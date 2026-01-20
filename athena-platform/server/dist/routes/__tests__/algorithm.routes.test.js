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
        job: {
            findMany: globals_1.jest.fn(),
        },
        course: {
            findMany: globals_1.jest.fn(),
        },
        event: {
            findMany: globals_1.jest.fn(),
        },
        mentorProfile: {
            findMany: globals_1.jest.fn(),
        },
    },
}));
globals_1.jest.mock('../../middleware/auth', () => ({
    authenticate: (req, _res, next) => {
        req.user = { id: 'user-123', role: 'USER', email: 'user@athena.com' };
        next();
    },
    optionalAuth: (req, _res, next) => {
        if (req.headers['x-test-auth'] === '1') {
            req.user = { id: 'user-123', role: 'USER', email: 'user@athena.com' };
        }
        next();
    },
    requireRole: (..._roles) => (_req, __res, next) => next(),
    requirePremium: (_req, _res, next) => next(),
}));
globals_1.jest.mock('../../utils/opensearch', () => ({
    initializeOpenSearch: globals_1.jest.fn(),
}));
globals_1.jest.mock('../../utils/logger', () => ({
    logger: {
        debug: globals_1.jest.fn(),
        info: globals_1.jest.fn(),
        warn: globals_1.jest.fn(),
        error: globals_1.jest.fn(),
    },
}));
const index_1 = __importDefault(require("../../index"));
const prisma_1 = require("../../utils/prisma");
const prismaAny = prisma_1.prisma;
(0, globals_1.describe)('Algorithm Routes', () => {
    (0, globals_1.beforeEach)(() => {
        globals_1.jest.clearAllMocks();
    });
    (0, globals_1.it)('GET /api/algorithms/career-compass returns skill gaps and courses', async () => {
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
        const response = await (0, supertest_1.default)(index_1.default).get('/api/algorithms/career-compass').expect(200);
        (0, globals_1.expect)(response.body.success).toBe(true);
        (0, globals_1.expect)(response.body.data.targetRole).toBe('Engineer');
        (0, globals_1.expect)(response.body.data.skillGaps).toEqual(globals_1.expect.arrayContaining(['react']));
        (0, globals_1.expect)(response.body.data.recommendedCourses).toHaveLength(1);
    });
    (0, globals_1.it)('GET /api/algorithms/opportunity-scan returns jobs, courses, and events', async () => {
        prismaAny.job.findMany.mockResolvedValue([
            { id: 'job-1', title: 'Analyst', city: null, state: null, country: 'Australia', organization: { name: 'Org' } },
        ]);
        prismaAny.course.findMany.mockResolvedValue([
            { id: 'course-1', title: 'Data 101', providerName: 'TAFE', type: 'certificate' },
        ]);
        prismaAny.event.findMany.mockResolvedValue([
            { id: 'event-1', title: 'Career Fair', date: new Date(), location: 'Sydney', isFeatured: false },
        ]);
        const response = await (0, supertest_1.default)(index_1.default).get('/api/algorithms/opportunity-scan').expect(200);
        (0, globals_1.expect)(response.body.success).toBe(true);
        (0, globals_1.expect)(response.body.data.jobs).toHaveLength(1);
        (0, globals_1.expect)(response.body.data.courses).toHaveLength(1);
        (0, globals_1.expect)(response.body.data.events).toHaveLength(1);
    });
    (0, globals_1.it)('GET /api/algorithms/salary-equity returns market median', async () => {
        prismaAny.user.findUnique.mockResolvedValue({
            currentJobTitle: 'Designer',
            profile: { salaryMin: 80000, salaryMax: 100000 },
        });
        prismaAny.job.findMany.mockResolvedValue([
            { salaryMin: 70000, salaryMax: 90000 },
            { salaryMin: 80000, salaryMax: 100000 },
            { salaryMin: 90000, salaryMax: 110000 },
        ]);
        const response = await (0, supertest_1.default)(index_1.default).get('/api/algorithms/salary-equity').expect(200);
        (0, globals_1.expect)(response.body.success).toBe(true);
        (0, globals_1.expect)(response.body.data.marketMedian).toBeGreaterThan(0);
        (0, globals_1.expect)(response.body.data.sampleSize).toBe(3);
    });
    (0, globals_1.it)('GET /api/algorithms/mentor-match returns ranked mentors', async () => {
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
        const response = await (0, supertest_1.default)(index_1.default).get('/api/algorithms/mentor-match').expect(200);
        (0, globals_1.expect)(response.body.success).toBe(true);
        (0, globals_1.expect)(response.body.data.mentors).toHaveLength(1);
        (0, globals_1.expect)(response.body.data.mentors[0].matchScore).toBeGreaterThan(0);
    });
});
//# sourceMappingURL=algorithm.routes.test.js.map