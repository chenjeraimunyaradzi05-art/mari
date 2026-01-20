"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = sendEmail;
exports.sendVerificationEmail = sendVerificationEmail;
exports.sendPasswordResetEmail = sendPasswordResetEmail;
exports.sendWelcomeEmail = sendWelcomeEmail;
const logger_1 = require("./logger");
// Email templates
const templates = {
    verification: (data) => ({
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
        <h2 style="color: #1f2937; margin: 0 0 16px 0;">Welcome, ${data.firstName}! 👋</h2>
        <p style="color: #4b5563; line-height: 1.6; margin: 0 0 24px 0;">
          Thank you for joining ATHENA! Please verify your email address to get started on your journey to success.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${data.verificationUrl}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #db2777 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600;">
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
</html>
    `,
        text: `Welcome to ATHENA, ${data.firstName}! Please verify your email by visiting: ${data.verificationUrl}`,
    }),
    passwordReset: (data) => ({
        subject: 'Reset your ATHENA password',
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <tr>
      <td style="background: linear-gradient(135deg, #7c3aed 0%, #db2777 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px;">ATHENA</h1>
      </td>
    </tr>
    <tr>
      <td style="background: white; padding: 40px 30px; border-radius: 0 0 12px 12px;">
        <h2 style="color: #1f2937; margin: 0 0 16px 0;">Password Reset Request</h2>
        <p style="color: #4b5563; line-height: 1.6; margin: 0 0 24px 0;">
          Hi ${data.firstName}, we received a request to reset your password. Click the button below to create a new password.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${data.resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #db2777 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600;">
            Reset Password
          </a>
        </div>
        <p style="color: #6b7280; font-size: 14px; margin: 24px 0 0 0;">
          This link expires in 1 hour. If you didn't request a password reset, please ignore this email or contact support.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
          © ${new Date().getFullYear()} ATHENA. Made with ❤️ in Australia.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
        text: `Hi ${data.firstName}, reset your password by visiting: ${data.resetUrl}`,
    }),
    welcome: (data) => ({
        subject: 'Welcome to ATHENA! 🎉',
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <tr>
      <td style="background: linear-gradient(135deg, #7c3aed 0%, #db2777 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Welcome to ATHENA!</h1>
      </td>
    </tr>
    <tr>
      <td style="background: white; padding: 40px 30px; border-radius: 0 0 12px 12px;">
        <h2 style="color: #1f2937; margin: 0 0 16px 0;">Your journey starts now, ${data.firstName}!</h2>
        <p style="color: #4b5563; line-height: 1.6; margin: 0 0 24px 0;">
          Your email has been verified and your account is ready. Here's what you can do:
        </p>
        <ul style="color: #4b5563; line-height: 1.8; padding-left: 20px;">
          <li>🔍 Discover AI-matched job opportunities</li>
          <li>👩‍🏫 Connect with 500+ expert mentors</li>
          <li>📚 Access personalized learning paths</li>
          <li>🤝 Join a community of 50,000+ ambitious women</li>
        </ul>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${data.loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #db2777 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600;">
            Go to Dashboard
          </a>
        </div>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
          © ${new Date().getFullYear()} ATHENA. Made with ❤️ in Australia.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
        text: `Welcome to ATHENA, ${data.firstName}! Your account is verified. Visit ${data.loginUrl} to get started.`,
    }),
};
// Send email via SendGrid (or log in development)
async function sendEmail(options) {
    const { to, subject, html, text } = options;
    // In development, just log the email
    if (process.env.NODE_ENV !== 'production' || !process.env.SENDGRID_API_KEY) {
        logger_1.logger.info(`📧 Email would be sent to: ${to}`);
        logger_1.logger.info(`   Subject: ${subject}`);
        logger_1.logger.info(`   (Email sending disabled in development)`);
        return true;
    }
    try {
        // Dynamic import to avoid issues if package not installed
        const sgMail = await Promise.resolve().then(() => __importStar(require('@sendgrid/mail')));
        sgMail.default.setApiKey(process.env.SENDGRID_API_KEY);
        await sgMail.default.send({
            to,
            from: process.env.SENDGRID_FROM_EMAIL || 'noreply@athena.com',
            subject,
            html,
            text: text || subject,
        });
        logger_1.logger.info(`📧 Email sent successfully to: ${to}`);
        return true;
    }
    catch (error) {
        logger_1.logger.error('Failed to send email:', error);
        return false;
    }
}
// Convenience functions
async function sendVerificationEmail(email, firstName, token) {
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const verificationUrl = `${clientUrl}/verify-email?token=${token}`;
    const template = templates.verification({ firstName, verificationUrl });
    return sendEmail({ to: email, ...template });
}
async function sendPasswordResetEmail(email, firstName, token) {
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const resetUrl = `${clientUrl}/reset-password?token=${token}`;
    const template = templates.passwordReset({ firstName, resetUrl });
    return sendEmail({ to: email, ...template });
}
async function sendWelcomeEmail(email, firstName) {
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const loginUrl = `${clientUrl}/login`;
    const template = templates.welcome({ firstName, loginUrl });
    return sendEmail({ to: email, ...template });
}
//# sourceMappingURL=email.js.map