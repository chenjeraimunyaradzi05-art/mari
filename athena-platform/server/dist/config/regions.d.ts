export type RegionKey = 'ANZ' | 'US' | 'SEA' | 'MEA' | 'UK' | 'EU' | 'ROW';
export interface RegionConfig {
    key: RegionKey;
    label: string;
    defaultLocale: string;
    defaultCurrency: string;
    supportedLocales: string[];
    supportedCurrencies: string[];
    compliance: {
        requiresGdpr: boolean;
        requiresCcpa: boolean;
        requiresDataResidency: boolean;
    };
}
export declare const REGION_CONFIG: Record<RegionKey, RegionConfig>;
export declare const SUPPORTED_CURRENCIES: string[];
export declare const SUPPORTED_LOCALES: string[];
declare const BASE_PRICE_IDS: {
    readonly PREMIUM_CAREER: string;
    readonly PREMIUM_PROFESSIONAL: string;
    readonly PREMIUM_ENTREPRENEUR: string;
    readonly PREMIUM_CREATOR: string;
};
export declare const PRICE_ID_MAP: {
    readonly AUD: {
        readonly PREMIUM_CAREER: string;
        readonly PREMIUM_PROFESSIONAL: string;
        readonly PREMIUM_ENTREPRENEUR: string;
        readonly PREMIUM_CREATOR: string;
    };
    readonly USD: {
        readonly PREMIUM_CAREER: string;
        readonly PREMIUM_PROFESSIONAL: string;
        readonly PREMIUM_ENTREPRENEUR: string;
        readonly PREMIUM_CREATOR: string;
    };
    readonly GBP: {
        readonly PREMIUM_CAREER: string;
        readonly PREMIUM_PROFESSIONAL: string;
        readonly PREMIUM_ENTREPRENEUR: string;
        readonly PREMIUM_CREATOR: string;
    };
    readonly EUR: {
        readonly PREMIUM_CAREER: string;
        readonly PREMIUM_PROFESSIONAL: string;
        readonly PREMIUM_ENTREPRENEUR: string;
        readonly PREMIUM_CREATOR: string;
    };
    readonly SGD: {
        readonly PREMIUM_CAREER: string;
        readonly PREMIUM_PROFESSIONAL: string;
        readonly PREMIUM_ENTREPRENEUR: string;
        readonly PREMIUM_CREATOR: string;
    };
    readonly PHP: {
        readonly PREMIUM_CAREER: string;
        readonly PREMIUM_PROFESSIONAL: string;
        readonly PREMIUM_ENTREPRENEUR: string;
        readonly PREMIUM_CREATOR: string;
    };
    readonly IDR: {
        readonly PREMIUM_CAREER: string;
        readonly PREMIUM_PROFESSIONAL: string;
        readonly PREMIUM_ENTREPRENEUR: string;
        readonly PREMIUM_CREATOR: string;
    };
    readonly THB: {
        readonly PREMIUM_CAREER: string;
        readonly PREMIUM_PROFESSIONAL: string;
        readonly PREMIUM_ENTREPRENEUR: string;
        readonly PREMIUM_CREATOR: string;
    };
    readonly VND: {
        readonly PREMIUM_CAREER: string;
        readonly PREMIUM_PROFESSIONAL: string;
        readonly PREMIUM_ENTREPRENEUR: string;
        readonly PREMIUM_CREATOR: string;
    };
    readonly MYR: {
        readonly PREMIUM_CAREER: string;
        readonly PREMIUM_PROFESSIONAL: string;
        readonly PREMIUM_ENTREPRENEUR: string;
        readonly PREMIUM_CREATOR: string;
    };
    readonly AED: {
        readonly PREMIUM_CAREER: string;
        readonly PREMIUM_PROFESSIONAL: string;
        readonly PREMIUM_ENTREPRENEUR: string;
        readonly PREMIUM_CREATOR: string;
    };
    readonly SAR: {
        readonly PREMIUM_CAREER: string;
        readonly PREMIUM_PROFESSIONAL: string;
        readonly PREMIUM_ENTREPRENEUR: string;
        readonly PREMIUM_CREATOR: string;
    };
    readonly ZAR: {
        readonly PREMIUM_CAREER: string;
        readonly PREMIUM_PROFESSIONAL: string;
        readonly PREMIUM_ENTREPRENEUR: string;
        readonly PREMIUM_CREATOR: string;
    };
    readonly EGP: {
        readonly PREMIUM_CAREER: string;
        readonly PREMIUM_PROFESSIONAL: string;
        readonly PREMIUM_ENTREPRENEUR: string;
        readonly PREMIUM_CREATOR: string;
    };
};
export type SubscriptionTierKey = keyof typeof BASE_PRICE_IDS;
export declare function getPriceIdForTier(tier: SubscriptionTierKey, currency: string): string;
export {};
//# sourceMappingURL=regions.d.ts.map