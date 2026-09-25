import { Router, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { Prisma, WomanVerificationStatus } from '@prisma/client';
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
import { getBlockedRelationshipIds } from '../utils/safety-store';
import { approvesFollowers, profileAccess } from '../services/audience.service';
import { followLimiter } from '../middleware/socialLimits';
import {
  DATE_OF_BIRTH_REFUSAL,
  WOMAN_GATE_PURPOSE,
  isPlausibleDateOfBirth,
  meetsMinimumAge,
  readWomanGateEvidence,
} from '../middleware/account-gates';
import { getStripe, isStripeConfigured } from '../utils/stripe';
import { logAudit } from '../utils/audit';

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
    const badge = await pendingWomanGateBadge(userId);
    const sessionId = badge ? readWomanGateEvidence(badge.metadata)?.sessionId ?? sessionIdOf(badge.metadata) : null;

    if (!badge || !sessionId) {
      throw new ApiError(404, 'There is no document check waiting on your account');
    }

    if (!isStripeConfigured()) {
      throw new ApiError(503, 'The document check is not set up on this server');
    }

    // verified_outputs carries the document's own fields and is only returned
    // when asked for by name, so the expand is what makes this call worth
    // making at all.
    const session = await getStripe().identity.verificationSessions.retrieve(sessionId, {
      expand: ['verified_outputs'],
    });

    if (session.status !== 'verified') {
      return res.json({
        success: true,
        status: 'PENDING',
        data: { documentCheck: session.status, reason: session.last_error?.reason ?? null },
      });
    }

    const outputs = session.verified_outputs ?? null;
    await applyWomanGateDocumentResult(userId, badge.id, badge.metadata, outputs);

    res.json({ success: true, status: 'PENDING', data: { documentCheck: 'verified' } });
  } catch (error) {
    next(error);
  }
});

/** The `sessionId` on a badge whose evidence is not yet readable as a finished submission. */
function sessionIdOf(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>).sessionId;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

type StripeVerifiedOutputs = {
  first_name?: string | null;
  last_name?: string | null;
  dob?: { day?: number | null; month?: number | null; year?: number | null } | null;
  id_number_type?: string | null;
} | null;

/**
 * Writes a passed document check onto the member's record: the evidence the
 * reviewer will read, and the date of birth the platform has never had.
 *
 * The date of birth is the part worth having twice over. A member who
 * completes this check has proved her age against a government document, so
 * `ageVerifiedAt` is stamped alongside it and the account stops relying on
 * what she typed at sign-up. An account that already carries a date of birth
 * keeps it unless the document disagrees; the document wins, because it is the
 * better evidence.
 */
