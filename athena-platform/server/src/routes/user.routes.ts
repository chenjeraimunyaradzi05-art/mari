import { Router, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { z } from 'zod';
import { AuditAction, DSARType, JobType, Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth';
import {
  gdprRegionMiddleware,
  anonymizeIP,
  auditIpAddress,
  dsarRateLimit,
} from '../middleware/gdpr.middleware';
import { indexDocument, deleteDocument, IndexNames } from '../utils/opensearch';
import { getRegionConfig, normalizeRegion } from '../utils/region';
import { isSupportedLocale } from '../config/regions';
import { logger } from '../utils/logger';
import { parsePagination } from '../utils/pagination';
import { notifySocial, socialLinks } from '../utils/social-notifications';
import {
  approvesFollowers,
  isBlockedEitherWay,
  notPrivateProfileWhere,
  profileAccess,
  seesOnlyTheCard,
} from '../services/audience.service';
import { hiddenMemberWhere, viewerContextFor, type ViewerContext } from '../services/search.service';
import { followLimiter, withinTargetLimit } from '../middleware/socialLimits';
import { profileReadLimiter } from '../middleware/rateLimiter';
import {
  DATE_OF_BIRTH_REFUSAL,
  WOMAN_GATE_PURPOSE,
  isPlausibleDateOfBirth,
  meetsMinimumAge,
  readWomanGateEvidence,
} from '../middleware/account-gates';
import { getStripe, isStripeConfigured } from '../utils/stripe';
import { logAudit } from '../utils/audit';
import {
  documentCheckPassedAtOf,
  recordWomanGateDocumentCheck,
  sessionIdOf,
} from '../services/identity-verification.service';
import { httpUrl } from '../utils/http-url';
import { gdprService, describeErasure } from '../services/gdpr.service';
import { auditAfterCommit } from '../services/admin-audit.service';
import { requireStepUp } from './auth.routes';
import { isoDate, parseStrict } from '../utils/request-schema';
import { maskLegalNames, maskLegalNamesInResponses, parseDisplayName, publicName } from '../utils/member-display';

const router = Router();

const REGION_KEYS = ['ANZ', 'US', 'SEA', 'MEA', 'UK', 'EU', 'ROW'] as const;
const CONSENT_FIELDS = [
  'consentMarketing',
  'consentDataProcessing',
  'consentCookies',
  'consentDoNotSell',
] as const;

// ===========================================
// GET CURRENT USER (ME)
// ===========================================
router.get('/me', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
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
        city: true,
        state: true,
        country: true,
        currentJobTitle: true,
        currentCompany: true,
        yearsExperience: true,
        isPublic: true,
        createdAt: true,
        profile: {
          select: {
            aboutMe: true,
            linkedinUrl: true,
            websiteUrl: true,
            openToWork: true,
          },
        },
        skills: {
          include: {
            skill: true,
          },
        },
        _count: {
          select: {
            followers: true,
            following: true,
            posts: true,
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
// WOMEN-ONLY VERIFICATION
// ===========================================
/**
 * The women-only gate, which is the product's premise.
 *
 * What was here before collected nothing: it checked the self-attestation
 * every account already carries, refused anyone without a paid subscription,
 * and set the status to PENDING. The reviewer on the other end then decided a
 * membership from a name, an email and a subscription tier. Meanwhile a
 * working Stripe Identity document-and-selfie check sat in
 * verification.routes.ts, wired only to the ordinary verified badge.
 *
 * Now the request starts that same check, tagged for this purpose, and the
 * result is attached to the member's request as evidence a person can read.
 * The identity check is not treated as the decision: a document proves who she
 * is and how old she is, not that she is a woman, so a reviewer still makes
 * the call — with something in front of her this time.
 *
 * Paying is no longer part of it. Whether ATHENA is a women-only space and
 * whether a member has a card on file are two different questions, and tying
 * them together meant the platform's central promise covered paying members
 * only.
 */
const WOMAN_GATE_RETURN_PATH = '/dashboard/settings/profile?woman-verification=done';

/** The one pending women-gate submission for this member, if she has made one. */
async function pendingWomanGateBadge(userId: string) {
  return prisma.verificationBadge.findFirst({
    where: {
      userId,
      type: 'IDENTITY',
      status: 'PENDING',
      metadata: { path: ['purpose'], equals: WOMAN_GATE_PURPOSE },
    },
    orderBy: { submittedAt: 'desc' },
    select: { id: true, metadata: true, submittedAt: true },
  });
}

/**
 * Her latest women-gate submission whatever its status. Coming back from Stripe
 * has to find the badge even when the webhook has got there first or a reviewer
 * has already decided, or the page answers "nothing is waiting" to a member
 * whose check went perfectly well.
 */
async function latestWomanGateBadge(userId: string) {
  return prisma.verificationBadge.findFirst({
    where: {
      userId,
      type: 'IDENTITY',
      metadata: { path: ['purpose'], equals: WOMAN_GATE_PURPOSE },
    },
    orderBy: { submittedAt: 'desc' },
    select: { id: true, status: true, metadata: true, submittedAt: true },
  });
}

/**
 * Both gates on this account in one read: how old the platform believes she
 * is, and where her women-only verification stands. The settings page asks one
 * question because a member experiences them as one thing — what is still
 * standing between her and the rest of ATHENA.
 */
router.get('/me/identity-gates', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const [user, badge] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          womanSelfAttested: true,
          womanVerificationStatus: true,
          womanVerifiedAt: true,
          dateOfBirth: true,
          ageVerifiedAt: true,
        },
      }),
      pendingWomanGateBadge(userId),
    ]);

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    res.json({
      success: true,
      data: {
        // The date itself, so she can see what is on file and tell us if it is
        // wrong, rather than being refused by a number she cannot look at.
        dateOfBirth: user.dateOfBirth,
        ageVerifiedAt: user.ageVerifiedAt,
        minimumAgeMet: Boolean(user.dateOfBirth && meetsMinimumAge(user.dateOfBirth)),
        womanVerification: {
          status: user.womanVerificationStatus,
          verifiedAt: user.womanVerifiedAt,
          selfAttested: user.womanSelfAttested,
          // Whether the document check is available decides which of the two
          // forms the settings page shows, so the page never offers a path
          // this deployment cannot actually run.
          identityCheckAvailable: isStripeConfigured(),
          submittedAt: badge?.submittedAt ?? null,
          evidence: badge ? readWomanGateEvidence(badge.metadata) : null,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/me/woman-verification',
  authenticate,
  [
    body('method').optional().isIn(['IDENTITY', 'MANUAL']),
    body('statement').optional().isString().trim().isLength({ min: 20, max: 1000 })
      .withMessage('Tell us in a couple of sentences why you are asking, so a reviewer has something to go on.'),
    body('evidenceUrl')
      .optional({ checkFalsy: true })
      .isString()
      .trim()
      .isLength({ max: 2048 })
      .isURL({ protocols: ['https'], require_protocol: true })
      .withMessage('A link to supporting evidence has to be a full https address'),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const userId = req.user!.id;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, womanSelfAttested: true, womanVerificationStatus: true },
      });

      if (!user) {
        throw new ApiError(404, 'User not found');
      }

      if (!user.womanSelfAttested) {
        throw new ApiError(403, 'Women-only verification requires self-attestation');
      }

      if (user.womanVerificationStatus === 'VERIFIED') {
        return res.json({ success: true, status: 'VERIFIED' });
      }

      // A refusal a member can undo herself is not a refusal. Re-requesting from
      // REJECTED used to set the status back to PENDING, and because the
      // women-only floor refuses only REJECTED, one request reopened every
      // surface the reviewer had just closed. Appeals exist for exactly this and
      // put the decision back in front of a person rather than the applicant.
      if (user.womanVerificationStatus === 'REJECTED') {
        throw new ApiError(
          403,
          'This check has already been reviewed and refused. If you think that was wrong, open an appeal and a person will look at it again.'
        );
      }

      const statement: string | undefined = req.body.statement;
      const evidenceUrl: string | undefined = req.body.evidenceUrl;
      const identityAvailable = isStripeConfigured();
      const requestedMethod: 'IDENTITY' | 'MANUAL' =
        req.body.method ?? (identityAvailable && !statement ? 'IDENTITY' : 'MANUAL');

      if (requestedMethod === 'IDENTITY' && !identityAvailable) {
        throw new ApiError(
          503,
          'The document check is not set up on this server yet. Write us a short note instead and a person will review it.'
        );
      }

      const existing = await pendingWomanGateBadge(userId);
      const submittedAt = new Date().toISOString();

      if (requestedMethod === 'IDENTITY') {
        const base = (process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
        const session = await getStripe().identity.verificationSessions.create({
          type: 'document',
          metadata: { userId, purpose: WOMAN_GATE_PURPOSE },
          options: { document: { require_matching_selfie: true } },
          return_url: `${base}${WOMAN_GATE_RETURN_PATH}`,
        });

        // One open submission per member, pointed at whichever session is
        // current: a member who abandons the Stripe page and starts again
        // should not leave a queue of half-finished requests behind her.
        const metadata = {
          purpose: WOMAN_GATE_PURPOSE,
          provider: 'stripe_identity',
          sessionId: session.id,
          submittedAt,
        };
        if (existing) {
          await prisma.verificationBadge.update({ where: { id: existing.id }, data: { metadata, reason: null } });
        } else {
          await prisma.verificationBadge.create({
            data: { userId, type: 'IDENTITY', status: 'PENDING', metadata },
          });
        }

        await prisma.user.update({ where: { id: userId }, data: { womanVerificationStatus: 'PENDING' } });

        await logAudit({
          action: 'USER_VERIFICATION_SUBMIT',
          actorUserId: userId,
          targetUserId: userId,
          ipAddress: req.ip,
          userAgent: req.get('user-agent') || undefined,
          metadata: { purpose: WOMAN_GATE_PURPOSE, provider: 'stripe_identity', sessionId: session.id },
        });

        return res.json({
          success: true,
          status: 'PENDING',
          method: 'IDENTITY',
          data: { redirectUrl: session.url, sessionId: session.id },
        });
      }

      if (!statement) {
        throw new ApiError(
          400,
          'Tell us in a couple of sentences why you are asking, so a reviewer has something to go on.'
        );
      }

      const metadata = {
        purpose: WOMAN_GATE_PURPOSE,
        provider: 'manual',
        statement,
        ...(evidenceUrl ? { evidenceUrl } : {}),
        submittedAt,
      };
      if (existing) {
        await prisma.verificationBadge.update({ where: { id: existing.id }, data: { metadata, reason: null } });
      } else {
        await prisma.verificationBadge.create({
          data: { userId, type: 'IDENTITY', status: 'PENDING', metadata },
        });
      }

      await prisma.user.update({ where: { id: userId }, data: { womanVerificationStatus: 'PENDING' } });

      await logAudit({
        action: 'USER_VERIFICATION_SUBMIT',
        actorUserId: userId,
        targetUserId: userId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || undefined,
        metadata: { purpose: WOMAN_GATE_PURPOSE, provider: 'manual' },
      });

      res.json({ success: true, status: 'PENDING', method: 'MANUAL' });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Called when the member comes back from Stripe's hosted check.
 *
 * The webhook is the durable path, but it is a different deployment concern —
 * a missing endpoint secret, a queue backlog — and a woman standing in front of
 * the page she was just returned to should not be told "we are still waiting"
 * about something Stripe already decided. This asks Stripe directly and writes
 * the same result, so the loop closes with or without the webhook.
 */
router.post('/me/woman-verification/complete', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    // The latest submission whatever its status. The webhook may have recorded
    // the result before she got back, and a reviewer may even have decided
    // already; neither is "nothing waiting", and answering 404 to a member
    // whose check went well is what this used to do.
    const badge = await latestWomanGateBadge(userId);

    if (!badge) {
      throw new ApiError(404, 'There is no document check waiting on your account');
    }

    // The gate's own word for where the badge stands, so a late visit to this
    // page reports a decision rather than telling her it is still pending.
    const gateStatus = badge.status === 'APPROVED' ? 'VERIFIED' : badge.status === 'REJECTED' ? 'REJECTED' : 'PENDING';

    // Already recorded, by the webhook or by an earlier visit: say so again
    // without asking Stripe anything. This is also what keeps a second call
    // from writing the result and notifying her twice.
    if (documentCheckPassedAtOf(badge.metadata)) {
      return res.json({ success: true, status: gateStatus, data: { documentCheck: 'verified' } });
    }

    const sessionId = sessionIdOf(badge.metadata);
    if (!sessionId || badge.status !== 'PENDING') {
      throw new ApiError(404, 'There is no document check waiting on your account');
    }

    if (!isStripeConfigured()) {
      throw new ApiError(503, 'The document check is not set up on this server');
    }

    const check = await recordWomanGateDocumentCheck(userId, badge, sessionId);

    if (check.outcome === 'not_ready') {
      return res.json({
        success: true,
        status: 'PENDING',
        data: { documentCheck: check.documentCheck, reason: check.reason },
      });
    }

    res.json({ success: true, status: 'PENDING', data: { documentCheck: 'verified' } });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// DATE OF BIRTH
// ===========================================
/**
 * Set once, by the member, and then only staff or a document check may change
 * it. Accounts created before the column existed have none, and the age gate
 * treats that as "not permitted" rather than waving them through, so this is
 * the door back in for them. It is deliberately not part of PATCH /me: a
 * birthday that can be edited at will is not an age check, it is a preference.
 */
router.post(
  '/me/date-of-birth',
  authenticate,
  [body('dateOfBirth').isISO8601().withMessage(DATE_OF_BIRTH_REFUSAL)],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const userId = req.user!.id;
      const existing = await prisma.user.findUnique({ where: { id: userId }, select: { dateOfBirth: true } });
      if (!existing) {
        throw new ApiError(404, 'User not found');
      }
      if (existing.dateOfBirth) {
        throw new ApiError(409, 'Your date of birth is already on file. Contact support if it is wrong.');
      }

      const dateOfBirth = new Date(req.body.dateOfBirth);
      if (!isPlausibleDateOfBirth(dateOfBirth) || !meetsMinimumAge(dateOfBirth)) {
        throw new ApiError(400, DATE_OF_BIRTH_REFUSAL);
      }

      await prisma.user.update({ where: { id: userId }, data: { dateOfBirth } });

      res.json({ success: true, message: 'Date of birth saved', data: { dateOfBirth } });
    } catch (error) {
      next(error);
    }
  }
);

// Helper to sync user data to OpenSearch
const syncUserToIndex = async (userId: string) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        displayName: true,
        headline: true,
        bio: true,
        role: true,
        city: true,
        country: true,
        avatar: true,
        isPublic: true,
      },
    });

    if (!user) return;
    if (!user.isPublic) {
      // If user became private, ensure they are removed from index
      await deleteDocument(IndexNames.USERS, user.id);
      return;
    }

    const startSkills = await prisma.userSkill.findMany({
      where: { userId },
      include: { skill: true },
    });

    const doc = {
      ...user,
      skills: startSkills.map(s => s.skill.name),
    };

    await indexDocument(IndexNames.USERS, user.id, doc);
  } catch (error) {
    logger.error(`Failed to sync user ${userId} to OpenSearch`, { error });
  }
};

