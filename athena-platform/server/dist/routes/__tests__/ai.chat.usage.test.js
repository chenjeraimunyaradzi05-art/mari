"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const globals_1 = require("@jest/globals");
globals_1.jest.mock('../../utils/cache', () => ({
    checkRateLimit: globals_1.jest.fn(async () => ({ allowed: true, remaining: 20, resetIn: 86400 })),
    getRateLimitStatus: globals_1.jest.fn(async () => ({ allowed: true, remaining: 17, resetIn: 86400 })),
}));
globals_1.jest.mock('../../utils/prisma', () => ({
    prisma: {
        user: {
            findUnique: globals_1.jest.fn(),
        },
    },
}));
globals_1.jest.mock('../../middleware/auth', () => ({
    authenticate: (req, _res, next) => {
        req.user = { id: 'user-free-1', role: 'USER', email: 'user@test.com' };
        next();
    },
    optionalAuth: (_req, _res, next) => next(),
    requireRole: (_role) => (_req, _res, next) => next(),
    requirePremium: (_req, _res, next) => next(),
}));
const index_1 = __importDefault(require("../../index"));
const prisma_1 = require("../../utils/prisma");
const cache_1 = require("../../utils/cache");
(0, globals_1.describe)('AI chat usage endpoint', () => {
    (0, globals_1.beforeEach)(() => {
        globals_1.jest.clearAllMocks();
    });
    (0, globals_1.it)('GET /api/ai/chat/usage returns remaining quota for FREE tier', async () => {
        prisma_1.prisma.user.findUnique.mockResolvedValue({
            id: 'user-free-1',
            subscription: { tier: 'FREE' },
        });
        const res = await (0, supertest_1.default)(index_1.default).get('/api/ai/chat/usage').expect(200);
        (0, globals_1.expect)(res.body).toHaveProperty('success', true);
        (0, globals_1.expect)(res.body.data).toEqual(globals_1.expect.objectContaining({
            tier: 'FREE',
            unlimited: false,
            usage: globals_1.expect.objectContaining({
                limit: globals_1.expect.any(Number),
                remaining: 17,
                resetIn: globals_1.expect.any(Number),
                windowSeconds: globals_1.expect.any(Number),
            }),
        }));
        (0, globals_1.expect)(cache_1.getRateLimitStatus).toHaveBeenCalledTimes(1);
    });
    (0, globals_1.it)('GET /api/ai/chat/usage returns unlimited for PREMIUM tier', async () => {
        prisma_1.prisma.user.findUnique.mockResolvedValue({
            id: 'user-free-1',
            subscription: { tier: 'PREMIUM' },
        });
        const res = await (0, supertest_1.default)(index_1.default).get('/api/ai/chat/usage').expect(200);
        (0, globals_1.expect)(res.body).toHaveProperty('success', true);
        (0, globals_1.expect)(res.body.data).toEqual(globals_1.expect.objectContaining({
            tier: 'PREMIUM',
            unlimited: true,
            usage: null,
        }));
    });
});
//# sourceMappingURL=ai.chat.usage.test.js.map