import Stripe from 'stripe';
import { User, Subscription } from '@prisma/client';
type UserWithSubscription = User & {
    subscription: Subscription | null;
};
declare class PaymentService {
    private stripe;
    private isEnabled;
    constructor();
    createCustomer(user: UserWithSubscription): Promise<string>;
    createCheckoutSession(userId: string, priceId: string, returnUrl: string): Promise<{
        url: string | null;
    }>;
    createPortalSession(userId: string, returnUrl: string): Promise<{
        url: string;
    }>;
    getSubscription(userId: string): Promise<{
        status: string;
        plan: import(".prisma/client").$Enums.SubscriptionTier;
        current_period_end: string;
        id?: undefined;
    } | {
        status: string;
        plan: string;
        current_period_end?: undefined;
        id?: undefined;
    } | {
        id: string;
        status: Stripe.Subscription.Status;
        current_period_end: string;
        plan: string;
    } | null>;
}
export declare const paymentService: PaymentService;
export {};
//# sourceMappingURL=payment.service.d.ts.map