/**
 * Stripe Connect Service
 * Multi-party payouts for Mentors and Creators
 * Phase 2: Backend Logic & Integrations
 */
export interface ConnectedAccountInput {
    userId: string;
    email: string;
    country: string;
    type: 'mentor' | 'creator';
    businessType?: 'individual' | 'company';
}
export interface PayoutInput {
    connectedAccountId: string;
    amount: number;
    currency: string;
    description?: string;
}
export interface EscrowPaymentInput {
    buyerId: string;
    sellerId: string;
    amount: number;
    currency: string;
    description: string;
    metadata?: Record<string, string>;
    sessionType?: 'mentor_session' | 'course_purchase' | 'creator_content';
}
/**
 * Create a Stripe Connect Express account for mentor/creator
 */
export declare function createConnectedAccount(input: ConnectedAccountInput): Promise<{
    accountId: string;
    onboardingUrl: string;
}>;
/**
 * Get onboarding link for existing connected account
 */
export declare function getOnboardingLink(userId: string): Promise<string>;
/**
 * Check if connected account is fully onboarded
 */
export declare function getAccountStatus(userId: string): Promise<{
    isOnboarded: boolean;
    payoutsEnabled: boolean;
    chargesEnabled: boolean;
    requirements?: string[];
}>;
/**
 * Create an escrow-style payment (hold funds until service delivered)
 * Uses PaymentIntents with manual capture for mentor sessions
 */
export declare function createEscrowPayment(input: EscrowPaymentInput): Promise<{
    paymentIntentId: string;
    clientSecret: string;
    amount: number;
    platformFee: number;
}>;
/**
 * Capture escrowed payment (release funds to seller after service delivered)
 */
export declare function captureEscrowPayment(paymentIntentId: string): Promise<{
    status: string;
    amountCaptured: number;
}>;
/**
 * Cancel/refund escrowed payment (if service not delivered or disputed)
 */
export declare function cancelEscrowPayment(paymentIntentId: string, reason?: string): Promise<{
    status: string;
}>;
/**
 * Get seller's earnings dashboard data
 */
export declare function getEarningsDashboard(userId: string): Promise<{
    totalEarnings: number;
    pendingPayouts: number;
    availableBalance: number;
    recentTransactions: any[];
}>;
/**
 * Initiate manual payout to connected account
 */
export declare function createPayout(input: PayoutInput): Promise<{
    payoutId: string;
    status: string;
}>;
export declare const stripeConnectService: {
    createConnectedAccount: typeof createConnectedAccount;
    getOnboardingLink: typeof getOnboardingLink;
    getAccountStatus: typeof getAccountStatus;
    createEscrowPayment: typeof createEscrowPayment;
    captureEscrowPayment: typeof captureEscrowPayment;
    cancelEscrowPayment: typeof cancelEscrowPayment;
    getEarningsDashboard: typeof getEarningsDashboard;
    createPayout: typeof createPayout;
};
//# sourceMappingURL=stripe-connect.service.d.ts.map