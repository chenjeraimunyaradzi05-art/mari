/**
 * Compliance Service - Client Side
 * API client for compliance endpoints
 * Phase 4: UK/EU Market Launch
 */

const API_BASE = '';

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
};

async function parseApiResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  let payload: ApiEnvelope<T> | null = null;

  try {
    payload = (await response.json()) as ApiEnvelope<T>;
  } catch {
    payload = null;
  }

  if (!response.ok || !payload) {
    throw new Error(payload?.error || payload?.message || fallbackMessage);
  }

  return payload.data;
}

// Types
export interface RegionConfig {
  code: string;
  name: string;
  currency: string;
  currencySymbol: string;
  vatRate: number;
  vatInclusive: boolean;
  gdprRequired: boolean;
  minAge: number;
  regulations: string[];
  dataProtectionAuthority?: {
    name: string;
    website: string;
    email: string;
  };
}

export interface PricingTier {
  region: string;
  tier: string;
  price: number;
  currency: string;
  vatRate: number;
  priceIncVat: number;
  billingFrequency: string;
}

export interface ComplianceStatusResponse {
  status: 'compliant' | 'pending' | 'non-compliant';
  region?: string;
  gdprApplicable?: boolean;
  checkedAt?: string;
  requirements?: {
    dataProcessingConsent?: boolean;
  };
}

export interface LegalDocument {
  id: string;
  documentType: string;
  title: string;
  version: string;
  effectiveDate: string;
  url: string;
  required: boolean;
  regions: string[];
}

export interface LegalAgreementRecord {
  documentType: string;
  documentVersion: string;
  acceptedAt: string;
}

export interface ContentReportRequest {
  contentType: 'post' | 'message' | 'profile' | 'comment' | 'other';
  contentId: string;
  reason: 'illegal' | 'harmful' | 'harassment' | 'hate_speech' | 'spam' | 'misinformation' | 'other';
  description?: string;
}

/**
 * Get region configuration by country code
 */
export async function getRegionConfig(countryCode: string): Promise<RegionConfig> {
  const response = await fetch(`${API_BASE}/api/compliance/region/${countryCode}`);

  const payload = await parseApiResponse<{
    region?: string;
    config?: {
      code?: string;
      name?: string;
      currency?: string;
      currencySymbol?: string;
      vatRate?: number;
      vatInclusive?: boolean;
      gdprApplicable?: boolean;
      gdprRequired?: boolean;
      ageOfConsent?: number;
      minAge?: number;
      regulations?: string[];
      regulatoryBody?: string;
      regulatoryUrl?: string;
    };
    gdprApplicable?: boolean;
  }>(response, 'Failed to fetch region configuration');

  const config = payload?.config || {};
  const gdprRequired =
    Boolean(config.gdprRequired) ||
    Boolean(config.gdprApplicable) ||
    Boolean(payload?.gdprApplicable);

  return {
    code: config.code || payload?.region || countryCode.toUpperCase(),
    name: config.name || payload?.region || 'Unknown Region',
    currency: config.currency || 'USD',
    currencySymbol: config.currencySymbol || '$',
    vatRate: Number(config.vatRate ?? 0),
    vatInclusive: Boolean(config.vatInclusive),
    gdprRequired,
    minAge: Number(config.minAge ?? config.ageOfConsent ?? 13),
    regulations: Array.isArray(config.regulations)
      ? config.regulations
      : gdprRequired
        ? ['GDPR']
        : [],
    dataProtectionAuthority:
      config.regulatoryBody && config.regulatoryUrl
        ? {
            name: config.regulatoryBody,
            website: config.regulatoryUrl,
            email: '',
          }
        : undefined,
  };
}

/**
 * Get pricing for a specific region
 */
export async function getRegionalPricing(region: string): Promise<PricingTier[]> {
  const response = await fetch(`${API_BASE}/api/compliance/pricing/${region}`);

  const data = await parseApiResponse<{
    tiers?: PricingTier[];
    pricing?: Record<string, { monthly: number; annual: number }>;
    currency?: string;
    vatRate?: number;
    vatInclusive?: boolean;
  }>(response, 'Failed to fetch regional pricing');

  if (Array.isArray(data.tiers)) {
    return data.tiers;
  }

  const pricingEntries = Object.entries(data.pricing || {});
  return pricingEntries.flatMap(([tier, plan]) => {
    const currency = data.currency || region;
    const vatRate = Number(data.vatRate ?? 0);
    const vatInclusive = Boolean(data.vatInclusive);

    const toIncVat = (price: number) => (vatInclusive ? price : Number((price * (1 + vatRate)).toFixed(2)));

    return [
      {
        region,
        tier,
        price: Number(plan.monthly),
        currency,
        vatRate,
        priceIncVat: toIncVat(Number(plan.monthly)),
        billingFrequency: 'monthly',
      },
      {
        region,
        tier,
        price: Number(plan.annual),
        currency,
        vatRate,
        priceIncVat: toIncVat(Number(plan.annual)),
        billingFrequency: 'annual',
      },
    ];
  });
}

/**
 * Get GDPR compliance information
 */
