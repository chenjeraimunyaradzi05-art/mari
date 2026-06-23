import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { Persona, Prisma, Region, UserRole, WomanVerificationStatus } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { hashPassword, comparePassword, DUMMY_PASSWORD_HASH } from '../utils/password';
import {
  generateAccessToken,
  generateRefreshToken,
  getTokenExpiresInSeconds,
  verifyToken,
} from '../utils/jwt';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { sendVerificationEmail, sendPasswordResetEmail, sendWelcomeEmail } from '../utils/email';
import { logger } from '../utils/logger';
import crypto from 'crypto';
import { sessionService } from '../services/session.service';
import { hashOpaqueToken } from '../utils/opaqueToken';
import { getTrustedOriginFromHeaders, isCorsOriginAllowed } from '../utils/origins';
import {
  clearFailedLogins,
  getLockoutStatus,
  recordFailedLogin,
} from '../utils/loginAttempts';

const router = Router();

const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 128;
const EXTERNAL_AUTH_TOKEN_MAX_LENGTH = 4096;
const AUTH_CODE_PATTERN = /^[A-Za-z0-9-]+$/;
const SECURE_TOKEN_PATTERN = /^[a-f0-9]{64}$/i;
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

type InviteCodeRecord = {
  id: string;
  usesCount: number;
  maxUses: number | null;
};

// Helper: Generate secure token
function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
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

function getRefreshTokenCookieBaseOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  const raw = String(process.env.COOKIE_SAMESITE || '').toLowerCase();
  const sameSite: 'lax' | 'strict' | 'none' =
    raw === 'none' || raw === 'strict' || raw === 'lax'
      ? (raw as 'lax' | 'strict' | 'none')
      : isProduction
        ? 'none' // cross-site Netlify -> API origin requires SameSite=None
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

