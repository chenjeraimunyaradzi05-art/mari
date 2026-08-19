/**
 * Cold Start Algorithm Service
 * Handles new users with no history using demographic-based recommendations
 * Phase 2: Backend Logic & Integrations
 */
import { Persona } from '@prisma/client';
export interface ColdStartProfile {
    userId: string;
    persona?: Persona;
    interests: string[];
    skills: string[];
    location?: string;
    industry?: string;
    careerLevel?: 'ENTRY' | 'MID' | 'SENIOR' | 'EXECUTIVE';
    goals: string[];
}
export interface ColdStartRecommendation {
    type: 'JOB' | 'COURSE' | 'MENTOR' | 'POST' | 'USER' | 'GROUP';
    id: string;
    title: string;
    reason: string;
    score: number;
    data: any;
}
/**
 * Determine if a user is in "cold start" mode
 */
export declare function isUserColdStart(userId: string): Promise<boolean>;
/**
 * Get cold start score (0-100, higher = more cold start)
 */
export declare function getColdStartScore(userId: string): Promise<number>;
/**
 * Get recommendations for a cold start user
 */
export declare function getColdStartRecommendations(userId: string, limit?: number): Promise<ColdStartRecommendation[]>;
/**
 * Get personalized onboarding steps for cold start user
 */
export declare function getOnboardingSuggestions(userId: string): Promise<{
    step: string;
    action: string;
    priority: number;
}[]>;
export declare const coldStartAlgorithm: {
    isUserColdStart: typeof isUserColdStart;
    getColdStartScore: typeof getColdStartScore;
    getColdStartRecommendations: typeof getColdStartRecommendations;
    getOnboardingSuggestions: typeof getOnboardingSuggestions;
};
//# sourceMappingURL=cold-start.service.d.ts.map