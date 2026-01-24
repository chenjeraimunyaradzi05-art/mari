import { logger } from './logger';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface VerificationEmailData {
  firstName: string;
  verificationUrl: string;
}

interface PasswordResetEmailData {
  firstName: string;
  resetUrl: string;
}

interface WelcomeEmailData {
  firstName: string;
  loginUrl: string;
}

const DEFAULT_CLIENT_URL = 'http://localhost:3000';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getClientUrl(): string {
  const raw = (process.env.CLIENT_URL || DEFAULT_CLIENT_URL).trim();
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

function buildClientUrl(pathname: string, params?: Record<string, string>): string {
  const base = getClientUrl();
  const url = new URL(pathname, base);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}

// Email templates
const templates = {
  verification: (data: VerificationEmailData) => {
    const safeFirstName = escapeHtml(data.firstName);
    return ({
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
  });
  },

  passwordReset: (data: PasswordResetEmailData) => {
    const safeFirstName = escapeHtml(data.firstName);
    return ({
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
          Hi ${safeFirstName}, we received a request to reset your password. Click the button below to create a new password.
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
  });
  },

  welcome: (data: WelcomeEmailData) => {
    const safeFirstName = escapeHtml(data.firstName);
    return ({
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
        <h2 style="color: #1f2937; margin: 0 0 16px 0;">Your journey starts now, ${safeFirstName}!</h2>
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
  });
  },

  referralSignup: (data: { referrerName: string; referredName: string; credits: number }) => {
    const safeReferrerName = escapeHtml(data.referrerName);
    const safeReferredName = escapeHtml(data.referredName);
    return ({
      subject: `🎉 ${data.referredName} joined ATHENA with your referral!`,
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
      <td style="background: white; padding: 40px 30px; border-radius: 0 0 12px 12px; text-align: center;">
        <div style="font-size: 60px; margin-bottom: 16px;">🎉</div>
        <h2 style="color: #1f2937; margin: 0 0 16px 0;">Great news, ${safeReferrerName}!</h2>
        <p style="color: #4b5563; line-height: 1.6; margin: 0 0 24px 0;">
          <strong>${safeReferredName}</strong> just signed up using your referral link!
        </p>
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 20px; border-radius: 12px; color: white; margin: 24px 0;">
          <p style="margin: 0; font-size: 14px;">You've earned</p>
          <p style="margin: 8px 0; font-size: 36px; font-weight: bold;">${data.credits} Credits</p>
        </div>
        <p style="color: #4b5563; margin: 0 0 24px 0;">Keep sharing and earning! Every friend who joins gets you both credits.</p>
        <a href="${getClientUrl()}/dashboard/referrals" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #db2777 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600;">
          View Your Referrals
        </a>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
          © ${new Date().getFullYear()} ATHENA. Made with ❤️ in Australia.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
      `,
      text: `Great news, ${data.referrerName}! ${data.referredName} just signed up using your referral link. You've earned ${data.credits} credits!`,
    });
  },

  reEngagement: (data: { firstName: string; daysInactive: number }) => {
    const safeFirstName = escapeHtml(data.firstName);
    return ({
      subject: `We miss you, ${data.firstName}! 💜`,
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
        <h2 style="color: #1f2937; margin: 0 0 16px 0;">Hey ${safeFirstName},</h2>
        <p style="color: #4b5563; line-height: 1.6; margin: 0 0 24px 0;">
          It's been ${data.daysInactive} days since we last saw you on ATHENA. A lot has been happening while you were away!
        </p>
        <div style="background: #f3f4f6; padding: 20px; border-radius: 12px; margin: 24px 0;">
          <h3 style="margin: 0 0 12px 0; color: #1f2937;">What's new:</h3>
          <ul style="margin: 0; padding-left: 20px; color: #4b5563;">
            <li>🆕 New job opportunities matching your profile</li>
            <li>👩‍🏫 Fresh mentor availability</li>
            <li>📚 New courses added to the learning hub</li>
            <li>💬 Community discussions you might like</li>
          </ul>
        </div>
        <p style="color: #4b5563; margin: 0 0 24px 0;">Your community is waiting for you. Jump back in and continue your journey!</p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${getClientUrl()}/dashboard" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #db2777 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600;">
            Return to ATHENA
          </a>
        </div>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
          Don't want these emails? <a href="${getClientUrl()}/settings/notifications" style="color: #7c3aed;">Manage preferences</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
      `,
      text: `Hey ${data.firstName}, it's been ${data.daysInactive} days since we last saw you. Your community is waiting! Visit ${getClientUrl()}/dashboard to jump back in.`,
    });
  },

  weeklyDigest: (data: { firstName: string; newJobs: number; newConnections: number; upcomingEvents: number }) => {
    const safeFirstName = escapeHtml(data.firstName);
    return ({
      subject: 'Your ATHENA Weekly Update 📊',
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
        <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0;">Your Weekly Update</p>
      </td>
    </tr>
    <tr>
      <td style="background: white; padding: 40px 30px; border-radius: 0 0 12px 12px;">
        <h2 style="color: #1f2937; margin: 0 0 16px 0;">Hi ${safeFirstName}! 👋</h2>
        <p style="color: #4b5563; line-height: 1.6; margin: 0 0 24px 0;">Here's what happened on ATHENA this week:</p>
        <table width="100%" cellpadding="0" cellspacing="10" style="margin: 24px 0;">
          <tr>
            <td style="background: #ede9fe; padding: 15px; border-radius: 8px; text-align: center; width: 33%;">
              <p style="margin: 0; font-size: 28px; font-weight: bold; color: #7c3aed;">${data.newJobs}</p>
              <p style="margin: 5px 0 0 0; font-size: 14px; color: #666;">New Jobs</p>
            </td>
            <td style="background: #fce7f3; padding: 15px; border-radius: 8px; text-align: center; width: 33%;">
              <p style="margin: 0; font-size: 28px; font-weight: bold; color: #ec4899;">${data.newConnections}</p>
              <p style="margin: 5px 0 0 0; font-size: 14px; color: #666;">Connections</p>
            </td>
            <td style="background: #d1fae5; padding: 15px; border-radius: 8px; text-align: center; width: 33%;">
              <p style="margin: 0; font-size: 28px; font-weight: bold; color: #10b981;">${data.upcomingEvents}</p>
              <p style="margin: 5px 0 0 0; font-size: 14px; color: #666;">Events</p>
            </td>
          </tr>
        </table>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${getClientUrl()}/dashboard" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #db2777 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600;">
            Explore Now
          </a>
        </div>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
          <a href="${getClientUrl()}/settings/notifications" style="color: #7c3aed;">Unsubscribe</a> • © ${new Date().getFullYear()} ATHENA
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
      `,
      text: `Hi ${data.firstName}! Here's your weekly update: ${data.newJobs} new jobs, ${data.newConnections} connections, ${data.upcomingEvents} events. Visit ${getClientUrl()}/dashboard to explore.`,
    });
  },

  bookingConfirmed: (data: { menteeName: string; mentorName: string; dateTime: string; duration: string; sessionLink: string; topics?: string[] }) => {
    const safeMenteeName = escapeHtml(data.menteeName);
    const safeMentorName = escapeHtml(data.mentorName);
    return ({
      subject: `✅ Mentor Session Confirmed with ${data.mentorName}`,
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
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="font-size: 60px;">✅</div>
          <h2 style="color: #1f2937; margin: 16px 0 0 0;">Session Confirmed!</h2>
        </div>
        <p style="color: #4b5563; line-height: 1.6; margin: 0 0 24px 0;">
          Hi ${safeMenteeName}, your mentor session with <strong>${safeMentorName}</strong> has been confirmed.
        </p>
        <div style="background: #f3f4f6; padding: 20px; border-radius: 12px; margin: 24px 0;">
          <p style="margin: 5px 0; color: #4b5563;"><strong>📅 Date & Time:</strong> ${escapeHtml(data.dateTime)}</p>
          <p style="margin: 5px 0; color: #4b5563;"><strong>⏱️ Duration:</strong> ${escapeHtml(data.duration)}</p>
          ${data.topics && data.topics.length > 0 ? `<p style="margin: 5px 0; color: #4b5563;"><strong>📋 Topics:</strong> ${data.topics.map(escapeHtml).join(', ')}</p>` : ''}
        </div>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${data.sessionLink}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #db2777 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600;">
            View Session Details
          </a>
        </div>
        <p style="color: #6b7280; font-size: 14px; margin: 24px 0 0 0;">
          💡 Tip: Prepare your questions in advance to make the most of your session!
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
      text: `Hi ${data.menteeName}, your session with ${data.mentorName} is confirmed! Date: ${data.dateTime}, Duration: ${data.duration}. View details: ${data.sessionLink}`,
    });
  },
};

// Send email via SendGrid (or log in development)
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const { to, subject, html, text } = options;

  // In development, just log the email
  if (process.env.NODE_ENV !== 'production' || !process.env.SENDGRID_API_KEY) {
    logger.info(`📧 Email would be sent to: ${to}`);
    logger.info(`   Subject: ${subject}`);
    logger.info(`   (Email sending disabled in development)`);
    return true;
  }

  try {
    // Dynamic import to avoid issues if package not installed
    const sgMail = await import('@sendgrid/mail');
    sgMail.default.setApiKey(process.env.SENDGRID_API_KEY);

    await sgMail.default.send({
      to,
      from: process.env.SENDGRID_FROM_EMAIL || 'noreply@athena.com',
      subject,
      html,
      text: text || subject,
    });

    logger.info(`📧 Email sent successfully to: ${to}`);
    return true;
  } catch (error) {
    logger.error('Failed to send email:', error);
    return false;
  }
}

