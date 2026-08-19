"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const client_1 = require("@prisma/client");
const prisma_1 = require("../utils/prisma");
const password_1 = require("../utils/password");
const jwt_1 = require("../utils/jwt");
const errorHandler_1 = require("../middleware/errorHandler");
const auth_1 = require("../middleware/auth");
const email_1 = require("../utils/email");
const logger_1 = require("../utils/logger");
const crypto_1 = __importDefault(require("crypto"));
const session_service_1 = require("../services/session.service");
const opaqueToken_1 = require("../utils/opaqueToken");
const origins_1 = require("../utils/origins");
const loginAttempts_1 = require("../utils/loginAttempts");
const totp_1 = require("../utils/totp");
const router = (0, express_1.Router)();
const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 128;
const EXTERNAL_AUTH_TOKEN_MAX_LENGTH = 4096;
const AUTH_CODE_PATTERN = /^[A-Za-z0-9-]+$/;
const SECURE_TOKEN_PATTERN = /^[a-f0-9]{64}$/i;
const TOTP_ISSUER = 'ATHENA';
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
// Helper: Generate secure token
function generateSecureToken() {
    return crypto_1.default.randomBytes(32).toString('hex');
}
async function requireAuthEmailDelivery(sendTask, failureMessage, context) {
    try {
        const sent = await sendTask();
        if (!sent) {
            logger_1.logger.error('Required auth email was not accepted by the email provider', context);
            throw new errorHandler_1.ApiError(503, failureMessage);
        }
    }
    catch (error) {
        if (error instanceof errorHandler_1.ApiError) {
            throw error;
        }
        logger_1.logger.error('Required auth email failed', { ...context, error });
        throw new errorHandler_1.ApiError(503, failureMessage);
    }
}
function sendBestEffortAuthEmail(label, sendTask, context) {
    sendTask()
        .then((sent) => {
        if (!sent) {
            logger_1.logger.warn(`${label} was not accepted by the email provider`, context);
        }
    })
        .catch((error) => logger_1.logger.error(`${label} failed`, { ...context, error }));
}
function sanitizeName(raw, fallback = '') {
    const sanitized = String(raw ?? '')
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u001F\u007F\u200B-\u200F\u2028\u2029\uFEFF]/g, '')
        .trim()
        .slice(0, 80);
    return sanitized || fallback;
}
function normalizeOptionalCode(raw) {
    if (typeof raw !== 'string')
        return null;
    const code = raw.trim();
    return code ? code : null;
}
function ensureSecureToken(token, label) {
    if (typeof token !== 'string' || !SECURE_TOKEN_PATTERN.test(token)) {
        throw new errorHandler_1.ApiError(400, `${label} required`);
    }
    return token;
}
async function fetchWithTimeout(url, timeoutMs = 5000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { signal: controller.signal });
    }
    finally {
        clearTimeout(timeout);
    }
}
async function findUsableInviteCode(rawInviteCode) {
    const normalizedCode = normalizeOptionalCode(rawInviteCode)?.toUpperCase();
    if (!normalizedCode)
        return null;
    const inviteRecord = await prisma_1.prisma.inviteCode.findFirst({
        where: {
            code: normalizedCode,
            isActive: true,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        select: { id: true, usesCount: true, maxUses: true },
    });
    if (!inviteRecord) {
        throw new errorHandler_1.ApiError(400, 'Invalid or expired invite code');
    }
    if (inviteRecord.maxUses !== null && inviteRecord.usesCount >= inviteRecord.maxUses) {
        throw new errorHandler_1.ApiError(400, 'Invite code has reached its usage limit');
    }
    return inviteRecord;
}
async function consumeInviteCode(tx, inviteRecord) {
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
        throw new errorHandler_1.ApiError(400, 'Invite code is no longer available');
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
    const sameSite = raw === 'none' || raw === 'strict' || raw === 'lax'
        ? raw
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
function getRefreshTokenCookieOptions(refreshToken) {
    const refreshExpiresIn = (0, jwt_1.getTokenExpiresInSeconds)(refreshToken);
    return {
        ...getRefreshTokenCookieBaseOptions(),
        maxAge: (refreshExpiresIn ?? 7 * 24 * 60 * 60) * 1000,
    };
}
function getRefreshTokenClearCookieOptions() {
    return getRefreshTokenCookieBaseOptions();
}
function buildAuthResponseData(accessToken, user) {
    const expiresIn = (0, jwt_1.getTokenExpiresInSeconds)(accessToken) ?? 0;
    return {
        ...(user ? { user } : {}),
        accessToken,
        expiresIn,
    };
}
function enforceTrustedRefreshCookieRequest(req) {
    const requestOrigin = (0, origins_1.getTrustedOriginFromHeaders)({
        origin: req.headers.origin,
        referer: req.headers.referer,
    });
    // In production, every refresh request must come from a trusted origin —
    // even when the browser doesn't send the cookie back (helps catch
    // misconfigured proxies that strip cookies but still POST).
    if (process.env.NODE_ENV === 'production') {
        if (!requestOrigin || !(0, origins_1.isCorsOriginAllowed)(requestOrigin)) {
            throw new errorHandler_1.ApiError(403, 'Cross-site refresh requests are not allowed');
        }
        return;
    }
    // Outside production: only enforce when we have an origin AND a cookie
    // (preserves dev tooling like Postman that may not set Origin/Referer).
    if (req.cookies?.refreshToken && requestOrigin && !(0, origins_1.isCorsOriginAllowed)(requestOrigin)) {
        throw new errorHandler_1.ApiError(403, 'Cross-site refresh requests are not allowed');
    }
}
async function findVerificationTokenRecord(token, type) {
    const hashedToken = (0, opaqueToken_1.hashOpaqueToken)(token);
    return (await prisma_1.prisma.verificationToken.findFirst({
        where: {
            token: hashedToken,
            type,
            expiresAt: { gt: new Date() },
        },
        include: { user: true },
    })) || (await prisma_1.prisma.verificationToken.findFirst({
        where: {
            token,
            type,
            expiresAt: { gt: new Date() },
        },
        include: { user: true },
    }));
}
async function handleVerifyEmailToken(token, res) {
    const verificationToken = await findVerificationTokenRecord(token, 'EMAIL_VERIFICATION');
    if (!verificationToken) {
        throw new errorHandler_1.ApiError(400, 'Invalid or expired verification token');
    }
    await prisma_1.prisma.user.update({
        where: { id: verificationToken.userId },
        data: {
            emailVerified: true,
            emailVerifiedAt: new Date(),
        },
    });
    await prisma_1.prisma.verificationToken.delete({
        where: { id: verificationToken.id },
    });
    const pendingReferral = await prisma_1.prisma.referral.findFirst({
        where: {
            referredId: verificationToken.userId,
            status: 'PENDING',
        },
    });
    if (pendingReferral) {
        await prisma_1.prisma.$transaction([
            prisma_1.prisma.referral.update({
                where: { id: pendingReferral.id },
                data: {
                    status: 'COMPLETED',
                    completedAt: new Date(),
                    rewardGranted: true,
                },
            }),
            prisma_1.prisma.user.update({
                where: { id: pendingReferral.referrerId },
                data: { referralCredits: { increment: 100 } },
            }),
            prisma_1.prisma.notification.create({
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
    sendBestEffortAuthEmail('Welcome email after email verification', () => (0, email_1.sendWelcomeEmail)(verificationToken.user.email, verificationToken.user.firstName), { userId: verificationToken.userId, email: verificationToken.user.email });
    res.json({
        success: true,
        message: 'Email verified successfully! Welcome to ATHENA.',
    });
}
// ===========================================
// REGISTER
// ===========================================
router.post('/register', [
    (0, express_validator_1.body)('email').isEmail().isLength({ max: 254 }).normalizeEmail(),
    (0, express_validator_1.body)('password')
        .isLength({ min: PASSWORD_MIN_LENGTH, max: PASSWORD_MAX_LENGTH })
        .withMessage(`Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters`)
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
    (0, express_validator_1.body)('firstName').notEmpty().trim().isLength({ max: 80 }),
    (0, express_validator_1.body)('lastName').notEmpty().trim().isLength({ max: 80 }),
    (0, express_validator_1.body)('referralCode')
        .optional({ checkFalsy: true })
        .isString()
        .trim()
        .isLength({ min: 4, max: 32 })
        .matches(AUTH_CODE_PATTERN)
        .withMessage('Referral codes can only include letters, numbers, and dashes'),
    (0, express_validator_1.body)('womanSelfAttested')
        .isBoolean()
        .custom((value) => value === true)
        .withMessage('You must confirm you are a woman to join ATHENA'),
    (0, express_validator_1.body)('inviteCode')
        .optional({ checkFalsy: true })
        .isString()
        .trim()
        .isLength({ min: 4, max: 32 })
        .matches(AUTH_CODE_PATTERN)
        .withMessage('Invite codes can only include letters, numbers, and dashes'),
    (0, express_validator_1.body)('persona')
        .optional({ checkFalsy: true })
        .customSanitizer((v) => (typeof v === 'string' ? v.trim().toUpperCase() : v))
        .isIn(PERSONA_VALUES),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const rawPersona = req.body?.persona;
        const persona = typeof rawPersona === 'string' && rawPersona.trim()
            ? rawPersona.trim().toUpperCase()
            : client_1.Persona.EARLY_CAREER;
        const { email, password, referralCode, womanSelfAttested, inviteCode } = req.body;
        const firstName = sanitizeName(req.body.firstName);
        const lastName = sanitizeName(req.body.lastName);
        if (!firstName || !lastName) {
            throw new errorHandler_1.ApiError(400, 'First name and last name are required');
        }
        if (!womanSelfAttested) {
            throw new errorHandler_1.ApiError(400, 'Women-only access requires self-attestation');
        }
        // Check if user exists
        const existingUser = await prisma_1.prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            throw new errorHandler_1.ApiError(409, 'Email already registered');
        }
        // Hash password
        const passwordHash = await (0, password_1.hashPassword)(password);
        // Generate verification token
        const verificationToken = generateSecureToken();
        // Generate unique referral code for the new user
        const generateReferralCode = () => {
            return crypto_1.default.randomBytes(8).toString('hex').toUpperCase();
        };
        let newUserReferralCode = generateReferralCode();
        let codeAttempts = 0;
        while (codeAttempts < 10) {
            const existingCode = await prisma_1.prisma.user.findUnique({ where: { referralCode: newUserReferralCode } });
            if (!existingCode)
                break;
            newUserReferralCode = generateReferralCode();
            codeAttempts++;
        }
        // Validate referral code if provided
        let referrerId = null;
        const normalizedReferralCode = normalizeOptionalCode(referralCode);
        if (normalizedReferralCode) {
            const referrer = await prisma_1.prisma.user.findUnique({
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
            const createUser = async (tx) => {
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
                ? await prisma_1.prisma.$transaction((tx) => createUser(tx))
                : await createUser(prisma_1.prisma);
        }
        catch (err) {
            // Race window: two concurrent registrations for the same email both
            // passed the findUnique check, and one of them lost the unique race.
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                const target = Array.isArray(err.meta?.target) ? err.meta.target : [];
                if (target.includes('email')) {
                    throw new errorHandler_1.ApiError(409, 'Email already registered');
                }
                throw new errorHandler_1.ApiError(409, 'Could not create a unique account code. Please try again.');
            }
            throw err;
        }
        // Store verification token
        await prisma_1.prisma.verificationToken.create({
            data: {
                userId: user.id,
                token: (0, opaqueToken_1.hashOpaqueToken)(verificationToken),
                type: 'EMAIL_VERIFICATION',
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
            },
        });
        // Create referral record if user was referred
        if (referrerId) {
            await prisma_1.prisma.referral.create({
                data: {
                    referrerId: referrerId,
                    referredId: user.id,
                    status: 'PENDING',
                    signupSource: 'registration',
                },
            });
            // Grant initial credits to referred user (referrer gets credits on completion)
            await prisma_1.prisma.user.update({
                where: { id: user.id },
                data: { referralCredits: { increment: 100 } },
            });
            // Notify the referrer that someone signed up using their code
            await prisma_1.prisma.notification.create({
                data: {
                    userId: referrerId,
                    type: 'SYSTEM',
                    title: '🎉 New Referral!',
                    message: `${firstName} ${lastName} just signed up using your referral link! You'll receive 100 credits once they verify their email.`,
                    link: '/dashboard/referrals',
                },
            });
        }
        await requireAuthEmailDelivery(() => (0, email_1.sendVerificationEmail)(email, firstName, verificationToken), 'Verification email could not be sent. Please try resending verification later.', { userId: user.id, email });
        res.status(201).json({
            success: true,
            message: 'Registration successful. Please check your email to verify your account.',
            data: {
                user,
                verificationRequired: true,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
router.post('/login', [
    (0, express_validator_1.body)('email').isEmail().isLength({ max: 254 }).normalizeEmail(),
    (0, express_validator_1.body)('password')
        .isString()
        .isLength({ min: 1, max: PASSWORD_MAX_LENGTH })
        .withMessage(`Password must be ${PASSWORD_MAX_LENGTH} characters or fewer`),
    (0, express_validator_1.body)('twoFactorCode')
        .optional()
        .isString()
        .isLength({ min: 6, max: 32 })
        .withMessage('Two-factor code must be 6 digits'),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const { email, password } = req.body;
        const ipAddress = req.ip;
        // Account lockout — reject early so we don't leak timing info or burn bcrypt cycles
        // on accounts that have already been flagged. Falls back to allow when Redis is down.
        const lockStatus = await (0, loginAttempts_1.getLockoutStatus)(email, ipAddress);
        if (lockStatus.locked) {
            const minutes = Math.max(1, Math.ceil(lockStatus.retryAfterSeconds / 60));
            throw new errorHandler_1.ApiError(429, `Too many failed login attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`);
        }
        const user = await prisma_1.prisma.user.findUnique({
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
                twoFactorEnabled: true,
                twoFactorSecret: true,
                twoFactorEnabledAt: true,
            },
        });
        // Always run bcrypt — constant-time defence against email enumeration.
        const passwordHashToCompare = user?.passwordHash || password_1.DUMMY_PASSWORD_HASH;
        const isValidPassword = await (0, password_1.comparePassword)(password, passwordHashToCompare);
        if (!user || !user.passwordHash || !isValidPassword) {
            const nextLockoutStatus = await (0, loginAttempts_1.recordFailedLogin)(email, ipAddress);
            if (nextLockoutStatus.locked) {
                const minutes = Math.max(1, Math.ceil(nextLockoutStatus.retryAfterSeconds / 60));
                throw new errorHandler_1.ApiError(429, `Too many failed login attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`);
            }
            throw new errorHandler_1.ApiError(401, 'Invalid email or password');
        }
        if (!user.emailVerified) {
            throw new errorHandler_1.ApiError(403, 'Please verify your email before signing in.');
        }
        if (user.twoFactorEnabled) {
            const twoFactorCode = (0, totp_1.normalizeTotpCode)(req.body.twoFactorCode);
            if (!twoFactorCode) {
                throw new errorHandler_1.ApiError(401, 'Two-factor code required');
            }
            if (!user.twoFactorSecret || !(0, totp_1.verifyTotpCode)(twoFactorCode, user.twoFactorSecret)) {
                await (0, loginAttempts_1.recordFailedLogin)(email, ipAddress);
                throw new errorHandler_1.ApiError(401, 'Invalid two-factor code');
            }
        }
        // Successful credentials — clear any tracked failures.
        await (0, loginAttempts_1.clearFailedLogins)(email, ipAddress);
        await prisma_1.prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
        });
        const tokenPayload = {
            userId: user.id,
            email: user.email,
            role: user.role,
            persona: user.persona,
        };
        const accessToken = (0, jwt_1.generateAccessToken)(tokenPayload);
        const refreshToken = (0, jwt_1.generateRefreshToken)(tokenPayload);
        const cookieOptions = getRefreshTokenCookieOptions(refreshToken);
        res.cookie('refreshToken', refreshToken, cookieOptions);
        await session_service_1.sessionService.createSession(user.id, accessToken, refreshToken, req.headers['user-agent'], req.ip);
        const { passwordHash: _passwordHash, twoFactorSecret: _twoFactorSecret, ...userWithoutPassword } = user;
        void _passwordHash;
        void _twoFactorSecret;
        res.json({
            success: true,
            message: 'Login successful',
            data: buildAuthResponseData(accessToken, userWithoutPassword),
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// GOOGLE AUTH
// ===========================================
router.post('/google', [
    (0, express_validator_1.body)('credential').optional().isString().isLength({ min: 1, max: EXTERNAL_AUTH_TOKEN_MAX_LENGTH }),
    (0, express_validator_1.body)('idToken').optional().isString().isLength({ min: 1, max: EXTERNAL_AUTH_TOKEN_MAX_LENGTH }),
    (0, express_validator_1.body)().custom((value) => {
        if (!value?.credential && !value?.idToken) {
            throw new Error('Google credential required');
        }
        return true;
    }),
    (0, express_validator_1.body)('mode').optional().isIn(['login', 'register']),
    (0, express_validator_1.body)('womanSelfAttested').optional().isBoolean(),
    (0, express_validator_1.body)('inviteCode')
        .optional({ checkFalsy: true })
        .isString()
        .trim()
        .isLength({ min: 4, max: 32 })
        .matches(AUTH_CODE_PATTERN)
        .withMessage('Invite codes can only include letters, numbers, and dashes'),
    (0, express_validator_1.body)('persona')
        .optional({ checkFalsy: true })
        .customSanitizer((v) => (typeof v === 'string' ? v.trim().toUpperCase() : v))
        .isIn(PERSONA_VALUES),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim();
        if (!googleClientId) {
            throw new errorHandler_1.ApiError(503, 'Google sign-in is not configured');
        }
        const googleIdentityToken = String(req.body.credential || req.body.idToken);
        const googleResponse = await fetchWithTimeout(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(googleIdentityToken)}`);
        if (!googleResponse.ok) {
            throw new errorHandler_1.ApiError(401, 'Invalid Google credential');
        }
        const googleProfile = (await googleResponse.json());
        const emailVerified = googleProfile.email_verified === true || googleProfile.email_verified === 'true';
        if (googleProfile.aud !== googleClientId) {
            throw new errorHandler_1.ApiError(401, 'Google credential audience mismatch');
        }
        if (!googleProfile.sub || !googleProfile.email || !emailVerified) {
            throw new errorHandler_1.ApiError(400, 'Google account email must be verified');
        }
        const mode = req.body?.mode === 'register' ? 'register' : 'login';
        const email = String(googleProfile.email).trim().toLowerCase();
        const profileName = (googleProfile.name || '').trim();
        const nameParts = profileName.split(/\s+/).filter(Boolean);
        const firstName = sanitizeName(googleProfile.given_name || nameParts[0], 'ATHENA');
        const lastName = sanitizeName(googleProfile.family_name || nameParts.slice(1).join(' '), 'Member');
        const displayName = sanitizeName(profileName, `${firstName} ${lastName}`.trim());
        const rawPersona = req.body?.persona;
        const persona = typeof rawPersona === 'string' && rawPersona.trim()
            ? rawPersona.trim().toUpperCase()
            : client_1.Persona.EARLY_CAREER;
        const linkedGoogleRows = await prisma_1.prisma.$queryRaw `
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
            twoFactorEnabled: true,
        };
        const existingEmailUser = await prisma_1.prisma.user.findUnique({
            where: { email },
            select: {
                ...selectUser,
                emailVerifiedAt: true,
            },
        });
        let user = null;
        let created = false;
        if (linkedGoogleRows[0]?.id) {
            user = await prisma_1.prisma.user.update({
                where: { id: linkedGoogleRows[0].id },
                data: {
                    emailVerified: true,
                    emailVerifiedAt: new Date(),
                    lastLoginAt: new Date(),
                    avatar: existingEmailUser?.avatar || googleProfile.picture || undefined,
                },
                select: selectUser,
            });
        }
        else if (existingEmailUser) {
            await prisma_1.prisma.$executeRaw `
          UPDATE "User"
          SET "googleId" = ${googleProfile.sub}
          WHERE "id" = ${existingEmailUser.id}
        `;
            user = await prisma_1.prisma.user.update({
                where: { id: existingEmailUser.id },
                data: {
                    emailVerified: true,
                    emailVerifiedAt: existingEmailUser.emailVerifiedAt ?? new Date(),
                    lastLoginAt: new Date(),
                    avatar: existingEmailUser.avatar || googleProfile.picture || undefined,
                },
                select: selectUser,
            });
        }
        else {
            if (mode !== 'register') {
                throw new errorHandler_1.ApiError(404, 'No ATHENA account exists for this Google email. Please create an account first.');
            }
            if (req.body?.womanSelfAttested !== true) {
                throw new errorHandler_1.ApiError(400, 'You must confirm you are a woman to join ATHENA');
            }
            const inviteRecord = await findUsableInviteCode(req.body?.inviteCode);
            const generateReferralCode = () => crypto_1.default.randomBytes(8).toString('hex').toUpperCase();
            let referralCode = generateReferralCode();
            let codeAttempts = 0;
            while (codeAttempts < 10) {
                const existingCode = await prisma_1.prisma.user.findUnique({ where: { referralCode } });
                if (!existingCode)
                    break;
                referralCode = generateReferralCode();
                codeAttempts += 1;
            }
            const createSocialUser = async (tx) => {
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
                ? await prisma_1.prisma.$transaction((tx) => createSocialUser(tx))
                : await createSocialUser(prisma_1.prisma);
            await prisma_1.prisma.$executeRaw `
          UPDATE "User"
          SET "googleId" = ${googleProfile.sub}
          WHERE "id" = ${user.id}
        `;
            sendBestEffortAuthEmail('Welcome email after Google sign-up', () => (0, email_1.sendWelcomeEmail)(email, firstName), { userId: user.id, email });
            created = true;
        }
        if (!user) {
            throw new errorHandler_1.ApiError(500, 'Google sign-in failed');
        }
        if (!created && user.twoFactorEnabled) {
            throw new errorHandler_1.ApiError(401, 'Two-factor code required. Please sign in with email and password.');
        }
        const tokenPayload = {
            userId: user.id,
            email: user.email,
            role: user.role,
            persona: user.persona,
        };
        const accessToken = (0, jwt_1.generateAccessToken)(tokenPayload);
        const refreshToken = (0, jwt_1.generateRefreshToken)(tokenPayload);
        const cookieOptions = getRefreshTokenCookieOptions(refreshToken);
        res.cookie('refreshToken', refreshToken, cookieOptions);
        await session_service_1.sessionService.createSession(user.id, accessToken, refreshToken, req.headers['user-agent'], req.ip);
        res.status(created ? 201 : 200).json({
            success: true,
            message: created ? 'Google sign-up successful' : 'Google sign-in successful',
            data: buildAuthResponseData(accessToken, user),
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// FACEBOOK AUTH
// ===========================================
router.post('/facebook', [
    (0, express_validator_1.body)('accessToken').isString().isLength({ min: 1, max: EXTERNAL_AUTH_TOKEN_MAX_LENGTH }),
    (0, express_validator_1.body)('mode').optional().isIn(['login', 'register']),
    (0, express_validator_1.body)('womanSelfAttested').optional().isBoolean(),
    (0, express_validator_1.body)('inviteCode')
        .optional({ checkFalsy: true })
        .isString()
        .trim()
        .isLength({ min: 4, max: 32 })
        .matches(AUTH_CODE_PATTERN)
        .withMessage('Invite codes can only include letters, numbers, and dashes'),
    (0, express_validator_1.body)('persona')
        .optional({ checkFalsy: true })
        .customSanitizer((v) => (typeof v === 'string' ? v.trim().toUpperCase() : v))
        .isIn(PERSONA_VALUES),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const facebookAppId = process.env.FACEBOOK_APP_ID?.trim();
        const facebookAppSecret = process.env.FACEBOOK_APP_SECRET?.trim();
        if (!facebookAppId || !facebookAppSecret) {
            throw new errorHandler_1.ApiError(503, 'Facebook sign-in is not configured');
        }
        const userAccessToken = String(req.body.accessToken);
        const appAccessToken = `${facebookAppId}|${facebookAppSecret}`;
        // Verify token with Facebook's debug_token endpoint to confirm it belongs to our app.
        const debugResp = await fetchWithTimeout(`https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(userAccessToken)}&access_token=${encodeURIComponent(appAccessToken)}`);
        if (!debugResp.ok) {
            throw new errorHandler_1.ApiError(401, 'Invalid Facebook credential');
        }
        const debugPayload = (await debugResp.json());
        const debugData = debugPayload.data;
        if (!debugData || debugData.is_valid !== true) {
            throw new errorHandler_1.ApiError(401, 'Invalid or expired Facebook token');
        }
        if (debugData.app_id !== facebookAppId) {
            throw new errorHandler_1.ApiError(401, 'Facebook credential app mismatch');
        }
        if (!debugData.user_id) {
            throw new errorHandler_1.ApiError(401, 'Facebook credential missing user id');
        }
        // Fetch basic profile.
        const meResp = await fetchWithTimeout(`https://graph.facebook.com/v19.0/me?fields=${encodeURIComponent('id,email,first_name,last_name,name,picture.type(large)')}&access_token=${encodeURIComponent(userAccessToken)}`);
        if (!meResp.ok) {
            throw new errorHandler_1.ApiError(401, 'Unable to read Facebook profile');
        }
        const fbProfile = (await meResp.json());
        if (!fbProfile.id || fbProfile.id !== debugData.user_id) {
            throw new errorHandler_1.ApiError(401, 'Facebook profile mismatch');
        }
        if (!fbProfile.email) {
            throw new errorHandler_1.ApiError(400, 'Facebook account must share an email to join ATHENA');
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
        const fbPersona = typeof fbRawPersona === 'string' && fbRawPersona.trim()
            ? fbRawPersona.trim().toUpperCase()
            : client_1.Persona.EARLY_CAREER;
        const linkedFbRows = await prisma_1.prisma.$queryRaw `
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
            twoFactorEnabled: true,
        };
        const existingFbEmailUser = await prisma_1.prisma.user.findUnique({
            where: { email: fbEmail },
            select: { ...fbSelectUser, emailVerifiedAt: true },
        });
        let fbUser = null;
        let fbCreated = false;
        if (linkedFbRows[0]?.id) {
            fbUser = await prisma_1.prisma.user.update({
                where: { id: linkedFbRows[0].id },
                data: {
                    emailVerified: true,
                    emailVerifiedAt: new Date(),
                    lastLoginAt: new Date(),
                    avatar: existingFbEmailUser?.avatar || fbAvatarUrl || undefined,
                },
                select: fbSelectUser,
            });
        }
        else if (existingFbEmailUser) {
            await prisma_1.prisma.$executeRaw `
          UPDATE "User"
          SET "facebookId" = ${fbProfile.id}
          WHERE "id" = ${existingFbEmailUser.id}
        `;
            fbUser = await prisma_1.prisma.user.update({
                where: { id: existingFbEmailUser.id },
                data: {
                    emailVerified: true,
                    emailVerifiedAt: existingFbEmailUser.emailVerifiedAt ?? new Date(),
                    lastLoginAt: new Date(),
                    avatar: existingFbEmailUser.avatar || fbAvatarUrl || undefined,
                },
                select: fbSelectUser,
            });
        }
        else {
            if (fbMode !== 'register') {
                throw new errorHandler_1.ApiError(404, 'No ATHENA account exists for this Facebook email. Please create an account first.');
            }
            if (req.body?.womanSelfAttested !== true) {
                throw new errorHandler_1.ApiError(400, 'You must confirm you are a woman to join ATHENA');
            }
            const fbInviteRecord = await findUsableInviteCode(req.body?.inviteCode);
            const fbGenerateReferralCode = () => crypto_1.default.randomBytes(8).toString('hex').toUpperCase();
            let fbReferralCode = fbGenerateReferralCode();
            let fbCodeAttempts = 0;
            while (fbCodeAttempts < 10) {
                const existingCode = await prisma_1.prisma.user.findUnique({ where: { referralCode: fbReferralCode } });
                if (!existingCode)
                    break;
                fbReferralCode = fbGenerateReferralCode();
                fbCodeAttempts += 1;
            }
            const createFacebookUser = async (tx) => {
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
                ? await prisma_1.prisma.$transaction((tx) => createFacebookUser(tx))
                : await createFacebookUser(prisma_1.prisma);
            await prisma_1.prisma.$executeRaw `
          UPDATE "User"
          SET "facebookId" = ${fbProfile.id}
          WHERE "id" = ${fbUser.id}
        `;
            sendBestEffortAuthEmail('Welcome email after Facebook sign-up', () => (0, email_1.sendWelcomeEmail)(fbEmail, fbFirstName), { userId: fbUser.id, email: fbEmail });
            fbCreated = true;
        }
        if (!fbUser) {
            throw new errorHandler_1.ApiError(500, 'Facebook sign-in failed');
        }
        if (!fbCreated && fbUser.twoFactorEnabled) {
            throw new errorHandler_1.ApiError(401, 'Two-factor code required. Please sign in with email and password.');
        }
        const fbTokenPayload = {
            userId: fbUser.id,
            email: fbUser.email,
            role: fbUser.role,
            persona: fbUser.persona,
        };
        const fbAccessTokenJwt = (0, jwt_1.generateAccessToken)(fbTokenPayload);
        const fbRefreshToken = (0, jwt_1.generateRefreshToken)(fbTokenPayload);
        const fbCookieOptions = getRefreshTokenCookieOptions(fbRefreshToken);
        res.cookie('refreshToken', fbRefreshToken, fbCookieOptions);
        await session_service_1.sessionService.createSession(fbUser.id, fbAccessTokenJwt, fbRefreshToken, req.headers['user-agent'], req.ip);
        res.status(fbCreated ? 201 : 200).json({
            success: true,
            message: fbCreated ? 'Facebook sign-up successful' : 'Facebook sign-in successful',
            data: buildAuthResponseData(fbAccessTokenJwt, fbUser),
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// REFRESH TOKEN
// ===========================================
router.post('/refresh', async (req, res, next) => {
    try {
        enforceTrustedRefreshCookieRequest(req);
        // Cookie-only refresh — body-supplied tokens are a CSRF channel.
        // (Outside production we also accept the body so test tooling keeps working.)
        const refreshToken = req.cookies?.refreshToken ||
            (process.env.NODE_ENV !== 'production' ? req.body?.refreshToken : undefined);
        if (!refreshToken) {
            throw new errorHandler_1.ApiError(400, 'Refresh token required');
        }
        // Verify refresh token
        const decoded = (0, jwt_1.verifyToken)(refreshToken);
        // Find session
        const session = await session_service_1.sessionService.findActiveSessionByRefreshToken(refreshToken);
        if (!session || session.userId !== decoded.userId) {
            // If this token previously belonged to a *revoked* session, it's a
            // replay of a rotated token — treat as compromise and burn every
            // session for that user.
            const compromisedUserId = await session_service_1.sessionService.detectRefreshTokenReuse(refreshToken);
            if (compromisedUserId) {
                res.clearCookie('refreshToken', getRefreshTokenClearCookieOptions());
            }
            throw new errorHandler_1.ApiError(401, 'Invalid refresh token');
        }
        // Get user
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: decoded.userId },
            select: { id: true, email: true, role: true, persona: true },
        });
        if (!user) {
            throw new errorHandler_1.ApiError(401, 'User not found');
        }
        // Generate new tokens
        const tokenPayload = {
            userId: user.id,
            email: user.email,
            role: user.role,
            persona: user.persona,
        };
        const newAccessToken = (0, jwt_1.generateAccessToken)(tokenPayload);
        const newRefreshToken = (0, jwt_1.generateRefreshToken)(tokenPayload);
        // Rotate tokens using session service (revokes old, creates new)
        try {
            await session_service_1.sessionService.rotateRefreshToken(refreshToken, newAccessToken, newRefreshToken, req.headers['user-agent'], req.ip);
        }
        catch (err) {
            logger_1.logger.error('Failed to rotate refresh token', { error: err?.message || err, stack: err?.stack });
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
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// LOGOUT
// ===========================================
router.post('/logout', async (req, res, next) => {
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
                const session = await session_service_1.sessionService.findActiveSessionByAccessToken(accessToken);
                if (session)
                    await session_service_1.sessionService.revokeSession(session.id);
            }
        }
        catch (err) {
            logger_1.logger.warn('Logout: access-token session revoke failed', { error: err?.message });
        }
        try {
            if (refreshToken) {
                const session = await session_service_1.sessionService.findActiveSessionByRefreshToken(refreshToken);
                if (session)
                    await session_service_1.sessionService.revokeSession(session.id);
            }
        }
        catch (err) {
            logger_1.logger.warn('Logout: refresh-token session revoke failed', { error: err?.message });
        }
        // Always clear the cookie.
        res.clearCookie('refreshToken', getRefreshTokenClearCookieOptions());
        res.json({
            success: true,
            message: 'Logged out successfully',
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// CHANGE PASSWORD
// ===========================================
router.post('/change-password', auth_1.authenticate, [
    (0, express_validator_1.body)('currentPassword')
        .isString()
        .isLength({ min: 1, max: PASSWORD_MAX_LENGTH })
        .withMessage('Current password is required'),
    (0, express_validator_1.body)('newPassword')
        .isLength({ min: PASSWORD_MIN_LENGTH, max: PASSWORD_MAX_LENGTH })
        .withMessage(`Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters`)
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const { currentPassword, newPassword } = req.body;
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: req.user.id },
            select: { id: true, passwordHash: true },
        });
        if (!user?.passwordHash) {
            throw new errorHandler_1.ApiError(400, 'Password change is unavailable for this account');
        }
        const isCurrentPasswordValid = await (0, password_1.comparePassword)(currentPassword, user.passwordHash);
        if (!isCurrentPasswordValid) {
            throw new errorHandler_1.ApiError(401, 'Current password is incorrect');
        }
        const nextPasswordHash = await (0, password_1.hashPassword)(newPassword);
        await prisma_1.prisma.user.update({
            where: { id: user.id },
            data: { passwordHash: nextPasswordHash },
        });
        const authHeader = req.headers.authorization;
        const accessToken = authHeader?.startsWith('Bearer ')
            ? authHeader.split(' ')[1]
            : undefined;
        const currentSession = accessToken
            ? await session_service_1.sessionService.findActiveSessionByAccessToken(accessToken)
            : null;
        await prisma_1.prisma.session.updateMany({
            where: {
                userId: user.id,
                revokedAt: null,
                ...(currentSession ? { id: { not: currentSession.id } } : {}),
            },
            data: { revokedAt: new Date() },
        });
        res.json({
            success: true,
            message: 'Password changed successfully',
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// TWO-FACTOR AUTHENTICATION
// ===========================================
router.get('/2fa/status', auth_1.authenticate, async (req, res, next) => {
    try {
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                twoFactorEnabled: true,
                twoFactorEnabledAt: true,
                twoFactorSecret: true,
            },
        });
        if (!user) {
            throw new errorHandler_1.ApiError(404, 'User not found');
        }
        res.json({
            success: true,
            data: {
                enabled: user.twoFactorEnabled,
                enabledAt: user.twoFactorEnabledAt,
                setupPending: Boolean(user.twoFactorSecret && !user.twoFactorEnabled),
            },
        });
    }
    catch (error) {
        next(error);
    }
});
router.post('/2fa/setup', auth_1.authenticate, async (req, res, next) => {
    try {
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                email: true,
                twoFactorEnabled: true,
            },
        });
        if (!user) {
            throw new errorHandler_1.ApiError(404, 'User not found');
        }
        if (user.twoFactorEnabled) {
            throw new errorHandler_1.ApiError(400, 'Two-factor authentication is already enabled');
        }
        const secret = (0, totp_1.generateTotpSecret)();
        await prisma_1.prisma.user.update({
            where: { id: user.id },
            data: {
                twoFactorSecret: secret,
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
                otpauthUrl: (0, totp_1.buildTotpAuthUrl)({
                    issuer: TOTP_ISSUER,
                    accountName: user.email,
                    secret,
                }),
            },
        });
    }
    catch (error) {
        next(error);
    }
});
router.post('/2fa/enable', auth_1.authenticate, [
    (0, express_validator_1.body)('code')
        .isString()
        .isLength({ min: 6, max: 32 })
        .withMessage('Two-factor code is required'),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                twoFactorSecret: true,
            },
        });
        if (!user) {
            throw new errorHandler_1.ApiError(404, 'User not found');
        }
        if (!user.twoFactorSecret) {
            throw new errorHandler_1.ApiError(400, 'Start two-factor setup before enabling it');
        }
        const code = (0, totp_1.normalizeTotpCode)(req.body.code);
        if (!code || !(0, totp_1.verifyTotpCode)(code, user.twoFactorSecret)) {
            throw new errorHandler_1.ApiError(400, 'Invalid two-factor code');
        }
        const enabledAt = new Date();
        await prisma_1.prisma.user.update({
            where: { id: user.id },
            data: {
                twoFactorEnabled: true,
                twoFactorEnabledAt: enabledAt,
            },
        });
        res.json({
            success: true,
            message: 'Two-factor authentication enabled',
            data: {
                enabled: true,
                enabledAt,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
router.post('/2fa/disable', auth_1.authenticate, [
    (0, express_validator_1.body)('currentPassword').optional().isString().isLength({ min: 1, max: PASSWORD_MAX_LENGTH }),
    (0, express_validator_1.body)('code').optional().isString().isLength({ min: 6, max: 32 }),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                passwordHash: true,
                twoFactorEnabled: true,
                twoFactorSecret: true,
            },
        });
        if (!user) {
            throw new errorHandler_1.ApiError(404, 'User not found');
        }
        if (user.passwordHash) {
            const currentPassword = String(req.body.currentPassword ?? '');
            if (!currentPassword) {
                throw new errorHandler_1.ApiError(400, 'Current password is required');
            }
            const isCurrentPasswordValid = await (0, password_1.comparePassword)(currentPassword, user.passwordHash);
            if (!isCurrentPasswordValid) {
                throw new errorHandler_1.ApiError(401, 'Current password is incorrect');
            }
        }
        if (user.twoFactorEnabled) {
            const code = (0, totp_1.normalizeTotpCode)(req.body.code);
            if (!code || !user.twoFactorSecret || !(0, totp_1.verifyTotpCode)(code, user.twoFactorSecret)) {
                throw new errorHandler_1.ApiError(400, 'Invalid two-factor code');
            }
        }
        await prisma_1.prisma.user.update({
            where: { id: user.id },
            data: {
                twoFactorEnabled: false,
                twoFactorSecret: null,
                twoFactorEnabledAt: null,
            },
        });
        res.json({
            success: true,
            message: 'Two-factor authentication disabled',
            data: {
                enabled: false,
                enabledAt: null,
                setupPending: false,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// GET CURRENT USER
// ===========================================
router.get('/me', auth_1.authenticate, async (req, res, next) => {
    try {
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: req.user.id },
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
            throw new errorHandler_1.ApiError(404, 'User not found');
        }
        res.json({
            success: true,
            data: user,
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// FORGOT PASSWORD
// ===========================================
router.post('/forgot-password', [(0, express_validator_1.body)('email').isEmail().isLength({ max: 254 }).normalizeEmail()], async (req, res, next) => {
    try {
        const { email } = req.body;
        const user = await prisma_1.prisma.user.findUnique({ where: { email } });
        // Always return success to prevent email enumeration
        if (user) {
            // Delete any existing password reset tokens
            await prisma_1.prisma.verificationToken.deleteMany({
                where: { userId: user.id, type: 'PASSWORD_RESET' },
            });
            // Generate new reset token
            const resetToken = generateSecureToken();
            await prisma_1.prisma.verificationToken.create({
                data: {
                    userId: user.id,
                    token: (0, opaqueToken_1.hashOpaqueToken)(resetToken),
                    type: 'PASSWORD_RESET',
                    expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
                },
            });
            // Send password reset email. Keep the public response generic to avoid account enumeration.
            const sent = await (0, email_1.sendPasswordResetEmail)(email, user.firstName, resetToken);
            if (!sent) {
                logger_1.logger.error('Password reset email was not accepted by the email provider', {
                    userId: user.id,
                    email,
                });
                await prisma_1.prisma.verificationToken.deleteMany({
                    where: { userId: user.id, type: 'PASSWORD_RESET' },
                });
            }
        }
        res.json({
            success: true,
            message: 'If an account exists, a password reset email will be sent',
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// RESET PASSWORD
// ===========================================
router.post('/reset-password', [
    (0, express_validator_1.body)('token')
        .isString()
        .matches(SECURE_TOKEN_PATTERN)
        .withMessage('Invalid or expired reset token'),
    (0, express_validator_1.body)('password')
        .isLength({ min: PASSWORD_MIN_LENGTH, max: PASSWORD_MAX_LENGTH })
        .withMessage(`Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters`)
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const { token, password } = req.body;
        // Find valid token
        const verificationToken = await findVerificationTokenRecord(token, 'PASSWORD_RESET');
        if (!verificationToken) {
            throw new errorHandler_1.ApiError(400, 'Invalid or expired reset token');
        }
        // Hash new password
        const passwordHash = await (0, password_1.hashPassword)(password);
        // Update user password
        await prisma_1.prisma.user.update({
            where: { id: verificationToken.userId },
            data: { passwordHash },
        });
        // Delete all sessions (force re-login)
        await prisma_1.prisma.session.deleteMany({
            where: { userId: verificationToken.userId },
        });
        // Delete the used token
        await prisma_1.prisma.verificationToken.delete({
            where: { id: verificationToken.id },
        });
        res.json({
            success: true,
            message: 'Password reset successfully. Please log in with your new password.',
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// VERIFY EMAIL
// ===========================================
router.get('/verify-email', async (req, res, next) => {
    try {
        const { token } = req.query;
        await handleVerifyEmailToken(ensureSecureToken(token, 'Verification token'), res);
    }
    catch (error) {
        next(error);
    }
});
router.post('/verify-email', async (req, res, next) => {
    try {
        await handleVerifyEmailToken(ensureSecureToken(req.body?.token, 'Verification token'), res);
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// RESEND VERIFICATION EMAIL
// ===========================================
router.post('/resend-verification', [(0, express_validator_1.body)('email').isEmail().isLength({ max: 254 }).normalizeEmail()], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const email = String(req.body?.email || '').trim().toLowerCase();
        const successMessage = 'If an unverified account exists for that email, a new verification link will be sent.';
        const user = await prisma_1.prisma.user.findUnique({
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
        await prisma_1.prisma.verificationToken.deleteMany({
            where: { userId: user.id, type: 'EMAIL_VERIFICATION' },
        });
        // Generate new token
        const verificationToken = generateSecureToken();
        await prisma_1.prisma.verificationToken.create({
            data: {
                userId: user.id,
                token: (0, opaqueToken_1.hashOpaqueToken)(verificationToken),
                type: 'EMAIL_VERIFICATION',
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
            },
        });
        // Send verification email. Keep the public response generic to avoid account enumeration.
        const sent = await (0, email_1.sendVerificationEmail)(user.email, user.firstName, verificationToken);
        if (!sent) {
            logger_1.logger.error('Resent verification email was not accepted by the email provider', {
                userId: user.id,
                email: user.email,
            });
            await prisma_1.prisma.verificationToken.deleteMany({
                where: { userId: user.id, type: 'EMAIL_VERIFICATION' },
            });
        }
        res.json({
            success: true,
            message: successMessage,
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// GET ACTIVE SESSIONS
// ===========================================
router.get('/sessions', auth_1.authenticate, async (req, res, next) => {
    try {
        const sessions = await session_service_1.sessionService.getUserActiveSessions(req.user.id);
        res.json({
            success: true,
            data: sessions,
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// REVOKE ACTIVE SESSION
// ===========================================
router.delete('/sessions/:sessionId', auth_1.authenticate, async (req, res, next) => {
    try {
        const sessionId = req.params.sessionId?.trim();
        if (!sessionId) {
            throw new errorHandler_1.ApiError(400, 'Session id is required');
        }
        const session = await prisma_1.prisma.session.findFirst({
            where: {
                id: sessionId,
                userId: req.user.id,
                revokedAt: null,
                expiresAt: { gt: new Date() },
            },
            select: { id: true },
        });
        if (!session) {
            throw new errorHandler_1.ApiError(404, 'Session not found');
        }
        await session_service_1.sessionService.revokeSession(session.id);
        res.json({
            success: true,
            message: 'Session revoked',
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// LOGOUT ALL DEVICES
// ===========================================
router.post('/logout-all', auth_1.authenticate, async (req, res, next) => {
    try {
        // Revoke all sessions for the user
        await session_service_1.sessionService.revokeAllUserSessions(req.user.id);
        // Clear refresh token cookie
        res.clearCookie('refreshToken', getRefreshTokenClearCookieOptions());
        res.json({
            success: true,
            message: 'Logged out from all devices successfully',
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=auth.routes.js.map