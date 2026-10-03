import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { AuditAction, Persona, Prisma, Region, UserRole, WomanVerificationStatus } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { logAudit } from '../utils/audit';
import { bestEffort } from '../utils/best-effort';
import { recordFailure, recordSuccess } from '../utils/ops-metrics';
import { authEmailTotal, type AuthEmailKind } from '../utils/metrics';
import { SharedRateLimitStore } from '../utils/rate-limit-store';
import { hashPassword, comparePassword, DUMMY_PASSWORD_HASH } from '../utils/password';
import {
  generateAccessToken,
  generateRefreshToken,
  getTokenExpiresInSeconds,
  verifyToken,
} from '../utils/jwt';
import { ApiError } from '../middleware/errorHandler';
import {
  ACCOUNT_LOCKED_MESSAGE,
  authenticate,
  AuthRequest,
  EMAIL_NOT_VERIFIED_MESSAGE,
  SUSPENDED_ACCOUNT_MESSAGE,
} from '../middleware/auth';
import {
  INTERACTIVE_DELIVERY,
  sendAccountExistsEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
} from '../utils/email';
import { logger } from '../utils/logger';
import crypto from 'crypto';
import { RefreshConflictError, sessionService } from '../services/session.service';
import { noteSignIn } from '../services/login-alert.service';
import { lockAccount, lockAccountByLink, mailUnlockLink, unlockAccount } from '../services/account-lock.service';
import { notifyAdmins } from '../services/admin-notify.service';
import { hashOpaqueToken } from '../utils/opaqueToken';
import { getTrustedOriginFromHeaders, isCorsOriginAllowed } from '../utils/origins';
import {
  clearFailedLogins,
  getLockoutStatus,
  recordFailedLogin,
} from '../utils/loginAttempts';
import {
  buildTotpAuthUrl,
  generateTotpSecret,
  matchTotpStep,
  normalizeTotpCode,
} from '../utils/totp';
import { claimTotpStep } from '../utils/totp-replay';
import { openSecret, sealSecret } from '../utils/secret-box';
import { sessionEvents } from '../utils/session-events';
import { DATE_OF_BIRTH_REFUSAL, isPlausibleDateOfBirth, meetsMinimumAge } from '../middleware/account-gates';
import { BANNED_REGISTRATION_MESSAGE, isBannedEmail } from '../services/banned-identity.service';

const router = Router();

const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 128;
const EXTERNAL_AUTH_TOKEN_MAX_LENGTH = 4096;
const AUTH_CODE_PATTERN = /^[A-Za-z0-9-]+$/;
const SECURE_TOKEN_PATTERN = /^[a-f0-9]{64}$/i;
const TOTP_ISSUER = 'ATHENA';
// The alphabet drops the glyphs people mistype off a printout (I/1, O/0).
const RECOVERY_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const RECOVERY_CODE_LENGTH = 10;
const RECOVERY_CODE_GROUP_LENGTH = 5;
const RECOVERY_CODE_COUNT = 10;
// ===========================================
// SLOWING SCRIPTED SIGN-UPS
// ===========================================

/**
 * Google and Facebook sign-in both create accounts, and they sat under the
 * general limit of a hundred requests in fifteen minutes while password
 * sign-up and sign-in had ten. A script that wanted a pile of accounts only
 * had to come in through the OAuth door. This is the same budget as the
 * password door, counted separately and kept in the same shared store, so an
 * address gets ten tries at the social routes in fifteen minutes in
 * production. The switch mirrors index.ts: local tooling can turn limits off,
 * production cannot.
 */
const socialAuthLimitEnabled =
  process.env.NODE_ENV === 'production' || process.env.RATE_LIMIT_ENABLED !== 'false';
const socialAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 10 : 100,
  message: { success: false, message: 'Too many sign-in attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  store: new SharedRateLimitStore('rl:social-auth:'),
});
const socialAuthLimit = (req: Request, res: Response, next: NextFunction) =>
  socialAuthLimitEnabled ? socialAuthLimiter(req, res, next) : next();

/**
 * The human check on password sign-up.
 *
 * A community whose whole value is that strangers cannot walk in had nothing
 * on its front door but a per-address rate limit: a script rotating addresses
 * could open as many accounts as it liked, and every one of them would sit in
 * the women-gate queue for a person to wade through. Cloudflare Turnstile is
 * the check because it asks nothing of most people, sets no tracking cookie,
 * and does not send her to an advertising company to prove she is human.
 *
 * It is enforced when TURNSTILE_SECRET_KEY is set and skipped when it is not,
 * so a developer machine and the test suite need no Cloudflare account. The
 * web form shows the widget when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set; the
 * two are configured together. A production server without the key says so in
 * its log once at start rather than pretending the door is guarded.
 *
 * Google and Facebook sign-up are not asked for it: those accounts come with
 * an address the provider has already verified, which is a stronger signal
 * than a checkbox, and they are slowed by the limiter above.
 */
const HUMAN_CHECK_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const HUMAN_CHECK_TOKEN_MAX_LENGTH = 2048;
const HUMAN_CHECK_REQUIRED_MESSAGE = 'Please complete the check that you are a person, then try again.';

if (process.env.NODE_ENV === 'production' && !process.env.TURNSTILE_SECRET_KEY?.trim()) {
  logger.warn(
    'TURNSTILE_SECRET_KEY is not set: password sign-up has no human check, only rate limits and email verification'
  );
}

