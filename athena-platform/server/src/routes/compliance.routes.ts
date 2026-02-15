/**
 * UK/EU Compliance Routes
 * Handles region-specific compliance endpoints
 * Phase 4: UK/EU Market Launch
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { ConsentType } from '@prisma/client';
import { gdprService } from '../services/gdpr.service';
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

function normalizeRegionCode(code?: string): string {
  if (!code) return 'ROW';
  const upper = code.toUpperCase();
  if (upper === 'GB') return 'UK';
  if (upper in REGION_CONFIGS) return upper;
  return getRegionFromCountry(upper);
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
 * GET /api/compliance/subprocessors
 * Get list of subprocessors (data processors) - GDPR requirement
 */
router.get('/subprocessors', async (_req: Request, res: Response) => {
  // In production, this would come from the database
  const subprocessors = [
    {
      name: 'Amazon Web Services (AWS)',
      purpose: 'Cloud infrastructure and data storage',
      location: 'EU (Frankfurt), UK (London)',
      dataCategories: ['All platform data'],
      dpaStatus: 'Signed',
    },
    {
      name: 'Stripe',
      purpose: 'Payment processing',
      location: 'US (with EU data residency)',
      dataCategories: ['Payment information', 'Billing details'],
      dpaStatus: 'Signed',
    },
    {
      name: 'SendGrid (Twilio)',
      purpose: 'Email delivery',
      location: 'US (with SCCs)',
      dataCategories: ['Email addresses', 'Email content'],
      dpaStatus: 'Signed',
    },
    {
      name: 'Cloudflare',
      purpose: 'CDN and security',
      location: 'Global (with EU processing)',
      dataCategories: ['IP addresses', 'Request logs'],
      dpaStatus: 'Signed',
    },
    {
      name: 'Google Analytics',
      purpose: 'Usage analytics',
      location: 'EU',
      dataCategories: ['Anonymized usage data'],
      dpaStatus: 'Signed',
    },
  ];

  res.json({
    success: true,
    data: {
      subprocessors,
      lastUpdated: '2026-01-15',
      changeNotificationDays: 30,
    },
  });
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

    const consents = await gdprService.getUserConsents(userId);
    const dataProcessingConsent = consents.find(
      (consent) => consent.consentType === ConsentType.DATA_PROCESSING
    );
    const hasDataProcessingConsent = dataProcessingConsent?.status === 'GRANTED';

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
 * POST /api/compliance/report-content
 * Report illegal or harmful content (UK Online Safety requirement)
 */
router.post('/report-content', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { contentType, contentId, reason, details } = req.body;
    const userId = req.user!.id;

    if (!contentType || !contentId || !reason) {
      return res.status(400).json({
        success: false,
        error: 'contentType, contentId, and reason are required',
      });
    }

    // In production, this would create a moderation ticket
    const report = {
      id: `report_${Date.now()}`,
      reporterId: userId,
      contentType,
      contentId,
      reason,
      details,
      status: 'PENDING',
      createdAt: new Date(),
      reviewDeadline: new Date(Date.now() + UK_ONLINE_SAFETY_CONFIG.harmfulContentReviewHours * 60 * 60 * 1000),
    };

    res.json({
      success: true,
      message: 'Report submitted successfully. We will review it within 48 hours.',
      data: {
        reportId: report.id,
        status: report.status,
        reviewDeadline: report.reviewDeadline,
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

    await gdprService.recordConsent(userId, ConsentType.DATA_PROCESSING, true, {
      ipAddress: req.ip,
      userAgent,
      region: requestRegion,
    });

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
