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
        notification: {
            findMany: globals_1.jest.fn(),
            count: globals_1.jest.fn(),
            findUnique: globals_1.jest.fn(),
            update: globals_1.jest.fn(),
            updateMany: globals_1.jest.fn(),
            deleteMany: globals_1.jest.fn(),
            delete: globals_1.jest.fn(),
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
    requireRole: (_role) => (_req, _res, next) => {
        next();
    },
    requirePremium: (_req, _res, next) => {
        next();
    },
}));
const index_1 = require("../../index");
const prisma_1 = require("../../utils/prisma");
(0, globals_1.describe)('Notification preferences', () => {
    (0, globals_1.beforeEach)(() => {
        globals_1.jest.clearAllMocks();
    });
    (0, globals_1.it)('GET /api/notifications/preferences returns defaults when unset', async () => {
        prisma_1.prisma.user.findUnique.mockResolvedValue({ notificationPreferences: null });
        const res = await (0, supertest_1.default)(index_1.app).get('/api/notifications/preferences').expect(200);
        (0, globals_1.expect)(res.body.success).toBe(true);
        (0, globals_1.expect)(res.body.data).toEqual(globals_1.expect.objectContaining({
            email: globals_1.expect.objectContaining({ jobMatches: true, newsletter: true }),
            push: globals_1.expect.objectContaining({ messages: true }),
            inApp: globals_1.expect.objectContaining({ all: true }),
        }));
    });
    (0, globals_1.it)('PATCH /api/notifications/preferences persists merged preferences', async () => {
        prisma_1.prisma.user.findUnique.mockResolvedValue({
            notificationPreferences: {
                email: { newsletter: false },
            },
        });
        prisma_1.prisma.user.update.mockResolvedValue({ id: 'user-123' });
        const res = await (0, supertest_1.default)(index_1.app)
            .patch('/api/notifications/preferences')
            .send({ preferences: { push: { messages: false } } })
            .expect(200);
        (0, globals_1.expect)(res.body.success).toBe(true);
        (0, globals_1.expect)(res.body.data.email.newsletter).toBe(false);
        (0, globals_1.expect)(res.body.data.push.messages).toBe(false);
        (0, globals_1.expect)(prisma_1.prisma.user.update).toHaveBeenCalledWith(globals_1.expect.objectContaining({
            where: { id: 'user-123' },
            data: globals_1.expect.objectContaining({
                notificationPreferences: globals_1.expect.objectContaining({
                    email: globals_1.expect.objectContaining({ newsletter: false }),
                    push: globals_1.expect.objectContaining({ messages: false }),
                }),
            }),
        }));
    });
    (0, globals_1.it)('PATCH /api/notifications/preferences returns 400 on invalid payload', async () => {
        const res = await (0, supertest_1.default)(index_1.app)
            .patch('/api/notifications/preferences')
            .send({ preferences: { push: { messages: 'nope' } } })
            .expect(400);
        (0, globals_1.expect)(res.body.success).toBe(false);
    });
});
//# sourceMappingURL=notification.preferences.test.js.map