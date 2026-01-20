/**
 * Safety Score Service
 * Calculates and updates user safety scores based on reports, blocks, and behavior
 * Phase 2: Backend Logic & Integrations
 */
export interface SafetyIncident {
    id: string;
    userId: string;
    type: 'REPORT' | 'BLOCK' | 'CONTENT_REMOVAL' | 'SUSPENSION' | 'WARNING';
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    reason: string;
    reporterId?: string;
    contentId?: string;
    contentType?: string;
    verified: boolean;
    resolvedAt?: Date;
    createdAt: Date;
}
export interface SafetyScoreBreakdown {
    score: number;
    factors: {
        category: string;
        impact: number;
        details: string;
    }[];
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    restrictions: string[];
    lastUpdated: Date;
}
/**
 * Calculate safety score for a user
 */
export declare function calculateSafetyScore(userId: string): Promise<SafetyScoreBreakdown>;
/**
 * Update safety score in database
 */
export declare function updateSafetyScore(userId: string): Promise<number>;
/**
 * Record a safety incident and trigger score recalculation
 */
export declare function recordSafetyIncident(incident: Omit<SafetyIncident, 'id' | 'createdAt'>): Promise<void>;
/**
 * Handle user report event
 */
export declare function handleUserReport(reportedUserId: string, reporterId: string, reason: string, contentId?: string, contentType?: string): Promise<void>;
/**
 * Handle user block event
 */
export declare function handleUserBlock(blockedUserId: string, blockerId: string): Promise<void>;
/**
 * Handle content removal event
 */
export declare function handleContentRemoval(userId: string, contentId: string, contentType: string, reason: string, moderatorId?: string): Promise<void>;
/**
 * Verify a pending report (by moderator)
 */
export declare function verifyReport(incidentId: string, verified: boolean, moderatorId: string): Promise<void>;
/**
 * Get user's safety status for profile display
 */
export declare function getSafetyStatus(userId: string): Promise<{
    score: number;
    level: 'TRUSTED' | 'GOOD' | 'CAUTION' | 'RESTRICTED';
    badges: string[];
}>;
export declare const safetyScoreService: {
    calculateSafetyScore: typeof calculateSafetyScore;
    updateSafetyScore: typeof updateSafetyScore;
    recordSafetyIncident: typeof recordSafetyIncident;
    handleUserReport: typeof handleUserReport;
    handleUserBlock: typeof handleUserBlock;
    handleContentRemoval: typeof handleContentRemoval;
    verifyReport: typeof verifyReport;
    getSafetyStatus: typeof getSafetyStatus;
};
//# sourceMappingURL=safety-score.service.d.ts.map