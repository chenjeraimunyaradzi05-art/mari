"use strict";
/**
 * Regional Compliance Service
 * Handle jurisdiction-specific legal requirements
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.regionalComplianceService = exports.COMPLIANCE_REGIONS = void 0;
const logger_1 = require("../utils/logger");
// ==========================================
// REGIONAL COMPLIANCE DATA
// ==========================================
exports.COMPLIANCE_REGIONS = [
    {
        id: 'au',
        name: 'Australia',
        country: 'AU',
        regulations: [
            {
                id: 'privacy-act',
                name: 'Privacy Act 1988',
                shortName: 'Privacy Act',
                effectiveDate: '1988-12-21',
                requirements: [
                    'Collection notices required',
                    'Access and correction rights',
                    'Cross-border disclosure rules',
                    'Notifiable Data Breaches scheme',
                ],
                penalties: 'Up to AUD 50 million for serious breaches',
            },
            {
                id: 'spam-act',
                name: 'Spam Act 2003',
                shortName: 'Spam Act',
                effectiveDate: '2003-12-12',
                requirements: [
                    'Consent required for commercial electronic messages',
                    'Unsubscribe mechanism required',
                    'Sender identification required',
                ],
                penalties: 'Up to AUD 2.22 million per day',
            },
        ],
        ageOfConsent: 18,
        ageOfMajority: 18,
        dataProtectionAuthority: {
            name: 'Office of the Australian Information Commissioner',
            website: 'https://www.oaic.gov.au',
            email: 'enquiries@oaic.gov.au',
        },
        requiredDisclosures: [
            'Privacy Policy',
            'Collection Notice',
            'Cookie Notice',
        ],
        bannedContent: ['Child exploitation', 'Terrorism promotion', 'Extreme violence'],
        specialRequirements: {
            minorDataProtection: true,
            employmentRecordsExemption: true,
        },
    },
    {
        id: 'eu',
        name: 'European Union',
        country: 'EU',
        regulations: [
            {
                id: 'gdpr',
                name: 'General Data Protection Regulation',
                shortName: 'GDPR',
                effectiveDate: '2018-05-25',
                requirements: [
                    'Lawful basis for processing',
                    'Data subject rights (access, erasure, portability)',
                    'Data Protection Officer required for large-scale processing',
                    'Privacy by design and default',
                    'Data breach notification within 72 hours',
                    'Data Protection Impact Assessments',
                ],
                penalties: 'Up to EUR 20 million or 4% of global turnover',
            },
            {
                id: 'eprivacy',
                name: 'ePrivacy Directive',
                shortName: 'ePrivacy',
                effectiveDate: '2002-07-31',
                requirements: [
                    'Cookie consent required',
                    'Electronic marketing consent',
                    'Confidentiality of communications',
                ],
                penalties: 'Varies by member state',
            },
        ],
        ageOfConsent: 16,
        ageOfMajority: 18,
        dataProtectionAuthority: {
            name: 'European Data Protection Board',
            website: 'https://edpb.europa.eu',
            email: 'edpb@edpb.europa.eu',
        },
        requiredDisclosures: [
            'Privacy Policy (Article 13/14)',
            'Cookie Banner',
            'Data Processing Agreements',
        ],
        bannedContent: ['Hate speech', 'Terrorism content', 'Child exploitation'],
        specialRequirements: {
            rightToBeForgotten: true,
            dataPortability: true,
            dpoRequired: true,
            crossBorderTransferRestrictions: true,
        },
    },
    {
        id: 'us-ca',
        name: 'California, USA',
        country: 'US',
        regulations: [
            {
                id: 'ccpa',
                name: 'California Consumer Privacy Act',
                shortName: 'CCPA',
                effectiveDate: '2020-01-01',
                requirements: [
                    'Right to know what data is collected',
                    'Right to delete personal information',
                    'Right to opt-out of data sale',
                    'Non-discrimination for exercising rights',
                ],
                penalties: 'Up to USD 7,500 per intentional violation',
            },
            {
                id: 'cpra',
                name: 'California Privacy Rights Act',
                shortName: 'CPRA',
                effectiveDate: '2023-01-01',
                requirements: [
                    'Right to correct personal information',
                    'Right to limit use of sensitive data',
                    'California Privacy Protection Agency enforcement',
                    'Data minimization requirements',
                ],
                penalties: 'Up to USD 7,500 per intentional violation',
            },
        ],
        ageOfConsent: 13,
        ageOfMajority: 18,
        dataProtectionAuthority: {
            name: 'California Privacy Protection Agency',
            website: 'https://cppa.ca.gov',
            email: 'info@cppa.ca.gov',
        },
        requiredDisclosures: [
            'Privacy Policy with CCPA disclosures',
            'Do Not Sell My Personal Information link',
            'Notice at Collection',
        ],
        bannedContent: ['Child exploitation', 'Illegal content'],
        specialRequirements: {
            doNotSellLink: true,
            financialIncentiveDisclosure: true,
            minorDataConsent: true,
        },
    },
    {
        id: 'in',
        name: 'India',
        country: 'IN',
        regulations: [
            {
                id: 'dpdp',
                name: 'Digital Personal Data Protection Act',
                shortName: 'DPDP',
                effectiveDate: '2023-08-11',
                requirements: [
                    'Consent for data processing',
                    'Purpose limitation',
                    'Data localization for certain categories',
                    'Grievance redressal mechanism',
                ],
                penalties: 'Up to INR 250 crore (approx USD 30 million)',
            },
        ],
        ageOfConsent: 18,
        ageOfMajority: 18,
        dataProtectionAuthority: {
            name: 'Data Protection Board of India',
            website: 'https://dpb.gov.in',
            email: 'contact@dpb.gov.in',
        },
        requiredDisclosures: [
            'Privacy Policy in English and Hindi',
            'Consent notice',
            'Grievance officer contact',
        ],
        bannedContent: ['Content against sovereignty', 'Religious hatred', 'Child exploitation'],
        specialRequirements: {
            dataLocalization: true,
            grievanceOfficer: true,
            vernacularLanguageSupport: true,
        },
    },
];
// In-memory storage
const consentRecords = new Map();
// ==========================================
// SERVICE
// ==========================================
exports.regionalComplianceService = {
    /**
     * Get compliance requirements for region
     */
    getRegionCompliance(regionId) {
        return exports.COMPLIANCE_REGIONS.find(r => r.id === regionId);
    },
    /**
     * Get region by country code
     */
    getRegionByCountry(countryCode) {
        // Map EU countries to EU region
        const euCountries = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];
        if (euCountries.includes(countryCode)) {
            return exports.COMPLIANCE_REGIONS.find(r => r.id === 'eu');
        }
        return exports.COMPLIANCE_REGIONS.find(r => r.country === countryCode);
    },
    /**
     * Record user consent
     */
    async recordConsent(userId, consentType, granted, metadata) {
        const record = {
            userId,
            consentType,
            version: metadata.version,
            granted,
            grantedAt: granted ? new Date() : undefined,
            withdrawnAt: !granted ? new Date() : undefined,
            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent,
            region: metadata.region,
        };
        const userConsents = consentRecords.get(userId) || [];
        userConsents.push(record);
        consentRecords.set(userId, userConsents);
        logger_1.logger.info('Consent recorded', { userId, consentType, granted });
        return record;
    },
    /**
     * Get user consent status
     */
    getUserConsent(userId, consentType) {
        const userConsents = consentRecords.get(userId) || [];
        return userConsents
            .filter(c => c.consentType === consentType)
            .sort((a, b) => {
            const aDate = a.grantedAt || a.withdrawnAt || new Date(0);
            const bDate = b.grantedAt || b.withdrawnAt || new Date(0);
            return bDate.getTime() - aDate.getTime();
        })[0];
    },
    /**
     * Check compliance status for user
     */
    async checkCompliance(userId, region) {
        const regionConfig = exports.COMPLIANCE_REGIONS.find(r => r.id === region);
        if (!regionConfig) {
            return {
                userId,
                region,
                checks: [],
                overallCompliant: true,
                missingRequirements: [],
            };
        }
        const checks = [];
        const missingRequirements = [];
        // Check consent for data processing
        const dataConsent = this.getUserConsent(userId, 'data_processing');
        checks.push({
            check: 'Data processing consent',
            passed: !!dataConsent?.granted,
            details: dataConsent ? 'Consent recorded' : 'No consent on file',
        });
        if (!dataConsent?.granted)
            missingRequirements.push('Data processing consent');
        // Check marketing consent
        const marketingConsent = this.getUserConsent(userId, 'marketing');
        checks.push({
            check: 'Marketing consent',
            passed: marketingConsent !== undefined,
            details: marketingConsent ?
                (marketingConsent.granted ? 'Opted in' : 'Opted out') :
                'No preference recorded',
        });
        // Region-specific checks
        if (regionConfig.specialRequirements?.doNotSellLink) {
            const doNotSell = this.getUserConsent(userId, 'do_not_sell');
            checks.push({
                check: 'Do Not Sell preference',
                passed: doNotSell !== undefined,
            });
        }
        const overallCompliant = missingRequirements.length === 0;
        return { userId, region, checks, overallCompliant, missingRequirements };
    },
    /**
     * Get required consent types for region
     */
    getRequiredConsents(region) {
        const regionConfig = exports.COMPLIANCE_REGIONS.find(r => r.id === region);
        if (!regionConfig)
            return ['data_processing'];
        const consents = ['data_processing', 'cookies'];
        if (regionConfig.id === 'eu') {
            consents.push('marketing', 'analytics', 'third_party');
        }
        if (regionConfig.id === 'us-ca') {
            consents.push('data_sale', 'sensitive_data');
        }
        return consents;
    },
    /**
     * Check if content is allowed in region
     */
    isContentAllowed(content, region) {
        const regionConfig = exports.COMPLIANCE_REGIONS.find(r => r.id === region);
        if (!regionConfig)
            return { allowed: true };
        // Basic check against banned content types
        for (const banned of regionConfig.bannedContent) {
            if (content.toLowerCase().includes(banned.toLowerCase())) {
                return { allowed: false, reason: `Content violates ${banned} policy` };
            }
        }
        return { allowed: true };
    },
    /**
     * Get minimum age for region
     */
    getMinimumAge(region) {
        const regionConfig = exports.COMPLIANCE_REGIONS.find(r => r.id === region);
        return regionConfig?.ageOfConsent || 13;
    },
    /**
     * Generate compliance report
     */
    async generateComplianceReport(region) {
        const regionConfig = exports.COMPLIANCE_REGIONS.find(r => r.id === region);
        if (!regionConfig) {
            return {
                region,
                regulations: [],
                requirements: [],
                disclosures: [],
                lastUpdated: new Date(),
            };
        }
        return {
            region: regionConfig.name,
            regulations: regionConfig.regulations.map(r => r.name),
            requirements: regionConfig.regulations.flatMap(r => r.requirements),
            disclosures: regionConfig.requiredDisclosures,
            lastUpdated: new Date(),
        };
    },
};
//# sourceMappingURL=regional-compliance.service.js.map