// Convenience functions
export async function sendVerificationEmail(
  email: string,
  firstName: string,
  token: string
): Promise<boolean> {
  const verificationUrl = buildClientUrl('/verify-email', { token });
  
  const template = templates.verification({ firstName, verificationUrl });
  return sendEmail({ to: email, ...template });
}

export async function sendPasswordResetEmail(
  email: string,
  firstName: string,
  token: string
): Promise<boolean> {
  const resetUrl = buildClientUrl('/reset-password', { token });
  
  const template = templates.passwordReset({ firstName, resetUrl });
  return sendEmail({ to: email, ...template });
}

export async function sendWelcomeEmail(
  email: string,
  firstName: string
): Promise<boolean> {
  const loginUrl = buildClientUrl('/login');
  
  const template = templates.welcome({ firstName, loginUrl });
  return sendEmail({ to: email, ...template });
}

// Additional convenience functions for consolidated email service
export async function sendReferralNotification(
  email: string,
  referrerName: string,
  referredName: string,
  credits: number
): Promise<boolean> {
  const template = templates.referralSignup({ referrerName, referredName, credits });
  return sendEmail({ to: email, ...template });
}

export async function sendReEngagementEmail(
  email: string,
  firstName: string,
  daysInactive: number
): Promise<boolean> {
  const template = templates.reEngagement({ firstName, daysInactive });
  return sendEmail({ to: email, ...template });
}

export async function sendWeeklyDigestEmail(
  email: string,
  firstName: string,
  stats: { newJobs: number; newConnections: number; upcomingEvents: number }
): Promise<boolean> {
  const template = templates.weeklyDigest({ firstName, ...stats });
  return sendEmail({ to: email, ...template });
}

export async function sendBookingConfirmedEmail(
  email: string,
  menteeName: string,
  mentorName: string,
  dateTime: string,
  duration: string,
  sessionLink: string,
  topics?: string[]
): Promise<boolean> {
  const template = templates.bookingConfirmed({ menteeName, mentorName, dateTime, duration, sessionLink, topics });
  return sendEmail({ to: email, ...template });
}
