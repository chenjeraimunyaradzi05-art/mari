/**
 * UK/EU Compliance Routes
 * Handles region-specific compliance endpoints
 * Phase 4: UK/EU Market Launch
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { ConsentType } from '@prisma/client';
import { gdprService } from '../services/gdpr.service';
import { consentService } from '../services/consent.service';
import { prisma } from '../utils/prisma';
import { 
  REGION_CONFIGS, 
  UK_PRICING, 
  EU_PRICING,
  UK_ONLINE_SAFETY_CONFIG,
  GDPR_CONFIG,
  getRegionFromCountry,
  isGDPRRegion,
} from '../config/region.config';

const router = Router();

type LegalDocumentEntry = {
  id: string;
  documentType: string;
  title: string;
  version: string;
  effectiveDate: string;
  url: string;
  required: boolean;
  regions: string[];
};

type LegalAgreementRecord = {
  documentType: string;
  documentVersion: string;
  acceptedAt: string;
};

type TransparencyCountMap = Record<string, number>;

const TRANSPARENCY_CATEGORY_DEFAULTS: TransparencyCountMap = {
  illegal: 0,
  harmful: 0,
  harassment: 0,
  hate_speech: 0,
  spam: 0,
  misinformation: 0,
  csam: 0,
  terrorism: 0,
  fraud: 0,
  other: 0,
};

const TRANSPARENCY_ACTION_DEFAULTS: TransparencyCountMap = {
  contentRemoved: 0,
  accountsSuspended: 0,
  accountsBanned: 0,
  warnings: 0,
  noAction: 0,
};

const LEGAL_DOCUMENTS: LegalDocumentEntry[] = [
  {
    id: 'terms-v1',
    documentType: 'terms_of_service',
    title: 'Terms of Service',
    version: '1.0',
    effectiveDate: '2026-01-15',
    url: '/terms',
    required: true,
    regions: ['ALL'],
  },
  {
    id: 'privacy-v1',
    documentType: 'privacy_policy',
    title: 'Privacy Policy',
    version: '1.0',
    effectiveDate: '2026-01-15',
    url: '/privacy',
    required: true,
    regions: ['ALL'],
  },
  {
    id: 'cookies-v1',
    documentType: 'cookie_policy',
    title: 'Cookie Policy',
    version: '1.0',
    effectiveDate: '2026-01-15',
    url: '/cookies',
    required: true,
    regions: ['ALL'],
  },
  {
    id: 'uk-privacy-addendum-v1',
    documentType: 'uk_privacy_addendum',
    title: 'UK Privacy Addendum',
    version: '1.0',
    effectiveDate: '2026-01-15',
    url: '/privacy/uk',
    required: true,
    regions: ['UK'],
  },
];

/**
 * How to find the member behind a piece of reported content. A report has to
 * name somebody for a moderator to be able to act on it, so a content type that
 * is not listed here cannot be reported through this route.
 */
const REPORT_CONTENT_OWNERS: Record<string, (contentId: string) => Promise<string | null>> = {
  POST: async (id) =>
    (await prisma.post.findUnique({ where: { id }, select: { authorId: true } }))?.authorId ?? null,
  COMMENT: async (id) =>
    (await prisma.comment.findUnique({ where: { id }, select: { authorId: true } }))?.authorId ?? null,
  VIDEO: async (id) =>
    (await prisma.video.findUnique({ where: { id }, select: { authorId: true } }))?.authorId ?? null,
  VIDEO_COMMENT: async (id) =>
    (await prisma.videoComment.findUnique({ where: { id }, select: { authorId: true } }))?.authorId ?? null,
  STATUS: async (id) =>
    (await prisma.status.findUnique({ where: { id }, select: { userId: true } }))?.userId ?? null,
  MESSAGE: async (id) =>
    (await prisma.message.findUnique({ where: { id }, select: { senderId: true } }))?.senderId ?? null,
  CHANNEL_MESSAGE: async (id) =>
    (await prisma.channelMessage.findUnique({ where: { id }, select: { authorId: true } }))?.authorId ?? null,
  GROUP_POST: async (id) =>
    (await prisma.groupPost.findUnique({ where: { id }, select: { authorId: true } }))?.authorId ?? null,
  JOB: async (id) =>
    (await prisma.job.findUnique({ where: { id }, select: { postedById: true } }))?.postedById ?? null,
  PROFILE: async (id) =>
    (await prisma.user.findUnique({ where: { id }, select: { id: true } }))?.id ?? null,
};

