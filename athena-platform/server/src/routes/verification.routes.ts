import { Router, Response, NextFunction } from 'express';
import { body, query, validationResult } from 'express-validator';
import { WomanVerificationStatus } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { logAudit } from '../utils/audit';
import { getStripe, isStripeConfigured } from '../utils/stripe';
import { WOMAN_GATE_BADGE_WHERE, isWomanGateMetadata, readWomanGateEvidence } from '../middleware/account-gates';
import { redactIdentitySession } from '../services/identity-verification.service';
import { bestEffort } from '../utils/best-effort';
import { recordStaffAction } from '../services/staff-record.service';
import {
  HOST_ATTESTATION_RENEWAL_WINDOW_DAYS,
  HOST_SAFETY_QUESTIONS,
  HOST_SAFETY_VERSION,
  attestationStanding,
  decideHostAttestation,
  hostAttestationSchema,
  hostDecisionSchema,
  latestAttestation,
  parseHostInput,
  presentAttestation,
  presentForReviewer,
  submitHostAttestation,
} from '../services/host-safety.service';
import {
  creatorEligibility,
  creatorRefusal,
  reviewerChecks,
  sanitiseBadgeMetadata,
  type BadgeType,
} from '../services/verification-rules.service';

const router = Router();

// Identity checks run through Stripe Identity when a key is configured: the
// member photographs her document and a selfie on Stripe's hosted page, and
// the webhook approves the badge when the check passes. Without a key the
// badge is applied for and reviewed by hand, as before.
//
// The "is there a key" question is asked with isStripeConfigured() rather than
// by holding a client and testing it for null: getStripe() never returns null -
// outside production it hands back a placeholder client - so a null test
// against it would always pass and this route would call Stripe with a key that
// could only fail, instead of falling back to the human reviewer.

// ===========================================
// ORGANISATION VERIFICATION
// ===========================================
// An EMPLOYER or EDUCATOR badge can name the organisation it is applied for
// (metadata.organizationId, set by the organisation page along with the ABN
// and website the reviewer checks against ABN Lookup). Approving that badge
// is the only thing that sets Organization.isVerified: the chip the companies
// and providers directories show. It only happens when the badge holder is an
// OWNER or ADMIN of that organisation, so a recruiter's badge cannot verify an
// organisation she merely belongs to, and a badge naming someone else's
// organisation verifies nothing.

const ORGANISATION_BADGE_TYPES = new Set(['EMPLOYER', 'EDUCATOR']);
const ORGANISATION_VERIFYING_ROLES = new Set(['OWNER', 'ADMIN']);

/**
 * Matches the identity badges that belong to the women-only gate rather than
 * to the ordinary verified badge. Both use type IDENTITY and the same Stripe
 * Identity session, so `metadata.purpose` is the only thing separating them.
 */
const womanGateBadgeFilter = WOMAN_GATE_BADGE_WHERE;

function organisationIdFrom(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>).organizationId;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * Whether this member may apply for, and be the reason for, an organisation's
 * verification. Only an accepted member counts: the membership row is written
 * when an owner types an address into the invite box, so a person invited as an
 * admin who has not answered is not in the organisation, and must not be able
 * to put its name to an application, or to have an approved badge of hers mark
 * it verified (see utils/org-scope.ts).
 */
async function canVerifyOrganisation(organizationId: string, userId: string) {
  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: { role: true, acceptedAt: true, organization: { select: { id: true, name: true, isVerified: true } } },
  });
  if (!membership || membership.acceptedAt === null) return { allowed: false as const, organization: null };
  return { allowed: ORGANISATION_VERIFYING_ROLES.has(membership.role), organization: membership.organization };
}

type OrganisationOutcome = { organizationId: string; name: string | null; verified: boolean; reason?: string };

/**
 * Mark the organisation a badge was applied for as verified, and tell the
 * people who run it. Returns what happened so the reviewer sees it too: a
 * badge that was approved for the person while the organisation stayed
 * unverified should not look like a finished job.
 */
