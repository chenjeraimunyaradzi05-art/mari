/**
 * Reference Check Service
 * Automated reference request and verification system
 * Phase 2: Backend Logic & Integrations
 */
export type ReferenceStatus = 'PENDING' | 'SENT' | 'COMPLETED' | 'EXPIRED' | 'DECLINED';
export type ReferenceType = 'PROFESSIONAL' | 'CHARACTER' | 'ACADEMIC' | 'EMPLOYMENT_VERIFICATION';
export interface ReferenceRequest {
    id: string;
    candidateId: string;
    applicationId?: string;
    refereeEmail: string;
    refereeName: string;
    refereeTitle?: string;
    refereeCompany?: string;
    relationship: string;
    type: ReferenceType;
    status: ReferenceStatus;
    token: string;
    questions: ReferenceQuestion[];
    response?: ReferenceResponse;
    requestedAt: Date;
    sentAt?: Date;
    completedAt?: Date;
    expiresAt: Date;
}
export interface ReferenceQuestion {
    id: string;
    question: string;
    type: 'TEXT' | 'RATING' | 'YES_NO' | 'MULTIPLE_CHOICE';
    options?: string[];
    required: boolean;
}
export interface ReferenceResponse {
    answers: {
        questionId: string;
        answer: string | number | boolean;
    }[];
    overallRating?: number;
    wouldRecommend: boolean;
    additionalComments?: string;
    submittedAt: Date;
}
/**
 * Create a new reference request
 */
export declare function createReferenceRequest(data: {
    candidateId: string;
    applicationId?: string;
    refereeEmail: string;
    refereeName: string;
    refereeTitle?: string;
    refereeCompany?: string;
    relationship: string;
    type: ReferenceType;
    customQuestions?: ReferenceQuestion[];
    expiresInDays?: number;
}): Promise<ReferenceRequest>;
/**
 * Send reference request email to referee
 */
export declare function sendReferenceRequest(referenceId: string): Promise<boolean>;
/**
 * Batch send reference requests
 */
export declare function batchSendReferenceRequests(candidateId: string, referees: Array<{
    email: string;
    name: string;
    title?: string;
    company?: string;
    relationship: string;
    type: ReferenceType;
}>, applicationId?: string): Promise<{
    sent: number;
    failed: number;
}>;
/**
 * Get reference request by token (for referee to view)
 */
export declare function getReferenceByToken(token: string): Promise<{
    request: Partial<ReferenceRequest>;
    candidate: any;
    expired: boolean;
}>;
/**
 * Submit reference response
 */
export declare function submitReferenceResponse(token: string, response: ReferenceResponse): Promise<boolean>;
/**
 * Decline reference request
 */
export declare function declineReferenceRequest(token: string, reason?: string): Promise<boolean>;
/**
 * Get reference summary for a candidate
 */
export declare function getCandidateReferenceSummary(candidateId: string): Promise<{
    total: number;
    completed: number;
    pending: number;
    averageRating: number | null;
    wouldRecommendPercentage: number | null;
}>;
/**
 * Get references for a job application
 */
export declare function getApplicationReferences(applicationId: string): Promise<any[]>;
/**
 * Send reminder emails for pending references
 */
export declare function sendReferenceReminders(): Promise<{
    sent: number;
}>;
/**
 * Mark expired reference requests
 */
export declare function markExpiredReferences(): Promise<{
    expired: number;
}>;
export declare const referenceCheckService: {
    createReferenceRequest: typeof createReferenceRequest;
    sendReferenceRequest: typeof sendReferenceRequest;
    batchSendReferenceRequests: typeof batchSendReferenceRequests;
    getReferenceByToken: typeof getReferenceByToken;
    submitReferenceResponse: typeof submitReferenceResponse;
    declineReferenceRequest: typeof declineReferenceRequest;
    getCandidateReferenceSummary: typeof getCandidateReferenceSummary;
    getApplicationReferences: typeof getApplicationReferences;
    sendReferenceReminders: typeof sendReferenceReminders;
    markExpiredReferences: typeof markExpiredReferences;
};
//# sourceMappingURL=reference-check.service.d.ts.map