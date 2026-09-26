import { Router, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { AuditAction, Prisma } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/roles';
import { ApiError } from '../middleware/errorHandler';
import { createRateLimiter } from '../middleware/rateLimiter';
import { CONTENT_LIMITS } from '../utils/contentSafety';
import { logAudit } from '../utils/audit';
import { bestEffort } from '../utils/best-effort';
import { evaluateSafetyScore } from '../services/moderation.service';
import {
  calculateSafetyScore,
  getSafetyStatus,
  handleUserBlock,
  handleUserReport,
  verifyReport,
} from '../services/safety-score.service';
import { recordSafetyReport, recordUserBlock } from '../services/trust.service';
import { prisma } from '../utils/prisma';
import { blockUser, listBlockedUsers, unblockUser } from '../utils/safety-store';
import { reviewReportedContent } from '../services/moderation-threshold.service';
import { reportLimiter } from '../middleware/socialLimits';

const router = Router();

type ReportTargetType = 'post' | 'comment' | 'video' | 'user' | 'message' | 'channel' | 'event' | 'other';

// ContentReport speaks the moderation queue's vocabulary; the Safety Center
// speaks the reporter's. Translate on the way out so a reporter still sees
// whether their case is open or finished.
const REPORT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'SUBMITTED',
  REVIEWING: 'UNDER_REVIEW',
  RESOLVED: 'ACTION_TAKEN',
  DISMISSED: 'CLOSED',
};

/**
 * Every report has to name the account it is about, because that is what a
 * moderator acts on. Returns null when the target cannot be traced to a user.
 */
async function resolveReportedUserId(
  targetType: ReportTargetType,
  targetId?: string
): Promise<string | null> {
  if (!targetId) {
    return null;
  }

  switch (targetType) {
    case 'user': {
      const user = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true } });
      return user?.id ?? null;
    }
    case 'post': {
      const post = await prisma.post.findUnique({ where: { id: targetId }, select: { authorId: true } });
      return post?.authorId ?? null;
    }
    case 'comment': {
      const comment = await prisma.comment.findUnique({ where: { id: targetId }, select: { authorId: true } });
      return comment?.authorId ?? null;
    }
    // Member-hosted events carry a host now, which is what makes them
    // reportable: a listing that can put a woman in a room with someone has to
    // resolve to the person who published it. Curated rows have no host, so a
    // report on one routes to no member and is handled as an unrouted report.
    case 'event': {
      const event = await prisma.event.findUnique({ where: { id: targetId }, select: { hostUserId: true } });
      return event?.hostUserId ?? null;
    }
    case 'video': {
      const video = await prisma.video.findUnique({ where: { id: targetId }, select: { authorId: true } });
      return video?.authorId ?? null;
    }
    case 'message': {
      const message = await prisma.message.findUnique({ where: { id: targetId }, select: { senderId: true } });
      return message?.senderId ?? null;
    }
    case 'channel': {
      const channel = await prisma.channel.findUnique({ where: { id: targetId }, select: { ownerId: true } });
      return channel?.ownerId ?? null;
    }
    default:
      return null;
  }
}

// ===========================================
// SAFETY SCORE (Full Launch)
// ===========================================
/**
 * A check of a piece of text before it is posted.
 *
 * It was open to anyone, took any length up to the ten-megabyte body limit,
 * and sat under only the general limit — and every distinct input goes to the
 * platform's moderation provider. Nothing costs money there, but the provider
 * rate-limits the organisation, so an anonymous caller could spend the budget
 * the real moderation of real posts depends on. It now asks for a signed-in
 * member, takes no more than the longest thing a member can post, and has a
 * budget of its own per member.
 */
const safetyCheckLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  keyGenerator: (req) => `safety-check:${(req as AuthRequest).user?.id ?? req.ip}`,
  handler: (_req, res) =>
    res.status(429).json({ success: false, message: 'Too many checks for now. Please try again in a few minutes.' }),
});

