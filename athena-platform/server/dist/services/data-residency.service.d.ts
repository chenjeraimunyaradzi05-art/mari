/**
 * Data Residency Service
 * Regional data storage and GDPR/privacy compliance
 */
export interface DataRegion {
    id: string;
    name: string;
    country: string;
    jurisdiction: string;
    dataCenter: string;
    regulations: string[];
    retentionPolicy: {
        default: number;
        personal: number;
        financial: number;
        audit: number;
    };
    encryptionRequired: boolean;
    crossBorderTransferAllowed: boolean;
    allowedDestinations: string[];
}
export interface UserDataLocation {
    userId: string;
    primaryRegion: string;
    backupRegion: string;
    dataCategories: {
        category: string;
        region: string;
        encryptionKey?: string;
    }[];
    consentGiven: boolean;
    consentDate?: Date;
    lastUpdated: Date;
}
export interface DataExportRequest {
    id: string;
    userId: string;
    type: 'full' | 'partial';
    categories: string[];
    format: 'json' | 'csv' | 'xml';
    status: 'pending' | 'processing' | 'ready' | 'expired';
    downloadUrl?: string;
    expiresAt?: Date;
    createdAt: Date;
}
export interface DataDeletionRequest {
    id: string;
    userId: string;
    type: 'full' | 'partial';
    categories: string[];
    retainLegal: boolean;
    status: 'pending' | 'processing' | 'completed' | 'rejected';
    scheduledDate: Date;
    completedAt?: Date;
    createdAt: Date;
}
export declare const DATA_REGIONS: DataRegion[];
export declare const dataResidencyService: {
    /**
     * Get available regions
     */
    getAvailableRegions(): DataRegion[];
    /**
     * Get region by country
     */
    getRegionByCountry(countryCode: string): DataRegion | undefined;
    /**
     * Determine optimal region for user
     */
    determineUserRegion(countryCode: string, preferences?: {
        preferredRegion?: string;
    }): DataRegion;
    /**
     * Set user data location
     */
    setUserDataLocation(userId: string, regionId: string, consent: boolean): Promise<UserDataLocation>;
    /**
     * Get backup region based on primary
     */
    getBackupRegion(primaryRegionId: string): string;
    /**
     * Check if data transfer is allowed
     */
    isTransferAllowed(sourceRegion: string, destRegion: string): boolean;
    /**
     * Request data export (GDPR Article 20)
     */
    requestDataExport(userId: string, options: {
        type: "full" | "partial";
        categories?: string[];
        format?: "json" | "csv" | "xml";
    }): Promise<DataExportRequest>;
    /**
     * Request data deletion (GDPR Article 17)
     */
    requestDataDeletion(userId: string, options: {
        type: "full" | "partial";
        categories?: string[];
        retainLegal?: boolean;
    }): Promise<DataDeletionRequest>;
    /**
     * Get retention policy for data category
     */
    getRetentionPolicy(regionId: string, category: string): number;
    /**
     * Get compliance requirements for region
     */
    getComplianceRequirements(regionId: string): string[];
};
//# sourceMappingURL=data-residency.service.d.ts.map