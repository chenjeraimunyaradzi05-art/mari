/**
 * Search Service
 * Advanced search with relevance ranking and filtering
 */
export interface SearchOptions {
    query: string;
    type?: 'all' | 'users' | 'posts' | 'jobs' | 'courses' | 'videos' | 'mentors';
    persona?: string;
    sort?: 'relevance' | 'recent' | 'popular';
    page?: number;
    limit?: number;
    filters?: {
        jobType?: string;
        experienceLevel?: string;
        salary?: {
            min?: number;
            max?: number;
        };
        remote?: boolean;
        postType?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'LINK' | 'POLL';
        hasMedia?: boolean;
        level?: string;
        free?: boolean;
        role?: string;
        verified?: boolean;
    };
}
export interface SearchResult {
    type: 'user' | 'post' | 'job' | 'course' | 'video' | 'mentor';
    id: string;
    score: number;
    title?: string;
    content?: string;
    highlight?: string;
    metadata: Record<string, any>;
}
export interface SearchResponse {
    results: SearchResult[];
    total: number;
    page: number;
    totalPages: number;
    query: string;
    suggestions?: string[];
}
export declare function search(options: SearchOptions): Promise<SearchResponse>;
export declare function getRecommendedJobs(userId: string, limit?: number): Promise<SearchResult[]>;
export declare function getSearchSuggestions(partialQuery: string): Promise<string[]>;
export declare function getTrendingSearches(): Promise<string[]>;
//# sourceMappingURL=search.service.d.ts.map