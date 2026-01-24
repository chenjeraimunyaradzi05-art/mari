/**
 * Email Service for ATHENA Platform
 * ===================================
 * This module re-exports email functions from the canonical source (utils/email.ts)
 * to maintain backward compatibility while consolidating email logic.
 * 
 * All email templates and sending logic live in ../utils/email.ts
 */

// Re-export all email functions from the canonical source
export {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendReferralNotification,
  sendReEngagementEmail,
  sendWeeklyDigestEmail,
  sendBookingConfirmedEmail,
} from '../utils/email';

// Legacy emailService object for backward compatibility
import {
  sendEmail,
  sendWelcomeEmail as sendWelcomeEmailFn,
  sendReferralNotification,
  sendReEngagementEmail,
  sendWeeklyDigestEmail,
} from '../utils/email';

export const emailService = {
  /**
   * Generic send email method
   * Supports both direct HTML content and template-based emails for backward compatibility
   */
  async sendEmail(options: { 
    to: string; 
    subject: string; 
    html?: string; 
    text?: string;
    template?: string;
    data?: Record<string, any>;
  }): Promise<boolean> {
    // If template and data are provided, generate HTML from them (legacy support)
    let html = options.html || '';
    let text = options.text || '';
    
    if (options.template && options.data) {
      // Generate simple HTML from template data for backward compatibility
      const dataHtml = Object.entries(options.data)
        .map(([key, value]) => `<p><strong>${key}:</strong> ${value}</p>`)
        .join('');
      html = `
        <!DOCTYPE html>
        <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px;">
          <h2>${options.subject}</h2>
          ${dataHtml}
        </body>
        </html>
      `;
      text = Object.entries(options.data)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');
    }
    
    return sendEmail({
      to: options.to,
      subject: options.subject,
      html,
      text,
    });
  },

  /**
   * Send welcome email to new user
   */
  async sendWelcomeEmail(to: string, firstName: string, _referralCode?: string): Promise<boolean> {
    return sendWelcomeEmailFn(to, firstName);
  },

  /**
   * Notify referrer about successful referral
   */
  async sendReferralNotification(
    to: string,
    referrerName: string,
    referredName: string,
    credits: number
  ): Promise<boolean> {
    return sendReferralNotification(to, referrerName, referredName, credits);
  },

  /**
   * Send re-engagement email to inactive users
   */
  async sendReEngagementEmail(to: string, firstName: string, daysInactive: number): Promise<boolean> {
    return sendReEngagementEmail(to, firstName, daysInactive);
  },

  /**
   * Send weekly digest email
   */
  async sendWeeklyDigest(
    to: string,
    firstName: string,
    stats: { newJobs: number; newConnections: number; upcomingEvents: number }
  ): Promise<boolean> {
    return sendWeeklyDigestEmail(to, firstName, stats);
  },
};

export default emailService;