export async function getGDPRInfo(): Promise<{
  dataController: {
    name: string;
    address: string;
    email: string;
    phone: string;
  };
  dpo: {
    name: string;
    email: string;
  };
  supervisoryAuthority: {
    name: string;
    website: string;
  };
  rights: string[];
  legalBases: Array<{
    purpose: string;
    basis: string;
  }>;
  retentionPeriods: Array<{
    dataType: string;
    period: string;
  }>;
  transfers: {
    countries: string[];
    safeguards: string;
  };
}> {
  const response = await fetch(`${API_BASE}/api/compliance/gdpr`);

  return parseApiResponse(response, 'Failed to fetch GDPR information');
}

/**
 * Get UK Online Safety Act compliance information
 */
export async function getUKSafetyInfo(): Promise<{
  contentModerationPolicy: string;
  reportingMechanisms: string[];
  appealProcess: string;
  transparencyReports: string;
  ageVerification: {
    required: boolean;
    methods: string[];
  };
  harmfulContentCategories: string[];
  userEmpowermentTools: string[];
}> {
  const response = await fetch(`${API_BASE}/api/compliance/uk-safety`);

  return parseApiResponse(response, 'Failed to fetch UK Online Safety information');
}

/**
 * Report content under UK Online Safety Act
 */
export async function reportContent(report: ContentReportRequest): Promise<{
  ticketId: string;
  status: string;
  expectedResponse: string;
}> {
  const response = await fetch(`${API_BASE}/api/compliance/report-content`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(report),
  });

  return parseApiResponse(response, 'Failed to submit content report');
}

/**
 * Get authenticated compliance status for current user
 */
export async function getComplianceStatus(): Promise<ComplianceStatusResponse> {
  const response = await fetch(`${API_BASE}/api/compliance/status`, {
    credentials: 'include',
  });

  return parseApiResponse(response, 'Failed to fetch compliance status');
}

/**
 * Get legal documents for region
 */
export async function getLegalDocuments(region?: string): Promise<LegalDocument[]> {
  const query = region ? `?region=${encodeURIComponent(region)}` : '';
  const response = await fetch(`${API_BASE}/api/compliance/legal-documents${query}`, {
    credentials: 'include',
  });

  return parseApiResponse(response, 'Failed to fetch legal documents');
}

/**
 * Get current user's legal agreement acknowledgements
 */
export async function getAgreementHistory(): Promise<LegalAgreementRecord[]> {
  const response = await fetch(`${API_BASE}/api/compliance/agreements`, {
    credentials: 'include',
  });

  return parseApiResponse(response, 'Failed to fetch agreement history');
}

/**
 * Record legal agreement acknowledgement
 */
export async function recordAgreement(documentType: string, documentVersion: string): Promise<{
  acceptedAt: string;
  documentType: string;
  documentVersion: string;
}> {
  const response = await fetch(`${API_BASE}/api/compliance/agreements`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({
      documentType,
      documentVersion,
    }),
  });

  return parseApiResponse(response, 'Failed to record agreement');
}

/**
 * Detect user's region from browser
 */
export function detectUserRegion(): string {
  try {
    if (typeof window === 'undefined') {
      return 'ANZ';
    }

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const locale = navigator.language;

    // UK detection
    if (timezone.startsWith('Europe/London') || timezone === 'GB') {
      return 'UK';
    }

    // EU detection
    if (timezone.startsWith('Europe/')) {
      const countryCode = locale.split('-')[1]?.toUpperCase();
      const euCountries = [
        'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
        'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
        'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'IS', 'LI', 'NO'
      ];
      if (countryCode && euCountries.includes(countryCode)) {
        return countryCode;
      }
      return 'EU';
    }

    // US detection
    if (timezone.startsWith('America/')) {
      return 'US';
    }

    // ANZ detection
    if (timezone.startsWith('Australia/') || timezone.startsWith('Pacific/Auckland')) {
      return 'ANZ';
    }

    // Fallback to locale
    const countryCode = locale.split('-')[1]?.toUpperCase();
    if (countryCode === 'GB') return 'UK';
    if (countryCode === 'US') return 'US';
    if (countryCode === 'AU' || countryCode === 'NZ') return 'ANZ';

    return 'ANZ'; // Default
  } catch {
    return 'ANZ';
  }
}

/**
 * Format price with correct currency
 */
export function formatPrice(
  amount: number,
  currency: string,
  locale?: string
): string {
  const userLocale = locale || (typeof window !== 'undefined' ? navigator.language : 'en-AU');
  
  return new Intl.NumberFormat(userLocale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Check if user is in GDPR region
 */
export function isGDPRRegion(region: string): boolean {
  const gdprRegions = [
    'UK', 'GB',
    'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
    'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
    'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'IS', 'LI', 'NO', 'EU'
  ];
  return gdprRegions.includes(region);
}

const complianceService = {
  getRegionConfig,
  getRegionalPricing,
  getGDPRInfo,
  getUKSafetyInfo,
  reportContent,
  getComplianceStatus,
  getLegalDocuments,
  getAgreementHistory,
  recordAgreement,
  detectUserRegion,
  formatPrice,
  isGDPRRegion,
};

export default complianceService;
