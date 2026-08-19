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
            update: globals_1.jest.fn(),
            findUnique: globals_1.jest.fn(),
        },
        userSkill: {
            findMany: globals_1.jest.fn(),
            upsert: globals_1.jest.fn(),
            deleteMany: globals_1.jest.fn(),
        },
        skill: {
            findUnique: globals_1.jest.fn(),
            create: globals_1.jest.fn(),
        },
        auditLog: {
            create: globals_1.jest.fn(),
        },
    },
}));
globals_1.jest.mock('../../middleware/auth', () => ({
    authenticate: (req, _res, next) => {
        req.user = { id: 'user-123', role: 'USER', email: 'user@athena.com' };
        next();
    },
    optionalAuth: (req, _res, next) => {
        next();
    },
    requireRole: (..._roles) => (_req, __res, next) => next(),
    requirePremium: (_req, _res, next) => next(),
}));
globals_1.jest.mock('../../utils/opensearch', () => ({
    initializeOpenSearch: globals_1.jest.fn(),
    indexDocument: globals_1.jest.fn(),
    deleteDocument: globals_1.jest.fn(),
    IndexNames: { USERS: 'users' },
}));
const index_1 = require("../../index");
const prisma_1 = require("../../utils/prisma");
const prismaAny = prisma_1.prisma;
(0, globals_1.describe)('User contract tests', () => {
    (0, globals_1.beforeEach)(() => {
        globals_1.jest.clearAllMocks();
    });
    (0, globals_1.it)('PATCH /api/users/me rejects invalid yearsExperience', async () => {
        const res = await (0, supertest_1.default)(index_1.app)
            .patch('/api/users/me')
            .send({ yearsExperience: '5-10' })
            .expect(400);
        (0, globals_1.expect)(res.body?.message || res.body?.error || '').toBeTruthy();
    });
    (0, globals_1.it)('PATCH /api/users/me accepts valid profile payload', async () => {
        prismaAny.user.update.mockResolvedValue({
            id: 'user-123',
            email: 'user@athena.com',
            firstName: 'Test',
            lastName: 'User',
            displayName: 'Test User',
            avatar: null,
            bio: 'Bio',
            headline: 'Headline',
            role: 'USER',
            persona: 'EARLY_CAREER',
            city: 'Sydney',
            state: null,
            country: 'Australia',
            currentJobTitle: 'Engineer',
            currentCompany: 'Company',
            yearsExperience: 5,
            isPublic: true,
        });
        prismaAny.userSkill.findMany.mockResolvedValue([]);
        const res = await (0, supertest_1.default)(index_1.app)
            .patch('/api/users/me')
            .send({
            headline: 'Headline',
            bio: 'Bio',
            city: 'Sydney',
            currentJobTitle: 'Engineer',
            currentCompany: 'Company',
            yearsExperience: 5,
        })
            .expect(200);
        (0, globals_1.expect)(res.body.success).toBe(true);
        (0, globals_1.expect)(res.body.data).toEqual(globals_1.expect.objectContaining({ yearsExperience: 5 }));
    });
    (0, globals_1.it)('POST /api/users/me/skills requires skillName', async () => {
        const res = await (0, supertest_1.default)(index_1.app)
            .post('/api/users/me/skills')
            .send({ level: 2 })
            .expect(400);
        (0, globals_1.expect)(res.body?.message || res.body?.error || '').toBeTruthy();
    });
    (0, globals_1.it)('POST /api/users/me/skills accepts skillName payload', async () => {
        prismaAny.skill.findUnique.mockResolvedValue(null);
        prismaAny.skill.create.mockResolvedValue({ id: 'skill-1', name: 'javascript' });
        prismaAny.userSkill.upsert.mockResolvedValue({
            id: 'us-1',
            userId: 'user-123',
            skillId: 'skill-1',
            level: 3,
            skill: { name: 'javascript' },
        });
        prismaAny.userSkill.findMany.mockResolvedValue([{ skill: { name: 'javascript' } }]);
        const res = await (0, supertest_1.default)(index_1.app)
            .post('/api/users/me/skills')
            .send({ skillName: 'JavaScript', level: 3 })
            .expect(201);
        (0, globals_1.expect)(res.body.success).toBe(true);
        (0, globals_1.expect)(prismaAny.userSkill.upsert).toHaveBeenCalled();
    });
});
//# sourceMappingURL=user.contracts.test.js.map