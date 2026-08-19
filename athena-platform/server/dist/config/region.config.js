"use strict";
/**
 * UK/EU Region Configuration
 * Handles region-specific settings, pricing, and compliance requirements
 * Phase 4: UK/EU Market Launch
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GDPR_CONFIG = exports.UK_ONLINE_SAFETY_CONFIG = exports.EU_PRICING = exports.UK_PRICING = exports.REGION_CONFIGS = void 0;
exports.getRegionFromCountry = getRegionFromCountry;
exports.getPricingForRegion = getPricingForRegion;
exports.isGDPRRegion = isGDPRRegion;
exports.formatCurrency = formatCurrency;
exports.formatDate = formatDate;
exports.REGION_CONFIGS = {
    UK: {
        code: 'UK',
        name: 'United Kingdom',
        currency: 'GBP',
        currencySymbol: '£',
        locale: 'en-GB',
        timezone: 'Europe/London',
        dateFormat: 'DD/MM/YYYY',
        gdprApplicable: true,
        vatRate: 0.20,
        vatInclusive: true,
        regulatoryBody: 'ICO (Information Commissioner\'s Office)',
        regulatoryUrl: 'https://ico.org.uk/',
        ageOfConsent: 13,
        dataResidency: 'EU/UK',
        supportHours: '09:00-18:00 GMT',
    },
    EU: {
        code: 'EU',
        name: 'European Union',
        currency: 'EUR',
        currencySymbol: '€',
        locale: 'en-EU',
        timezone: 'Europe/Brussels',
        dateFormat: 'DD/MM/YYYY',
        gdprApplicable: true,
        vatRate: 0.21, // Average EU VAT
        vatInclusive: true,
        regulatoryBody: 'National DPA',
        regulatoryUrl: 'https://edpb.europa.eu/',
        ageOfConsent: 16,
        dataResidency: 'EU',
        supportHours: '09:00-18:00 CET',
    },
    ANZ: {
        code: 'ANZ',
        name: 'Australia & New Zealand',
        currency: 'AUD',
        currencySymbol: '$',
        locale: 'en-AU',
        timezone: 'Australia/Sydney',
        dateFormat: 'DD/MM/YYYY',
        gdprApplicable: false,
        vatRate: 0.10, // GST
        vatInclusive: true,
        regulatoryBody: 'OAIC',
        regulatoryUrl: 'https://www.oaic.gov.au/',
        ageOfConsent: 13,
        dataResidency: 'ANZ',
        supportHours: '09:00-18:00 AEST',
    },
    US: {
        code: 'US',
        name: 'United States',
        currency: 'USD',
        currencySymbol: '$',
        locale: 'en-US',
        timezone: 'America/New_York',
        dateFormat: 'MM/DD/YYYY',
        gdprApplicable: false,
        vatRate: 0, // Sales tax varies by state
        vatInclusive: false,
        regulatoryBody: 'FTC / State AGs',
        regulatoryUrl: 'https://www.ftc.gov/',
        ageOfConsent: 13, // COPPA
        dataResidency: 'US',
        supportHours: '09:00-18:00 EST',
    },
    ROW: {
        code: 'ROW',
        name: 'Rest of World',
        currency: 'USD',
        currencySymbol: '$',
        locale: 'en-US',
        timezone: 'UTC',
        dateFormat: 'YYYY-MM-DD',
        gdprApplicable: false,
        vatRate: 0,
        vatInclusive: false,
        regulatoryBody: 'Local regulators',
        regulatoryUrl: 'https://athena.com',
        ageOfConsent: 13,
        dataResidency: 'Regional',
        supportHours: '24/7 online',
    },
};
// UK/EU specific pricing (VAT inclusive)
exports.UK_PRICING = {
    PREMIUM_CAREER: {
        monthly: 7.99,
        annual: 79.99,
        stripePriceId: {
            monthly: 'price_uk_career_monthly',
            annual: 'price_uk_career_annual',
        },
    },
    PREMIUM_PROFESSIONAL: {
        monthly: 19.99,
        annual: 199.99,
        stripePriceId: {
            monthly: 'price_uk_professional_monthly',
            annual: 'price_uk_professional_annual',
        },
    },
    PREMIUM_ENTREPRENEUR: {
        monthly: 14.99,
        annual: 149.99,
        stripePriceId: {
            monthly: 'price_uk_entrepreneur_monthly',
            annual: 'price_uk_entrepreneur_annual',
        },
    },
    PREMIUM_CREATOR: {
        monthly: 79.99,
        annual: 799.99,
        stripePriceId: {
            monthly: 'price_uk_creator_monthly',
            annual: 'price_uk_creator_annual',
        },
    },
};
exports.EU_PRICING = {
    PREMIUM_CAREER: {
        monthly: 9.99,
        annual: 99.99,
        stripePriceId: {
            monthly: 'price_eu_career_monthly',
            annual: 'price_eu_career_annual',
        },
    },
    PREMIUM_PROFESSIONAL: {
        monthly: 24.99,
        annual: 249.99,
        stripePriceId: {
            monthly: 'price_eu_professional_monthly',
            annual: 'price_eu_professional_annual',
        },
    },
    PREMIUM_ENTREPRENEUR: {
        monthly: 19.99,
        annual: 199.99,
        stripePriceId: {
            monthly: 'price_eu_entrepreneur_monthly',
            annual: 'price_eu_entrepreneur_annual',
        },
    },
    PREMIUM_CREATOR: {
        monthly: 99.99,
        annual: 999.99,
        stripePriceId: {
            monthly: 'price_eu_creator_monthly',
            annual: 'price_eu_creator_annual',
        },
    },
};
// UK Online Safety Act compliance requirements
exports.UK_ONLINE_SAFETY_CONFIG = {
    // Age verification requirements
    ageVerificationRequired: false, // Not yet mandated for our category
    minimumAge: 13,
    // Content moderation requirements
    illegalContentRemovalHours: 24,
    harmfulContentReviewHours: 48,
    // Reporting requirements
    reportingMechanismRequired: true,
    transparencyReportRequired: true,
    transparencyReportFrequency: 'annual',
    // Safety features
    blockingRequired: true,
    mutingRequired: true,
    contentFilteringAvailable: true,
    // Regulator contact
    ofcomUrl: 'https://www.ofcom.org.uk/',
};
// GDPR-specific requirements
exports.GDPR_CONFIG = {
    // Data subject rights
    dsarResponseDays: 30,
    dsarExtensionDays: 60, // For complex requests
    // Breach notification
    breachNotificationHours: 72,
    // Consent requirements
    explicitConsentRequired: true,
    granularConsentRequired: true,
    consentWithdrawalEasy: true,
    // Data minimization
    dataMinimizationEnforced: true,
    purposeLimitationEnforced: true,
    // International transfers
    sccsRequired: true, // Standard Contractual Clauses
    adequacyDecisionCountries: ['UK', 'Canada', 'Japan', 'South Korea', 'Argentina'],
    // DPO requirements
    dpoRequired: true, // For large-scale processing
    dpoContact: 'dpo@athena.com',
};
/**
 * Get region configuration from country code
 */
