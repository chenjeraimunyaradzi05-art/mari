/**
 * AI Concierge Service
 * Intelligent assistant for career coaching, FAQ handling, and proactive guidance
 */
export interface ConciergeContext {
    userId: string;
    persona?: string;
    recentActions?: string[];
    currentPage?: string;
}
export interface ConciergeResponse {
    message: string;
    suggestions?: string[];
    actions?: ConciergeAction[];
    quickReplies?: string[];
}
export interface ConciergeAction {
    type: 'navigate' | 'apply' | 'save' | 'schedule' | 'learn' | 'connect';
    label: string;
    target: string;
    metadata?: Record<string, any>;
}
/**
 * Main concierge chat handler with context-aware responses
 */
export declare function chat(message: string, context: ConciergeContext, history?: Array<{
    role: string;
    content: string;
}>): Promise<ConciergeResponse>;
/**
 * Proactive suggestions based on user activity
 */
export declare function getProactiveSuggestions(userId: string): Promise<ConciergeResponse>;
/**
 * Handle specific intents
 */
export declare function handleIntent(intent: string, params: Record<string, any>, userId: string): Promise<ConciergeResponse>;
/**
 * Search FAQ knowledge base
 */
export declare function searchFAQ(query: string): Array<{
    question: string;
    answer: string;
}>;
/**
 * Get personalized onboarding steps based on user profile
 */
export declare function getOnboardingSteps(userId: string): Promise<Array<{
    id: string;
    title: string;
    description: string;
    completed: boolean;
    action: string;
    priority: number;
}>>;
//# sourceMappingURL=concierge.service.d.ts.map