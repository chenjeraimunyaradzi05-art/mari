import { Router, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth';
import { UserRole, JobStatus, SubscriptionTier, SubscriptionStatus, EventType, EventFormat } from '@prisma/client';
import { z } from 'zod';
import { ApiError } from '../middleware/errorHandler';
import {
  ModerationAction,
  getAnonymousReport,
  listAnonymousReports,
  processReportById,
  resolveAnonymousReport,
} from '../services/content-report.service';
import { gdprService } from '../services/gdpr.service';
import { consentService } from '../services/consent.service';
import { logAudit } from '../utils/audit';
import { logger } from '../utils/logger';
import { sendEmail } from '../utils/email';
import crypto from 'crypto';

const router = Router();

const generateInviteCode = (prefix?: string) => {
  const base = crypto.randomBytes(5).toString('hex').toUpperCase();
  const normalizedPrefix = prefix ? prefix.trim().toUpperCase() : '';
  return normalizedPrefix ? `${normalizedPrefix}-${base}` : base;
};

/**
 * What an administrator may actually set, spelled out. These handlers used to
 * pass the body straight into Prisma, so an unknown status arrived as a 500
 * from the database layer and a string in a boolean column was attempted
 * rather than refused. strict() also rejects unexpected keys, because an
 * admin surface writing whatever it is sent is how a typo becomes data.
 */
const adminJobPatchSchema = z
  .object({
    status: z.nativeEnum(JobStatus).optional(),
    isSponsored: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
  })
  .strict();

const adminSubscriptionPatchSchema = z
  .object({
    tier: z.nativeEnum(SubscriptionTier).optional(),
    status: z.nativeEnum(SubscriptionStatus).optional(),
    periodEnd: z.coerce.date().optional(),
  })
  .strict();

const inviteCodeCreateSchema = z
  .object({
    count: z.coerce.number().int().min(1).max(100).default(1),
    maxUses: z.coerce.number().int().positive().nullish(),
    expiresAt: z.coerce.date().nullish(),
    // The prefix is stamped into every generated code, so it is kept short
    // and plain rather than letting arbitrary text into the code space.
    prefix: z.string().trim().regex(/^[A-Za-z0-9]{1,12}$/).optional(),
  })
  .strict();

function parseOr400<T>(schema: { safeParse(input: unknown): { success: true; data: T } | { success: false; error: z.ZodError } }, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues.map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`).join('; '));
  }
  return parsed.data;
}

// All admin routes require authentication and ADMIN role
router.use(authenticate);

// Moderators work the report queue and content moderation; everything else in
// here (users, billing, settings, compliance) is the platform admin's alone.
const MODERATOR_PREFIXES = ['/moderation', '/content'];
router.use((req: AuthRequest, res: Response, next: NextFunction) => {
  const moderatorAllowed = MODERATOR_PREFIXES.some((prefix) => req.path === prefix || req.path.startsWith(`${prefix}/`));
  return (moderatorAllowed ? requireRole('ADMIN', 'MODERATOR') : requireRole('ADMIN'))(req, res, next);
});

// ============================================================================
// DASHBOARD STATS
// ============================================================================

/**
 * GET /admin/stats
 * Get platform-wide statistics for admin dashboard
 */
router.get('/stats', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [
      totalUsers,
      newUsersThisMonth,
      totalJobs,
      activeJobs,
      totalPosts,
      totalCourses,
      totalMentors,
      totalSubscriptions,
      proSubscriptions,
      businessSubscriptions,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setDate(1)), // First day of current month
          },
        },
      }),
      prisma.job.count(),
      prisma.job.count({ where: { status: 'ACTIVE' } }),
      prisma.post.count(),
      prisma.course.count(),
      prisma.mentorProfile.count({ where: { isAvailable: true } }),
      prisma.subscription.count(),
      prisma.subscription.count({ where: { tier: 'PREMIUM_PROFESSIONAL', status: 'ACTIVE' } }),
      prisma.subscription.count({ where: { tier: 'ENTERPRISE', status: 'ACTIVE' } }),
    ]);

    // User growth over past 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const userGrowth = await prisma.user.groupBy({
      by: ['createdAt'],
      _count: true,
      where: {
        createdAt: {
          gte: sixMonthsAgo,
        },
      },
    });

    // Count by persona
    const usersByPersona = await prisma.user.groupBy({
      by: ['persona'],
      _count: true,
    });

    // Count by role
    const usersByRole = await prisma.user.groupBy({
      by: ['role'],
      _count: true,
    });

    res.json({
      overview: {
        totalUsers,
        newUsersThisMonth,
        totalJobs,
        activeJobs,
        totalPosts,
        totalCourses,
        totalMentors,
      },
      subscriptions: {
        total: totalSubscriptions,
        pro: proSubscriptions,
        business: businessSubscriptions,
      },
      userBreakdown: {
        byPersona: usersByPersona,
        byRole: usersByRole,
      },
      growth: userGrowth,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// USER MANAGEMENT
// ============================================================================

/**
 * GET /admin/users
 * List all users with pagination and filters
 */
router.get('/users', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      page = '1',
      limit = '20',
      search = '',
      role,
      persona,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {};

    if (search) {
      where.OR = [
        { firstName: { contains: search as string, mode: 'insensitive' } },
        { lastName: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    if (role) {
      where.role = role;
    }

    if (persona) {
      where.persona = persona;
    }

    if (status === 'suspended') {
      where.isSuspended = true;
    } else if (status === 'active') {
      where.isSuspended = false;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          avatar: true,
          role: true,
          persona: true,
          emailVerified: true,
          isSuspended: true,
          createdAt: true,
          lastLoginAt: true,
          _count: {
            select: {
              posts: true,
              applications: true,
            },
          },
        },
        skip,
        take: limitNum,
        orderBy: { [sortBy as string]: sortOrder },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      users,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /admin/users/:id
 * Get detailed user information
 */
router.get('/users/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        displayName: true,
        avatar: true,
        headline: true,
        role: true,
        persona: true,
        emailVerified: true,
        isSuspended: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        profile: true,
        subscription: true,
        posts: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            content: true,
            type: true,
            createdAt: true,
          },
        },
        applications: {
          take: 5,
          orderBy: { appliedAt: 'desc' },
          select: {
            id: true,
            status: true,
            appliedAt: true,
            job: {
              select: { id: true, title: true },
            },
          },
        },
        mentorProfile: true,
        _count: {
          select: {
            posts: true,
            comments: true,
            applications: true,
            courseEnrollments: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /admin/users/:id
 * Update user (role, suspension, verification)
 */
router.patch('/users/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { role, isSuspended, emailVerified, suspensionReason } = req.body;

    const updateData: any = {};

    if (role !== undefined) {
      // A role the enum does not know used to reach Prisma and come back as a 500.
      if (!Object.values(UserRole).includes(role)) {
        throw new ApiError(400, 'Unknown role');
      }
      // Nobody removes their own admin access by accident.
      if (req.params.id === req.user!.id && role !== req.user!.role) {
        throw new ApiError(400, 'You cannot change your own role');
      }
      updateData.role = role;
    }

    if (isSuspended !== undefined) {
      updateData.isSuspended = isSuspended;
      if (isSuspended && suspensionReason) {
        // Store suspension reason in metadata or log
        logger.info('User suspended', { userId: id, reason: suspensionReason, adminId: req.user?.id });
      }
    }

    if (emailVerified !== undefined) {
      updateData.emailVerified = emailVerified;
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        emailVerified: true,
        isSuspended: true,
      },
    });

    await logAudit({
      action: 'ADMIN_USER_UPDATE',
      actorUserId: req.user?.id ?? null,
      targetUserId: id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || undefined,
      metadata: {
        updatedFields: Object.keys(updateData),
        role,
        isSuspended,
        emailVerified,
        suspensionReason,
      },
    });

    res.json(user);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /admin/users/:id
 * Delete a user (soft delete or hard delete)
 *
 * The hard branch used to run a seven-table transaction — comments, likes,
 * posts, notifications, job applications, saved jobs, then the user row —
 * against a personal-data register that names more than sixty tables, and it
 * never consulted LegalHold. So an administrator with curl could destroy data
 * that was under litigation hold, through a path that also left most of the
 * member behind or died on a foreign key halfway. It now runs the same erasure
 * the member's own right-to-be-forgotten runs, and refuses on the same terms.
 */
router.delete('/users/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { hard = false } = req.query;
    const isHard = hard === 'true';

    if (isHard) {
      const outcome = await gdprService.eraseAccountByAdmin(id, {
        adminId: req.user?.id ?? null,
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || undefined,
      });

      if (outcome.status === 'REJECTED') {
        // A hold is a court's claim on this data, not a preference, so the
        // refusal is the answer rather than something to log and work around.
        throw new ApiError(409, outcome.reason || 'This account is under a legal hold and cannot be deleted.');
      }

      await logAudit({
        action: 'ADMIN_USER_DELETE',
        actorUserId: req.user?.id ?? null,
        targetUserId: id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || undefined,
        metadata: {
          hard: true,
          accountRemoved: outcome.accountRemoved,
          retainedSections: outcome.retainedSections,
          rowsRemoved: outcome.rowsRemoved,
        },
      });

      return res.json({
        success: true,
        message: outcome.accountRemoved
          ? 'Account erased.'
          : 'Account stripped back to a shell; records we must retain still point at it.',
        data: {
          accountRemoved: outcome.accountRemoved,
          retainedSections: outcome.retainedSections,
          rowsRemoved: outcome.rowsRemoved,
        },
      });
    }

    // Soft delete - suspend and anonymize
    await prisma.user.update({
      where: { id },
      data: {
        isSuspended: true,
        email: gdprService.suspensionTombstoneEmail(id),
        firstName: 'Deleted',
        lastName: 'User',
      },
    });

    await logAudit({
      action: 'ADMIN_USER_DELETE',
      actorUserId: req.user?.id ?? null,
      targetUserId: id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || undefined,
      metadata: { hard: false },
    });

    res.json({ success: true, message: 'User suspended and anonymized' });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// CONTENT MODERATION
// ============================================================================

/**
 * GET /admin/content/posts
 * List posts with moderation info
 */
router.get('/content/posts', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      page = '1',
      limit = '20',
      reported = 'false',
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (reported === 'true') {
      where.reportCount = { gt: 0 };
    }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        select: {
          id: true,
          content: true,
          type: true,
          mediaUrls: true,
          likeCount: true,
          commentCount: true,
          reportCount: true,
          isHidden: true,
          createdAt: true,
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
        },
        skip,
        take: limitNum,
        orderBy: { [sortBy as string]: sortOrder },
      }),
      prisma.post.count({ where }),
    ]);

    res.json({
      posts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /admin/content/posts/:id
 * Moderate a post (hide, delete, clear reports)
 */
router.patch('/content/posts/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { action, reason } = req.body;

    let result;

    switch (action) {
      case 'hide':
        result = await prisma.post.update({
          where: { id },
          data: { isHidden: true },
        });
        break;
      case 'unhide':
        result = await prisma.post.update({
          where: { id },
          data: { isHidden: false },
        });
        break;
      case 'clearReports':
        result = await prisma.post.update({
          where: { id },
          data: { reportCount: 0 },
        });
        break;
      case 'delete':
        await prisma.$transaction([
          prisma.comment.deleteMany({ where: { postId: id } }),
          prisma.like.deleteMany({ where: { postId: id } }),
          prisma.post.delete({ where: { id } }),
        ]);
        result = { deleted: true };
        break;
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

    const auditAction =
      action === 'hide'
        ? 'ADMIN_POST_HIDE'
        : action === 'unhide'
        ? 'ADMIN_POST_UNHIDE'
        : action === 'clearReports'
        ? 'ADMIN_POST_CLEAR_REPORTS'
        : action === 'delete'
        ? 'ADMIN_POST_DELETE'
        : null;

    if (auditAction) {
      await logAudit({
        action: auditAction,
        actorUserId: req.user?.id ?? null,
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || undefined,
        metadata: { postId: id, reason },
      });
    }

    logger.info('Admin moderation action', { postId: id, action, reason: reason || 'None provided', adminId: req.user?.id });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /admin/content/comments
 * List comments with moderation info
 */
router.get('/content/comments', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      page = '1',
      limit = '20',
      reported = 'false',
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (reported === 'true') {
      where.reportCount = { gt: 0 };
    }

    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where,
        select: {
          id: true,
          content: true,
          reportCount: true,
          isHidden: true,
          createdAt: true,
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          post: {
            select: {
              id: true,
              content: true,
            },
          },
        },
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.comment.count({ where }),
    ]);

    res.json({
      comments,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /admin/content/comments/:id
 * Delete a comment
 */
router.delete('/content/comments/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    await prisma.comment.delete({ where: { id } });

    await logAudit({
      action: 'ADMIN_COMMENT_DELETE',
      actorUserId: req.user?.id ?? null,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || undefined,
      metadata: { commentId: id },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// MODERATION QUEUE
// ============================================================================

const REPORT_STATUSES = ['PENDING', 'REVIEWING', 'RESOLVED', 'DISMISSED'];
const MODERATION_ACTIONS: ModerationAction[] = ['dismiss', 'warn', 'remove', 'suspend', 'ban', 'escalate'];

// AuditAction has no moderation verbs of its own, so each outcome is logged
// under the closest existing action and the report details ride in metadata.
const REPORT_AUDIT_ACTIONS = {
  dismiss: 'ADMIN_POST_CLEAR_REPORTS',
  warn: 'ADMIN_USER_UPDATE',
  remove: 'ADMIN_POST_HIDE',
  suspend: 'ADMIN_USER_UPDATE',
  ban: 'ADMIN_USER_UPDATE',
  escalate: 'ADMIN_USER_UPDATE',
} as const;

const reportQueueSelect = {
  id: true,
  contentType: true,
  contentId: true,
  reason: true,
  description: true,
  status: true,
  action: true,
  reviewerId: true,
  reviewNotes: true,
  actionTakenAt: true,
  createdAt: true,
  updatedAt: true,
  reporter: {
    select: { id: true, firstName: true, lastName: true, displayName: true, email: true },
  },
  reportedUser: {
    select: { id: true, firstName: true, lastName: true, displayName: true, email: true, isSuspended: true },
  },
};

/**
 * GET /admin/moderation/reports
 * Work queue of user reports, newest first
 */
router.get('/moderation/reports', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      page = '1',
      limit = '20',
      status,
      contentType,
      reason,
      assigned,
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (status && REPORT_STATUSES.includes(String(status).toUpperCase())) {
      where.status = String(status).toUpperCase();
    }
    if (contentType) {
      where.contentType = String(contentType).toUpperCase();
    }
    // Reasons arrive both as codes and as free text depending on where the
    // report was filed, so match loosely rather than on an exact value.
    if (reason) {
      where.reason = { contains: String(reason), mode: 'insensitive' };
    }
    if (assigned === 'me') {
      where.reviewerId = req.user?.id;
    } else if (assigned === 'unclaimed') {
      where.reviewerId = null;
    }

    const [reports, total, openCount] = await Promise.all([
      prisma.contentReport.findMany({
        where,
        select: reportQueueSelect,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.contentReport.count({ where }),
      prisma.contentReport.count({ where: { status: { in: ['PENDING', 'REVIEWING'] } } }),
    ]);

    res.json({
      reports,
      openCount,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /admin/moderation/reports/:id
 * Single report with every other open report against the same account
 */
router.get('/moderation/reports/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const report = await prisma.contentReport.findUnique({
      where: { id },
      select: reportQueueSelect,
    });

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const relatedReports = await prisma.contentReport.findMany({
      where: {
        reportedUserId: report.reportedUser.id,
        id: { not: report.id },
      },
      select: { id: true, reason: true, status: true, action: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    res.json({ report, relatedReports });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /admin/moderation/reports/:id/claim
 * Take ownership of a report so two moderators do not work the same case
 */
router.post('/moderation/reports/:id/claim', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { release = false } = req.body ?? {};

    const report = await prisma.contentReport.findUnique({
      where: { id },
      select: { id: true, status: true, reviewerId: true },
    });

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    if (report.status === 'RESOLVED' || report.status === 'DISMISSED') {
      return res.status(409).json({ error: 'Report has already been actioned' });
    }

    if (report.reviewerId && report.reviewerId !== req.user?.id) {
      return res.status(409).json({ error: 'Report is claimed by another moderator' });
    }

    const claimed = await prisma.contentReport.update({
      where: { id },
      data: release
        ? { status: 'PENDING', reviewerId: null }
        : { status: 'REVIEWING', reviewerId: req.user?.id ?? null },
      select: reportQueueSelect,
    });

    res.json(claimed);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /admin/moderation/reports/:id/action
 * Decide a report and enforce the decision
 */
router.post('/moderation/reports/:id/action', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { action, notes } = req.body ?? {};

    if (!MODERATION_ACTIONS.includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    const existing = await prisma.contentReport.findUnique({
      where: { id },
      select: { id: true, reviewerId: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Report not found' });
    }

    if (existing.reviewerId && existing.reviewerId !== req.user?.id) {
      return res.status(409).json({ error: 'Report is claimed by another moderator' });
    }

    const outcome = await processReportById(id, action, req.user!.id, notes);

    await logAudit({
      action: REPORT_AUDIT_ACTIONS[action as ModerationAction],
      actorUserId: req.user?.id ?? null,
      targetUserId: outcome.reportedUserId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || undefined,
      metadata: {
        reportId: outcome.reportId,
        ticketId: outcome.ticketId,
        moderationAction: outcome.action,
        contentType: outcome.contentType,
        contentId: outcome.contentId,
        notes: notes ?? null,
      },
    });

    logger.info('Report actioned', {
      reportId: outcome.reportId,
      action: outcome.action,
      adminId: req.user?.id,
    });

    res.json(outcome);
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// ANONYMOUS REPORT QUEUE
// ============================================================================

/**
 * A ContentReport names a member on both sides, so a report filed by somebody
 * with no account — the case the Online Safety Act 2021 (Cth) cares most about,
 * because a woman who has just been targeted may have no way to sign in — is
 * written as a SafetyIncident instead. Nothing read those rows back: no route,
 * no page, no worker. Every anonymous report since the public form shipped went
 * into a table no moderator opens, behind a response promising a review within
 * 48 hours. These three routes are the queue: the same shape as the named
 * queue above, and the same enforcement behind the decision.
 */

/**
 * GET /admin/moderation/anonymous-reports
 * Work queue of reports filed without an account, newest first
 */
router.get('/moderation/anonymous-reports', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '20', status, contentType, reason } = req.query;
    const normalizedStatus = String(status || '').toUpperCase();

    const result = await listAnonymousReports({
      status: normalizedStatus === 'PENDING' || normalizedStatus === 'ACTIONED' ? normalizedStatus : undefined,
      contentType: contentType ? String(contentType) : undefined,
      reason: reason ? String(reason) : undefined,
      page: parseInt(String(page), 10),
      limit: parseInt(String(limit), 10),
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /admin/moderation/anonymous-reports/:id
 * One anonymous report, with the named reports already open against the same account
 */
router.get('/moderation/anonymous-reports/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const report = await getAnonymousReport(req.params.id);

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const relatedReports = report.reportedUser
      ? await prisma.contentReport.findMany({
          where: { reportedUserId: report.reportedUser.id },
          select: { id: true, reason: true, status: true, action: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 20,
        })
      : [];

    res.json({ report, relatedReports });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /admin/moderation/anonymous-reports/:id/action
 * Decide an anonymous report and enforce the decision
 */
router.post('/moderation/anonymous-reports/:id/action', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { action, notes } = req.body ?? {};

    if (!MODERATION_ACTIONS.includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    const outcome = await resolveAnonymousReport(req.params.id, action, req.user!.id, notes);

    await logAudit({
      action: REPORT_AUDIT_ACTIONS[action as ModerationAction],
      actorUserId: req.user?.id ?? null,
      targetUserId: outcome.reportedUserId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || undefined,
      metadata: {
        incidentId: outcome.reportId,
        anonymous: true,
        moderationAction: outcome.action,
        contentType: outcome.contentType,
        contentId: outcome.contentId,
        notes: notes ?? null,
      },
    });

    logger.info('Anonymous report actioned', {
      incidentId: outcome.reportId,
      action: outcome.action,
      adminId: req.user?.id,
    });

    res.json(outcome);
  } catch (error) {
    // resolveAnonymousReport throws for a missing row and for one already
    // decided, and a moderator needs to be told which rather than shown a 500.
    const message = error instanceof Error ? error.message : '';
    if (message === 'Report not found') return res.status(404).json({ error: message });
    if (message === 'Report has already been actioned') return res.status(409).json({ error: message });
    next(error);
  }
});

// ============================================================================
// AUDIT LOGS (Compliance)
// ============================================================================

/**
 * GET /admin/audit-logs
 * List compliance audit log entries
 */
router.get('/audit-logs', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '50', action, actorUserId, targetUserId } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (action) where.action = action;
    if (actorUserId) where.actorUserId = actorUserId;
    if (targetUserId) where.targetUserId = targetUserId;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
        include: {
          actorUser: { select: { id: true, email: true, firstName: true, lastName: true } },
          targetUser: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// GDPR / UK COMPLIANCE TOOLING
// ============================================================================

/**
 * GET /admin/gdpr/summary
 * Summary stats for GDPR/UK compliance tracking
 *
 * This counted UK members and EU members and nothing else, on the compliance
 * screen of a Queensland company whose default region is ANZ — the home regime,
 * the Privacy Act 1988 (Cth), had no figure at all. The whole region breakdown
 * is returned now, so no regime can be missing from it again by omission.
 *
 * The consent tiles counted the four legacy boolean columns on User. Those are
 * a best-effort mirror the cookie banner keeps; the Privacy Centre writes only
 * the ConsentRecord ledger, which is also the one hasConsent() reads before the
 * platform acts. Both are reported, side by side and labelled, because a
 * divergence between them is itself something a privacy officer needs to see
 * rather than something to hide behind one number.
 */
router.get('/gdpr/summary', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const days = Math.max(1, Math.min(365, Number(req.query.days || 30)));
    const windowStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      regionRows,
      legacyConsentMarketing,
      legacyConsentDataProcessing,
      legacyConsentCookies,
      legacyConsentDoNotSell,
      consentUpdatesLastWindow,
      dsarExportsLastWindow,
      accountDeletesLastWindow,
      ledgerCounts,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.groupBy({ by: ['region'], _count: { _all: true } }),
      prisma.user.count({ where: { consentMarketing: true } }),
      prisma.user.count({ where: { consentDataProcessing: true } }),
      prisma.user.count({ where: { consentCookies: true } }),
      prisma.user.count({ where: { consentDoNotSell: true } }),
      prisma.user.count({ where: { consentUpdatedAt: { gte: windowStart } } }),
      prisma.auditLog.count({
        where: { action: 'DSAR_EXPORT', createdAt: { gte: windowStart } },
      }),
      prisma.auditLog.count({
        where: { action: 'ACCOUNT_DELETE', createdAt: { gte: windowStart } },
      }),
      consentService.countLiveConsents(),
    ]);

    const byRegion: Record<string, number> = {};
    for (const row of regionRows) {
      byRegion[row.region || 'UNKNOWN'] = row._count._all;
    }
    // ANZ is the default region and AU is what a country-code detection writes,
    // so the home figure is the two together rather than whichever one happens
    // to have been stamped on a given account.
    const auUsers = (byRegion.ANZ || 0) + (byRegion.AU || 0) + (byRegion.NZ || 0);

    res.json({
      totalUsers,
      auUsers,
      ukUsers: byRegion.UK || 0,
      euUsers: byRegion.EU || 0,
      usersByRegion: byRegion,
      dsarExportsLastWindow,
      accountDeletesLastWindow,
      consentUpdatesLastWindow,
      lastWindowDays: days,
      // What the platform actually enforces: the per-type ledger.
      consentLedger: ledgerCounts,
      // The legacy User booleans, kept visible so a drift between the two is
      // readable rather than invisible. They are not what hasConsent() reads.
      legacyConsentCounts: {
        consentMarketing: legacyConsentMarketing,
        consentDataProcessing: legacyConsentDataProcessing,
        consentCookies: legacyConsentCookies,
        consentDoNotSell: legacyConsentDoNotSell,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /admin/gdpr/consents
 * List user consents for auditing
 */
router.get('/gdpr/consents', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '25', region } = req.query;
    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (region) where.region = region;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          region: true,
          preferredLocale: true,
          preferredCurrency: true,
          consentMarketing: true,
          consentDataProcessing: true,
          consentCookies: true,
          consentDoNotSell: true,
          consentUpdatedAt: true,
        },
        orderBy: { consentUpdatedAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      users,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// JOB MANAGEMENT
// ============================================================================

/**
 * GET /admin/jobs
 * List all jobs for admin review
 */
router.get('/jobs', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      page = '1',
      limit = '20',
      status,
      search = '',
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { title: { contains: search as string, mode: 'insensitive' } },
        { organization: { name: { contains: search as string, mode: 'insensitive' } } },
      ];
    }

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        select: {
          id: true,
          title: true,
          organization: { select: { name: true } },
          city: true,
          state: true,
          type: true,
          status: true,
          viewCount: true,
          applicationCount: true,
          createdAt: true,
          postedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.job.count({ where }),
    ]);

    res.json({
      jobs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /admin/jobs/:id
 * Update job status (approve, reject, feature)
 */
router.patch('/jobs/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status, isSponsored, isFeatured } = parseOr400(adminJobPatchSchema, req.body);

    const updateData: any = {};

    if (status !== undefined) {
      updateData.status = status;
    }

    if (isSponsored !== undefined) {
      updateData.isSponsored = isSponsored;
    }

    if (isFeatured !== undefined) {
      updateData.isFeatured = isFeatured;
    }

    const job = await prisma.job.update({
      where: { id },
      data: updateData,
    });

    await logAudit({
      action: 'ADMIN_JOB_UPDATE',
      actorUserId: req.user?.id ?? null,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || undefined,
      metadata: { jobId: id, updatedFields: Object.keys(updateData) },
    });

    res.json(job);
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// SUBSCRIPTION MANAGEMENT
// ============================================================================

/**
 * GET /admin/subscriptions
 * List all subscriptions
 */
router.get('/subscriptions', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      page = '1',
      limit = '20',
      tier,
      status,
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (tier) {
      where.tier = tier;
    }

    if (status) {
      where.status = status;
    }

    const [subscriptions, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.subscription.count({ where }),
    ]);

    res.json({
      subscriptions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /admin/subscriptions/:id
 * Update subscription (grant premium, extend, cancel)
 */
router.patch('/subscriptions/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { tier, status, periodEnd } = parseOr400(adminSubscriptionPatchSchema, req.body);

    const updateData: any = {};

    if (tier !== undefined) {
      updateData.tier = tier;
    }

    if (status !== undefined) {
      updateData.status = status;
    }

    if (periodEnd !== undefined) {
      // The column is currentPeriodEnd; writing periodEnd made Prisma refuse
      // the whole update, so extending a subscription here always failed.
      updateData.currentPeriodEnd = periodEnd;
    }

    const subscription = await prisma.subscription.update({
      where: { id },
      data: updateData,
    });

    await logAudit({
      action: 'ADMIN_SUBSCRIPTION_UPDATE',
      actorUserId: req.user?.id ?? null,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || undefined,
      metadata: { subscriptionId: id, updatedFields: Object.keys(updateData) },
    });

    res.json(subscription);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /admin/subscriptions/grant
 * Grant a subscription to a user
 */
router.post('/subscriptions/grant', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { userId, tier, durationDays = 30 } = req.body;

    if (!userId || !tier) {
      return res.status(400).json({ error: 'userId and tier are required' });
    }

    const periodEnd = new Date();
    periodEnd.setDate(periodEnd.getDate() + durationDays);

    const subscription = await prisma.subscription.upsert({
      where: { userId },
      update: {
        tier,
        status: 'ACTIVE',
        currentPeriodEnd: periodEnd,
      },
      create: {
        userId,
        tier,
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: periodEnd,
      },
    });

    await logAudit({
      action: 'ADMIN_SUBSCRIPTION_GRANT',
      actorUserId: req.user?.id ?? null,
      targetUserId: userId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || undefined,
      metadata: { tier, durationDays },
    });

    res.json(subscription);
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// WOMEN-ONLY GATE MANAGEMENT
// ============================================================================

/**
 * GET /admin/invite-codes
 * List invite codes
 */
router.get('/invite-codes', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      page = '1',
      limit = '20',
      active,
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (active === 'true') where.isActive = true;
    if (active === 'false') where.isActive = false;

    const [inviteCodes, total] = await Promise.all([
      prisma.inviteCode.findMany({
        where,
        include: {
          createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.inviteCode.count({ where }),
    ]);

    res.json({
      inviteCodes,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /admin/invite-codes
 * Create invite codes
 */
router.post('/invite-codes', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { count, maxUses, expiresAt, prefix } = parseOr400(inviteCodeCreateSchema, req.body);

    const codes = Array.from({ length: count }).map(() => ({
      code: generateInviteCode(prefix),
      maxUses: maxUses ?? null,
      expiresAt: expiresAt ?? null,
      createdById: req.user?.id ?? null,
    }));

    const created = await prisma.inviteCode.createMany({ data: codes, skipDuplicates: true });
    const createdRecords = await prisma.inviteCode.findMany({
      where: { code: { in: codes.map((c) => c.code) } },
      orderBy: { createdAt: 'desc' },
    });

    await logAudit({
      action: 'ADMIN_USER_UPDATE',
      actorUserId: req.user?.id ?? null,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || undefined,
      metadata: { createdInviteCodes: created.count },
    });

    res.json({ created: created.count, inviteCodes: createdRecords });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /admin/invite-codes/:id
 * Update invite code (activate/deactivate)
 */
router.patch('/invite-codes/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'isActive must be boolean' });
    }

    const inviteCode = await prisma.inviteCode.update({
      where: { id },
      data: { isActive },
    });

    await logAudit({
      action: 'ADMIN_USER_UPDATE',
      actorUserId: req.user?.id ?? null,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || undefined,
      metadata: { inviteCodeId: id, isActive },
    });

    res.json(inviteCode);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /admin/woman-verifications
 * List women verification requests
 */
router.get('/woman-verifications', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status = 'PENDING', page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {
      womanVerificationStatus: status,
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          womanSelfAttested: true,
          womanVerificationStatus: true,
          womanVerifiedAt: true,
          createdAt: true,
          subscription: { select: { tier: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      users,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /admin/woman-verifications/:userId
 * Approve or reject women verification
 */
router.patch('/woman-verifications/:userId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;

    if (!['VERIFIED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ error: 'status must be VERIFIED or REJECTED' });
    }

    const updateData: any = {
      womanVerificationStatus: status,
      womanVerifiedAt: status === 'VERIFIED' ? new Date() : null,
    };

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        womanVerificationStatus: true,
        womanVerifiedAt: true,
      },
    });

    await logAudit({
      action: status === 'VERIFIED' ? 'ADMIN_VERIFICATION_APPROVE' : 'ADMIN_VERIFICATION_REJECT',
      actorUserId: req.user?.id ?? null,
      targetUserId: userId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || undefined,
      metadata: { verificationType: 'WOMAN_ONLY', status },
    });

    res.json(user);
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// ANALYTICS
// ============================================================================

/**
 * GET /admin/analytics/engagement
 * Get engagement metrics
 */
router.get('/analytics/engagement', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const daysParam = Number.parseInt(String(req.query?.days ?? '30'), 10);
    const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(daysParam, 365) : 30;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const endDate = new Date();

    const [
      newPosts,
      newComments,
      newLikes,
      newApplications,
      activeUsers,
    ] = await Promise.all([
      prisma.post.count({
        where: { createdAt: { gte: startDate } },
      }),
      prisma.comment.count({
        where: { createdAt: { gte: startDate } },
      }),
      prisma.like.count({
        where: { createdAt: { gte: startDate } },
      }),
      prisma.jobApplication.count({
        where: { appliedAt: { gte: startDate } },
      }),
      prisma.user.count({
        where: { lastLoginAt: { gte: startDate } },
      }),
    ]);

    res.json({
      period: {
        label: `${days} days`,
        days,
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      metrics: {
        newPosts,
        newComments,
        newLikes,
        newApplications,
        activeUsers,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /admin/analytics/revenue
 * Get revenue metrics (based on subscriptions)
 */
router.get('/analytics/revenue', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Count active subscriptions by tier
    const subscriptionsByTier = await prisma.subscription.groupBy({
      by: ['tier'],
      where: { status: 'ACTIVE' },
      _count: true,
    });

    // Pricing (you'd want this in a config)
    const pricing: Record<string, number> = {
      FREE: 0,
      PRO: 29,
      BUSINESS: 99,
    };

    // Calculate MRR
    let mrr = 0;
    const breakdown: Record<string, { count: number; revenue: number }> = {};

    for (const sub of subscriptionsByTier) {
      const price = pricing[sub.tier] || 0;
      const revenue = sub._count * price;
      mrr += revenue;
      breakdown[sub.tier] = {
        count: sub._count,
        revenue,
      };
    }

    res.json({
      mrr,
      arr: mrr * 12,
      breakdown,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// GROUPS & EVENTS (ADMIN CRUD / MODERATION)
// ============================================================================

function normalizeGroupPrivacy(input: any): 'PUBLIC' | 'PRIVATE' | null {
  const v = String(input ?? '').toLowerCase();
  if (v === 'private') return 'PRIVATE';
  if (v === 'public') return 'PUBLIC';
  if (v === 'PRIVATE') return 'PRIVATE';
  if (v === 'PUBLIC') return 'PUBLIC';
  return null;
}

function normalizeGroupRole(input: any): 'ADMIN' | 'MODERATOR' | 'MEMBER' | null {
  const v = String(input ?? '').toLowerCase();
  if (v === 'admin') return 'ADMIN';
  if (v === 'moderator') return 'MODERATOR';
  if (v === 'member') return 'MEMBER';
  if (v === 'ADMIN') return 'ADMIN';
  if (v === 'MODERATOR') return 'MODERATOR';
  if (v === 'MEMBER') return 'MEMBER';
  return null;
}

// Returns the Prisma enum rather than a bare string, which is what lets
// prisma.event.create and .update type-check against the schema instead of
// going through an `as any` client. The uppercase switch arms that used to sit
// at the bottom of this function were unreachable — the value is lowercased on
// the line above, so 'WEBINAR' already arrives at the 'webinar' arm.
function normalizeEventType(input: any): EventType | null {
  const v = String(input ?? '').toLowerCase();
  switch (v) {
    case 'webinar':
      return 'WEBINAR';
    case 'workshop':
      return 'WORKSHOP';
    case 'networking':
      return 'NETWORKING';
    case 'conference':
      return 'CONFERENCE';
    case 'meetup':
      return 'MEETUP';
    default:
      return null;
  }
}

function normalizeEventFormat(input: any): EventFormat | null {
  const v = String(input ?? '').toLowerCase();
  if (v === 'virtual' || v === 'VIRTUAL') return 'VIRTUAL';
  if (v === 'in-person' || v === 'in_person' || v === 'IN_PERSON') return 'IN_PERSON';
  if (v === 'hybrid' || v === 'HYBRID') return 'HYBRID';
  return null;
}

/**
 * GET /admin/groups
 */
router.get('/groups', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      page = '1',
      limit = '20',
      search = '',
      privacy,
      featured,
      pinned,
      hidden,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const dbPrivacy = privacy ? normalizeGroupPrivacy(privacy) : null;
    if (privacy && !dbPrivacy) return res.status(400).json({ error: 'Invalid privacy filter' });
    if (dbPrivacy) where.privacy = dbPrivacy;

    if (featured !== undefined) where.isFeatured = String(featured) === 'true';
    if (pinned !== undefined) where.isPinned = String(pinned) === 'true';
    if (hidden !== undefined) where.isHidden = String(hidden) === 'true';

    const [groups, total] = await Promise.all([
      prisma.group.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { [sortBy as string]: sortOrder },
        select: {
          id: true,
          name: true,
          description: true,
          privacy: true,
          isFeatured: true,
          isPinned: true,
          isHidden: true,
          createdById: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { members: true, posts: true } },
        },
      }),
      prisma.group.count({ where }),
    ]);

    res.json({
      groups,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /admin/groups
 */
router.post('/groups', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
    const privacy = normalizeGroupPrivacy(req.body?.privacy ?? 'public') ?? 'PUBLIC';
    const createdById = typeof req.body?.createdById === 'string' ? req.body.createdById : req.user!.id;

    if (!name || name.length < 3) return res.status(400).json({ error: 'Group name is required' });
    if (!description) return res.status(400).json({ error: 'Group description is required' });

    const { group } = await prisma.$transaction(async (tx) => {
      const group = await tx.group.create({
        data: {
          name,
          description,
          privacy,
          createdBy: { connect: { id: createdById } },
          isFeatured: !!req.body?.isFeatured,
          isPinned: !!req.body?.isPinned,
          isHidden: !!req.body?.isHidden,
        },
      });

      await tx.groupMember.upsert({
        where: { groupId_userId: { groupId: group.id, userId: createdById } },
        update: { role: 'ADMIN' },
        create: { groupId: group.id, userId: createdById, role: 'ADMIN' },
      });

      return { group };
    });

    await logAudit({
      action: 'ADMIN_GROUP_CREATE',
      actorUserId: req.user?.id ?? null,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || undefined,
      metadata: {
        groupId: group.id,
        createdById,
        privacy,
        isFeatured: !!req.body?.isFeatured,
        isPinned: !!req.body?.isPinned,
        isHidden: !!req.body?.isHidden,
      },
    });

    res.status(201).json(group);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /admin/groups/:id
 */
router.patch('/groups/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const existing = await prisma.group.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return res.status(404).json({ error: 'Group not found' });

    const data: any = {};
    if (typeof req.body?.name === 'string') data.name = req.body.name.trim();
    if (typeof req.body?.description === 'string') data.description = req.body.description.trim();
    if (req.body?.privacy !== undefined) {
      const p = normalizeGroupPrivacy(req.body.privacy);
      if (!p) return res.status(400).json({ error: 'Invalid privacy' });
      data.privacy = p;
    }
    if (req.body?.isFeatured !== undefined) data.isFeatured = !!req.body.isFeatured;
    if (req.body?.isPinned !== undefined) data.isPinned = !!req.body.isPinned;
    if (req.body?.isHidden !== undefined) data.isHidden = !!req.body.isHidden;

    const group = await prisma.group.update({ where: { id }, data });

    await logAudit({
      action: 'ADMIN_GROUP_UPDATE',
      actorUserId: req.user?.id ?? null,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || undefined,
      metadata: { groupId: id, updatedFields: Object.keys(data) },
    });

    res.json(group);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /admin/groups/:id
 */
router.delete('/groups/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await prisma.group.delete({ where: { id } });

    await logAudit({
      action: 'ADMIN_GROUP_DELETE',
      actorUserId: req.user?.id ?? null,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || undefined,
      metadata: { groupId: id },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /admin/groups/:id/members/:userId
 * Set member role (admin/moderator/member)
 */
router.patch('/groups/:id/members/:userId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id: groupId, userId } = req.params;
    const role = normalizeGroupRole(req.body?.role);
    if (!role) return res.status(400).json({ error: 'Invalid role' });

    const existing = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
      select: { role: true },
    });

    if (existing?.role === 'ADMIN' && role !== 'ADMIN') {
      const adminCount = await prisma.groupMember.count({ where: { groupId, role: 'ADMIN' } });
      if (adminCount <= 1) return res.status(400).json({ error: 'Group must have at least one admin' });
    }

    const member = await prisma.groupMember.upsert({
      where: { groupId_userId: { groupId, userId } },
      update: { role },
      create: { groupId, userId, role },
    });

    await logAudit({
      action: 'ADMIN_GROUP_MEMBER_ROLE_UPDATE',
      actorUserId: req.user?.id ?? null,
      targetUserId: userId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || undefined,
      metadata: { groupId, role },
    });

    res.json(member);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /admin/groups/:id/posts/:postId
 */
router.delete('/groups/:id/posts/:postId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id: groupId, postId } = req.params;
    const post = await prisma.groupPost.findUnique({ where: { id: postId }, select: { id: true, groupId: true } });
    if (!post || post.groupId !== groupId) return res.status(404).json({ error: 'Post not found' });
    await prisma.groupPost.delete({ where: { id: postId } });

    await logAudit({
      action: 'ADMIN_GROUP_POST_DELETE',
      actorUserId: req.user?.id ?? null,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || undefined,
      metadata: { groupId, postId },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /admin/events
 */
router.get('/events', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      page = '1',
      limit = '20',
      search = '',
      type,
      format,
      featured,
      pinned,
      hidden,
      sortBy = 'date',
      sortOrder = 'asc',
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (search) {
      where.OR = [
        { title: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    if (type !== undefined) {
      const t = normalizeEventType(type);
      if (!t) return res.status(400).json({ error: 'Invalid type filter' });
      where.type = t;
    }

    if (format !== undefined) {
      const f = normalizeEventFormat(format);
      if (!f) return res.status(400).json({ error: 'Invalid format filter' });
      where.format = f;
    }

    if (featured !== undefined) where.isFeatured = String(featured) === 'true';
    if (pinned !== undefined) where.isPinned = String(pinned) === 'true';
    if (hidden !== undefined) where.isHidden = String(hidden) === 'true';

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { [sortBy as string]: sortOrder },
      }),
      prisma.event.count({ where }),
    ]);

    res.json({
      events,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /admin/events
 */
router.post('/events', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
    const type = normalizeEventType(req.body?.type);
    const format = normalizeEventFormat(req.body?.format);
    const dateValue = req.body?.date;
    const date = new Date(dateValue);
    const startTime = typeof req.body?.startTime === 'string' ? req.body.startTime.trim() : '';
    const endTime = typeof req.body?.endTime === 'string' ? req.body.endTime.trim() : '';
    const image = typeof req.body?.image === 'string' ? req.body.image.trim() : '';

    const hostName = typeof req.body?.hostName === 'string' ? req.body.hostName.trim() : req.body?.host?.name;
    const hostTitle = typeof req.body?.hostTitle === 'string' ? req.body.hostTitle.trim() : req.body?.host?.title;
    const hostAvatar = typeof req.body?.hostAvatar === 'string' ? req.body.hostAvatar.trim() : req.body?.host?.avatar;

    if (!title) return res.status(400).json({ error: 'Title is required' });
    if (!description) return res.status(400).json({ error: 'Description is required' });
    if (!type) return res.status(400).json({ error: 'Invalid type' });
    if (!format) return res.status(400).json({ error: 'Invalid format' });
    if (Number.isNaN(date.getTime())) return res.status(400).json({ error: 'Invalid date' });
    if (!startTime || !endTime) return res.status(400).json({ error: 'Start/end time is required' });
    if (!image) return res.status(400).json({ error: 'Image is required' });
    if (!hostName || !hostTitle || !hostAvatar) return res.status(400).json({ error: 'Host is required' });

    const tags = Array.isArray(req.body?.tags) ? req.body.tags.filter((t: any) => typeof t === 'string') : [];

    const event = await prisma.event.create({
      data: {
        title,
        description,
        type,
        format,
        isFeatured: !!req.body?.isFeatured,
        isPinned: !!req.body?.isPinned,
        isHidden: !!req.body?.isHidden,
        date,
        startTime,
        endTime,
        location: typeof req.body?.location === 'string' ? req.body.location.trim() : null,
        link: typeof req.body?.link === 'string' ? req.body.link.trim() : null,
        image,
        hostName,
        hostTitle,
        hostAvatar,
        baseAttendees: typeof req.body?.baseAttendees === 'number' ? req.body.baseAttendees : 0,
        maxAttendees: typeof req.body?.maxAttendees === 'number' ? req.body.maxAttendees : null,
        price: typeof req.body?.price === 'number' ? req.body.price : 0,
        tags,
      },
    });

    await logAudit({
      action: 'ADMIN_EVENT_CREATE',
      actorUserId: req.user?.id ?? null,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || undefined,
      metadata: {
        eventId: event.id,
        type,
        format,
        isFeatured: !!req.body?.isFeatured,
        isPinned: !!req.body?.isPinned,
        isHidden: !!req.body?.isHidden,
      },
    });

    res.status(201).json(event);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /admin/events/:id
 */
router.patch('/events/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const existing = await prisma.event.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return res.status(404).json({ error: 'Event not found' });

    const data: any = {};
    if (typeof req.body?.title === 'string') data.title = req.body.title.trim();
    if (typeof req.body?.description === 'string') data.description = req.body.description.trim();
    if (req.body?.type !== undefined) {
      const t = normalizeEventType(req.body.type);
      if (!t) return res.status(400).json({ error: 'Invalid type' });
      data.type = t;
    }
    if (req.body?.format !== undefined) {
      const f = normalizeEventFormat(req.body.format);
      if (!f) return res.status(400).json({ error: 'Invalid format' });
      data.format = f;
    }
    if (req.body?.date !== undefined) {
      const d = new Date(req.body.date);
      if (Number.isNaN(d.getTime())) return res.status(400).json({ error: 'Invalid date' });
      data.date = d;
    }
    if (typeof req.body?.startTime === 'string') data.startTime = req.body.startTime.trim();
    if (typeof req.body?.endTime === 'string') data.endTime = req.body.endTime.trim();
    if (req.body?.location !== undefined) data.location = typeof req.body.location === 'string' ? req.body.location.trim() : null;
    if (req.body?.link !== undefined) data.link = typeof req.body.link === 'string' ? req.body.link.trim() : null;
    if (typeof req.body?.image === 'string') data.image = req.body.image.trim();

    if (req.body?.host !== undefined || req.body?.hostName !== undefined) {
      const hostName = typeof req.body?.hostName === 'string' ? req.body.hostName.trim() : req.body?.host?.name;
      const hostTitle = typeof req.body?.hostTitle === 'string' ? req.body.hostTitle.trim() : req.body?.host?.title;
      const hostAvatar = typeof req.body?.hostAvatar === 'string' ? req.body.hostAvatar.trim() : req.body?.host?.avatar;
      if (hostName !== undefined) data.hostName = hostName;
      if (hostTitle !== undefined) data.hostTitle = hostTitle;
      if (hostAvatar !== undefined) data.hostAvatar = hostAvatar;
    }

    if (req.body?.baseAttendees !== undefined) data.baseAttendees = req.body.baseAttendees;
    if (req.body?.maxAttendees !== undefined) data.maxAttendees = req.body.maxAttendees;
    if (req.body?.price !== undefined) data.price = req.body.price;
    if (req.body?.tags !== undefined) {
      data.tags = Array.isArray(req.body.tags) ? req.body.tags.filter((t: any) => typeof t === 'string') : [];
    }
    if (req.body?.isFeatured !== undefined) data.isFeatured = !!req.body.isFeatured;
    if (req.body?.isPinned !== undefined) data.isPinned = !!req.body.isPinned;
    if (req.body?.isHidden !== undefined) data.isHidden = !!req.body.isHidden;

    const event = await prisma.event.update({ where: { id }, data });

    await logAudit({
      action: 'ADMIN_EVENT_UPDATE',
      actorUserId: req.user?.id ?? null,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || undefined,
      metadata: { eventId: id, updatedFields: Object.keys(data) },
    });

    res.json(event);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /admin/events/:id
 */
router.delete('/events/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await prisma.event.delete({ where: { id } });

    await logAudit({
      action: 'ADMIN_EVENT_DELETE',
      actorUserId: req.user?.id ?? null,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || undefined,
      metadata: { eventId: id },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// GRANT AND INSURANCE APPLICATIONS
// ===========================================
// Grants and insurers are outside organisations; their decision reaches the
// platform through whoever handles partnerships, who records it here. The
// applicant is told in the app and by email the moment it is recorded.

const GRANT_DECISIONS = ['UNDER_REVIEW', 'SHORTLISTED', 'AWARDED', 'REJECTED'];
const INSURANCE_DECISIONS = ['UNDER_REVIEW', 'APPROVED', 'DECLINED', 'ACTIVE', 'LAPSED'];

const aud = (n: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(n);

async function tellApplicant(userId: string, subject: string, line: string, link: string) {
  await prisma.notification.create({ data: { userId, type: 'SYSTEM', title: subject, message: line, link } });
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, firstName: true } });
  if (!user?.email) return;
  const base = (process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
  const greeting = user.firstName ? `Hi ${user.firstName},` : 'Hi,';
  await sendEmail({
    to: user.email,
    subject,
    text: `${greeting}\n\n${line}\n\nSee the details: ${base}${link}\n\nATHENA`,
    html: `<p>${greeting}</p><p>${line}</p><p><a href="${base}${link}">See the details</a></p><p>ATHENA</p>`,
  });
}

router.get('/grants/applications', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const grantId = typeof req.query.grantId === 'string' ? req.query.grantId : undefined;
    const applications = await prisma.grantApplication.findMany({
      // Drafts are the applicant's business until they submit.
      where: { ...(status ? { status: status as any } : { status: { not: 'DRAFT' } }), ...(grantId ? { grantId } : {}) },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        grant: { select: { id: true, name: true, provider: true, providerType: true, maxFunding: true, deadline: true } },
      },
      orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    });
    res.json({ success: true, data: applications });
  } catch (error) {
    next(error);
  }
});

router.patch('/grants/applications/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status, amountAwarded, notes } = req.body as { status?: string; amountAwarded?: number | string; notes?: string };
    if (!status || !GRANT_DECISIONS.includes(status)) {
      throw new ApiError(400, 'Unknown decision');
    }
    const application = await prisma.grantApplication.findUnique({
      where: { id: req.params.id },
      include: { grant: { select: { name: true } } },
    });
    if (!application) {
      throw new ApiError(404, 'Application not found');
    }
    if (application.status === 'DRAFT') {
      throw new ApiError(400, 'This application has not been submitted');
    }

    const amount = status === 'AWARDED' && amountAwarded !== undefined && amountAwarded !== '' ? Number(amountAwarded) : undefined;
    const updated = await prisma.grantApplication.update({
      where: { id: application.id },
      data: {
        status: status as any,
        ...(notes !== undefined ? { notes: String(notes).slice(0, 2000) } : {}),
        ...(amount !== undefined && Number.isFinite(amount) ? { amountAwarded: amount } : {}),
        ...(status === 'AWARDED' || status === 'REJECTED' ? { resultAt: new Date() } : {}),
      },
    });

    const name = application.grant.name;
    const line: Record<string, string> = {
      UNDER_REVIEW: `Your application for ${name} is under review.`,
      SHORTLISTED: `Your application for ${name} has been shortlisted.`,
      AWARDED: `Your application for ${name} was successful${amount !== undefined && Number.isFinite(amount) ? `: ${aud(amount)}` : ''}.`,
      REJECTED: `Your application for ${name} was not successful this time.`,
    };
    await tellApplicant(application.userId, 'Update on your grant application', `${line[status]}${notes ? ` ${String(notes).trim()}` : ''}`, '/dashboard/grants');

    logger.info('Grant application decided', { applicationId: application.id, status, by: req.user!.id });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

router.get('/insurance/applications', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const applications = await prisma.insuranceApplication.findMany({
      where: status ? { status: status as any } : { status: { not: 'DRAFT' } },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        product: { select: { id: true, name: true, provider: true, type: true, premiumMonthly: true, coverageAmount: true } },
      },
      orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    });
    res.json({ success: true, data: applications });
  } catch (error) {
    next(error);
  }
});

router.patch('/insurance/applications/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status, premiumQuoted, coverageAmount, policyNumber, startDate, endDate, note } = req.body as Record<string, unknown>;
    if (typeof status !== 'string' || !INSURANCE_DECISIONS.includes(status)) {
      throw new ApiError(400, 'Unknown decision');
    }
    const application = await prisma.insuranceApplication.findUnique({
      where: { id: req.params.id },
      include: { product: { select: { name: true, provider: true } } },
    });
    if (!application) {
      throw new ApiError(404, 'Application not found');
    }
    if (application.status === 'DRAFT') {
      throw new ApiError(400, 'This application has not been submitted');
    }

    const num = (v: unknown) => (v === undefined || v === null || v === '' ? undefined : Number(v));
    const updated = await prisma.insuranceApplication.update({
      where: { id: application.id },
      data: {
        status: status as any,
        ...(num(premiumQuoted) !== undefined ? { premiumQuoted: num(premiumQuoted) } : {}),
        ...(num(coverageAmount) !== undefined ? { coverageAmount: num(coverageAmount) } : {}),
        ...(typeof policyNumber === 'string' && policyNumber.trim() ? { policyNumber: policyNumber.trim() } : {}),
        ...(typeof startDate === 'string' && startDate ? { startDate: new Date(startDate) } : {}),
        ...(typeof endDate === 'string' && endDate ? { endDate: new Date(endDate) } : {}),
        ...(status === 'APPROVED' ? { approvedAt: new Date() } : {}),
      },
    });

    const name = `${application.product.name} (${application.product.provider})`;
    const line: Record<string, string> = {
      UNDER_REVIEW: `Your application for ${name} is under review.`,
      APPROVED: `Your application for ${name} was approved${num(premiumQuoted) !== undefined ? ` at ${aud(num(premiumQuoted)!)} a month` : ''}.`,
      DECLINED: `Your application for ${name} was declined.`,
      ACTIVE: `Your ${name} policy is now active${typeof policyNumber === 'string' && policyNumber ? ` (policy ${policyNumber})` : ''}.`,
      LAPSED: `Your ${name} policy has lapsed.`,
    };
    await tellApplicant(application.userId, 'Update on your insurance application', `${line[status]}${typeof note === 'string' && note.trim() ? ` ${note.trim()}` : ''}`, '/dashboard/finance/insurance');

    logger.info('Insurance application decided', { applicationId: application.id, status, by: req.user!.id });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

export default router;