// ===========================================
// DOWNLOAD MY DATA (DSAR Export)
// ===========================================
router.get(
  '/me/export',
  authenticate,
  gdprRegionMiddleware,
  anonymizeIP,
  // The same right as POST /api/gdpr/dsar/export, so the same quota: a member
  // must not be able to sidestep the throttle by using the older route.
  dsarRateLimit(5, 60 * 60 * 1000, 'dsar-export'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;

    const [
      user,
      profile,
      skills,
      education,
      experience,
      posts,
      comments,
      likes,
      followers,
      following,
      jobApplications,
      savedJobs,
      courseEnrollments,
      mentorSessions,
      educationApplications,
      organizationMemberships,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          emailVerified: true,
          emailVerifiedAt: true,
          firstName: true,
          lastName: true,
          displayName: true,
          avatar: true,
          bio: true,
          headline: true,
          role: true,
          persona: true,
          // What she told us, and whether a document check confirmed it: the
          // age on her account is personal information held about her.
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
          currentJobTitle: true,
          currentCompany: true,
          yearsExperience: true,
          isPublic: true,
          allowMessages: true,
          isSuspended: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true,
          referralCode: true,
          referralCredits: true,
        },
      }),
      prisma.profile.findUnique({ where: { userId } }),
      prisma.userSkill.findMany({
        where: { userId },
        include: { skill: true },
        orderBy: { endorsed: 'desc' },
      }),
      prisma.education.findMany({ where: { userId }, orderBy: { startDate: 'desc' } }),
      prisma.workExperience.findMany({ where: { userId }, orderBy: { startDate: 'desc' } }),
      prisma.post.findMany({ where: { authorId: userId }, orderBy: { createdAt: 'desc' } }),
      prisma.comment.findMany({ where: { authorId: userId }, orderBy: { createdAt: 'desc' } }),
      prisma.like.findMany({
        where: { userId },
        include: {
          post: {
            select: { id: true, authorId: true, content: true, createdAt: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      // The other members in her export (who follows her, whom she follows, the
      // mentor she booked) are named as the app names them to her: by their public
      // name, never the legal surname (utils/member-display). It used to load
      // `lastName` for each of them and hand the file over as it was, so a member's
      // own download listed every follower's legal name, which is the one thing
      // the public name exists to keep off the page.
      prisma.follow.findMany({
        where: { followingId: userId },
        include: {
          follower: { select: { id: true, firstName: true, displayName: true, avatar: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.follow.findMany({
        where: { followerId: userId },
        include: {
          following: { select: { id: true, firstName: true, displayName: true, avatar: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.jobApplication.findMany({
        where: { userId },
        include: {
          job: {
            select: {
              id: true,
              title: true,
              slug: true,
              organizationId: true,
              createdAt: true,
            },
          },
        },
        orderBy: { appliedAt: 'desc' },
      }),
      prisma.savedJob.findMany({
        where: { userId },
        include: {
          job: {
            select: {
              id: true,
              title: true,
              slug: true,
              organizationId: true,
              createdAt: true,
            },
          },
        },
        orderBy: { savedAt: 'desc' },
      }),
      prisma.courseEnrollment.findMany({
        where: { userId },
        include: {
          course: {
            select: {
              id: true,
              title: true,
              slug: true,
              organizationId: true,
              providerName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.mentorSession.findMany({
        where: { menteeId: userId },
        include: {
          mentorProfile: {
            include: {
              user: { select: { id: true, firstName: true, displayName: true, avatar: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.educationApplication.findMany({
        where: { userId },
        include: {
          organization: { select: { id: true, name: true, slug: true, type: true } },
          course: { select: { id: true, title: true, slug: true } },
        },
        orderBy: { submittedAt: 'desc' },
      }),
      prisma.organizationMember.findMany({
        where: { userId },
        include: {
          organization: { select: { id: true, name: true, slug: true, type: true } },
        },
        orderBy: { invitedAt: 'desc' },
      }),
    ]);

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    await prisma.auditLog.create({
      data: {
        action: 'DSAR_EXPORT',
        actorUserId: userId,
        targetUserId: userId,
        // Truncated inside the GDPR footprint: an accountability record does not
        // need a full address to place the request.
        ipAddress: auditIpAddress(req) || undefined,
        userAgent: req.get('user-agent') || undefined,
        metadata: {
          exportedAt: new Date().toISOString(),
        },
      },
    });

    // Her own record is hers to read whole; every other member's record in the
    // file carries the public name and an empty surname, whatever a select above
    // loads tomorrow.
    res.json({
      success: true,
      data: maskLegalNames(
        {
          exportedAt: new Date().toISOString(),
          user,
          profile,
          skills,
          education,
          experience,
          posts,
          comments,
          likes,
          followers,
          following,
          jobApplications,
          savedJobs,
          courseEnrollments,
          mentorSessions,
          educationApplications,
          organizationMemberships,
        },
        userId
      ),
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// DELETE ACCOUNT
// ===========================================
/**
 * Closing her own account, from Settings.
 *
 * This used to be a transaction of its own: a hand-written anonymisation of the
 * User row and about ten tables. It left her posts, messages, health and safety
 * records, bank connections and verification records where they were while the
 * screen said all associated data was gone, and it deleted her local
 * Subscription row, and with it the only copy of the Stripe subscription id, so
 * the card went on being charged. Two doors that do different things to the same
 * woman's data is not a privacy position, so this is now the data-rights
 * erasure under another name: the same request row, the same walk of the
 * personal-data register, the same refusal under a legal hold, and the same
 * ending of her billing at Stripe (gdpr.service.ts, eraseUser). POST
 * /api/gdpr/dsar/delete is the other door and does exactly the same.
 *
 * It cannot be undone, and it is also how someone who had got into the account
 * would destroy the trail of it, so it asks again for her password, and for her
 * second factor when that is on (requireStepUp). One that is refused, for a
 * hold or for billing that could not be ended, is a 409 with nothing erased.
 */
router.delete(
  '/me',
  authenticate,
  // The same bucket as the data-rights route, so using this door is not a way
  // round that route's limit.
  dsarRateLimit(5, 60 * 60 * 1000, 'dsar-erasure'),
  [
    body('confirm').isBoolean().custom((v) => v === true).withMessage('Confirmation required'),
    body('currentPassword').optional().isString().isLength({ max: 128 }),
    body('code').optional().isString().isLength({ max: 32 }),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const userId = req.user!.id;

      await requireStepUp(userId, { currentPassword: req.body.currentPassword, code: req.body.code });

      const dsar = await gdprService.createDSARRequest({
        userId,
        type: DSARType.DELETION,
        requestDetails: 'User-initiated account deletion',
      });
      const outcome = await gdprService.processDeletionRequest(dsar.id);

      if (outcome.status === 'REJECTED') {
        throw new ApiError(409, outcome.reason || 'Deletion cannot be carried out at this time');
      }

      // Written after the erasure, so it only claims what happened, and without
      // the member's id: see POST /api/gdpr/dsar/delete, which writes the same row.
      await auditAfterCommit({
        action: AuditAction.ACCOUNT_DELETE,
        metadata: {
          requestId: outcome.requestId,
          accountRemoved: outcome.accountRemoved,
          retainedSections: outcome.retainedSections,
          rowsRemoved: outcome.rowsRemoved,
          completedAt: new Date().toISOString(),
        },
      });

      // Her sessions went with the erasure and the sockets were closed by it
      // (gdpr.service.ts: processDeletionRequest).
      res.json({
        success: true,
        message: describeErasure(outcome),
        data: {
          requestId: outcome.requestId,
          status: 'COMPLETED',
          accountRemoved: outcome.accountRemoved,
          retainedRecords: outcome.retainedSections,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// MENTION SUGGESTIONS
// ===========================================
// The composer's @ autocomplete: a handful of members whose name starts with
// what was typed. People you follow come first, since they are who you are
// most likely to mean. Must sit above /:id or "suggest" is read as a user id.
//
// It used to answer from every active account, so a man she had blocked could
// type her first name into a comment box and be handed her id, her photo and
// her headline — and the id is the key to her profile and her follower lists.
// It now applies the same filter as search: nobody on either side of a block,
// and nobody who asked to be hidden from search. The block list is read, not
// guessed; a failure to read it fails the request, as search does, because an
// empty list standing in for one that could not be read would put him back.
router.get('/suggest', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 40) : '';
    if (q.length < 1) {
      res.json({ success: true, data: [] });
      return;
    }

    const me = req.user!.id;
    const viewer = await viewerContextFor(me);
    // Everyone people search leaves out, which includes a private profile: this
    // box names members by what is typed of their name exactly as the search box
    // does, so if it offered her, search hiding her would be a closed door with
    // the next one standing open.
    const hidden: Prisma.UserWhereInput = { AND: [hiddenMemberWhere(viewer), notPrivateProfileWhere] };

    const select = { id: true, displayName: true, firstName: true, avatar: true, headline: true };
    // Matched on the name a member is shown by: her public name, or, when she has
    // not chosen one, her first name. Her legal first and last name are not
    // searched: a member with a public name was otherwise found, and handed back
    // under it, by typing the surname she had chosen not to show.
    const nameMatch: Prisma.UserWhereInput = {
      OR: [
        { displayName: { startsWith: q, mode: 'insensitive' as const } },
        { displayName: { contains: ` ${q}`, mode: 'insensitive' as const } },
        { AND: [{ OR: [{ displayName: null }, { displayName: '' }] }, { firstName: { startsWith: q, mode: 'insensitive' as const } }] },
      ],
    };

    const [followed, others] = await Promise.all([
      prisma.user.findMany({
        where: { AND: [{ isActive: true, followers: { some: { followerId: me } } }, nameMatch, hidden] },
        select,
        take: 6,
      }),
      prisma.user.findMany({
        where: { AND: [{ isActive: true, id: { not: me } }, nameMatch, hidden] },
        select,
        orderBy: { displayName: 'asc' },
        take: 8,
      }),
    ]);

    const seen = new Set<string>();
    const merged = [...followed, ...others]
      .filter((user) => (seen.has(user.id) ? false : (seen.add(user.id), true)))
      .slice(0, 8)
      .map((user) => ({
        id: user.id,
        name: publicName(user),
        avatar: user.avatar,
        headline: user.headline,
      }));

    res.json({ success: true, data: merged });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// PEOPLE YOU MAY KNOW
// ===========================================
// Members worth following, each with the honest reason they are here:
// followed by people you follow, the same career stage, the same city, or
// simply well followed. Never anyone you already follow or have blocked.
//
// This list used to read only the platform block list and nothing else, so a
// woman in Safe Mode who had asked to be hidden from search was offered by
// name, picture, headline and city ("Also in Brisbane") to everyone in her
// city or career stage, and a member whose profile is private was offered as
// well. It now asks the question search asks: nobody on either side of a block
// in either store, nobody hidden from search, nobody in Safe Mode, and nobody
// whose profile is private. The filter is in each candidate query and in the
// final lookup, and the final lookup reads a pool larger than the page, so a
// member who is filtered out leaves a gap that the next candidate fills rather
// than a short list.
router.get('/suggested', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const viewerId = req.user!.id;
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '6'), 10) || 6, 1), 20);

    // Not best-effort: if the block lists cannot be read the request fails,
    // because an empty list standing in for one that could not be read would
    // offer her a man she had blocked.
    const [me, viewer] = await Promise.all([
      prisma.user.findUnique({ where: { id: viewerId }, select: { persona: true, city: true, state: true } }),
      viewerContextFor(viewerId),
    ]);
    const followingIds = viewer.followingIds;
    const excluded = new Set<string>([viewerId, ...followingIds, ...viewer.blockedIds]);
    const offerable: Prisma.UserWhereInput = { AND: [{ isActive: true }, hiddenMemberWhere(viewer), notPrivateProfileWhere] };

    type Candidate = { score: number; mutuals: string[]; reasons: string[] };
    const candidates = new Map<string, Candidate>();
    const bump = (id: string, points: number, reason?: string, mutual?: string) => {
      if (excluded.has(id)) return;
      const entry = candidates.get(id) ?? { score: 0, mutuals: [], reasons: [] };
      entry.score += points;
      if (reason && !entry.reasons.includes(reason)) entry.reasons.push(reason);
      if (mutual) entry.mutuals.push(mutual);
      candidates.set(id, entry);
    };

    // Second degree: who the people you follow follow.
    if (followingIds.length > 0) {
      const secondDegree = await prisma.follow.findMany({
        where: { followerId: { in: followingIds } },
        select: { followingId: true, follower: { select: { displayName: true, firstName: true } } },
        take: 2000,
      });
      for (const edge of secondDegree) {
        const name = edge.follower.displayName?.trim() || edge.follower.firstName || 'someone you follow';
        bump(edge.followingId, 3, undefined, name);
      }
    }

    // Same stage and same place.
    const select = { id: true, persona: true, city: true, state: true };
    const [samePersona, sameCity] = await Promise.all([
      me?.persona
        ? prisma.user.findMany({ where: { AND: [{ persona: me.persona, id: { notIn: Array.from(excluded) } }, offerable] }, select, take: 60 })
        : Promise.resolve([] as Array<{ id: string; persona: string; city: string | null; state: string | null }>),
      me?.city
        ? prisma.user.findMany({ where: { AND: [{ city: { equals: me.city, mode: 'insensitive' }, id: { notIn: Array.from(excluded) } }, offerable] }, select, take: 60 })
        : Promise.resolve([] as Array<{ id: string; persona: string; city: string | null; state: string | null }>),
    ]);
    for (const user of samePersona) bump(user.id, 2, 'Same career stage as you');
    for (const user of sameCity) bump(user.id, 2, `Also in ${me?.city}`);

    // Well followed members fill the gaps when the graph is thin.
    if (candidates.size < limit * 3) {
      const popular = await prisma.follow.groupBy({
        by: ['followingId'],
        where: { followingId: { notIn: Array.from(excluded) } },
        _count: { _all: true },
        orderBy: { _count: { followingId: 'desc' } },
        take: 40,
      });
      for (const row of popular) bump(row.followingId, Math.min(3, row._count._all / 50), 'Widely followed');
    }

    // The second-degree and popular candidates are bare ids, so the filter can
    // only be applied to them here. The pool is wider than the page for that
    // reason: the page is the first `limit` of the pool that came back.
    const ranked = Array.from(candidates.entries())
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, Math.max(limit * 4, 24));
    if (ranked.length === 0) {
      res.json({ success: true, data: [] });
      return;
    }

    const users = await prisma.user.findMany({
      where: { AND: [{ id: { in: ranked.map(([id]) => id) } }, offerable] },
      select: { id: true, displayName: true, firstName: true, avatar: true, headline: true, persona: true, city: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));

    const data = ranked
      .map(([id, entry]) => {
        const user = byId.get(id);
        if (!user) return null;
        const reasons = [...entry.reasons];
        if (entry.mutuals.length > 0) {
          const [first, ...rest] = Array.from(new Set(entry.mutuals));
          reasons.unshift(rest.length ? `Followed by ${first} and ${rest.length} ${rest.length === 1 ? 'other' : 'others'}` : `Followed by ${first}`);
        }
        return {
          id: user.id,
          name: publicName(user),
          avatar: user.avatar,
          headline: user.headline,
          city: user.city,
          reason: reasons[0] ?? 'Active in the community',
          reasons,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .slice(0, limit);

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// GET USER PROFILE (PUBLIC)
// ===========================================
//
// What a visitor with no account reads here is the card (name, picture,
// headline, counts) and not the record: see anonymousProfileDetail in
// services/audience.service for why, and for the switch. A member who is signed
// in reads the whole of any profile her owner has left public.
//
// Counted per account (profileReadLimiter), so walking the membership one profile
// at a time runs into a wall long before the platform-wide budget does.
// maskLegalNamesInResponses: the answer for anyone but its owner carries her public
// name and no legal first or last name (utils/member-display). The owner reads her own
// record whole.
router.get('/:id', optionalAuth, profileReadLimiter, maskLegalNamesInResponses, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    // optionalAuth reads a token it cannot use (expired, revoked, a closed
    // account) as no token at all, which is right for a page anyone may open and
    // wrong here: a signed-in woman whose access token ran out a moment ago would
    // be handed the signed-out card, and nothing would tell the app to refresh
    // her session. When she presented credentials and they did not resolve,
    // answer as every other signed-in route does, with the 401 the app's
    // interceptor turns into a refresh and a retry.
    if (!req.user && /^Bearer\s+\S+/i.test(req.headers.authorization ?? '') && seesOnlyTheCard(undefined)) {
      throw new ApiError(401, 'Your session has ended. Please sign in again.');
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        displayName: true,
        avatar: true,
        bio: true,
        headline: true,
        role: true,
        persona: true,
        city: true,
        state: true,
        country: true,
        currentJobTitle: true,
        currentCompany: true,
        yearsExperience: true,
        isPublic: true,
        // The Verified mark, read from the column only an approved identity
        // check sets (a reviewer's approval or Stripe's result). The profile
        // page draws it from here and nowhere else.
        isVerified: true,
        // Read only to decide whether this profile exists for the viewer (see
        // below); it is taken out of the answer before it is sent.
        emailVerified: true,
        createdAt: true,
        profile: {
          select: {
            aboutMe: true,
            linkedinUrl: true,
            websiteUrl: true,
            openToWork: true,
          },
        },
        skills: {
          include: {
            skill: true,
          },
        },
        education: {
          orderBy: { startDate: 'desc' },
        },
        experience: {
          orderBy: { startDate: 'desc' },
        },
        _count: {
          select: {
            followers: true,
            following: true,
            posts: true,
          },
        },
      },
    });

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    // An account whose address nobody has confirmed has no public page, and the
    // answer is the one a member who does not exist would get. It exists in the
    // database from the moment of sign-up, with whatever name was typed into the
    // form, and the person it names may not be the person who typed it. Only the
    // account itself reads it (which cannot happen until it is confirmed, so this
    // is a safeguard rather than a path). It is also left out of search and
    // suggestions: see hiddenMemberWhere in services/search.service.ts.
    if (user.emailVerified === false && req.user?.id !== id) {
      throw new ApiError(404, 'User not found');
    }
    const { emailVerified: _confirmed, ...publicUser } = user;
    void _confirmed;

    // Check if profile is private and viewer is not the owner
    if (!user.isPublic && req.user?.id !== id) {
      throw new ApiError(403, 'This profile is private');
    }

    // Who may see what: a connections-only profile shows non-followers a
    // limited card with a request-to-follow button; a private one is closed.
    const access = await profileAccess(req.user?.id, id);
    if (access.access === 'closed') {
      throw new ApiError(403, 'This profile is private');
    }

    const isFollowing = Boolean(req.user && req.user.id !== id && access.isFollower);

    // A pending request, and the people the viewer follows who follow this
    // member ("Followed by Mei C. and 2 others you follow").
    let followRequested = false;
    let mutualFollowers: { count: number; names: string[] } = { count: 0, names: [] };
    if (req.user && req.user.id !== id) {
      const [pending, mine] = await Promise.all([
        prisma.followRequest.findUnique({
          where: { requesterId_targetId: { requesterId: req.user.id, targetId: id } },
          select: { status: true },
        }),
        prisma.follow.findMany({ where: { followerId: req.user.id }, select: { followingId: true } }),
      ]);
      followRequested = pending?.status === 'PENDING';
      const followingIds = mine.map((f) => f.followingId).filter((fid) => fid !== id);
      if (followingIds.length > 0) {
        const [mutualRows, count] = await Promise.all([
          prisma.follow.findMany({
            where: { followingId: id, followerId: { in: followingIds } },
            select: { follower: { select: { displayName: true, firstName: true } } },
            take: 3,
          }),
          prisma.follow.count({ where: { followingId: id, followerId: { in: followingIds } } }),
        ]);
        mutualFollowers = {
          count,
          names: mutualRows.map((row) => publicName(row.follower)),
        };
      }
    }

    const approvesFollowers = access.visibility !== 'public';

    // A visitor with no account is held to the card even where the profile is
    // fully public. Her name stays on it, since it is on every public post she
    // has written; what stays behind the sign-in is where she lives (city, state
    // and country), the work and education history, the skills, the bio and the
    // links.
    const signedOut = !req.user;
    const heldToCard = seesOnlyTheCard(req.user?.id);
    const signedOutCard = heldToCard && access.access === 'full';

    if (access.access === 'limited' || signedOutCard) {
      res.json({
        success: true,
        data: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          displayName: user.displayName,
          avatar: user.avatar,
          headline: user.headline,
          persona: user.persona,
          ...(heldToCard ? {} : { city: user.city, state: user.state, country: user.country }),
          isVerified: user.isVerified,
          createdAt: user.createdAt,
          _count: user._count,
          isLimited: true,
          // Set only for a visitor with no account: the page says "sign in to
          // see more" for this, and "request to follow" for a member who is
          // signed in and not yet a follower.
          ...(signedOut ? { signInRequired: true } : {}),
          approvesFollowers,
          isFollowing,
          followRequested,
          mutualFollowers,
        },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        ...publicUser,
        isFollowing,
        followRequested,
        approvesFollowers,
        mutualFollowers,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// UPDATE CURRENT USER PROFILE
// ===========================================
router.patch(
  '/me',
  authenticate,
  [
    body('firstName').optional().trim().notEmpty().isLength({ max: 80 }),
    body('lastName').optional().trim().notEmpty().isLength({ max: 80 }),
    body('displayName').optional().trim().isLength({ max: 120 }),
    body('bio').optional().trim().isLength({ max: 2000 }),
    body('headline').optional().trim().isLength({ max: 200 }),
    body('city').optional().trim().isLength({ max: 120 }),
    body('state').optional().trim().isLength({ max: 120 }),
    body('country').optional().trim().isLength({ max: 120 }),
    body('currentJobTitle').optional().trim().isLength({ max: 160 }),
    body('currentCompany').optional().trim().isLength({ max: 160 }),
    body('yearsExperience').optional().isInt({ min: 0, max: 80 }).toInt(),
    body('isPublic').optional().isBoolean().toBoolean(),
    body('allowMessages').optional().isBoolean().toBoolean(),
    body('timezone').optional().trim().matches(/^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+){1,2}$/).withMessage('timezone must be an IANA zone such as Australia/Brisbane'),
    body('persona').optional().isIn([
      'EARLY_CAREER', 'MID_CAREER', 'ENTREPRENEUR', 'CREATOR',
      'MENTOR', 'EDUCATION_PROVIDER', 'EMPLOYER', 'REAL_ESTATE', 'GOVERNMENT_NGO'
    ]),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const allowedFields = [
        'firstName', 'lastName', 'displayName', 'bio', 'headline',
        'city', 'state', 'country', 'currentJobTitle', 'currentCompany',
        'yearsExperience', 'persona', 'isPublic', 'allowMessages', 'timezone'
      ];

      const updateData: Record<string, any> = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      }

      // The name other members see. It may be a pseudonym, and it must read as a name:
      // no email address, phone number or web address, and nothing that claims to be
      // staff. An empty one clears it, and she is then called by her first name alone.
      //
      // "Cleared" is stored as the first name, not as nothing. The routes that go
      // through utils/member-display fall back to the first name for a member with no
      // public name, but reels, channels, live chat and group chat read `displayName`
      // alone, so a null there would print her as blank on exactly the surfaces the page
      // told her she would be called by her first name. A first name of hers that is
      // changed in the same request is the one used.
      if (req.body.displayName !== undefined) {
        const chosen = parseDisplayName(req.body.displayName);
        if (!chosen.ok) throw new ApiError(400, chosen.message);
        if (chosen.value === null) {
          const first =
            typeof updateData.firstName === 'string'
              ? updateData.firstName.trim()
              : (await prisma.user.findUnique({ where: { id: req.user!.id }, select: { firstName: true } }))?.firstName?.trim();
          updateData.displayName = first || null;
        } else {
          updateData.displayName = chosen.value;
        }
      }

      const user = await prisma.user.update({
        where: { id: req.user!.id },
        data: updateData,
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
          currentJobTitle: true,
          currentCompany: true,
          yearsExperience: true,
          isPublic: true,
        },
      });

      await syncUserToIndex(user.id);

      res.json({
        success: true,
        message: 'Profile updated',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// GET USER PREFERENCES
// ===========================================
router.get('/me/preferences', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        preferredLocale: true,
        preferredCurrency: true,
        timezone: true,
        region: true,
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
// UPDATE USER PREFERENCES
// ===========================================
router.patch(
  '/me/preferences',
  authenticate,
  [
    body('preferredLocale').optional().isString().isLength({ min: 2, max: 15 }),
    body('preferredCurrency').optional().isString().isLength({ min: 3, max: 3 }),
    body('timezone').optional().isString().notEmpty(),
    body('region').optional().isIn(REGION_KEYS as unknown as string[]),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const existing = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { region: true },
      });

      const regionKey = normalizeRegion(req.body.region || existing?.region || 'ANZ');
      const regionConfig = getRegionConfig(regionKey);

      // Language is the member's, not her region's: a Queensland member who
      // reads Spanish, Arabic or Vietnamese keeps that whatever region she is
      // in. The region still decides currency and compliance below.
      if (req.body.preferredLocale && !isSupportedLocale(req.body.preferredLocale)) {
        throw new ApiError(400, 'That language is not one ATHENA offers yet');
      }

      if (
        req.body.preferredCurrency &&
        !regionConfig.supportedCurrencies.includes(String(req.body.preferredCurrency).toUpperCase())
      ) {
        throw new ApiError(400, 'Currency not supported for selected region');
      }

      const allowedFields = ['preferredLocale', 'preferredCurrency', 'timezone', 'region'];
      const updateData: Record<string, any> = {};

      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      }

      if (req.body.region && !req.body.preferredLocale) {
        updateData.preferredLocale = regionConfig.defaultLocale;
      }

      if (req.body.region && !req.body.preferredCurrency) {
        updateData.preferredCurrency = regionConfig.defaultCurrency;
      }

      const user = await prisma.user.update({
        where: { id: req.user!.id },
        data: updateData,
        select: {
          id: true,
          preferredLocale: true,
          preferredCurrency: true,
          timezone: true,
          region: true,
        },
      });

      res.json({
        success: true,
        message: 'Preferences updated',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// GET USER CONSENTS
// ===========================================
router.get('/me/consents', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        consentMarketing: true,
        consentDataProcessing: true,
        consentCookies: true,
        consentDoNotSell: true,
        consentUpdatedAt: true,
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
// UPDATE USER CONSENTS
// ===========================================
router.patch(
  '/me/consents',
  authenticate,
  [
    body('consentMarketing').optional().isBoolean(),
    body('consentDataProcessing').optional().isBoolean(),
    body('consentCookies').optional().isBoolean(),
    body('consentDoNotSell').optional().isBoolean(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const updateData: Record<string, any> = {};
      for (const field of CONSENT_FIELDS) {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      }

      if (Object.keys(updateData).length === 0) {
        throw new ApiError(400, 'No consent updates provided');
      }

      updateData.consentUpdatedAt = new Date();

      const user = await prisma.user.update({
        where: { id: req.user!.id },
        data: updateData,
        select: {
          id: true,
          consentMarketing: true,
          consentDataProcessing: true,
          consentCookies: true,
          consentDoNotSell: true,
          consentUpdatedAt: true,
        },
      });

      res.json({
        success: true,
        message: 'Consents updated',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// UPDATE EXTENDED PROFILE
// ===========================================
// The body is read through a schema that names every field a member may set
// here and refuses the rest. It used to go to Prisma as it arrived, and Prisma
// accepts a nested write on the `user` relation, so `{ "user": { "update":
// { "role": "SUPER_ADMIN" } } }` from any signed-in member rewrote that member's own
// account row: role, verification, suspension, two-factor. The owner is set
// from the token, after the member's fields, so no body can name another one.
// An empty string clears a link, as it would in the form that sends it.
const optionalLink = z
  .union([z.literal('').transform(() => null), httpUrl(500)])
  .nullable()
  .optional();
const salaryFigure = z.number().int().min(0).max(10_000_000);

const extendedProfileSchema = z
  .object({
    aboutMe: z.string().trim().max(5000).nullable().optional(),
    linkedinUrl: optionalLink,
    websiteUrl: optionalLink,
    twitterUrl: optionalLink,
    openToWork: z.boolean().optional(),
    salaryMin: salaryFigure.nullable().optional(),
    salaryMax: salaryFigure.nullable().optional(),
    remotePreference: z.enum(['remote', 'hybrid', 'onsite']).nullable().optional(),
    preferredJobTypes: z.array(z.nativeEnum(JobType)).max(Object.keys(JobType).length).optional(),
    isSafeMode: z.boolean().optional(),
    hideFromSearch: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) => value.salaryMin == null || value.salaryMax == null || value.salaryMin <= value.salaryMax,
    { message: 'salaryMin cannot be more than salaryMax', path: ['salaryMin'] }
  );

router.patch(
  '/me/profile',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const data = parseStrict(extendedProfileSchema, req.body);
      const userId = req.user!.id;

      const profile = await prisma.profile.upsert({
        where: { userId },
        update: data,
        create: { ...data, userId },
      });

      // Safe Mode and hide-from-search are kept in two places, and the DV page
      // reads and enforces its own copy as well as this one (see
      // PATCH /api/safety/settings, which mirrors them the same way). A member
      // who changed one here and not there would be shown, and treated as,
      // something other than what she set. Only a copy that already exists is
      // updated; this is not a way of making one.
      const dvCopy = {
        ...(typeof data.isSafeMode === 'boolean' ? { isSafeMode: data.isSafeMode } : {}),
        ...(typeof data.hideFromSearch === 'boolean' ? { hideFromSearch: data.hideFromSearch } : {}),
      };
      if (Object.keys(dvCopy).length > 0) {
        await prisma.dvSafetyProfile.updateMany({ where: { userId }, data: dvCopy });
      }

      res.json({
        success: true,
        message: 'Profile updated',
        data: profile,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// ADD SKILL
// ===========================================
router.get('/me/skills', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const skills = await prisma.userSkill.findMany({
      where: { userId: req.user!.id },
      select: {
        id: true,
        skillId: true,
        level: true,
        endorsed: true,
        skill: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { skill: { name: 'asc' } },
    });

    res.json({
      success: true,
      data: skills.map((s) => ({
        id: s.id,
        skillId: s.skillId,
        name: s.skill.name,
        level: s.level,
        endorsed: s.endorsed,
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/me/skills',
  authenticate,
  [
    body('skillName').notEmpty().trim(),
    body('level').optional().isInt({ min: 1, max: 5 }),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { skillName, level } = req.body;

      // Find or create skill
      let skill = await prisma.skill.findUnique({
        where: { name: skillName.toLowerCase() },
      });

      if (!skill) {
        skill = await prisma.skill.create({
          data: { name: skillName.toLowerCase() },
        });
      }

      // Add to user
      const userSkill = await prisma.userSkill.upsert({
        where: {
          userId_skillId: {
            userId: req.user!.id,
            skillId: skill.id,
          },
        },
        update: { level },
        create: {
          userId: req.user!.id,
          skillId: skill.id,
          level,
        },
        include: { skill: true },
      });

      await syncUserToIndex(req.user!.id);

      res.status(201).json({
        success: true,
        data: userSkill,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// REMOVE SKILL
// ===========================================
router.delete('/me/skills/:skillId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    await prisma.userSkill.deleteMany({
      where: {
        userId: req.user!.id,
        skillId: req.params.skillId,
      },
    });

    await syncUserToIndex(req.user!.id);

    res.json({
      success: true,
      message: 'Skill removed',
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// ADD WORK EXPERIENCE
// ===========================================
// Same rule as the profile above: the fields are named, anything else is
// refused, and the owner comes from the token. `...req.body` here let a body
// `userId` plant an entry on another member's public profile, and member ids
// are public.
const experienceSchema = z
  .object({
    company: z.string().trim().min(1).max(200),
    title: z.string().trim().min(1).max(200),
    location: z.string().trim().max(200).nullable().optional(),
    startDate: isoDate(),
    endDate: isoDate().nullable().optional(),
    current: z.boolean().optional(),
    description: z.string().trim().max(5000).nullable().optional(),
  })
  .strict()
  .refine((value) => !value.endDate || value.endDate >= value.startDate, {
    message: 'endDate cannot be before startDate',
    path: ['endDate'],
  });

router.post(
  '/me/experience',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const data = parseStrict(experienceSchema, req.body);

      const experience = await prisma.workExperience.create({
        data: {
          ...data,
          // A role that is still current has no end date, whatever else was sent.
          endDate: data.current ? null : data.endDate ?? null,
          userId: req.user!.id,
        },
      });

      res.status(201).json({
        success: true,
        data: experience,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// ADD EDUCATION
// ===========================================
const educationSchema = z
  .object({
    institution: z.string().trim().min(1).max(200),
    degree: z.string().trim().max(200).nullable().optional(),
    fieldOfStudy: z.string().trim().max(200).nullable().optional(),
    startDate: isoDate().nullable().optional(),
    endDate: isoDate().nullable().optional(),
    current: z.boolean().optional(),
    description: z.string().trim().max(5000).nullable().optional(),
  })
  .strict()
  .refine((value) => !value.startDate || !value.endDate || value.endDate >= value.startDate, {
    message: 'endDate cannot be before startDate',
    path: ['endDate'],
  });

router.post(
  '/me/education',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const data = parseStrict(educationSchema, req.body);

      const education = await prisma.education.create({
        data: {
          ...data,
          startDate: data.startDate ?? null,
          endDate: data.current ? null : data.endDate ?? null,
          userId: req.user!.id,
        },
      });

      res.status(201).json({
        success: true,
        data: education,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// FOLLOW USER
// ===========================================
router.post('/:id/follow', authenticate, followLimiter, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    if (id === req.user!.id) {
      throw new ApiError(400, 'Cannot follow yourself');
    }

    // Check if user exists
    const userToFollow = await prisma.user.findUnique({ where: { id } });
    // An account nobody has confirmed the address of does not exist for anyone
    // else yet, as it does not on its profile page (GET /:id above).
    if (!userToFollow || userToFollow.emailVerified === false) {
      throw new ApiError(404, 'User not found');
    }

    // Either side of a block gets the answer a member who does not exist would
    // get, so the closed door does not say why it is closed. This route used to
    // check nothing: a blocked account could follow, or ask to follow, the
    // member who had blocked it, which created the row and rang her phone. The
    // check fails the request if the block lists cannot be read, rather than
    // answering "not blocked" on a guess.
    if (await isBlockedEitherWay(req.user!.id, id)) {
      throw new ApiError(404, 'User not found');
    }

    // Check if already following
    const existingFollow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: req.user!.id,
          followingId: id,
        },
      },
    });

    // Idempotent: the feed's Follow button toggles optimistically, and a
    // "you already follow them" 400 made it snap back to "Follow" for a
    // relationship that exists.
    if (existingFollow) {
      res.json({ success: true, message: 'Following user', following: true });
      return;
    }

    // Follow, unfollow and follow again rings the same member's phone every
    // time round, and the per-member limit above allows sixty a window. Only a
    // press that would create something is counted, so pressing a button that
    // is already on costs nothing.
    if (!(await withinTargetLimit('follow', req.user!.id, id))) {
      throw new ApiError(429, 'You have asked to follow this member several times in the last hour. Please wait a while before trying again.');
    }

    // Members who approve their followers get a request instead of a follow.
    if (await approvesFollowers(id)) {
      const request = await prisma.followRequest.upsert({
        where: { requesterId_targetId: { requesterId: req.user!.id, targetId: id } },
        update: { status: 'PENDING' },
        create: { requesterId: req.user!.id, targetId: id },
        select: { id: true, status: true, updatedAt: true, createdAt: true },
      });
      // Only a fresh request rings the bell; a re-press of the button does not.
      if (request.createdAt.getTime() === request.updatedAt.getTime() || Date.now() - request.updatedAt.getTime() < 1500) {
        await notifySocial({
          recipientId: id,
          actorId: req.user!.id,
          type: 'FOLLOW_REQUEST',
          title: 'Follow request',
          message: (name) => `${name} asked to follow you`,
          link: '/dashboard/notifications#follow-requests',
        });
      }
      res.json({ success: true, message: 'Follow request sent', following: false, requested: true });
      return;
    }

    await prisma.follow.create({
      data: {
        followerId: req.user!.id,
        followingId: id,
      },
    });

    // Named by display name, never by email, and pointed at the follower's
    // public profile rather than a /users route the web client has never had.
    await notifySocial({
      recipientId: id,
      actorId: req.user!.id,
      type: 'FOLLOW',
      title: 'New follower',
      message: (name) => `${name} started following you`,
      link: socialLinks.profile(req.user!.id),
    });

    res.json({
      success: true,
      message: 'Following user',
      following: true,
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// UNFOLLOW USER
// ===========================================
router.delete('/:id/follow', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    await prisma.follow.deleteMany({
      where: {
        followerId: req.user!.id,
        followingId: id,
      },
    });
    // Also withdraws a request that was never answered.
    await prisma.followRequest.deleteMany({
      where: { requesterId: req.user!.id, targetId: id, status: 'PENDING' },
    });

    res.json({
      success: true,
      message: 'Unfollowed user',
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// FOLLOWER AND FOLLOWING LISTS
// ===========================================
/*
 * Both lists were open to anyone on the internet, signed in or not, for any
 * member at all. A private profile and a connections-only one refused their
 * page and handed over the names, photos and headlines of everyone they
 * followed and everyone who followed them — the social graph of the women who
 * had most reason to keep it closed, a man she had blocked included.
 *
 * They now ask for an account, answer a profile's lists only to the viewers
 * who may see that profile in full (the rule GET /:id uses), answer 404 across
 * a block in either direction, and leave out of the list anyone the viewer
 * could not find in search: a blocked member on either side, a closed
 * account, and someone who asked to be hidden. Nothing here is best effort;
 * a check that cannot be made refuses the request rather than answering
 * without it.
 *
 * On her own lists the hidden-from-search rule is the one thing not applied.
 * Those are the people who follow her and whom she follows, and a follower
 * who switched on "hide me from search" must not be able to watch her from a
 * place she cannot see.
 */
async function assertMayReadFollowLists(viewerId: string, targetId: string): Promise<ViewerContext> {
  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, isPublic: true, dvSafetyProfile: { select: { blockedUserIds: true } } },
  });
  if (!target) throw new ApiError(404, 'User not found');

  const viewer = await viewerContextFor(viewerId);
  if (viewerId !== targetId) {
    // Across a block the profile does not exist, as it does not in search.
    if (viewer.blockedIds.includes(targetId) || (target.dvSafetyProfile?.blockedUserIds ?? []).includes(viewerId)) {
      throw new ApiError(404, 'User not found');
    }
    if (!target.isPublic) throw new ApiError(403, 'This profile is private');
    const access = await profileAccess(viewerId, targetId);
    if (access.access !== 'full') throw new ApiError(403, 'This profile is private');
  }
  return viewer;
}

function listedMemberWhere(viewer: ViewerContext, ownList: boolean): Prisma.UserWhereInput {
  if (!ownList) return { AND: [hiddenMemberWhere(viewer), { isActive: true }] };
  const blocks: Prisma.UserWhereInput[] = [{ isActive: true }];
  if (viewer.viewerId) blocks.push({ NOT: { dvSafetyProfile: { is: { blockedUserIds: { has: viewer.viewerId } } } } });
  if (viewer.blockedIds.length > 0) blocks.push({ id: { notIn: viewer.blockedIds } });
  return { AND: blocks };
}

// ===========================================
// GET USER'S FOLLOWERS
// ===========================================
router.get('/:id/followers', authenticate, profileReadLimiter, maskLegalNamesInResponses, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const { page, limit } = parsePagination(req.query as { page?: string; limit?: string });
    const viewer = await assertMayReadFollowLists(req.user!.id, id);
    const where: Prisma.FollowWhereInput = { followingId: id, follower: listedMemberWhere(viewer, req.user!.id === id) };

    const followers = await prisma.follow.findMany({
      where,
      include: {
        follower: {
          select: {
            id: true,
            firstName: true,
            displayName: true,
            avatar: true,
            headline: true,
          },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    const total = await prisma.follow.count({ where });

    res.json({
      success: true,
      data: followers.map((f) => f.follower),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// GET USER'S FOLLOWING
// ===========================================
router.get('/:id/following', authenticate, profileReadLimiter, maskLegalNamesInResponses, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const { page, limit } = parsePagination(req.query as { page?: string; limit?: string });
    const viewer = await assertMayReadFollowLists(req.user!.id, id);
    const where: Prisma.FollowWhereInput = { followerId: id, following: listedMemberWhere(viewer, req.user!.id === id) };

    const following = await prisma.follow.findMany({
      where,
      include: {
        following: {
          select: {
            id: true,
            firstName: true,
            displayName: true,
            avatar: true,
            headline: true,
          },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    const total = await prisma.follow.count({ where });

    res.json({
      success: true,
      data: following.map((f) => f.following),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