async function requireHumanCheck(token: unknown, remoteIp: string | undefined): Promise<void> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) return;

  if (typeof token !== 'string' || !token.trim() || token.length > HUMAN_CHECK_TOKEN_MAX_LENGTH) {
    throw new ApiError(400, HUMAN_CHECK_REQUIRED_MESSAGE);
  }

  const form = new URLSearchParams({ secret, response: token.trim() });
  if (remoteIp) form.set('remoteip', remoteIp);

  let outcome: { success?: boolean; 'error-codes'?: string[] };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(HUMAN_CHECK_VERIFY_URL, { method: 'POST', body: form, signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Turnstile answered ${response.status}`);
    }
    outcome = (await response.json()) as typeof outcome;
  } catch (error) {
    // Closed rather than open: a check that waves everyone through whenever
    // Cloudflare is slow is a check a script only has to time. She is told
    // it is on our side and to try again, not that she failed it.
    recordFailure('auth.human_check', error);
    logger.error('Human check could not be verified', { error });
    throw new ApiError(503, 'We could not complete the sign-up check just now. Please try again in a minute.');
  } finally {
    clearTimeout(timeout);
  }

  if (outcome.success !== true) {
    logger.warn('Human check refused a sign-up', { errorCodes: outcome['error-codes'] ?? [] });
    throw new ApiError(400, 'The check that you are a person did not go through. Please try it again.');
  }
}

// ===========================================
// SIGN-IN PROVIDERS
// ===========================================

type SignInProvider = 'Google' | 'Facebook';

/**
 * The refusals a returning member meets on the Google or Facebook door.
 *
 * These used to run after the provider id had been written onto her account
 * with a raw UPDATE, together with emailVerified and lastLoginAt. So a request
 * that matched a suspended account, or one protected by a second factor, was
 * refused — and had already attached a new way into the account before it
 * was. They now run first, and nothing is written for a refused request.
 *
 * The second factor is asked for separately, by requireSocialSecondFactor,
 * straight after this and before any write.
 */
function refuseSocialSignIn(account: {
  isSuspended: boolean;
  lockedAt?: Date | null;
}): void {
  if (account.isSuspended) {
    throw new ApiError(403, SUSPENDED_ACCOUNT_MESSAGE);
  }
  // Her own lock holds against the provider doors as it does against the
  // password: signing in with Google must not undo what she did when she
  // thought someone else had the account.
  if (account.lockedAt) {
    throw new ApiError(403, ACCOUNT_LOCKED_MESSAGE);
  }
}

/**
 * The second factor on the Google and Facebook doors.
 *
 * A member with two-factor on was turned away from both with "sign in with
 * email and password". That was no way in at all for a member who signed up
 * with Google or Facebook and has no password, and the only route back to her
 * account was the reset-password email. The doors now take the code in the
 * body (`twoFactorCode`, an authenticator code or an unused recovery code,
 * the same as /login), checked before anything is written to the account. The
 * provider's own proof is the first factor; this is the second, and a
 * provider login on its own never opens a protected account.
 *
 * Wrong answers count against the same lockout as /login, per address and per
 * place, so these doors are not a second place to guess six-digit codes. The
 * code is not asked for on a sign-up: a new account has no second factor yet.
 */
async function requireSocialSecondFactor(
  req: Request,
  account: {
    id: string;
    email: string;
    twoFactorEnabled: boolean;
    twoFactorSecret: string | null;
    twoFactorRecoveryCodes: string[];
  }
): Promise<boolean> {
  if (!account.twoFactorEnabled) return false;

  const lockStatus = await getLockoutStatus(account.email, req.ip);
  if (lockStatus.locked) {
    const minutes = Math.max(1, Math.ceil(lockStatus.retryAfterSeconds / 60));
    throw new ApiError(429, `Too many failed login attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`);
  }

  const submittedCode = typeof req.body?.twoFactorCode === 'string' ? req.body.twoFactorCode.trim() : '';
  if (!submittedCode) {
    // Not counted: she has not been asked yet. The sign-in screens answer this
    // sentence by showing the code box and sending the same credential again.
    throw new ApiError(401, 'Two-factor code required');
  }

  if (!(await verifySecondFactor(account, submittedCode))) {
    const failed = await recordFailedLogin(account.email, req.ip);
    if (failed.locked) {
      const minutes = Math.max(1, Math.ceil(failed.retryAfterSeconds / 60));
      throw new ApiError(429, `Too many failed login attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`);
    }
    throw new ApiError(401, 'Invalid two-factor code');
  }

  return true;
}

/**
 * A unique-constraint collision on a sign-in, in words. The provider ids are
 * @unique, and the raw UPDATE that used to write them surfaced a collision as
 * a bare Postgres error and a 500.
 */
function socialAccountConflict(error: unknown, provider: SignInProvider): ApiError | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return null;
  const target = Array.isArray(error.meta?.target) ? (error.meta.target as string[]) : [];
  if (target.includes('email')) {
    return new ApiError(409, 'Email already registered');
  }
  if (target.includes('googleId') || target.includes('facebookId')) {
    return new ApiError(409, `That ${provider} account is already linked to a different ATHENA account.`);
  }
  return new ApiError(409, 'Could not create a unique account code. Please try again.');
}

/**
 * Who linked a sign-in provider to an account, from where, and whether a
 * password nobody had proved was theirs went with it. This used to borrow
 * DATA_ACCESS and put the real event in metadata, because AuditAction had no
 * verb for it; a new way into somebody's account filed as "a record was read"
 * is the entry an investigation filters straight past. It has its own verb
 * now. The link is already committed, so the row is best effort.
 */
async function recordSignInProviderLinked(
  req: Request,
  userId: string,
  provider: SignInProvider,
  clearedUnprovenPassword: boolean
): Promise<void> {
  await bestEffort(
    `${provider} sign-in link audit row`,
    logAudit({
      action: AuditAction.SIGN_IN_PROVIDER_LINKED,
      actorUserId: userId,
      targetUserId: userId,
      ipAddress: req.ip ?? null,
      userAgent: req.get('user-agent') || null,
      metadata: {
        provider,
        clearedUnprovenPassword,
      },
    })
  );
}

/**
 * Refuses an account for an address that belongs to someone who was banned.
 *
 * A ban used to suspend the one account and nothing else, so the man banned
 * for threatening a member could sign up again the same afternoon with the
 * same address, or the same address with a "+2" in it, and carry on. Every
 * path that creates an account asks this first: the email form, Google and
 * Facebook.
 *
 * The answer is BANNED_REGISTRATION_MESSAGE and nothing more. It says the
 * address cannot be used, never that it was banned, because anyone can type
 * someone else's address into a sign-up form, and "this person was banned
 * from ATHENA" is not ours to tell them. A check that cannot run refuses too:
 * an unreadable ban list must not become an open door.
 */
async function refuseUnusableAddress(email: string): Promise<void> {
  if (await isBannedEmail(email)) {
    throw new ApiError(403, BANNED_REGISTRATION_MESSAGE);
  }
}

/** True when a registration body carries a date of birth an adult could have. */
function acceptableDateOfBirth(value: unknown): boolean {
  if (typeof value !== 'string' && !(value instanceof Date)) return false;
  const parsed = value instanceof Date ? value : new Date(value);
  return isPlausibleDateOfBirth(parsed) && meetsMinimumAge(parsed);
}

const PERSONA_VALUES = [
  'EARLY_CAREER',
  'MID_CAREER',
  'ENTREPRENEUR',
  'CREATOR',
  'MENTOR',
  'EDUCATION_PROVIDER',
  'EMPLOYER',
  'REAL_ESTATE',
  'GOVERNMENT_NGO',
];

// What a failed send is logged with. A member's id, never her address: the log is
// kept for weeks and read by more people than the database is, and the id finds
// the row. (The logger would redact an `email` key anyway; this keeps it out of
// the code too.)
type AuthEmailContext = Record<string, string | undefined>;

type InviteCodeRecord = {
  id: string;
  usesCount: number;
  maxUses: number | null;
};

// Helper: Generate secure token
function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Counts what became of one of the emails a member cannot get in, or back in,
 * without: in the process's own failure list (so /health/detailed degrades while
 * they are failing) and in the Prometheus counter that AthenaAuthEmailFailing
 * reads. Until this existed a refused or lost one was a line in the log and
 * nothing else, so a sender the provider had stopped accepting locked every new
 * member out and nobody could see it happening. Never throws, and never puts an
 * address in the failure list, which /health/detailed shows.
 */
function noteAuthEmail(kind: AuthEmailKind, sent: boolean, error?: unknown): void {
  try {
    authEmailTotal.inc({ kind, outcome: sent ? 'sent' : 'failed' });
  } catch {
    // Counting is never worth failing a registration over.
  }
  const operation = `auth.email.${kind}`;
  if (sent) {
    recordSuccess(operation);
  } else {
    recordFailure(operation, error ?? new Error(`The ${kind.replace(/_/g, ' ')} email was not accepted by the email provider`));
  }
}

/** Runs one send and notes its outcome. A send that throws counts as a failure and answers false. */
async function sendAuthEmail(
  kind: AuthEmailKind,
  sendTask: () => Promise<boolean>,
  context: AuthEmailContext
): Promise<boolean> {
  try {
    const sent = await sendTask();
    noteAuthEmail(kind, sent === true);
    return sent === true;
  } catch (error) {
    logger.error('Auth email threw', { ...context, error });
    noteAuthEmail(kind, false, error);
    return false;
  }
}

/** The machine-readable word on the 503 for a registration whose confirmation mail could not go. */
const VERIFICATION_EMAIL_FAILED = 'VERIFICATION_EMAIL_FAILED';

async function requireAuthEmailDelivery(
  kind: AuthEmailKind,
  sendTask: () => Promise<boolean>,
  failureMessage: string,
  context: AuthEmailContext
): Promise<void> {
  const sent = await sendAuthEmail(kind, sendTask, context);
  if (!sent) {
    logger.error('Required auth email was not accepted by the email provider', context);
    throw new ApiError(503, failureMessage);
  }
}

/**
 * Mints a one-time emailed link, mails it, and only then retires the older
 * ones of the same kind.
 *
 * It used to retire the older links first. A mail the provider then refused
 * left the member with no valid link at all: the one she already held was gone
 * and the new one never arrived, while the page told her a new link was on its
 * way. Now a refused mail withdraws only the link it was about, so whatever she
 * held before still works, and a mail that went retires the links before it.
 * "Before it" is by creation time, so two requests that overlap cannot each
 * retire the other's link and leave nothing live.
 *
 * Returns whether the mail was accepted.
 */
async function mailFreshLink(params: {
  account: { id: string; email: string };
  type: 'EMAIL_VERIFICATION' | 'PASSWORD_RESET';
  lifetimeMs: number;
  kind: AuthEmailKind;
  send: (token: string) => Promise<boolean>;
}): Promise<boolean> {
  const { account, type, lifetimeMs, kind, send } = params;
  const token = generateSecureToken();

  const link = await prisma.verificationToken.create({
    data: {
      userId: account.id,
      token: hashOpaqueToken(token),
      type,
      expiresAt: new Date(Date.now() + lifetimeMs),
    },
    select: { id: true, createdAt: true },
  });

  const sent = await sendAuthEmail(kind, () => send(token), { userId: account.id });
  if (sent) {
    await prisma.verificationToken.deleteMany({
      where: { userId: account.id, type, createdAt: { lt: link.createdAt } },
    });
  } else {
    logger.error('An emailed link was not accepted by the email provider and has been withdrawn', {
      userId: account.id,
      kind,
    });
    // Only ever by id: a filter with nothing in it would match every link.
    if (link?.id) {
      await prisma.verificationToken.deleteMany({ where: { id: link.id } });
    }
  }
  return sent;
}

function sendBestEffortAuthEmail(
  label: string,
  sendTask: () => Promise<boolean>,
  context: AuthEmailContext
): void {
  sendTask()
    .then((sent) => {
      if (!sent) {
        logger.warn(`${label} was not accepted by the email provider`, context);
      }
    })
    .catch((error) => logger.error(`${label} failed`, { ...context, error }));
}

function sanitizeName(raw: unknown, fallback = ''): string {
  const sanitized = String(raw ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F\u200B-\u200F\u2028\u2029\uFEFF]/g, '')
    .trim()
    .slice(0, 80);

  return sanitized || fallback;
}

function normalizeOptionalCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim();
  return code ? code : null;
}

function ensureSecureToken(token: unknown, label: string): string {
  if (typeof token !== 'string' || !SECURE_TOKEN_PATTERN.test(token)) {
    throw new ApiError(400, `${label} required`);
  }

  return token;
}

function generateRecoveryCode(): string {
  const bytes = crypto.randomBytes(RECOVERY_CODE_LENGTH);

  // 256 is a whole multiple of the 32-character alphabet, so the modulo is unbiased.
  return Array.from(
    bytes,
    (byte) => RECOVERY_CODE_ALPHABET[byte % RECOVERY_CODE_ALPHABET.length]
  ).join('');
}

function formatRecoveryCode(code: string): string {
  const groups: string[] = [];

  for (let index = 0; index < code.length; index += RECOVERY_CODE_GROUP_LENGTH) {
    groups.push(code.slice(index, index + RECOVERY_CODE_GROUP_LENGTH));
  }

  return groups.join('-');
}

function normalizeRecoveryCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;

  const normalized = raw.replace(/[\s-]/g, '').toUpperCase();
  if (normalized.length !== RECOVERY_CODE_LENGTH) return null;

  return [...normalized].every((char) => RECOVERY_CODE_ALPHABET.includes(char))
    ? normalized
    : null;
}

/**
 * Issues a fresh set and retires whatever the account held before: a reissue
 * has to invalidate the old printout, or a leaked code stays live forever.
 * The plaintext returned here is the only copy the user will ever see.
 */
async function issueRecoveryCodes(userId: string): Promise<string[]> {
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () => generateRecoveryCode());
  const hashes = await Promise.all(codes.map((code) => hashPassword(code)));

  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorRecoveryCodes: { set: hashes } },
  });

  return codes.map(formatRecoveryCode);
}

/**
 * True only when the code matched *and* this call is the one that spent it.
 * The `has` guard makes a second, simultaneous use of the same code lose the
 * race instead of both being honoured.
 */
async function consumeRecoveryCode(
  userId: string,
  storedHashes: string[],
  code: string
): Promise<boolean> {
  for (const hash of storedHashes) {
    if (!(await comparePassword(code, hash))) continue;

    const spent = await prisma.user.updateMany({
      where: { id: userId, twoFactorRecoveryCodes: { has: hash } },
      data: {
        twoFactorRecoveryCodes: {
          set: storedHashes.filter((storedHash) => storedHash !== hash),
        },
      },
    });

    if (spent.count === 0) return false;

    logger.warn('Two-factor recovery code used', {
      userId,
      remaining: storedHashes.length - 1,
    });

    return true;
  }

  return false;
}

/**
 * Accepts either the authenticator code or one recovery code, so a lost
 * authenticator is recoverable rather than terminal.
 */
async function verifySecondFactor(
  user: { id: string; twoFactorSecret: string | null; twoFactorRecoveryCodes: string[] },
  submitted: unknown
): Promise<boolean> {
  const totpCode = normalizeTotpCode(submitted);
  if (totpCode && user.twoFactorSecret && (await verifyAuthenticatorCode(user.id, user.twoFactorSecret, totpCode))) {
    return true;
  }

  const recoveryCode = normalizeRecoveryCode(submitted);
  if (!recoveryCode) return false;

  return consumeRecoveryCode(user.id, user.twoFactorRecoveryCodes, recoveryCode);
}

/**
 * True when the code is right for the account's authenticator *and* has not
 * been accepted before: the step it belongs to is claimed, so the same code
 * read over a shoulder or off a phishing page does not open the account a
 * second time within its window. The stored secret is opened here; a value
 * written before sealing existed is read as it is.
 */
async function verifyAuthenticatorCode(userId: string, storedSecret: string, code: string): Promise<boolean> {
  const secret = openSecret(storedSecret);
  if (!secret) return false;

  const step = matchTotpStep(code, secret);
  if (step === null) return false;

  const firstUse = await claimTotpStep(userId, step);
  if (!firstUse) {
    logger.warn('Two-factor code replayed and refused', { userId });
  }
  return firstUse;
}

// ===========================================
// CREDENTIAL CHECKS BEHIND A SESSION
// ===========================================

/**
 * Changing the password, turning two-factor on or off and minting new recovery
 * codes each ask for the current password or an authenticator code, behind an
 * access token. They answered a wrong one as often as they were asked, under
 * nothing but the general limit of a hundred requests in fifteen minutes and
 * without ever counting a failure. A stolen access token, or a phone left
 * unlocked, could guess the password that protects everything else, and a
 * six-digit code is a million guesses.
 *
 * They now share one failure counter per member, in the same store as the
 * sign-in lockout (Redis, or this process when Redis is away), so five wrong
 * answers across all four routes lock all four for fifteen minutes. It is
 * counted per member and not per address, because whoever holds the token is
 * the one guessing and can change address freely. It is kept apart from the
 * sign-in counter on purpose: whoever holds a session can fail these as often
 * as they like, and that must not be a way to lock the owner out of signing in.
 */
const CREDENTIAL_CHECK_SUBJECT_PREFIX = 'credential-check:';

function credentialCheckSubject(userId: string): string {
  return `${CREDENTIAL_CHECK_SUBJECT_PREFIX}${userId}`;
}

function credentialLockoutError(retryAfterSeconds: number): ApiError {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return new ApiError(429, `Too many incorrect attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`);
}

/** Before any password is compared or code is checked, so a locked member burns no bcrypt cycles. */
async function refuseLockedCredentialChecks(userId: string): Promise<void> {
  const status = await getLockoutStatus(credentialCheckSubject(userId));
  if (status.locked) {
    throw credentialLockoutError(status.retryAfterSeconds);
  }
}

/**
 * Counts a wrong password or code and returns the error to throw: the refusal
 * the route gives, or the lockout's 429 once this was the failure that locked.
 */
async function failedCredentialCheck(userId: string, refusal: ApiError): Promise<ApiError> {
  const status = await recordFailedLogin(credentialCheckSubject(userId));
  return status.locked ? credentialLockoutError(status.retryAfterSeconds) : refusal;
}

async function clearCredentialChecks(userId: string): Promise<void> {
  await clearFailedLogins(credentialCheckSubject(userId));
}

/**
 * The account `authenticate` put on the request. The routes that call this are
 * mounted behind that middleware, so a request with no principal never reaches
 * them; the check is here so the type says so too, with no non-null assertion.
 */
function signedIn(req: AuthRequest) {
  if (!req.user) throw new ApiError(401, 'Authentication required');
  return req.user;
}

/**
 * Asks a signed-in member to prove it is her at the keyboard, for an action a
 * stolen session or an unlocked phone must not be enough for: her password when
 * the account has one, and a live second factor (an authenticator code or an
 * unused recovery code) when two-factor is on. An account that signs in only
 * with Google or Facebook has no password to ask for, so it is asked for the
 * second factor alone, if it has one; that is the same line the two-factor
 * routes above draw.
 *
 * It shares the credential-check failure counter, so guessing here counts
 * against the same five attempts as guessing at the change-password form.
 * Account deletion is the first caller (DELETE /users/me and POST
 * /gdpr/dsar/delete): it cannot be undone, and it is also how someone who had
 * got into an account would destroy the evidence of it.
 */
export async function requireStepUp(
  userId: string,
  answers: { currentPassword?: unknown; code?: unknown }
): Promise<void> {
  await refuseLockedCredentialChecks(userId);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      passwordHash: true,
      twoFactorEnabled: true,
      twoFactorSecret: true,
      twoFactorRecoveryCodes: true,
    },
  });
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  if (user.passwordHash) {
    const currentPassword = typeof answers.currentPassword === 'string' ? answers.currentPassword : '';
    if (!currentPassword) {
      throw new ApiError(400, 'Current password is required');
    }
    // A 403 and not a 401 on purpose. Both web and phone clients answer a 401
    // by refreshing the session and sending the same request again, so a wrong
    // password was tried twice per press: it spent two of the five attempts the
    // credential-check lockout allows, and two of the five requests an hour the
    // erasure limit allows, so a few mistyped passwords locked her out of
    // deleting her own account for an hour. A refusal of a password she was
    // just asked for is not an expired session, and must not read as one.
    if (currentPassword.length > PASSWORD_MAX_LENGTH) {
      throw await failedCredentialCheck(user.id, new ApiError(403, 'Current password is incorrect'));
    }
    if (!(await comparePassword(currentPassword, user.passwordHash))) {
      throw await failedCredentialCheck(user.id, new ApiError(403, 'Current password is incorrect'));
    }
  }

  if (user.twoFactorEnabled) {
    // Not asked yet is not the same as wrong, and is not counted.
    if (typeof answers.code !== 'string' || !answers.code.trim()) {
      throw new ApiError(400, 'Two-factor code is required');
    }
    if (!(await verifySecondFactor(user, answers.code))) {
      throw await failedCredentialCheck(user.id, new ApiError(400, 'Invalid two-factor code'));
    }
  }

  await clearCredentialChecks(user.id);
}

async function fetchWithTimeout(url: string, timeoutMs = 5000): Promise<globalThis.Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function findUsableInviteCode(rawInviteCode: unknown): Promise<InviteCodeRecord | null> {
  const normalizedCode = normalizeOptionalCode(rawInviteCode)?.toUpperCase();
  if (!normalizedCode) return null;

  const inviteRecord = await prisma.inviteCode.findFirst({
    where: {
      code: normalizedCode,
      isActive: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: { id: true, usesCount: true, maxUses: true },
  });

  if (!inviteRecord) {
    throw new ApiError(400, 'Invalid or expired invite code');
  }

  if (inviteRecord.maxUses !== null && inviteRecord.usesCount >= inviteRecord.maxUses) {
    throw new ApiError(400, 'Invite code has reached its usage limit');
  }

  return inviteRecord;
}

async function consumeInviteCode(
  tx: Prisma.TransactionClient | typeof prisma,
  inviteRecord: InviteCodeRecord
): Promise<void> {
  const result = await tx.inviteCode.updateMany({
    where: {
      id: inviteRecord.id,
      isActive: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      ...(inviteRecord.maxUses !== null
        ? { usesCount: { lt: inviteRecord.maxUses } }
        : {}),
    },
    data: {
      usesCount: { increment: 1 },
      lastUsedAt: new Date(),
    },
  });

  if (result.count !== 1) {
    throw new ApiError(400, 'Invite code is no longer available');
  }

  if (inviteRecord.maxUses !== null) {
    await tx.inviteCode.updateMany({
      where: {
        id: inviteRecord.id,
        usesCount: { gte: inviteRecord.maxUses },
      },
      data: { isActive: false },
    });
  }
}

/**
 * What registration says, whether or not the address already has an account.
 *
 * It used to answer 409 "Email already registered" for a taken address, which
 * is a way to ask the platform whether somebody has an account: type a name's
 * address into the form and read the answer. For a woman whose former partner
 * knows her email address, that answer is exactly the information the rest of
 * this router already withholds (forgot-password and resend-verification
 * reply the same way for every address, and so does an employer's team
 * invite). Now a taken address and a free one get the same status and the same
 * body, and the news goes to the inbox, where only its owner can read it.
 *
 * What is equal: the status, the body and the password hashing. What is not
 * claimed to be equal: how long the rest of the work takes, because a new
 * account is written and its mail is awaited so that a failed send is
 * reported to the person who needs the mail. The route sits behind the
 * sign-up limit (ten an hour from one address in production), which is what
 * bounds anyone timing it.
 */
const REGISTRATION_RECEIVED_MESSAGE = 'Registration received. If this address can be used, an email is on its way.';

function answerRegistrationReceived(res: Response): void {
  res.status(201).json({
    success: true,
    message: REGISTRATION_RECEIVED_MESSAGE,
    data: { verificationRequired: true },
  });
}

/**
 * How long an account whose address nobody has proved can hold that address
 * before a new registration for it starts the account over. An hour is long
 * enough for the person who signed up to find the email and click it, and short
 * enough that a typo, or somebody else's registration of an address that is not
 * theirs, cannot sit on it for good.
 */
const UNCONFIRMED_ACCOUNT_GRACE_MS = 60 * 60 * 1000;

type TakenAddressAccount = {
  id: string;
  email: string;
  firstName: string;
  emailVerified: boolean;
  createdAt?: Date;
  lastLoginAt?: Date | null;
  googleId?: string | null;
  facebookId?: string | null;
  isSuspended?: boolean;
  bannedAt?: Date | null;
};

type RegistrationDetails = {
  password: string;
  inviteCode: unknown;
  firstName: string;
  lastName: string;
  persona: Persona;
  dateOfBirth: Date;
};

/**
 * Whether a second registration may touch the account behind this address at
 * all: only one that was never confirmed, never signed in and has no social
 * sign-in on it, and that is not under a suspension or a ban. A confirmed
 * account is its owner's and nothing about it changes.
 */
function mayContest(account: TakenAddressAccount): boolean {
  if (account.emailVerified) return false;
  return !(account.googleId || account.facebookId || account.lastLoginAt || account.isSuspended || account.bannedAt);
}

/**
 * Whether, on top of that, the names and date of birth in the registration
 * replace the ones the account was made with: only once it has been waiting
 * for more than the grace period. A missing creation time says nothing, so it
 * is not enough.
 */
function mayStartOver(account: TakenAddressAccount): boolean {
  if (!mayContest(account)) return false;
  if (!(account.createdAt instanceof Date)) return false;
  return Date.now() - account.createdAt.getTime() >= UNCONFIRMED_ACCOUNT_GRACE_MS;
}

/**
 * A registration for an address that already has an account.
 *
 * For a confirmed account nothing changes: the password in the form is hashed
 * and thrown away, and the owner is told by email, after the reply has gone.
 *
 * An account whose address was never confirmed is sent a fresh confirmation
 * link instead, the same thing the resend route does, because that is what
 * whoever is typing it needs, and an address that nobody has proved is not
 * yet anyone's to be told about. Its password is withdrawn as well. Two people
 * have now typed a password for one address, and the link we send cannot tell
 * which of them will click it: whoever registered an address first used to
 * hold its password, so the real owner, finding the account already there and
 * clicking the link we then sent, confirmed an account that opened with
 * somebody else's password. And the other way round was no better: had the
 * second registration's password been kept, somebody registering her address
 * an hour after her would have held it instead. So neither is kept. Whoever
 * clicks the link has proved the inbox, and chooses the password then
 * (handleVerifyEmailToken hands the page a one-time link for it).
 *
 * If the account is more than an hour old its names and date of birth are
 * started over with this registration's as well, so that a typo, or somebody's
 * registration of an address that was not theirs, does not sit on the address
 * for good. Within the hour they are left alone: the account is probably the
 * same person's, still being confirmed. The creation time moves to now with a
 * restart, so the new registrant also gets a full grace period.
 */
async function answerRegistrationForTakenAddress(
  res: Response,
  existing: TakenAddressAccount,
  details: RegistrationDetails
): Promise<void> {
  // The refusal a new address would meet for a bad invite code, so a wrong
  // code is a 400 for every address and says nothing about this one.
  await findUsableInviteCode(details.inviteCode);
  // The same hashing a new account costs; the result is not kept (see above).
  await hashPassword(details.password);

  let account = existing;
  if (mayContest(existing)) {
    const startOver = mayStartOver(existing);
    // Conditions repeated in the write itself, so an account confirmed or
    // signed in to between the read above and this write is left alone.
    const contested = await prisma.user.updateMany({
      where: {
        id: existing.id,
        emailVerified: false,
        googleId: null,
        facebookId: null,
        lastLoginAt: null,
        isSuspended: false,
        bannedAt: null,
        ...(startOver ? { createdAt: { lte: new Date(Date.now() - UNCONFIRMED_ACCOUNT_GRACE_MS) } } : {}),
      },
      data: {
        passwordHash: null,
        ...(startOver
          ? {
              firstName: details.firstName,
              lastName: details.lastName,
              displayName: `${details.firstName} ${details.lastName}`,
              persona: details.persona,
              dateOfBirth: details.dateOfBirth,
              womanSelfAttested: true,
              createdAt: new Date(),
            }
          : {}),
      },
    });
    if (contested.count > 0) {
      if (startOver) {
        // Nothing should be signed in to an unconfirmed account; this makes sure.
        await prisma.session.deleteMany({ where: { userId: existing.id } });
        logger.info('An unconfirmed account was started over by a new registration for its address', {
          userId: existing.id,
        });
        account = { ...existing, firstName: details.firstName };
      } else {
        logger.info('A second registration for an unconfirmed address withdrew its password', {
          userId: existing.id,
        });
      }
    }
  }

  if (account.emailVerified) {
    sendAfterResponse(
      res,
      async () => {
        const sent = await sendAuthEmail(
          'account_exists',
          () => sendAccountExistsEmail(account.email, account.firstName),
          { userId: account.id }
        );
        if (!sent) {
          logger.error('Account-exists email was not accepted by the email provider', {
            userId: account.id,
          });
        }
      },
      { userId: account.id }
    );
  } else {
    sendFreshVerificationAfterResponse(res, account);
  }

  answerRegistrationReceived(res);
}

function getRefreshTokenCookieBaseOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  const raw = String(process.env.COOKIE_SAMESITE || '').toLowerCase();
  // The browser only ever calls this API through the web app's own route
  // handlers, which is the same site, so Lax holds: the cookie travels on
  // those calls and on nothing a page elsewhere can send. A deployment where
  // the browser calls the API origin directly sets COOKIE_SAMESITE=none.
  const sameSite: 'lax' | 'strict' | 'none' =
    raw === 'none' || raw === 'strict' || raw === 'lax'
      ? (raw as 'lax' | 'strict' | 'none')
      : 'lax';

  // SameSite=None mandates Secure cookies (browser requirement).
  const secure = sameSite === 'none' ? true : isProduction;

  return {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
  };
}

function getRefreshTokenCookieOptions(refreshToken: string) {
  const refreshExpiresIn = getTokenExpiresInSeconds(refreshToken);

  return {
    ...getRefreshTokenCookieBaseOptions(),
    maxAge: (refreshExpiresIn ?? 7 * 24 * 60 * 60) * 1000,
  };
}

function getRefreshTokenClearCookieOptions() {
  return getRefreshTokenCookieBaseOptions();
}

/**
 * The phone apps say so with this header on every call (mobile/src/services/api.ts).
 *
 * A browser keeps its refresh token in an HttpOnly cookie that script cannot
 * read, and the server refuses a refresh that does not come from a trusted
 * origin, because a cookie travels on whatever the browser sends and that is
 * what a cross-site request forgery rides on. A phone app has neither a cookie
 * jar nor an origin: it was handed a refresh token the first time and had no way
 * to read it (the response never carried one), so every expired access token
 * ended in a sign-out. A client that says it is native is handed the token in
 * the response body instead, and presents it in the body of /refresh. Nothing
 * ambient is involved on that path, so there is nothing to forge: the token is
 * the credential, it is single-use, and presenting a retired one still revokes
 * every session. The cookie is never read or set for these requests, so the
 * header cannot be used to lift a browser's cookie into a page.
 */
const NATIVE_CLIENT_HEADER = 'x-athena-client';

function isNativeClient(req: Request): boolean {
  return String(req.headers[NATIVE_CLIENT_HEADER] ?? '').trim().toLowerCase() === 'mobile';
}

/**
 * Gives the new refresh token to whoever just signed in or refreshed: as the
 * HttpOnly cookie for a browser, as the return value (to go in the response
 * body) for a native app.
 */
function deliverRefreshToken(req: Request, res: Response, refreshToken: string): string | undefined {
  if (isNativeClient(req)) return refreshToken;
  res.cookie('refreshToken', refreshToken, getRefreshTokenCookieOptions(refreshToken));
  return undefined;
}

function buildAuthResponseData(
  accessToken: string,
  user?: Record<string, unknown>,
  /** Only ever passed for a native client; a browser's travels in the cookie. */
  refreshToken?: string
) {
  const expiresIn = getTokenExpiresInSeconds(accessToken) ?? 0;

  return {
    ...(user ? { user } : {}),
    accessToken,
    ...(refreshToken ? { refreshToken } : {}),
    expiresIn,
  };
}

function enforceTrustedRefreshCookieRequest(req: Request): void {
  const requestOrigin = getTrustedOriginFromHeaders({
    origin: req.headers.origin,
    referer: req.headers.referer,
  });

  // In production, every refresh request must come from a trusted origin —
  // even when the browser doesn't send the cookie back (helps catch
  // misconfigured proxies that strip cookies but still POST).
  if (process.env.NODE_ENV === 'production') {
    if (!requestOrigin || !isCorsOriginAllowed(requestOrigin)) {
      throw new ApiError(403, 'Cross-site refresh requests are not allowed');
    }
    return;
  }

  // Outside production: only enforce when we have an origin AND a cookie
  // (preserves dev tooling like Postman that may not set Origin/Referer).
  if (req.cookies?.refreshToken && requestOrigin && !isCorsOriginAllowed(requestOrigin)) {
    throw new ApiError(403, 'Cross-site refresh requests are not allowed');
  }
}

async function findVerificationTokenRecord(
  token: string,
  type: 'EMAIL_VERIFICATION' | 'PASSWORD_RESET'
) {
  const hashedToken = hashOpaqueToken(token);

  return (
    await prisma.verificationToken.findFirst({
      where: {
        token: hashedToken,
        type,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    })
  ) || (
    await prisma.verificationToken.findFirst({
      where: {
        token,
        type,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    })
  );
}

async function handleVerifyEmailToken(
  token: string,
  res: Response
) {
  const verificationToken = await findVerificationTokenRecord(
    token,
    'EMAIL_VERIFICATION'
  );

  if (!verificationToken) {
    throw new ApiError(400, 'Invalid or expired verification token');
  }

  // An address that was registered twice before anyone confirmed it has had
  // its password withdrawn (see answerRegistrationForTakenAddress): two people
  // typed one, and this link could not tell which of them would click it. The
  // person who did holds the inbox, which is the proof a forgotten password
  // takes, so she gets the same one-time link a reset gets, handed to the page
  // in front of her rather than mailed, and chooses the password now. Only
  // `null`: a row that was not asked for the column is not read as one with
  // none. An account that signs in with Google or Facebook has no password to
  // choose.
  const { user } = verificationToken;
  const passwordToChoose = user.passwordHash === null && !user.googleId && !user.facebookId;

  await prisma.user.update({
    where: { id: verificationToken.userId },
    data: {
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });

  await prisma.verificationToken.delete({
    where: { id: verificationToken.id },
  });

  let setPasswordToken: string | null = null;
  if (passwordToChoose) {
    setPasswordToken = generateSecureToken();
    const link = await prisma.verificationToken.create({
      data: {
        userId: verificationToken.userId,
        token: hashOpaqueToken(setPasswordToken),
        type: 'PASSWORD_RESET',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour, as a reset link
      },
      select: { id: true },
    });
    // One live link, as forgot-password keeps it.
    await prisma.verificationToken.deleteMany({
      where: { userId: verificationToken.userId, type: 'PASSWORD_RESET', id: { not: link.id } },
    });
  }

  const pendingReferral = await prisma.referral.findFirst({
    where: {
      referredId: verificationToken.userId,
      status: 'PENDING',
    },
  });

  if (pendingReferral) {
    await prisma.$transaction([
      prisma.referral.update({
        where: { id: pendingReferral.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          rewardGranted: true,
        },
      }),
      prisma.user.update({
        where: { id: pendingReferral.referrerId },
        data: { referralCredits: { increment: 100 } },
      }),
      prisma.notification.create({
        data: {
          userId: pendingReferral.referrerId,
          type: 'SYSTEM',
          title: '💰 Referral Complete!',
          message: `${verificationToken.user.firstName} verified their email! You've earned 100 credits.`,
          link: '/dashboard/referrals',
        },
      }),
    ]);
  }

  // Welcome email is best-effort — never block verification on email delivery.
  sendBestEffortAuthEmail(
    'Welcome email after email verification',
    () => sendWelcomeEmail(verificationToken.user.email, verificationToken.user.firstName),
    { userId: verificationToken.userId }
  );

  if (setPasswordToken) {
    res.json({
      success: true,
      message: 'Your email is confirmed. Choose the password you will sign in with to finish.',
      data: { passwordSetupRequired: true, setPasswordToken },
    });
    return;
  }

  res.json({
    success: true,
    message: 'Email verified successfully! Welcome to ATHENA.',
  });
}

