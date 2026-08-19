/**
 * Email Service for ATHENA Platform
 * Handles all transactional and marketing emails
 *
 * NOTE: Core email sending is consolidated in ../utils/email.ts
 * This module provides additional email templates and the emailService object
 */
export { sendEmail, sendVerificationEmail, sendPasswordResetEmail, sendWelcomeEmail } from '../utils/email';
/**
 * Email service class - uses consolidated sendEmailCore from utils/email
 */
export declare const emailService: {
    /**
     * Generic send email method for custom emails
     */
    sendEmail(options: {
        to: string;
        subject: string;
        template?: string;
        data?: Record<string, any>;
        html?: string;
        text?: string;
    }): Promise<boolean>;
    /**
     * Send welcome email to new user
     */
    sendWelcomeEmail(to: string, firstName: string, referralCode?: string): Promise<boolean>;
    /**
     * Notify referrer about successful referral
     */
    sendReferralNotification(to: string, referrerName: string, referredName: string, credits: number): Promise<boolean>;
    /**
     * Send re-engagement email to inactive users
     */
    sendReEngagementEmail(to: string, firstName: string, daysInactive: number): Promise<boolean>;
    /**
     * Send weekly digest email
     */
    sendWeeklyDigest(to: string, firstName: string, stats: {
        newJobs: number;
        newConnections: number;
        upcomingEvents: number;
    }): Promise<boolean>;
};
export default emailService;
//# sourceMappingURL=email.service.d.ts.map