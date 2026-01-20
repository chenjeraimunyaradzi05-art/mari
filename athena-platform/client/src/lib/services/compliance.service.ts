/**
 * Compliance Service - Client Side
 * API client for compliance endpoints
 * Phase 4: UK/EU Market Launch
 */

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000').replace(/\/$/, '');

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
  
  if (!response.ok) {
    throw new Error('Failed to fetch region configuration');
  }

  const data = await response.json();
  return data.data;
}

/**
 * Get pricing for a specific region
 */
export async function getRegionalPricing(region: string): Promise<PricingTier[]> {
  const response = await fetch(`${API_BASE}/api/compliance/pricing/${region}`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch regional pricing');
  }

  const data = await response.json();
  return data.data.tiers;
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
  
  if (!response.ok) {
    throw new Error('Failed to fetch GDPR information');
  }

  const data = await response.json();
  return data.data;
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
  
  if (!response.ok) {
    throw new Error('Failed to fetch UK Online Safety information');
  }

  const data = await response.json();
  return data.data;
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
    body: JSON.stringify(report),
  });

  if (!response.ok) {
    throw new Error('Failed to submit content report');
  }

  const data = await response.json();
  return data.data;
}

/**
 * Detect user's region from browser
 */
export function detectUserRegion(): string {
  try {
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
  const userLocale = locale || navigator.language;
  
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

export default {
  getRegionConfig,
  getRegionalPricing,
  getGDPRInfo,
  getUKSafetyInfo,
  reportContent,
  detectUserRegion,
  formatPrice,
  isGDPRRegion,
};