router.post('/', authenticate, safetyCheckLimiter, async (req: AuthRequest, res, next) => {
  try {
    const { content } = req.body ?? {};

    if (typeof content !== 'string' || !content.trim()) {
      throw new ApiError(400, 'Content is required');
    }
    if (content.length > CONTENT_LIMITS.post) {
      throw new ApiError(400, `Content can be at most ${CONTENT_LIMITS.post} characters`);
    }

    const data = await evaluateSafetyScore(content);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// SAFETY REPORTS
// ===========================================
router.get('/reports', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const reports = await prisma.contentReport.findMany({
      where: { reporterId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json({
      success: true,
      data: reports.map((report) => ({
        id: report.id,
        userId: report.reporterId,
        targetType: report.contentType.toLowerCase(),
        targetId: report.contentId,
        reason: report.reason,
        details: report.description ?? undefined,
        status: REPORT_STATUS_LABELS[report.status] ?? report.status,
        createdAt: report.createdAt.toISOString(),
        updatedAt: report.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/reports',
  authenticate,
  reportLimiter,
  [
    body('targetType').notEmpty().isIn(['post', 'comment', 'video', 'user', 'message', 'channel', 'event', 'other']),
    body('reason').notEmpty().isString(),
    body('targetId').optional().isString(),
    body('details').optional().isString(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { targetType, targetId, reason, details } = req.body as {
        targetType: ReportTargetType;
        targetId?: string;
        reason: string;
        details?: string;
      };

      const reportedUserId = await resolveReportedUserId(targetType, targetId);

      // A report the moderation queue cannot route is worse than no report, so
      // say so instead of accepting it into a void.
      if (!reportedUserId) {
        throw new ApiError(400, 'We could not find the content you reported');
      }

      if (targetType === 'post' && targetId) {
        await prisma.post.update({
          where: { id: targetId },
          data: { reportCount: { increment: 1 } },
        });
      }

      if (targetType === 'video' && targetId) {
        await prisma.video.update({
          where: { id: targetId },
          data: { reportCount: { increment: 1 } },
        });
      }
      if (targetType === 'comment' && targetId) {
        await prisma.comment.update({
          where: { id: targetId },
          data: { reportCount: { increment: 1 } },
        });
      }

      const report = await prisma.contentReport.create({
        data: {
          reporterId: req.user!.id,
          contentType: targetType.toUpperCase(),
          contentId: targetId!,
          reportedUserId,
          reason,
          description: details,
          status: 'PENDING',
        },
      });

      await recordSafetyReport(req.user!.id, reportedUserId);
      await handleUserReport(reportedUserId, req.user!.id, reason, targetId, targetType);
      // Enough different reporters take the content down while it is reviewed.
      if ((targetType === 'post' || targetType === 'comment' || targetType === 'video') && targetId) {
        await reviewReportedContent(targetType, targetId);
      }

      res.status(201).json({
        success: true,
        data: {
          id: report.id,
          userId: report.reporterId,
          targetType,
          targetId,
          reason,
          details,
          status: REPORT_STATUS_LABELS[report.status] ?? report.status,
          createdAt: report.createdAt.toISOString(),
          updatedAt: report.updatedAt.toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// BLOCKED USERS
// ===========================================
router.get('/blocks', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const blocks = await listBlockedUsers(req.user!.id);

    const users = await prisma.user.findMany({
      where: { id: { in: blocks.map((block) => block.blockedUserId) } },
      select: { id: true, displayName: true, avatar: true, headline: true },
    });

    const enriched = blocks.map((block) => ({
      ...block,
      user: users.find((user) => user.id === block.blockedUserId) || null,
    }));

    res.json({ success: true, data: enriched });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/blocks',
  authenticate,
  [body('blockedUserId').notEmpty().isString(), body('reason').optional().isString()],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { blockedUserId } = req.body;

      if (blockedUserId === req.user!.id) {
        throw new ApiError(400, 'You cannot block yourself');
      }

      const target = await prisma.user.findUnique({
        where: { id: blockedUserId },
        select: { id: true },
      });

      if (!target) {
        throw new ApiError(404, 'User not found');
      }

      const { created } = await blockUser(req.user!.id, blockedUserId);

      if (created) {
        await recordUserBlock(blockedUserId);
        await handleUserBlock(blockedUserId, req.user!.id);
      }

      const [block] = (await listBlockedUsers(req.user!.id)).filter(
        (entry) => entry.blockedUserId === blockedUserId
      );

      res.status(created ? 201 : 200).json({ success: true, data: block });
    } catch (error) {
      next(error);
    }
  }
);

router.delete('/blocks/:blockedUserId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { blockedUserId } = req.params;
    await unblockUser(req.user!.id, blockedUserId);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// SAFETY SETTINGS
// ===========================================
const MESSAGE_AUDIENCES = ['all', 'connections', 'none'] as const;
const PROFILE_VISIBILITIES = ['public', 'connections', 'private'] as const;

// Defaults mirror the UserSafetySettings model, so a user who has never saved
// reads the same values the database would give them on first write.
const SAFETY_PREFERENCE_DEFAULTS = {
  allowMessagesFrom: 'connections',
  filterOffensiveContent: true,
  hideReadReceipts: false,
  profileVisibility: 'public',
  hideOnlineStatus: false,
  hideLastSeen: false,
  enableSafetyAlerts: true,
};

router.get('/settings', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { allowMessages: true },
    });

    const profile = await prisma.profile.findUnique({
      where: { userId: req.user!.id },
      select: { isSafeMode: true, hideFromSearch: true },
    });

    const preferences = await prisma.userSafetySettings.findUnique({
      where: { userId: req.user!.id },
      select: {
        allowMessagesFrom: true,
        filterOffensiveContent: true,
        hideReadReceipts: true,
        profileVisibility: true,
        hideOnlineStatus: true,
        hideLastSeen: true,
        enableSafetyAlerts: true,
      },
    });

    res.json({
      success: true,
      data: {
        allowMessages: user?.allowMessages ?? true,
        isSafeMode: profile?.isSafeMode ?? false,
        hideFromSearch: profile?.hideFromSearch ?? false,
        ...SAFETY_PREFERENCE_DEFAULTS,
        ...(preferences ?? {}),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.patch(
  '/settings',
  authenticate,
  [
    body('allowMessages').optional().isBoolean(),
    body('isSafeMode').optional().isBoolean(),
    body('hideFromSearch').optional().isBoolean(),
    body('allowMessagesFrom').optional().isIn(MESSAGE_AUDIENCES),
    body('filterOffensiveContent').optional().isBoolean(),
    body('hideReadReceipts').optional().isBoolean(),
    body('profileVisibility').optional().isIn(PROFILE_VISIBILITIES),
    body('hideOnlineStatus').optional().isBoolean(),
    body('hideLastSeen').optional().isBoolean(),
    body('enableSafetyAlerts').optional().isBoolean(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { allowMessages, isSafeMode, hideFromSearch } = req.body;

      if (typeof allowMessages === 'boolean') {
        await prisma.user.update({
          where: { id: req.user!.id },
          data: { allowMessages },
        });
      }

      if (typeof isSafeMode === 'boolean' || typeof hideFromSearch === 'boolean') {
        await prisma.profile.upsert({
          where: { userId: req.user!.id },
          update: {
            ...(typeof isSafeMode === 'boolean' ? { isSafeMode } : {}),
            ...(typeof hideFromSearch === 'boolean' ? { hideFromSearch } : {}),
          },
          create: {
            userId: req.user!.id,
            isSafeMode: typeof isSafeMode === 'boolean' ? isSafeMode : false,
            hideFromSearch: typeof hideFromSearch === 'boolean' ? hideFromSearch : false,
          },
        });
      }

      // Only the keys the caller actually sent are written, so a page that owns
      // a subset of these preferences cannot clobber the ones it does not show.
      const preferenceUpdates = Object.fromEntries(
        Object.keys(SAFETY_PREFERENCE_DEFAULTS)
          .filter((key) => req.body[key] !== undefined)
          .map((key) => [key, req.body[key]])
      );

      if (Object.keys(preferenceUpdates).length > 0) {
        await prisma.userSafetySettings.upsert({
          where: { userId: req.user!.id },
          update: preferenceUpdates,
          create: {
            userId: req.user!.id,
            ...SAFETY_PREFERENCE_DEFAULTS,
            ...preferenceUpdates,
          },
        });
      }

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// SAFETY FLAGS — the staff queue
// ===========================================
/**
 * AdminFlag had two writers and no reader at all.
 *
 * When a member writes about suicide or self-harm in a wellness forum, the
 * forum raises a HIGH-severity SAFETY_CONCERN flag. When a member's safety
 * score falls below 25, safety-score.service raises a HIGH-severity
 * SAFETY_CRITICAL one. Nothing on this platform ever read either: no route,
 * no page, no worker. The most urgent thing ATHENA can detect about a member
 * became a database row no human would ever open. A woman writing that she
 * wanted to die produced a row and silence.
 *
 * These two routes are that reader, and the moderation queue at
 * /admin/moderation is where staff work them — above the content reports,
 * because a woman in danger outranks a rude comment. Raising a flag now also
 * notifies the admins, the same way every other queue on this platform tells
 * somebody there is something waiting.
 *
 * They live in this file, under /api/safety, rather than beside the report
 * queue in admin.routes.ts, because that router is not this change's to edit.
 * They are guarded individually, like the /api/admin routers that guard
 * themselves: authenticate, then staff role, which also enforces the staff
 * second factor.
 */

/** Severities that jump the queue. Everything else sorts under them. */
const URGENT_FLAG_SEVERITIES = ['CRITICAL', 'HIGH'];

const FLAG_PERSON_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  displayName: true,
  email: true,
  isSuspended: true,
} as const;

type FlagRow = {
  id: string;
  userId: string;
  type: string;
  reason: string | null;
  severity: string;
  flaggedById: string;
  notes: string | null;
  resolvedAt: Date | null;
  resolvedById: string | null;
  createdAt: Date;
};

router.get(
  '/moderation/flags',
  authenticate,
  requireRole('MODERATOR', 'ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const status = String(req.query.status ?? 'open').toLowerCase();
      const requested = Number.parseInt(String(req.query.limit ?? '50'), 10);
      const limit = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), 100) : 50;

      const where: Prisma.AdminFlagWhereInput =
        status === 'resolved' ? { resolvedAt: { not: null } } : status === 'all' ? {} : { resolvedAt: null };

      // Two queries rather than one ordered query, because severity is a
      // string column and ordering by it alphabetically puts LOW above
      // MEDIUM. Fetching the urgent ones first and filling the rest of the
      // page underneath guarantees that no HIGH-severity safety concern can
      // ever be pushed off the first page by a pile of newer minor flags —
      // which is the whole reason this queue exists.
      const urgent = await prisma.adminFlag.findMany({
        where: { ...where, severity: { in: URGENT_FLAG_SEVERITIES } },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
      const rest =
        urgent.length < limit
          ? await prisma.adminFlag.findMany({
              where: { ...where, severity: { notIn: URGENT_FLAG_SEVERITIES } },
              orderBy: { createdAt: 'desc' },
              take: limit - urgent.length,
            })
          : [];

      const rows = [...urgent, ...rest] as FlagRow[];

      // AdminFlag carries ids, not relations, so the accounts are read in one
      // go. 'system' is not a user id — the safety-score service raises its
      // flags under that name — so it simply finds nothing and is presented
      // as the platform itself.
      const ids = Array.from(
        new Set(rows.flatMap((row) => [row.userId, row.flaggedById, row.resolvedById ?? '']).filter(Boolean))
      );
      const people = ids.length
        ? await prisma.user.findMany({ where: { id: { in: ids } }, select: FLAG_PERSON_SELECT })
        : [];
      const byId = new Map(people.map((person) => [person.id, person]));

      const [openCount, urgentCount, total] = await Promise.all([
        prisma.adminFlag.count({ where: { resolvedAt: null } }),
        prisma.adminFlag.count({ where: { resolvedAt: null, severity: { in: URGENT_FLAG_SEVERITIES } } }),
        prisma.adminFlag.count({ where }),
      ]);

      res.json({
        flags: rows.map((row) => ({
          id: row.id,
          type: row.type,
          severity: row.severity,
          isUrgent: URGENT_FLAG_SEVERITIES.includes(row.severity),
          reason: row.reason,
          notes: row.notes,
          createdAt: row.createdAt,
          resolvedAt: row.resolvedAt,
          member: byId.get(row.userId) ?? null,
          raisedBy: byId.get(row.flaggedById) ?? null,
          raisedBySystem: !byId.has(row.flaggedById),
          resolvedBy: row.resolvedById ? byId.get(row.resolvedById) ?? null : null,
        })),
        openCount,
        urgentCount,
        total,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/moderation/flags/:id/resolve',
  authenticate,
  requireRole('MODERATOR', 'ADMIN'),
  [body('notes').optional().isString().isLength({ max: 2000 })],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const existing = (await prisma.adminFlag.findUnique({ where: { id: req.params.id } })) as FlagRow | null;
      if (!existing) {
        throw new ApiError(404, 'Safety flag not found');
      }
      if (existing.resolvedAt) {
        throw new ApiError(409, 'That flag has already been closed');
      }

      const note = typeof req.body?.notes === 'string' ? req.body.notes.trim() : '';
      const resolved = await prisma.adminFlag.update({
        where: { id: existing.id },
        data: {
          resolvedAt: new Date(),
          resolvedById: req.user!.id,
          isActive: false,
          // Appended rather than replaced: the original note says which post
          // or which score raised the flag, and losing it would leave the row
          // unreadable a month later.
          ...(note ? { notes: existing.notes ? `${existing.notes}\n\nClosed by staff: ${note}` : `Closed by staff: ${note}` } : {}),
        },
      });

      // Who closed a safety concern about a member, and when. On a platform
      // holding domestic violence records "a moderator did this" is not an
      // answer anybody can give a regulator. The change is already committed,
      // so the row is best effort rather than a reason to fail the response.
      await bestEffort(
        'safety flag resolution audit row',
        logAudit({
          action: AuditAction.DATA_ACCESS,
          actorUserId: req.user!.id,
          targetUserId: existing.userId,
          ipAddress: req.ip ?? null,
          userAgent: req.get('user-agent') || null,
          metadata: {
            adminAction: 'SAFETY_FLAG_RESOLVED',
            resourceType: 'AdminFlag',
            resourceId: existing.id,
            flagType: existing.type,
            severity: existing.severity,
          },
        })
      );

      res.json({ success: true, flag: { id: resolved.id, resolvedAt: resolved.resolvedAt } });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// SAFETY INCIDENTS — adjudication, and why a score is what it is
// ===========================================
/**
 * Every report and every block writes a SafetyIncident, and every one moves
 * the reported member's safety score. Nothing ever decided a report: the
 * service had a verifyReport function and no caller, so an unfounded report
 * counted against her for ever, and a founded one never counted for more than
 * an unexamined one. Nor could anybody see why a score was what it was —
 * calculateSafetyScore and getSafetyStatus were reachable from no route — so
 * a moderator opening a SAFETY_CRITICAL flag had a number and no reasons.
 *
 * These are that decision and that explanation, under the same guard as the
 * flag queue above. A dismissed report stops counting against her; an upheld
 * one counts as a verified report. Who decided, and which way, is recorded.
 */
const INCIDENT_PERSON_SELECT = { id: true, firstName: true, lastName: true, displayName: true, isSuspended: true } as const;

router.get(
  '/moderation/incidents',
  authenticate,
  requireRole('MODERATOR', 'ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const status = String(req.query.status ?? 'open').toLowerCase();
      const requested = Number.parseInt(String(req.query.limit ?? '50'), 10);
      const limit = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), 100) : 50;
      const userId = typeof req.query.userId === 'string' && req.query.userId ? req.query.userId : undefined;

      // Only reports wait for a decision. A block is the blocker's own call
      // and is recorded as verified when it happens; there is nothing to rule on.
      const where: Prisma.SafetyIncidentWhereInput = {
        type: 'REPORT',
        ...(userId ? { userId } : {}),
        ...(status === 'decided' ? { resolvedAt: { not: null } } : status === 'all' ? {} : { resolvedAt: null }),
      };

      const [incidents, total, openCount] = await Promise.all([
        prisma.safetyIncident.findMany({ where, orderBy: { createdAt: 'asc' }, take: limit }),
        prisma.safetyIncident.count({ where }),
        prisma.safetyIncident.count({ where: { type: 'REPORT', resolvedAt: null } }),
      ]);

      const ids = Array.from(new Set(incidents.flatMap((row) => [row.userId, row.reporterId ?? '', row.resolvedById ?? '']).filter(Boolean)));
      const people = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: INCIDENT_PERSON_SELECT }) : [];
      const byId = new Map(people.map((person) => [person.id, person]));

      res.json({
        success: true,
        data: incidents.map((row) => ({
          id: row.id,
          severity: row.severity,
          reason: row.reason,
          contentType: row.contentType,
          contentId: row.contentId,
          createdAt: row.createdAt,
          decided: Boolean(row.resolvedAt),
          upheld: row.resolvedAt ? row.verified : null,
          decidedAt: row.resolvedAt,
          member: byId.get(row.userId) ?? null,
          reporter: row.reporterId ? byId.get(row.reporterId) ?? null : null,
          decidedBy: row.resolvedById ? byId.get(row.resolvedById) ?? null : null,
        })),
        total,
        openCount,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/moderation/incidents/:id/decision',
  authenticate,
  requireRole('MODERATOR', 'ADMIN'),
  [body('upheld').isBoolean().withMessage('Say whether the report is upheld'), body('notes').optional().isString().isLength({ max: 2000 })],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const incident = await prisma.safetyIncident.findUnique({ where: { id: req.params.id } });
      if (!incident || incident.type !== 'REPORT') {
        throw new ApiError(404, 'Report not found');
      }
      if (incident.resolvedAt) {
        throw new ApiError(409, 'That report has already been decided');
      }

      const upheld = req.body.upheld === true;
      await verifyReport(incident.id, upheld, req.user!.id);
      const status = await getSafetyStatus(incident.userId);

      await bestEffort(
        'safety incident decision audit row',
        logAudit({
          action: AuditAction.DATA_ACCESS,
          actorUserId: req.user!.id,
          targetUserId: incident.userId,
          ipAddress: req.ip ?? null,
          userAgent: req.get('user-agent') || null,
          metadata: {
            adminAction: upheld ? 'SAFETY_REPORT_UPHELD' : 'SAFETY_REPORT_DISMISSED',
            resourceType: 'SafetyIncident',
            resourceId: incident.id,
            scoreAfter: status.score,
            ...(typeof req.body.notes === 'string' && req.body.notes.trim() ? { notes: req.body.notes.trim() } : {}),
          },
        })
      );

      res.json({ success: true, data: { id: incident.id, upheld, score: status.score, level: status.level } });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/moderation/members/:userId/safety-score',
  authenticate,
  requireRole('MODERATOR', 'ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const member = await prisma.user.findUnique({ where: { id: req.params.userId }, select: INCIDENT_PERSON_SELECT });
      if (!member) {
        throw new ApiError(404, 'Member not found');
      }

      // The stored score is what the rest of the platform acts on; the
      // breakdown is worked out now from the same inputs, so the two can
      // differ if something changed since the last recalculation, and the
      // page says which is which rather than showing one number for both.
      const [stored, breakdown] = await Promise.all([
        getSafetyStatus(member.id),
        calculateSafetyScore(member.id),
      ]);

      res.json({
        success: true,
        data: {
          member,
          stored: { score: stored.score, level: stored.level, assessedAt: stored.assessedAt },
          current: breakdown,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
