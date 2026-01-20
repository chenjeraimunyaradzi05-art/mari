export interface CareerCompassResult {
    targetRole: string;
    persona?: string | null;
    skillGaps: string[];
    recommendedCourses: Array<{
        id: string;
        title: string;
        providerName: string | null;
        type: string | null;
        cost: number | null;
    }>;
    suggestedJobs: Array<{
        id: string;
        title: string;
        organizationName: string | null;
        city: string | null;
        state: string | null;
        country: string | null;
    }>;
}
export interface OpportunityScanResult {
    jobs: Array<{
        id: string;
        title: string;
        organizationName: string | null;
        city: string | null;
        state: string | null;
        country: string | null;
    }>;
    courses: Array<{
        id: string;
        title: string;
        providerName: string | null;
        type: string | null;
    }>;
    events: Array<{
        id: string;
        title: string;
        date: Date;
        location: string | null;
        isFeatured: boolean;
    }>;
}
export interface SalaryEquityResult {
    targetRole: string;
    sampleSize: number;
    marketMedian: number | null;
    userTargetMid: number | null;
    gap: number | null;
    status: 'above' | 'below' | 'aligned' | 'insufficient_data';
    tips: string[];
}
export interface MentorMatchResult {
    mentors: Array<{
        id: string;
        userId: string;
        name: string;
        avatar: string | null;
        headline: string | null;
        specializations: string[];
        yearsExperience: number | null;
        rating: number | null;
        matchScore: number;
        matchReasons: string[];
    }>;
}
export interface IncomeStreamResult {
    creatorStatus: 'non_creator' | 'emerging' | 'growing' | 'established';
    revenuePotentialScore: number;
    diversificationScore: number;
    monthlyEarnings: number;
    avgGiftValue: number;
    followerCount: number;
    actionPlan: string[];
    channels: Array<{
        name: string;
        currentShare: number;
        potentialShare: number;
    }>;
}
export interface RecommendationEngineResult {
    generatedAt: Date;
    items: Array<{
        type: 'job' | 'course' | 'mentor' | 'post';
        id: string;
        title: string;
        score: number;
        reason: string;
    }>;
    userSignals: {
        persona: string | null;
        skillCount: number;
    };
}
export declare function getCareerCompass(userId: string, targetRole?: string): Promise<CareerCompassResult>;
export declare function getOpportunityScan(userId?: string): Promise<OpportunityScanResult>;
export declare function getSalaryEquity(userId: string, targetRole?: string): Promise<SalaryEquityResult>;
export declare function getMentorMatch(userId: string): Promise<MentorMatchResult>;
export declare function getIncomeStream(userId: string): Promise<IncomeStreamResult>;
export declare function getRecommendationEngineV2(userId?: string): Promise<RecommendationEngineResult>;
//# sourceMappingURL=algorithm.service.d.ts.map