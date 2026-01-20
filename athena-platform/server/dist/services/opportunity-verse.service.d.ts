/**
 * OpportunityVerse Feed Mixer Service
 * Balances paid content, organic social, and job recommendations
 * Phase 2: Backend Logic & Integrations
 */
interface MixerConfig {
    organicRatio: number;
    discoveryRatio: number;
    sponsoredRatio: number;
    opportunityRatio: number;
    maxConsecutiveSponsored: number;
    minPostsBetweenSponsored: number;
    maxSponsoredPerSession: number;
    sponsoredStartPosition: number;
    opportunityInsertEvery: number;
}
export type ContentType = 'organic' | 'discovery' | 'sponsored' | 'opportunity';
export interface MixedContent {
    id: string;
    type: ContentType;
    contentType: 'POST' | 'JOB' | 'COURSE' | 'EVENT' | 'AD';
    data: any;
    score: number;
    reason?: string;
}
export interface MixerInput {
    userId?: string;
    organicPosts: any[];
    discoveryPosts: any[];
    sponsoredContent?: any[];
    opportunities?: any[];
    page: number;
    limit: number;
}
export interface MixerOutput {
    items: MixedContent[];
    hasMore: boolean;
    meta: {
        organicCount: number;
        discoveryCount: number;
        sponsoredCount: number;
        opportunityCount: number;
    };
}
export declare class OpportunityVerseMixer {
    private config;
    constructor(config?: Partial<MixerConfig>);
    /**
     * Mix content from multiple sources into a unified feed
     */
    mix(input: MixerInput): Promise<MixerOutput>;
    /**
     * Normalize a content pool with consistent scoring
     */
    private normalizePool;
    /**
     * Get a human-readable reason for why content was included
     */
    private getContentReason;
    /**
     * Filter and score sponsored content for relevance
     */
    private filterRelevantSponsored;
    /**
     * Personalize opportunities (jobs, courses) for user
     */
    private personalizeOpportunities;
}
/**
 * Get mixed feed for a user
 */
export declare function getMixedFeed(userId: string, page: number, limit: number): Promise<MixerOutput>;
export declare const opportunityVerseMixer: {
    OpportunityVerseMixer: typeof OpportunityVerseMixer;
    getMixedFeed: typeof getMixedFeed;
};
export {};
//# sourceMappingURL=opportunity-verse.service.d.ts.map