// Reasons that put a report at the front of the queue rather than the back.
const URGENT_REPORT_REASONS = new Set(['CSAM', 'TERRORISM', 'ILLEGAL', 'SELF_HARM']);
const HIGH_HARM_REPORT_REASONS = new Set(['HARASSMENT', 'HATE_SPEECH', 'FRAUD', 'HARMFUL']);

type SubprocessorDpaStatus = 'SIGNED' | 'EXPIRED' | 'NOT_RECORDED';

/**
 * Never assert a contract we cannot see. A subprocessor with no recorded
 * signature is published as unrecorded rather than as signed.
 */
function resolveDpaStatus(signedAt: Date | null, expiresAt: Date | null): SubprocessorDpaStatus {
  if (!signedAt) return 'NOT_RECORDED';
  if (expiresAt && expiresAt.getTime() <= Date.now()) return 'EXPIRED';
  return 'SIGNED';
}

function reportSeverity(reason: string): 'CRITICAL' | 'HIGH' | 'MEDIUM' {
  if (URGENT_REPORT_REASONS.has(reason)) return 'CRITICAL';
  if (HIGH_HARM_REPORT_REASONS.has(reason)) return 'HIGH';
  return 'MEDIUM';
}

function normalizeRegionCode(code?: string): string {
  if (!code) return 'ROW';
  const upper = code.toUpperCase();
  if (upper === 'GB') return 'UK';
  if (upper in REGION_CONFIGS) return upper;
  return getRegionFromCountry(upper);
}

function normalizeCountMap(value: unknown, defaults: TransparencyCountMap): TransparencyCountMap {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return Object.fromEntries(
    Object.entries(defaults).map(([key, fallback]) => {
      const raw = source[key];
      return [key, typeof raw === 'number' && Number.isFinite(raw) ? raw : fallback];
    })
  );
}

function formatTransparencyPeriod(period: string): string {
  return period.replace(/_/g, ' ');
}

// ============================================
// Public Compliance Information
// ============================================

/**
 * GET /api/compliance/region/:countryCode
 * Get region configuration for a country
 */
router.get('/region/:countryCode', (req: Request, res: Response) => {
  const { countryCode } = req.params;
  const region = getRegionFromCountry(countryCode.toUpperCase());
  const config = REGION_CONFIGS[region] || REGION_CONFIGS.ANZ;

  res.json({
    success: true,
    data: {
      region,
      config,
      gdprApplicable: isGDPRRegion(region),
    },
  });
});

/**
 * GET /api/compliance/pricing/:region
 * Get pricing for a specific region
 */
router.get('/pricing/:region', (req: Request, res: Response) => {
  const { region } = req.params;
  
  let pricing;
  switch (region.toUpperCase()) {
    case 'UK':
      pricing = UK_PRICING;
      break;
    case 'EU':
      pricing = EU_PRICING;
      break;
    default:
      pricing = null;
  }

  if (!pricing) {
    return res.status(404).json({
      success: false,
      error: 'Pricing not available for this region',
    });
  }

  const config = REGION_CONFIGS[region.toUpperCase()];

  res.json({
    success: true,
    data: {
      pricing,
      currency: config?.currency || 'USD',
      currencySymbol: config?.currencySymbol || '$',
      vatInclusive: config?.vatInclusive || false,
      vatRate: config?.vatRate || 0,
    },
  });
});

/**
 * GET /api/compliance/gdpr
 * Get GDPR compliance information
 */
router.get('/gdpr', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      config: GDPR_CONFIG,
      applicableRegions: ['UK', 'EU'],
      dpoContact: GDPR_CONFIG.dpoContact,
      rights: [
        { name: 'Right of Access', description: 'Request a copy of your personal data' },
        { name: 'Right to Rectification', description: 'Correct inaccurate personal data' },
        { name: 'Right to Erasure', description: 'Request deletion of your personal data' },
        { name: 'Right to Restriction', description: 'Limit how we process your data' },
        { name: 'Right to Portability', description: 'Receive your data in a portable format' },
        { name: 'Right to Object', description: 'Object to certain types of processing' },
      ],
    },
  });
});

