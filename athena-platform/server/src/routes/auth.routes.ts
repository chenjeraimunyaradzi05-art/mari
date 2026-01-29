import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { Persona } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { hashPassword, comparePassword } from '../utils/password';
import { generateAccessToken, generateRefreshToken, verifyToken } from '../utils/jwt';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { sendVerificationEmail, sendPasswordResetEmail, sendWelcomeEmail } from '../utils/email';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

const router = Router();

// Helper: Generate secure token
function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
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
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
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
          role: true,
          persona: true,
          referralCode: true,
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
          token: verificationToken,
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

      // Generate tokens
      const tokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
        persona: user.persona,
      };

      const accessToken = generateAccessToken(tokenPayload);
      const refreshToken = generateRefreshToken(tokenPayload);

      // Store session
      await prisma.session.create({
        data: {
          userId: user.id,
          token: accessToken,
          refreshToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          userAgent: req.headers['user-agent'],
          ipAddress: req.ip,
        },
      });

      res.status(201).json({
        success: true,
        message: 'Registration successful. Please check your email to verify your account.',
        data: {
          user,
          accessToken,
          refreshToken,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// LOGIN
// ===========================================
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, 'Invalid email or password');
      }

      const { email, password } = req.body;

      // Find user
      const user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          passwordHash: true,
          firstName: true,
          lastName: true,
          role: true,
          persona: true,
          avatar: true,
          preferredLocale: true,
          preferredCurrency: true,
          timezone: true,
          region: true,
        },
      });

      if (!user || !user.passwordHash) {
        throw new ApiError(401, 'Invalid email or password');
      }

      // Verify password
      const isValidPassword = await comparePassword(password, user.passwordHash);
      if (!isValidPassword) {
        throw new ApiError(401, 'Invalid email or password');
      }

      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      // Generate tokens
      const tokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
        persona: user.persona,
      };

      const accessToken = generateAccessToken(tokenPayload);
      const refreshToken = generateRefreshToken(tokenPayload);

      // Store session
      await prisma.session.create({
        data: {
          userId: user.id,
          token: accessToken,
          refreshToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          userAgent: req.headers['user-agent'],
          ipAddress: req.ip,
        },
      });

      // Remove passwordHash from response
      const { passwordHash: _, ...userWithoutPassword } = user;

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: userWithoutPassword,
          accessToken,
          refreshToken,
        },
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
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new ApiError(400, 'Refresh token required');
    }

    // Verify refresh token
    const decoded = verifyToken(refreshToken);

    // Find session
    const session = await prisma.session.findFirst({
      where: {
        refreshToken,
        userId: decoded.userId,
      },
    });

    if (!session) {
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

    // Update session
    await prisma.session.update({
      where: { id: session.id },
      data: {
        token: newAccessToken,
        refreshToken: newRefreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    res.json({
      success: true,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      },
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
      await prisma.session.deleteMany({
        where: {
          userId: req.user!.id,
          token,
        },
      });
    }

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
        createdAt: true,
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
            token: resetToken,
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
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { token, password } = req.body;

      // Find valid token
      const verificationToken = await prisma.verificationToken.findFirst({
        where: {
          token,
          type: 'PASSWORD_RESET',
          expiresAt: { gt: new Date() },
        },
        include: { user: true },
      });

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

    // Find valid token
    const verificationToken = await prisma.verificationToken.findFirst({
      where: {
        token,
        type: 'EMAIL_VERIFICATION',
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!verificationToken) {
      throw new ApiError(400, 'Invalid or expired verification token');
    }

    // Update user as verified
    await prisma.user.update({
      where: { id: verificationToken.userId },
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });

    // Delete the used token
    await prisma.verificationToken.delete({
      where: { id: verificationToken.id },
    });

    // Complete any pending referral and grant credits to referrer
    const pendingReferral = await prisma.referral.findFirst({
      where: {
        referredId: verificationToken.userId,
        status: 'PENDING',
      },
    });

    if (pendingReferral) {
      await prisma.$transaction([
        // Mark referral as completed
        prisma.referral.update({
          where: { id: pendingReferral.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            rewardGranted: true,
          },
        }),
        // Grant credits to referrer
        prisma.user.update({
          where: { id: pendingReferral.referrerId },
          data: { referralCredits: { increment: 100 } },
        }),
        // Notify referrer of successful referral completion
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

    // Send welcome email
    await sendWelcomeEmail(verificationToken.user.email, verificationToken.user.firstName);

    res.json({
      success: true,
      message: 'Email verified successfully! Welcome to ATHENA.',
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// RESEND VERIFICATION EMAIL
// ===========================================
router.post('/resend-verification', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
    });

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    if (user.emailVerified) {
      throw new ApiError(400, 'Email already verified');
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
        token: verificationToken,
        type: 'EMAIL_VERIFICATION',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });

    // Send verification email
    await sendVerificationEmail(user.email, user.firstName, verificationToken);

    res.json({
      success: true,
      message: 'Verification email sent successfully',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
