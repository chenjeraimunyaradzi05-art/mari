"use strict";
/**
 * Data Residency Service
 * Regional data storage and GDPR/privacy compliance
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.dataResidencyService = exports.DATA_REGIONS = void 0;
const logger_1 = require("../utils/logger");
// ==========================================
// REGION CONFIGURATIONS
// ==========================================
exports.DATA_REGIONS = [
    {
        id: 'au-syd',
        name: 'Australia (Sydney)',
        country: 'AU',
        jurisdiction: 'Australian Privacy Principles',
        dataCenter: 'AWS ap-southeast-2',
        regulations: ['Privacy Act 1988', 'APP', 'NDB'],
        retentionPolicy: { default: 365, personal: 730, financial: 2555, audit: 2555 },
        encryptionRequired: true,
        crossBorderTransferAllowed: true,
        allowedDestinations: ['NZ', 'EU', 'US'],
    },
    {
        id: 'eu-fra',
        name: 'Europe (Frankfurt)',
        country: 'DE',
        jurisdiction: 'GDPR',
        dataCenter: 'AWS eu-central-1',
        regulations: ['GDPR', 'ePrivacy', 'BDSG'],
        retentionPolicy: { default: 365, personal: 365, financial: 3650, audit: 3650 },
        encryptionRequired: true,
        crossBorderTransferAllowed: false,
        allowedDestinations: ['EU', 'EEA'],
    },
    {
        id: 'us-east',
        name: 'United States (Virginia)',
        country: 'US',
        jurisdiction: 'CCPA/State Laws',
        dataCenter: 'AWS us-east-1',
        regulations: ['CCPA', 'CPRA', 'State Privacy Laws'],
        retentionPolicy: { default: 365, personal: 365, financial: 2555, audit: 2555 },
        encryptionRequired: true,
        crossBorderTransferAllowed: true,
        allowedDestinations: ['CA', 'UK', 'AU'],
    },
    {
        id: 'sg-sin',
        name: 'Singapore',
        country: 'SG',
        jurisdiction: 'PDPA',
        dataCenter: 'AWS ap-southeast-1',
        regulations: ['PDPA', 'MAS Guidelines'],
        retentionPolicy: { default: 365, personal: 365, financial: 2555, audit: 2555 },
        encryptionRequired: true,
        crossBorderTransferAllowed: true,
        allowedDestinations: ['MY', 'ID', 'PH', 'TH', 'VN', 'AU'],
    },
    {
        id: 'in-mum',
        name: 'India (Mumbai)',
        country: 'IN',
        jurisdiction: 'IT Act / DPDP',
        dataCenter: 'AWS ap-south-1',
        regulations: ['IT Act 2000', 'DPDP Act 2023'],
        retentionPolicy: { default: 365, personal: 365, financial: 3650, audit: 3650 },
        encryptionRequired: true,
        crossBorderTransferAllowed: false,
        allowedDestinations: [],
    },
];
// In-memory storage
const userDataLocations = new Map();
const exportRequests = new Map();
const deletionRequests = new Map();
function generateId() {
    return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}
// ==========================================
// SERVICE
// ==========================================
exports.dataResidencyService = {
    /**
     * Get available regions
     */
    getAvailableRegions() {
        return exports.DATA_REGIONS;
    },
    /**
     * Get region by country
     */
    getRegionByCountry(countryCode) {
        return exports.DATA_REGIONS.find(r => r.country === countryCode);
    },
    /**
     * Determine optimal region for user
     */
    determineUserRegion(countryCode, preferences) {
        if (preferences?.preferredRegion) {
            const preferred = exports.DATA_REGIONS.find(r => r.id === preferences.preferredRegion);
            if (preferred)
                return preferred;
        }
        const countryRegion = this.getRegionByCountry(countryCode);
        if (countryRegion)
            return countryRegion;
        // Default fallback based on continent
        const euCountries = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'UK', 'GB'];
        if (euCountries.includes(countryCode)) {
            return exports.DATA_REGIONS.find(r => r.id === 'eu-fra');
        }
        const seaCountries = ['MY', 'ID', 'PH', 'TH', 'VN', 'MM', 'KH', 'LA', 'BN'];
        if (seaCountries.includes(countryCode)) {
            return exports.DATA_REGIONS.find(r => r.id === 'sg-sin');
        }
        return exports.DATA_REGIONS.find(r => r.id === 'us-east');
    },
    /**
     * Set user data location
     */
    async setUserDataLocation(userId, regionId, consent) {
        const region = exports.DATA_REGIONS.find(r => r.id === regionId);
        if (!region)
            throw new Error('Invalid region');
        const location = {
            userId,
            primaryRegion: regionId,
            backupRegion: this.getBackupRegion(regionId),
            dataCategories: [
                { category: 'profile', region: regionId },
                { category: 'content', region: regionId },
                { category: 'messages', region: regionId },
                { category: 'analytics', region: regionId },
                { category: 'financial', region: regionId },
            ],
            consentGiven: consent,
            consentDate: consent ? new Date() : undefined,
            lastUpdated: new Date(),
        };
        userDataLocations.set(userId, location);
        logger_1.logger.info('User data location set', { userId, region: regionId });
        return location;
    },
    /**
     * Get backup region based on primary
     */
    getBackupRegion(primaryRegionId) {
        const backupMap = {
            'au-syd': 'sg-sin',
            'eu-fra': 'eu-fra', // EU data must stay in EU
            'us-east': 'us-east', // Use same region for backup
            'sg-sin': 'au-syd',
            'in-mum': 'in-mum', // India data must stay in India
        };
        return backupMap[primaryRegionId] || 'us-east';
    },
    /**
     * Check if data transfer is allowed
     */
    isTransferAllowed(sourceRegion, destRegion) {
        const source = exports.DATA_REGIONS.find(r => r.id === sourceRegion);
        const dest = exports.DATA_REGIONS.find(r => r.id === destRegion);
        if (!source || !dest)
            return false;
        if (!source.crossBorderTransferAllowed)
            return false;
        return source.allowedDestinations.includes(dest.country);
    },
    /**
     * Request data export (GDPR Article 20)
     */
    async requestDataExport(userId, options) {
        const request = {
            id: `exp_${generateId()}`,
            userId,
            type: options.type,
            categories: options.categories || ['all'],
            format: options.format || 'json',
            status: 'pending',
            createdAt: new Date(),
        };
        exportRequests.set(request.id, request);
        logger_1.logger.info('Data export requested', { requestId: request.id, userId });
        // Simulate async processing
        setTimeout(() => {
            request.status = 'ready';
            request.downloadUrl = `/api/data-export/${request.id}/download`;
            request.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        }, 1000);
        return request;
    },
    /**
     * Request data deletion (GDPR Article 17)
     */
    async requestDataDeletion(userId, options) {
        const request = {
            id: `del_${generateId()}`,
            userId,
            type: options.type,
            categories: options.categories || ['all'],
            retainLegal: options.retainLegal !== false,
            status: 'pending',
            scheduledDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 day grace period
            createdAt: new Date(),
        };
        deletionRequests.set(request.id, request);
        logger_1.logger.info('Data deletion requested', { requestId: request.id, userId });
        return request;
    },
    /**
     * Get retention policy for data category
     */
    getRetentionPolicy(regionId, category) {
        const region = exports.DATA_REGIONS.find(r => r.id === regionId);
        if (!region)
            return 365;
        const categoryMap = {
            personal: 'personal',
            financial: 'financial',
            audit: 'audit',
        };
        return region.retentionPolicy[categoryMap[category] || 'default'];
    },
    /**
     * Get compliance requirements for region
     */
    getComplianceRequirements(regionId) {
        const region = exports.DATA_REGIONS.find(r => r.id === regionId);
        return region?.regulations || [];
    },
};
//# sourceMappingURL=data-residency.service.js.map