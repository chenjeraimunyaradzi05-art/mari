/**
 * UK/EU Region Configuration
 * Handles region-specific settings, pricing, and compliance requirements
 * Phase 4: UK/EU Market Launch
 */
export interface RegionConfig {
    code: string;
    name: string;
    currency: string;
    currencySymbol: string;
    locale: string;
    timezone: string;
    dateFormat: string;
    gdprApplicable: boolean;
    vatRate: number;
    vatInclusive: boolean;
    regulatoryBody: string;
    regulatoryUrl: string;
    ageOfConsent: number;
    dataResidency: string;
    supportHours: string;
}
export declare const REGION_CONFIGS: Record<string, RegionConfig>;
export declare const UK_PRICING: {
    PREMIUM_CAREER: {
        monthly: number;
        annual: number;
        stripePriceId: {
            monthly: string;
            annual: string;
        };
    };
    PREMIUM_PROFESSIONAL: {
        monthly: number;
        annual: number;
        stripePriceId: {
            monthly: string;
            annual: string;
        };
    };
    PREMIUM_ENTREPRENEUR: {
        monthly: number;
        annual: number;
        stripePriceId: {
            monthly: string;
            annual: string;
        };
    };
    PREMIUM_CREATOR: {
        monthly: number;
        annual: number;
        stripePriceId: {
            monthly: string;
            annual: string;
        };
    };
};
export declare const EU_PRICING: {
    PREMIUM_CAREER: {
        monthly: number;
        annual: number;
        stripePriceId: {
            monthly: string;
            annual: string;
        };
    };
    PREMIUM_PROFESSIONAL: {
        monthly: number;
        annual: number;
        stripePriceId: {
            monthly: string;
            annual: string;
        };
    };
    PREMIUM_ENTREPRENEUR: {
        monthly: number;
        annual: number;
        stripePriceId: {
            monthly: string;
            annual: string;
        };
    };
    PREMIUM_CREATOR: {
        monthly: number;
        annual: number;
        stripePriceId: {
            monthly: string;
            annual: string;
        };
    };
};
export declare const UK_ONLINE_SAFETY_CONFIG: {
    ageVerificationRequired: boolean;
    minimumAge: number;
    illegalContentRemovalHours: number;
    harmfulContentReviewHours: number;
    reportingMechanismRequired: boolean;
    transparencyReportRequired: boolean;
    transparencyReportFrequency: string;
    blockingRequired: boolean;
    mutingRequired: boolean;
    contentFilteringAvailable: boolean;
    ofcomUrl: string;
};
export declare const GDPR_CONFIG: {
    dsarResponseDays: number;
    dsarExtensionDays: number;
    breachNotificationHours: number;
    explicitConsentRequired: boolean;
    granularConsentRequired: boolean;
    consentWithdrawalEasy: boolean;
    dataMinimizationEnforced: boolean;
    purposeLimitationEnforced: boolean;
    sccsRequired: boolean;
    adequacyDecisionCountries: string[];
    dpoRequired: boolean;
    dpoContact: string;
};
/**
 * Get region configuration from country code
 */
export declare function getRegionFromCountry(countryCode: string): string;
/**
 * Get pricing for region
 */
export declare function getPricingForRegion(region: string): {
    PREMIUM_CAREER: {
        monthly: number;
        annual: number;
        stripePriceId: {
            monthly: string;
            annual: string;
        };
    };
    PREMIUM_PROFESSIONAL: {
        monthly: number;
        annual: number;
        stripePriceId: {
            monthly: string;
            annual: string;
        };
    };
    PREMIUM_ENTREPRENEUR: {
        monthly: number;
        annual: number;
        stripePriceId: {
            monthly: string;
            annual: string;
        };
    };
    PREMIUM_CREATOR: {
        monthly: number;
        annual: number;
        stripePriceId: {
            monthly: string;
            annual: string;
        };
    };
} | null;
/**
 * Check if GDPR applies to region
 */
export declare function isGDPRRegion(region: string): boolean;
/**
 * Format currency for region
 */
export declare function formatCurrency(amount: number, region: string): string;
/**
 * Format date for region
 */
export declare function formatDate(date: Date, region: string): string;
//# sourceMappingURL=region.config.d.ts.map