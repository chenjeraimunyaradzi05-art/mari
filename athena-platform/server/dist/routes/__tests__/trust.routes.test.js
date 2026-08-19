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
            update: globals_1.jest.fn(),
        },
        post: {
            count: globals_1.jest.fn(),
        },
        referral: {
            count: globals_1.jest.fn(),
        },
        verificationBadge: {
            count: globals_1.jest.fn(),
        },
    },
}));
globals_1.jest.mock('../../middleware/auth', () => ({
    authenticate: (req, _res, next) => {
        req.user = { id: 'user-123', role: 'USER', email: 'user@athena.com' };
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
(0, globals_1.describe)('Trust Score Routes', () => {
    (0, globals_1.beforeEach)(() => {
        globals_1.jest.clearAllMocks();
    });
    (0, globals_1.it)('GET /api/trust-score returns calculated score', async () => {
        prismaAny.user.findUnique.mockResolvedValue({
            emailVerified: true,
            isSuspended: false,
            profile: { linkedinUrl: 'https://linkedin.com', websiteUrl: null },
        });
        prismaAny.post.count.mockResolvedValue(6);
        prismaAny.referral.count.mockResolvedValue(2);
        prismaAny.verificationBadge.count.mockResolvedValue(1);
        prismaAny.user.update.mockResolvedValue({ trustScore: 72 });
        const response = await (0, supertest_1.default)(index_1.default).get('/api/trust-score').expect(200);
        (0, globals_1.expect)(response.body.success).toBe(true);
        (0, globals_1.expect)(response.body.data.score).toBeGreaterThan(0);
        (0, globals_1.expect)(response.body.data.factors.length).toBeGreaterThan(0);
    });
});
//# sourceMappingURL=trust.routes.test.js.map