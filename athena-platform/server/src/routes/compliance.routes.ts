/**
 * Compliance Routes
 *
 * Region-aware compliance endpoints for every member. The home regime is the
 * Privacy Act 1988 (Cth) and the Australian Privacy Principles, with the OAIC
 * as regulator, AUD pricing inclusive of GST, and the Australian Consumer Law
 * behind the consumer guarantees. UK and EU GDPR handling, ICO and DPA
 * details, and the UK Online Safety Act endpoints are layered on for members
 * in those regions and are selected by the region detected per request,
 * never assumed. The default country when nothing is detected is AU.
 *
 * The APP-by-APP map to these routes lives in
 * docs/compliance/AU_PRIVACY_ACT_AND_NDB.md.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { ConsentType, Prisma, Region } from '@prisma/client';
import { gdprService } from '../services/gdpr.service';
import { consentService } from '../services/consent.service';
import {
  newReportTicketId,
  reportPriorityFor,
  runReportIntakeConsequences,
} from '../services/content-report.service';
import { reviewReportedContent, type ReportableContent } from '../services/moderation-threshold.service';
import { handleUserReport } from '../services/safety-score.service';
import { recordSafetyReport } from '../services/trust.service';
import { publicFormLimiter } from '../middleware/socialLimits';
import { bestEffort } from '../utils/best-effort';
import { prisma } from '../utils/prisma';
import {
  REGION_CONFIGS,
  UK_PRICING,
  EU_PRICING,
  UK_ONLINE_SAFETY_CONFIG,
  AU_ONLINE_SAFETY_CONFIG,
  AU_PRIVACY_CONFIG,
  GDPR_CONFIG,
  GDPR_RIGHTS,
  PRIVACY_CONTACT_ROUTE,
  resolveContactEmail,
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
  {
    // The home-regime statement: how the Australian Privacy Principles and the
    // Notifiable Data Breaches scheme apply. Informational rather than a
    // contract, so it is listed for Australian members without asking them to
    // acknowledge it.
    id: 'au-privacy-statement-v1',
    documentType: 'au_privacy_statement',
    title: 'Australian Privacy Statement',
    version: '1.0',
    effectiveDate: '2026-09-17',
    url: '/privacy/au',
    required: false,
    regions: ['ANZ'],
  },
];

/**
 * The safety tools every member has, whichever regulator is reading. Listed
 * once so /online-safety and its /uk-safety alias cannot disagree.
 */
const SAFETY_FEATURES = [
  { name: 'Content Reporting', description: 'Report harmful or illegal content', available: true },
  { name: 'User Blocking', description: 'Block users from contacting you', available: true },
  { name: 'User Muting', description: 'Mute users without blocking them', available: true },
  { name: 'Content Filtering', description: 'Filter content based on preferences', available: true },
  { name: 'Safe Mode', description: 'Enhanced privacy for vulnerable users', available: true },
];

/**
 * The online-safety regimes ATHENA answers to, keyed by region. Australia is
 * the home regime (a Queensland company), the UK is layered on for members
 * there. Anyone else is served under the home regime.
 */
const ONLINE_SAFETY_REGIMES = {
  ANZ: {
    region: 'ANZ',
    act: AU_ONLINE_SAFETY_CONFIG.act,
    expectations: AU_ONLINE_SAFETY_CONFIG.expectations,
    regulator: {
      name: AU_ONLINE_SAFETY_CONFIG.regulator,
      url: AU_ONLINE_SAFETY_CONFIG.regulatorUrl,
      complaintUrl: AU_ONLINE_SAFETY_CONFIG.complaintUrl,
      role: 'Australian online safety regulator with removal-notice powers',
    },
    reviewHours: {
      illegal: AU_ONLINE_SAFETY_CONFIG.illegalContentRemovalHours,
      harmful: AU_ONLINE_SAFETY_CONFIG.harmfulContentReviewHours,
    },
    config: AU_ONLINE_SAFETY_CONFIG,
  },
  UK: {
    region: 'UK',
    act: 'Online Safety Act 2023',
    expectations: null,
    regulator: {
      name: 'Ofcom',
      url: UK_ONLINE_SAFETY_CONFIG.ofcomUrl,
      complaintUrl: UK_ONLINE_SAFETY_CONFIG.ofcomUrl,
      role: 'UK communications regulator responsible for online safety',
    },
    reviewHours: {
      illegal: UK_ONLINE_SAFETY_CONFIG.illegalContentRemovalHours,
      harmful: UK_ONLINE_SAFETY_CONFIG.harmfulContentReviewHours,
    },
    config: UK_ONLINE_SAFETY_CONFIG,
  },
} as const;

