/**
 * Regional Compliance Service
 * Handle jurisdiction-specific legal requirements
 */
export interface ComplianceRegion {
    id: string;
    name: string;
    country: string;
    regulations: ComplianceRegulation[];
    ageOfConsent: number;
    ageOfMajority: number;
    dataProtectionAuthority?: {
        name: string;
        website: string;
        email: string;
    };
    requiredDisclosures: string[];
    bannedContent: string[];
    specialRequirements: Record<string, unknown>;
}
export interface ComplianceRegulation {
    id: string;
    name: string;
    shortName: string;
    effectiveDate: string;
    requirements: string[];
    penalties: string;
}
export interface ConsentRecord {
    userId: string;
    consentType: string;
    version: string;
    granted: boolean;
    grantedAt?: Date;
    withdrawnAt?: Date;
    ipAddress?: string;
    userAgent?: string;
    region: string;
}
export interface ComplianceCheck {
    userId: string;
    region: string;
    checks: {
        check: string;
        passed: boolean;
        details?: string;
    }[];
    overallCompliant: boolean;
    missingRequirements: string[];
}
export declare const COMPLIANCE_REGIONS: ComplianceRegion[];
export declare const regionalComplianceService: {
    /**
     * Get compliance requirements for region
     */
    getRegionCompliance(regionId: string): ComplianceRegion | undefined;
    /**
     * Get region by country code
     */
    getRegionByCountry(countryCode: string): ComplianceRegion | undefined;
    /**
     * Record user consent
     */
    recordConsent(userId: string, consentType: string, granted: boolean, metadata: {
        version: string;
        region: string;
        ipAddress?: string;
        userAgent?: string;
    }): Promise<ConsentRecord>;
    /**
     * Get user consent status
     */
    getUserConsent(userId: string, consentType: string): ConsentRecord | undefined;
    /**
     * Check compliance status for user
     */
    checkCompliance(userId: string, region: string): Promise<ComplianceCheck>;
    /**
     * Get required consent types for region
     */
    getRequiredConsents(region: string): string[];
    /**
     * Check if content is allowed in region
     */
    isContentAllowed(content: string, region: string): {
        allowed: boolean;
        reason?: string;
    };
    /**
     * Get minimum age for region
     */
    getMinimumAge(region: string): number;
    /**
     * Generate compliance report
     */
    generateComplianceReport(region: string): Promise<{
        region: string;
        regulations: string[];
        requirements: string[];
        disclosures: string[];
        lastUpdated: Date;
    }>;
};
//# sourceMappingURL=regional-compliance.service.d.ts.map