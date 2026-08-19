"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentService = void 0;
const stripe_1 = __importDefault(require("stripe"));
const prisma_1 = require("../utils/prisma");
const logger_1 = require("../utils/logger");
class PaymentService {
    stripe = null;
    isEnabled = false;
    constructor() {
        if (process.env.STRIPE_SECRET_KEY) {
            this.stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY, {
                apiVersion: '2023-10-16',
            });
            this.isEnabled = true;
        }
        else {
            logger_1.logger.warn('STRIPE_SECRET_KEY not found. Payment features will be simulated or disabled.');
        }
    }
    requireStripe(feature) {
        if (this.isEnabled && this.stripe) {
            return true;
        }
        const message = `${feature} requires STRIPE_SECRET_KEY`;
        if (process.env.NODE_ENV === 'production') {
            logger_1.logger.error(message);
            throw new Error(message);
        }
        logger_1.logger.warn(`${message}; using development fallback`);
        return false;
    }
    async createCustomer(user) {
        if (!this.requireStripe('Creating a Stripe customer')) {
            return `cus_simulated_${user.id}`;
        }
        try {
            const customer = await this.stripe.customers.create({
                email: user.email,
                name: `${user.firstName} ${user.lastName}`,
                metadata: {
                    userId: user.id,
                },
            });
            // Update subscription with Stripe Customer ID
            if (user.subscription) {
                await prisma_1.prisma.subscription.update({
                    where: { id: user.subscription.id },
                    data: { stripeCustomerId: customer.id },
                });
            }
            else {
                await prisma_1.prisma.subscription.create({
                    data: {
                        userId: user.id,
                        stripeCustomerId: customer.id,
                        tier: 'FREE',
                    },
                });
            }
            return customer.id;
        }
        catch (error) {
            logger_1.logger.error('Error creating Stripe customer:', error);
            throw error;
        }
    }
    async createCheckoutSession(userId, priceId, returnUrl) {
        if (!this.requireStripe('Creating a checkout session')) {
            return { url: `${returnUrl}?session_id=simulated_session` };
        }
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: userId },
            include: { subscription: true }
        });
        if (!user)
            throw new Error('User not found');
        let customerId = user.subscription?.stripeCustomerId;
        if (!customerId) {
            customerId = await this.createCustomer(user);
        }
        try {
            const session = await this.stripe.checkout.sessions.create({
                customer: customerId,
                mode: 'subscription',
                payment_method_types: ['card'],
                line_items: [
                    {
                        price: priceId,
                        quantity: 1,
                    },
                ],
                success_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: returnUrl,
                metadata: {
                    userId: user.id,
                }
            });
            return { url: session.url };
        }
        catch (error) {
            logger_1.logger.error('Error creating checkout session:', error);
            throw error;
        }
    }
    async createPortalSession(userId, returnUrl) {
        if (!this.requireStripe('Creating a billing portal session')) {
            return { url: returnUrl };
        }
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: userId },
            include: { subscription: true }
        });
        if (!user || !user.subscription?.stripeCustomerId)
            throw new Error('User or Stripe Customer not found');
        try {
            const session = await this.stripe.billingPortal.sessions.create({
                customer: user.subscription.stripeCustomerId,
                return_url: returnUrl,
            });
            return { url: session.url };
        }
        catch (error) {
            logger_1.logger.error('Error creating portal session:', error);
            throw error;
        }
    }
    async getSubscription(userId) {
        // In a real implementation, we would fetch from DB or Stripe
        // For now, we rely on the webhook to have updated the user record in the DB
        // So we just return what's in the DB usually, or fetch from Stripe for fresh data.
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: userId },
            include: { subscription: true }
        });
        if (!user)
            return null;
        const hasStripeId = user.subscription?.stripeCustomerId;
        if (!this.requireStripe('Reading Stripe subscription state') || !hasStripeId) {
            const tier = user.subscription?.tier || 'FREE';
            const isPro = tier !== 'FREE';
            return {
                status: isPro ? 'active' : 'inactive',
                plan: tier,
                current_period_end: new Date(Date.now() + 86400000).toISOString() // Fake date
            };
        }
        // If we have stripe, we might want to list subscriptions
        const subscriptions = await this.stripe.subscriptions.list({
            customer: hasStripeId,
            status: 'active',
            limit: 1
        });
        if (subscriptions.data.length === 0) {
            return { status: 'inactive', plan: 'FREE' };
        }
        const sub = subscriptions.data[0];
        return {
            id: sub.id,
            status: sub.status,
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            plan: 'PREMIUM_CAREER' // Using a valid Enum value instead of 'PRO'
        };
    }
}
exports.paymentService = new PaymentService();
//# sourceMappingURL=payment.service.js.map