async function verifyOrganisationForBadge(badge: { userId: string; type: string; metadata: unknown }): Promise<OrganisationOutcome | null> {
  if (!ORGANISATION_BADGE_TYPES.has(badge.type)) return null;
  const organizationId = organisationIdFrom(badge.metadata);
  if (!organizationId) return null;

  const { allowed, organization } = await canVerifyOrganisation(organizationId, badge.userId);
  if (!organization) {
    return { organizationId, name: null, verified: false, reason: 'The badge holder is not a member of that organisation, so it was left unverified.' };
  }
  if (!allowed) {
    return { organizationId, name: organization.name, verified: false, reason: 'The badge holder is not an owner or admin of that organisation, so it was left unverified.' };
  }

  await prisma.organization.update({ where: { id: organizationId }, data: { isVerified: true } });

  const owners = await prisma.organizationMember.findMany({
    where: { organizationId, role: 'OWNER', acceptedAt: { not: null } },
    select: { userId: true },
  });
  const recipients = new Set<string>([badge.userId, ...owners.map((owner) => owner.userId)]);
  await Promise.all(
    [...recipients].map((userId) =>
      prisma.notification.create({
        data: {
          userId,
          type: 'SYSTEM',
          title: `${organization.name} is verified`,
          message: 'Members now see a Verified mark beside your organisation in the directory and on its jobs and courses.',
          link: `/employer/organizations/${organizationId}`,
        },
      })
    )
  );

  return { organizationId, name: organization.name, verified: true };
}

