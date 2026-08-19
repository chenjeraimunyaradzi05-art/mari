"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRICE_ID_MAP = exports.SUPPORTED_LOCALES = exports.SUPPORTED_CURRENCIES = exports.REGION_CONFIG = void 0;
exports.getPriceIdForTier = getPriceIdForTier;
exports.REGION_CONFIG = {
    ANZ: {
        key: 'ANZ',
        label: 'Australia / New Zealand',
        defaultLocale: 'en-AU',
        defaultCurrency: 'AUD',
        supportedLocales: ['en-AU', 'en-NZ'],
        supportedCurrencies: ['AUD', 'NZD'],
        compliance: {
            requiresGdpr: false,
            requiresCcpa: false,
            requiresDataResidency: true,
        },
    },
    US: {
        key: 'US',
        label: 'United States',
        defaultLocale: 'en-US',
        defaultCurrency: 'USD',
        supportedLocales: ['en-US', 'es-US'],
        supportedCurrencies: ['USD'],
        compliance: {
            requiresGdpr: false,
            requiresCcpa: true,
            requiresDataResidency: false,
        },
    },
    UK: {
        key: 'UK',
        label: 'United Kingdom',
        defaultLocale: 'en-GB',
        defaultCurrency: 'GBP',
        supportedLocales: ['en', 'en-GB'],
        supportedCurrencies: ['GBP'],
        compliance: {
            requiresGdpr: true,
            requiresCcpa: false,
            requiresDataResidency: true,
        },
    },
    EU: {
        key: 'EU',
        label: 'European Union',
        defaultLocale: 'en-GB',
        defaultCurrency: 'EUR',
        supportedLocales: [
            'en',
            'en-GB',
            'en-IE',
            'fr',
            'fr-FR',
            'de',
            'de-DE',
            'es',
            'es-ES',
            'it',
            'it-IT',
            'nl',
            'nl-NL',
        ],
        supportedCurrencies: ['EUR'],
        compliance: {
            requiresGdpr: true,
            requiresCcpa: false,
            requiresDataResidency: true,
        },
    },
    SEA: {
        key: 'SEA',
        label: 'Southeast Asia',
        defaultLocale: 'en-SG',
        defaultCurrency: 'SGD',
        supportedLocales: ['en-SG', 'en-PH', 'id-ID', 'th-TH', 'vi-VN', 'ms-MY'],
        supportedCurrencies: ['SGD', 'PHP', 'IDR', 'THB', 'VND', 'MYR'],
        compliance: {
            requiresGdpr: false,
            requiresCcpa: false,
            requiresDataResidency: true,
        },
    },
    MEA: {
        key: 'MEA',
        label: 'Middle East & Africa',
        defaultLocale: 'ar-AE',
        defaultCurrency: 'AED',
        supportedLocales: ['ar-AE', 'ar-SA', 'en-AE', 'en-SA', 'en-ZA', 'en-EG'],
        supportedCurrencies: ['AED', 'SAR', 'ZAR', 'EGP'],
        compliance: {
            requiresGdpr: false,
            requiresCcpa: false,
            requiresDataResidency: true,
        },
    },
    ROW: {
        key: 'ROW',
        label: 'Rest of World',
        defaultLocale: 'en-US',
        defaultCurrency: 'USD',
        supportedLocales: ['en-US', 'es-MX', 'es', 'pt-BR', 'ja', 'ko', 'hi'],
        supportedCurrencies: ['USD', 'JPY', 'KRW', 'INR', 'BRL', 'MXN'],
        compliance: {
            requiresGdpr: false,
            requiresCcpa: false,
            requiresDataResidency: false,
        },
    },
};
exports.SUPPORTED_CURRENCIES = Array.from(new Set(Object.values(exports.REGION_CONFIG).flatMap((region) => region.supportedCurrencies)));
exports.SUPPORTED_LOCALES = Array.from(new Set(Object.values(exports.REGION_CONFIG).flatMap((region) => region.supportedLocales)));
const BASE_PRICE_IDS = {
    PREMIUM_CAREER: process.env.STRIPE_PRICE_CAREER || 'price_career',
    PREMIUM_PROFESSIONAL: process.env.STRIPE_PRICE_PROFESSIONAL || 'price_professional',
    PREMIUM_ENTREPRENEUR: process.env.STRIPE_PRICE_ENTREPRENEUR || 'price_entrepreneur',
    PREMIUM_CREATOR: process.env.STRIPE_PRICE_CREATOR || 'price_creator',
};
const USD_PRICE_IDS = {
    PREMIUM_CAREER: process.env.STRIPE_PRICE_CAREER_USD || BASE_PRICE_IDS.PREMIUM_CAREER,
    PREMIUM_PROFESSIONAL: process.env.STRIPE_PRICE_PROFESSIONAL_USD || BASE_PRICE_IDS.PREMIUM_PROFESSIONAL,
    PREMIUM_ENTREPRENEUR: process.env.STRIPE_PRICE_ENTREPRENEUR_USD || BASE_PRICE_IDS.PREMIUM_ENTREPRENEUR,
    PREMIUM_CREATOR: process.env.STRIPE_PRICE_CREATOR_USD || BASE_PRICE_IDS.PREMIUM_CREATOR,
};
const GBP_PRICE_IDS = {
    PREMIUM_CAREER: process.env.STRIPE_PRICE_CAREER_GBP || BASE_PRICE_IDS.PREMIUM_CAREER,
    PREMIUM_PROFESSIONAL: process.env.STRIPE_PRICE_PROFESSIONAL_GBP || BASE_PRICE_IDS.PREMIUM_PROFESSIONAL,
    PREMIUM_ENTREPRENEUR: process.env.STRIPE_PRICE_ENTREPRENEUR_GBP || BASE_PRICE_IDS.PREMIUM_ENTREPRENEUR,
    PREMIUM_CREATOR: process.env.STRIPE_PRICE_CREATOR_GBP || BASE_PRICE_IDS.PREMIUM_CREATOR,
};
const EUR_PRICE_IDS = {
    PREMIUM_CAREER: process.env.STRIPE_PRICE_CAREER_EUR || BASE_PRICE_IDS.PREMIUM_CAREER,
    PREMIUM_PROFESSIONAL: process.env.STRIPE_PRICE_PROFESSIONAL_EUR || BASE_PRICE_IDS.PREMIUM_PROFESSIONAL,
    PREMIUM_ENTREPRENEUR: process.env.STRIPE_PRICE_ENTREPRENEUR_EUR || BASE_PRICE_IDS.PREMIUM_ENTREPRENEUR,
    PREMIUM_CREATOR: process.env.STRIPE_PRICE_CREATOR_EUR || BASE_PRICE_IDS.PREMIUM_CREATOR,
};
const SGD_PRICE_IDS = {
    PREMIUM_CAREER: process.env.STRIPE_PRICE_CAREER_SGD || BASE_PRICE_IDS.PREMIUM_CAREER,
    PREMIUM_PROFESSIONAL: process.env.STRIPE_PRICE_PROFESSIONAL_SGD || BASE_PRICE_IDS.PREMIUM_PROFESSIONAL,
    PREMIUM_ENTREPRENEUR: process.env.STRIPE_PRICE_ENTREPRENEUR_SGD || BASE_PRICE_IDS.PREMIUM_ENTREPRENEUR,
    PREMIUM_CREATOR: process.env.STRIPE_PRICE_CREATOR_SGD || BASE_PRICE_IDS.PREMIUM_CREATOR,
};
const PHP_PRICE_IDS = {
    PREMIUM_CAREER: process.env.STRIPE_PRICE_CAREER_PHP || BASE_PRICE_IDS.PREMIUM_CAREER,
    PREMIUM_PROFESSIONAL: process.env.STRIPE_PRICE_PROFESSIONAL_PHP || BASE_PRICE_IDS.PREMIUM_PROFESSIONAL,
    PREMIUM_ENTREPRENEUR: process.env.STRIPE_PRICE_ENTREPRENEUR_PHP || BASE_PRICE_IDS.PREMIUM_ENTREPRENEUR,
    PREMIUM_CREATOR: process.env.STRIPE_PRICE_CREATOR_PHP || BASE_PRICE_IDS.PREMIUM_CREATOR,
};
const IDR_PRICE_IDS = {
    PREMIUM_CAREER: process.env.STRIPE_PRICE_CAREER_IDR || BASE_PRICE_IDS.PREMIUM_CAREER,
    PREMIUM_PROFESSIONAL: process.env.STRIPE_PRICE_PROFESSIONAL_IDR || BASE_PRICE_IDS.PREMIUM_PROFESSIONAL,
    PREMIUM_ENTREPRENEUR: process.env.STRIPE_PRICE_ENTREPRENEUR_IDR || BASE_PRICE_IDS.PREMIUM_ENTREPRENEUR,
    PREMIUM_CREATOR: process.env.STRIPE_PRICE_CREATOR_IDR || BASE_PRICE_IDS.PREMIUM_CREATOR,
};
const THB_PRICE_IDS = {
    PREMIUM_CAREER: process.env.STRIPE_PRICE_CAREER_THB || BASE_PRICE_IDS.PREMIUM_CAREER,
    PREMIUM_PROFESSIONAL: process.env.STRIPE_PRICE_PROFESSIONAL_THB || BASE_PRICE_IDS.PREMIUM_PROFESSIONAL,
    PREMIUM_ENTREPRENEUR: process.env.STRIPE_PRICE_ENTREPRENEUR_THB || BASE_PRICE_IDS.PREMIUM_ENTREPRENEUR,
    PREMIUM_CREATOR: process.env.STRIPE_PRICE_CREATOR_THB || BASE_PRICE_IDS.PREMIUM_CREATOR,
};
const VND_PRICE_IDS = {
    PREMIUM_CAREER: process.env.STRIPE_PRICE_CAREER_VND || BASE_PRICE_IDS.PREMIUM_CAREER,
    PREMIUM_PROFESSIONAL: process.env.STRIPE_PRICE_PROFESSIONAL_VND || BASE_PRICE_IDS.PREMIUM_PROFESSIONAL,
    PREMIUM_ENTREPRENEUR: process.env.STRIPE_PRICE_ENTREPRENEUR_VND || BASE_PRICE_IDS.PREMIUM_ENTREPRENEUR,
    PREMIUM_CREATOR: process.env.STRIPE_PRICE_CREATOR_VND || BASE_PRICE_IDS.PREMIUM_CREATOR,
};
const MYR_PRICE_IDS = {
    PREMIUM_CAREER: process.env.STRIPE_PRICE_CAREER_MYR || BASE_PRICE_IDS.PREMIUM_CAREER,
    PREMIUM_PROFESSIONAL: process.env.STRIPE_PRICE_PROFESSIONAL_MYR || BASE_PRICE_IDS.PREMIUM_PROFESSIONAL,
    PREMIUM_ENTREPRENEUR: process.env.STRIPE_PRICE_ENTREPRENEUR_MYR || BASE_PRICE_IDS.PREMIUM_ENTREPRENEUR,
    PREMIUM_CREATOR: process.env.STRIPE_PRICE_CREATOR_MYR || BASE_PRICE_IDS.PREMIUM_CREATOR,
};
const AED_PRICE_IDS = {
    PREMIUM_CAREER: process.env.STRIPE_PRICE_CAREER_AED || BASE_PRICE_IDS.PREMIUM_CAREER,
    PREMIUM_PROFESSIONAL: process.env.STRIPE_PRICE_PROFESSIONAL_AED || BASE_PRICE_IDS.PREMIUM_PROFESSIONAL,
    PREMIUM_ENTREPRENEUR: process.env.STRIPE_PRICE_ENTREPRENEUR_AED || BASE_PRICE_IDS.PREMIUM_ENTREPRENEUR,
    PREMIUM_CREATOR: process.env.STRIPE_PRICE_CREATOR_AED || BASE_PRICE_IDS.PREMIUM_CREATOR,
};
const SAR_PRICE_IDS = {
    PREMIUM_CAREER: process.env.STRIPE_PRICE_CAREER_SAR || BASE_PRICE_IDS.PREMIUM_CAREER,
    PREMIUM_PROFESSIONAL: process.env.STRIPE_PRICE_PROFESSIONAL_SAR || BASE_PRICE_IDS.PREMIUM_PROFESSIONAL,
    PREMIUM_ENTREPRENEUR: process.env.STRIPE_PRICE_ENTREPRENEUR_SAR || BASE_PRICE_IDS.PREMIUM_ENTREPRENEUR,
    PREMIUM_CREATOR: process.env.STRIPE_PRICE_CREATOR_SAR || BASE_PRICE_IDS.PREMIUM_CREATOR,
};
const ZAR_PRICE_IDS = {
    PREMIUM_CAREER: process.env.STRIPE_PRICE_CAREER_ZAR || BASE_PRICE_IDS.PREMIUM_CAREER,
    PREMIUM_PROFESSIONAL: process.env.STRIPE_PRICE_PROFESSIONAL_ZAR || BASE_PRICE_IDS.PREMIUM_PROFESSIONAL,
    PREMIUM_ENTREPRENEUR: process.env.STRIPE_PRICE_ENTREPRENEUR_ZAR || BASE_PRICE_IDS.PREMIUM_ENTREPRENEUR,
    PREMIUM_CREATOR: process.env.STRIPE_PRICE_CREATOR_ZAR || BASE_PRICE_IDS.PREMIUM_CREATOR,
};
const EGP_PRICE_IDS = {
    PREMIUM_CAREER: process.env.STRIPE_PRICE_CAREER_EGP || BASE_PRICE_IDS.PREMIUM_CAREER,
    PREMIUM_PROFESSIONAL: process.env.STRIPE_PRICE_PROFESSIONAL_EGP || BASE_PRICE_IDS.PREMIUM_PROFESSIONAL,
    PREMIUM_ENTREPRENEUR: process.env.STRIPE_PRICE_ENTREPRENEUR_EGP || BASE_PRICE_IDS.PREMIUM_ENTREPRENEUR,
    PREMIUM_CREATOR: process.env.STRIPE_PRICE_CREATOR_EGP || BASE_PRICE_IDS.PREMIUM_CREATOR,
};
const AUD_PRICE_IDS = BASE_PRICE_IDS;
exports.PRICE_ID_MAP = {
    AUD: AUD_PRICE_IDS,
    USD: USD_PRICE_IDS,
    GBP: GBP_PRICE_IDS,
    EUR: EUR_PRICE_IDS,
    SGD: SGD_PRICE_IDS,
    PHP: PHP_PRICE_IDS,
    IDR: IDR_PRICE_IDS,
    THB: THB_PRICE_IDS,
    VND: VND_PRICE_IDS,
    MYR: MYR_PRICE_IDS,
    AED: AED_PRICE_IDS,
    SAR: SAR_PRICE_IDS,
    ZAR: ZAR_PRICE_IDS,
    EGP: EGP_PRICE_IDS,
};
function getPriceIdForTier(tier, currency) {
    const normalizedCurrency = currency.toUpperCase();
    const priceMap = exports.PRICE_ID_MAP[normalizedCurrency];
    if (priceMap && priceMap[tier]) {
        return priceMap[tier];
    }
    return AUD_PRICE_IDS[tier];
}
//# sourceMappingURL=regions.js.map