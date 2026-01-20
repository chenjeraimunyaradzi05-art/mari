export interface TrustScoreResult {
    score: number;
    factors: Array<{
        label: string;
        points: number;
    }>;
    updatedAt: string;
}
export declare function calculateTrustScore(userId: string): Promise<TrustScoreResult>;
export declare function recordSafetyReport(reporterId: string, reportedUserId?: string | null): Promise<{
    reporterRecord: {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        trustScore: number;
        userId: string;
        engagementScore: number;
        identityVerified: boolean;
        reportsSubmitted: number;
        identityScore: number;
        accountAge: number;
        accountAgeScore: number;
        communityFeedback: number;
        professionalScore: number;
        badges: string[];
        warningsCount: number;
        suspensionsCount: number;
        lastIncidentAt: Date | null;
        reportsAgainst: number;
        reportAccuracy: number | null;
    };
    reportedRecord: {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        trustScore: number;
        userId: string;
        engagementScore: number;
        identityVerified: boolean;
        reportsSubmitted: number;
        identityScore: number;
        accountAge: number;
        accountAgeScore: number;
        communityFeedback: number;
        professionalScore: number;
        badges: string[];
        warningsCount: number;
        suspensionsCount: number;
        lastIncidentAt: Date | null;
        reportsAgainst: number;
        reportAccuracy: number | null;
    } | null;
}>;
export declare function recordUserBlock(blockedUserId: string): Promise<{
    id: string;
    createdAt: Date;
    updatedAt: Date;
    trustScore: number;
    userId: string;
    engagementScore: number;
    identityVerified: boolean;
    reportsSubmitted: number;
    identityScore: number;
    accountAge: number;
    accountAgeScore: number;
    communityFeedback: number;
    professionalScore: number;
    badges: string[];
    warningsCount: number;
    suspensionsCount: number;
    lastIncidentAt: Date | null;
    reportsAgainst: number;
    reportAccuracy: number | null;
}>;
//# sourceMappingURL=trust.service.d.ts.map