import { Router, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth';
import {
  AuditAction,
  DSARStatus,
  DSARType,
  Prisma,
  UserRole,
  JobStatus,
  SubscriptionTier,
  SubscriptionStatus,
  EventType,
  EventFormat,
} from '@prisma/client';
import { z } from 'zod';
import { ApiError } from '../middleware/errorHandler';
import {
  DEADLINE_SORT_WINDOW,
  ModerationAction,
  OPEN_REPORT_STATUSES,
  banAccount,
  getAnonymousReport,
  listAnonymousReports,
  namedReportDeadline,
  namedReportPriority,
  processReportById,
  resolveAnonymousReport,
  stampMissingReviewClocks,
} from '../services/content-report.service';
import { gdprService } from '../services/gdpr.service';
import { consentService } from '../services/consent.service';
// Every audit row on this router is written after the change it records has
// committed, so it goes through auditAfterCommit: a failed insert must not turn
// a finished suspension or erasure into a 500. See admin-audit.service.
import {
  LEGACY_ADMIN_AUDIT_ACTION,
  adminVerbsFiledUnder,
  auditAfterCommit,
  recordAdminAction,
} from '../services/admin-audit.service';
import { bestEffort } from '../utils/best-effort';
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

type SortOrder = 'asc' | 'desc';

/**
 * A list's sort column and direction, checked against what that list can sort
 * by.
 *
 * These lists passed ?sortBy and ?sortOrder straight into
 * `orderBy: { [sortBy]: sortOrder }`, so a mistyped column or a direction of
 * "up" came back from Prisma as a 500, and the console reported a broken page
 * for what was a bad link. Each list now names the columns it can be sorted on
 * and anything else is a 400 that says which ones those are.
 */
function parseSort<C extends string>(
  query: Record<string, unknown>,
  columns: readonly C[],
  defaults: { sortBy: C; sortOrder: SortOrder }
): { sortBy: C; sortOrder: SortOrder } {
  const rawBy = query.sortBy;
  const rawOrder = query.sortOrder;

  let sortBy = defaults.sortBy;
  if (rawBy !== undefined) {
    const found = typeof rawBy === 'string' ? columns.find((column) => column === rawBy) : undefined;
    if (!found) {
      throw new ApiError(400, `sortBy must be one of: ${columns.join(', ')}`);
    }
    sortBy = found;
  }

  let sortOrder = defaults.sortOrder;
  if (rawOrder !== undefined) {
    if (rawOrder !== 'asc' && rawOrder !== 'desc') {
      throw new ApiError(400, 'sortOrder must be asc or desc');
    }
    sortOrder = rawOrder;
  }

  return { sortBy, sortOrder };
}

const listPagingSchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * page and limit for the console's lists. A bare parseInt turned ?limit=abc
 * into NaN and ?page=0 into a negative skip, both of which reached Prisma as a
 * 500, and nothing stopped one request asking for every row at once.
 */
function parsePaging(query: Record<string, unknown>): { page: number; limit: number; skip: number } {
  const { page, limit } = parseOr400(listPagingSchema, { page: query.page, limit: query.limit });
  return { page, limit, skip: (page - 1) * limit };
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
const USER_SORT_COLUMNS = ['createdAt', 'lastLoginAt', 'email', 'firstName', 'lastName', 'role', 'persona'] as const;

router.get('/users', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { search = '', role, persona, status } = req.query;
    const { page: pageNum, limit: limitNum, skip } = parsePaging(req.query);
    const { sortBy, sortOrder } = parseSort(req.query, USER_SORT_COLUMNS, { sortBy: 'createdAt', sortOrder: 'desc' });

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
    } else if (status === 'banned') {
      where.bannedAt = { not: null };
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
          ...SUSPENSION_COLUMNS,
          _count: {
            select: {
              posts: true,
              applications: true,
            },
          },
        },
        skip,
        take: limitNum,
        orderBy: { [sortBy]: sortOrder } as Prisma.UserOrderByWithRelationInput,
      }),
      prisma.user.count({ where }),
    ]);

    // Accounts locked before User carried a reason have theirs only in the
    // audit trail, so the trail is read for those and no others.
    const suspensions = await bestEffort(
      'admin users suspension reasons',
      () => latestSuspensions(users.filter((user) => user.isSuspended && !recordedSuspension(user)).map((user) => user.id)),
      null
    );

    res.json({
      users: users.map(({ suspensionReason, suspendedAt, suspendedById, bannedAt, banReason, bannedById, ...user }) => {
        const columns = { suspensionReason, suspendedAt, suspendedById, bannedAt, banReason, bannedById };
        return {
          ...user,
          banned: Boolean(bannedAt),
          // Left undefined when an older reason could not be read, so the screen
          // can say so rather than showing a suspended account as though no
          // reason had ever been given.
          suspension: user.isSuspended
            ? recordedSuspension(columns) ?? (suspensions ? suspensions.get(user.id) ?? null : undefined)
            : null,
        };
      }),
      suspensionReasonsUnavailable: suspensions === null,
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

type SuspensionRecord = {
  reason: string | null;
  /** Where the reason was read from: the account itself, or for older locks the admin or moderation audit row. */
  source: 'account' | 'admin' | 'moderation';
  moderationAction: string | null;
  banned: boolean;
  at: Date;
  byUserId: string | null;
};

/** The suspension and ban columns every admin read of an account includes. */
const SUSPENSION_COLUMNS = {
  suspensionReason: true,
  suspendedAt: true,
  suspendedById: true,
  bannedAt: true,
  banReason: true,
  bannedById: true,
} as const;

type SuspensionColumns = {
  suspensionReason: string | null;
  suspendedAt: Date | null;
  suspendedById: string | null;
  bannedAt: Date | null;
  banReason: string | null;
  bannedById: string | null;
};

/**
 * Why, when and by whom an account was locked, from the account itself.
 *
 * Null for a lock written before User carried these columns; those are read
 * back from the audit trail by latestSuspensions instead.
 */
function recordedSuspension(user: SuspensionColumns): SuspensionRecord | null {
  if (user.bannedAt) {
    return {
      reason: user.banReason ?? user.suspensionReason,
      source: 'account',
      moderationAction: 'ban',
      banned: true,
      at: user.bannedAt,
      byUserId: user.bannedById,
    };
  }
  if (user.suspensionReason && user.suspendedAt) {
    return {
      reason: user.suspensionReason,
      source: 'account',
      moderationAction: null,
      banned: false,
      at: user.suspendedAt,
      byUserId: user.suspendedById,
    };
  }
  return null;
}

// The audit verbs a lock was ever written under: the admin toggle and, before
// moderation decisions had verbs of their own, every report outcome.
const SUSPENSION_AUDIT_ACTIONS: AuditAction[] = [
  AuditAction.ADMIN_USER_UPDATE,
  AuditAction.MODERATION_SUSPEND,
  AuditAction.MODERATION_BAN,
];

/**
 * Why each of these older locks was put on, from the audit trail.
 *
 * Before User had suspensionReason, the reason was written only into the audit
 * row that recorded the suspension — by PATCH /users/:id here, and by the
 * report decision routes as the moderator's notes — so the latest such row for
 * each account is the answer for a lock put on before the columns existed.
 * Every lock since then carries its reason on the account and is answered by
 * recordedSuspension without reading the log at all.
 */
async function latestSuspensions(userIds: string[]): Promise<Map<string, SuspensionRecord>> {
  const found = new Map<string, SuspensionRecord>();
  if (userIds.length === 0) return found;

  const rows = await prisma.auditLog.findMany({
    where: { targetUserId: { in: userIds }, action: { in: SUSPENSION_AUDIT_ACTIONS } },
    orderBy: { createdAt: 'desc' },
    select: { targetUserId: true, actorUserId: true, createdAt: true, metadata: true },
    take: Math.min(userIds.length * 25, 2000),
  });

  const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);

  for (const row of rows) {
    if (!row.targetUserId || found.has(row.targetUserId)) continue;
    const meta = (row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? row.metadata
      : {}) as Record<string, unknown>;
    const moderationAction = text(meta.moderationAction);

    if (meta.isSuspended === true) {
      found.set(row.targetUserId, {
        reason: text(meta.suspensionReason),
        source: 'admin',
        moderationAction: null,
        banned: false,
        at: row.createdAt,
        byUserId: row.actorUserId,
      });
    } else if (moderationAction === 'suspend' || moderationAction === 'ban') {
      found.set(row.targetUserId, {
        reason: text(meta.notes) ?? `Decided on a ${text(meta.contentType)?.toLowerCase() ?? 'content'} report with no notes`,
        source: 'moderation',
        moderationAction,
        banned: moderationAction === 'ban',
        at: row.createdAt,
        byUserId: row.actorUserId,
      });
    }
  }

  return found;
}

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
        ...SUSPENSION_COLUMNS,
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

    const recorded = recordedSuspension(user);
    const suspension = !user.isSuspended
      ? null
      : recorded ??
        (await bestEffort('admin user suspension reason', async () => (await latestSuspensions([user.id])).get(user.id) ?? null, undefined));

    res.json({ ...user, banned: Boolean(user.bannedAt), suspension });
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
    const { role, isSuspended, isBanned, emailVerified, suspensionReason, banReason } = req.body ?? {};

    const existing = await prisma.user.findUnique({
      where: { id },
      select: { id: true, isSuspended: true, bannedAt: true },
    });
    if (!existing) {
      throw new ApiError(404, 'User not found');
    }

    const updateData: Prisma.UserUpdateInput = {};

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

    if (isBanned !== undefined && isBanned !== true) {
      // A ban is lifted by upholding the member's appeal against it, where the
      // decision is written down and she is told. A toggle here would lift it
      // with neither, and would leave her address barred from registering.
      throw new ApiError(400, 'A ban is lifted by upholding the appeal against it, in the appeals queue.');
    }
    const banning = isBanned === true;
    if (banning && isSuspended === false) {
      throw new ApiError(400, 'An account cannot be banned and unsuspended at once');
    }

    let reason: string | undefined;
    if (banning) {
      // A ban is the one decision here that also reaches past the account, so
      // it is never made without a reason an appeal can be read against.
      reason = typeof banReason === 'string' ? banReason.trim().slice(0, 1000) : '';
      if (!reason) {
        throw new ApiError(400, 'Say why the account is being banned');
      }
      if (req.params.id === req.user!.id) {
        throw new ApiError(400, 'You cannot ban your own account');
      }
      if (existing.bannedAt) {
        throw new ApiError(409, 'This account is already banned');
      }
    } else if (isSuspended !== undefined) {
      if (typeof isSuspended !== 'boolean') {
        throw new ApiError(400, 'isSuspended must be true or false');
      }
      // A suspension nobody can explain afterwards cannot be reviewed on appeal
      // or answered for, so locking an account requires saying why. The reason
      // is kept on the account, and on the audit row below.
      if (isSuspended) {
        reason = typeof suspensionReason === 'string' ? suspensionReason.trim().slice(0, 1000) : '';
        if (!reason) {
          throw new ApiError(400, 'Say why the account is being suspended');
        }
        if (req.params.id === req.user!.id) {
          throw new ApiError(400, 'You cannot suspend your own account');
        }
        updateData.isSuspended = true;
        updateData.suspensionReason = reason;
        updateData.suspendedAt = new Date();
        updateData.suspendedById = req.user!.id;
      } else {
        // The ordinary unsuspend does not lift a ban. It used to, because a ban
        // was only ever the same flag, so one click in the member list undid a
        // decision made on a report about someone threatening a member.
        if (existing.bannedAt) {
          throw new ApiError(
            409,
            'This account is banned, not only suspended. A ban is lifted by upholding the appeal against it, in the appeals queue.'
          );
        }
        updateData.isSuspended = false;
        updateData.suspensionReason = null;
        updateData.suspendedAt = null;
        updateData.suspendedById = null;
      }
    }

    if (emailVerified !== undefined) {
      if (typeof emailVerified !== 'boolean') {
        throw new ApiError(400, 'emailVerified must be true or false');
      }
      updateData.emailVerified = emailVerified;
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.user.update({ where: { id }, data: updateData, select: { id: true } });
    }

    // Banning goes through the same path a report decision does, so the account
    // is marked banned and the address is barred from registering again.
    let banIdentityRecorded: boolean | undefined;
    if (banning && reason) {
      banIdentityRecorded = await banAccount(id, { moderatorId: req.user!.id, reason, reportId: null });
    }

    const user = await prisma.user.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        emailVerified: true,
        isSuspended: true,
        ...SUSPENSION_COLUMNS,
      },
    });

    const updatedFields = [...Object.keys(updateData), ...(banning ? ['bannedAt', 'banReason', 'bannedById'] : [])];
    await auditAfterCommit({
      action: banning ? AuditAction.MODERATION_BAN : isSuspended === true ? AuditAction.MODERATION_SUSPEND : AuditAction.ADMIN_USER_UPDATE,
      actorUserId: req.user?.id ?? null,
      targetUserId: id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || undefined,
      metadata: {
        updatedFields,
        role,
        isSuspended: banning ? true : isSuspended,
        ...(banning ? { isBanned: true, banReason: reason, banIdentityRecorded } : {}),
        emailVerified,
        suspensionReason: banning ? undefined : reason,
        source: 'admin',
      },
    });

    res.json({
      ...user,
      banned: Boolean(user.bannedAt),
      ...(banIdentityRecorded === undefined ? {} : { banIdentityRecorded }),
    });
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
      let outcome: Awaited<ReturnType<typeof gdprService.eraseAccountByAdmin>>;
      try {
        outcome = await gdprService.eraseAccountByAdmin(id, {
          adminId: req.user?.id ?? null,
          ipAddress: req.ip,
          userAgent: req.get('user-agent') || undefined,
        });
      } catch (error) {
        // The retry after an erasure that did finish lands here, and so does a
        // mistyped id. Either way there is no account to erase, which is a 404
        // an administrator can read, not a 500 that sends her looking for a bug.
        if (error instanceof Error && error.message === 'User not found') {
          throw new ApiError(404, 'There is no account with that id. If you have just erased it, the erasure finished.');
        }
        throw error;
      }

      if (outcome.status === 'REJECTED') {
        // A hold is a court's claim on this data, not a preference, so the
        // refusal is the answer rather than something to log and work around.
        throw new ApiError(409, outcome.reason || 'This account is under a legal hold and cannot be deleted.');
      }

      await auditAfterCommit({
        action: 'ADMIN_USER_DELETE',
        actorUserId: req.user?.id ?? null,
        // A removed account cannot be a foreign key any more; the erasure's own
        // privacy-log entry already carries the reference, so this row points at
        // the account only while the account still exists.
        targetUserId: outcome.accountRemoved ? null : id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || undefined,
        metadata: {
          erasureReference: outcome.requestId,
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

    // Soft delete - suspend and anonymize. The lock says why, like every other
    // lock, so the member list does not show a suspended shell with no reason.
    await prisma.user.update({
      where: { id },
      data: {
        isSuspended: true,
        suspensionReason: 'Account deleted by an administrator',
        suspendedAt: new Date(),
        suspendedById: req.user?.id ?? null,
        email: gdprService.suspensionTombstoneEmail(id),
        firstName: 'Deleted',
        lastName: 'User',
      },
    });

    await auditAfterCommit({
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

const POST_SORT_COLUMNS = ['createdAt', 'reportCount', 'likeCount', 'commentCount'] as const;

/**
 * GET /admin/content/posts
 * List posts with moderation info
 */
router.get('/content/posts', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { reported = 'false' } = req.query;

    const { page: pageNum, limit: limitNum, skip } = parsePaging(req.query);
    const { sortBy, sortOrder } = parseSort(req.query, POST_SORT_COLUMNS, { sortBy: 'createdAt', sortOrder: 'desc' });

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
        orderBy: { [sortBy]: sortOrder } as Prisma.PostOrderByWithRelationInput,
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
      await auditAfterCommit({
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
    const { reported = 'false' } = req.query;

    const { page: pageNum, limit: limitNum, skip } = parsePaging(req.query);

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

    await auditAfterCommit({
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

/**
 * The audit verb each report outcome is filed under.
 *
 * AuditAction had no moderation verbs of its own, so a moderator's decision was
 * filed under the nearest admin value — a ban as ADMIN_USER_UPDATE, a dismissal
 * as ADMIN_POST_CLEAR_REPORTS — with the real outcome in metadata, and "who
 * banned this account" could only be answered by reading every row's JSON.
 * Each outcome now has its own verb. LEGACY_REPORT_AUDIT_ACTIONS is what the
 * same outcome was filed under before, so the audit-log viewer still finds
 * those rows when it is asked for the new verb.
 */
const REPORT_AUDIT_ACTIONS: Record<ModerationAction, AuditAction> = {
  dismiss: AuditAction.MODERATION_DISMISS,
  warn: AuditAction.MODERATION_WARN,
  remove: AuditAction.MODERATION_REMOVE,
  suspend: AuditAction.MODERATION_SUSPEND,
  ban: AuditAction.MODERATION_BAN,
  escalate: AuditAction.MODERATION_ESCALATE,
};

const LEGACY_REPORT_AUDIT_ACTIONS: Record<ModerationAction, AuditAction> = {
  dismiss: AuditAction.ADMIN_POST_CLEAR_REPORTS,
  warn: AuditAction.ADMIN_USER_UPDATE,
  remove: AuditAction.ADMIN_POST_HIDE,
  suspend: AuditAction.ADMIN_USER_UPDATE,
  ban: AuditAction.ADMIN_USER_UPDATE,
  escalate: AuditAction.ADMIN_USER_UPDATE,
};

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
  reviewDeadline: true,
  priority: true,
  createdAt: true,
  updatedAt: true,
  reporter: {
    select: { id: true, firstName: true, lastName: true, displayName: true, email: true },
  },
  reportedUser: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      displayName: true,
      email: true,
      isSuspended: true,
      bannedAt: true,
    },
  },
} satisfies Prisma.ContentReportSelect;

/**
 * When a report is due, how urgent it is, and whether it is late.
 *
 * Read from the reviewDeadline and priority columns. A row that reached the
 * queue before it could be stamped is worked out from its evidence and the
 * clock its reason runs on, the same answer stampMissingReviewClocks writes.
 */
function reportClock(report: {
  createdAt: Date;
  reason: string;
  status: string;
  reviewDeadline: Date | null;
  priority: string | null;
  evidence: unknown;
}) {
  const deadline = namedReportDeadline(report);
  return {
    reviewDeadline: deadline.toISOString(),
    priority: namedReportPriority(report),
    overdue: OPEN_REPORT_STATUSES.includes(report.status) && deadline.getTime() < Date.now(),
  };
}

const moderationQueueQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().trim().toUpperCase().optional(),
  contentType: z.string().trim().max(40).optional(),
  reason: z.string().trim().max(60).optional(),
  priority: z.enum(['URGENT', 'HIGH', 'NORMAL']).optional(),
  assigned: z.enum(['me', 'unclaimed']).optional(),
});

// Soonest due first. A row the stamping pass could not reach has no deadline in
// the column, and it goes to the top rather than the bottom: an unknown
// deadline is looked at early, never left behind every stamped report.
const DEADLINE_ORDER: Prisma.ContentReportOrderByWithRelationInput[] = [
  { reviewDeadline: { sort: 'asc', nulls: 'first' } },
  { createdAt: 'asc' },
];

/**
 * GET /admin/moderation/reports
 * Work queue of user reports.
 *
 * The open queue (?status=open) and the overdue view (?status=overdue) are
 * ordered by review deadline, soonest first, and every row says when it is due,
 * how urgent it is and whether it is already late. It used to be newest first
 * with no deadline at all; later the deadline was read out of the evidence JSON
 * and the open set sorted in memory, two thousand rows at a time, because
 * Postgres could not sort on it. reviewDeadline and priority are columns now,
 * so the database orders and pages the queue and counts what is overdue
 * exactly. Every other view is history and stays newest first.
 */
router.get('/moderation/reports', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { page: pageNum, limit: limitNum, status, contentType, reason, priority, assigned } = parseOr400(
      moderationQueueQuerySchema,
      req.query
    );

    // Reports filed by a door that does not stamp its own clock are given one
    // before the queue is read, so the sort below is the whole answer. A
    // failure is logged and the queue still loads: those rows sort first.
    await bestEffort('moderation queue review clocks', () => stampMissingReviewClocks());

    const now = new Date();
    const where: Prisma.ContentReportWhereInput = {};
    const openView = status === 'OPEN';
    const overdueView = status === 'OVERDUE';

    if (openView) {
      where.status = { in: OPEN_REPORT_STATUSES };
    } else if (overdueView) {
      where.status = { in: OPEN_REPORT_STATUSES };
      where.reviewDeadline = { lt: now };
    } else if (status && REPORT_STATUSES.includes(status)) {
      where.status = status;
    }
    if (contentType) {
      where.contentType = contentType.toUpperCase();
    }
    // Reasons arrive both as codes and as free text depending on where the
    // report was filed, so match loosely rather than on an exact value.
    if (reason) {
      where.reason = { contains: reason, mode: 'insensitive' };
    }
    if (priority) {
      where.priority = priority;
    }
    if (assigned === 'me') {
      where.reviewerId = req.user?.id;
    } else if (assigned === 'unclaimed') {
      where.reviewerId = null;
    }

    const openWhere: Prisma.ContentReportWhereInput = { status: { in: OPEN_REPORT_STATUSES } };

    const [reports, total, openCount, overdueStamped, unstamped] = await Promise.all([
      prisma.contentReport.findMany({
        where,
        select: { ...reportQueueSelect, evidence: true },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        orderBy: openView || overdueView ? DEADLINE_ORDER : { createdAt: 'desc' },
      }),
      prisma.contentReport.count({ where }),
      prisma.contentReport.count({ where: openWhere }),
      prisma.contentReport.count({ where: { ...openWhere, reviewDeadline: { lt: now } } }),
      // Any open report still without a deadline in the column, so the overdue
      // figure can include it. Normally none: the stamping pass above runs first.
      prisma.contentReport.findMany({
        where: { ...openWhere, reviewDeadline: null },
        select: { id: true, createdAt: true, reason: true, status: true, reviewDeadline: true, priority: true, evidence: true },
        orderBy: { createdAt: 'asc' },
        take: DEADLINE_SORT_WINDOW,
      }),
    ]);

    const overdueUnstamped = unstamped.filter((row) => reportClock(row).overdue).length;

    res.json({
      // The evidence JSON is read for its clock and not sent on: it carries the
      // reporter's contact address, which the queue list has no need to show.
      reports: reports.map(({ evidence, ...report }) => ({
        ...report,
        ...reportClock({ ...report, evidence }),
      })),
      openCount,
      overdueCount: overdueStamped + overdueUnstamped,
      // True only when more open reports lack a deadline than one pass reads,
      // so the overdue figure is a floor rather than the whole count.
      overdueCountIsPartial: unstamped.length >= DEADLINE_SORT_WINDOW,
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

    const found = await prisma.contentReport.findUnique({
      where: { id },
      select: { ...reportQueueSelect, evidence: true },
    });

    if (!found) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const { evidence, ...report } = found;

    const relatedReports = await prisma.contentReport.findMany({
      where: {
        reportedUserId: report.reportedUser.id,
        id: { not: report.id },
      },
      select: { id: true, reason: true, status: true, action: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    res.json({ report: { ...report, ...reportClock({ ...report, evidence }) }, relatedReports });
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
    // Notes become the recorded reason for a suspension or a ban and are what an
    // appeal is read against, so they are text or nothing. Anything else used
    // to reach the reviewNotes column and come back as a 500.
    if (notes !== undefined && notes !== null && (typeof notes !== 'string' || notes.length > 2000)) {
      return res.status(400).json({ error: 'Notes must be text of 2000 characters or fewer' });
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

    await auditAfterCommit({
      action: REPORT_AUDIT_ACTIONS[outcome.action],
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
        ...(outcome.banIdentityRecorded === undefined ? {} : { banIdentityRecorded: outcome.banIdentityRecorded }),
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
    // Notes become the recorded reason for a suspension or a ban and are what an
    // appeal is read against, so they are text or nothing. Anything else used
    // to reach the reviewNotes column and come back as a 500.
    if (notes !== undefined && notes !== null && (typeof notes !== 'string' || notes.length > 2000)) {
      return res.status(400).json({ error: 'Notes must be text of 2000 characters or fewer' });
    }

    const outcome = await resolveAnonymousReport(req.params.id, action, req.user!.id, notes);

    await auditAfterCommit({
      action: REPORT_AUDIT_ACTIONS[outcome.action],
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
        ...(outcome.banIdentityRecorded === undefined ? {} : { banIdentityRecorded: outcome.banIdentityRecorded }),
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
/**
 * The query this viewer accepts, checked before any of it reaches Prisma.
 *
 * page and limit went through a bare parseInt: ?limit=abc became NaN, ?page=0 a
 * negative skip, and ?limit=1000000 one unbounded query with two user joins per
 * row. An action the enum does not know reached the column and came back as a
 * Prisma 500 rather than a 400 that says what was wrong.
 *
 * adminAction filters on the precise verb recordAdminAction writes into
 * metadata, which every staff row carries whichever enum value it is filed
 * under.
 */
const auditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  action: z.nativeEnum(AuditAction).optional(),
  adminAction: z.string().trim().regex(/^[A-Z][A-Z_]{1,63}$/).optional(),
  actorUserId: z.string().trim().min(1).max(100).optional(),
  targetUserId: z.string().trim().min(1).max(100).optional(),
});

/**
 * What asking for one action means, across the rows written before that action
 * existed.
 *
 * Moderation decisions were filed under the nearest admin verb with the outcome
 * in metadata.moderationAction, and staff configuration and catalogue changes
 * — and safety decisions — under DATA_ACCESS with the verb in
 * metadata.adminAction. Those rows are still true records and are never
 * rewritten, so asking for MODERATION_BAN also finds a ban recorded the old way,
 * and asking for ADMIN_CONTENT_UPDATE finds a blog edit filed as a data access.
 *
 * Asking for DATA_ACCESS still returns those older staff rows as well. Leaving
 * them out would take a NOT over a JSON path, and in SQL that comparison is
 * unknown — not false — for every row without the key, so the filter would
 * have dropped the genuine data-access records along with the staff ones. A
 * viewer that hid who read member data would be worse than one that shows a
 * few blog edits beside it; the viewer shows each row's adminAction, so the
 * two are told apart on screen.
 */
function auditActionWhere(action: AuditAction): Prisma.AuditLogWhereInput {
  const moderation = MODERATION_ACTIONS.find((outcome) => REPORT_AUDIT_ACTIONS[outcome] === action);
  if (moderation) {
    return {
      OR: [
        { action },
        {
          action: LEGACY_REPORT_AUDIT_ACTIONS[moderation],
          metadata: { path: ['moderationAction'], equals: moderation },
        },
      ],
    };
  }

  const verbs = adminVerbsFiledUnder(action);
  if (verbs.length > 0) {
    return {
      OR: [
        { action },
        ...verbs.map((verb) => ({
          action: LEGACY_ADMIN_AUDIT_ACTION,
          metadata: { path: ['adminAction'], equals: verb },
        })),
      ],
    };
  }

  return { action };
}

router.get('/audit-logs', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      page: pageNum,
      limit: limitNum,
      action,
      adminAction,
      actorUserId,
      targetUserId,
    } = parseOr400(auditLogQuerySchema, req.query);
    const skip = (pageNum - 1) * limitNum;

    const clauses: Prisma.AuditLogWhereInput[] = [];
    if (action) clauses.push(auditActionWhere(action));
    if (adminAction) clauses.push({ metadata: { path: ['adminAction'], equals: adminAction } });
    if (actorUserId) clauses.push({ actorUserId });
    if (targetUserId) clauses.push({ targetUserId });
    const where: Prisma.AuditLogWhereInput = clauses.length > 0 ? { AND: clauses } : {};

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
    const { region } = req.query;
    // Math.max(1, NaN) is NaN, so ?page=abc still reached Prisma as a 500.
    const { page: pageNum, limit: limitNum, skip } = parsePaging({ page: req.query.page, limit: req.query.limit ?? '25' });

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
// DATA SUBJECT REQUESTS (the APP 12 / GDPR Art 12 queue)
// ============================================================================

/**
 * The staff queue for access, correction, erasure and restriction requests.
 *
 * Every DSARRequest carries a due date — 30 days, the period the OAIC reads APP
 * 12.4 as reasonable and the month GDPR Art 12(3) allows — an assignee and
 * processing notes. Nothing read them. There was no route that listed the
 * table, assignedTo had no writer, and the compliance screen counted requests
 * off AuditLog, so a privacy officer could not see which were open, who had
 * them or which were about to run out of time. Export and erasure finish on
 * their own, which is the common case; the ones that need a person — an
 * erasure refused under a legal hold, a correction the self-service path could
 * not apply — waited in a queue nobody could see. These two routes are it.
 */
const DSAR_OPEN_STATUSES: DSARStatus[] = [DSARStatus.PENDING, DSARStatus.IN_PROGRESS];
const DAY_MS = 24 * 60 * 60 * 1000;

const dsarQueueQuerySchema = z.object({
  status: z.union([z.literal('open'), z.literal('all'), z.nativeEnum(DSARStatus)]).default('open'),
  type: z.nativeEnum(DSARType).optional(),
  assigned: z.enum(['me', 'unassigned']).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

function dsarClock(request: { status: DSARStatus; dueDate: Date }) {
  const open = DSAR_OPEN_STATUSES.includes(request.status);
  const msLeft = request.dueDate.getTime() - Date.now();
  return {
    // Whole days either side of the deadline, rounded towards it: "0" is
    // due within the day, or overdue by less than one.
    daysRemaining: open ? Math.trunc(msLeft / DAY_MS) : null,
    overdue: open && msLeft < 0,
  };
}

/**
 * GET /admin/gdpr/dsar-requests
 * Open requests by due date, soonest first; any other view newest first.
 */
router.get('/gdpr/dsar-requests', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status, type, assigned, page, limit } = parseOr400(dsarQueueQuerySchema, req.query);

    const where: Prisma.DSARRequestWhereInput = {};
    if (status === 'open') where.status = { in: DSAR_OPEN_STATUSES };
    else if (status !== 'all') where.status = status;
    if (type) where.type = type;
    if (assigned === 'me') where.assignedTo = req.user!.id;
    if (assigned === 'unassigned') where.assignedTo = null;

    const openWhere: Prisma.DSARRequestWhereInput = { status: { in: DSAR_OPEN_STATUSES } };
    const now = new Date();

    const [requests, total, open, overdue, dueWithinWeek, unassigned] = await Promise.all([
      prisma.dSARRequest.findMany({
        where,
        orderBy: status === 'open' ? { dueDate: 'asc' } : { requestedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        // exportUrl is a live download link to a member's whole data file, and
        // a queue has no reason to hand it round.
        select: {
          id: true,
          type: true,
          status: true,
          requestDetails: true,
          assignedTo: true,
          processingNotes: true,
          requestedAt: true,
          acknowledgedAt: true,
          dueDate: true,
          completedAt: true,
          user: { select: { id: true, email: true, firstName: true, lastName: true, region: true } },
        },
      }),
      prisma.dSARRequest.count({ where }),
      prisma.dSARRequest.count({ where: openWhere }),
      prisma.dSARRequest.count({ where: { ...openWhere, dueDate: { lt: now } } }),
      prisma.dSARRequest.count({
        where: { ...openWhere, dueDate: { gte: now, lt: new Date(now.getTime() + 7 * DAY_MS) } },
      }),
      prisma.dSARRequest.count({ where: { ...openWhere, assignedTo: null } }),
    ]);

    const assigneeIds = Array.from(new Set(requests.map((r) => r.assignedTo).filter((id): id is string => Boolean(id))));
    const assignees = assigneeIds.length
      ? await prisma.user.findMany({
          where: { id: { in: assigneeIds } },
          select: { id: true, firstName: true, lastName: true, email: true },
        })
      : [];
    const assigneeById = new Map(assignees.map((a) => [a.id, a]));

    res.json({
      requests: requests.map((request) => ({
        ...request,
        ...dsarClock(request),
        assignee: request.assignedTo ? assigneeById.get(request.assignedTo) ?? null : null,
      })),
      summary: { open, overdue, dueWithinWeek, unassigned },
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
});

const dsarUpdateSchema = z
  .object({
    // 'me' takes the request; null gives it back; an id hands it to another admin.
    assignedTo: z.union([z.literal('me'), z.string().uuid(), z.null()]).optional(),
    status: z.enum([DSARStatus.IN_PROGRESS, DSARStatus.COMPLETED, DSARStatus.REJECTED]).optional(),
    note: z.string().trim().min(1).max(4000).optional(),
    // What the member is told. APP 12.9 requires written reasons for a refusal,
    // so a rejection cannot be recorded without one.
    memberMessage: z.string().trim().min(1).max(2000).optional(),
  })
  .strict();

const DSAR_TRANSITIONS: Record<DSARStatus, DSARStatus[]> = {
  PENDING: [DSARStatus.IN_PROGRESS, DSARStatus.COMPLETED, DSARStatus.REJECTED],
  IN_PROGRESS: [DSARStatus.COMPLETED, DSARStatus.REJECTED],
  COMPLETED: [],
  REJECTED: [],
  EXPIRED: [],
};

/**
 * PATCH /admin/gdpr/dsar-requests/:id
 * Take a request, hand it on, add a note, or close it with a reason.
 */
router.patch('/gdpr/dsar-requests/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = parseOr400(dsarUpdateSchema, req.body ?? {});
    if (body.assignedTo === undefined && !body.status && !body.note) {
      throw new ApiError(400, 'Nothing to change');
    }

    const existing = await prisma.dSARRequest.findUnique({
      where: { id: req.params.id },
      select: { id: true, userId: true, type: true, status: true, assignedTo: true, processingNotes: true },
    });
    if (!existing) {
      throw new ApiError(404, 'Request not found');
    }

    if (body.status && body.status !== existing.status) {
      if (!DSAR_TRANSITIONS[existing.status].includes(body.status)) {
        throw new ApiError(409, `A ${existing.status.toLowerCase()} request cannot be moved to ${body.status.toLowerCase()}`);
      }
      // An erasure is completed by running it. Marking one done by hand would
      // record a deletion that never happened, which is the one false entry
      // this queue must never be able to make.
      if (body.status === DSARStatus.COMPLETED && existing.type === DSARType.DELETION) {
        throw new ApiError(409, 'An erasure request is completed by running the erasure, not by marking it done here.');
      }
      if (body.status === DSARStatus.REJECTED && !body.memberMessage) {
        throw new ApiError(400, 'Say why the request is refused; the member is told the reason.');
      }
      if (body.status === DSARStatus.COMPLETED && !body.note) {
        throw new ApiError(400, 'Record what was done before closing the request.');
      }
    }

    let assignedTo: string | null | undefined;
    if (body.assignedTo === 'me') {
      assignedTo = req.user!.id;
    } else if (body.assignedTo === null) {
      assignedTo = null;
    } else if (body.assignedTo) {
      const assignee = await prisma.user.findUnique({ where: { id: body.assignedTo }, select: { role: true } });
      if (!assignee || assignee.role !== 'ADMIN') {
        throw new ApiError(400, 'A request can only be assigned to a platform admin');
      }
      assignedTo = body.assignedTo;
    }

    const stamp = `[${new Date().toISOString()} ${req.user!.id}]`;
    const noteLines = [
      body.note ? `${stamp} ${body.note}` : null,
      body.status && body.status !== existing.status ? `${stamp} Status ${existing.status} → ${body.status}` : null,
      body.memberMessage ? `${stamp} Told the member: ${body.memberMessage}` : null,
    ].filter((line): line is string => Boolean(line));

    const closing = body.status === DSARStatus.COMPLETED || body.status === DSARStatus.REJECTED;
    const updated = await prisma.dSARRequest.update({
      where: { id: existing.id },
      data: {
        ...(assignedTo !== undefined ? { assignedTo } : {}),
        ...(body.status ? { status: body.status } : {}),
        ...(closing ? { completedAt: new Date() } : {}),
        ...(noteLines.length
          ? { processingNotes: [existing.processingNotes, ...noteLines].filter(Boolean).join('\n') }
          : {}),
      },
      select: {
        id: true,
        type: true,
        status: true,
        assignedTo: true,
        processingNotes: true,
        dueDate: true,
        completedAt: true,
      },
    });

    await recordAdminAction(req, 'DSAR_REQUEST_UPDATED', {
      resourceType: 'DSARRequest',
      resourceId: existing.id,
      targetUserId: existing.userId,
      requestType: existing.type,
      previousStatus: existing.status,
      status: updated.status,
      ...(assignedTo !== undefined ? { assignedTo } : {}),
    });

    if (closing) {
      // The member hears the outcome of her own request in the place she made
      // it. Best effort: the decision is recorded, and a notification that
      // fails must not report the decision as failed.
      const kind = existing.type.toLowerCase();
      await bestEffort('dsar outcome notification', () =>
        prisma.notification.create({
          data: {
            userId: existing.userId,
            type: 'SYSTEM',
            title: body.status === DSARStatus.REJECTED ? 'We could not complete your privacy request' : 'Your privacy request is complete',
            message:
              body.memberMessage ??
              `We have completed your ${kind} request. You can see your requests in the Privacy Centre.`,
            link: '/dashboard/settings/privacy',
            data: { dsarRequestId: existing.id, status: updated.status },
          },
        })
      );
    }

    res.json({ request: { ...updated, ...dsarClock(updated) } });
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
    const { status, search = '' } = req.query;

    const { page: pageNum, limit: limitNum, skip } = parsePaging(req.query);

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

    await auditAfterCommit({
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
    const { tier, status } = req.query;

    const { page: pageNum, limit: limitNum, skip } = parsePaging(req.query);

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

    await auditAfterCommit({
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

    await auditAfterCommit({
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
    const { active } = req.query;

    const { page: pageNum, limit: limitNum, skip } = parsePaging(req.query);

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

    await auditAfterCommit({
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

    await auditAfterCommit({
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

// GET and PATCH /admin/woman-verifications used to live here: an older copy of
// the women-only review with nothing checking the status it was sent, no
// notification to the member, and no refusal to approve a request that had no
// evidence on it — the checks /api/verification/woman-gate makes. Nothing in
// the console called them any more, so they were a second, weaker door to the
// same decision, and they were removed rather than repaired.

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

const GROUP_SORT_COLUMNS = ['createdAt', 'updatedAt', 'name'] as const;

/**
 * GET /admin/groups
 */
router.get('/groups', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { search = '', privacy, featured, pinned, hidden } = req.query;

    const { page: pageNum, limit: limitNum, skip } = parsePaging(req.query);
    const { sortBy, sortOrder } = parseSort(req.query, GROUP_SORT_COLUMNS, { sortBy: 'createdAt', sortOrder: 'desc' });

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
        orderBy: { [sortBy]: sortOrder } as Prisma.GroupOrderByWithRelationInput,
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

    await auditAfterCommit({
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

    await auditAfterCommit({
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

    await auditAfterCommit({
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

    await auditAfterCommit({
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

    await auditAfterCommit({
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

const EVENT_SORT_COLUMNS = ['date', 'createdAt', 'updatedAt', 'title'] as const;

// The same HH:MM rule the member-facing event routes hold hosts to.
const EVENT_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * A whole number within bounds, or null where the column allows it.
 *
 * The admin event routes took baseAttendees, maxAttendees and price as
 * whatever arrived: a string reached Prisma as a 500, and a negative price or
 * a capacity of a million was published to members as though someone had meant
 * it. Undefined means the field was not sent.
 */
function eventWholeNumber(
  value: unknown,
  field: string,
  bounds: { min: number; max: number; nullable: boolean }
): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null && bounds.nullable) return null;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < bounds.min || value > bounds.max) {
    throw new ApiError(
      400,
      `${field} must be a whole number from ${bounds.min.toLocaleString('en-AU')} to ${bounds.max.toLocaleString('en-AU')}${bounds.nullable ? ', or empty' : ''}`
    );
  }
  return value;
}

const EVENT_NUMBER_BOUNDS = {
  baseAttendees: { min: 0, max: 100_000, nullable: false },
  maxAttendees: { min: 1, max: 100_000, nullable: true },
  price: { min: 0, max: 1_000_000, nullable: true },
} as const;

function eventTime(value: unknown, field: 'startTime' | 'endTime'): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!EVENT_TIME_PATTERN.test(text)) {
    throw new ApiError(400, `${field} must be a time written HH:MM`);
  }
  return text;
}

/** An event cannot finish before it starts; the times are compared on the same day. */
function assertEventEndsAfterStart(startTime: string, endTime: string): void {
  if (endTime <= startTime) {
    throw new ApiError(400, 'The event has to end after it starts');
  }
}

/**
 * GET /admin/events
 */
router.get('/events', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { search = '', type, format, featured, pinned, hidden } = req.query;

    const { page: pageNum, limit: limitNum, skip } = parsePaging(req.query);
    const { sortBy, sortOrder } = parseSort(req.query, EVENT_SORT_COLUMNS, { sortBy: 'date', sortOrder: 'asc' });

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
        orderBy: { [sortBy]: sortOrder } as Prisma.EventOrderByWithRelationInput,
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
    const image = typeof req.body?.image === 'string' ? req.body.image.trim() : '';

    const hostName = typeof req.body?.hostName === 'string' ? req.body.hostName.trim() : req.body?.host?.name;
    const hostTitle = typeof req.body?.hostTitle === 'string' ? req.body.hostTitle.trim() : req.body?.host?.title;
    const hostAvatar = typeof req.body?.hostAvatar === 'string' ? req.body.hostAvatar.trim() : req.body?.host?.avatar;

    if (!title) return res.status(400).json({ error: 'Title is required' });
    if (!description) return res.status(400).json({ error: 'Description is required' });
    if (!type) return res.status(400).json({ error: 'Invalid type' });
    if (!format) return res.status(400).json({ error: 'Invalid format' });
    if (dateValue === undefined || dateValue === null || Number.isNaN(date.getTime())) {
      return res.status(400).json({ error: 'Invalid date' });
    }
    if (req.body?.startTime === undefined || req.body?.endTime === undefined) {
      return res.status(400).json({ error: 'Start/end time is required' });
    }
    const startTime = eventTime(req.body.startTime, 'startTime');
    const endTime = eventTime(req.body.endTime, 'endTime');
    assertEventEndsAfterStart(startTime, endTime);
    if (!image) return res.status(400).json({ error: 'Image is required' });
    if (!hostName || !hostTitle || !hostAvatar) return res.status(400).json({ error: 'Host is required' });

    const baseAttendees = eventWholeNumber(req.body?.baseAttendees, 'baseAttendees', EVENT_NUMBER_BOUNDS.baseAttendees);
    const maxAttendees = eventWholeNumber(req.body?.maxAttendees, 'maxAttendees', EVENT_NUMBER_BOUNDS.maxAttendees);
    const price = eventWholeNumber(req.body?.price, 'price', EVENT_NUMBER_BOUNDS.price);

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
        baseAttendees: baseAttendees ?? 0,
        maxAttendees: maxAttendees ?? null,
        price: price === undefined ? 0 : price,
        tags,
      },
    });

    await auditAfterCommit({
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
    const existing = await prisma.event.findUnique({ where: { id }, select: { id: true, startTime: true, endTime: true } });
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
      // new Date(null) is 1 January 1970, which is valid and not what anyone meant.
      if (req.body.date === null || Number.isNaN(d.getTime())) return res.status(400).json({ error: 'Invalid date' });
      data.date = d;
    }
    if (req.body?.startTime !== undefined) data.startTime = eventTime(req.body.startTime, 'startTime');
    if (req.body?.endTime !== undefined) data.endTime = eventTime(req.body.endTime, 'endTime');
    // Changing one end of the event is checked against the other as it stands,
    // so moving the start past the finish is refused as well.
    if (data.startTime !== undefined || data.endTime !== undefined) {
      assertEventEndsAfterStart(data.startTime ?? existing.startTime, data.endTime ?? existing.endTime);
    }
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

    const baseAttendees = eventWholeNumber(req.body?.baseAttendees, 'baseAttendees', EVENT_NUMBER_BOUNDS.baseAttendees);
    const maxAttendees = eventWholeNumber(req.body?.maxAttendees, 'maxAttendees', EVENT_NUMBER_BOUNDS.maxAttendees);
    const price = eventWholeNumber(req.body?.price, 'price', EVENT_NUMBER_BOUNDS.price);
    if (baseAttendees !== undefined) data.baseAttendees = baseAttendees;
    if (maxAttendees !== undefined) data.maxAttendees = maxAttendees;
    if (price !== undefined) data.price = price;
    if (req.body?.tags !== undefined) {
      data.tags = Array.isArray(req.body.tags) ? req.body.tags.filter((t: any) => typeof t === 'string') : [];
    }
    if (req.body?.isFeatured !== undefined) data.isFeatured = !!req.body.isFeatured;
    if (req.body?.isPinned !== undefined) data.isPinned = !!req.body.isPinned;
    if (req.body?.isHidden !== undefined) data.isHidden = !!req.body.isHidden;

    const event = await prisma.event.update({ where: { id }, data });

    await auditAfterCommit({
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

    await auditAfterCommit({
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
    // Recorded before the applicant is told, so a notification that fails
    // cannot take the record of the decision down with it. An award is money
    // going to a named member; who recorded it, and what it was, has to
    // outlive the log line.
    await recordAdminAction(req, 'GRANT_APPLICATION_DECIDED', {
      resourceType: 'GrantApplication',
      resourceId: application.id,
      targetUserId: application.userId,
      grantId: application.grantId,
      previousStatus: application.status,
      status: updated.status,
      ...(amount !== undefined && Number.isFinite(amount) ? { amountAwarded: amount } : {}),
    });

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
    await recordAdminAction(req, 'INSURANCE_APPLICATION_DECIDED', {
      resourceType: 'InsuranceApplication',
      resourceId: application.id,
      targetUserId: application.userId,
      productId: application.productId,
      previousStatus: application.status,
      status: updated.status,
      ...(num(premiumQuoted) !== undefined ? { premiumQuoted: num(premiumQuoted) } : {}),
      ...(num(coverageAmount) !== undefined ? { coverageAmount: num(coverageAmount) } : {}),
    });

    await tellApplicant(application.userId, 'Update on your insurance application', `${line[status]}${typeof note === 'string' && note.trim() ? ` ${note.trim()}` : ''}`, '/dashboard/finance/insurance');

    logger.info('Insurance application decided', { applicationId: application.id, status, by: req.user!.id });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

export default router;
