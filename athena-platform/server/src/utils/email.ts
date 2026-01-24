/**
 * Email Utilities
 * 
 * This module consolidates email functionality by re-exporting from email.service.ts
 * and providing backward-compatible convenience functions for auth-related emails.
 * 
 * For new email templates, add them to email.service.ts
 */

import { logger } from './logger';
import { sendEmail as sendEmailService, emailService } from '../services/email.service';

// Re-export core email functionality from the service
export { sendEmail } from '../services/email.service';
export { emailService } from '../services/email.service';

const DEFAULT_CLIENT_URL = 'http://localhost:3000';

/**
 * Escape HTML special characters to prevent XSS in email templates
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Get the client URL from environment, normalized without trailing slash
 */
export function getClientUrl(): string {
  const raw = (process.env.CLIENT_URL || DEFAULT_CLIENT_URL).trim();
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

/**
 * Build a full client URL with optional query parameters
 */
export function buildClientUrl(pathname: string, params?: Record<string, string>): string {
  const base = getClientUrl();
  const url = new URL(pathname, base);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}

/**
 * Auth-specific email templates
 * These provide branded verification emails with XSS protection
 */
const authTemplates = {
  verification: (firstName: string, verificationUrl: string) => {
    const safeFirstName = escapeHtml(firstName);
    return {
      subject: 'Verify your ATHENA account',
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <tr>
      <td style="background: linear-gradient(135deg, #7c3aed 0%, #db2777 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px;">ATHENA</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0;">Your Life Operating System</p>
      </td>
    </tr>
    <tr>
      <td style="background: white; padding: 40px 30px; border-radius: 0 0 12px 12px;">
        <h2 style="color: #1f2937; margin: 0 0 16px 0;">Welcome, ${safeFirstName}! 👋</h2>
        <p style="color: #4b5563; line-height: 1.6; margin: 0 0 24px 0;">
          Thank you for joining ATHENA! Please verify your email address to get started on your journey to success.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${verificationUrl}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #db2777 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600;">
            Verify Email Address
          </a>
        </div>
        <p style="color: #6b7280; font-size: 14px; margin: 24px 0 0 0;">
          This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
          © ${new Date().getFullYear()} ATHENA. Made with ❤️ in Australia.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`,
      text: `Welcome to ATHENA, ${firstName}! Please verify your email by visiting: ${verificationUrl}`,
    };
  },
};

/**
 * Send verification email with branded template
 * Uses the consolidated sendEmail from email.service.ts
 */
export async function sendVerificationEmail(
  email: string,
  firstName: string,
  token: string
): Promise<boolean> {
  const verificationUrl = buildClientUrl('/verify-email', { token });
  const template = authTemplates.verification(firstName, verificationUrl);
  
  return sendEmailService({
    to: email,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
}

/**
 * Send password reset email
 * Delegates to emailService which has the password reset template
 */
export async function sendPasswordResetEmail(
  email: string,
  firstName: string,
  token: string
): Promise<boolean> {
  const resetUrl = buildClientUrl('/reset-password', { token });
  
  // Use the email service's password reset template
  return sendEmailService({
    to: email,
    subject: 'Reset Your ATHENA Password',
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Password Reset</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #7c3aed; margin: 0;">ATHENA</h1>
  </div>
  <h2 style="color: #1f2937;">Password Reset Request</h2>
  <p>Hi ${escapeHtml(firstName)},</p>
  <p>We received a request to reset your password. Click the button below to create a new password:</p>
  <div style="text-align: center; margin: 30px 0;">
    <a href="${resetUrl}" style="display: inline-block; background: #7c3aed; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: 600;">Reset Password</a>
  </div>
  <p style="color: #666; font-size: 14px;">This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.</p>
  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
  <p style="font-size: 12px; color: #999; text-align: center;">© ${new Date().getFullYear()} ATHENA. All rights reserved.</p>
</body>
</html>`,
    text: `Hi ${firstName},\n\nWe received a request to reset your password.\n\nReset your password: ${resetUrl}\n\nThis link expires in 1 hour.\n\n© ${new Date().getFullYear()} ATHENA`,
  });
}

/**
 * Send welcome email after verification
 * Delegates to emailService for consistency
 */
export async function sendWelcomeEmail(
  email: string,
  firstName: string
): Promise<boolean> {
  return emailService.sendWelcomeEmail(email, firstName);
}
