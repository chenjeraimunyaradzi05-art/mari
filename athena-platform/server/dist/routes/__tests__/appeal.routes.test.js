"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const globals_1 = require("@jest/globals");
globals_1.jest.mock('../../utils/prisma', () => ({
    prisma: {
        appeal: {
            create: globals_1.jest.fn(),
            findMany: globals_1.jest.fn(),
            update: globals_1.jest.fn(),
        },
        auditLog: {
            create: globals_1.jest.fn(),
        },
    },
}));
globals_1.jest.mock('../../middleware/auth', () => ({
    authenticate: (req, _res, next) => {
        req.user = { id: 'user-123', role: 'ADMIN', email: 'admin@athena.com' };
        next();
    },
    optionalAuth: (_req, _res, next) => next(),
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
(0, globals_1.describe)('Appeal Routes', () => {
    (0, globals_1.beforeEach)(() => {
        globals_1.jest.clearAllMocks();
    });
    (0, globals_1.it)('POST /api/appeals creates appeal', async () => {
        prismaAny.appeal.create.mockResolvedValue({ id: 'appeal-1', status: 'PENDING' });
        const response = await (0, supertest_1.default)(index_1.default)
            .post('/api/appeals')
            .send({ type: 'CONTENT_MODERATION', reason: 'Review this', metadata: { postId: 'p1' } })
            .expect(201);
        (0, globals_1.expect)(response.body.success).toBe(true);
        (0, globals_1.expect)(response.body.data.id).toBe('appeal-1');
    });
    (0, globals_1.it)('GET /api/appeals/me lists appeals', async () => {
        prismaAny.appeal.findMany.mockResolvedValue([{ id: 'appeal-1' }]);
        const response = await (0, supertest_1.default)(index_1.default).get('/api/appeals/me').expect(200);
        (0, globals_1.expect)(response.body.success).toBe(true);
        (0, globals_1.expect)(response.body.data).toHaveLength(1);
    });
    (0, globals_1.it)('PATCH /api/appeals/:id updates appeal decision', async () => {
        prismaAny.appeal.update.mockResolvedValue({ id: 'appeal-1', userId: 'user-123', status: 'APPROVED' });
        const response = await (0, supertest_1.default)(index_1.default)
            .patch('/api/appeals/appeal-1')
            .send({ status: 'APPROVED', decisionNote: 'Approved' })
            .expect(200);
        (0, globals_1.expect)(response.body.success).toBe(true);
        (0, globals_1.expect)(response.body.data.status).toBe('APPROVED');
    });
});
//# sourceMappingURL=appeal.routes.test.js.map