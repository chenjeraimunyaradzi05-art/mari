export interface FeatureFlagInput {
    key: string;
    name: string;
    description?: string;
    enabled?: boolean;
    rolloutPercentage?: number;
    allowList?: string[];
    denyList?: string[];
    tags?: string[];
    metadata?: Record<string, unknown> | null;
    createdById?: string | null;
}
export interface FeatureFlagUpdate {
    name?: string;
    description?: string;
    enabled?: boolean;
    rolloutPercentage?: number;
    allowList?: string[];
    denyList?: string[];
    tags?: string[];
    metadata?: Record<string, unknown> | null;
}
export declare function evaluateFeatureFlag(flag: {
    enabled: boolean;
    rolloutPercentage: number;
    allowList: string[];
    denyList: string[];
    key: string;
}, userId?: string): boolean;
export declare function listFeatureFlags(): Promise<any>;
export declare function getFeatureFlagByKey(key: string): Promise<any>;
export declare function upsertFeatureFlag(data: FeatureFlagInput): Promise<any>;
export declare function updateFeatureFlag(key: string, data: FeatureFlagUpdate): Promise<any>;
export declare function deleteFeatureFlag(key: string): Promise<{
    success: boolean;
}>;
export declare function getActiveFeatureFlagsForUser(userId?: string): Promise<{
    flags: {
        key: string;
        name: string;
        description: string | null;
        rolloutPercentage: number;
        tags: string[];
        metadata: Record<string, unknown> | null;
    }[];
}>;
//# sourceMappingURL=feature-flags.service.d.ts.map