function getRegionFromCountry(countryCode) {
    const ukCountries = ['GB', 'UK'];
    const euCountries = [
        'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
        'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
        'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
    ];
    const anzCountries = ['AU', 'NZ'];
    const rowCountries = ['JP', 'KR', 'IN', 'BR', 'MX'];
    if (ukCountries.includes(countryCode))
        return 'UK';
    if (euCountries.includes(countryCode))
        return 'EU';
    if (anzCountries.includes(countryCode))
        return 'ANZ';
    if (countryCode === 'US')
        return 'US';
    if (rowCountries.includes(countryCode))
        return 'ROW';
    return 'ROW';
}
/**
 * Get pricing for region
 */
function getPricingForRegion(region) {
    switch (region) {
        case 'UK':
            return exports.UK_PRICING;
        case 'EU':
            return exports.EU_PRICING;
        default:
            return null; // Use default pricing
    }
}
/**
 * Check if GDPR applies to region
 */
function isGDPRRegion(region) {
    return region === 'UK' || region === 'EU';
}
/**
 * Format currency for region
 */
function formatCurrency(amount, region) {
    const config = exports.REGION_CONFIGS[region] || exports.REGION_CONFIGS.ANZ;
    return new Intl.NumberFormat(config.locale, {
        style: 'currency',
        currency: config.currency,
    }).format(amount);
}
/**
 * Format date for region
 */
function formatDate(date, region) {
    const config = exports.REGION_CONFIGS[region] || exports.REGION_CONFIGS.ANZ;
    return new Intl.DateTimeFormat(config.locale, {
        dateStyle: 'medium',
    }).format(date);
}
//# sourceMappingURL=region.config.js.map