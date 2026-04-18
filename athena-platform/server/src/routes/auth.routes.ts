import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { Persona, UserRole, Region, WomanVerificationStatus } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { hashPassword, comparePassword } from '../utils/password';
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

const router = Router();

// Helper: Generate secure token
function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function getRefreshTokenCookieBaseOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
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
  return {
    ...getRefreshTokenCookieBaseOptions(),
    maxAge: 0,
    expires: new Date(0),
  };
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
  if (!req.cookies?.refreshToken) {
    return;
  }

  const requestOrigin = getTrustedOriginFromHeaders({
    origin: req.headers.origin,
    referer: req.headers.referer,
  });

  if (!requestOrigin || !isCorsOriginAllowed(requestOrigin)) {
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

  await sendWelcomeEmail(
    verificationToken.user.email,
    verificationToken.user.firstName
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
    body('email').isEmail().normalizeEmail(),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
    body('firstName').notEmpty().trim(),
    body('lastName').notEmpty().trim(),
    body('womanSelfAttested')
      .isBoolean()
      .custom((value) => value === true)
      .withMessage('You must confirm you are a woman to join ATHENA'),
    body('inviteCode')
      .optional({ checkFalsy: true })
      .isString()
      .trim()
      .isLength({ min: 4, max: 32 }),
    body('persona')
      .optional({ checkFalsy: true })
      .customSanitizer((v) => (typeof v === 'string' ? v.trim().toUpperCase() : v))
      .isIn([
        'EARLY_CAREER', 'MID_CAREER', 'ENTREPRENEUR', 'CREATOR',
        'MENTOR', 'EDUCATION_PROVIDER', 'EMPLOYER', 'REAL_ESTATE', 'GOVERNMENT_NGO'
      ]),
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
      const { email, password, firstName, lastName, referralCode, womanSelfAttested, inviteCode } = req.body;

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
        return crypto.randomBytes(4).toString('hex').toUpperCase();
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
      if (referralCode) {
        const referrer = await prisma.user.findUnique({
          where: { referralCode: referralCode.toUpperCase() },
          select: { id: true },
        });
        if (referrer) {
          referrerId = referrer.id;
        }
      }

      let inviteRecord: { id: string; usesCount: number; maxUses: number | null; isActive: boolean } | null = null;
      if (inviteCode) {
        const normalizedCode = String(inviteCode).trim().toUpperCase();
        inviteRecord = await prisma.inviteCode.findFirst({
          where: {
            code: normalizedCode,
            isActive: true,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
          select: { id: true, usesCount: true, maxUses: true, isActive: true },
        });

        if (!inviteRecord) {
          throw new ApiError(400, 'Invalid or expired invite code');
        }

        if (inviteRecord.maxUses !== null && inviteRecord.usesCount >= inviteRecord.maxUses) {
          throw new ApiError(400, 'Invite code has reached its usage limit');
        }
      }

      // Create user
      const user = await prisma.user.create({
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

      if (inviteRecord) {
        const nextUses = inviteRecord.usesCount + 1;
        await prisma.inviteCode.update({
          where: { id: inviteRecord.id },
          data: {
            usesCount: { increment: 1 },
            lastUsedAt: new Date(),
            ...(inviteRecord.maxUses !== null
              ? { isActive: nextUses < inviteRecord.maxUses }
              : {}),
          },
        });
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
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { email, password } = req.body;

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

      if (!user || !user.passwordHash) {
        throw new ApiError(401, 'Invalid email or password');
      }

      const isValidPassword = await comparePassword(password, user.passwordHash);
      if (!isValidPassword) {
        throw new ApiError(401, 'Invalid email or password');
      }

      if (!user.emailVerified) {
        throw new ApiError(403, 'Please verify your email before signing in.');
      }

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
    body('credential').isString().notEmpty(),
    body('mode').optional().isIn(['login', 'register']),
    body('womanSelfAttested').optional().isBoolean(),
    body('inviteCode')
      .optional({ checkFalsy: true })
      .isString()
      .trim()
      .isLength({ min: 4, max: 32 }),
    body('persona')
      .optional({ checkFalsy: true })
      .customSanitizer((v) => (typeof v === 'string' ? v.trim().toUpperCase() : v))
      .isIn([
        'EARLY_CAREER', 'MID_CAREER', 'ENTREPRENEUR', 'CREATOR',
        'MENTOR', 'EDUCATION_PROVIDER', 'EMPLOYER', 'REAL_ESTATE', 'GOVERNMENT_NGO'
      ]),
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

      const googleResponse = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(String(req.body.credential))}`
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
      const firstName = (googleProfile.given_name || nameParts[0] || 'ATHENA').trim();
      const lastName = (googleProfile.family_name || nameParts.slice(1).join(' ') || 'Member').trim();
      const displayName = profileName || `${firstName} ${lastName}`.trim();
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

        let inviteRecord: { id: string; usesCount: number; maxUses: number | null; isActive: boolean } | null = null;
        if (req.body?.inviteCode) {
          const normalizedCode = String(req.body.inviteCode).trim().toUpperCase();
          inviteRecord = await prisma.inviteCode.findFirst({
            where: {
              code: normalizedCode,
              isActive: true,
              OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
            },
            select: { id: true, usesCount: true, maxUses: true, isActive: true },
          });

          if (!inviteRecord) {
            throw new ApiError(400, 'Invalid or expired invite code');
          }

          if (inviteRecord.maxUses !== null && inviteRecord.usesCount >= inviteRecord.maxUses) {
            throw new ApiError(400, 'Invite code has reached its usage limit');
          }
        }

        const generateReferralCode = (): string => crypto.randomBytes(4).toString('hex').toUpperCase();
        let referralCode = generateReferralCode();
        let codeAttempts = 0;
        while (codeAttempts < 10) {
          const existingCode = await prisma.user.findUnique({ where: { referralCode } });
          if (!existingCode) break;
          referralCode = generateReferralCode();
          codeAttempts += 1;
        }

        user = await prisma.user.create({
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

        await prisma.$executeRaw`
          UPDATE "User"
          SET "googleId" = ${googleProfile.sub}
          WHERE "id" = ${user.id}
        `;

        if (inviteRecord) {
          const nextUses = inviteRecord.usesCount + 1;
          await prisma.inviteCode.update({
            where: { id: inviteRecord.id },
            data: {
              usesCount: { increment: 1 },
              lastUsedAt: new Date(),
              ...(inviteRecord.maxUses !== null
                ? { isActive: nextUses < inviteRecord.maxUses }
                : {}),
            },
          });
        }

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
// REFRESH TOKEN
// ===========================================
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    enforceTrustedRefreshCookieRequest(req);

    // Prefer cookie-based refresh token (HttpOnly). Fallback to request body.
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!refreshToken) {
      throw new ApiError(400, 'Refresh token required');
    }

    // Verify refresh token
    const decoded = verifyToken(refreshToken);

    // Find session
    const session = await sessionService.findActiveSessionByRefreshToken(refreshToken);

    if (!session || session.userId !== decoded.userId) {
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
router.post('/logout', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];

    if (token) {
      // Find and revoke the session
      const session = await sessionService.findActiveSessionByAccessToken(token);

      if (session) {
        await sessionService.revokeSession(session.id);
      }
    }

    // Clear refresh token cookie
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
  [body('email').isEmail().normalizeEmail()],
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
    body('token').notEmpty(),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
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

    if (!token || typeof token !== 'string') {
      throw new ApiError(400, 'Verification token required');
    }

    await handleVerifyEmailToken(token, res);
  } catch (error) {
    next(error);
  }
});

router.post('/verify-email', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.body?.token;

    if (!token || typeof token !== 'string') {
      throw new ApiError(400, 'Verification token required');
    }

    await handleVerifyEmailToken(token, res);
  } catch (error) {
    next(error);
  }
});

// ===========================================
// RESEND VERIFICATION EMAIL
// ===========================================
router.post(
  '/resend-verification',
  [body('email').isEmail().normalizeEmail()],
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