// ===========================================
// REGISTER
// ===========================================
router.post(
  '/register',
  [
    body('email').isEmail().isLength({ max: 254 }).normalizeEmail(),
    body('password')
      .isLength({ min: PASSWORD_MIN_LENGTH, max: PASSWORD_MAX_LENGTH })
      .withMessage(`Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters`)
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
    body('firstName').notEmpty().trim().isLength({ max: 80 }),
    body('lastName').notEmpty().trim().isLength({ max: 80 }),
    body('referralCode')
      .optional({ checkFalsy: true })
      .isString()
      .trim()
      .isLength({ min: 4, max: 32 })
      .matches(AUTH_CODE_PATTERN)
      .withMessage('Referral codes can only include letters, numbers, and dashes'),
    // Exactly the boolean true. Left out, null or the string "true" is refused
    // with this sentence: `.isBoolean()` ahead of the check used to answer a
    // missing value with the validator's bare "Invalid value", because a
    // message attaches only to the rule written directly before it.
    body('womanSelfAttested')
      .custom((value) => value === true)
      .withMessage('You must confirm you are a woman to join ATHENA'),
    // Collected here because it cannot be collected later: an account created
    // without a date of birth has no age to check, and the Terms and Privacy
    // Policy both say the platform is for adults and that it verifies this.
    body('dateOfBirth')
      .isISO8601()
      .withMessage(DATE_OF_BIRTH_REFUSAL)
      .bail()
      .custom((value) => acceptableDateOfBirth(value))
      .withMessage(DATE_OF_BIRTH_REFUSAL)
      .toDate(),
    body('inviteCode')
      .optional({ checkFalsy: true })
      .isString()
      .trim()
      .isLength({ min: 4, max: 32 })
      .matches(AUTH_CODE_PATTERN)
      .withMessage('Invite codes can only include letters, numbers, and dashes'),
    body('persona')
      .optional({ checkFalsy: true })
      .customSanitizer((v) => (typeof v === 'string' ? v.trim().toUpperCase() : v))
      .isIn(PERSONA_VALUES),
    body('humanCheckToken').optional().isString().isLength({ max: HUMAN_CHECK_TOKEN_MAX_LENGTH }),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      // Before anything reads the database, so a script that has not passed
      // it cannot even learn which addresses are already registered.
      await requireHumanCheck(req.body?.humanCheckToken, req.ip);

      const rawPersona = req.body?.persona;
      const persona: Persona =
        typeof rawPersona === 'string' && rawPersona.trim()
          ? (rawPersona.trim().toUpperCase() as Persona)
          : Persona.EARLY_CAREER;
      const { email, password, referralCode, womanSelfAttested, inviteCode } = req.body;

      const firstName = sanitizeName(req.body.firstName);
      const lastName = sanitizeName(req.body.lastName);

      if (!firstName || !lastName) {
        throw new ApiError(400, 'First name and last name are required');
      }

      // The validator above already refuses anything but a real true; this is
      // the same rule where the account is made, so a body that reached here
      // another way (an array, an object, a non-empty string) is not an
      // attestation either.
      if (womanSelfAttested !== true) {
        throw new ApiError(400, 'You must confirm you are a woman to join ATHENA');
      }

      // `.toDate()` above has already turned the field into a Date, but a body
      // that reached here another way would otherwise create an account with
      // no age on it, which is the one state the gate cannot recover from.
      const dateOfBirth = req.body.dateOfBirth instanceof Date ? req.body.dateOfBirth : new Date(req.body.dateOfBirth);
      if (!acceptableDateOfBirth(dateOfBirth)) {
        throw new ApiError(400, DATE_OF_BIRTH_REFUSAL);
      }

      // An address that already has an account is answered exactly as a new
      // one is; see answerRegistrationForTakenAddress.
      const existingUser = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          firstName: true,
          emailVerified: true,
          createdAt: true,
          lastLoginAt: true,
          googleId: true,
          facebookId: true,
          isSuspended: true,
          bannedAt: true,
        },
      });
      if (existingUser) {
        await answerRegistrationForTakenAddress(res, existingUser, {
          password,
          inviteCode,
          firstName,
          lastName,
          persona,
          dateOfBirth,
        });
        return;
      }

      // After the check above, so an address that already has an account —
      // banned or not — is answered like any other, and the ban list is only
      // consulted for an address that would otherwise become a new account.
      await refuseUnusableAddress(email);

      // Hash password
      const passwordHash = await hashPassword(password);

      // Generate verification token
      const verificationToken = generateSecureToken();

      // Generate unique referral code for the new user
      const generateReferralCode = (): string => {
        return crypto.randomBytes(8).toString('hex').toUpperCase();
      };
      
      let newUserReferralCode = generateReferralCode();
      let codeAttempts = 0;
      while (codeAttempts < 10) {
        const existingCode = await prisma.user.findUnique({ where: { referralCode: newUserReferralCode } });
        if (!existingCode) break;
        newUserReferralCode = generateReferralCode();
        codeAttempts++;
      }

      // Validate referral code if provided
      let referrerId: string | null = null;
      const normalizedReferralCode = normalizeOptionalCode(referralCode);
      if (normalizedReferralCode) {
        const referrer = await prisma.user.findUnique({
          where: { referralCode: normalizedReferralCode.toUpperCase() },
          select: { id: true },
        });
        if (referrer) {
          referrerId = referrer.id;
        }
      }

      const inviteRecord = await findUsableInviteCode(inviteCode);

      // Create user
      let user;
      try {
        const createUser = async (tx: Prisma.TransactionClient | typeof prisma) => {
          if (inviteRecord) {
            await consumeInviteCode(tx, inviteRecord);
          }

          return tx.user.create({
            data: {
              email,
              passwordHash,
              firstName,
              lastName,
              displayName: `${firstName} ${lastName}`,
              persona,
              womanSelfAttested: true,
              dateOfBirth,
              inviteCodeId: inviteRecord?.id ?? undefined,
              referralCode: newUserReferralCode,
              profile: {
                create: {},
              },
              subscription: {
                create: {
                  tier: 'FREE',
                  status: 'ACTIVE',
                },
              },
            },
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              displayName: true,
              avatar: true,
              role: true,
              persona: true,
              country: true,
              preferredLocale: true,
              preferredCurrency: true,
              timezone: true,
              region: true,
              womanSelfAttested: true,
              womanVerificationStatus: true,
              isPublic: true,
              allowMessages: true,
              createdAt: true,
              updatedAt: true,
              lastLoginAt: true,
              referralCode: true,
              referralCredits: true,
            },
          });
        };

        user = inviteRecord
          ? await prisma.$transaction((tx) => createUser(tx))
          : await createUser(prisma);
      } catch (err) {
        // Race window: two concurrent registrations for the same email both
        // passed the findUnique check, and one of them lost the unique race.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          const target = Array.isArray(err.meta?.target) ? err.meta.target : [];
          if (target.includes('email')) {
            // The other request made the account, so this one gets the answer
            // any taken address gets. It sends nothing: the winner's
            // confirmation email is already on its way to the same inbox.
            answerRegistrationReceived(res);
            return;
          }
          throw new ApiError(409, 'Could not create a unique account code. Please try again.');
        }
        throw err;
      }

      // Store verification token
      await prisma.verificationToken.create({
        data: {
          userId: user.id,
          token: hashOpaqueToken(verificationToken),
          type: 'EMAIL_VERIFICATION',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        },
      });

      // Create referral record if user was referred
      if (referrerId) {
        await prisma.referral.create({
          data: {
            referrerId: referrerId,
            referredId: user.id,
            status: 'PENDING',
            signupSource: 'registration',
          },
        });
        
        // Grant initial credits to referred user (referrer gets credits on completion)
        await prisma.user.update({
          where: { id: user.id },
          data: { referralCredits: { increment: 100 } },
        });

        // Notify the referrer that someone signed up using their code
        await prisma.notification.create({
          data: {
            userId: referrerId,
            type: 'SYSTEM',
            title: '🎉 New Referral!',
            message: `${firstName} ${lastName} just signed up using your referral link! You'll receive 100 credits once they verify their email.`,
            link: '/dashboard/referrals',
          },
        });
      }

      try {
        await requireAuthEmailDelivery(
          'verification',
          () => sendVerificationEmail(email, firstName, verificationToken, INTERACTIVE_DELIVERY),
          'Verification email could not be sent. Please try resending verification later.',
          { userId: user.id }
        );
      } catch (error) {
        // The account and its link exist; only the mail did not go. The code
        // lets the sign-up page offer the resend form in place of a bare
        // error, because resending is exactly what she needs to do next.
        if (error instanceof ApiError && error.statusCode === 503) {
          res.status(503).json({
            success: false,
            message: error.message,
            error: error.message,
            code: VERIFICATION_EMAIL_FAILED,
          });
          return;
        }
        throw error;
      }

      // No account in the body, and no wording that only a new member could be
      // told: a taken address gets this same reply.
      answerRegistrationReceived(res);
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
router.post(
  '/login',
  [
    body('email').isEmail().isLength({ max: 254 }).normalizeEmail(),
    body('password')
      .isString()
      .isLength({ min: 1, max: PASSWORD_MAX_LENGTH })
      .withMessage(`Password must be ${PASSWORD_MAX_LENGTH} characters or fewer`),
    body('twoFactorCode')
      .optional()
      .isString()
      .isLength({ min: 6, max: 32 })
      .withMessage('Two-factor code must be a 6-digit code or a recovery code'),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { email, password } = req.body;
      const ipAddress = req.ip;

      // Account lockout — reject early so we don't leak timing info or burn bcrypt cycles
      // on accounts that have already been flagged. Falls back to allow when Redis is down.
      const lockStatus = await getLockoutStatus(email, ipAddress);
      if (lockStatus.locked) {
        const minutes = Math.max(1, Math.ceil(lockStatus.retryAfterSeconds / 60));
        throw new ApiError(
          429,
          `Too many failed login attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`
        );
      }

      const user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          emailVerified: true,
          passwordHash: true,
          firstName: true,
          lastName: true,
          displayName: true,
          avatar: true,
          role: true,
          persona: true,
          preferredLocale: true,
          preferredCurrency: true,
          timezone: true,
          region: true,
          country: true,
          womanSelfAttested: true,
          womanVerificationStatus: true,
          isPublic: true,
          allowMessages: true,
          isSuspended: true,
          lockedAt: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true,
          referralCode: true,
          referralCredits: true,
          twoFactorEnabled: true,
          twoFactorSecret: true,
          twoFactorEnabledAt: true,
          twoFactorRecoveryCodes: true,
        },
      });

      // Always run bcrypt — constant-time defence against email enumeration.
      const passwordHashToCompare = user?.passwordHash || DUMMY_PASSWORD_HASH;
      const isValidPassword = await comparePassword(password, passwordHashToCompare);

      if (!user || !user.passwordHash || !isValidPassword) {
        const nextLockoutStatus = await recordFailedLogin(email, ipAddress);
        if (nextLockoutStatus.locked) {
          const minutes = Math.max(1, Math.ceil(nextLockoutStatus.retryAfterSeconds / 60));
          throw new ApiError(
            429,
            `Too many failed login attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`
          );
        }
        throw new ApiError(401, 'Invalid email or password');
      }

      if (!user.emailVerified) {
        throw new ApiError(403, EMAIL_NOT_VERIFIED_MESSAGE);
      }

      // Only after the password checks out, so the account's standing is never
      // disclosed to someone who is merely guessing at the address.
      if (user.isSuspended) {
        throw new ApiError(403, SUSPENDED_ACCOUNT_MESSAGE);
      }

      // The member locked it herself (POST /auth/lock). The right password does
      // not open it: whoever has the password is exactly who she locked it
      // against. The emailed link does, and a new one can be asked for.
      if (user.lockedAt) {
        throw new ApiError(403, ACCOUNT_LOCKED_MESSAGE);
      }

      if (user.twoFactorEnabled) {
        const submittedCode =
          typeof req.body.twoFactorCode === 'string' ? req.body.twoFactorCode.trim() : '';

        if (!submittedCode) {
          throw new ApiError(401, 'Two-factor code required');
        }

        if (!(await verifySecondFactor(user, submittedCode))) {
          await recordFailedLogin(email, ipAddress);
          throw new ApiError(401, 'Invalid two-factor code');
        }
      }

      // Successful credentials — clear any tracked failures.
      await clearFailedLogins(email, ipAddress);

      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      const tokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
        persona: user.persona,
      };

      const accessToken = generateAccessToken(tokenPayload);
      const refreshToken = generateRefreshToken(tokenPayload);
      const refreshTokenForBody = deliverRefreshToken(req, res, refreshToken);

      const session = await sessionService.createSession(
        user.id,
        accessToken,
        refreshToken,
        req.headers['user-agent'],
        req.ip
      );
      // After answering: a sign-in from a device this account has not used
      // before tells the owner, so a stolen password is noticed.
      void noteSignIn({ userId: user.id, sessionId: session.id, userAgent: req.headers['user-agent'], ipAddress: req.ip, method: 'password' });

      const {
        passwordHash: _passwordHash,
        twoFactorSecret: _twoFactorSecret,
        twoFactorRecoveryCodes: _twoFactorRecoveryCodes,
        lockedAt: _lockedAt,
        ...userWithoutPassword
      } = user;
      void _passwordHash;
      void _twoFactorSecret;
      void _twoFactorRecoveryCodes;
      void _lockedAt;

      res.json({
        success: true,
        message: 'Login successful',
        data: buildAuthResponseData(
          accessToken,
          userWithoutPassword as Record<string, unknown>,
          refreshTokenForBody
        ),
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// SUSPENSION APPEAL (from the sign-in page)
// ===========================================

/**
 * The one appeal a suspended member can actually send.
 *
 * The help pages offer "Account Suspension" and "Account Ban" appeals, and the
 * appeals API sits behind authenticate — which refuses a suspended account
 * with a 403, as sign-in does. So those appeals could only be filed by people
 * who had not been suspended, and the woman they exist for met a refusal she
 * could do nothing with.
 *
 * Here she proves the account is hers the same way sign-in does, with the
 * address and password she has just typed, and the appeal is filed against
 * that account for a person to decide in the ordinary appeals queue. No
 * session is issued; the account stays suspended until someone decides.
 *
 * A wrong password counts against the same lockout as a failed sign-in, so
 * this is not a second door for guessing. The account's standing is disclosed
 * only after the password checks out, exactly as sign-in discloses it, and an
 * account that is not suspended is told to sign in instead. One appeal waits
 * at a time: a second press while the first is with a reviewer is a 409, not
 * a second row.
 */
const suspensionAppealLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 5 : 100,
  message: { success: false, message: 'Too many appeal attempts from here. Please try again in an hour.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  store: new SharedRateLimitStore('rl:suspension-appeal:'),
});
const suspensionAppealLimit = (req: Request, res: Response, next: NextFunction) =>
  socialAuthLimitEnabled ? suspensionAppealLimiter(req, res, next) : next();

router.post(
  '/suspension-appeal',
  suspensionAppealLimit,
  [
    body('email').isEmail().isLength({ max: 254 }).normalizeEmail(),
    body('password')
      .isString()
      .isLength({ min: 1, max: PASSWORD_MAX_LENGTH })
      .withMessage(`Password must be ${PASSWORD_MAX_LENGTH} characters or fewer`),
    body('reason')
      .isString()
      .trim()
      .isLength({ min: 10, max: 5000 })
      .withMessage('Tell the reviewer what happened in at least a sentence, and no more than 5000 characters'),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { email, password } = req.body as { email: string; password: string };
      const reason = String(req.body.reason).trim();
      const ipAddress = req.ip;

      const lockStatus = await getLockoutStatus(email, ipAddress);
      if (lockStatus.locked) {
        const minutes = Math.max(1, Math.ceil(lockStatus.retryAfterSeconds / 60));
        throw new ApiError(429, `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`);
      }

      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, passwordHash: true, isSuspended: true },
      });

      // Always run bcrypt, as sign-in does, so the answer takes as long for an
      // address that has no account as for one that does.
      const isValidPassword = await comparePassword(password, user?.passwordHash || DUMMY_PASSWORD_HASH);
      if (!user || !user.passwordHash || !isValidPassword) {
        await recordFailedLogin(email, ipAddress);
        throw new ApiError(401, 'Invalid email or password');
      }
      await clearFailedLogins(email, ipAddress);

      if (!user.isSuspended) {
        throw new ApiError(409, 'This account is not suspended. Sign in, and appeal anything else from Help.');
      }

      const waiting = await prisma.appeal.findFirst({
        where: { userId: user.id, type: 'ACCOUNT_SUSPENSION', status: 'PENDING' },
        select: { id: true },
      });
      if (waiting) {
        throw new ApiError(409, 'Your appeal is already with a reviewer. If the suspension is lifted, you will be able to sign in again.');
      }

      const appeal = await prisma.appeal.create({
        data: {
          userId: user.id,
          type: 'ACCOUNT_SUSPENSION',
          reason,
          status: 'PENDING',
          metadata: { submittedFrom: 'sign-in' },
        },
        select: { id: true, status: true, createdAt: true },
      });

      await bestEffort(
        'suspension appeal audit row',
        logAudit({
          action: AuditAction.USER_APPEAL_SUBMIT,
          actorUserId: user.id,
          targetUserId: user.id,
          ipAddress: req.ip ?? null,
          userAgent: req.get('user-agent') || null,
          metadata: { appealId: appeal.id, type: 'ACCOUNT_SUSPENSION', submittedFrom: 'sign-in' },
        })
      );
      // The queue is where it is decided; this only tells staff it is there.
      // No name travels in the notification.
      await bestEffort(
        'suspension appeal admin notification',
        notifyAdmins({
          title: 'A suspended member has appealed',
          message: 'An appeal against an account suspension is waiting in the appeals queue.',
          link: '/admin/appeals',
          data: { kind: 'APPEAL', appealId: appeal.id, type: 'ACCOUNT_SUSPENSION' },
        })
      );

      res.status(201).json({
        success: true,
        message: 'Your appeal has been sent and a person will look at it. If the suspension is lifted, you will be able to sign in again.',
        data: appeal,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// GOOGLE AUTH
// ===========================================
router.post(
  '/google',
  socialAuthLimit,
  [
    body('credential').optional().isString().isLength({ min: 1, max: EXTERNAL_AUTH_TOKEN_MAX_LENGTH }),
    body('idToken').optional().isString().isLength({ min: 1, max: EXTERNAL_AUTH_TOKEN_MAX_LENGTH }),
    body().custom((value) => {
      if (!value?.credential && !value?.idToken) {
        throw new Error('Google credential required');
      }
      return true;
    }),
    body('mode').optional().isIn(['login', 'register']),
    body('womanSelfAttested').optional().isBoolean(),
    // The member's second factor, sent again with the same credential once she
    // has been asked for it. See requireSocialSecondFactor.
    body('twoFactorCode')
      .optional()
      .isString()
      .isLength({ min: 6, max: 32 })
      .withMessage('Two-factor code must be a 6-digit code or a recovery code'),
    // Optional at the validator because a returning member sends none; the
    // branch that creates a new account insists on it below. Google does not
    // return a birthday in the identity token, so it has to come from the form.
    body('dateOfBirth').optional({ checkFalsy: true }).isISO8601().withMessage(DATE_OF_BIRTH_REFUSAL),
    body('inviteCode')
      .optional({ checkFalsy: true })
      .isString()
      .trim()
      .isLength({ min: 4, max: 32 })
      .matches(AUTH_CODE_PATTERN)
      .withMessage('Invite codes can only include letters, numbers, and dashes'),
    body('persona')
      .optional({ checkFalsy: true })
      .customSanitizer((v) => (typeof v === 'string' ? v.trim().toUpperCase() : v))
      .isIn(PERSONA_VALUES),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim();
      if (!googleClientId) {
        throw new ApiError(503, 'Google sign-in is not configured');
      }

      const googleIdentityToken = String(req.body.credential || req.body.idToken);
      const googleResponse = await fetchWithTimeout(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(googleIdentityToken)}`
      );

      if (!googleResponse.ok) {
        throw new ApiError(401, 'Invalid Google credential');
      }

      const googleProfile = (await googleResponse.json()) as {
        sub?: string;
        aud?: string;
        email?: string;
        email_verified?: string | boolean;
        given_name?: string;
        family_name?: string;
        name?: string;
        picture?: string;
      };

      const emailVerified =
        googleProfile.email_verified === true || googleProfile.email_verified === 'true';

      if (googleProfile.aud !== googleClientId) {
        throw new ApiError(401, 'Google credential audience mismatch');
      }

      if (!googleProfile.sub || !googleProfile.email || !emailVerified) {
        throw new ApiError(400, 'Google account email must be verified');
      }

      const mode = req.body?.mode === 'register' ? 'register' : 'login';
      const email = String(googleProfile.email).trim().toLowerCase();
      const profileName = (googleProfile.name || '').trim();
      const nameParts = profileName.split(/\s+/).filter(Boolean);
      const firstName = sanitizeName(googleProfile.given_name || nameParts[0], 'ATHENA');
      const lastName = sanitizeName(googleProfile.family_name || nameParts.slice(1).join(' '), 'Member');
      const displayName = sanitizeName(profileName, `${firstName} ${lastName}`.trim());
      const rawPersona = req.body?.persona;
      const persona: Persona =
        typeof rawPersona === 'string' && rawPersona.trim()
          ? (rawPersona.trim().toUpperCase() as Persona)
          : Persona.EARLY_CAREER;

      const selectUser = {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        displayName: true,
        avatar: true,
        role: true,
        persona: true,
        preferredLocale: true,
        preferredCurrency: true,
        timezone: true,
        region: true,
        referralCode: true,
        referralCredits: true,
        womanSelfAttested: true,
        womanVerificationStatus: true,
        country: true,
        isPublic: true,
        allowMessages: true,
        isSuspended: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        twoFactorEnabled: true,
      } as const;

      // Typed lookups: the provider id is in the schema, so nothing here needs
      // raw SQL, and the account a Google id is linked to wins over whichever
      // account happens to hold the same address.
      const accountLookup = {
        ...selectUser,
        emailVerified: true,
        emailVerifiedAt: true,
        googleId: true,
        passwordHash: true,
        lockedAt: true,
        // Only to check a second factor with; never part of what is returned.
        twoFactorSecret: true,
        twoFactorRecoveryCodes: true,
      } as const;
      const linkedGoogleUser = await prisma.user.findUnique({
        where: { googleId: googleProfile.sub },
        select: accountLookup,
      });
      const existingEmailUser = linkedGoogleUser
        ? null
        : await prisma.user.findUnique({ where: { email }, select: accountLookup });

      let user:
        | {
            id: string;
            email: string;
            firstName: string;
            lastName: string;
            displayName: string | null;
            avatar: string | null;
            role: UserRole;
            persona: Persona;
            preferredLocale: string;
            preferredCurrency: string;
            timezone: string;
            region: Region;
            referralCode: string | null;
            referralCredits: number;
            womanSelfAttested: boolean;
            womanVerificationStatus: WomanVerificationStatus;
            country: string;
            isPublic: boolean;
            allowMessages: boolean;
            isSuspended: boolean;
            createdAt: Date;
            updatedAt: Date;
            lastLoginAt: Date | null;
            twoFactorEnabled: boolean;
          }
        | null = null;
      let created = false;
      let secondFactorChecked = false;

      const existingAccount = linkedGoogleUser ?? existingEmailUser;

      if (existingAccount) {
        // Every refusal before any write. See refuseSocialSignIn.
        refuseSocialSignIn(existingAccount);
        secondFactorChecked = await requireSocialSecondFactor(req, existingAccount);

        const linking = !linkedGoogleUser;
        if (linking && existingAccount.googleId && existingAccount.googleId !== googleProfile.sub) {
          throw new ApiError(409, 'This ATHENA account is already linked to a different Google account.');
        }

        // An address nobody ever proved they own can carry a password chosen
        // by someone else: register her address first, wait for her to arrive
        // through Google, and the password opens the account she has just
        // made real. Google has proved the address is hers, so a password set
        // before anyone proved it goes; she can set her own from the reset
        // page.
        const clearUnprovenPassword = linking && !existingAccount.emailVerified && Boolean(existingAccount.passwordHash);
        // Google vouches for its own address. On an account linked earlier
        // whose address has since changed, that is not the address on file.
        const googleVouchesForAddress = existingAccount.email === email;

        try {
          user = await prisma.user.update({
            where: { id: existingAccount.id },
            data: {
              ...(linking ? { googleId: googleProfile.sub } : {}),
              ...(clearUnprovenPassword ? { passwordHash: null } : {}),
              ...(googleVouchesForAddress
                ? { emailVerified: true, emailVerifiedAt: existingAccount.emailVerifiedAt ?? new Date() }
                : {}),
              lastLoginAt: new Date(),
              avatar: existingAccount.avatar || googleProfile.picture || undefined,
            },
            select: selectUser,
          });
        } catch (error) {
          throw socialAccountConflict(error, 'Google') ?? error;
        }

        if (linking) {
          await recordSignInProviderLinked(req, existingAccount.id, 'Google', clearUnprovenPassword);
        }
      } else {
        if (mode !== 'register') {
          throw new ApiError(404, 'No ATHENA account exists for this Google email. Please create an account first.');
        }

        // Before anything else about the new account is weighed; see
        // refuseUnusableAddress.
        await refuseUnusableAddress(email);

        if (req.body?.womanSelfAttested !== true) {
          throw new ApiError(400, 'You must confirm you are a woman to join ATHENA');
        }

        // Refused for the same reason the attestation is: an account created
        // without a date of birth can never be age-checked afterwards, and a
        // sign-up through Google is still a sign-up.
        if (!acceptableDateOfBirth(req.body?.dateOfBirth)) {
          throw new ApiError(400, DATE_OF_BIRTH_REFUSAL);
        }
        const googleDateOfBirth = new Date(req.body.dateOfBirth);

        const inviteRecord = await findUsableInviteCode(req.body?.inviteCode);

        const generateReferralCode = (): string => crypto.randomBytes(8).toString('hex').toUpperCase();
        let referralCode = generateReferralCode();
        let codeAttempts = 0;
        while (codeAttempts < 10) {
          const existingCode = await prisma.user.findUnique({ where: { referralCode } });
          if (!existingCode) break;
          referralCode = generateReferralCode();
          codeAttempts += 1;
        }

        const createSocialUser = async (tx: Prisma.TransactionClient | typeof prisma) => {
          if (inviteRecord) {
            await consumeInviteCode(tx, inviteRecord);
          }

          return tx.user.create({
            data: {
              email,
              // Written with the account rather than by a second raw UPDATE
              // afterwards, so an account never exists without the link that
              // created it, and a collision is a P2002 like any other.
              googleId: googleProfile.sub,
              firstName,
              lastName,
              displayName,
              avatar: googleProfile.picture || undefined,
              persona,
              womanSelfAttested: true,
              dateOfBirth: googleDateOfBirth,
              emailVerified: true,
              emailVerifiedAt: new Date(),
              lastLoginAt: new Date(),
              inviteCodeId: inviteRecord?.id ?? undefined,
              referralCode,
              profile: {
                create: {},
              },
              subscription: {
                create: {
                  tier: 'FREE',
                  status: 'ACTIVE',
                },
              },
            },
            select: selectUser,
          });
        };

        try {
          user = inviteRecord
            ? await prisma.$transaction((tx) => createSocialUser(tx))
            : await createSocialUser(prisma);
        } catch (error) {
          throw socialAccountConflict(error, 'Google') ?? error;
        }

        sendBestEffortAuthEmail(
          'Welcome email after Google sign-up',
          () => sendWelcomeEmail(email, firstName),
          { userId: user.id }
        );

        created = true;
      }

      if (!user) {
        throw new ApiError(500, 'Google sign-in failed');
      }

      if (user.isSuspended) {
        throw new ApiError(403, SUSPENDED_ACCOUNT_MESSAGE);
      }

      // The code was checked before anything was written. A returning account
      // that has two-factor on and got here some other way is refused, not
      // trusted: nothing but a checked code opens a protected account.
      if (!created && user.twoFactorEnabled && !secondFactorChecked) {
        throw new ApiError(401, 'Two-factor code required');
      }

      const tokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
        persona: user.persona,
      };

      const accessToken = generateAccessToken(tokenPayload);
      const refreshToken = generateRefreshToken(tokenPayload);
      const refreshTokenForBody = deliverRefreshToken(req, res, refreshToken);

      const googleSession = await sessionService.createSession(
        user.id,
        accessToken,
        refreshToken,
        req.headers['user-agent'],
        req.ip
      );
      if (!created) {
        void noteSignIn({ userId: user.id, sessionId: googleSession.id, userAgent: req.headers['user-agent'], ipAddress: req.ip, method: 'Google' });
      }

      res.status(created ? 201 : 200).json({
        success: true,
        message: created ? 'Google sign-up successful' : 'Google sign-in successful',
        data: buildAuthResponseData(accessToken, user as Record<string, unknown>, refreshTokenForBody),
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// FACEBOOK AUTH
// ===========================================
router.post(
  '/facebook',
  socialAuthLimit,
  [
    body('accessToken').isString().isLength({ min: 1, max: EXTERNAL_AUTH_TOKEN_MAX_LENGTH }),
    body('mode').optional().isIn(['login', 'register']),
    body('womanSelfAttested').optional().isBoolean(),
    // See the Google route and requireSocialSecondFactor.
    body('twoFactorCode')
      .optional()
      .isString()
      .isLength({ min: 6, max: 32 })
      .withMessage('Two-factor code must be a 6-digit code or a recovery code'),
    // Same reasoning as the Google route: optional at the validator because a
    // returning member sends none, insisted on below where an account is made.
    body('dateOfBirth').optional({ checkFalsy: true }).isISO8601().withMessage(DATE_OF_BIRTH_REFUSAL),
    body('inviteCode')
      .optional({ checkFalsy: true })
      .isString()
      .trim()
      .isLength({ min: 4, max: 32 })
      .matches(AUTH_CODE_PATTERN)
      .withMessage('Invite codes can only include letters, numbers, and dashes'),
    body('persona')
      .optional({ checkFalsy: true })
      .customSanitizer((v) => (typeof v === 'string' ? v.trim().toUpperCase() : v))
      .isIn(PERSONA_VALUES),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const facebookAppId = process.env.FACEBOOK_APP_ID?.trim();
      const facebookAppSecret = process.env.FACEBOOK_APP_SECRET?.trim();
      if (!facebookAppId || !facebookAppSecret) {
        throw new ApiError(503, 'Facebook sign-in is not configured');
      }

      const userAccessToken = String(req.body.accessToken);
      const appAccessToken = `${facebookAppId}|${facebookAppSecret}`;

      // Verify token with Facebook's debug_token endpoint to confirm it belongs to our app.
      const debugResp = await fetchWithTimeout(
        `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(userAccessToken)}&access_token=${encodeURIComponent(appAccessToken)}`
      );
      if (!debugResp.ok) {
        throw new ApiError(401, 'Invalid Facebook credential');
      }
      const debugPayload = (await debugResp.json()) as {
        data?: { app_id?: string; is_valid?: boolean; user_id?: string; expires_at?: number };
      };
      const debugData = debugPayload.data;
      if (!debugData || debugData.is_valid !== true) {
        throw new ApiError(401, 'Invalid or expired Facebook token');
      }
      if (debugData.app_id !== facebookAppId) {
        throw new ApiError(401, 'Facebook credential app mismatch');
      }
      if (!debugData.user_id) {
        throw new ApiError(401, 'Facebook credential missing user id');
      }

      // Fetch basic profile.
      const meResp = await fetchWithTimeout(
        `https://graph.facebook.com/v19.0/me?fields=${encodeURIComponent('id,email,first_name,last_name,name,picture.type(large)')}&access_token=${encodeURIComponent(userAccessToken)}`
      );
      if (!meResp.ok) {
        throw new ApiError(401, 'Unable to read Facebook profile');
      }
      const fbProfile = (await meResp.json()) as {
        id?: string;
        email?: string;
        first_name?: string;
        last_name?: string;
        name?: string;
        picture?: { data?: { url?: string } };
      };

      if (!fbProfile.id || fbProfile.id !== debugData.user_id) {
        throw new ApiError(401, 'Facebook profile mismatch');
      }
      if (!fbProfile.email) {
        throw new ApiError(400, 'Facebook account must share an email to join ATHENA');
      }

      const fbMode = req.body?.mode === 'register' ? 'register' : 'login';
      const fbEmail = String(fbProfile.email).trim().toLowerCase();
      const fbProfileName = (fbProfile.name || '').trim();
      const fbNameParts = fbProfileName.split(/\s+/).filter(Boolean);
      const fbFirstName = sanitizeName(fbProfile.first_name || fbNameParts[0], 'ATHENA');
      const fbLastName = sanitizeName(fbProfile.last_name || fbNameParts.slice(1).join(' '), 'Member');
      const fbDisplayName = sanitizeName(fbProfileName, `${fbFirstName} ${fbLastName}`.trim());
      const fbAvatarUrl = fbProfile.picture?.data?.url;
      const fbRawPersona = req.body?.persona;
      const fbPersona: Persona =
        typeof fbRawPersona === 'string' && fbRawPersona.trim()
          ? (fbRawPersona.trim().toUpperCase() as Persona)
          : Persona.EARLY_CAREER;

      const fbSelectUser = {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        displayName: true,
        avatar: true,
        role: true,
        persona: true,
        preferredLocale: true,
        preferredCurrency: true,
        timezone: true,
        region: true,
        referralCode: true,
        referralCredits: true,
        womanSelfAttested: true,
        womanVerificationStatus: true,
        country: true,
        isPublic: true,
        allowMessages: true,
        isSuspended: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        twoFactorEnabled: true,
      } as const;

      // The same typed lookups as the Google route, for the same reasons.
      const fbAccountLookup = {
        ...fbSelectUser,
        emailVerified: true,
        emailVerifiedAt: true,
        facebookId: true,
        passwordHash: true,
        lockedAt: true,
        // Only to check a second factor with; never part of what is returned.
        twoFactorSecret: true,
        twoFactorRecoveryCodes: true,
      } as const;
      const linkedFbUser = await prisma.user.findUnique({
        where: { facebookId: fbProfile.id },
        select: fbAccountLookup,
      });
      const existingFbEmailUser = linkedFbUser
        ? null
        : await prisma.user.findUnique({ where: { email: fbEmail }, select: fbAccountLookup });

      let fbUser:
        | {
            id: string;
            email: string;
            firstName: string;
            lastName: string;
            displayName: string | null;
            avatar: string | null;
            role: UserRole;
            persona: Persona;
            preferredLocale: string;
            preferredCurrency: string;
            timezone: string;
            region: Region;
            referralCode: string | null;
            referralCredits: number;
            womanSelfAttested: boolean;
            womanVerificationStatus: WomanVerificationStatus;
            country: string;
            isPublic: boolean;
            allowMessages: boolean;
            isSuspended: boolean;
            createdAt: Date;
            updatedAt: Date;
            lastLoginAt: Date | null;
            twoFactorEnabled: boolean;
          }
        | null = null;
      let fbCreated = false;
      let fbSecondFactorChecked = false;

      const existingFbAccount = linkedFbUser ?? existingFbEmailUser;

      if (existingFbAccount) {
        // Every refusal before any write. See refuseSocialSignIn.
        refuseSocialSignIn(existingFbAccount);
        fbSecondFactorChecked = await requireSocialSecondFactor(req, existingFbAccount);

        const fbLinking = !linkedFbUser;
        if (fbLinking && existingFbAccount.facebookId && existingFbAccount.facebookId !== fbProfile.id) {
          throw new ApiError(409, 'This ATHENA account is already linked to a different Facebook account.');
        }

        // See the Google route: a password set on an address nobody had
        // proved was theirs does not survive the owner arriving.
        const fbClearUnprovenPassword =
          fbLinking && !existingFbAccount.emailVerified && Boolean(existingFbAccount.passwordHash);
        const facebookVouchesForAddress = existingFbAccount.email === fbEmail;

        try {
          fbUser = await prisma.user.update({
            where: { id: existingFbAccount.id },
            data: {
              ...(fbLinking ? { facebookId: fbProfile.id } : {}),
              ...(fbClearUnprovenPassword ? { passwordHash: null } : {}),
              ...(facebookVouchesForAddress
                ? { emailVerified: true, emailVerifiedAt: existingFbAccount.emailVerifiedAt ?? new Date() }
                : {}),
              lastLoginAt: new Date(),
              avatar: existingFbAccount.avatar || fbAvatarUrl || undefined,
            },
            select: fbSelectUser,
          });
        } catch (error) {
          throw socialAccountConflict(error, 'Facebook') ?? error;
        }

        if (fbLinking) {
          await recordSignInProviderLinked(req, existingFbAccount.id, 'Facebook', fbClearUnprovenPassword);
        }
      } else {
        if (fbMode !== 'register') {
          throw new ApiError(404, 'No ATHENA account exists for this Facebook email. Please create an account first.');
        }

        // As on the Google route; see refuseUnusableAddress.
        await refuseUnusableAddress(fbEmail);

        if (req.body?.womanSelfAttested !== true) {
          throw new ApiError(400, 'You must confirm you are a woman to join ATHENA');
        }

        // Facebook's Graph profile does not carry a usable birthday for most
        // accounts, so the form supplies it and no account is created without one.
        if (!acceptableDateOfBirth(req.body?.dateOfBirth)) {
          throw new ApiError(400, DATE_OF_BIRTH_REFUSAL);
        }
        const fbDateOfBirth = new Date(req.body.dateOfBirth);

        const fbInviteRecord = await findUsableInviteCode(req.body?.inviteCode);

        const fbGenerateReferralCode = (): string => crypto.randomBytes(8).toString('hex').toUpperCase();
        let fbReferralCode = fbGenerateReferralCode();
        let fbCodeAttempts = 0;
        while (fbCodeAttempts < 10) {
          const existingCode = await prisma.user.findUnique({ where: { referralCode: fbReferralCode } });
          if (!existingCode) break;
          fbReferralCode = fbGenerateReferralCode();
          fbCodeAttempts += 1;
        }

        const createFacebookUser = async (tx: Prisma.TransactionClient | typeof prisma) => {
          if (fbInviteRecord) {
            await consumeInviteCode(tx, fbInviteRecord);
          }

          return tx.user.create({
            data: {
              email: fbEmail,
              facebookId: fbProfile.id,
              firstName: fbFirstName,
              lastName: fbLastName,
              displayName: fbDisplayName,
              avatar: fbAvatarUrl || undefined,
              persona: fbPersona,
              womanSelfAttested: true,
              dateOfBirth: fbDateOfBirth,
              emailVerified: true,
              emailVerifiedAt: new Date(),
              lastLoginAt: new Date(),
              inviteCodeId: fbInviteRecord?.id ?? undefined,
              referralCode: fbReferralCode,
              profile: { create: {} },
              subscription: { create: { tier: 'FREE', status: 'ACTIVE' } },
            },
            select: fbSelectUser,
          });
        };

        try {
          fbUser = fbInviteRecord
            ? await prisma.$transaction((tx) => createFacebookUser(tx))
            : await createFacebookUser(prisma);
        } catch (error) {
          throw socialAccountConflict(error, 'Facebook') ?? error;
        }

        sendBestEffortAuthEmail(
          'Welcome email after Facebook sign-up',
          () => sendWelcomeEmail(fbEmail, fbFirstName),
          { userId: fbUser.id }
        );

        fbCreated = true;
      }

      if (!fbUser) {
        throw new ApiError(500, 'Facebook sign-in failed');
      }

      if (fbUser.isSuspended) {
        throw new ApiError(403, SUSPENDED_ACCOUNT_MESSAGE);
      }

      if (!fbCreated && fbUser.twoFactorEnabled && !fbSecondFactorChecked) {
        throw new ApiError(401, 'Two-factor code required');
      }

      const fbTokenPayload = {
        userId: fbUser.id,
        email: fbUser.email,
        role: fbUser.role,
        persona: fbUser.persona,
      };

      const fbAccessTokenJwt = generateAccessToken(fbTokenPayload);
      const fbRefreshToken = generateRefreshToken(fbTokenPayload);
      const fbRefreshTokenForBody = deliverRefreshToken(req, res, fbRefreshToken);

      const fbSession = await sessionService.createSession(
        fbUser.id,
        fbAccessTokenJwt,
        fbRefreshToken,
        req.headers['user-agent'],
        req.ip
      );
      if (!fbCreated) {
        void noteSignIn({ userId: fbUser.id, sessionId: fbSession.id, userAgent: req.headers['user-agent'], ipAddress: req.ip, method: 'Facebook' });
      }

      res.status(fbCreated ? 201 : 200).json({
        success: true,
        message: fbCreated ? 'Facebook sign-up successful' : 'Facebook sign-in successful',
        data: buildAuthResponseData(fbAccessTokenJwt, fbUser as Record<string, unknown>, fbRefreshTokenForBody),
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// REFRESH TOKEN
// ===========================================
/** The machine-readable word on the 409 for a refresh that lost a race with another one. */
const REFRESH_IN_PROGRESS = 'REFRESH_IN_PROGRESS';

/**
 * Said when the token in hand was rotated a moment ago by another request of
 * the same device (a second tab, or a retry after a dropped connection). It is
 * not a refusal of the member and nothing about her sessions has changed: the
 * winning request has already issued the new pair, so asking again with it
 * works. Answered 409, not 401, because a client that signs out on every 401
 * would otherwise sign her out of a session that is perfectly fine.
 */
function refreshInProgressResponse(res: Response): void {
  const message = 'Your session was just refreshed by another request. Please try again.';
  res.status(409).json({ success: false, message, error: message, code: REFRESH_IN_PROGRESS });
}

// validated: the only field read is refreshToken, as text; it is verified as a signed refresh token
//   and matched to a live session before it is used.
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const native = isNativeClient(req);

    // A browser's refresh token is a cookie, an ambient credential that rides
    // on whatever request the browser sends, so a browser refresh has to come
    // from a trusted origin. A native app sends no cookie and no origin and
    // has nothing ambient to forge (see NATIVE_CLIENT_HEADER), so the rule has
    // nothing to protect there.
    if (!native) {
      enforceTrustedRefreshCookieRequest(req);
    }

    // A browser refreshes from its cookie only: a token in the body of a
    // browser request is a CSRF channel. (Outside production the body is
    // accepted too so test tooling keeps working.) A native client sends its
    // token in the body, and never has a cookie to read.
    const bodyToken = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : undefined;
    const refreshToken = native
      ? bodyToken
      : req.cookies?.refreshToken || (process.env.NODE_ENV !== 'production' ? bodyToken : undefined);

    if (!refreshToken) {
      throw new ApiError(400, 'Refresh token required');
    }

    // Verify refresh token: the signature, the expiry, and that it is a
    // refresh token rather than an access token wearing the same key. An
    // expired, forged or wrong-kind token is a signed-out visitor, and is
    // answered as one: it used to escape as an unhandled JsonWebTokenError and
    // come back as a 500 that went to Sentry, which every returning member
    // with a week-old cookie caused.
    let decoded: ReturnType<typeof verifyToken>;
    try {
      decoded = verifyToken(refreshToken, 'refresh');
    } catch (error) {
      if (!(error instanceof jwt.JsonWebTokenError)) throw error;
      res.clearCookie('refreshToken', getRefreshTokenClearCookieOptions());
      throw new ApiError(401, 'Invalid refresh token');
    }

    // Find session
    const session = await sessionService.findActiveSessionByRefreshToken(refreshToken);

    if (!session || session.userId !== decoded.userId) {
      // If this token previously belonged to a *revoked* session, it's a
      // replay of a rotated token. Moments after the rotation, from the same
      // device, that is a second tab or a retry and nothing is revoked; any
      // other time it is treated as a compromise and every session for that
      // user is burned.
      const replay = await sessionService.detectRefreshTokenReuse(refreshToken, {
        userAgent: req.headers['user-agent'],
      });
      if (replay.kind === 'concurrent') {
        // The cookie is left alone: the request that won has already put the
        // new one in the browser, and clearing it here would undo that.
        refreshInProgressResponse(res);
        return;
      }
      if (replay.kind === 'reuse') {
        res.clearCookie('refreshToken', getRefreshTokenClearCookieOptions());
      }
      throw new ApiError(401, 'Invalid refresh token');
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        role: true,
        persona: true,
        isSuspended: true,
        bannedAt: true,
        lockedAt: true,
        emailVerified: true,
      },
    });

    if (!user) {
      throw new ApiError(401, 'User not found');
    }

    // A suspension or a ban must end the session rather than be renewed
    // through it. A ban is its own column, and either one closes the account.
    if (user.isSuspended || user.bannedAt) {
      await sessionService.revokeAllUserSessions(user.id, { reason: user.bannedAt ? 'banned' : 'suspended' });
      res.clearCookie('refreshToken', getRefreshTokenClearCookieOptions());
      throw new ApiError(403, SUSPENDED_ACCOUNT_MESSAGE);
    }

    // She locked the account herself: no session is renewed through the lock,
    // and whatever is still open is ended.
    if (user.lockedAt) {
      await sessionService.revokeAllUserSessions(user.id, { reason: 'locked' });
      res.clearCookie('refreshToken', getRefreshTokenClearCookieOptions());
      throw new ApiError(403, ACCOUNT_LOCKED_MESSAGE);
    }

    // An address that is no longer confirmed (an admin un-confirmed it) does
    // not renew a session either; sign-in would refuse it, so refreshing must.
    // Only an explicit false counts.
    if (user.emailVerified === false) {
      await sessionService.revokeAllUserSessions(user.id, { reason: 'revoked' });
      res.clearCookie('refreshToken', getRefreshTokenClearCookieOptions());
      throw new ApiError(403, EMAIL_NOT_VERIFIED_MESSAGE);
    }

    // Generate new tokens
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      persona: user.persona,
    };

    const newAccessToken = generateAccessToken(tokenPayload);
    const newRefreshToken = generateRefreshToken(tokenPayload);

    // Rotate tokens using session service (revokes old, creates new)
    try {
      await sessionService.rotateRefreshToken(
        refreshToken,
        newAccessToken,
        newRefreshToken,
        req.headers['user-agent'],
        req.ip
      );
    } catch (err: any) {
      // Two requests held the same token and the other one won. The session
      // is fine and so is she; the loser asks again.
      if (err instanceof RefreshConflictError) {
        refreshInProgressResponse(res);
        return;
      }
      logger.error('Failed to rotate refresh token', { error: err?.message || err, stack: err?.stack });
      return next(err);
    }

    // The rotated refresh token: the cookie for a browser, the body for a
    // native app.
    const refreshTokenForBody = deliverRefreshToken(req, res, newRefreshToken);

    res.json({
      success: true,
      data: buildAuthResponseData(newAccessToken, undefined, refreshTokenForBody),
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// LOGOUT
// ===========================================
router.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : undefined;
    const refreshToken = req.cookies?.refreshToken;

    // Best-effort revoke — try the access-token session first, then fall
    // back to the refresh-token session. Either failing should NEVER block
    // logout (we still clear the cookie below so the user is signed out).
    try {
      if (accessToken) {
        const session = await sessionService.findActiveSessionByAccessToken(accessToken);
        if (session) await sessionService.revokeSession(session.id, 'logout');
      }
    } catch (err) {
      logger.warn('Logout: access-token session revoke failed', { error: (err as Error)?.message });
    }

    try {
      if (refreshToken) {
        const session = await sessionService.findActiveSessionByRefreshToken(refreshToken);
        if (session) await sessionService.revokeSession(session.id, 'logout');
      }
    } catch (err) {
      logger.warn('Logout: refresh-token session revoke failed', { error: (err as Error)?.message });
    }

    // Always clear the cookie.
    res.clearCookie('refreshToken', getRefreshTokenClearCookieOptions());

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// CHANGE PASSWORD
// ===========================================
router.post(
  '/change-password',
  authenticate,
  [
    body('currentPassword')
      .isString()
      .isLength({ min: 1, max: PASSWORD_MAX_LENGTH })
      .withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: PASSWORD_MIN_LENGTH, max: PASSWORD_MAX_LENGTH })
      .withMessage(`Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters`)
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const principal = signedIn(req);
      await refuseLockedCredentialChecks(principal.id);

      const { currentPassword, newPassword } = req.body;
      const user = await prisma.user.findUnique({
        where: { id: principal.id },
        select: { id: true, passwordHash: true },
      });

      if (!user?.passwordHash) {
        throw new ApiError(400, 'Password change is unavailable for this account');
      }

      const isCurrentPasswordValid = await comparePassword(currentPassword, user.passwordHash);
      if (!isCurrentPasswordValid) {
        // A 403 and not a 401, like the two-factor routes and requireStepUp.
        // Neither the web app nor the phone app lists this route among the
        // ones a 401 means "wrong password" for, so a 401 here was read as an
        // expired session: the client refreshed and sent the same wrong
        // password again, which spent two of the five attempts the
        // credential-check lockout allows for one slip of the fingers, and
        // rotated her refresh token for nothing.
        throw await failedCredentialCheck(user.id, new ApiError(403, 'Current password is incorrect'));
      }
      await clearCredentialChecks(user.id);

      const nextPasswordHash = await hashPassword(newPassword);
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: nextPasswordHash },
      });

      // Every other device is signed out, sockets included; this one stays.
      await sessionService.revokeAllUserSessions(user.id, {
        reason: 'password-changed',
        exceptSessionId: principal.sessionId,
      });

      res.json({
        success: true,
        message: 'Password changed successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// TWO-FACTOR AUTHENTICATION
// ===========================================
router.get('/2fa/status', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        twoFactorEnabled: true,
        twoFactorEnabledAt: true,
        twoFactorSecret: true,
        twoFactorRecoveryCodes: true,
      },
    });

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    res.json({
      success: true,
      data: {
        enabled: user.twoFactorEnabled,
        enabledAt: user.twoFactorEnabledAt,
        setupPending: Boolean(user.twoFactorSecret && !user.twoFactorEnabled),
        recoveryCodesRemaining: user.twoFactorRecoveryCodes.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/2fa/setup', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        twoFactorEnabled: true,
      },
    });

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    if (user.twoFactorEnabled) {
      throw new ApiError(400, 'Two-factor authentication is already enabled');
    }

    const secret = generateTotpSecret();
    // The seed is sealed at rest; the member's authenticator holds the only plaintext copy.
    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorSecret: sealSecret(secret),
        twoFactorEnabled: false,
        twoFactorEnabledAt: null,
      },
    });

    res.json({
      success: true,
      data: {
        secret,
        issuer: TOTP_ISSUER,
        accountName: user.email,
        otpauthUrl: buildTotpAuthUrl({
          issuer: TOTP_ISSUER,
          accountName: user.email,
          secret,
        }),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/2fa/enable',
  authenticate,
  [
    // Asked for, like turning it off, because a session on its own must not be
    // enough to put somebody else's authenticator on her account: whoever held
    // a stolen token could enrol their own phone, take the ten recovery codes,
    // and leave the owner unable to sign in until an administrator reset it.
    body('currentPassword').optional().isString().isLength({ min: 1, max: PASSWORD_MAX_LENGTH }),
    body('code')
      .isString()
      .isLength({ min: 6, max: 32 })
      .withMessage('Two-factor code is required'),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const userId = signedIn(req).id;
      await refuseLockedCredentialChecks(userId);

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          passwordHash: true,
          twoFactorSecret: true,
        },
      });

      if (!user) {
        throw new ApiError(404, 'User not found');
      }

      if (!user.twoFactorSecret) {
        throw new ApiError(400, 'Start two-factor setup before enabling it');
      }

      // An account that signs in only with Google or Facebook has no password
      // to give; its session is all there is to ask. See requireStepUp for why
      // this is a 403 and not a 401.
      if (user.passwordHash) {
        const currentPassword = String(req.body.currentPassword ?? '');
        if (!currentPassword) {
          throw new ApiError(400, 'Current password is required');
        }
        if (!(await comparePassword(currentPassword, user.passwordHash))) {
          throw await failedCredentialCheck(user.id, new ApiError(403, 'Current password is incorrect'));
        }
      }

      const code = normalizeTotpCode(req.body.code);
      if (!code || !(await verifyAuthenticatorCode(user.id, user.twoFactorSecret, code))) {
        throw await failedCredentialCheck(user.id, new ApiError(400, 'Invalid two-factor code'));
      }
      await clearCredentialChecks(user.id);

      const enabledAt = new Date();
      await prisma.user.update({
        where: { id: user.id },
        data: {
          twoFactorEnabled: true,
          twoFactorEnabledAt: enabledAt,
        },
      });

      // The one and only time the plaintext codes exist outside the user's
      // hands; from here the account holds hashes alone.
      const recoveryCodes = await issueRecoveryCodes(user.id);

      res.json({
        success: true,
        message: 'Two-factor authentication enabled',
        data: {
          enabled: true,
          enabledAt,
          recoveryCodes,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/2fa/disable',
  authenticate,
  [
    body('currentPassword').optional().isString().isLength({ min: 1, max: PASSWORD_MAX_LENGTH }),
    body('code').optional().isString().isLength({ min: 6, max: 32 }),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const userId = signedIn(req).id;
      await refuseLockedCredentialChecks(userId);

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          passwordHash: true,
          twoFactorEnabled: true,
          twoFactorSecret: true,
          twoFactorRecoveryCodes: true,
        },
      });

      if (!user) {
        throw new ApiError(404, 'User not found');
      }

      if (user.passwordHash) {
        const currentPassword = String(req.body.currentPassword ?? '');
        if (!currentPassword) {
          throw new ApiError(400, 'Current password is required');
        }

        const isCurrentPasswordValid = await comparePassword(currentPassword, user.passwordHash);
        if (!isCurrentPasswordValid) {
          // A 403 and not a 401, as on enable: the clients answer a 401 by
          // refreshing the session and sending the request again, which counted
          // one mistyped password twice against the five this budget allows.
          throw await failedCredentialCheck(user.id, new ApiError(403, 'Current password is incorrect'));
        }
      }

      if (user.twoFactorEnabled && !(await verifySecondFactor(user, req.body.code))) {
        throw await failedCredentialCheck(user.id, new ApiError(400, 'Invalid two-factor code'));
      }
      await clearCredentialChecks(user.id);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
          twoFactorEnabledAt: null,
          twoFactorRecoveryCodes: { set: [] },
        },
      });

      res.json({
        success: true,
        message: 'Two-factor authentication disabled',
        data: {
          enabled: false,
          enabledAt: null,
          setupPending: false,
          recoveryCodesRemaining: 0,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Codes are single-use, so an account that has spent its set needs a way to
 * mint another without turning two-factor off and on again.
 */
router.post(
  '/2fa/recovery-codes',
  authenticate,
  [
    body('currentPassword').optional().isString().isLength({ min: 1, max: PASSWORD_MAX_LENGTH }),
    body('code').optional().isString().isLength({ min: 6, max: 32 }),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const userId = signedIn(req).id;
      await refuseLockedCredentialChecks(userId);

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          passwordHash: true,
          twoFactorEnabled: true,
          twoFactorSecret: true,
          twoFactorRecoveryCodes: true,
        },
      });

      if (!user) {
        throw new ApiError(404, 'User not found');
      }

      if (!user.twoFactorEnabled) {
        throw new ApiError(400, 'Enable two-factor authentication first');
      }

      if (user.passwordHash) {
        const currentPassword = String(req.body.currentPassword ?? '');
        if (!currentPassword) {
          throw new ApiError(400, 'Current password is required');
        }

        const isCurrentPasswordValid = await comparePassword(currentPassword, user.passwordHash);
        if (!isCurrentPasswordValid) {
          // A 403 and not a 401: see /2fa/disable.
          throw await failedCredentialCheck(user.id, new ApiError(403, 'Current password is incorrect'));
        }
      }

      if (!(await verifySecondFactor(user, req.body.code))) {
        throw await failedCredentialCheck(user.id, new ApiError(400, 'Invalid two-factor code'));
      }
      await clearCredentialChecks(user.id);

      const recoveryCodes = await issueRecoveryCodes(user.id);

      res.json({
        success: true,
        message: 'New recovery codes issued. The previous codes no longer work.',
        data: {
          recoveryCodes,
          recoveryCodesRemaining: recoveryCodes.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// GET CURRENT USER
// ===========================================
router.get('/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        displayName: true,
        avatar: true,
        bio: true,
        headline: true,
        role: true,
        persona: true,
        womanSelfAttested: true,
        womanVerificationStatus: true,
        womanVerifiedAt: true,
        // The client needs to know whether the age gate is satisfied so it can
        // ask once, rather than letting her walk into a 403 on the feed.
        dateOfBirth: true,
        ageVerifiedAt: true,
        city: true,
        state: true,
        country: true,
        preferredLocale: true,
        preferredCurrency: true,
        timezone: true,
        region: true,
        consentMarketing: true,
        consentDataProcessing: true,
        consentCookies: true,
        consentDoNotSell: true,
        consentUpdatedAt: true,
        twoFactorEnabled: true,
        twoFactorEnabledAt: true,
        currentJobTitle: true,
        currentCompany: true,
        yearsExperience: true,
        isPublic: true,
        allowMessages: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        referralCode: true,
        referralCredits: true,
        subscription: {
          select: {
            tier: true,
            status: true,
            currentPeriodEnd: true,
            currency: true,
          },
        },
      },
    });

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// FORGOT PASSWORD
// ===========================================
router.post(
  '/forgot-password',
  [body('email').isEmail().isLength({ max: 254 }).normalizeEmail()],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { email } = req.body;

      const user = await prisma.user.findUnique({ where: { email } });

      // Always return success to prevent email enumeration
      if (user) {
        // All of the work for a real account, the token's two writes as well
        // as the mail, happens after the answer. The only thing done before it
        // is the one lookup an unknown address gets too, so the reply takes the
        // same time either way; writing the token first made a known address
        // measurably slower than an unknown one.
        sendAfterResponse(res, async () => {
          // One live reset link: the new one replaces the older ones once its
          // mail has gone, and a refused mail withdraws only itself, so the
          // link she already holds keeps working.
          await mailFreshLink({
            account: { id: user.id, email },
            type: 'PASSWORD_RESET',
            lifetimeMs: 60 * 60 * 1000, // 1 hour
            kind: 'password_reset',
            send: (resetToken) => sendPasswordResetEmail(email, user.firstName, resetToken),
          });
        }, { userId: user.id });
      }

      res.json({
        success: true,
        message: 'If an account exists, a password reset email will be sent',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Runs a delivery once the response has gone out, and never lets it fail
 * the request. Used where the reply must not reveal whether an account
 * exists: awaiting the mail provider first would let the timing say so.
 */
function sendAfterResponse(res: Response, task: () => Promise<void>, context: AuthEmailContext): void {
  let started = false;
  const run = () => {
    // 'finish' and 'close' both fire on a normal response; the task runs once.
    if (started) return;
    started = true;
    task().catch((error) => logger.error('Deferred auth email failed', { ...context, error }));
  };
  if (res.headersSent) {
    run();
  } else {
    res.once('finish', run);
    res.once('close', run);
  }
}

/**
 * A new confirmation link for an account whose address has not been confirmed:
 * a new one is made and mailed, the older ones are retired once it has gone, and
 * all of it happens after the reply, so the reply says nothing about whether
 * there was an account to send it to. A mail the provider refuses withdraws the
 * new link and leaves the old one alone.
 * Shared by the resend route and by a registration for an unconfirmed address.
 */
function sendFreshVerificationAfterResponse(
  res: Response,
  account: { id: string; email: string; firstName: string }
): void {
  sendAfterResponse(
    res,
    async () => {
      // The older links are retired only once this one's mail has gone, so a
      // refused mail leaves her the link she already had.
      await mailFreshLink({
        account,
        type: 'EMAIL_VERIFICATION',
        lifetimeMs: 24 * 60 * 60 * 1000, // 24 hours
        kind: 'resend_verification',
        send: (verificationToken) => sendVerificationEmail(account.email, account.firstName, verificationToken),
      });
    },
    { userId: account.id }
  );
}

// ===========================================
// RESET PASSWORD
// ===========================================
router.post(
  '/reset-password',
  [
    body('token')
      .isString()
      .matches(SECURE_TOKEN_PATTERN)
      .withMessage('Invalid or expired reset token'),
    body('password')
      .isLength({ min: PASSWORD_MIN_LENGTH, max: PASSWORD_MAX_LENGTH })
      .withMessage(`Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters`)
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { token, password } = req.body;

      // Find valid token
      const verificationToken = await findVerificationTokenRecord(
        token,
        'PASSWORD_RESET'
      );

      if (!verificationToken) {
        throw new ApiError(400, 'Invalid or expired reset token');
      }

      // Hash new password
      const passwordHash = await hashPassword(password);

      // Update user password
      await prisma.user.update({
        where: { id: verificationToken.userId },
        data: { passwordHash },
      });

      // Delete all sessions (force re-login), and drop their live sockets.
      await prisma.session.deleteMany({
        where: { userId: verificationToken.userId },
      });
      sessionEvents.announceRevoked({ userId: verificationToken.userId, reason: 'password-reset' });

      // Delete the used token
      await prisma.verificationToken.delete({
        where: { id: verificationToken.id },
      });

      res.json({
        success: true,
        message: 'Password reset successfully. Please log in with your new password.',
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// VERIFY EMAIL
// ===========================================
router.get('/verify-email', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.query;

    await handleVerifyEmailToken(
      ensureSecureToken(token, 'Verification token'),
      res
    );
  } catch (error) {
    next(error);
  }
});

// validated: token goes through ensureSecureToken, which requires text matching
//   SECURE_TOKEN_PATTERN.
router.post('/verify-email', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await handleVerifyEmailToken(
      ensureSecureToken(req.body?.token, 'Verification token'),
      res
    );
  } catch (error) {
    next(error);
  }
});

// ===========================================
// RESEND VERIFICATION EMAIL
// ===========================================
router.post(
  '/resend-verification',
  [body('email').isEmail().isLength({ max: 254 }).normalizeEmail()],
  async (req: Request, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, errors.array()[0].msg);
    }

    const email = String(req.body?.email || '').trim().toLowerCase();
    const successMessage =
      'If an unverified account exists for that email, a new verification link will be sent.';

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || user.emailVerified) {
      res.json({
        success: true,
        message: successMessage,
      });
      return;
    }

    // The token's writes and the mail both go after the answer, so the reply
    // takes the same time for an address with an unverified account as for
    // one without.
    sendFreshVerificationAfterResponse(res, user);

    res.json({
      success: true,
      message: successMessage,
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// GET ACTIVE SESSIONS
// ===========================================
router.get('/sessions', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const bearer = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined;
    const sessions = await sessionService.getUserActiveSessions(req.user!.id, bearer);

    res.json({
      success: true,
      data: sessions,
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// REVOKE ACTIVE SESSION
// ===========================================
router.delete('/sessions/:sessionId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const sessionId = req.params.sessionId?.trim();
    if (!sessionId) {
      throw new ApiError(400, 'Session id is required');
    }

    const session = await prisma.session.findFirst({
      where: {
        id: sessionId,
        userId: req.user!.id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });

    if (!session) {
      throw new ApiError(404, 'Session not found');
    }

    await sessionService.revokeSession(session.id);

    res.json({
      success: true,
      message: 'Session revoked',
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// LOGOUT ALL DEVICES
// ===========================================
router.post('/logout-all', authenticate, async (req: AuthRequest, res, next) => {
  try {
    // Revoke all sessions for the user, this device's included.
    await sessionService.revokeAllUserSessions(req.user!.id, { reason: 'logout' });

    // Clear refresh token cookie
    res.clearCookie('refreshToken', getRefreshTokenClearCookieOptions());

    res.json({
      success: true,
      message: 'Logged out from all devices successfully',
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// LOCK MY ACCOUNT
// ===========================================

/**
 * Locking is the step beyond "sign out everywhere". Signing out ends the
 * sessions that exist, and anyone who holds her password signs straight back
 * in. A lock ends them and then refuses every way of signing in (password,
 * Google, Facebook, refresh) until she unlocks it from the link mailed to her
 * address. See services/account-lock.service.ts for what it does and why it is
 * not the staff-only suspension.
 *
 * Three ways in, because she may or may not still have a session:
 *   POST /lock           from her security settings, signed in.
 *   POST /lock-by-token  from the "this was not me" link in a new-device
 *                        sign-in email; the one-time token is the proof.
 * And two ways out, neither of which needs a session:
 *   POST /unlock         the link in the lock email, spent once.
 *   POST /request-unlock a new link, for the one that expired or was lost.
 *
 * The three that take no session share one budget in the same shared store as
 * the other sign-in limits, so a script cannot spray tokens at them, and none
 * of them says whether an address has an account.
 */
const accountLockLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 10 : 100,
  message: { success: false, message: 'Too many attempts from here. Please try again in an hour.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  store: new SharedRateLimitStore('rl:account-lock:'),
});
const accountLockLimit = (req: Request, res: Response, next: NextFunction) =>
  socialAuthLimitEnabled ? accountLockLimiter(req, res, next) : next();

const ACCOUNT_LINK_INVALID_MESSAGE = 'This link is not valid, has expired, or has already been used.';

/**
 * What a lock tells the member about the way back, and only what is true. The
 * unlock link is mailed by the lock itself, so the answer depends on whether
 * that mail was accepted, and on whether this request did the locking at all:
 * an account that was already locked sends no second email.
 */
function lockedMessage(outcome: { alreadyLocked: boolean; unlockEmailSent: boolean }): string {
  if (outcome.unlockEmailSent) {
    return 'Your account is locked and every device is signed out. We have emailed you a link to unlock it.';
  }
  if (outcome.alreadyLocked) {
    return 'Your account was already locked, and every device is signed out. The link to unlock it is in the email we sent when it was locked. If you cannot find it, ask for a new one from the sign-in page.';
  }
  return 'Your account is locked and every device is signed out. We could not send the unlock email just now, so ask for a new one from the sign-in page.';
}

router.post('/lock', authenticate, accountLockLimit, async (req: AuthRequest, res, next) => {
  try {
    const outcome = await lockAccount(signedIn(req).id, 'settings', {
      ipAddress: req.ip ?? null,
      userAgent: req.get('user-agent') || null,
    });
    if (!outcome) {
      throw new ApiError(404, 'User not found');
    }
    if (!outcome.alreadyLocked) {
      noteAuthEmail('account_unlock', outcome.unlockEmailSent);
    }

    // This device is signed out with the rest.
    res.clearCookie('refreshToken', getRefreshTokenClearCookieOptions());

    res.json({
      success: true,
      message: lockedMessage(outcome),
      data: { locked: true, unlockEmailSent: outcome.unlockEmailSent },
    });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/lock-by-token',
  accountLockLimit,
  [body('token').isString().matches(SECURE_TOKEN_PATTERN).withMessage(ACCOUNT_LINK_INVALID_MESSAGE)],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const outcome = await lockAccountByLink(req.body.token as string, {
        ipAddress: req.ip ?? null,
        userAgent: req.get('user-agent') || null,
      });
      if (!outcome) {
        throw new ApiError(400, ACCOUNT_LINK_INVALID_MESSAGE);
      }
      if (!outcome.alreadyLocked) {
        noteAuthEmail('account_unlock', outcome.unlockEmailSent);
      }

      // If she opened the link in the browser that was signed in, that session
      // is already ended; the cookie is cleared so the page does not keep one.
      res.clearCookie('refreshToken', getRefreshTokenClearCookieOptions());

      res.json({
        success: true,
        message: lockedMessage(outcome),
        data: { locked: true, unlockEmailSent: outcome.unlockEmailSent },
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/unlock',
  accountLockLimit,
  [body('token').isString().matches(SECURE_TOKEN_PATTERN).withMessage(ACCOUNT_LINK_INVALID_MESSAGE)],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const unlocked = await unlockAccount(req.body.token as string, {
        ipAddress: req.ip ?? null,
        userAgent: req.get('user-agent') || null,
      });
      if (!unlocked) {
        throw new ApiError(400, ACCOUNT_LINK_INVALID_MESSAGE);
      }

      // No session is issued: unlocking is not signing in. She signs in again
      // with her password, and her second factor if she has one.
      res.json({
        success: true,
        message: 'Your account is unlocked. Sign in again to continue.',
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/request-unlock',
  accountLockLimit,
  [body('email').isEmail().isLength({ max: 254 }).normalizeEmail()],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { email } = req.body as { email: string };
      const account = await prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, firstName: true, lockedAt: true },
      });

      // The same answer whether or not the address has an account, or the
      // account is locked, and the work for one that is locked goes after the
      // reply, so the answer's timing says nothing either. The link goes to the
      // address on the account, never to one typed here.
      if (account?.lockedAt) {
        sendAfterResponse(
          res,
          async () => {
            const sent = await mailUnlockLink(account);
            noteAuthEmail('account_unlock', sent);
          },
          { userId: account.id }
        );
      }

      res.json({
        success: true,
        message: 'If that account is locked, a link to unlock it is on its way.',
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
