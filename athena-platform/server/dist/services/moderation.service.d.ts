/**
 * Content Moderation Service
 * Uses OpenAI Moderation API for UGC safety
 */
export interface ModerationResult {
    flagged: boolean;
    categories: string[];
    scores: Record<string, number>;
    action: 'allow' | 'review' | 'block';
    reason?: string;
}
export interface SafetyScoreResult {
    score: number;
    action: 'allow' | 'review' | 'block';
    signals: Array<{
        type: 'moderation' | 'spam' | 'profanity' | 'misinformation';
        severity: 'low' | 'medium' | 'high';
        detail: string;
    }>;
}
/**
 * Moderate text content using OpenAI Moderation API
 */
export declare function moderateText(content: string): Promise<ModerationResult>;
/**
 * Moderate multiple pieces of content
 */
export declare function moderateBatch(contents: string[]): Promise<ModerationResult[]>;
/**
 * Check if content should be auto-hidden
 */
export declare function shouldAutoHide(result: ModerationResult): boolean;
/**
 * Check if content needs manual review
 */
export declare function needsManualReview(result: ModerationResult): boolean;
/**
 * Moderate user profile content
 */
export declare function moderateProfile(data: {
    bio?: string;
    headline?: string;
    aboutMe?: string;
}): Promise<{
    valid: boolean;
    issues: string[];
}>;
/**
 * Moderate post content
 */
export declare function moderatePost(content: string): Promise<{
    allowed: boolean;
    shouldHide: boolean;
    needsReview: boolean;
    reason?: string;
}>;
/**
 * Moderate message content
 */
export declare function moderateMessage(content: string): Promise<{
    allowed: boolean;
    reason?: string;
}>;
export declare function containsProfanity(text: string): boolean;
/**
 * Spam detection (basic patterns)
 */
export declare function detectSpam(text: string): {
    isSpam: boolean;
    reason?: string;
};
/**
 * Misinformation detection (heuristic signals)
 */
export declare function detectMisinformation(text: string): {
    isLikely: boolean;
    reason?: string;
};
/**
 * SafetyScore full evaluation
 */
export declare function evaluateSafetyScore(content: string): Promise<SafetyScoreResult>;
/**
 * Moderate image content using AWS Rekognition
 */
export declare function moderateImage(imageBuffer: Buffer): Promise<ModerationResult>;
//# sourceMappingURL=moderation.service.d.ts.map