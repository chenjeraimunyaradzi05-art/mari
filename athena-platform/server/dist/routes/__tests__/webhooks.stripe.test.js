"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const globals_1 = require("@jest/globals");
const express_1 = __importDefault(require("express"));
globals_1.jest.mock('../../utils/prisma', () => ({
    prisma: {
        stripeWebhookEvent: {
            create: globals_1.jest.fn(),
        },
        subscription: {
            upsert: globals_1.jest.fn(),
            findFirst: globals_1.jest.fn(),
            update: globals_1.jest.fn(),
        },
    },
}));
globals_1.jest.mock('stripe', () => {
    const stripeClient = {
        webhooks: {
            constructEvent: globals_1.jest.fn(),
        },
        // Present for compatibility with other modules importing Stripe.
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
    const StripeMock = globals_1.jest.fn().mockImplementation(() => stripeClient);
    StripeMock.__client = stripeClient;
    return {
        __esModule: true,
        default: StripeMock,
    };
});
globals_1.jest.mock('../../services/creator.service', () => {
    const actual = globals_1.jest.requireActual('../../services/creator.service');
    return {
        ...actual,
        confirmGiftPurchaseFromPaymentIntent: globals_1.jest.fn(),
    };
});
const stripe_1 = __importDefault(require("stripe"));
const webhook_routes_1 = __importDefault(require("../webhook.routes"));
const creator_service_1 = require("../../services/creator.service");
const prisma_1 = require("../../utils/prisma");
function getStripeClient() {
    return stripe_1.default.__client;
}
function createTestApp() {
    const app = (0, express_1.default)();
    app.use('/api/webhooks', webhook_routes_1.default);
    // Minimal error handler compatible with existing error shape.
    app.use((err, _req, res, _next) => {
        res.status(err?.statusCode || 500).json({ success: false, message: err?.message || 'Internal Server Error' });
    });
    return app;
}
(0, globals_1.describe)('Stripe webhooks', () => {
    (0, globals_1.beforeEach)(() => {
        globals_1.jest.clearAllMocks();
        process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
        process.env.STRIPE_SECRET_KEY = 'sk_test_123';
        process.env.STRIPE_PRICE_CAREER = 'price_career';
        process.env.STRIPE_PRICE_PROFESSIONAL = 'price_professional';
        process.env.STRIPE_PRICE_ENTREPRENEUR = 'price_entrepreneur';
        process.env.STRIPE_PRICE_CREATOR = 'price_creator';
        // Default: event not duplicate
        prisma_1.prisma.stripeWebhookEvent.create.mockResolvedValue({ id: 'evt_x' });
    });
    (0, globals_1.it)('POST /api/webhooks/stripe processes gift_balance_purchase payment_intent.succeeded', async () => {
        const stripe = getStripeClient();
        const app = createTestApp();
        const paymentIntent = {
            id: 'pi_123',
            status: 'succeeded',
            amount: 500,
            metadata: {
                userId: 'user-123',
                type: 'gift_balance_purchase',
                giftPoints: '50',
            },
        };
        stripe.webhooks.constructEvent.mockReturnValue({
            id: 'evt_1',
            type: 'payment_intent.succeeded',
            data: { object: paymentIntent },
        });
        const res = await (0, supertest_1.default)(app)
            .post('/api/webhooks/stripe')
            .set('Content-Type', 'application/json')
            .set('stripe-signature', 't=123,v1=abc')
            .send(Buffer.from('{"ok":true}'))
            .expect(200);
        (0, globals_1.expect)(res.body.received).toBe(true);
        (0, globals_1.expect)(stripe.webhooks.constructEvent).toHaveBeenCalled();
        (0, globals_1.expect)(creator_service_1.confirmGiftPurchaseFromPaymentIntent).toHaveBeenCalledWith('user-123', paymentIntent);
    });
    (0, globals_1.it)('POST /api/webhooks/stripe processes subscription checkout.session.completed', async () => {
        const stripe = getStripeClient();
        const app = createTestApp();
        stripe.webhooks.constructEvent.mockReturnValue({
            id: 'evt_sub_1',
            type: 'checkout.session.completed',
            data: {
                object: {
                    id: 'cs_123',
                    mode: 'subscription',
                    customer: 'cus_123',
                    subscription: 'sub_123',
                    metadata: { userId: 'user-123', tier: 'PREMIUM_CAREER' },
                },
            },
        });
        await (0, supertest_1.default)(app)
            .post('/api/webhooks/stripe')
            .set('Content-Type', 'application/json')
            .set('stripe-signature', 't=123,v1=abc')
            .send(Buffer.from('{"ok":true}'))
            .expect(200);
        (0, globals_1.expect)(prisma_1.prisma.subscription.upsert).toHaveBeenCalledWith(globals_1.expect.objectContaining({
            where: { userId: 'user-123' },
            create: globals_1.expect.objectContaining({
                tier: 'PREMIUM_CAREER',
                status: 'ACTIVE',
                stripeCustomerId: 'cus_123',
                stripeSubscriptionId: 'sub_123',
                stripePriceId: 'price_career',
            }),
            update: globals_1.expect.objectContaining({
                tier: 'PREMIUM_CAREER',
                status: 'ACTIVE',
                stripeSubscriptionId: 'sub_123',
                stripePriceId: 'price_career',
            }),
        }));
    });
    (0, globals_1.it)('POST /api/webhooks/stripe processes customer.subscription.updated', async () => {
        const stripe = getStripeClient();
        const app = createTestApp();
        prisma_1.prisma.subscription.findFirst.mockResolvedValue({ id: 'sub_db_1' });
        stripe.webhooks.constructEvent.mockReturnValue({
            id: 'evt_sub_2',
            type: 'customer.subscription.updated',
            data: {
                object: {
                    id: 'sub_123',
                    customer: 'cus_123',
                    status: 'active',
                    cancel_at_period_end: false,
                    current_period_start: 1700000000,
                    current_period_end: 1700003600,
                    items: { data: [{ price: { id: 'price_professional' } }] },
                },
            },
        });
        await (0, supertest_1.default)(app)
            .post('/api/webhooks/stripe')
            .set('Content-Type', 'application/json')
            .set('stripe-signature', 't=123,v1=abc')
            .send(Buffer.from('{"ok":true}'))
            .expect(200);
        (0, globals_1.expect)(prisma_1.prisma.subscription.update).toHaveBeenCalledWith(globals_1.expect.objectContaining({
            where: { id: 'sub_db_1' },
            data: globals_1.expect.objectContaining({
                status: 'ACTIVE',
                stripeSubscriptionId: 'sub_123',
                stripeCustomerId: 'cus_123',
                stripePriceId: 'price_professional',
                tier: 'PREMIUM_PROFESSIONAL',
                cancelAtPeriodEnd: false,
            }),
        }));
    });
    (0, globals_1.it)('POST /api/webhooks/stripe returns duplicate=true on replayed event', async () => {
        const stripe = getStripeClient();
        const app = createTestApp();
        const dupErr = new Error('duplicate');
        dupErr.code = 'P2002';
        prisma_1.prisma.stripeWebhookEvent.create.mockRejectedValueOnce(dupErr);
        stripe.webhooks.constructEvent.mockReturnValue({
            id: 'evt_dup',
            type: 'payment_intent.succeeded',
            data: { object: { id: 'pi_x', status: 'succeeded', amount: 100, metadata: {} } },
        });
        const res = await (0, supertest_1.default)(app)
            .post('/api/webhooks/stripe')
            .set('Content-Type', 'application/json')
            .set('stripe-signature', 't=123,v1=abc')
            .send(Buffer.from('{"ok":true}'))
            .expect(200);
        (0, globals_1.expect)(res.body.received).toBe(true);
        (0, globals_1.expect)(res.body.duplicate).toBe(true);
    });
    (0, globals_1.it)('POST /api/webhooks/stripe returns 400 when signature missing', async () => {
        const app = createTestApp();
        await (0, supertest_1.default)(app)
            .post('/api/webhooks/stripe')
            .set('Content-Type', 'application/json')
            .send(Buffer.from('{"ok":true}'))
            .expect(400);
        (0, globals_1.expect)(creator_service_1.confirmGiftPurchaseFromPaymentIntent).not.toHaveBeenCalled();
    });
    (0, globals_1.it)('POST /api/webhooks/stripe returns 400 when signature invalid', async () => {
        const stripe = getStripeClient();
        const app = createTestApp();
        stripe.webhooks.constructEvent.mockImplementation(() => {
            throw new Error('bad signature');
        });
        await (0, supertest_1.default)(app)
            .post('/api/webhooks/stripe')
            .set('Content-Type', 'application/json')
            .set('stripe-signature', 't=123,v1=bad')
            .send(Buffer.from('{"ok":true}'))
            .expect(400);
        (0, globals_1.expect)(creator_service_1.confirmGiftPurchaseFromPaymentIntent).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=webhooks.stripe.test.js.map