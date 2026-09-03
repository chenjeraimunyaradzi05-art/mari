/**
 * Admin Operational Routes
 *
 * The controls an operator needs during an incident or a launch, none of which
 * had a way in before: the GDPR Article 33 breach workflow, legal holds that
 * suspend erasure, maintenance mode, and the authority-referral queue.
 *
 * Guards are attached per route rather than with router.use so this router can
 * sit in front of admin.routes.ts without re-authenticating every /api/admin
 * request that it does not handle.
 */

import { Router, Response, NextFunction, RequestHandler } from 'express';
import { BreachSeverity, BreachStatus, DataCategory } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth';
import { ApiError } from '../middleware/errorHandler';
import { breachNotificationService } from '../services/breach.service';
import {
  ESCALATION_STATUSES,
  EscalationStatus,
  listAuthorityEscalations,
  getAuthorityEscalation,
  updateAuthorityEscalationStatus,
} from '../services/content-report.service';
import { getMaintenanceState, setMaintenanceState } from '../services/feature-flags.service';
import { logger } from '../utils/logger';

const router = Router();

const adminOnly: RequestHandler[] = [authenticate, requireRole('ADMIN')];

const parsePage = (value: unknown) => Math.max(1, parseInt(String(value ?? '1'), 10) || 1);
const parseLimit = (value: unknown, max = 100, fallback = 25) =>
  Math.min(max, Math.max(1, parseInt(String(value ?? fallback), 10) || fallback));

const parseDate = (value: unknown, field: string): Date | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, `${field} must be a valid date`);
  }
  return date;
};

const parseStringArray = (value: unknown, field: string): string[] => {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new ApiError(400, `${field} must be an array`);
  }
  return value.map((entry) => String(entry).trim()).filter((entry) => entry.length > 0);
};

// ============================================================================
// BREACH NOTIFICATION (GDPR Articles 33 & 34)
// ============================================================================

// Article 33 gives 72 hours from becoming aware of a breach to notify the
// supervisory authority. Everything below is measured against that clock.
const NOTIFICATION_DEADLINE_MS = 72 * 60 * 60 * 1000;
const DUE_SOON_MS = 24 * 60 * 60 * 1000;

type DeadlineState = 'NOT_REQUIRED' | 'MET' | 'MISSED' | 'OVERDUE' | 'DUE_SOON' | 'ON_TRACK';

interface BreachDeadline {
  deadlineAt: string;
  hoursRemaining: number;
  state: DeadlineState;
}

interface DeadlineInput {
  detectedAt: Date | string;
  notificationRequired: boolean;
  regulatorNotifiedAt: Date | string | null;
}

/**
 * Resolve where a breach sits against its 72-hour deadline. MISSED is kept
 * distinct from OVERDUE deliberately: OVERDUE is a live obligation an operator
 * can still discharge, MISSED is a closed one that has to be explained to the
 * regulator instead.
 */
function resolveDeadline(breach: DeadlineInput, now = Date.now()): BreachDeadline {
  const detectedAt = new Date(breach.detectedAt).getTime();
  const deadline = detectedAt + NOTIFICATION_DEADLINE_MS;
  const hoursRemaining = Math.round(((deadline - now) / (1000 * 60 * 60)) * 10) / 10;

  let state: DeadlineState;
  if (!breach.notificationRequired) {
    state = 'NOT_REQUIRED';
  } else if (breach.regulatorNotifiedAt) {
    state = new Date(breach.regulatorNotifiedAt).getTime() <= deadline ? 'MET' : 'MISSED';
  } else if (now > deadline) {
    state = 'OVERDUE';
  } else if (deadline - now <= DUE_SOON_MS) {
    state = 'DUE_SOON';
  } else {
    state = 'ON_TRACK';
  }

  return { deadlineAt: new Date(deadline).toISOString(), hoursRemaining, state };
}

const withDeadline = <T extends DeadlineInput>(breach: T, now = Date.now()) => ({
  ...breach,
  notificationDeadline: resolveDeadline(breach, now),
});

