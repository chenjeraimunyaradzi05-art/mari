"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const globals_1 = require("@jest/globals");
globals_1.jest.mock('stripe', () => ({
    __esModule: true,
    default: (() => {
        const stripeClient = {
            paymentIntents: {
                create: globals_1.jest.fn(),
                retrieve: globals_1.jest.fn(),
            },
            transfers: {
                create: globals_1.jest.fn(),
            },
            accountLinks: {
                create: globals_1.jest.fn(),
            },
            accounts: {
                createLoginLink: globals_1.jest.fn(),
            },
        };
        return globals_1.jest.fn().mockImplementation(() => stripeClient);
    })(),
}));
globals_1.jest.mock('../../utils/prisma', () => ({
    prisma: {
        user: {
            update: globals_1.jest.fn(),
        },
        giftBalancePurchase: {
            findUnique: globals_1.jest.fn(),
            create: globals_1.jest.fn(),
        },
        $transaction: globals_1.jest.fn(),
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
    requireRole: (..._roles) => (_req, _res, next) => next(),
    requirePremium: (_req, _res, next) => next(),
}));
globals_1.jest.mock('../../utils/logger', () => ({
    logger: {
        debug: globals_1.jest.fn(),
        info: globals_1.jest.fn(),
        warn: globals_1.jest.fn(),
        error: globals_1.jest.fn(),
    },
}));
const stripe_1 = __importDefault(require("stripe"));
const index_1 = require("../../index");
const prisma_1 = require("../../utils/prisma");
function getStripeInstance() {
    const ctor = stripe_1.default;
    // jest.clearAllMocks() resets mock.calls/results/instances; ensure we have one.
    if (!ctor.mock.results?.[0]?.value) {
        // eslint-disable-next-line new-cap
        new ctor('sk_test', { apiVersion: '2023-10-16' });
    }
    // For mocked constructors that return an explicit object, Jest tracks the returned
    // value in mock.results; mock.instances can be the raw `this` without our fields.
    return ctor.mock.results[0].value;
}
(0, globals_1.describe)('Creator gift balance confirm', () => {
    (0, globals_1.beforeEach)(() => {
        globals_1.jest.clearAllMocks();
        // Mimic Prisma transaction callback signature used in service.
        prisma_1.prisma.$transaction.mockImplementation(async (fn) => fn(prisma_1.prisma));
    });
    (0, globals_1.it)('POST /api/creator/balance/purchase/confirm credits points (idempotent)', async () => {
        const stripe = getStripeInstance();
        stripe.paymentIntents.retrieve.mockResolvedValue({
            id: 'pi_123',
            status: 'succeeded',
            amount: 500, // cents
            metadata: {
                userId: 'user-123',
                type: 'gift_balance_purchase',
                giftPoints: '50',
            },
        });
        prisma_1.prisma.giftBalancePurchase.findUnique
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ id: 'gbp_1', giftPoints: 50 });
        prisma_1.prisma.giftBalancePurchase.create.mockResolvedValue({ id: 'gbp_1' });
        prisma_1.prisma.user.update.mockResolvedValue({ id: 'user-123' });
        const res1 = await (0, supertest_1.default)(index_1.app)
            .post('/api/creator/balance/purchase/confirm')
            .send({ paymentIntentId: 'pi_123' })
            .expect(200);
        (0, globals_1.expect)(res1.body.success).toBe(true);
        (0, globals_1.expect)(res1.body.data.giftPoints).toBe(50);
        (0, globals_1.expect)(res1.body.data.alreadyProcessed).toBe(false);
        const res2 = await (0, supertest_1.default)(index_1.app)
            .post('/api/creator/balance/purchase/confirm')
            .send({ paymentIntentId: 'pi_123' })
            .expect(200);
        (0, globals_1.expect)(res2.body.success).toBe(true);
        (0, globals_1.expect)(res2.body.data.giftPoints).toBe(50);
        (0, globals_1.expect)(res2.body.data.alreadyProcessed).toBe(true);
        (0, globals_1.expect)(prisma_1.prisma.user.update).toHaveBeenCalledTimes(1);
        (0, globals_1.expect)(prisma_1.prisma.giftBalancePurchase.create).toHaveBeenCalledTimes(1);
    });
    (0, globals_1.it)('POST /api/creator/balance/purchase/confirm forbids confirming for another user', async () => {
        const stripe = getStripeInstance();
        stripe.paymentIntents.retrieve.mockResolvedValue({
            id: 'pi_other',
            status: 'succeeded',
            amount: 500,
            metadata: {
                userId: 'someone-else',
                type: 'gift_balance_purchase',
                giftPoints: '50',
            },
        });
        const res = await (0, supertest_1.default)(index_1.app)
            .post('/api/creator/balance/purchase/confirm')
            .send({ paymentIntentId: 'pi_other' })
            .expect(403);
        (0, globals_1.expect)(res.body.success).toBe(false);
    });
});
//# sourceMappingURL=creator.balance.confirm.test.js.map