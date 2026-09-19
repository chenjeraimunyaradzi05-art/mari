import { Router, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { logAudit } from '../utils/audit';
import Stripe from 'stripe';

const router = Router();

// Identity checks run through Stripe Identity when a key is configured: the
// member photographs her document and a selfie on Stripe's hosted page, and
// the webhook approves the badge when the check passes. Without a key the
// badge is applied for and reviewed by hand, as before.
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' }) : null;

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

function organisationIdFrom(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>).organizationId;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** Whether this member may apply for, and be the reason for, an organisation's verification. */
async function canVerifyOrganisation(organizationId: string, userId: string) {
  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: { role: true, organization: { select: { id: true, name: true, isVerified: true } } },
  });
  if (!membership) return { allowed: false as const, organization: null };
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
    where: { organizationId, role: 'OWNER' },
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
      where: { userId: req.user!.id },
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
      where: { status: status as any },
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
// IDENTITY CHECK THROUGH STRIPE IDENTITY
// ===========================================
router.post('/identity/session', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!stripe) {
      throw new ApiError(503, 'Automated identity checks are not set up on this server yet. You can still apply for the badge and a person will review it.');
    }
    const userId = req.user!.id;
    const approved = await prisma.verificationBadge.findFirst({ where: { userId, type: 'IDENTITY', status: 'APPROVED' }, select: { id: true } });
    if (approved) {
      throw new ApiError(409, 'Your identity is already verified');
    }

    const base = (process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
    const session = await stripe.identity.verificationSessions.create({
      type: 'document',
      metadata: { userId },
      options: { document: { require_matching_selfie: true } },
      return_url: `${base}/dashboard/settings/verification?identity=done`,
    });

    // One pending identity badge per member; a retry points it at the new session.
    const metadata = { provider: 'stripe_identity', sessionId: session.id, startedAt: new Date().toISOString() };
    const pending = await prisma.verificationBadge.findFirst({ where: { userId, type: 'IDENTITY', status: 'PENDING' }, select: { id: true } });
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

      const { type, metadata } = req.body;

      // A badge applied for on behalf of an organisation is refused up front
      // unless the applicant runs it; otherwise she would wait on a review
      // that could never verify the organisation.
      const organizationId = organisationIdFrom(metadata);
      if (organizationId) {
        if (!ORGANISATION_BADGE_TYPES.has(type)) {
          throw new ApiError(400, 'Only an employer or educator badge can be applied for on behalf of an organisation');
        }
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
  [body('status').isIn(['APPROVED', 'REJECTED']), body('reason').optional().isString()],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { id } = req.params;
      const { status, reason } = req.body;

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

      res.json({
        success: true,
        data: { ...badge, organization },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