type OnlineSafetyRegion = keyof typeof ONLINE_SAFETY_REGIMES;

function applicableSafetyRegion(region: string): OnlineSafetyRegion {
  return region === 'UK' ? 'UK' : 'ANZ';
}

/**
 * Where an AWS region code actually is, for the data-transfers answer. Only
 * codes the platform could plausibly be deployed to are named; anything else
 * is published as the bare code rather than guessed at.
 */
const AWS_REGION_LOCATIONS: Record<string, string> = {
  'ap-southeast-2': 'Australia (AWS Sydney)',
  'ap-southeast-4': 'Australia (AWS Melbourne)',
  'ap-southeast-1': 'Singapore (AWS Singapore)',
  'eu-west-2': 'United Kingdom (AWS London)',
  'eu-west-1': 'Ireland (AWS Dublin)',
  'eu-central-1': 'Germany (AWS Frankfurt)',
  'us-east-1': 'United States (AWS N. Virginia)',
  'us-west-2': 'United States (AWS Oregon)',
};

function describeAwsRegion(code: string): string {
  return AWS_REGION_LOCATIONS[code] ?? `AWS ${code}`;
}

const AUSTRALIA_LABELS = new Set(['AU', 'AUS', 'AUSTRALIA']);

/** APP 8 turns on whether a disclosure leaves Australia. */
function isOverseas(country: string): boolean {
  return !AUSTRALIA_LABELS.has(country.trim().toUpperCase());
}

function privacyContact() {
  return {
    email: resolveContactEmail('privacy'),
    route: PRIVACY_CONTACT_ROUTE,
  };
}

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

/** How many evidence links one report may carry, and how long each may be. */
const MAX_EVIDENCE_URLS = 10;
const MAX_EVIDENCE_URL_LENGTH = 2048;

/**
 * The links a reporter attached, or null when what arrived is not a list of web
 * addresses.
 *
 * These are stored and shown to a moderator, so only http and https are
 * accepted: a javascript: or data: URI in a field that ends up rendered in the
 * console is an attack on the moderator, not evidence.
 */
function parseEvidenceUrls(value: unknown): string[] | null {
  if (value === undefined || value === null || value === '') return [];
  if (!Array.isArray(value)) return null;
  if (value.length > MAX_EVIDENCE_URLS) return null;

  const urls: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') return null;
    const trimmed = entry.trim();
    if (!trimmed) continue;
    if (trimmed.length > MAX_EVIDENCE_URL_LENGTH) return null;
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    } catch {
      return null;
    }
    urls.push(trimmed);
  }
  return urls;
}

/** The address to write back to: undefined when none was given, null when it is not an address. */
function parseContactEmail(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  return trimmed;
}

/** Content types the three-reporter auto-hide understands. */
const AUTO_HIDEABLE: Record<string, ReportableContent> = {
  POST: 'post',
  COMMENT: 'comment',
  VIDEO: 'video',
};

async function applyAutoHideThreshold(contentType: string, contentId: string): Promise<void> {
  const hideable = AUTO_HIDEABLE[contentType];
  if (!hideable) return;
  await reviewReportedContent(hideable, contentId);
}

/**
 * What a reporter is told about the decision. Derived from the action column,
 * never from reviewNotes, which are a moderator's notes about another member.
 */
