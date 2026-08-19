/**
 * AutoMod Service - Stub Implementation
 * Automated content moderation with rules engine
 */
import { EventEmitter } from 'events';
export declare const automodEvents: EventEmitter<[never]>;
export interface AutoModRule {
    id: string;
    name: string;
    type: 'keyword' | 'regex' | 'ml' | 'rate_limit' | 'reputation' | 'composite';
    enabled: boolean;
    priority: number;
    action: AutoModAction;
    conditions: AutoModCondition[];
    scope: 'global' | 'community' | 'channel';
    scopeId?: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface AutoModAction {
    type: 'block' | 'flag' | 'quarantine' | 'warn' | 'mute' | 'shadowban' | 'escalate';
    duration?: number;
    notifyUser: boolean;
    notifyModerators: boolean;
    logReason: string;
    customMessage?: string;
}
export interface AutoModCondition {
    field: 'content' | 'user_age' | 'user_reputation' | 'attachment_count' | 'link_count' | 'mention_count';
    operator: 'contains' | 'matches' | 'equals' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'not_in';
    value: string | number | string[];
    caseSensitive?: boolean;
}
export interface AutoModResult {
    passed: boolean;
    triggeredRules: string[];
    actions: AutoModAction[];
    confidence: number;
    details: {
        ruleId: string;
        ruleName: string;
        reason: string;
        matchedContent?: string;
    }[];
}
export declare const automodService: {
    /**
     * Process content through AutoMod
     */
    processContent(content: string, userId: string, context: {
        type: "post" | "comment" | "message" | "profile";
        communityId?: string;
        channelId?: string;
    }): Promise<AutoModResult>;
    /**
     * Get applicable rules
     */
    getApplicableRules(_communityId?: string, _channelId?: string): Promise<AutoModRule[]>;
    /**
     * Create AutoMod rule
     */
    createRule(_creatorId: string, rule: Omit<AutoModRule, "id" | "createdAt" | "updatedAt">): Promise<AutoModRule>;
    /**
     * Initialize default rules for community
     */
    initializeCommunityRules(communityId: string, creatorId: string): Promise<void>;
    /**
     * Get moderation queue
     */
    getModerationQueue(_moderatorId: string, options?: {
        communityId?: string;
        status?: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        items: unknown[];
        total: number;
    }>;
    /**
     * Process queue item
     */
    processQueueItem(_moderatorId: string, itemId: string, decision: "approve" | "reject" | "escalate", _notes?: string): Promise<void>;
    /**
     * Calculate user reputation
     */
    calculateUserReputation(_userId: string): Promise<number>;
    /**
     * Get moderation stats
     */
    getStats(_options?: {
        communityId?: string;
        startDate?: Date;
        endDate?: Date;
    }): Promise<{
        totalActions: number;
        byType: Record<string, number>;
        byRule: Record<string, number>;
        falsePositiveRate: number;
        averageConfidence: number;
    }>;
};
//# sourceMappingURL=automod.service.d.ts.map