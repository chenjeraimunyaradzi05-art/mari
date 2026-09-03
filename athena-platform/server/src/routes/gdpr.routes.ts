/**
 * GDPR & Privacy Routes
 * Handles DSAR requests, consent management, and privacy controls
 * Phase 4: UK/EU Market Launch
 */

import { Router, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { randomUUID } from 'crypto';
import { gdprService } from '../services/gdpr.service';
import {
  consentService,
  CookiePreferences,
  RestrictableProcessing,
  RESTRICTABLE_PROCESSING_TYPES,
} from '../services/consent.service';
import { authenticate, optionalAuth, requireRole, AuthRequest } from '../middleware/auth';
import {
  gdprRegionMiddleware,
  gdprResponseHeaders,
  anonymizeIP,
  auditDataAccess,
  auditIpAddress,
  dataMinimization,
  dsarRateLimit,
} from '../middleware/gdpr.middleware';
import { ApiError } from '../middleware/errorHandler';
import { prisma } from '../utils/prisma';
import { logAudit } from '../utils/audit';
import { parsePagination, buildPaginationMeta } from '../utils/pagination';
import { AuditAction, DataCategory, DSARType, ConsentType, LegalBasis, Prisma } from '@prisma/client';
import { logger } from '../utils/logger';

const router = Router();

// Region detection has to run before anonymizeIP, which only truncates inside
// the GDPR footprint, and before any consent gate that asks whether consent is
// even the basis here.
router.use(gdprRegionMiddleware);
router.use(anonymizeIP);
router.use(gdprResponseHeaders);

/**
 * What a DSAR request row shows its own subject. `assignedTo`, `processingNotes`
 * and `auditLogId` are how the platform handles the request internally, not
 * information about the member, so they stay out of the answer.
 */
const DSAR_SUBJECT_FIELDS = [
  'id',
  'type',
  'status',
  'requestDetails',
  'identityVerified',
  'exportUrl',
  'exportExpiresAt',
  'requestedAt',
  'acknowledgedAt',
  'dueDate',
  'completedAt',
  'createdAt',
  'updatedAt',
];

// One quota per right rather than one across all of them: a member fixing a
// misspelt surname should not thereby lose the ability to download their data.
const exportRateLimit = dsarRateLimit(5, 60 * 60 * 1000, 'dsar-export');
const erasureRateLimit = dsarRateLimit(5, 60 * 60 * 1000, 'dsar-erasure');
const rectifyRateLimit = dsarRateLimit(10, 60 * 60 * 1000, 'dsar-rectify');
const restrictRateLimit = dsarRateLimit(10, 60 * 60 * 1000, 'dsar-restrict');

const VISITOR_COOKIE = 'athena_visitor_id';
const VISITOR_COOKIE_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

const NO_COOKIE_PREFERENCES: CookiePreferences = {
  analytics: false,
  marketing: false,
  functional: false,
};

function consentContext(req: AuthRequest) {
  return {
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    region: (req.headers['cf-ipcountry'] as string) || 'UNKNOWN',
  };
}

/**
 * Cookie consent has to be filed against something before anyone has an
 * account, so the server issues a visitor id and keeps it in a first-party
 * cookie. Once the visitor signs in the same id carries their member id too.
 */
function resolveVisitorId(req: AuthRequest, submitted?: unknown): string {
  if (typeof submitted === 'string' && submitted.trim()) return submitted.trim();

  const stored = req.cookies?.[VISITOR_COOKIE];
  if (typeof stored === 'string' && stored.trim()) return stored.trim();

  return randomUUID();
}

function rememberVisitor(res: Response, visitorId: string): void {
  // Readable by the banner script, which needs to know whether to open.
  res.cookie(VISITOR_COOKIE, visitorId, {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: VISITOR_COOKIE_MAX_AGE_MS,
    path: '/',
  });
}

/**
 * A signed-in member's recorded consent outranks the visitor row: the record is
 * what the platform is held to, the cookie only remembers what the browser was
 * last told.
 */
async function resolveCookiePreferences(
  visitorId: string,
  userId?: string
): Promise<{ preferences: CookiePreferences; hasConsented: boolean; consentedAt: Date | null }> {
  const stored = await gdprService.getCookieConsent(visitorId);
  const recorded = userId ? await consentService.getCookiePreferences(userId) : null;

  const claimed =
    recorded ||
    (stored
      ? {
          analytics: stored.analytics,
          marketing: stored.marketing,
          functional: stored.functional,
        }
      : NO_COOKIE_PREFERENCES);

  // getCookiePreferences already applies restrictions; the visitor row does not
  // know about them, so a member falling back to it gets them applied here.
  const preferences =
    userId && !recorded ? await consentService.applyRestrictions(userId, claimed) : claimed;

  return {
    preferences,
    hasConsented: Boolean(stored) || Boolean(recorded),
    consentedAt: stored?.consentedAt ?? null,
  };
}

// ============================================
// Cookie Consent Endpoints
// Public by necessity: a visitor has to be able to accept or refuse cookies
// before they have an account, so these sit ahead of the authenticate gate.
// ============================================

/**
 * GET /api/gdpr/cookies
 * Cookie preferences for the calling browser
 */
router.get('/cookies', optionalAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const visitorId = resolveVisitorId(req);
    const { preferences, hasConsented, consentedAt } = await resolveCookiePreferences(
      visitorId,
      req.user?.id
    );

    rememberVisitor(res, visitorId);

    res.json({
      success: true,
      data: { visitorId, essential: true, ...preferences, hasConsented, consentedAt },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/gdpr/cookies/:visitorId
 * Get cookie preferences for visitor
 */
router.get('/cookies/:visitorId', optionalAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { visitorId } = req.params;
    const { preferences, hasConsented, consentedAt } = await resolveCookiePreferences(
      visitorId,
      req.user?.id
    );

    res.json({
      success: true,
      data: { visitorId, essential: true, ...preferences, hasConsented, consentedAt },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/gdpr/cookies
 * Record cookie consent
 */
router.post('/cookies', optionalAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { visitorId: submittedVisitorId, analytics, marketing, functional } = req.body;
    const visitorId = resolveVisitorId(req, submittedVisitorId);

    const preferences: CookiePreferences = {
      analytics: analytics === true,
      marketing: marketing === true,
      functional: functional === true,
    };

    const consent = await gdprService.recordCookieConsent(visitorId, preferences, {
      userId: req.user?.id,
      ...consentContext(req),
    });

    rememberVisitor(res, visitorId);

    // Answer with the stored row, not the submitted body: an Article 18
    // restriction can have overruled a category, and the banner has to be told
    // what the platform will actually do.
    res.json({
      success: true,
      data: {
        visitorId,
        essential: true,
        analytics: consent.analytics,
        marketing: consent.marketing,
        functional: consent.functional,
        hasConsented: true,
        consentedAt: consent.consentedAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// Privacy Information Endpoints
// Transparency material, so no account required to read it.
// ============================================

/**
 * GET /api/gdpr/data-categories
 * Get data categories we process (for transparency)
 */
router.get('/data-categories', async (_req: AuthRequest, res: Response) => {
  const categories = gdprService.getDataClassification();
  res.json({ success: true, data: categories });
});

/**
 * GET /api/gdpr/retention-policies
 * Get data retention policies (for transparency)
 *
 * Served from the RetentionPolicy table, which is what the purge jobs actually
 * run on. An empty table means nothing has been committed to yet, and saying so
 * is honest; publishing a list the purge jobs have never seen would not be.
 */
router.get('/retention-policies', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const policies = await gdprService.getRetentionPolicies();
    res.json({ success: true, data: policies });
  } catch (error) {
    next(error);
  }
});

// Everything below concerns one member's own record.
router.use(authenticate);

// ============================================
// DSAR (Data Subject Access Request) Endpoints
// ============================================

/**
 * GET /api/gdpr/dsar
 * Get user's DSAR request history
 */
router.get(
  '/dsar',
  auditDataAccess('dsar_requests'),
  dataMinimization(DSAR_SUBJECT_FIELDS),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const requests = await gdprService.getDSARRequests(userId);
      res.json({ success: true, data: requests });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/gdpr/dsar/restrictions
 * The processing this member has frozen under Article 18.
 *
 * Declared ahead of /dsar/:requestId, which would otherwise swallow it.
 */
router.get(
  '/dsar/restrictions',
  auditDataAccess('processing_restrictions'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const restrictions = await gdprService.getActiveRestrictions(req.user!.id);
      res.json({
        success: true,
        data: {
          restrictions,
          // What can be asked for, so the client does not have to hardcode a
          // list that would drift from what the server enforces.
          restrictable: RESTRICTABLE_PROCESSING_TYPES,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/gdpr/dsar/:requestId
 * Status of one DSAR request.
 *
 * Two segments, so this never shadows GET /dsar above, and the sibling
 * /dsar/export|delete|rectify|restrict routes are POSTs.
 */
router.get(
  '/dsar/:requestId',
  auditDataAccess('dsar_requests'),
  dataMinimization(DSAR_SUBJECT_FIELDS),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const request = await gdprService.getDSARRequest(req.params.requestId);

      // getDSARRequest looks up by id alone, so ownership is enforced here. A
      // request belonging to someone else is reported as absent rather than
      // forbidden — confirming it exists would itself leak information about
      // another data subject.
      if (!request || request.userId !== req.user!.id) {
        throw new ApiError(404, 'DSAR request not found');
      }

      res.json({ success: true, data: request });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/gdpr/dsar/export
 * Request data export (Right of Access)
 */
router.post('/dsar/export', exportRateLimit, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;

    const dsar = await gdprService.createDSARRequest({
      userId,
      type: DSARType.EXPORT,
      requestDetails: 'User-initiated data export request',
    });

    const result = await gdprService.processExportRequest(dsar.id);

    // The compliance dashboard counts DSARs off AuditLog, so a request handled
    // without a row here is a request the platform cannot show it handled.
    await logAudit({
      action: AuditAction.DSAR_EXPORT,
      actorUserId: userId,
      targetUserId: userId,
      ipAddress: auditIpAddress(req),
      userAgent: req.get('user-agent') || null,
      metadata: {
        requestId: result.requestId,
        sections: result.data.metadata.sections,
        expiresAt: result.expiresAt.toISOString(),
      },
    });

    res.json({
      success: true,
      message: 'Your data export is ready to download.',
      data: {
        requestId: result.requestId,
        status: 'COMPLETED',
        downloadUrl: result.downloadUrl,
        expiresAt: result.expiresAt,
        sections: result.data.metadata.sections,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/gdpr/dsar/delete
 * Request account deletion (Right to be Forgotten)
 */
router.post('/dsar/delete', erasureRateLimit, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { confirmation, reason } = req.body;

    if (confirmation !== 'DELETE_MY_ACCOUNT') {
      return res.status(400).json({
        success: false,
        error: 'Please confirm deletion by providing confirmation: "DELETE_MY_ACCOUNT"',
      });
    }

    const dsar = await gdprService.createDSARRequest({
      userId,
      type: DSARType.DELETION,
      requestDetails: reason || 'User-initiated account deletion',
    });

    // Carried out here and now. Telling somebody their account is gone and then
    // leaving the row in place is the failure this route used to have.
    const outcome = await gdprService.processDeletionRequest(dsar.id);

    if (outcome.status === 'REJECTED') {
      return res.status(409).json({
        success: false,
        error: outcome.reason || 'Deletion cannot be carried out at this time',
        data: { requestId: outcome.requestId, status: 'REJECTED' },
      });
    }

    // Written after the erasure, so it only ever claims what actually happened.
    // The subject id is left off: when the account row is gone there is nothing
    // for the foreign key to point at, and when it survives as a tombstone,
    // naming the member on a row about erasing them defeats the exercise. The
    // address is left off for the same reason — this row exists to show a
    // regulator the request was handled, not to keep the member on file.
    await logAudit({
      action: AuditAction.ACCOUNT_DELETE,
      metadata: {
        requestId: outcome.requestId,
        accountRemoved: outcome.accountRemoved,
        retainedSections: outcome.retainedSections,
        rowsRemoved: outcome.rowsRemoved,
        completedAt: new Date().toISOString(),
      },
    });

    logger.info('Account erasure carried out', {
      requestId: outcome.requestId,
      accountRemoved: outcome.accountRemoved,
    });

    res.json({
      success: true,
      message: outcome.accountRemoved
        ? 'Your account and personal data have been deleted.'
        : 'Your personal data has been erased. Records we are legally required to keep are held without anything that identifies you.',
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
});

/**
 * POST /api/gdpr/dsar/rectify
 * Request data correction (Right to Rectification)
 */
router.post('/dsar/rectify', rectifyRateLimit, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { corrections } = req.body;

    if (!corrections || Object.keys(corrections).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Please provide corrections object with fields to update',
      });
    }

    const dsar = await gdprService.createDSARRequest({
      userId,
      type: DSARType.RECTIFICATION,
      requestDetails: JSON.stringify(corrections),
    });

    await gdprService.processRectificationRequest(dsar.id, corrections);

    // DATA_ACCESS is the only value AuditAction carries for a data-subject right
    // other than export and erasure; the metadata says which right it was.
    await logAudit({
      action: AuditAction.DATA_ACCESS,
      actorUserId: userId,
      targetUserId: userId,
      ipAddress: auditIpAddress(req),
      userAgent: req.get('user-agent') || null,
      metadata: {
        resourceType: 'DSARRequest',
        resourceId: dsar.id,
        dsarType: DSARType.RECTIFICATION,
        // The values themselves are already in the DSAR row and the privacy
        // audit trail; only the field names belong in a system-wide log.
        fields: Object.keys(corrections),
      },
    });

    res.json({
      success: true,
      message: 'Your data has been corrected.',
      data: { requestId: dsar.id },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/gdpr/dsar/restrict
 * Request processing restriction (Right to Restriction)
 *
 * Applied on the spot rather than queued: a restriction that is only recorded
 * as "will be processed" restricts nothing, which is what this route used to do.
 */
router.post('/dsar/restrict', restrictRateLimit, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { processingTypes, reason } = req.body;

    if (!Array.isArray(processingTypes) || processingTypes.length === 0) {
      return res.status(400).json({
        success: false,
        error: `Please name the processing to restrict: ${RESTRICTABLE_PROCESSING_TYPES.join(', ')}`,
      });
    }

    // Accepting a category we cannot switch off would be a promise on a screen
    // with nothing behind it, so an unknown one is refused rather than stored.
    const unknown = processingTypes.filter((type) => !consentService.isRestrictableProcessing(type));
    if (unknown.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot restrict ${unknown.join(', ')}. Restrictable processing: ${RESTRICTABLE_PROCESSING_TYPES.join(', ')}`,
      });
    }

    if (reason !== undefined && typeof reason !== 'string') {
      return res.status(400).json({ success: false, error: 'Reason must be text' });
    }

    const requested = [...new Set(processingTypes as RestrictableProcessing[])];

    const dsar = await gdprService.createDSARRequest({
      userId,
      type: DSARType.RESTRICTION,
      requestDetails: JSON.stringify({ processingTypes: requested, reason }),
    });

    const applied = await gdprService.applyProcessingRestriction(dsar.id, requested);

    await logAudit({
      action: AuditAction.DATA_ACCESS,
      actorUserId: userId,
      targetUserId: userId,
      ipAddress: auditIpAddress(req),
      userAgent: req.get('user-agent') || null,
      metadata: {
        resourceType: 'DSARRequest',
        resourceId: dsar.id,
        dsarType: DSARType.RESTRICTION,
        processingTypes: requested,
      },
    });

    res.json({
      success: true,
      message: 'Processing has been restricted. It stays restricted until you lift it.',
      data: {
        requestId: applied.requestId,
        status: 'COMPLETED',
        processingTypes: applied.processingTypes,
        appliedAt: applied.appliedAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/gdpr/dsar/restrict/:requestId
 * Lift a restriction (Article 18(3))
 *
 * Article 18(3) says the data subject must be told before a restriction is
 * lifted. When they are the one asking, the request itself satisfies that.
 */
router.delete('/dsar/restrict/:requestId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const lifted = await gdprService.liftProcessingRestriction(req.params.requestId, req.user!.id);

    // Same reasoning as the DSAR status route: somebody else's restriction is
    // reported as absent rather than forbidden.
    if (!lifted) {
      throw new ApiError(404, 'Active restriction not found');
    }

    await logAudit({
      action: AuditAction.DATA_ACCESS,
      actorUserId: req.user!.id,
      targetUserId: req.user!.id,
      ipAddress: auditIpAddress(req),
      userAgent: req.get('user-agent') || null,
      metadata: {
        resourceType: 'DSARRequest',
        resourceId: lifted.requestId,
        dsarType: DSARType.RESTRICTION,
        action: 'LIFTED',
        processingTypes: lifted.processingTypes,
      },
    });

    res.json({
      success: true,
      message: 'The restriction has been lifted. Your saved consent choices apply again.',
      data: {
        requestId: lifted.requestId,
        processingTypes: lifted.processingTypes,
        liftedAt: lifted.liftedAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/gdpr/download/:token
 * Download exported data.
 *
 * Keyed on the token minted with the export, never on the request id, so
 * knowing somebody's DSAR id gets you nothing.
 */
router.get('/download/:token', auditDataAccess('data_export'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await gdprService.getExportDownload(req.params.token, req.user!.id);

    if (result.status === 'EXPIRED') {
      return res.status(410).json({ success: false, error: 'Download link has expired' });
    }

    if (result.status === 'NOT_FOUND') {
      return res.status(404).json({ success: false, error: 'Export not found' });
    }

    // Sensitive payload: never let it sit in a shared or browser cache.
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="athena-data-export-${result.requestId}.json"`
    );
    res.json(result.data);
  } catch (error) {
    next(error);
  }
});

// ============================================
// Consent Management Endpoints
// ============================================

/**
 * GET /api/gdpr/consents
 * Get all user consents
 */
router.get('/consents', auditDataAccess('consent_records'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const [consents, frozen] = await Promise.all([
      gdprService.getUserConsents(userId),
      consentService.getRestrictedConsentTypes(userId),
    ]);

    // Return structured consent state. A consent frozen under Article 18 reads
    // as false here because false is what the platform will act on.
    const consentState: Record<string, boolean> = {};
    for (const consent of consents) {
      consentState[consent.consentType] =
        consent.status === 'GRANTED' && !frozen.has(consent.consentType);
    }

    res.json({ success: true, data: consentState });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/gdpr/consents/detail
 * Grouped consent state with descriptions, for the Privacy Centre
 */
router.get('/consents/detail', auditDataAccess('consent_records'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const state = await consentService.getConsentState(req.user!.id);
    res.json({ success: true, data: state });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/gdpr/consents
 * Update user consents (bulk update)
 */
router.put('/consents', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { consents } = req.body;

    if (!Array.isArray(consents)) {
      return res.status(400).json({
        success: false,
        error: 'Consents must be an array of {type, granted} objects',
      });
    }

    const frozen = await consentService.getRestrictedConsentTypes(userId);

    for (const consent of consents) {
      if (!consentService.isKnownConsentType(consent?.type)) {
        return res.status(400).json({
          success: false,
          error: `Unknown consent type: ${consent?.type}`,
        });
      }

      if (typeof consent.granted !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: `Consent ${consent.type} needs granted: true or false`,
        });
      }

      if (!consent.granted && consentService.isRequiredConsent(consent.type)) {
        return res.status(409).json({
          success: false,
          error: `${consentService.describeConsent(consent.type).title} cannot be withdrawn while your account is open. Use the deletion request instead.`,
        });
      }

      if (consent.granted && frozen.has(consent.type)) {
        return res.status(409).json({
          success: false,
          error: `${consentService.describeConsent(consent.type).title} is restricted under your Article 18 request. Lift the restriction first.`,
          code: 'PROCESSING_RESTRICTED',
        });
      }
    }

    await gdprService.bulkUpdateConsents(userId, consents, consentContext(req));

    res.json({ success: true, message: 'Consents updated successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/gdpr/consents/optional
 * Withdraw every consent the service does not require ("reject all")
 */
router.delete('/consents/optional', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await consentService.withdrawAllOptionalConsents(req.user!.id, consentContext(req));
    res.json({ success: true, message: 'Optional consents withdrawn' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/gdpr/consents/:type
 * Update single consent
 */
router.post('/consents/:type', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const consentType = req.params.type;
    const { granted } = req.body;

    if (!consentService.isKnownConsentType(consentType)) {
      return res.status(400).json({
        success: false,
        error: `Unknown consent type: ${consentType}`,
      });
    }

    if (typeof granted !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'Please provide granted: true or false',
      });
    }

    if (!granted && consentService.isRequiredConsent(consentType)) {
      return res.status(409).json({
        success: false,
        error: `${consentService.describeConsent(consentType).title} cannot be withdrawn while your account is open. Use the deletion request instead.`,
      });
    }

    if (granted) {
      const frozen = await consentService.getRestrictedConsentTypes(userId);
      if (frozen.has(consentType)) {
        return res.status(409).json({
          success: false,
          error: `${consentService.describeConsent(consentType).title} is restricted under your Article 18 request. Lift the restriction first.`,
          code: 'PROCESSING_RESTRICTED',
        });
      }
    }

    const consent = await gdprService.recordConsent(
      userId,
      consentType as ConsentType,
      granted,
      consentContext(req)
    );

    res.json({ success: true, data: consent });
  } catch (error) {
    next(error);
  }
});

// ============================================
// Record of Processing Activities (Article 30) and DPIAs (Article 35)
//
// These describe the company, not any member, so they are staff records rather
// than data-subject ones and sit behind the admin role. They are also the first
// thing a regulator asks for, which is why the writes leave an audit trail.
// ============================================

const adminOnly = requireRole('ADMIN');

/** express-validator's first complaint, in the shape the rest of the file uses. */
function rejectInvalid(req: AuthRequest): void {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, errors.array()[0].msg);
  }
}

/** A list of non-empty strings, or absent. Absent and empty are not the same. */
const optionalStringList = (field: string) =>
  body(field)
    .optional()
    .isArray()
    .withMessage(`${field} must be a list`)
    .bail()
    .custom((values: unknown[]) => values.every((v) => typeof v === 'string' && v.trim().length > 0))
    .withMessage(`${field} must contain text entries`);

const optionalDataCategories = body('dataCategories')
  .optional()
  .isArray()
  .withMessage('dataCategories must be a list')
  .bail()
  .custom((values: unknown[]) => values.every((v) => typeof v === 'string' && v in DataCategory))
  .withMessage(`dataCategories must be drawn from: ${Object.keys(DataCategory).join(', ')}`);

const PROCESSING_ACTIVITY_LIST_FIELDS = [
  'dataSubjectCategories',
  'dataElements',
  'purposes',
  'recipients',
  'thirdCountryTransfers',
  'securityMeasures',
  'subprocessors',
] as const;

const PROCESSING_ACTIVITY_SCALAR_FIELDS = [
  'name',
  'description',
  'department',
  'legalBasis',
  'legalBasisDetails',
  'retentionPeriod',
  'retentionJustification',
  'transferSafeguards',
  'dpiaRequired',
  'dpiaId',
  'isActive',
] as const;

// DPIA.status and DPIA.residualRiskLevel are plain strings on the model; these
// are the values its own comments define, kept here so the API cannot store one
// the rest of the system would not recognise.
const DPIA_STATUSES = ['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED'];
const RESIDUAL_RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH'];

/**
 * The columns a RoPA write may set, taken off an already-validated body.
 *
 * A field the caller left out is left alone rather than written as empty, so a
 * PATCH that mentions one column cannot silently clear the other sixteen.
 */
function buildProcessingActivityData(
  body: Record<string, any>,
  { creating }: { creating: boolean }
): Record<string, unknown> {
  const data: Record<string, unknown> = {};

  for (const field of PROCESSING_ACTIVITY_SCALAR_FIELDS) {
    if (body[field] !== undefined) data[field] = body[field];
  }

  for (const field of [...PROCESSING_ACTIVITY_LIST_FIELDS, 'dataCategories'] as const) {
    if (body[field] !== undefined) data[field] = body[field];
    else if (creating) data[field] = [];
  }

  if (body.lastReviewDate) data.lastReviewDate = new Date(body.lastReviewDate);
  if (body.nextReviewDate) data.nextReviewDate = new Date(body.nextReviewDate);

  return data;
}

/**
 * GET /api/gdpr/ropa
 * The record of processing activities
 */
router.get('/ropa', adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = parsePagination(req.query as { page?: string; limit?: string });

    const where: Record<string, unknown> = {};
    if (typeof req.query.department === 'string') where.department = req.query.department;
    // Retired activities stay on the record, so they are only hidden on request.
    if (req.query.active === 'true') where.isActive = true;
    if (req.query.active === 'false') where.isActive = false;

    const [activities, total] = await Promise.all([
      prisma.processingActivity.findMany({
        where,
        orderBy: [{ department: 'asc' }, { name: 'asc' }],
        skip,
        take: limit,
      }),
      prisma.processingActivity.count({ where }),
    ]);

    res.json({
      success: true,
      data: activities,
      pagination: buildPaginationMeta(total, page, limit),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/gdpr/ropa/:id
 * One processing activity
 */
router.get('/ropa/:id', adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const activity = await prisma.processingActivity.findUnique({ where: { id: req.params.id } });
    if (!activity) throw new ApiError(404, 'Processing activity not found');

    res.json({ success: true, data: activity });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/gdpr/ropa
 * Record a processing activity
 */
router.post(
  '/ropa',
  adminOnly,
  [
    body('name').isString().trim().notEmpty().withMessage('Name is required'),
    body('description').isString().trim().notEmpty().withMessage('Description is required'),
    body('department').isString().trim().notEmpty().withMessage('Department is required'),
    body('legalBasis')
      .isIn(Object.keys(LegalBasis))
      .withMessage(`Legal basis must be one of: ${Object.keys(LegalBasis).join(', ')}`),
    body('retentionPeriod').isString().trim().notEmpty().withMessage('Retention period is required'),
    body('legalBasisDetails').optional().isString(),
    body('retentionJustification').optional().isString(),
    body('transferSafeguards').optional().isString(),
    body('dpiaRequired').optional().isBoolean(),
    body('dpiaId').optional().isString(),
    body('nextReviewDate').optional().isISO8601(),
    optionalDataCategories,
    ...PROCESSING_ACTIVITY_LIST_FIELDS.map(optionalStringList),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      rejectInvalid(req);

      // The cast is safe because every field was validated one by one above;
      // the builder returns a plain object so create and update can share it.
      const activity = await prisma.processingActivity.create({
        data: buildProcessingActivityData(req.body, {
          creating: true,
        }) as unknown as Prisma.ProcessingActivityUncheckedCreateInput,
      });

      await gdprService.recordComplianceChange({
        adminId: req.user!.id,
        action: 'ROPA_ACTIVITY_CREATED',
        resourceType: 'ProcessingActivity',
        resourceId: activity.id,
        newValue: { name: activity.name, department: activity.department },
        ipAddress: auditIpAddress(req) ?? undefined,
        userAgent: req.get('user-agent'),
      });

      res.status(201).json({ success: true, data: activity });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/gdpr/ropa/:id
 * Amend a recorded processing activity
 */
router.patch(
  '/ropa/:id',
  adminOnly,
  [
    body('name').optional().isString().trim().notEmpty(),
    body('description').optional().isString().trim().notEmpty(),
    body('department').optional().isString().trim().notEmpty(),
    body('legalBasis').optional().isIn(Object.keys(LegalBasis)),
    body('retentionPeriod').optional().isString().trim().notEmpty(),
    body('legalBasisDetails').optional().isString(),
    body('retentionJustification').optional().isString(),
    body('transferSafeguards').optional().isString(),
    body('dpiaRequired').optional().isBoolean(),
    body('dpiaId').optional().isString(),
    body('isActive').optional().isBoolean(),
    body('nextReviewDate').optional().isISO8601(),
    body('lastReviewDate').optional().isISO8601(),
    optionalDataCategories,
    ...PROCESSING_ACTIVITY_LIST_FIELDS.map(optionalStringList),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      rejectInvalid(req);

      const existing = await prisma.processingActivity.findUnique({ where: { id: req.params.id } });
      if (!existing) throw new ApiError(404, 'Processing activity not found');

      const activity = await prisma.processingActivity.update({
        where: { id: req.params.id },
        data: buildProcessingActivityData(req.body, {
          creating: false,
        }) as unknown as Prisma.ProcessingActivityUncheckedUpdateInput,
      });

      await gdprService.recordComplianceChange({
        adminId: req.user!.id,
        action: 'ROPA_ACTIVITY_UPDATED',
        resourceType: 'ProcessingActivity',
        resourceId: activity.id,
        previousValue: { name: existing.name, legalBasis: existing.legalBasis, isActive: existing.isActive },
        newValue: { name: activity.name, legalBasis: activity.legalBasis, isActive: activity.isActive },
        ipAddress: auditIpAddress(req) ?? undefined,
        userAgent: req.get('user-agent'),
      });

      res.json({ success: true, data: activity });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/gdpr/ropa/:id
 * Retire a processing activity.
 *
 * Retired, not removed: Article 30 is an accountability record, and one that
 * can be made to forget that a thing was ever done is not one.
 */
router.delete('/ropa/:id', adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.processingActivity.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, 'Processing activity not found');

    const activity = await prisma.processingActivity.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });

    await gdprService.recordComplianceChange({
      adminId: req.user!.id,
      action: 'ROPA_ACTIVITY_RETIRED',
      resourceType: 'ProcessingActivity',
      resourceId: activity.id,
      previousValue: { isActive: existing.isActive },
      newValue: { isActive: false },
      ipAddress: auditIpAddress(req) ?? undefined,
      userAgent: req.get('user-agent'),
    });

    res.json({
      success: true,
      message: 'Processing activity retired. It stays on the record.',
      data: activity,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/gdpr/dpia
 * Data protection impact assessments
 */
router.get('/dpia', adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = parsePagination(req.query as { page?: string; limit?: string });

    const where: Record<string, unknown> = {};
    if (typeof req.query.status === 'string') where.status = req.query.status;

    const [assessments, total] = await Promise.all([
      prisma.dPIA.findMany({ where, orderBy: { updatedAt: 'desc' }, skip, take: limit }),
      prisma.dPIA.count({ where }),
    ]);

    res.json({
      success: true,
      data: assessments,
      pagination: buildPaginationMeta(total, page, limit),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/gdpr/dpia/:id
 * One impact assessment
 */
router.get('/dpia/:id', adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const assessment = await prisma.dPIA.findUnique({ where: { id: req.params.id } });
    if (!assessment) throw new ApiError(404, 'DPIA not found');

    res.json({ success: true, data: assessment });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/gdpr/dpia
 * Open an impact assessment
 */
router.post(
  '/dpia',
  adminOnly,
  [
    body('title').isString().trim().notEmpty().withMessage('Title is required'),
    body('description').isString().trim().notEmpty().withMessage('Description is required'),
    body('featureOrSystem').isString().trim().notEmpty().withMessage('Feature or system is required'),
    body('necessity').isString().trim().notEmpty().withMessage('Necessity assessment is required'),
    body('proportionality')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('Proportionality assessment is required'),
    body('residualRiskLevel')
      .isIn(RESIDUAL_RISK_LEVELS)
      .withMessage(`Residual risk must be one of: ${RESIDUAL_RISK_LEVELS.join(', ')}`),
    body('risks').isArray().withMessage('Risks must be a list'),
    body('mitigations').isArray().withMessage('Mitigations must be a list'),
    optionalDataCategories,
    optionalStringList('processingOperations'),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      rejectInvalid(req);

      const assessment = await prisma.dPIA.create({
        data: {
          title: req.body.title,
          description: req.body.description,
          featureOrSystem: req.body.featureOrSystem,
          necessity: req.body.necessity,
          proportionality: req.body.proportionality,
          residualRiskLevel: req.body.residualRiskLevel,
          risks: req.body.risks,
          mitigations: req.body.mitigations,
          dataCategories: (req.body.dataCategories ?? []) as DataCategory[],
          processingOperations: req.body.processingOperations ?? [],
        },
      });

      await gdprService.recordComplianceChange({
        adminId: req.user!.id,
        action: 'DPIA_CREATED',
        resourceType: 'DPIA',
        resourceId: assessment.id,
        newValue: { title: assessment.title, featureOrSystem: assessment.featureOrSystem },
        ipAddress: auditIpAddress(req) ?? undefined,
        userAgent: req.get('user-agent'),
      });

      res.status(201).json({ success: true, data: assessment });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/gdpr/dpia/:id
 * Work on or sign off an impact assessment
 */
router.patch(
  '/dpia/:id',
  adminOnly,
  [
    body('title').optional().isString().trim().notEmpty(),
    body('description').optional().isString().trim().notEmpty(),
    body('featureOrSystem').optional().isString().trim().notEmpty(),
    body('necessity').optional().isString().trim().notEmpty(),
    body('proportionality').optional().isString().trim().notEmpty(),
    body('residualRiskLevel').optional().isIn(RESIDUAL_RISK_LEVELS),
    body('residualRiskAccepted').optional().isBoolean(),
    body('risks').optional().isArray(),
    body('mitigations').optional().isArray(),
    body('dpoConsulted').optional().isBoolean(),
    body('dpoComments').optional().isString(),
    body('regulatorConsulted').optional().isBoolean(),
    body('regulatorResponse').optional().isString(),
    body('status').optional().isIn(DPIA_STATUSES),
    body('nextReviewDate').optional().isISO8601(),
    optionalDataCategories,
    optionalStringList('processingOperations'),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      rejectInvalid(req);

      const existing = await prisma.dPIA.findUnique({ where: { id: req.params.id } });
      if (!existing) throw new ApiError(404, 'DPIA not found');

      const data: Record<string, unknown> = {};
      for (const field of [
        'title',
        'description',
        'featureOrSystem',
        'necessity',
        'proportionality',
        'residualRiskLevel',
        'residualRiskAccepted',
        'risks',
        'mitigations',
        'dpoConsulted',
        'dpoComments',
        'regulatorConsulted',
        'regulatorResponse',
        'status',
        'processingOperations',
        'dataCategories',
      ]) {
        if (req.body[field] !== undefined) data[field] = req.body[field];
      }
      if (req.body.nextReviewDate) data.nextReviewDate = new Date(req.body.nextReviewDate);

      // Sign-off is the moment the assessment starts carrying weight, so who
      // approved it and when is recorded by the server, not sent by the client.
      if (req.body.status === 'APPROVED' && existing.status !== 'APPROVED') {
        data.approvedBy = req.user!.id;
        data.approvedAt = new Date();
      }

      const assessment = await prisma.dPIA.update({
        where: { id: req.params.id },
        data: data as unknown as Prisma.DPIAUncheckedUpdateInput,
      });

      await gdprService.recordComplianceChange({
        adminId: req.user!.id,
        action: 'DPIA_UPDATED',
        resourceType: 'DPIA',
        resourceId: assessment.id,
        previousValue: { status: existing.status, residualRiskLevel: existing.residualRiskLevel },
        newValue: { status: assessment.status, residualRiskLevel: assessment.residualRiskLevel },
        ipAddress: auditIpAddress(req) ?? undefined,
        userAgent: req.get('user-agent'),
      });

      res.json({ success: true, data: assessment });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
