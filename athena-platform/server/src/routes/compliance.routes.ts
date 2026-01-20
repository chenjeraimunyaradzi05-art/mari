/**
 * UK/EU Compliance Routes
 * Handles region-specific compliance endpoints
 * Phase 4: UK/EU Market Launch
 */

import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
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

// ============================================
// Protected Compliance Endpoints
// ============================================

router.use(authenticate);

/**
 * POST /api/compliance/report-content
 * Report illegal or harmful content (UK Online Safety requirement)
 */
router.post('/report-content', async (req: AuthRequest, res: Response) => {
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
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/compliance/my-region
 * Get user's detected region and applicable compliance
 */
router.get('/my-region', async (req: AuthRequest, res: Response) => {
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
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/compliance/region-preferences
 * Update user's region preferences
 */
router.put('/region-preferences', async (req: AuthRequest, res: Response) => {
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
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
