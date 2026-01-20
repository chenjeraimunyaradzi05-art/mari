/**
 * Payments Orchestration Service
 * Multi-provider payment routing for global expansion
 */
export type PaymentProvider = 'stripe' | 'paypal' | 'wise' | 'gcash' | 'grabpay' | 'mpesa' | 'pix' | 'upi';
export type Currency = 'AUD' | 'USD' | 'GBP' | 'EUR' | 'NZD' | 'SGD' | 'PHP' | 'IDR' | 'INR' | 'BRL' | 'KES';
export interface PaymentMethod {
    id: string;
    provider: PaymentProvider;
    type: 'card' | 'bank' | 'wallet' | 'mobile_money';
    last4?: string;
    brand?: string;
    expiryMonth?: number;
    expiryYear?: number;
    isDefault: boolean;
}
export interface PaymentRequest {
    userId: string;
    amount: number;
    currency: Currency;
    description: string;
    metadata?: Record<string, string>;
    paymentMethodId?: string;
    returnUrl?: string;
}
export interface PaymentResult {
    success: boolean;
    transactionId?: string;
    provider: PaymentProvider;
    status: 'completed' | 'pending' | 'failed' | 'requires_action';
    clientSecret?: string;
    redirectUrl?: string;
    error?: string;
}
export interface PayoutRequest {
    userId: string;
    amount: number;
    currency: Currency;
    destinationType: 'bank' | 'wallet' | 'mobile_money';
    destinationId: string;
}
/**
 * Get best payment provider for region
 */
export declare function getBestProvider(region: string, paymentType?: 'card' | 'wallet' | 'mobile_money'): PaymentProvider;
/**
 * Get available payment methods for user's region
 */
export declare function getAvailablePaymentMethods(region: string): {
    provider: PaymentProvider;
    type: string;
    name: string;
    icon: string;
}[];
/**
 * Process payment with optimal provider routing
 */
export declare function processPayment(request: PaymentRequest): Promise<PaymentResult>;
/**
 * Process creator payout
 */
export declare function processCreatorPayout(request: PayoutRequest): Promise<PaymentResult>;
/**
 * Convert currency with FX rate
 */
export declare function convertCurrency(amount: number, fromCurrency: Currency, toCurrency: Currency): {
    amount: number;
    rate: number;
    fee: number;
};
/**
 * Get regional pricing table
 */
export declare function getRegionalPricing(region: string): {
    currency: Currency;
    subscriptionTiers: Record<string, number>;
    creatorFees: {
        platformFee: number;
        paymentFee: number;
    };
};
declare const _default: {
    getBestProvider: typeof getBestProvider;
    getAvailablePaymentMethods: typeof getAvailablePaymentMethods;
    processPayment: typeof processPayment;
    processCreatorPayout: typeof processCreatorPayout;
    convertCurrency: typeof convertCurrency;
    getRegionalPricing: typeof getRegionalPricing;
};
export default _default;
//# sourceMappingURL=payments-orchestration.service.d.ts.map