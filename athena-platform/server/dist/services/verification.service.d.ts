/**
 * Verification Service
 * Identity, employer, educator, mentor, and creator verification flows
 */
export type VerificationType = 'IDENTITY' | 'EMPLOYER' | 'EDUCATOR' | 'MENTOR' | 'CREATOR';
export type VerificationStatus = 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
export interface VerificationRequest {
    id: string;
    userId: string;
    type: VerificationType;
    status: VerificationStatus;
    submittedAt: Date;
    reviewedAt?: Date;
    reviewedBy?: string;
    expiresAt?: Date;
    documents: VerificationDocument[];
    metadata: Record<string, any>;
    rejectionReason?: string;
    appealable: boolean;
}
export interface VerificationDocument {
    id: string;
    type: 'government_id' | 'passport' | 'drivers_license' | 'work_email' | 'company_letter' | 'edu_email' | 'transcript' | 'certificate' | 'reference' | 'portfolio';
    url?: string;
    email?: string;
    verified: boolean;
    verifiedAt?: Date;
}
export interface VerificationRequirements {
    type: VerificationType;
    requiredDocuments: string[];
    optionalDocuments: string[];
    processingTime: string;
    validityPeriod: string;
    trustBoost: number;
}
/**
 * Get verification requirements for a type
 */
export declare function getVerificationRequirements(type: VerificationType): VerificationRequirements;
/**
 * Get all user's verifications
 */
export declare function getUserVerifications(userId: string): Promise<VerificationRequest[]>;
/**
 * Submit verification request
 */
export declare function submitVerification(userId: string, type: VerificationType, documents: Omit<VerificationDocument, 'id' | 'verified' | 'verifiedAt'>[], metadata?: Record<string, any>): Promise<VerificationRequest>;
/**
 * Verify email code
 */
export declare function verifyEmailCode(verificationId: string, code: string): Promise<{
    success: boolean;
    message: string;
}>;
/**
 * Admin: Review verification request
 */
export declare function reviewVerification(verificationId: string, reviewerId: string, decision: 'APPROVED' | 'REJECTED', reason?: string): Promise<VerificationRequest>;
/**
 * Submit appeal for rejected verification
 */
export declare function submitAppeal(userId: string, verificationId: string, reason: string, additionalDocuments?: Omit<VerificationDocument, 'id' | 'verified' | 'verifiedAt'>[]): Promise<{
    success: boolean;
    message: string;
}>;
/**
 * Check if verification is expiring soon
 */
export declare function checkExpiringVerifications(): Promise<void>;
/**
 * Get verification badge display info
 */
export declare function getBadgeInfo(type: VerificationType): {
    name: string;
    icon: string;
    color: string;
    description: string;
};
declare const _default: {
    getVerificationRequirements: typeof getVerificationRequirements;
    getUserVerifications: typeof getUserVerifications;
    submitVerification: typeof submitVerification;
    verifyEmailCode: typeof verifyEmailCode;
    reviewVerification: typeof reviewVerification;
    submitAppeal: typeof submitAppeal;
    checkExpiringVerifications: typeof checkExpiringVerifications;
    getBadgeInfo: typeof getBadgeInfo;
};
export default _default;
//# sourceMappingURL=verification.service.d.ts.map