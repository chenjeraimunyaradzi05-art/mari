"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const globals_1 = require("@jest/globals");
globals_1.jest.mock('../../utils/prisma', () => ({
    prisma: {
        verificationBadge: {
            findMany: globals_1.jest.fn(),
            create: globals_1.jest.fn(),
            update: globals_1.jest.fn(),
        },
        user: {
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
(0, globals_1.describe)('Verification Routes', () => {
    (0, globals_1.beforeEach)(() => {
        globals_1.jest.clearAllMocks();
    });
    (0, globals_1.it)('GET /api/verification/badges returns badges', async () => {
        prismaAny.verificationBadge.findMany.mockResolvedValue([{ id: 'badge-1', type: 'IDENTITY' }]);
        const response = await (0, supertest_1.default)(index_1.default).get('/api/verification/badges').expect(200);
        (0, globals_1.expect)(response.body.success).toBe(true);
        (0, globals_1.expect)(response.body.data).toHaveLength(1);
    });
    (0, globals_1.it)('POST /api/verification/badges creates badge', async () => {
        prismaAny.verificationBadge.create.mockResolvedValue({ id: 'badge-1', type: 'IDENTITY', status: 'PENDING' });
        const response = await (0, supertest_1.default)(index_1.default)
            .post('/api/verification/badges')
            .send({ type: 'IDENTITY', metadata: { doc: 'url' } })
            .expect(201);
        (0, globals_1.expect)(response.body.success).toBe(true);
        (0, globals_1.expect)(response.body.data.id).toBe('badge-1');
    });
    (0, globals_1.it)('PATCH /api/verification/badges/:id approves badge', async () => {
        prismaAny.verificationBadge.update.mockResolvedValue({ id: 'badge-1', userId: 'user-123', type: 'IDENTITY' });
        const response = await (0, supertest_1.default)(index_1.default)
            .patch('/api/verification/badges/badge-1')
            .send({ status: 'APPROVED', reason: 'Verified' })
            .expect(200);
        (0, globals_1.expect)(response.body.success).toBe(true);
        (0, globals_1.expect)(prismaAny.user.update).toHaveBeenCalled();
    });
});
//# sourceMappingURL=verification.routes.test.js.map