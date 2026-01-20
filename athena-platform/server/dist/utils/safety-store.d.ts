export interface SafetyReportRecord {
    id: string;
    userId: string;
    targetType: 'post' | 'video' | 'user' | 'message' | 'channel' | 'other';
    targetId?: string;
    reason: string;
    details?: string;
    status: 'SUBMITTED' | 'UNDER_REVIEW' | 'ACTION_TAKEN' | 'CLOSED';
    createdAt: string;
    updatedAt: string;
}
export interface SafetyBlockRecord {
    id: string;
    userId: string;
    blockedUserId: string;
    reason?: string;
    createdAt: string;
}
interface SafetyStoreData {
    reports: SafetyReportRecord[];
    blocks: SafetyBlockRecord[];
}
export declare function readSafetyStore(): Promise<SafetyStoreData>;
export declare function writeSafetyStore(store: SafetyStoreData): Promise<void>;
export {};
//# sourceMappingURL=safety-store.d.ts.map