// ===========================================
// GET CURRENT USER BADGES
// ===========================================
router.get('/badges', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const badges = await prisma.verificationBadge.findMany({
      // Not the women-only submission: it wears the same type as the identity
      // badge and is a different decision. Listed here, an approved women-only
      // review read as "Identity: Verified" on the verification page while
      // nothing had set the verified tick on her profile, and its evidence (the
      // name on a document) came back in a list built for the badges.
      where: { userId: req.user!.id, NOT: womanGateBadgeFilter },
      orderBy: { submittedAt: 'desc' },
    });

    res.json({
      success: true,
      data: badges,
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// PENDING REQUESTS (ADMIN)
// ===========================================
router.get('/badges/pending', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const status = typeof req.query.status === 'string' && ['PENDING', 'APPROVED', 'REJECTED'].includes(req.query.status) ? req.query.status : 'PENDING';
    const badges = await prisma.verificationBadge.findMany({
      // Women-gate submissions share this model but are reviewed in their own
      // queue, against evidence this screen does not show.
      where: { status: status as any, NOT: womanGateBadgeFilter },
      include: { user: { select: { id: true, firstName: true, lastName: true, displayName: true, email: true, avatar: true } } },
      orderBy: { submittedAt: status === 'PENDING' ? 'asc' : 'desc' },
      take: 200,
    });
    res.json({ success: true, data: badges });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// WHAT A REVIEWER CAN CHECK (ADMIN)
// ===========================================
// For an employer or educator application: whether her confirmed email domain
// matches the organisation's website, and what the ABN checks out as. Asked
// for one badge at a time, because the ABN lookup is a call to the register
// and the queue holds up to two hundred. Prompts for the person who decides;
// nothing here approves or refuses anything.
router.get('/badges/:id/checks', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const badge = await prisma.verificationBadge.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        type: true,
        metadata: true,
        user: { select: { email: true, emailVerified: true } },
      },
    });
    if (!badge) {
      throw new ApiError(404, 'Verification request not found');
    }
    // A women-gate submission has its own queue and its own evidence.
    if (isWomanGateMetadata(badge.metadata)) {
      throw new ApiError(409, 'Women-only verification is reviewed from the women-gate queue, where the evidence is.');
    }

    res.json({ success: true, data: { badgeId: badge.id, type: badge.type, checks: await reviewerChecks(badge) } });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// WHO MAY APPLY (MEMBER)
// ===========================================
// The creator badge has a rule ATHENA can count, so the page can say how far
// she is from it instead of letting her apply to be told no. Her own numbers
// only.
router.get('/eligibility', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: { creator: await creatorEligibility(req.user!.id) } });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// WOMEN-ONLY GATE REVIEW (ADMIN)
// ===========================================
// The queue a reviewer actually works. Before this she decided a membership
// from a name, an email and a subscription tier — `womanSelfAttested` is true
// for every account, because registration rejects false, so the one other
// column on the screen carried no information at all.
//
// Now each request arrives with what the member submitted: a passed Stripe
// Identity document-and-selfie check, or her own account of why she is asking,
// or both. Approving a request with neither is refused rather than merely
// discouraged, because a button that can be pressed on an empty record will be.

const WOMAN_GATE_STATUSES: WomanVerificationStatus[] = ['UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED'];

router.get(
  '/woman-gate/requests',
  authenticate,
  requireRole('ADMIN'),
  [
    query('status').optional().isIn(WOMAN_GATE_STATUSES),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const status = (req.query.status as WomanVerificationStatus) || 'PENDING';
      const page = Number(req.query.page ?? 1);
      const limit = Number(req.query.limit ?? 20);

      const where = { womanVerificationStatus: status };
      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            displayName: true,
            avatar: true,
            womanVerificationStatus: true,
            womanVerifiedAt: true,
            createdAt: true,
            // Present when the member completed the document check: the age
            // the gate now has is itself part of what the reviewer is looking
            // at, and a blank one says the check has not run.
            ageVerifiedAt: true,
            subscription: { select: { tier: true, status: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.user.count({ where }),
      ]);

      // One query for the whole page rather than one per row: the queue is the
      // page a reviewer keeps open, and a per-row lookup turns a twenty-row
      // page into twenty-one round trips.
      const badges = users.length
        ? await prisma.verificationBadge.findMany({
            where: { userId: { in: users.map((user) => user.id) }, type: 'IDENTITY', ...womanGateBadgeFilter },
            orderBy: { submittedAt: 'desc' },
            select: { id: true, userId: true, status: true, metadata: true, submittedAt: true, reason: true },
          })
        : [];

      const latestByUser = new Map<string, (typeof badges)[number]>();
      for (const badge of badges) {
        if (!latestByUser.has(badge.userId)) latestByUser.set(badge.userId, badge);
      }

      res.json({
        success: true,
        data: {
          users: users.map((user) => {
            const badge = latestByUser.get(user.id) ?? null;
            return {
              ...user,
              submission: badge
                ? {
                    badgeId: badge.id,
                    badgeStatus: badge.status,
                    submittedAt: badge.submittedAt,
                    reason: badge.reason,
                    evidence: readWomanGateEvidence(badge.metadata),
                  }
                : null,
            };
          }),
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

router.patch(
  '/woman-gate/:userId',
  authenticate,
  requireRole('ADMIN'),
  [
    body('status').isIn(['VERIFIED', 'REJECTED']),
    body('reason').optional().isString().trim().isLength({ max: 500 }),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { userId } = req.params;
      const status = req.body.status as 'VERIFIED' | 'REJECTED';
      const reason: string | null = req.body.reason ?? null;

      const subject = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (!subject) {
        throw new ApiError(404, 'User not found');
      }

      const badge = await prisma.verificationBadge.findFirst({
        where: { userId, type: 'IDENTITY', ...womanGateBadgeFilter },
        orderBy: { submittedAt: 'desc' },
        select: { id: true, metadata: true },
      });
      const evidence = badge ? readWomanGateEvidence(badge.metadata) : null;

      if (status === 'VERIFIED' && !evidence) {
        throw new ApiError(
          409,
          'There is nothing on this request to review. Ask her to complete the document check or send a note before approving.'
        );
      }

      // The document check can pass and still say the person is below the age
      // ATHENA is for. Approving that would put an under-age account behind
      // the members-only rooms on a reviewer's say-so, so it is refused here
      // and the reviewer rejects with a reason instead.
      if (status === 'VERIFIED' && evidence?.documentAgeFlag === 'BELOW_MINIMUM_AGE') {
        throw new ApiError(
          409,
          'The date of birth on the document is below the minimum age for ATHENA, so this request cannot be approved. Reject it with a reason instead.'
        );
      }

      // A document check taken for this gate used to be approved by the webhook
      // as though it were the ordinary identity badge, which set the Verified
      // mark with no reviewer. Rejecting here has to take that mark back, but
      // only when nothing else earned it: a separate identity badge that was
      // properly approved still stands.
      let clearVerifiedMark = false;
      if (status === 'REJECTED') {
        const otherBasis = await prisma.verificationBadge.findFirst({
          where: { userId, type: 'IDENTITY', status: 'APPROVED', NOT: womanGateBadgeFilter },
          select: { id: true },
        });
        clearVerifiedMark = !otherBasis;
      }

      await prisma.$transaction([
        prisma.user.update({
          where: { id: userId },
          data: {
            womanVerificationStatus: status,
            womanVerifiedAt: status === 'VERIFIED' ? new Date() : null,
            ...(clearVerifiedMark ? { isVerified: false } : {}),
          },
        }),
        ...(badge
          ? [
              prisma.verificationBadge.update({
                where: { id: badge.id },
                data: {
                  status: status === 'VERIFIED' ? 'APPROVED' : 'REJECTED',
                  reason,
                  reviewedAt: new Date(),
                  reviewedById: req.user!.id,
                },
              }),
            ]
          : []),
        prisma.notification.create({
          data: {
            userId,
            type: 'SYSTEM',
            title: status === 'VERIFIED' ? 'You are verified' : 'About your verification',
            message:
              status === 'VERIFIED'
                ? 'Your women-only verification is complete. The members-only parts of ATHENA are open to you.'
                : reason || 'Your women-only verification was not approved. You can appeal from Settings.',
            link: '/dashboard/settings/profile',
          },
        }),
      ]);

      await logAudit({
        action: status === 'VERIFIED' ? 'ADMIN_VERIFICATION_APPROVE' : 'ADMIN_VERIFICATION_REJECT',
        actorUserId: req.user?.id ?? null,
        targetUserId: userId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || undefined,
        metadata: {
          verificationType: 'WOMAN_ONLY',
          status,
          reason,
          evidenceProvider: evidence?.provider ?? null,
          documentCheckPassed: Boolean(evidence?.documentCheckPassedAt),
        },
      });

      // The decision the document and selfie were collected for has been made,
      // so Stripe is asked to erase them. Whatever happens, the decision stands.
      if (badge) {
        await redactIdentitySession({ ...badge, userId });
      }

      res.json({ success: true, data: { userId, womanVerificationStatus: status } });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// IDENTITY CHECK THROUGH STRIPE IDENTITY
// ===========================================
router.post('/identity/session', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!isStripeConfigured()) {
      throw new ApiError(503, 'Automated identity checks are not set up on this server yet. You can still apply for the badge and a person will review it.');
    }
    const userId = req.user!.id;
    // The women-only gate runs its own document check through the same model
    // and the same Stripe integration, discriminated by metadata.purpose. Its
    // badges are excluded here so that applying for one does not read as
    // "already verified" for the other, and so a retry of this badge does not
    // repoint the women-gate submission at a session the reviewer is not
    // waiting on.
    const approved = await prisma.verificationBadge.findFirst({
      where: { userId, type: 'IDENTITY', status: 'APPROVED', NOT: womanGateBadgeFilter },
      select: { id: true },
    });
    if (approved) {
      throw new ApiError(409, 'Your identity is already verified');
    }

    const base = (process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
    const session = await getStripe().identity.verificationSessions.create({
      type: 'document',
      metadata: { userId },
      options: { document: { require_matching_selfie: true } },
      return_url: `${base}/dashboard/settings/verification?identity=done`,
    });

    // One pending identity badge per member; a retry points it at the new session.
    const metadata = { provider: 'stripe_identity', sessionId: session.id, startedAt: new Date().toISOString() };
    const pending = await prisma.verificationBadge.findFirst({
      where: { userId, type: 'IDENTITY', status: 'PENDING', NOT: womanGateBadgeFilter },
      select: { id: true },
    });
    if (pending) {
      await prisma.verificationBadge.update({ where: { id: pending.id }, data: { metadata, reason: null } });
    } else {
      await prisma.verificationBadge.create({ data: { userId, type: 'IDENTITY', status: 'PENDING', metadata } });
    }
    await logAudit({
      action: 'USER_VERIFICATION_SUBMIT',
      actorUserId: userId,
      targetUserId: userId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || undefined,
      metadata: { type: 'IDENTITY', provider: 'stripe_identity', sessionId: session.id },
    });

    res.json({ success: true, data: { url: session.url, sessionId: session.id } });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// SUBMIT VERIFICATION REQUEST
// ===========================================
router.post(
  '/badges',
  authenticate,
  [body('type').isIn(['IDENTITY', 'EMPLOYER', 'EDUCATOR', 'MENTOR', 'CREATOR']), body('metadata').optional()],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const type = req.body.type as BadgeType;

      // Asked of what was sent, before anything is dropped: only an employer or
      // educator badge can speak for an organisation, and a mentor application
      // that names one is refused rather than quietly stripped of it.
      if (organisationIdFrom(req.body.metadata) && !ORGANISATION_BADGE_TYPES.has(type)) {
        throw new ApiError(400, 'Only an employer or educator badge can be applied for on behalf of an organisation');
      }

      // What the member may say about herself, and nothing that reads as a
      // check ATHENA ran. This used to be stored exactly as sent, so a member
      // could write `provider: stripe_identity` and a `documentCheckPassedAt`
      // into her own application and the reviewer would read it as evidence.
      const metadata = sanitiseBadgeMetadata(type, req.body.metadata);

      const organizationId = organisationIdFrom(metadata);

      // One application per badge at a time: a second one is the same request
      // in the reviewer's queue twice, and the form already waits on the first.
      // An application on behalf of an organisation is one per organisation, so
      // a woman who runs two of them can apply for both.
      const waiting = await prisma.verificationBadge.findFirst({
        where: {
          userId: req.user!.id,
          type,
          status: 'PENDING',
          NOT: womanGateBadgeFilter,
          ...(organizationId ? { metadata: { path: ['organizationId'], equals: organizationId } } : {}),
        },
        select: { id: true },
      });
      if (waiting) {
        throw new ApiError(409, 'You already have an application for this badge waiting for a person to review it');
      }

      if (type === 'IDENTITY') {
        const approved = await prisma.verificationBadge.findFirst({
          where: { userId: req.user!.id, type: 'IDENTITY', status: 'APPROVED', NOT: womanGateBadgeFilter },
          select: { id: true },
        });
        if (approved) {
          throw new ApiError(409, 'Your identity is already verified');
        }
      }

      // The creator badge is for an audience and a history, and ATHENA can
      // count both, so it does not queue an application it already knows the
      // answer to.
      if (type === 'CREATOR') {
        const eligibility = await creatorEligibility(req.user!.id);
        if (!eligibility.eligible) {
          throw new ApiError(409, `${creatorRefusal(eligibility)} You can apply once you get there.`);
        }
      }

      // A badge applied for on behalf of an organisation is refused up front
      // unless the applicant runs it; otherwise she would wait on a review
      // that could never verify the organisation.
      if (organizationId) {
        const { allowed, organization } = await canVerifyOrganisation(organizationId, req.user!.id);
        if (!organization || !allowed) {
          throw new ApiError(403, 'Only an owner or admin of the organisation can apply for its verification');
        }
        if (organization.isVerified) {
          throw new ApiError(409, `${organization.name} is already verified`);
        }
      }

      const badge = await prisma.verificationBadge.create({
        data: {
          userId: req.user!.id,
          type,
          status: 'PENDING',
          metadata: metadata ?? undefined,
        },
      });

      await logAudit({
        action: 'USER_VERIFICATION_SUBMIT',
        actorUserId: req.user?.id ?? null,
        targetUserId: req.user?.id ?? null,
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || undefined,
        metadata: { badgeId: badge.id, type },
      });

      res.status(201).json({
        success: true,
        data: badge,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// REVIEW VERIFICATION REQUEST (ADMIN)
// ===========================================
router.patch(
  '/badges/:id',
  authenticate,
  requireRole('ADMIN'),
  [body('status').isIn(['APPROVED', 'REJECTED']), body('reason').optional().isString().isLength({ max: 500 })],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { id } = req.params;
      const { status, reason } = req.body;

      // A women-gate submission wears the same type as an identity badge but
      // is a different decision with a different consequence, and approving it
      // here would set the verified mark while leaving the gate itself shut.
      // It has its own route above, which insists on evidence.
      const existing = await prisma.verificationBadge.findUnique({
        where: { id },
        select: { metadata: true, type: true, userId: true, status: true },
      });
      if (!existing) {
        throw new ApiError(404, 'Verification request not found');
      }
      if (isWomanGateMetadata(existing.metadata)) {
        throw new ApiError(409, 'Review women-only verification from the women-gate queue, where the evidence is.');
      }

      if (status === 'APPROVED') {
        // Stripe's own result approves an identity badge without a person (the
        // webhook); this route is a person approving by hand, and the verified
        // tick it sets rests on what that person checked. Approving with
        // nothing to say was possible, and the form's only field is optional,
        // so the tick could be handed out on no evidence at all. Naming what
        // was checked is the record of what the tick means.
        if (existing.type === 'IDENTITY' && (typeof reason !== 'string' || reason.trim().length < 10)) {
          throw new ApiError(
            400,
            'Say what you checked before approving an identity badge, for example the document seen and that it matches the person. The member can read this.'
          );
        }

        // The creator rule is checked again at the decision: an application can
        // wait weeks, and the audience it was made on can have gone.
        if (existing.type === 'CREATOR') {
          const eligibility = await creatorEligibility(existing.userId);
          if (!eligibility.eligible) {
            throw new ApiError(409, creatorRefusal(eligibility));
          }
        }
      }

      const badge = await prisma.verificationBadge.update({
        where: { id },
        data: {
          status,
          reason: reason ?? null,
          reviewedAt: new Date(),
          reviewedById: req.user!.id,
        },
      });

      if (status === 'APPROVED' && badge.type === 'IDENTITY') {
        await prisma.user.update({
          where: { id: badge.userId },
          data: { isVerified: true },
        });
      }

      // Taking an approval back has to take the tick back. The profile draws
      // the mark from User.isVerified alone, so a reviewer who rejects a badge
      // she had approved would otherwise leave the member looking verified on
      // the strength of a decision that no longer stands. A separate identity
      // badge that is still approved keeps it. Turning down a request that was
      // never approved changes nothing.
      if (status === 'REJECTED' && badge.type === 'IDENTITY' && existing.status === 'APPROVED') {
        const otherBasis = await prisma.verificationBadge.findFirst({
          where: { userId: badge.userId, type: 'IDENTITY', status: 'APPROVED', id: { not: badge.id }, NOT: womanGateBadgeFilter },
          select: { id: true },
        });
        if (!otherBasis) {
          await prisma.user.update({ where: { id: badge.userId }, data: { isVerified: false } });
        }
      }

      // An employer or educator badge applied for from an organisation page
      // verifies that organisation in the same decision (see the top of the file).
      const organization = status === 'APPROVED' ? await verifyOrganisationForBadge(badge) : null;

      await logAudit({
        action: status === 'APPROVED' ? 'ADMIN_VERIFICATION_APPROVE' : 'ADMIN_VERIFICATION_REJECT',
        actorUserId: req.user?.id ?? null,
        targetUserId: badge.userId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || undefined,
        metadata: {
          badgeId: badge.id,
          type: badge.type,
          reason,
          ...(organization ? { organizationId: organization.organizationId, organizationVerified: organization.verified } : {}),
        },
      });

      // An identity badge reviewed by hand may carry a Stripe session. Once it
      // is decided the document and selfie have done their job and Stripe is
      // asked to erase them; a badge with no session has nothing to redact.
      if (badge.type === 'IDENTITY') {
        await redactIdentitySession(badge);
      }

      res.json({
        success: true,
        data: { ...badge, organization },
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// HOST EMPLOYER SAFETY ATTESTATION
// ===========================================
// An organisation may place apprentices through ATHENA only while it is verified
// (the badge review above) AND holds an approved, unexpired host safety
// attestation (hiring-access.service, hostMayPlaceApprentices). This is the
// second half: an owner or admin of the organisation answers the safety
// statements and names a safety contact and an ABN, staff read it and write
// down what they did to be satisfied, and the decision is in the audit log.
//
// Organisation-level facts only. Nothing here collects, or lets staff see, an
// individual's police or background check: see host-safety.service and
// docs/security/host-employer-checks.md.

/** An accepted membership, with the organisation it is of. An invitation not yet answered is not one. */
async function acceptedMembership(organizationId: string, userId: string) {
  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: { role: true, acceptedAt: true, organization: { select: { id: true, name: true, isVerified: true, abn: true } } },
  });
  return membership && membership.acceptedAt ? membership : null;
}

/** Everyone who runs an organisation (accepted owners and admins), for telling them what was decided. */
async function organisationOwnerIds(organizationId: string): Promise<string[]> {
  const members = await prisma.organizationMember.findMany({
    where: { organizationId, role: { in: ['OWNER', 'ADMIN'] }, acceptedAt: { not: null } },
    select: { userId: true },
  });
  return [...new Set(members.map((m) => m.userId))];
}

// GET /api/verification/host-safety/:orgId - Where the organisation stands, and the statements to affirm
router.get('/host-safety/:orgId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { orgId } = req.params;
    const membership = await acceptedMembership(orgId, req.user!.id);
    const isStaff = req.user!.role === 'ADMIN';
    // To someone who is not on the organisation's team it does not exist, so
    // the route cannot be used to find out which organisations are hosts.
    if (!membership && !isStaff) throw new ApiError(404, 'Organisation not found');

    const organization = membership?.organization ?? (await prisma.organization.findUnique({ where: { id: orgId }, select: { id: true, name: true, isVerified: true, abn: true } }));
    if (!organization) throw new ApiError(404, 'Organisation not found');

    const row = await latestAttestation(orgId);
    const attestation = presentAttestation(row);
    const standingApproval = organization.isVerified
      ? await prisma.hostEmployerSafetyAttestation.findFirst({
          where: { organizationId: orgId, status: 'APPROVED', expiresAt: { gt: new Date() } },
          select: { id: true },
        })
      : null;
    const mayAttest = Boolean(membership && ORGANISATION_VERIFYING_ROLES.has(membership.role));

    res.json({
      success: true,
      data: {
        version: HOST_SAFETY_VERSION,
        questions: HOST_SAFETY_QUESTIONS,
        renewalWindowDays: HOST_ATTESTATION_RENEWAL_WINDOW_DAYS,
        organization: { id: organization.id, name: organization.name, isVerified: organization.isVerified, abn: organization.abn },
        attestation,
        mayAttest,
        canSubmit: mayAttest && attestation.canSubmit,
        // The two halves, and both together: what the placement routes ask. Read
        // from whether an approval stands, not from the latest attestation: a
        // renewal waiting or refused beside an approval that still stands does not
        // stop the organisation placing apprentices, and the page must not say it does.
        mayPlaceApprentices: Boolean(organization.isVerified && standingApproval),
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/verification/host-safety/:orgId - An owner or admin sends the attestation
router.post('/host-safety/:orgId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { orgId } = req.params;
    const membership = await acceptedMembership(orgId, req.user!.id);
    if (!membership) throw new ApiError(404, 'Organisation not found');
    if (!ORGANISATION_VERIFYING_ROLES.has(membership.role)) {
      throw new ApiError(403, 'Only an owner or admin of the organisation can send its safety attestation');
    }

    const input = parseHostInput(hostAttestationSchema, req.body);
    const row = await submitHostAttestation(orgId, req.user!.id, input);

    await logAudit({
      action: 'USER_VERIFICATION_SUBMIT',
      actorUserId: req.user!.id,
      targetUserId: req.user!.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || undefined,
      metadata: { type: 'HOST_SAFETY_ATTESTATION', organizationId: orgId, attestationId: row.id },
    });

    const admins = await bestEffort('host-safety.admin-recipients', () => prisma.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } }), [] as Array<{ id: string }>);
    await Promise.all(
      admins.map((admin) =>
        bestEffort('notification.host-safety-attestation', () =>
          prisma.notification.create({
            data: {
              userId: admin.id,
              type: 'SYSTEM',
              title: 'A host employer sent its safety attestation',
              message: `${membership.organization.name} asks to place apprentices through ATHENA. It waits in the host safety queue.`,
              link: '/admin/host-safety',
              data: { kind: 'HOST_SAFETY_ATTESTATION', organizationId: orgId, attestationId: row.id },
            },
          })
        )
      )
    );

    res.status(201).json({
      success: true,
      data: presentAttestation(row),
      message: 'Sent. A member of ATHENA staff will read it and tell you what they decide.',
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/verification/host-safety-queue - Attestations waiting for a decision, and those about to end (ADMIN)
router.get('/host-safety-queue', authenticate, requireRole('ADMIN'), async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const soon = new Date(now.getTime() + HOST_ATTESTATION_RENEWAL_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const include = { organization: { select: { id: true, name: true, slug: true, website: true, type: true, city: true, state: true, isVerified: true, abn: true } } };
    // Nothing writes EXPIRED, so an approval whose date has passed is still
    // APPROVED in the table. "Ending" is the ones that still stand and end soon;
    // without the lower bound every approval that ever lapsed stayed in this list
    // for good, oldest first, and in time pushed the ones about to end past the
    // end of it. "Standing" is every other approval that stands, so that staff
    // can find one to withdraw, which is how an approval is taken back.
    const [waiting, ending, standing] = await Promise.all([
      prisma.hostEmployerSafetyAttestation.findMany({ where: { status: 'PENDING' }, include, orderBy: { attestedAt: 'asc' }, take: 200 }),
      prisma.hostEmployerSafetyAttestation.findMany({ where: { status: 'APPROVED', expiresAt: { gt: now, lte: soon } }, include, orderBy: { expiresAt: 'asc' }, take: 200 }),
      prisma.hostEmployerSafetyAttestation.findMany({ where: { status: 'APPROVED', expiresAt: { gt: soon } }, include, orderBy: { expiresAt: 'asc' }, take: 200 }),
    ]);

    // A waiting request from an organisation whose last approval still stands is
    // a renewal, and staff are told when the standing one ends.
    const standingFor = waiting.length
      ? await prisma.hostEmployerSafetyAttestation.findMany({
          where: { organizationId: { in: waiting.map((r) => r.organizationId) }, status: 'APPROVED', expiresAt: { gt: now } },
          select: { organizationId: true, expiresAt: true },
        })
      : [];
    const standingEnds = new Map(standingFor.map((r) => [r.organizationId, r.expiresAt]));

    const attesterIds = [...new Set([...waiting, ...ending, ...standing].map((r) => r.attestedById).filter((id): id is string => Boolean(id)))];
    const attesters = attesterIds.length
      ? await prisma.user.findMany({ where: { id: { in: attesterIds } }, select: { id: true, firstName: true, lastName: true, displayName: true, email: true } })
      : [];
    const byId = new Map(attesters.map((a) => [a.id, a]));
    const shape = (row: (typeof waiting)[number]) => ({
      ...presentForReviewer(row, now),
      attestedBy: row.attestedById ? byId.get(row.attestedById) ?? null : null,
      renewal: row.status === 'PENDING' && standingEnds.has(row.organizationId),
      currentApprovalEndsAt: row.status === 'PENDING' ? standingEnds.get(row.organizationId) ?? null : null,
    });

    res.json({ success: true, data: { waiting: waiting.map(shape), ending: ending.map(shape), standing: standing.map(shape) } });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/verification/host-safety-attestations/:id - Approve or refuse an attestation (ADMIN)
router.patch('/host-safety-attestations/:id', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const decision = parseHostInput(hostDecisionSchema, req.body);

    const existing = await prisma.hostEmployerSafetyAttestation.findUnique({ where: { id }, select: { organizationId: true } });
    if (!existing) throw new ApiError(404, 'Attestation not found');

    // Staff do not decide the attestation of an organisation they belong to: a
    // check the checked party can pass for itself is not a check.
    const reviewerMembership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: existing.organizationId, userId: req.user!.id } },
      select: { id: true },
    });
    if (reviewerMembership) {
      throw new ApiError(403, 'You belong to this organisation, so another member of staff has to decide its attestation.');
    }

    const now = new Date();
    const { before, after } = await decideHostAttestation(id, decision, req.user!.id, now);
    const organization = await prisma.organization.findUnique({ where: { id: after.organizationId }, select: { name: true, isVerified: true } });
    const orgName = organization?.name ?? 'Your organisation';
    const approved = decision.decision === 'APPROVE';

    const message = approved
      ? `ATHENA staff have approved ${orgName}'s host safety attestation. It stands until ${after.expiresAt!.toLocaleDateString('en-AU', { dateStyle: 'long', timeZone: 'Australia/Brisbane' })}.${
          organization?.isVerified ? ' Your organisation can now place apprentices through ATHENA.' : ' Your organisation also has to be verified before apprentices can be placed; you can apply for that from its page.'
        }`
      : `ATHENA staff could not approve ${orgName}'s host safety attestation. ${decision.note} You can send a new one when this is sorted.`;
    const recipients = await organisationOwnerIds(after.organizationId);
    await Promise.all(
      recipients.map((userId) =>
        bestEffort('notification.host-safety-decision', () =>
          prisma.notification.create({
            data: {
              userId,
              type: 'SYSTEM',
              title: approved ? 'Your host safety attestation is approved' : 'Your host safety attestation was not approved',
              message,
              link: `/employer/organizations/${after.organizationId}/apprenticeships`,
              data: { kind: 'HOST_SAFETY_ATTESTATION_DECISION', organizationId: after.organizationId, outcome: approved ? 'APPROVED' : 'REJECTED' },
            },
          })
        )
      )
    );

    await recordStaffAction(req, 'HOST_SAFETY_ATTESTATION_DECIDED', {
      resourceType: 'HostEmployerSafetyAttestation',
      resourceId: id,
      decision: decision.decision,
      organizationId: after.organizationId,
      before: { status: before.status, expiresAt: before.expiresAt },
      after: { status: after.status, expiresAt: after.expiresAt },
      note: decision.note,
      abnCheck: after.abnCheck ?? null,
      standingAfter: attestationStanding(after, now),
    });

    res.json({ success: true, data: presentForReviewer(after, now) });
  } catch (error) {
    next(error);
  }
});

export default router;
