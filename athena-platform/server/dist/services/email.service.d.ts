/**
 * Email Service for ATHENA Platform
 * Handles all transactional and marketing emails
 */
interface EmailOptions {
    to: string;
    subject: string;
    html: string;
    text?: string;
}
/**
 * Send an email using the configured provider
 * Currently logs to console; integrate with SendGrid/SES for production
 */
export declare function sendEmail(options: EmailOptions): Promise<boolean>;
/**
 * Email service class
 */
export declare const emailService: {
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