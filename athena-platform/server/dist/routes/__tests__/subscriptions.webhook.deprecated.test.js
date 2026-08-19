"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const globals_1 = require("@jest/globals");
// Avoid initializing a real Prisma client in tests.
globals_1.jest.mock('../../utils/prisma', () => ({
    prisma: {
        $queryRaw: globals_1.jest.fn(),
        $disconnect: globals_1.jest.fn(),
    },
}));
const index_1 = require("../../index");
(0, globals_1.describe)('Legacy subscription webhook (deprecated)', () => {
    (0, globals_1.it)('POST /api/subscriptions/webhook returns 410 and guidance', async () => {
        delete process.env.INTERNAL_WEBHOOK_DISABLE_KEY;
        const res = await (0, supertest_1.default)(index_1.app)
            .post('/api/subscriptions/webhook')
            .set('Content-Type', 'application/json')
            .send({ any: 'payload' })
            .expect(410);
        (0, globals_1.expect)(res.body.success).toBe(false);
        (0, globals_1.expect)(String(res.body.message)).toContain('/api/webhooks/stripe');
    });
    (0, globals_1.it)('POST /api/subscriptions/webhook is silent (204) when disable key configured but missing', async () => {
        process.env.INTERNAL_WEBHOOK_DISABLE_KEY = 'secret123';
        await (0, supertest_1.default)(index_1.app)
            .post('/api/subscriptions/webhook')
            .set('Content-Type', 'application/json')
            .send({ any: 'payload' })
            .expect(204);
    });
    (0, globals_1.it)('POST /api/subscriptions/webhook returns 200 guidance when disable key matches', async () => {
        process.env.INTERNAL_WEBHOOK_DISABLE_KEY = 'secret123';
        const res = await (0, supertest_1.default)(index_1.app)
            .post('/api/subscriptions/webhook')
            .set('Content-Type', 'application/json')
            .set('X-Internal-Webhook-Disable-Key', 'secret123')
            .send({ any: 'payload' })
            .expect(200);
        (0, globals_1.expect)(res.body.success).toBe(false);
        (0, globals_1.expect)(res.body.deprecated).toBe(true);
        (0, globals_1.expect)(String(res.body.message)).toContain('/api/webhooks/stripe');
    });
});
//# sourceMappingURL=subscriptions.webhook.deprecated.test.js.map