function buildAuthResponseData(
  accessToken: string,
  user?: Record<string, unknown>
) {
  const expiresIn = getTokenExpiresInSeconds(accessToken) ?? 0;

  return {
    ...(user ? { user } : {}),
    accessToken,
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
  sendWelcomeEmail(
    verificationToken.user.email,
    verificationToken.user.firstName
  ).catch((err) =>
    logger.error('Failed to send welcome email after email verification', { error: err })
  );

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
    body('womanSelfAttested')
      .isBoolean()
      .custom((value) => value === true)
      .withMessage('You must confirm you are a woman to join ATHENA'),
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

      if (!womanSelfAttested) {
        throw new ApiError(400, 'Women-only access requires self-attestation');
      }

      // Check if user exists
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        throw new ApiError(409, 'Email already registered');
      }

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
            throw new ApiError(409, 'Email already registered');
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

      // Send verification email (async, don't block response)
      sendVerificationEmail(email, firstName, verificationToken).catch((err) => logger.error('Failed to send verification email', { error: err }));

      res.status(201).json({
        success: true,
        message: 'Registration successful. Please check your email to verify your account.',
        data: {
          user,
          verificationRequired: true,
        },
      });
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
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true,
          referralCode: true,
          referralCredits: true,
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
        throw new ApiError(403, 'Please verify your email before signing in.');
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
      const cookieOptions = getRefreshTokenCookieOptions(refreshToken);
      res.cookie('refreshToken', refreshToken, cookieOptions);

      await sessionService.createSession(
        user.id,
        accessToken,
        refreshToken,
        req.headers['user-agent'],
        req.ip
      );

      const { passwordHash: _passwordHash, ...userWithoutPassword } = user;
      void _passwordHash;

      res.json({
        success: true,
        message: 'Login successful',
        data: buildAuthResponseData(
          accessToken,
          userWithoutPassword as Record<string, unknown>
        ),
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

      const linkedGoogleRows = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "User"
        WHERE "googleId" = ${googleProfile.sub}
        LIMIT 1
      `;

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
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
      } as const;

      const existingEmailUser = await prisma.user.findUnique({
        where: { email },
        select: {
          ...selectUser,
          emailVerifiedAt: true,
        },
      });

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
            createdAt: Date;
            updatedAt: Date;
            lastLoginAt: Date | null;
          }
        | null = null;
      let created = false;

      if (linkedGoogleRows[0]?.id) {
        user = await prisma.user.update({
          where: { id: linkedGoogleRows[0].id },
          data: {
            emailVerified: true,
            emailVerifiedAt: new Date(),
            lastLoginAt: new Date(),
            avatar: existingEmailUser?.avatar || googleProfile.picture || undefined,
          },
          select: selectUser,
        });
      } else if (existingEmailUser) {
        await prisma.$executeRaw`
          UPDATE "User"
          SET "googleId" = ${googleProfile.sub}
          WHERE "id" = ${existingEmailUser.id}
        `;

        user = await prisma.user.update({
          where: { id: existingEmailUser.id },
          data: {
            emailVerified: true,
            emailVerifiedAt: existingEmailUser.emailVerifiedAt ?? new Date(),
            lastLoginAt: new Date(),
            avatar: existingEmailUser.avatar || googleProfile.picture || undefined,
          },
          select: selectUser,
        });
      } else {
        if (mode !== 'register') {
          throw new ApiError(404, 'No ATHENA account exists for this Google email. Please create an account first.');
        }

        if (req.body?.womanSelfAttested !== true) {
          throw new ApiError(400, 'You must confirm you are a woman to join ATHENA');
        }

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
              firstName,
              lastName,
              displayName,
              avatar: googleProfile.picture || undefined,
              persona,
              womanSelfAttested: true,
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

        user = inviteRecord
          ? await prisma.$transaction((tx) => createSocialUser(tx))
          : await createSocialUser(prisma);

        await prisma.$executeRaw`
          UPDATE "User"
          SET "googleId" = ${googleProfile.sub}
          WHERE "id" = ${user.id}
        `;

        sendWelcomeEmail(email, firstName).catch((err) =>
          logger.error('Failed to send welcome email after Google sign-up', { error: err })
        );

        created = true;
      }

      if (!user) {
        throw new ApiError(500, 'Google sign-in failed');
      }

      const tokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
        persona: user.persona,
      };

      const accessToken = generateAccessToken(tokenPayload);
      const refreshToken = generateRefreshToken(tokenPayload);
      const cookieOptions = getRefreshTokenCookieOptions(refreshToken);
      res.cookie('refreshToken', refreshToken, cookieOptions);

      await sessionService.createSession(
        user.id,
        accessToken,
        refreshToken,
        req.headers['user-agent'],
        req.ip
      );

      res.status(created ? 201 : 200).json({
        success: true,
        message: created ? 'Google sign-up successful' : 'Google sign-in successful',
        data: buildAuthResponseData(accessToken, user as Record<string, unknown>),
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
  [
    body('accessToken').isString().isLength({ min: 1, max: EXTERNAL_AUTH_TOKEN_MAX_LENGTH }),
    body('mode').optional().isIn(['login', 'register']),
    body('womanSelfAttested').optional().isBoolean(),
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

      const linkedFbRows = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "User"
        WHERE "facebookId" = ${fbProfile.id}
        LIMIT 1
      `;

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
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
      } as const;

      const existingFbEmailUser = await prisma.user.findUnique({
        where: { email: fbEmail },
        select: { ...fbSelectUser, emailVerifiedAt: true },
      });

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
            createdAt: Date;
            updatedAt: Date;
            lastLoginAt: Date | null;
          }
        | null = null;
      let fbCreated = false;

      if (linkedFbRows[0]?.id) {
        fbUser = await prisma.user.update({
          where: { id: linkedFbRows[0].id },
          data: {
            emailVerified: true,
            emailVerifiedAt: new Date(),
            lastLoginAt: new Date(),
            avatar: existingFbEmailUser?.avatar || fbAvatarUrl || undefined,
          },
          select: fbSelectUser,
        });
      } else if (existingFbEmailUser) {
        await prisma.$executeRaw`
          UPDATE "User"
          SET "facebookId" = ${fbProfile.id}
          WHERE "id" = ${existingFbEmailUser.id}
        `;

        fbUser = await prisma.user.update({
          where: { id: existingFbEmailUser.id },
          data: {
            emailVerified: true,
            emailVerifiedAt: existingFbEmailUser.emailVerifiedAt ?? new Date(),
            lastLoginAt: new Date(),
            avatar: existingFbEmailUser.avatar || fbAvatarUrl || undefined,
          },
          select: fbSelectUser,
        });
      } else {
        if (fbMode !== 'register') {
          throw new ApiError(404, 'No ATHENA account exists for this Facebook email. Please create an account first.');
        }

        if (req.body?.womanSelfAttested !== true) {
          throw new ApiError(400, 'You must confirm you are a woman to join ATHENA');
        }

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
              firstName: fbFirstName,
              lastName: fbLastName,
              displayName: fbDisplayName,
              avatar: fbAvatarUrl || undefined,
              persona: fbPersona,
              womanSelfAttested: true,
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

        fbUser = fbInviteRecord
          ? await prisma.$transaction((tx) => createFacebookUser(tx))
          : await createFacebookUser(prisma);

        await prisma.$executeRaw`
          UPDATE "User"
          SET "facebookId" = ${fbProfile.id}
          WHERE "id" = ${fbUser.id}
        `;

        sendWelcomeEmail(fbEmail, fbFirstName).catch((err) =>
          logger.error('Failed to send welcome email after Facebook sign-up', { error: err })
        );

        fbCreated = true;
      }

      if (!fbUser) {
        throw new ApiError(500, 'Facebook sign-in failed');
      }

      const fbTokenPayload = {
        userId: fbUser.id,
        email: fbUser.email,
        role: fbUser.role,
        persona: fbUser.persona,
      };

      const fbAccessTokenJwt = generateAccessToken(fbTokenPayload);
      const fbRefreshToken = generateRefreshToken(fbTokenPayload);
      const fbCookieOptions = getRefreshTokenCookieOptions(fbRefreshToken);
      res.cookie('refreshToken', fbRefreshToken, fbCookieOptions);

      await sessionService.createSession(
        fbUser.id,
        fbAccessTokenJwt,
        fbRefreshToken,
        req.headers['user-agent'],
        req.ip
      );

      res.status(fbCreated ? 201 : 200).json({
        success: true,
        message: fbCreated ? 'Facebook sign-up successful' : 'Facebook sign-in successful',
        data: buildAuthResponseData(fbAccessTokenJwt, fbUser as Record<string, unknown>),
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// REFRESH TOKEN
// ===========================================
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    enforceTrustedRefreshCookieRequest(req);

    // Cookie-only refresh — body-supplied tokens are a CSRF channel.
    // (Outside production we also accept the body so test tooling keeps working.)
    const refreshToken =
      req.cookies?.refreshToken ||
      (process.env.NODE_ENV !== 'production' ? req.body?.refreshToken : undefined);

    if (!refreshToken) {
      throw new ApiError(400, 'Refresh token required');
    }

    // Verify refresh token
    const decoded = verifyToken(refreshToken);

    // Find session
    const session = await sessionService.findActiveSessionByRefreshToken(refreshToken);

    if (!session || session.userId !== decoded.userId) {
      // If this token previously belonged to a *revoked* session, it's a
      // replay of a rotated token — treat as compromise and burn every
      // session for that user.
      const compromisedUserId = await sessionService.detectRefreshTokenReuse(refreshToken);
      if (compromisedUserId) {
        res.clearCookie('refreshToken', getRefreshTokenClearCookieOptions());
      }
      throw new ApiError(401, 'Invalid refresh token');
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, role: true, persona: true },
    });

    if (!user) {
      throw new ApiError(401, 'User not found');
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
      logger.error('Failed to rotate refresh token', { error: err?.message || err, stack: err?.stack });
      return next(err);
    }

    // Rotate refresh token cookie
    res.cookie('refreshToken', newRefreshToken, {
      ...getRefreshTokenCookieOptions(newRefreshToken),
    });

    res.json({
      success: true,
      data: buildAuthResponseData(newAccessToken),
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
        if (session) await sessionService.revokeSession(session.id);
      }
    } catch (err) {
      logger.warn('Logout: access-token session revoke failed', { error: (err as Error)?.message });
    }

    try {
      if (refreshToken) {
        const session = await sessionService.findActiveSessionByRefreshToken(refreshToken);
        if (session) await sessionService.revokeSession(session.id);
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
      const { email } = req.body;

      const user = await prisma.user.findUnique({ where: { email } });

      // Always return success to prevent email enumeration
      if (user) {
        // Delete any existing password reset tokens
        await prisma.verificationToken.deleteMany({
          where: { userId: user.id, type: 'PASSWORD_RESET' },
        });

        // Generate new reset token
        const resetToken = generateSecureToken();
        
        await prisma.verificationToken.create({
          data: {
            userId: user.id,
            token: hashOpaqueToken(resetToken),
            type: 'PASSWORD_RESET',
            expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
          },
        });

        // Send password reset email
        await sendPasswordResetEmail(email, user.firstName, resetToken);
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

      // Delete all sessions (force re-login)
      await prisma.session.deleteMany({
        where: { userId: verificationToken.userId },
      });

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
      'If an unverified account exists for that email, a new verification link has been sent.';

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

    // Delete existing verification tokens
    await prisma.verificationToken.deleteMany({
      where: { userId: user.id, type: 'EMAIL_VERIFICATION' },
    });

    // Generate new token
    const verificationToken = generateSecureToken();

    await prisma.verificationToken.create({
      data: {
        userId: user.id,
        token: hashOpaqueToken(verificationToken),
        type: 'EMAIL_VERIFICATION',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });

    // Send verification email
    await sendVerificationEmail(user.email, user.firstName, verificationToken);

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
    const sessions = await sessionService.getUserActiveSessions(req.user!.id);

    res.json({
      success: true,
      data: sessions,
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
    // Revoke all sessions for the user
    await sessionService.revokeAllUserSessions(req.user!.id);

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

export default router;