/**
 * GET /api/compliance/uk-safety
 * Get UK Online Safety Act compliance information
 */
router.get('/uk-safety', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      config: UK_ONLINE_SAFETY_CONFIG,
      safetyFeatures: [
        { name: 'Content Reporting', description: 'Report harmful or illegal content', available: true },
        { name: 'User Blocking', description: 'Block users from contacting you', available: true },
        { name: 'User Muting', description: 'Mute users without blocking them', available: true },
        { name: 'Content Filtering', description: 'Filter content based on preferences', available: true },
        { name: 'Safe Mode', description: 'Enhanced privacy for vulnerable users', available: true },
      ],
      regulatorInfo: {
        name: 'Ofcom',
        url: UK_ONLINE_SAFETY_CONFIG.ofcomUrl,
        role: 'UK communications regulator responsible for online safety',
      },
    },
  });
});

/**
 * GET /api/compliance/transparency-report
 * Get the latest published transparency report, or a specific published period.
 */
router.get('/transparency-report', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const requestedPeriod = typeof req.query.period === 'string'
      ? req.query.period.trim()
      : '';

    const where: any = {
      publishedAt: { not: null },
      ...(requestedPeriod ? { period: requestedPeriod } : {}),
    };

    const report = await (prisma as any).transparencyReport.findFirst({
      where,
      orderBy: [{ endDate: 'desc' }, { publishedAt: 'desc' }],
    });

    if (!report) {
      return res.json({
        success: true,
        data: null,
        meta: {
          status: 'not_published',
          period: requestedPeriod || null,
        },
      });
    }

    const totalAppeals = report.totalAppeals ?? 0;
    const appealsUpheld = report.appealsUpheld ?? 0;
    const appealsOverturned = report.appealsOverturned ?? 0;

    res.json({
      success: true,
      data: {
        id: report.id,
        period: formatTransparencyPeriod(report.period),
        rawPeriod: report.period,
        startDate: report.startDate,
        endDate: report.endDate,
        publishedAt: report.publishedAt,
        publishedUrl: report.publishedUrl,
        totalReports: report.totalReports ?? 0,
        byCategory: normalizeCountMap(report.reportsByCategory, TRANSPARENCY_CATEGORY_DEFAULTS),
        actions: normalizeCountMap(report.actionsByType, TRANSPARENCY_ACTION_DEFAULTS),
        timing: {
          avgResponseHours: report.avgResponseHours ?? 0,
          under24Hours: report.under24Hours ?? 0,
          under72Hours: report.under72Hours ?? 0,
          over72Hours: report.over72Hours ?? 0,
        },
        appeals: {
          total: totalAppeals,
          upheld: appealsUpheld,
          overturned: appealsOverturned,
          pending: Math.max(totalAppeals - appealsUpheld - appealsOverturned, 0),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/compliance/subprocessors
 * Get list of subprocessors (data processors) - GDPR requirement
 */
router.get('/subprocessors', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const records = await prisma.subprocessor.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    const subprocessors = records.map((record) => ({
      name: record.name,
      purpose: record.description || (record.services.length ? record.services.join(', ') : null),
      location: record.country,
      isEUAdequate: record.isEUAdequate,
      transferMechanism: record.transferMechanism,
      dataCategories: record.dataCategories,
      securityCertifications: record.securityCertifications,
      dpaStatus: resolveDpaStatus(record.dpaSignedAt, record.dpaExpiresAt),
      dpaSignedAt: record.dpaSignedAt,
    }));

    const lastUpdated = records.reduce<Date | null>(
      (latest, record) => (!latest || record.updatedAt > latest ? record.updatedAt : latest),
      null
    );

    res.json({
      success: true,
      data: {
        subprocessors,
        lastUpdated,
        changeNotificationDays: 30,
      },
      meta: {
        status: records.length > 0 ? 'published' : 'not_published',
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/compliance/data-transfers
 * Get information about international data transfers
 */
router.get('/data-transfers', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      primaryDataLocation: 'EU (AWS Frankfurt)',
      backupLocations: ['UK (AWS London)'],
      transferMechanisms: [
        {
          destination: 'US',
          mechanism: 'Standard Contractual Clauses (SCCs)',
          additionalSafeguards: ['Encryption in transit and at rest', 'Access controls'],
        },
      ],
      adequacyDecisions: GDPR_CONFIG.adequacyDecisionCountries,
    },
  });
});

/**
 * GET /api/compliance/legal-documents
 * Get legal documents scoped by region
 */
router.get('/legal-documents', (req: Request, res: Response) => {
  const region = normalizeRegionCode((req.query.region as string | undefined) || undefined);
  const documents = LEGAL_DOCUMENTS.filter(
    (doc) => doc.regions.includes('ALL') || doc.regions.includes(region)
  );

  res.json({
    success: true,
    data: documents,
  });
});

/**
 * POST /api/compliance/report-content
 * Report illegal or harmful content (UK Online Safety requirement)
 *
 * Deliberately open to people without an account: somebody who has just been
 * targeted may have no way to sign in, and the Act does not let us insist.
 */
router.post('/report-content', optionalAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { contentType, contentId, reason, details } = req.body;

    if (!contentType || !contentId || !reason) {
      return res.status(400).json({
        success: false,
        error: 'contentType, contentId, and reason are required',
      });
    }

    const normalizedType = String(contentType).toUpperCase();
    const normalizedReason = String(reason).toUpperCase();
    const resolveOwner = REPORT_CONTENT_OWNERS[normalizedType];

    if (!resolveOwner) {
      return res.status(400).json({
        success: false,
        error: `contentType must be one of: ${Object.keys(REPORT_CONTENT_OWNERS).join(', ')}`,
      });
    }

    const reportedUserId = await resolveOwner(String(contentId));

    if (!reportedUserId) {
      return res.status(404).json({
        success: false,
        error: 'We could not find the content you reported. It may already have been removed.',
      });
    }

    const reviewDeadline = new Date(
      Date.now() + UK_ONLINE_SAFETY_CONFIG.harmfulContentReviewHours * 60 * 60 * 1000
    );
    const reporterId = req.user?.id;
    const description = typeof details === 'string' ? details : undefined;

    if (reporterId) {
      const report = await prisma.contentReport.create({
        data: {
          reporterId,
          reportedUserId,
          contentType: normalizedType,
          contentId: String(contentId),
          reason: normalizedReason,
          description,
          evidence: { reviewDeadline: reviewDeadline.toISOString(), source: 'ONLINE_SAFETY_REPORT' },
          status: 'PENDING',
        },
      });

      logger.info('Content report filed', { reportId: report.id, reason: normalizedReason });

      return res.status(201).json({
        success: true,
        message: 'Report submitted. We will review it within 48 hours.',
        data: {
          reportId: report.id,
          queue: 'CONTENT_REPORT',
          status: report.status,
          reviewDeadline,
        },
      });
    }

    // A content report row names a member on both sides, so an anonymous report
    // is filed as a safety incident instead. Same moderators, same queue tools,
    // no invented reporter.
    const incident = await prisma.safetyIncident.create({
      data: {
        userId: reportedUserId,
        type: 'USER_REPORT',
        severity: reportSeverity(normalizedReason),
        reason: normalizedReason,
        contentType: normalizedType,
        contentId: String(contentId),
        metadata: {
          description: description ?? null,
          reviewDeadline: reviewDeadline.toISOString(),
          source: 'ONLINE_SAFETY_REPORT',
          anonymous: true,
        },
      },
    });

    logger.info('Anonymous content report filed', {
      incidentId: incident.id,
      reason: normalizedReason,
    });

    res.status(201).json({
      success: true,
      message: 'Report submitted. We will review it within 48 hours.',
      data: {
        reportId: incident.id,
        queue: 'SAFETY_INCIDENT',
        status: 'PENDING',
        reviewDeadline,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// Protected Compliance Endpoints
// ============================================

router.use(authenticate);

/**
 * GET /api/compliance/status
 * Get current compliance status for authenticated user
 */
router.get('/status', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const countryCode = (req.headers['cf-ipcountry'] as string | undefined) || 'AU';
    const region = normalizeRegionCode(countryCode);
    const gdprApplicable = isGDPRRegion(region);

    if (!gdprApplicable) {
      return res.json({
        success: true,
        data: {
          status: 'compliant',
          region,
          gdprApplicable,
          checkedAt: new Date().toISOString(),
          requirements: {
            dataProcessingConsent: false,
          },
        },
      });
    }

    const hasDataProcessingConsent = await consentService.hasConsent(
      userId,
      ConsentType.DATA_PROCESSING
    );

    res.json({
      success: true,
      data: {
        status: hasDataProcessingConsent ? 'compliant' : 'pending',
        region,
        gdprApplicable,
        checkedAt: new Date().toISOString(),
        requirements: {
          dataProcessingConsent: hasDataProcessingConsent,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/compliance/my-region
 * Get user's detected region and applicable compliance
 */
router.get('/my-region', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const countryCode = req.headers['cf-ipcountry'] as string || 'AU';
    const region = getRegionFromCountry(countryCode);
    const config = REGION_CONFIGS[region] || REGION_CONFIGS.ANZ;

    res.json({
      success: true,
      data: {
        detectedCountry: countryCode,
        region,
        config,
        gdprApplicable: isGDPRRegion(region),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/compliance/region-preferences
 * Update user's region preferences
 */
router.put('/region-preferences', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { region, locale, currency, timezone } = req.body;
    const userId = req.user!.id;

    // Validate region
    if (region && !REGION_CONFIGS[region]) {
      return res.status(400).json({
        success: false,
        error: 'Invalid region code',
      });
    }

    // In production, update user preferences in database
    const updatedPreferences = {
      region,
      preferredLocale: locale,
      preferredCurrency: currency,
      timezone,
    };

    res.json({
      success: true,
      message: 'Region preferences updated',
      data: updatedPreferences,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/compliance/agreements
 * Get latest legal agreement acknowledgements for authenticated user
 */
router.get('/agreements', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const agreementLogs = await prisma.privacyAuditLog.findMany({
      where: {
        userId,
        action: 'LEGAL_AGREEMENT_ACCEPTED',
        resourceType: 'LegalDocument',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const latestByDocument = new Map<string, LegalAgreementRecord>();
    for (const log of agreementLogs) {
      const details = (log.details ?? {}) as { documentType?: string; documentVersion?: string };
      const documentType = details.documentType || log.resourceId || '';
      if (!documentType || latestByDocument.has(documentType)) {
        continue;
      }

      latestByDocument.set(documentType, {
        documentType,
        documentVersion: details.documentVersion || '1.0',
        acceptedAt: log.createdAt.toISOString(),
      });
    }

    res.json({
      success: true,
      data: Array.from(latestByDocument.values()),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/compliance/agreements
 * Record legal document agreement acknowledgement
 */
router.post('/agreements', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { documentType, documentVersion } = req.body;
    const userId = req.user!.id;
    const userAgent = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined;
    const requestRegion = typeof req.headers['cf-ipcountry'] === 'string' ? req.headers['cf-ipcountry'] : 'UNKNOWN';

    if (!documentType || !documentVersion) {
      return res.status(400).json({
        success: false,
        error: 'documentType and documentVersion are required',
      });
    }

    const consentContext = { ipAddress: req.ip, userAgent, region: requestRegion };

    // Accepting the terms is where the baseline consents a member cannot use
    // the service without get their first record.
    await consentService.initializeUserConsents(userId, consentContext);
    await gdprService.recordConsent(userId, ConsentType.DATA_PROCESSING, true, consentContext);

    const agreementAudit = await prisma.privacyAuditLog.create({
      data: {
        userId,
        action: 'LEGAL_AGREEMENT_ACCEPTED',
        resourceType: 'LegalDocument',
        resourceId: String(documentType),
        details: {
          documentType: String(documentType),
          documentVersion: String(documentVersion),
        },
        ipAddress: req.ip,
        userAgent,
        region: requestRegion,
        legalBasis: 'CONSENT',
      },
    });

    logger.info('Legal agreement recorded', {
      userId,
      documentType,
      documentVersion,
    });

    res.json({
      success: true,
      message: 'Agreement recorded',
      data: {
        acceptedAt: agreementAudit.createdAt.toISOString(),
        documentType,
        documentVersion,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
