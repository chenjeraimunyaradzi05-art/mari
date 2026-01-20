/**
 * ML Ranking Algorithms Service - Stub Implementation
 * Light Ranker, Heavy Ranker, SafetyScore, MentorMatch, SalaryEquity
 */
export interface RankingContext {
    userId: string;
    sessionId?: string;
    deviceType?: 'mobile' | 'desktop' | 'tablet';
    location?: {
        country: string;
        region?: string;
    };
    timestamp: Date;
}
export interface RankedItem {
    id: string;
    type: 'job' | 'post' | 'user' | 'course' | 'mentor' | 'event';
    score: number;
    reasons: string[];
    metadata?: Record<string, unknown>;
}
export interface SafetyScoreResult {
    overallScore: number;
    components: {
        contentSafety: number;
        identityVerification: number;
        behaviorPatterns: number;
        communityStanding: number;
        networkTrust: number;
    };
    flags: string[];
    recommendations: string[];
}
export interface MentorMatchResult {
    mentorId: string;
    matchScore: number;
    matchReasons: string[];
    compatibilityFactors: {
        expertiseMatch: number;
        communicationStyle: number;
        availability: number;
        experienceLevel: number;
        industryAlignment: number;
    };
    estimatedValue: number;
}
export interface SalaryEquityResult {
    estimatedRange: {
        min: number;
        max: number;
    };
    marketMedian: number;
    percentile: number;
    factors: {
        factor: string;
        impact: number;
        explanation: string;
    }[];
    recommendations: string[];
    confidenceLevel: number;
}
export declare const mlRankingService: {
    /**
     * Light Ranker - Fast initial ranking
     */
    lightRank(items: {
        id: string;
        type: string;
        data: unknown;
    }[], context: RankingContext): Promise<RankedItem[]>;
    /**
     * Heavy Ranker - Deep personalized ranking
     */
    heavyRank(items: RankedItem[], _context: RankingContext): Promise<RankedItem[]>;
    /**
     * Calculate comprehensive SafetyScore for a user
     */
    calculateSafetyScore(_userId: string): Promise<SafetyScoreResult>;
    /**
     * MentorMatch - Find optimal mentor matches
     */
    findMentorMatches(_userId: string, options?: {
        skills?: string[];
        maxResults?: number;
        budgetMax?: number;
    }): Promise<MentorMatchResult[]>;
    /**
     * SalaryEquity - Calculate fair salary estimates
     */
    calculateSalaryEquity(_userId: string, _jobContext?: {
        title?: string;
        company?: string;
        location?: string;
        industry?: string;
    }): Promise<SalaryEquityResult>;
};
//# sourceMappingURL=ml-ranking.service.d.ts.map