export async function applyWomanGateDocumentResult(
  userId: string,
  badgeId: string,
  metadata: unknown,
  outputs: StripeVerifiedOutputs
): Promise<void> {
  const base = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? (metadata as Record<string, unknown>) : {};
  const name = [outputs?.first_name, outputs?.last_name].filter(Boolean).join(' ').trim();
  const dob = outputs?.dob;
  const documentDateOfBirth =
    dob && dob.year && dob.month && dob.day ? new Date(Date.UTC(dob.year, dob.month - 1, dob.day)) : null;

  await prisma.verificationBadge.update({
    where: { id: badgeId },
    data: {
      metadata: {
        ...base,
        purpose: WOMAN_GATE_PURPOSE,
        provider: 'stripe_identity',
        documentCheckPassedAt: new Date().toISOString(),
        ...(name ? { documentName: name } : {}),
        ...(outputs?.id_number_type ? { documentType: outputs.id_number_type } : {}),
      },
    },
  });

  if (documentDateOfBirth) {
    await prisma.user.update({
      where: { id: userId },
      data: { dateOfBirth: documentDateOfBirth, ageVerifiedAt: new Date() },
    });
  }

  await prisma.notification.create({
    data: {
      userId,
      type: 'SYSTEM',
      title: 'Your document check passed',
      message: 'Thank you. Your women-only verification is now with a reviewer, and you will hear from us shortly.',
      link: '/dashboard/settings/profile',
    },
  });
}

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
      prisma.follow.findMany({
        where: { followingId: userId },
        include: {
          follower: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.follow.findMany({
        where: { followerId: userId },
        include: {
          following: { select: { id: true, firstName: true, lastName: true, avatar: true } },
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
              user: { select: { id: true, firstName: true, lastName: true, avatar: true } },
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

    res.json({
      success: true,
      data: {
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
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// DELETE ACCOUNT (Minimal anonymization)
// ===========================================
router.delete(
  '/me',
  authenticate,
  [body('confirm').isBoolean().custom((v) => v === true).withMessage('Confirmation required')],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const userId = req.user!.id;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true },
      });

      if (!user) {
        throw new ApiError(404, 'User not found');
      }

      // We avoid hard-deleting the User row because some models reference userId
      // with required relations (e.g. jobs posted). Instead we revoke access and
      // anonymize PII while keeping referential integrity intact.
      const tombstoneEmail = `deleted+${userId}+${Date.now()}@example.invalid`;

      // What this used to leave behind, after telling her "Account deleted":
      // a live TOTP secret, both OAuth subject identifiers, her gender
      // verification record, her three consent flags and her Stripe Connect
      // id. Access was refused because isSuspended was set, so nothing could
      // be read through the app — but the rows were still there, and the
      // women-gate record in particular is the single most sensitive thing a
      // woman leaving a women-only platform would want gone.
      //
      // The erasure path in gdpr.service.ts already clears every one of them
      // (tombstoneFields). The field list is repeated rather than imported
      // because the two paths answer different questions — a DSAR erasure is
      // a legal obligation with its own audit trail and retention carve-outs,
      // a self-serve delete is a member closing her account — and coupling
      // them would mean a change made for one silently changing the other.
      // What they must not do is disagree about which columns are personal
      // data. If you add a column to either list, add it to both.
      //
      // Two fields deliberately differ from the DSAR list. `country` is left
      // alone: it is the jurisdiction whose retention rules govern the
      // records we are keeping, and losing it would leave us unable to say
      // how long to keep them. `isActive` is left alone because isSuspended
      // is what every read path in this codebase checks.

      await prisma.$transaction([
        prisma.auditLog.create({
          data: {
            action: 'ACCOUNT_DELETE',
            actorUserId: userId,
            targetUserId: userId,
            ipAddress: req.ip,
            userAgent: req.get('user-agent') || undefined,
            metadata: {
              deletedAt: new Date().toISOString(),
            },
          },
        }),
        prisma.session.deleteMany({ where: { userId } }),
        prisma.verificationToken.deleteMany({ where: { userId } }),
        prisma.subscription.deleteMany({ where: { userId } }),
        prisma.profile.deleteMany({ where: { userId } }),
        prisma.userSkill.deleteMany({ where: { userId } }),
        prisma.education.deleteMany({ where: { userId } }),
        prisma.workExperience.deleteMany({ where: { userId } }),
        prisma.courseEnrollment.deleteMany({ where: { userId } }),
        prisma.savedJob.deleteMany({ where: { userId } }),
        prisma.educationApplication.deleteMany({ where: { userId } }),
        prisma.jobApplication.deleteMany({ where: { userId } }),
        prisma.user.update({
          where: { id: userId },
          data: {
            email: tombstoneEmail,
            passwordHash: null,
            emailVerified: false,
            emailVerifiedAt: null,
            firstName: 'Deleted',
            lastName: 'User',
            displayName: 'Deleted User',
            avatar: null,
            bio: null,
            headline: null,
            city: null,
            state: null,
            currentJobTitle: null,
            currentCompany: null,
            yearsExperience: null,
            isPublic: false,
            allowMessages: false,
            isSuspended: true,
            lastLoginAt: null,
            referralCode: null,
            referralCredits: 0,
            // A live authenticator secret on a deleted account is a working
            // second factor for a first factor that no longer exists.
            twoFactorEnabled: false,
            twoFactorSecret: null,
            twoFactorEnabledAt: null,
            twoFactorRecoveryCodes: { set: [] },
            // Both OAuth subject identifiers. These are unique columns, so
            // leaving them also meant the same Google or Facebook account
            // could never sign up again — the deleted row still owned them.
            googleId: null,
            facebookId: null,
            // Her gender verification. The status goes back to UNVERIFIED
            // rather than being left at VERIFIED or REJECTED, because either
            // of those is a finding about a person we have agreed to stop
            // holding a record of.
            womanSelfAttested: false,
            womanVerificationStatus: WomanVerificationStatus.UNVERIFIED,
            womanVerifiedAt: null,
            // Consent is a record of a choice a person made. There is no
            // person here any more to have made it.
            consentMarketing: false,
            consentDataProcessing: false,
            consentCookies: false,
            consentUpdatedAt: new Date(),
            // The payout account. Kept clear of a row nobody can sign in to.
            stripeConnectAccountId: null,
            stripeConnectStatus: null,
            notificationPreferences: Prisma.DbNull,
            inviteCodeId: null,
          },
        }),
      ]);

      res.json({
        success: true,
        message: 'Account deleted',
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
router.get('/suggest', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 40) : '';
    if (q.length < 1) {
      res.json({ success: true, data: [] });
      return;
    }

    const select = { id: true, displayName: true, firstName: true, lastName: true, avatar: true, headline: true };
    const nameMatch = {
      OR: [
        { displayName: { startsWith: q, mode: 'insensitive' as const } },
        { firstName: { startsWith: q, mode: 'insensitive' as const } },
        { lastName: { startsWith: q, mode: 'insensitive' as const } },
        { displayName: { contains: ` ${q}`, mode: 'insensitive' as const } },
      ],
    };

    const [followed, others] = await Promise.all([
      prisma.user.findMany({
        where: { isActive: true, followers: { some: { followerId: req.user!.id } }, ...nameMatch },
        select,
        take: 6,
      }),
      prisma.user.findMany({
        where: { isActive: true, id: { not: req.user!.id }, ...nameMatch },
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
        name: user.displayName?.trim() || [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || 'Member',
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
router.get('/suggested', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const viewerId = req.user!.id;
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '6'), 10) || 6, 1), 20);

    const [me, following, blockedIds] = await Promise.all([
      prisma.user.findUnique({ where: { id: viewerId }, select: { persona: true, city: true, state: true } }),
      prisma.follow.findMany({ where: { followerId: viewerId }, select: { followingId: true } }),
      getBlockedRelationshipIds(viewerId),
    ]);
    const followingIds = following.map((f) => f.followingId);
    const excluded = new Set<string>([viewerId, ...followingIds, ...blockedIds]);

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
        ? prisma.user.findMany({ where: { isActive: true, persona: me.persona, id: { notIn: Array.from(excluded) } }, select, take: 60 })
        : Promise.resolve([] as Array<{ id: string; persona: string; city: string | null; state: string | null }>),
      me?.city
        ? prisma.user.findMany({ where: { isActive: true, city: { equals: me.city, mode: 'insensitive' }, id: { notIn: Array.from(excluded) } }, select, take: 60 })
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

    const ranked = Array.from(candidates.entries())
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, limit);
    if (ranked.length === 0) {
      res.json({ success: true, data: [] });
      return;
    }

    const users = await prisma.user.findMany({
      where: { id: { in: ranked.map(([id]) => id) }, isActive: true },
      select: { id: true, displayName: true, firstName: true, lastName: true, avatar: true, headline: true, persona: true, city: true },
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
          name: user.displayName?.trim() || [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || 'Member',
          avatar: user.avatar,
          headline: user.headline,
          city: user.city,
          reason: reasons[0] ?? 'Active in the community',
          reasons,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// GET USER PROFILE (PUBLIC)
// ===========================================
router.get('/:id', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

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
            select: { follower: { select: { displayName: true, firstName: true, lastName: true } } },
            take: 3,
          }),
          prisma.follow.count({ where: { followingId: id, followerId: { in: followingIds } } }),
        ]);
        mutualFollowers = {
          count,
          names: mutualRows.map(
            (row) =>
              row.follower.displayName?.trim() ||
              [row.follower.firstName, row.follower.lastName].filter(Boolean).join(' ').trim() ||
              'Member'
          ),
        };
      }
    }

    const approvesFollowers = access.visibility !== 'public';

    if (access.access === 'limited') {
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
          city: user.city,
          state: user.state,
          country: user.country,
          createdAt: user.createdAt,
          _count: user._count,
          isLimited: true,
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
        ...user,
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
router.patch(
  '/me/profile',
  authenticate,
  [
    body('aboutMe').optional().trim(),
    body('linkedinUrl').optional().isURL({ protocols: ['http', 'https'] }),
    body('websiteUrl').optional().isURL({ protocols: ['http', 'https'] }),
    body('twitterUrl').optional().isURL({ protocols: ['http', 'https'] }),
    body('openToWork').optional().isBoolean(),
    body('salaryMin').optional().isInt({ min: 0 }),
    body('salaryMax').optional().isInt({ min: 0 }),
    body('remotePreference').optional().isIn(['remote', 'hybrid', 'onsite']),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const profile = await prisma.profile.upsert({
        where: { userId: req.user!.id },
        update: req.body,
        create: {
          userId: req.user!.id,
          ...req.body,
        },
      });

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
router.post(
  '/me/experience',
  authenticate,
  [
    body('company').notEmpty().trim(),
    body('title').notEmpty().trim(),
    body('startDate').isISO8601(),
    body('endDate').optional().isISO8601(),
    body('current').optional().isBoolean(),
    body('description').optional().trim(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const experience = await prisma.workExperience.create({
        data: {
          userId: req.user!.id,
          ...req.body,
          startDate: new Date(req.body.startDate),
          endDate: req.body.endDate ? new Date(req.body.endDate) : null,
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
router.post(
  '/me/education',
  authenticate,
  [
    body('institution').notEmpty().trim(),
    body('degree').optional().trim(),
    body('fieldOfStudy').optional().trim(),
    body('startDate').optional().isISO8601(),
    body('endDate').optional().isISO8601(),
    body('current').optional().isBoolean(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const education = await prisma.education.create({
        data: {
          userId: req.user!.id,
          ...req.body,
          startDate: req.body.startDate ? new Date(req.body.startDate) : null,
          endDate: req.body.endDate ? new Date(req.body.endDate) : null,
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
    if (!userToFollow) {
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
// GET USER'S FOLLOWERS
// ===========================================
router.get('/:id/followers', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page, limit, skip } = parsePagination(req.query as { page?: string; limit?: string });

    const followers = await prisma.follow.findMany({
      where: { followingId: id },
      include: {
        follower: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
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

    const total = await prisma.follow.count({ where: { followingId: id } });

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
router.get('/:id/following', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page, limit, skip } = parsePagination(req.query as { page?: string; limit?: string });

    const following = await prisma.follow.findMany({
      where: { followerId: id },
      include: {
        following: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
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

    const total = await prisma.follow.count({ where: { followerId: id } });

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