function describeReportOutcome(action: string | null): string | null {
  switch (action) {
    case 'NO_ACTION':
      return 'We reviewed the content and did not find a breach of the community guidelines.';
    case 'WARNING':
      return 'We reviewed your report and warned the member responsible.';
    case 'CONTENT_REMOVED':
      return 'We reviewed your report and removed the content.';
    case 'SUSPENSION':
      return 'We reviewed your report and suspended the account responsible.';
    case 'BAN':
      return 'We reviewed your report and removed the account responsible.';
    case 'ESCALATED':
      return 'Your report is with our senior Trust & Safety reviewers.';
    default:
      return null;
  }
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
 * GET /api/compliance/privacy/:region
 * The privacy rights a member in that region can exercise, and who to complain
 * to. ANZ, US and ROW get the Australian Privacy Principles, the home regime
 * for a Queensland company; UK and EU get the GDPR set layered on top.
 */
router.get('/privacy/:region', (req: Request, res: Response) => {
  const region = normalizeRegionCode(req.params.region);
  const config = REGION_CONFIGS[region] || REGION_CONFIGS.ANZ;

  if (isGDPRRegion(region)) {
    return res.json({
      success: true,
      data: {
        region,
        regime: 'GDPR',
        law: region === 'UK' ? 'UK GDPR and the Data Protection Act 2018' : 'EU General Data Protection Regulation',
        regulator: {
          name: config.regulatoryBody,
          url: config.regulatoryUrl,
          complaintUrl: config.regulatoryUrl,
        },
        responseDays: GDPR_CONFIG.dsarResponseDays,
        breachNotificationHours: GDPR_CONFIG.breachNotificationHours,
        rights: GDPR_RIGHTS,
        contact: privacyContact(),
        statementUrl: region === 'UK' ? '/privacy/uk' : '/privacy',
      },
    });
  }

  res.json({
    success: true,
    data: {
      region,
      regime: 'APP',
      law: `${AU_PRIVACY_CONFIG.act} and the ${AU_PRIVACY_CONFIG.principles}`,
      regulator: {
        name: AU_PRIVACY_CONFIG.regulator,
        shortName: AU_PRIVACY_CONFIG.regulatorShortName,
        url: AU_PRIVACY_CONFIG.regulatorUrl,
        complaintUrl: AU_PRIVACY_CONFIG.complaintUrl,
      },
      responseDays: AU_PRIVACY_CONFIG.accessResponseDays,
      complaintAcknowledgeDays: AU_PRIVACY_CONFIG.complaintAcknowledgeDays,
      ndbAssessmentDays: AU_PRIVACY_CONFIG.ndbAssessmentDays,
      rights: AU_PRIVACY_CONFIG.rights,
      contact: privacyContact(),
      statementUrl: '/privacy/au',
    },
  });
});

/**
 * GET /api/compliance/gdpr
 * Get GDPR compliance information
 *
 * UK/EU-scoped by design: this is the GDPR layer for members there, not the
 * platform's privacy regime. The Australian Privacy Principles, which apply to
 * every member, are served by GET /privacy/:region. The DPO mailbox is null
 * until a domain ATHENA owns is configured (see resolveContactEmail); the
 * privacy centre route is the contact that works meanwhile.
 */
router.get('/gdpr', (_req: Request, res: Response) => {
  const dpoContact = resolveContactEmail('dpo');
  res.json({
    success: true,
    data: {
      config: { ...GDPR_CONFIG, dpoContact },
      applicableRegions: ['UK', 'EU'],
      dpoContact,
      dpoContactRoute: PRIVACY_CONTACT_ROUTE,
      rights: GDPR_RIGHTS,
    },
  });
});

/**
 * GET /api/compliance/online-safety
 * The online-safety regimes ATHENA answers to, keyed by region, and which one
 * applies to the caller (?region=, else the Cloudflare country, else Australia).
 */
router.get('/online-safety', (req: Request, res: Response) => {
  const requested = typeof req.query.region === 'string' ? req.query.region : undefined;
  const country = typeof req.headers['cf-ipcountry'] === 'string' ? req.headers['cf-ipcountry'] : undefined;
  const region = normalizeRegionCode(requested || country || 'AU');
  const applicable = applicableSafetyRegion(region);

  res.json({
    success: true,
    data: {
      region,
      applicable,
      regime: ONLINE_SAFETY_REGIMES[applicable],
      regimes: ONLINE_SAFETY_REGIMES,
      safetyFeatures: SAFETY_FEATURES,
    },
  });
});

/**
 * GET /api/compliance/uk-safety
 * Alias kept for callers written against the UK-only shape.
 *
 * Superseded by GET /online-safety, which serves both the Australian regime
 * (Online Safety Act 2021, eSafety Commissioner) and the UK one keyed by
 * region. This route answers with the UK regime only and is retained so an
 * existing caller keeps working; new code should read /online-safety.
 */
router.get('/uk-safety', (_req: Request, res: Response) => {
  const uk = ONLINE_SAFETY_REGIMES.UK;
  res.json({
    success: true,
    data: {
      config: UK_ONLINE_SAFETY_CONFIG,
      safetyFeatures: SAFETY_FEATURES,
      regulatorInfo: {
        name: uk.regulator.name,
        url: uk.regulator.url,
        role: uk.regulator.role,
      },
      supersededBy: '/api/compliance/online-safety',
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

    const where: Prisma.TransparencyReportWhereInput = {
      publishedAt: { not: null },
      ...(requestedPeriod ? { period: requestedPeriod } : {}),
    };

    const report = await prisma.transparencyReport.findFirst({
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
 * Where personal information is held and where it goes (APP 8, GDPR Chapter V)
 *
 * Derived, never asserted: the primary location comes from AWS_REGION, backup
 * locations from BACKUP_AWS_REGIONS (comma-separated, optional), and overseas
 * destinations from the Subprocessor register. This route once published
 * Frankfurt and London data centres that did not exist; when nothing is
 * configured it now says so with meta.status 'not_published', as
 * /subprocessors does.
 */
router.get('/data-transfers', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const primaryRegion = (process.env.AWS_REGION || '').trim();
    const backupLocations = (process.env.BACKUP_AWS_REGIONS || '')
      .split(',')
      .map((code) => code.trim())
      .filter(Boolean)
      .map(describeAwsRegion);

    const records = await prisma.subprocessor.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    const overseasDisclosures = records
      .filter((record) => isOverseas(record.country))
      .map((record) => ({
        processor: record.name,
        destination: record.country,
        mechanism: record.transferMechanism,
        isEUAdequate: record.isEUAdequate,
        dataCategories: record.dataCategories,
        dpaStatus: resolveDpaStatus(record.dpaSignedAt, record.dpaExpiresAt),
      }));

    const configured = Boolean(primaryRegion) || records.length > 0;

    if (!configured) {
      return res.json({
        success: true,
        data: null,
        meta: { status: 'not_published' },
      });
    }

    res.json({
      success: true,
      data: {
        primaryDataLocation: primaryRegion ? describeAwsRegion(primaryRegion) : null,
        primaryRegionCode: primaryRegion || null,
        backupLocations,
        overseasDisclosures,
        // Kept under the old key too, so a reader of the previous shape still
        // finds the destinations here.
        transferMechanisms: overseasDisclosures.map((disclosure) => ({
          destination: disclosure.destination,
          processor: disclosure.processor,
          mechanism: disclosure.mechanism,
        })),
        basis: {
          australia:
            'Before disclosing personal information overseas we take reasonable steps, by contract, so the recipient handles it consistently with the Australian Privacy Principles (APP 8.1).',
          ukEu: 'Transfers of UK and EU members’ data outside the UK/EEA rely on Standard Contractual Clauses, the UK International Data Transfer Agreement, or an adequacy decision.',
        },
        adequacyDecisions: GDPR_CONFIG.adequacyDecisionCountries,
      },
      meta: {
        status: 'published',
        source: {
          primary: primaryRegion ? 'AWS_REGION' : null,
          overseas: records.length > 0 ? 'subprocessor_register' : null,
        },
      },
    });
  } catch (error) {
    next(error);
  }
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
 * Report illegal or harmful content
 *
 * The reporting mechanism the Australian Online Safety Act 2021 (Basic Online
 * Safety Expectations) and the UK Online Safety Act 2023 both require.
 * Deliberately open to people without an account: somebody who has just been
 * targeted may have no way to sign in, and neither Act lets us insist.
 */
router.post('/report-content', optionalAuth, publicFormLimiter, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { contentType, contentId, reason, details, evidenceUrls, contactEmail, isUrgent } = req.body;

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

    // The form posts seven fields and the handler read four. The evidence
    // links, the contact address and the urgency flag were destructured away,
    // under a confirmation screen that promises to write back to that address
    // and to answer a critical report inside 24 hours. A safety form that
    // discards what a woman took the trouble to give it is worse than one that
    // never asked, so all three are kept, validated, and acted on below.
    const parsedEvidence = parseEvidenceUrls(evidenceUrls);
    if (parsedEvidence === null) {
      return res.status(400).json({
        success: false,
        error: 'Evidence links must be http or https web addresses, ten at most.',
      });
    }

    const parsedContactEmail = parseContactEmail(contactEmail);
    if (parsedContactEmail === null) {
      return res.status(400).json({
        success: false,
        error: 'Please give a valid email address, or leave it blank.',
      });
    }

    const urgent = isUrgent === true || isUrgent === 'true';

    const reportedUserId = await resolveOwner(String(contentId));

    if (!reportedUserId) {
      return res.status(404).json({
        success: false,
        error: 'We could not find the content you reported. It may already have been removed.',
      });
    }

    // Two clocks, the ones the product already promises: 24 hours for illegal
    // content, CSAM and terrorism — and for anything a reporter has marked
    // urgent — and 48 hours for everything else. One uniform 48 was stamped on
    // every report, including the ones the confirmation screen tells a reporter
    // we answer in a day.
    const priority = reportPriorityFor(normalizedReason, urgent);
    const reviewHours =
      priority === 'critical'
        ? AU_ONLINE_SAFETY_CONFIG.illegalContentRemovalHours
        : AU_ONLINE_SAFETY_CONFIG.harmfulContentReviewHours;
    const reviewDeadline = new Date(Date.now() + reviewHours * 60 * 60 * 1000);
    const reporterId = req.user?.id;
    const description = typeof details === 'string' ? details : undefined;
    // A reference a reporter can quote, and the key the status lookup and the
    // authority-referral queue both find the report by.
    const ticketId = newReportTicketId();

    const evidence = {
      ticketId,
      reviewDeadline: reviewDeadline.toISOString(),
      reviewHours,
      priority,
      source: 'ONLINE_SAFETY_REPORT',
      urls: parsedEvidence,
      contactEmail: parsedContactEmail ?? undefined,
      isUrgent: urgent,
    };

    const responseBody = (reportId: string, queue: string, status: string) => ({
      success: true,
      message: `Report submitted. We will review it within ${reviewHours} hours.`,
      data: {
        reportId,
        reference: ticketId,
        queue,
        status,
        priority,
        reviewDeadline,
      },
    });

    if (reporterId) {
      const report = await prisma.contentReport.create({
        data: {
          reporterId,
          reportedUserId,
          contentType: normalizedType,
          contentId: String(contentId),
          reason: normalizedReason,
          description,
          evidence,
          status: 'PENDING',
        },
      });

      // The in-app report dialog has always run these three; this route, the
      // one the Online Safety Act actually requires, ran none of them. Three
      // women reporting the same post here never tripped the auto-hide that
      // three reporting through the dialog do, and none of it reached the
      // reported member's safety score. bestEffort because the report is
      // already filed: a failure here must be visible in the log, not swallowed
      // and not turned into a lost report.
      await bestEffort('compliance.report.trust-score', recordSafetyReport(reporterId, reportedUserId));
      await bestEffort(
        'compliance.report.safety-score',
        handleUserReport(reportedUserId, reporterId, normalizedReason, String(contentId), normalizedType)
      );
      await bestEffort('compliance.report.auto-hide', () => applyAutoHideThreshold(normalizedType, String(contentId)));

      await bestEffort(
        'compliance.report.intake-consequences',
        runReportIntakeConsequences({
          ticketId,
          reason: normalizedReason,
          priority,
          contentType: normalizedType,
          contentId: String(contentId),
          description,
          contactEmail: parsedContactEmail ?? undefined,
          isUrgent: urgent,
        })
      );

      logger.info('Content report filed', { reportId: report.id, ticketId, reason: normalizedReason, priority });

      return res.status(201).json(responseBody(report.id, 'CONTENT_REPORT', report.status));
    }

    // A content report row names a member on both sides, so an anonymous report
    // is filed as a safety incident instead. Same moderators, same queue tools,
    // no invented reporter: the anonymous queue is read by
    // listAnonymousReports and decided by resolveAnonymousReport.
    const incident = await prisma.safetyIncident.create({
      data: {
        userId: reportedUserId,
        type: 'USER_REPORT',
        severity: reportSeverity(normalizedReason),
        reason: normalizedReason,
        contentType: normalizedType,
        contentId: String(contentId),
        metadata: {
          ...evidence,
          description: description ?? null,
          anonymous: true,
        },
      },
    });

    // An anonymous report cannot move a trust score — there is no reporter to
    // weigh — but the auto-hide counts the whole anonymous cohort as one voice,
    // and the alerting and authority referral are the same.
    await bestEffort('compliance.report.auto-hide', () => applyAutoHideThreshold(normalizedType, String(contentId)));
    await bestEffort(
      'compliance.report.intake-consequences',
      runReportIntakeConsequences({
        ticketId,
        reason: normalizedReason,
        priority,
        contentType: normalizedType,
        contentId: String(contentId),
        description,
        contactEmail: parsedContactEmail ?? undefined,
        isUrgent: urgent,
      })
    );

    logger.info('Anonymous content report filed', {
      incidentId: incident.id,
      ticketId,
      reason: normalizedReason,
      priority,
    });

    res.status(201).json(responseBody(incident.id, 'SAFETY_INCIDENT', 'PENDING'));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/compliance/report-status/:reference
 *
 * "Keep your reference number so you can quote it" is what the confirmation
 * screen tells every reporter, and until now there was nothing anywhere on the
 * server that would answer when she did. This is that lookup. It takes either
 * the RPT- reference or the row id the confirmation screen displays, and it
 * answers for a named report and an anonymous one alike, because the reporter
 * who most needs to check back is the one who had no account to file it with.
 *
 * It deliberately returns a plain-language outcome and never reviewNotes: those
 * are a moderator's working notes about another member, and a reference number
 * is not an authorisation to read them.
 */
router.get('/report-status/:reference', publicFormLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reference = String(req.params.reference || '').trim();
    if (!reference || reference.length > 100) {
      return res.status(400).json({ success: false, error: 'A report reference is required.' });
    }

    const report =
      (await prisma.contentReport.findFirst({
        where: { evidence: { path: ['ticketId'], equals: reference } },
        select: { id: true, status: true, action: true, updatedAt: true, evidence: true },
      })) ??
      (await prisma.contentReport.findUnique({
        where: { id: reference },
        select: { id: true, status: true, action: true, updatedAt: true, evidence: true },
      }));

    if (report) {
      const evidence = (report.evidence ?? null) as { reviewDeadline?: string; ticketId?: string } | null;
      return res.json({
        success: true,
        data: {
          reference: evidence?.ticketId ?? report.id,
          status: report.status,
          outcome: describeReportOutcome(report.action),
          reviewDeadline: evidence?.reviewDeadline ?? null,
          lastUpdated: report.updatedAt,
        },
      });
    }

    const incident = await prisma.safetyIncident.findFirst({
      where: { type: 'USER_REPORT', metadata: { path: ['anonymous'], equals: true }, id: reference },
      select: { id: true, resolvedAt: true, updatedAt: true, metadata: true },
    });

    if (!incident) {
      return res.status(404).json({
        success: false,
        error: 'We could not find a report with that reference.',
      });
    }

    const metadata = (incident.metadata ?? null) as {
      reviewDeadline?: string;
      ticketId?: string;
      status?: string;
      action?: string;
    } | null;

    return res.json({
      success: true,
      data: {
        reference: metadata?.ticketId ?? incident.id,
        status: incident.resolvedAt ? metadata?.status ?? 'RESOLVED' : 'PENDING',
        outcome: describeReportOutcome(metadata?.action ?? null),
        reviewDeadline: metadata?.reviewDeadline ?? null,
        lastUpdated: incident.updatedAt,
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
    // No authenticate on this route, deliberately: region detection works for
    // a visitor too, and nothing here reads the account anyway.
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
 *
 * This validated the region, assembled the four values into an object, and
 * answered "Region preferences updated" without going anywhere near the
 * database — the comment said "In production, update user preferences in
 * database" and there was no production path behind it. The member's region
 * decides which privacy regime, which currency and which legal documents she is
 * shown, so a silent no-op here is not a cosmetic bug: she sets herself to UK,
 * is told it worked, and keeps being served the Australian set. The row is
 * written now and the response reports what the row says.
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

    const updates: Prisma.UserUpdateInput = {};
    if (region) updates.region = region as Region;
    if (typeof locale === 'string' && locale.trim()) updates.preferredLocale = locale.trim();
    if (typeof currency === 'string' && currency.trim()) updates.preferredCurrency = currency.trim().toUpperCase();
    if (typeof timezone === 'string' && timezone.trim()) updates.timezone = timezone.trim();

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Give at least one of region, locale, currency or timezone.',
      });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updates,
      select: { region: true, preferredLocale: true, preferredCurrency: true, timezone: true },
    });

    res.json({
      success: true,
      message: 'Region preferences updated',
      data: updated,
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