const isBreachSeverity = (value: unknown): value is BreachSeverity =>
  Object.values(BreachSeverity).includes(value as BreachSeverity);

const isBreachStatus = (value: unknown): value is BreachStatus =>
  Object.values(BreachStatus).includes(value as BreachStatus);

const isDataCategory = (value: unknown): value is DataCategory =>
  Object.values(DataCategory).includes(value as DataCategory);

/**
 * POST /admin/breaches
 * Record a personal data breach and start the 72-hour clock
 */
router.post('/breaches', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { title, description, severity, dataCategories, affectedRecords, affectedUsers } = req.body ?? {};

    if (typeof title !== 'string' || !title.trim()) {
      throw new ApiError(400, 'title is required');
    }
    if (typeof description !== 'string' || !description.trim()) {
      throw new ApiError(400, 'description is required');
    }
    if (!isBreachSeverity(severity)) {
      throw new ApiError(400, `severity must be one of ${Object.values(BreachSeverity).join(', ')}`);
    }

    const categories = parseStringArray(dataCategories, 'dataCategories');
    if (categories.length === 0) {
      throw new ApiError(400, 'At least one data category is required');
    }
    const invalidCategory = categories.find((category) => !isDataCategory(category));
    if (invalidCategory) {
      throw new ApiError(400, `Unknown data category: ${invalidCategory}`);
    }

    const breach = await breachNotificationService.reportBreach({
      title: title.trim(),
      description: description.trim(),
      // Attribution matters in the regulator's report, and an admin filing on
      // behalf of an automated detector is still the accountable human.
      detectedBy: req.user!.id,
      severity,
      dataCategories: categories as DataCategory[],
      affectedRecords: affectedRecords === undefined ? undefined : Number(affectedRecords),
      affectedUsers: affectedUsers === undefined ? undefined : Number(affectedUsers),
      occurredAt: parseDate(req.body?.occurredAt, 'occurredAt'),
    });

    logger.warn('Data breach recorded', {
      breachId: breach.id,
      severity: breach.severity,
      notificationRequired: breach.notificationRequired,
      adminId: req.user?.id,
    });

    res.status(201).json(withDeadline(breach));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /admin/breaches/deadlines
 * The 72-hour monitor: every breach still owing a regulator notification,
 * soonest deadline first. Declared before /breaches/:id so that "deadlines" is
 * not read as an id.
 */
router.get('/breaches/deadlines', ...adminOnly, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const pending = await breachNotificationService.getBreachesRequiringNotification();
    const now = Date.now();

    const breaches = pending
      .map((breach) => withDeadline(breach, now))
      .sort(
        (a, b) =>
          new Date(a.notificationDeadline.deadlineAt).getTime() -
          new Date(b.notificationDeadline.deadlineAt).getTime()
      );

    res.json({
      breaches,
      summary: {
        awaitingNotification: breaches.length,
        overdue: breaches.filter((b) => b.notificationDeadline.state === 'OVERDUE').length,
        dueWithin24Hours: breaches.filter((b) => b.notificationDeadline.state === 'DUE_SOON').length,
      },
      deadlineHours: NOTIFICATION_DEADLINE_MS / (1000 * 60 * 60),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /admin/breaches
 * Breach register for the audit dashboard
 */
router.get('/breaches', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status, severity } = req.query;

    if (status && !isBreachStatus(status)) {
      throw new ApiError(400, `status must be one of ${Object.values(BreachStatus).join(', ')}`);
    }
    if (severity && !isBreachSeverity(severity)) {
      throw new ApiError(400, `severity must be one of ${Object.values(BreachSeverity).join(', ')}`);
    }

    const all = await breachNotificationService.getAllBreaches({
      status: status as BreachStatus | undefined,
      severity: severity as BreachSeverity | undefined,
      startDate: parseDate(req.query.startDate, 'startDate'),
      endDate: parseDate(req.query.endDate, 'endDate'),
    });

    const now = Date.now();
    const breaches = all.map((breach) => withDeadline(breach, now));

    res.json({
      breaches,
      summary: {
        total: breaches.length,
        overdue: breaches.filter((b) => b.notificationDeadline.state === 'OVERDUE').length,
        dueWithin24Hours: breaches.filter((b) => b.notificationDeadline.state === 'DUE_SOON').length,
        notifiedLate: breaches.filter((b) => b.notificationDeadline.state === 'MISSED').length,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /admin/breaches/:id
 * Full compliance record: the breach, its timeline and its Article 33 position
 */
router.get('/breaches/:id', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const breach = await prisma.dataBreach.findUnique({ where: { id: req.params.id } });
    if (!breach) {
      throw new ApiError(404, 'Breach not found');
    }

    const report = await breachNotificationService.generateBreachReport(req.params.id);
    res.json({ ...report, notificationDeadline: resolveDeadline(breach) });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /admin/breaches/:id
 * Record containment, remediation and root cause as the investigation runs
 */
router.patch('/breaches/:id', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status, containmentActions, remediationActions, rootCause } = req.body ?? {};

    if (status !== undefined && !isBreachStatus(status)) {
      throw new ApiError(400, `status must be one of ${Object.values(BreachStatus).join(', ')}`);
    }
    // The regulator is notified through its own endpoint, which stamps the time
    // it happened. Letting an operator set NOTIFIED here would record a
    // notification that never left the building.
    if (status === BreachStatus.NOTIFIED) {
      throw new ApiError(400, 'Use POST /admin/breaches/:id/notify-regulator to record a notification');
    }

    const breach = await prisma.dataBreach.findUnique({ where: { id: req.params.id } });
    if (!breach) {
      throw new ApiError(404, 'Breach not found');
    }

    const updated = await breachNotificationService.updateBreachStatus(req.params.id, {
      status: status as BreachStatus | undefined,
      containmentActions:
        containmentActions === undefined
          ? undefined
          : parseStringArray(containmentActions, 'containmentActions'),
      remediationActions:
        remediationActions === undefined
          ? undefined
          : parseStringArray(remediationActions, 'remediationActions'),
      rootCause: rootCause === undefined ? undefined : String(rootCause),
    });

    res.json(withDeadline(updated));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /admin/breaches/:id/notify-regulator
 * Discharge the Article 33 duty and record when it was discharged
 */
router.post(
  '/breaches/:id/notify-regulator',
  ...adminOnly,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { regulatorName, regulatorEmail, notificationContent } = req.body ?? {};

      if (typeof regulatorName !== 'string' || !regulatorName.trim()) {
        throw new ApiError(400, 'regulatorName is required');
      }
      if (typeof regulatorEmail !== 'string' || !regulatorEmail.includes('@')) {
        throw new ApiError(400, 'A valid regulatorEmail is required');
      }
      if (typeof notificationContent !== 'string' || !notificationContent.trim()) {
        throw new ApiError(400, 'notificationContent is required');
      }

      const breach = await prisma.dataBreach.findUnique({ where: { id: req.params.id } });
      if (!breach) {
        throw new ApiError(404, 'Breach not found');
      }
      if (breach.regulatorNotifiedAt) {
        throw new ApiError(409, 'This breach has already been notified to a regulator');
      }

      const updated = await breachNotificationService.notifyRegulator({
        breachId: req.params.id,
        regulatorName: regulatorName.trim(),
        regulatorEmail: regulatorEmail.trim(),
        notificationContent: notificationContent.trim(),
      });

      logger.warn('Regulator notified of data breach', {
        breachId: req.params.id,
        regulator: regulatorName.trim(),
        adminId: req.user?.id,
      });

      res.json(withDeadline(updated));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /admin/breaches/:id/notify-users
 * Article 34 notification. The breach record holds only a count of affected
 * users, never their ids, so the ids to notify have to be supplied.
 */
router.post(
  '/breaches/:id/notify-users',
  ...adminOnly,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { notificationContent } = req.body ?? {};
      const userIds = parseStringArray(req.body?.userIds, 'userIds');

      if (userIds.length === 0) {
        throw new ApiError(400, 'userIds is required');
      }
      if (typeof notificationContent !== 'string' || !notificationContent.trim()) {
        throw new ApiError(400, 'notificationContent is required');
      }

      const breach = await prisma.dataBreach.findUnique({ where: { id: req.params.id } });
      if (!breach) {
        throw new ApiError(404, 'Breach not found');
      }

      await breachNotificationService.notifyAffectedUsers(
        req.params.id,
        userIds,
        notificationContent.trim()
      );

      res.json({ success: true, requested: userIds.length });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// LEGAL HOLDS
// ============================================================================

// The retention purge and the erasure worker both test membership of this set
// with exact lowercase strings, so a hold recorded as "Messages" would quietly
// protect nothing. Everything is normalised on the way in.
const KNOWN_HELD_DATA_TYPES = ['messages', 'analytics'];

/**
 * POST /admin/legal-holds
 * Suspend erasure and retention purges for named accounts or data types
 */
router.post('/legal-holds', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, reason, caseReference } = req.body ?? {};

    if (typeof name !== 'string' || !name.trim()) {
      throw new ApiError(400, 'name is required');
    }
    if (typeof reason !== 'string' || !reason.trim()) {
      throw new ApiError(400, 'reason is required');
    }

    const affectedUserIds = Array.from(
      new Set(parseStringArray(req.body?.affectedUserIds, 'affectedUserIds'))
    );
    const affectedDataTypes = Array.from(
      new Set(
        parseStringArray(req.body?.affectedDataTypes, 'affectedDataTypes').map((type) =>
          type.toLowerCase()
        )
      )
    );

    if (affectedUserIds.length === 0 && affectedDataTypes.length === 0) {
      throw new ApiError(400, 'A hold must name at least one user or one data type');
    }

    // A hold placed on an id that does not exist looks like protection and is
    // not, which is the worst failure mode a litigation hold has.
    if (affectedUserIds.length > 0) {
      const found = await prisma.user.findMany({
        where: { id: { in: affectedUserIds } },
        select: { id: true },
      });
      const known = new Set(found.map((user) => user.id));
      const unknown = affectedUserIds.filter((id) => !known.has(id));
      if (unknown.length > 0) {
        throw new ApiError(400, `Unknown user ids: ${unknown.join(', ')}`);
      }
    }

    const endDate = parseDate(req.body?.endDate, 'endDate');

    const hold = await prisma.legalHold.create({
      data: {
        name: name.trim(),
        reason: reason.trim(),
        caseReference:
          typeof caseReference === 'string' && caseReference.trim() ? caseReference.trim() : null,
        affectedUserIds,
        affectedDataTypes,
        endDate,
        authorizedBy: req.user!.id,
      },
    });

    await prisma.privacyAuditLog.create({
      data: {
        adminId: req.user!.id,
        action: 'LEGAL_HOLD_CREATED',
        resourceType: 'LegalHold',
        resourceId: hold.id,
        details: {
          name: hold.name,
          caseReference: hold.caseReference,
          affectedUserCount: affectedUserIds.length,
          affectedDataTypes,
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || undefined,
      },
    });

    logger.warn('Legal hold placed', {
      holdId: hold.id,
      affectedUserCount: affectedUserIds.length,
      adminId: req.user?.id,
    });

    res.status(201).json({
      ...hold,
      // Named so the operator finds out now, not at the next purge run, that a
      // data type they typed is not one any purge job checks.
      unrecognisedDataTypes: affectedDataTypes.filter(
        (type) => !KNOWN_HELD_DATA_TYPES.includes(type)
      ),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /admin/legal-holds
 * List holds. Holds whose end date has passed are flagged rather than
 * auto-released: lifting a hold is a decision, not a timeout.
 */
router.get('/legal-holds', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parsePage(req.query.page);
    const limit = parseLimit(req.query.limit);
    const { active } = req.query;

    const where: Record<string, unknown> = {};
    if (active === 'true') where.isActive = true;
    else if (active === 'false') where.isActive = false;

    const [holds, total, activeCount] = await Promise.all([
      prisma.legalHold.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.legalHold.count({ where }),
      prisma.legalHold.count({ where: { isActive: true } }),
    ]);

    const now = Date.now();

    res.json({
      holds: holds.map((hold) => ({
        ...hold,
        expired: Boolean(hold.isActive && hold.endDate && new Date(hold.endDate).getTime() < now),
      })),
      activeCount,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /admin/legal-holds/:id
 */
router.get('/legal-holds/:id', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const hold = await prisma.legalHold.findUnique({ where: { id: req.params.id } });
    if (!hold) {
      throw new ApiError(404, 'Legal hold not found');
    }
    res.json(hold);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /admin/legal-holds/:id/release
 * Lift a hold so erasure and purges resume for the accounts it covered
 */
router.post(
  '/legal-holds/:id/release',
  ...adminOnly,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { releaseReason } = req.body ?? {};

      // Releasing a hold makes previously blocked deletions possible again, so
      // the record has to say on whose authority and why.
      if (typeof releaseReason !== 'string' || !releaseReason.trim()) {
        throw new ApiError(400, 'releaseReason is required');
      }

      const hold = await prisma.legalHold.findUnique({ where: { id: req.params.id } });
      if (!hold) {
        throw new ApiError(404, 'Legal hold not found');
      }
      if (!hold.isActive) {
        throw new ApiError(409, 'Legal hold has already been released');
      }

      const released = await prisma.legalHold.update({
        where: { id: req.params.id },
        data: {
          isActive: false,
          releasedBy: req.user!.id,
          releasedAt: new Date(),
          releaseReason: releaseReason.trim(),
        },
      });

      await prisma.privacyAuditLog.create({
        data: {
          adminId: req.user!.id,
          action: 'LEGAL_HOLD_RELEASED',
          resourceType: 'LegalHold',
          resourceId: hold.id,
          details: {
            name: hold.name,
            caseReference: hold.caseReference,
            releaseReason: releaseReason.trim(),
            affectedUserCount: hold.affectedUserIds.length,
          },
          ipAddress: req.ip,
          userAgent: req.get('user-agent') || undefined,
        },
      });

      logger.warn('Legal hold released', { holdId: hold.id, adminId: req.user?.id });

      res.json(released);
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// MAINTENANCE MODE
// ============================================================================

/**
 * GET /admin/maintenance
 * Current state, read past the request-gate cache so an operator who just
 * toggled it is never shown a stale answer.
 */
router.get('/maintenance', ...adminOnly, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    res.json(await getMaintenanceState({ fresh: true }));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /admin/maintenance
 * Open or close the platform. Called by the launch runbook and by the rollback
 * procedure, both of which post { enabled, message }.
 */
router.post('/maintenance', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { enabled, message } = req.body ?? {};

    if (typeof enabled !== 'boolean') {
      throw new ApiError(400, 'enabled must be a boolean');
    }
    if (message !== undefined && typeof message !== 'string') {
      throw new ApiError(400, 'message must be a string');
    }

    const state = await setMaintenanceState({
      enabled,
      message,
      endsAt: parseDate(req.body?.endsAt, 'endsAt') ?? null,
      actorId: req.user!.id,
    });

    // Logged at warn deliberately: taking the platform down, or bringing it
    // back, is the single most important line in an incident timeline.
    logger.warn(`Maintenance mode ${enabled ? 'ENABLED' : 'DISABLED'}`, {
      adminId: req.user?.id,
      message: state.message,
      endsAt: state.endsAt,
    });

    res.json(state);
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// AUTHORITY ESCALATION QUEUE
// ============================================================================

const isEscalationStatus = (value: unknown): value is EscalationStatus =>
  ESCALATION_STATUSES.includes(value as EscalationStatus);

/**
 * GET /admin/moderation/escalations
 * Referrals to IWF / CTIRU that a person still has to file or close out
 */
router.get(
  '/moderation/escalations',
  ...adminOnly,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { status } = req.query;
      if (status && !isEscalationStatus(status)) {
        throw new ApiError(400, `status must be one of ${ESCALATION_STATUSES.join(', ')}`);
      }

      const result = await listAuthorityEscalations({
        status: status as EscalationStatus | undefined,
        reportedTo: req.query.reportedTo ? String(req.query.reportedTo) : undefined,
        reason: req.query.reason ? String(req.query.reason) : undefined,
        page: parsePage(req.query.page),
        limit: parseLimit(req.query.limit),
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /admin/moderation/escalations/:id
 * One referral with the report behind it and everything logged against it
 */
router.get(
  '/moderation/escalations/:id',
  ...adminOnly,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const escalation = await getAuthorityEscalation(req.params.id);
      if (!escalation) {
        throw new ApiError(404, 'Escalation not found');
      }
      res.json(escalation);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /admin/moderation/escalations/:id
 * Advance a referral once the authority has receipted or closed it
 */
router.patch(
  '/moderation/escalations/:id',
  ...adminOnly,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { status, referenceNumber, notes } = req.body ?? {};

      if (status !== undefined && !isEscalationStatus(status)) {
        throw new ApiError(400, `status must be one of ${ESCALATION_STATUSES.join(', ')}`);
      }
      if (status === undefined && referenceNumber === undefined) {
        throw new ApiError(400, 'Provide a status or a referenceNumber to record');
      }
      if (
        referenceNumber !== undefined &&
        (typeof referenceNumber !== 'string' || !referenceNumber.trim())
      ) {
        throw new ApiError(400, 'referenceNumber must be a non-empty string');
      }

      const { escalation, previousStatus } = await updateAuthorityEscalationStatus(req.params.id, {
        status: status as EscalationStatus | undefined,
        referenceNumber: referenceNumber === undefined ? undefined : String(referenceNumber).trim(),
        notes: typeof notes === 'string' ? notes : undefined,
        moderatorId: req.user!.id,
      });

      res.json({ escalation, previousStatus });
    } catch (error) {
      // The service owns the lifecycle rules; a rejected transition is the
      // caller's mistake rather than a server fault, so it is re-typed here.
      if (error instanceof Error && !(error instanceof ApiError)) {
        if (error.message === 'Escalation not found') {
          return next(new ApiError(404, error.message));
        }
        if (
          error.message.startsWith('Cannot move escalation') ||
          error.message.includes('reference number is required')
        ) {
          return next(new ApiError(409, error.message));
        }
      }
      next(error);
    }
  }
);

// ============================================================================
// OPERATIONS SUMMARY
// ============================================================================

/**
 * GET /admin/ops/summary
 * One call for the four things an operator has to know before they touch
 * anything: is the platform open, is a breach deadline running out, is deletion
 * suspended anywhere, and is a referral to an authority still unfiled.
 */
router.get('/ops/summary', ...adminOnly, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [pendingBreaches, activeLegalHolds, unfiledReferrals, maintenance] = await Promise.all([
      breachNotificationService.getBreachesRequiringNotification(),
      prisma.legalHold.count({ where: { isActive: true } }),
      prisma.authorityEscalation.count({ where: { status: 'reported' } }),
      getMaintenanceState({ fresh: true }),
    ]);

    const now = Date.now();
    const deadlines = pendingBreaches
      .map((breach) => resolveDeadline(breach, now))
      .sort((a, b) => new Date(a.deadlineAt).getTime() - new Date(b.deadlineAt).getTime());

    res.json({
      maintenance,
      breaches: {
        awaitingNotification: deadlines.length,
        overdue: deadlines.filter((d) => d.state === 'OVERDUE').length,
        dueWithin24Hours: deadlines.filter((d) => d.state === 'DUE_SOON').length,
        nextDeadlineAt: deadlines[0]?.deadlineAt ?? null,
      },
      legalHolds: { active: activeLegalHolds },
      authorityEscalations: { awaitingFiling: unfiledReferrals },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
