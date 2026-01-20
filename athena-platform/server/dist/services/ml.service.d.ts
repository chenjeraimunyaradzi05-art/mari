/**
 * ML Service Bridge
 * =================
 * Connects Node.js backend to Python ML microservice.
 * Provides typed interfaces for all ML algorithms.
 */
export interface CareerProfile {
    user_id: string;
    years_experience: number;
    current_salary: number;
    education_level: number;
    industry_growth?: number;
    skills_score: number;
    leadership_score?: number;
    certifications?: number;
    location_index?: number;
    company_size?: number;
    target_role?: string;
    target_industry?: string;
    timeline_months?: number;
}
export interface CareerPrediction {
    user_id: string;
    career_growth_score: number;
    confidence: number;
    salary_projection: Record<string, number>;
    role_trajectory: string[];
    skill_gaps: Array<{
        skill: string;
        current: number;
        target: number;
        priority: string;
        resources: string[];
    }>;
    recommended_actions: Array<{
        action: string;
        impact: string;
        timeframe: string;
        details: string;
    }>;
    peer_percentile: number;
    industry_benchmark: number;
}
export interface MenteeProfile {
    user_id: string;
    industry: string;
    role: string;
    experience_years: number;
    skills: string[];
    goals: string[];
    preferred_style?: string;
    availability_hours_per_month?: number;
    timezone?: string;
    languages?: string[];
}
export interface MentorProfile {
    user_id: string;
    industry: string;
    role: string;
    experience_years: number;
    expertise_areas: string[];
    mentoring_style: string;
    availability_hours_per_month: number;
    timezone: string;
    languages: string[];
    rating?: number;
    total_mentees?: number;
    hourly_rate?: number;
}
export interface MatchScore {
    mentor_id: string;
    overall_score: number;
    skill_alignment: number;
    goal_compatibility: number;
    style_fit: number;
    availability_match: number;
    experience_relevance: number;
    match_reasons: string[];
    potential_challenges: string[];
    mentor_summary: Record<string, any>;
}
export interface SafetyProfile {
    user_id: string;
    account_age_days: number;
    is_verified: boolean;
    verification_level: number;
    report_count_received: number;
    report_count_made: number;
    block_count_received: number;
    message_response_rate: number;
    total_interactions: number;
    positive_interactions: number;
    content_flags: number;
    content_approved: number;
}
export interface SafetyScoreResult {
    user_id: string;
    safety_score: number;
    risk_level: 'low' | 'medium' | 'high' | 'critical';
    confidence: number;
    components: Record<string, number>;
    risk_factors: Array<{
        factor: string;
        severity: string;
    }>;
    mitigations: string[];
}
export interface RankingCandidate {
    id: string;
    content_type: 'job' | 'post' | 'video' | 'course' | 'mentor' | 'user';
    features: Record<string, any>;
    metadata?: Record<string, any>;
}
export interface UserContext {
    user_id: string;
    persona?: string;
    interests?: string[];
    skills?: string[];
    location?: string;
    interaction_history?: Array<Record<string, any>>;
}
export interface RankedItem {
    id: string;
    content_type: string;
    score: number;
    rank: number;
    score_breakdown: Record<string, number>;
    explanation: string;
}
export interface FeedCandidate {
    id: string;
    item_type: string;
    author_id: string;
    created_at: string;
    view_count?: number;
    like_count?: number;
    comment_count?: number;
    share_count?: number;
    content_quality_score?: number;
    tags?: string[];
    is_sponsored?: boolean;
}
export interface FeedItem {
    id: string;
    item_type: string;
    score: number;
    position: number;
    reason: string;
    is_sponsored: boolean;
}
declare class MLServiceClient {
    private baseUrl;
    private timeout;
    private isHealthy;
    private lastHealthCheck;
    private healthCheckInterval;
    constructor();
    private fetch;
    private retryFetch;
    checkHealth(): Promise<boolean>;
    isReady(): Promise<boolean>;
    predictCareerGrowth(profile: CareerProfile): Promise<CareerPrediction>;
    batchPredictCareer(profiles: CareerProfile[]): Promise<{
        predictions: CareerPrediction[];
        processing_time_ms: number;
    }>;
    getCareerFeatureImportance(): Promise<{
        features: Array<{
            name: string;
            importance: number;
        }>;
    }>;
    findMentorMatches(mentee: MenteeProfile, options?: {
        mentor_pool?: string[];
        max_results?: number;
        min_score?: number;
    }): Promise<{
        mentee_id: string;
        matches: MatchScore[];
        total_considered: number;
    }>;
    calculateMentorMatchScore(mentee: MenteeProfile, mentor: MentorProfile): Promise<MatchScore>;
    calculateSafetyScore(profile: SafetyProfile): Promise<SafetyScoreResult>;
    evaluateInteractionSafety(initiator_id: string, recipient_id: string, interaction_type: string, context?: Record<string, any>): Promise<{
        is_safe: boolean;
        risk_level: string;
        risk_score: number;
        warnings: string[];
        recommendations: string[];
    }>;
    moderateContent(content_id: string, content_type: string, author_id: string, content_text?: string, content_url?: string): Promise<{
        content_id: string;
        is_approved: boolean;
        risk_level: string;
        categories_flagged: string[];
        requires_human_review: boolean;
    }>;
    rankCandidates(candidates: RankingCandidate[], userContext: UserContext, options?: {
        ranking_model?: 'light' | 'heavy';
        top_k?: number;
        diversity_factor?: number;
    }): Promise<{
        ranked_items: RankedItem[];
        model_used: string;
        processing_time_ms: number;
    }>;
    generateFeed(userContext: {
        user_id: string;
        persona: string;
        interests?: string[];
        followed_users?: string[];
        followed_organizations?: string[];
        feed_context?: string;
    }, candidates: FeedCandidate[], options?: {
        page?: number;
        page_size?: number;
        mix_config?: Record<string, number>;
    }): Promise<{
        feed_items: FeedItem[];
        page: number;
        has_more: boolean;
        mix_ratios: Record<string, number>;
        generation_time_ms: number;
    }>;
    recordEngagement(user_id: string, item_id: string, engagement_type: 'view' | 'like' | 'comment' | 'share' | 'click' | 'dwell', dwell_time_seconds?: number): Promise<{
        status: string;
    }>;
    predictIncomeOpportunities(profile: {
        user_id: string;
        current_income: number;
        skills: string[];
        industry: string;
        experience_years: number;
        available_hours_per_week?: number;
        risk_tolerance?: 'low' | 'medium' | 'high';
    }): Promise<{
        user_id: string;
        current_monthly_income: number;
        predicted_potential: number;
        income_gap: number;
        opportunities: Array<{
            opportunity_id: string;
            stream_type: string;
            title: string;
            estimated_monthly_income: {
                min: number;
                max: number;
                expected: number;
            };
            time_investment_hours: number;
            skill_match: number;
        }>;
        diversification_score: number;
        recommendations: string[];
    }>;
}
export declare const mlService: MLServiceClient;
export declare function getCareerPrediction(userId: string, profile: Omit<CareerProfile, 'user_id'>): Promise<CareerPrediction>;
export declare function findMentors(menteeProfile: MenteeProfile, maxResults?: number): Promise<MatchScore[]>;
export declare function getUserSafetyScore(profile: SafetyProfile): Promise<SafetyScoreResult>;
export declare function rankContent(candidates: RankingCandidate[], userId: string, persona: string, options?: {
    useHeavyRanker?: boolean;
}): Promise<RankedItem[]>;
export declare function generateUserFeed(userId: string, persona: string, candidates: FeedCandidate[], page?: number): Promise<FeedItem[]>;
export {};
//# sourceMappingURL=ml.service.d.ts.map