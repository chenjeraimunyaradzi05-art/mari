import { logger } from './logger';
import { senderAddressProblem } from './sender-address';

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

interface AccountExistsEmailData {
  firstName: string;
  loginUrl: string;
  resetUrl: string;
}

interface AccountLockedEmailData {
  firstName: string;
  unlockUrl: string;
  resetUrl: string;
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

  // Sent to the owner of an address when someone tries to register it again.
  // It is how registration can answer every address the same way: the news
  // that an account exists goes to the inbox, where only its owner reads it.
  accountExists: (data: AccountExistsEmailData) => {
    const safeFirstName = escapeHtml(data.firstName);
    return ({
    subject: 'You already have an ATHENA account',
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
        <h2 style="color: #1f2937; margin: 0 0 16px 0;">You already have an account</h2>
        <p style="color: #4b5563; line-height: 1.6; margin: 0 0 16px 0;">
          Hi ${safeFirstName}, someone tried to create an ATHENA account with this email address. You already have one, so nothing has been changed and no second account was made.
        </p>
        <p style="color: #4b5563; line-height: 1.6; margin: 0 0 24px 0;">
          If that was you, you can sign in. If you have forgotten your password, you can choose a new one.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${data.loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #db2777 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600;">
            Sign in
          </a>
        </div>
        <p style="color: #6b7280; font-size: 14px; margin: 0 0 8px 0;">
          <a href="${data.resetUrl}" style="color: #7c3aed;">Forgot your password?</a>
        </p>
        <p style="color: #6b7280; font-size: 14px; margin: 16px 0 0 0;">
          If it was not you, you do not need to do anything. Your account and your password are exactly as you left them.
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
    text: `Hi ${data.firstName}, someone tried to create an ATHENA account with this email address. You already have one, so nothing has been changed. Sign in at ${data.loginUrl}, or choose a new password at ${data.resetUrl}. If it was not you, you do not need to do anything.`,
  });
  },

  // Sent when an account is locked, whoever pressed the button: the link in it
  // is the only way back in, and it goes to the address on the account, so
  // locking it never leaves her shut out of her own account by her own hand.
  accountLocked: (data: AccountLockedEmailData) => {
    const safeFirstName = escapeHtml(data.firstName);
    return ({
    subject: 'Your ATHENA account is locked',
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
        <h2 style="color: #1f2937; margin: 0 0 16px 0;">Your account is locked</h2>
        <p style="color: #4b5563; line-height: 1.6; margin: 0 0 16px 0;">
          Hi ${safeFirstName}, your ATHENA account has been locked. Every device has been signed out, and nobody can sign in to it, with a password or with Google or Facebook, until it is unlocked.
        </p>
        <p style="color: #4b5563; line-height: 1.6; margin: 0 0 24px 0;">
          When you are ready, use the button below to unlock it, then sign in again. The link works once and for 24 hours.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${data.unlockUrl}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #db2777 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600;">
            Unlock my account
          </a>
        </div>
        <p style="color: #6b7280; font-size: 14px; margin: 0 0 8px 0;">
          If you think someone else knows your password, <a href="${data.resetUrl}" style="color: #7c3aed;">choose a new one</a> before or straight after you unlock.
        </p>
        <p style="color: #6b7280; font-size: 14px; margin: 16px 0 0 0;">
          If you did not lock your account, someone may have access to it. Unlock it only from this email, then change your password.
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
    text: `Hi ${data.firstName}, your ATHENA account has been locked. Every device has been signed out and nobody can sign in until it is unlocked. To unlock it, open ${data.unlockUrl} (it works once, for 24 hours), then sign in again. If you think someone else knows your password, choose a new one at ${data.resetUrl}. If you did not lock your account, someone may have access to it: unlock it only from this email, then change your password.`,
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
        <!-- No counts of mentors or members here: those figures were invented, and docs/security/trust-claims-register.md forbids stating them. -->
        <ul style="color: #4b5563; line-height: 1.8; padding-left: 20px;">
          <li>🔍 Find jobs and opportunities</li>
          <li>👩‍🏫 Find a mentor</li>
          <li>📚 Explore courses and learning paths</li>
          <li>🤝 Join the community</li>
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
};

// ---------------------------------------------------------------------------
// Delivery
//
// This talks to SendGrid's v3 mail endpoint over HTTPS itself, instead of
// through the @sendgrid/mail package. That package is not in package.json and
// never was: the code imported it "in case it is installed", it never was, and
// in production every verification and password-reset email died in the catch
// below and was reported as a refusal by the provider. The endpoint is a single
// POST, and calling it directly is also what gives the retry rules their status
// code (scripts/send-incident-notification.js does the same).

const SENDGRID_SEND_URL = 'https://api.sendgrid.com/v3/mail/send';

/** Why a message did not go, in words a log search and a metric label can use. */
export type EmailFailureReason =
  | 'not_configured'
  | 'suppressed'
  | 'rejected'
  | 'rate_limited'
  | 'provider_error'
  | 'timeout'
  | 'network';

export interface EmailDelivery {
  /** The provider accepted the message (or, outside production, it was logged). */
  ok: boolean;
  /**
   * Only meaningful when `ok` is false: whether asking again later could work.
   * False for a refusal that will be the same next time: a bad address, an
   * unverified sender, a rejected key, an address on the suppression list.
   */
  retryable: boolean;
  /** The HTTP status of the last answer from SendGrid; null when there was none. */
  status: number | null;
  reason: EmailFailureReason | null;
  /** How many times SendGrid was asked. Zero when it was never reached. */
  attempts: number;
}

export interface DeliveryPolicy {
  /** Tries in all, the first included. */
  maxAttempts?: number;
  /** How long one try may take before it is abandoned. */
  attemptTimeoutMs?: number;
  /** Wait before the nth try (the first entry is never used), jittered by a quarter either way. */
  backoffMs?: readonly number[];
}

/** For mail that other work waits on. About 30 seconds at the very worst. */
const DEFAULT_DELIVERY: Required<DeliveryPolicy> = {
  maxAttempts: 3,
  attemptTimeoutMs: 8_000,
  backoffMs: [0, 2_000, 8_000],
};

/**
 * For the one place a request waits for the mail (registration answers 503 if
 * it cannot go), so a provider that is down costs a member seconds, not half a
 * minute.
 */
export const INTERACTIVE_DELIVERY: Required<DeliveryPolicy> = {
  maxAttempts: 2,
  attemptTimeoutMs: 6_000,
  backoffMs: [0, 1_500],
};

/**
 * What a status from SendGrid means for trying again. A 429 and a 5xx are
 * SendGrid being busy or broken and are worth another go; every other refusal,
 * the 400 for an invalid address and the 401 and 403 for a bad key or an
 * unverified sender among them, is the same answer next time, so repeating it
 * only delays the member's error and spends the sending quota.
 */
export function classifyEmailStatus(status: number): { retryable: boolean; reason: EmailFailureReason } {
  if (status === 429) return { retryable: true, reason: 'rate_limited' };
  if (status === 408 || status >= 500) return { retryable: true, reason: 'provider_error' };
  return { retryable: false, reason: 'rejected' };
}

function pause(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

function jittered(ms: number): number {
  return Math.round(ms * (0.75 + Math.random() * 0.5));
}

/** SendGrid's own words for a refusal, trimmed. It never echoes the message or the key. */
function providerMessage(body: string): string | null {
  try {
    const first = JSON.parse(body)?.errors?.[0];
    return typeof first?.message === 'string' ? first.message.slice(0, 200) : null;
  } catch {
    return null;
  }
}

type Attempt =
  | { ok: true; status: number }
  | { ok: false; status: number | null; retryable: boolean; reason: EmailFailureReason; detail: string | null };

async function attemptSend(apiKey: string, payload: string, timeoutMs: number): Promise<Attempt> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(SENDGRID_SEND_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: payload,
    });

    if (response.status >= 200 && response.status < 300) {
      return { ok: true, status: response.status };
    }

    const detail = providerMessage(await response.text().catch(() => ''));
    return { ok: false, status: response.status, ...classifyEmailStatus(response.status), detail };
  } catch (error) {
    // A hung provider and a dropped connection are both worth another try; the
    // difference is only what the log says.
    const timedOut = controller.signal.aborted || (error instanceof Error && error.name === 'AbortError');
    return {
      ok: false,
      status: null,
      retryable: true,
      reason: timedOut ? 'timeout' : 'network',
      detail: timedOut ? `no answer within ${timeoutMs}ms` : error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Whether SendGrid has told us this address cannot be delivered to (a hard
 * bounce, a drop for a bounced or invalid address, a spam report). Read before
 * every send. A failed lookup answers no: a database blip must not stop a
 * password reset, and SendGrid refuses a suppressed address itself.
 */
export async function isEmailSuppressed(address: string): Promise<boolean> {
  try {
    // Imported here so that the many tests and scripts that load this module
    // for its templates do not start a database client.
    const { prisma } = await import('./prisma');
    const row = await prisma.emailSuppression.findUnique({
      where: { email: address.trim().toLowerCase() },
      select: { id: true },
    });
    return Boolean(row);
  } catch (error) {
    logger.warn('Could not check the email suppression list; sending anyway', { error });
    return false;
  }
}

/**
 * What a log line may say about an email: which provider's domain it went to
 * and how long the subject was. Not the address, which is the one thing here
 * that says who a woman is, and not the subject, which is often her name. The
 * domain is enough to tell a problem with one mail provider from a problem
 * with ours, and the member's id is on the line that caused the send.
 */
function logFacts(to: string, subject: string): { recipientDomain: string; subjectLength: number } {
  const at = to.lastIndexOf('@');
  return {
    recipientDomain: at > 0 ? to.slice(at + 1).trim().toLowerCase() : 'unknown',
    subjectLength: subject.length,
  };
}

/**
 * Sends one email and says what became of it.
 *
 * Never throws. Tries up to three times with a pause that grows, but only for
 * what is worth repeating (see classifyEmailStatus), and gives each try a
 * deadline so a provider that stops answering cannot hold a request open.
 * Outside production the message is logged and counts as sent.
 */
export async function deliverEmail(options: EmailOptions, policy: DeliveryPolicy = {}): Promise<EmailDelivery> {
  const { to, subject, html, text } = options;
  const sendgridApiKey = process.env.SENDGRID_API_KEY;
  // There is no default sender. It used to be noreply@athena.com, a domain the
  // venture does not own, which SendGrid refuses to send from: every email
  // looked sent by this code and none could leave. The environment check
  // refuses to boot in production without a usable address
  // (utils/env.ts); this is the same refusal, by the same rule
  // (utils/sender-address.ts), for a process that reached here some other
  // way: a value copied from a template (noreply@your-domain.com), a display
  // name around the address, or the old athena.com default are all refused
  // here rather than handed to SendGrid to refuse.
  const sender = (process.env.SENDGRID_FROM_EMAIL || '').trim();

  const refused = (reason: EmailFailureReason): EmailDelivery => ({
    ok: false,
    retryable: false,
    status: null,
    reason,
    attempts: 0,
  });

  if (process.env.NODE_ENV === 'production' && !sendgridApiKey) {
    logger.error('Email sending is not configured in production', logFacts(to, subject));
    return refused('not_configured');
  }

  const senderProblem = process.env.NODE_ENV === 'production' ? senderAddressProblem(sender) : null;
  if (senderProblem) {
    logger.error(`Email sending is not configured in production: SENDGRID_FROM_EMAIL ${senderProblem}`, logFacts(to, subject));
    return refused('not_configured');
  }

  // In development, just log the email
  if (process.env.NODE_ENV !== 'production') {
    logger.info('Email not sent: sending is disabled outside production', logFacts(to, subject));
    return { ok: true, retryable: false, status: null, reason: null, attempts: 0 };
  }

  if (await isEmailSuppressed(to)) {
    logger.warn('Email not sent: the address is on the suppression list', logFacts(to, subject));
    return refused('suppressed');
  }

  const maxAttempts = Math.max(1, policy.maxAttempts ?? DEFAULT_DELIVERY.maxAttempts);
  const attemptTimeoutMs = policy.attemptTimeoutMs ?? DEFAULT_DELIVERY.attemptTimeoutMs;
  const backoffMs = policy.backoffMs ?? DEFAULT_DELIVERY.backoffMs;
  // text/plain has to come first in SendGrid's content list.
  const payload = JSON.stringify({
    personalizations: [{ to: [{ email: to }] }],
    from: { email: sender },
    subject,
    content: [
      { type: 'text/plain', value: text || subject },
      { type: 'text/html', value: html },
    ],
  });

  let last: Extract<Attempt, { ok: false }> | null = null;
  let attempts = 0;
  while (attempts < maxAttempts) {
    if (attempts > 0) {
      await pause(jittered(backoffMs[Math.min(attempts, backoffMs.length - 1)] ?? 0));
    }
    attempts += 1;

    const result = await attemptSend(sendgridApiKey!, payload, attemptTimeoutMs);
    if (result.ok) {
      logger.info('Email sent', { ...logFacts(to, subject), ...(attempts > 1 ? { attempts } : {}) });
      return { ok: true, retryable: false, status: result.status, reason: null, attempts };
    }

    last = result;
    if (!result.retryable) break;
  }

  logger.error('Failed to send email', {
    ...logFacts(to, subject),
    attempts,
    status: last?.status ?? null,
    reason: last?.reason ?? null,
    detail: last?.detail ?? null,
  });
  return {
    ok: false,
    // Still worth a later try when the last answer was a busy or broken
    // provider; not when it was a refusal that will repeat.
    retryable: Boolean(last?.retryable),
    status: last?.status ?? null,
    reason: last?.reason ?? 'network',
    attempts,
  };
}

// Send email via SendGrid (or log in development). The yes-or-no form of
// deliverEmail, kept because about twenty callers only need to know whether it
// went.
export async function sendEmail(options: EmailOptions, policy: DeliveryPolicy = {}): Promise<boolean> {
  return (await deliverEmail(options, policy)).ok;
}

// Convenience functions
export async function sendVerificationEmail(
  email: string,
  firstName: string,
  token: string,
  policy?: DeliveryPolicy
): Promise<boolean> {
  const verificationUrl = buildClientUrl('/verify-email', { token });
  
  const template = templates.verification({ firstName, verificationUrl });
  return sendEmail({ to: email, ...template }, policy);
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

export async function sendAccountExistsEmail(
  email: string,
  firstName: string
): Promise<boolean> {
  const loginUrl = buildClientUrl('/login');
  const resetUrl = buildClientUrl('/forgot-password');

  const template = templates.accountExists({ firstName, loginUrl, resetUrl });
  return sendEmail({ to: email, ...template });
}

/**
 * The address of the page that locks an account from a "this was not me" link.
 * Built here with the other emailed links so they all follow CLIENT_URL; the
 * page asks her to confirm before anything happens, because a mail scanner
 * that opens every link in a message must not be able to lock her out.
 */
export function accountLockUrl(token: string): string {
  return buildClientUrl('/lock-account', { token });
}

/**
 * Tells the owner her account is locked and gives her the one-time way back.
 * Goes to the address on the account, never to one supplied with the request.
 */
export async function sendAccountLockedEmail(
  email: string,
  firstName: string,
  token: string,
  policy?: DeliveryPolicy
): Promise<boolean> {
  const unlockUrl = buildClientUrl('/unlock-account', { token });
  const resetUrl = buildClientUrl('/forgot-password');

  const template = templates.accountLocked({ firstName, unlockUrl, resetUrl });
  return sendEmail({ to: email, ...template }, policy);
}

export async function sendWelcomeEmail(
  email: string,
  firstName: string
): Promise<boolean> {
  const loginUrl = buildClientUrl('/login');
  
  const template = templates.welcome({ firstName, loginUrl });
  return sendEmail({ to: email, ...template });
}
