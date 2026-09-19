/**
 * UK/EU Region Configuration
 * Handles region-specific settings, pricing, and compliance requirements
 * Phase 4: UK/EU Market Launch
 */

export interface RegionConfig {
  code: string;
  name: string;
  currency: string;
  currencySymbol: string;
  locale: string;
  timezone: string;
  dateFormat: string;
  gdprApplicable: boolean;
  vatRate: number;
  vatInclusive: boolean;
  regulatoryBody: string;
  regulatoryUrl: string;
  ageOfConsent: number;
  dataResidency: string;
  supportHours: string;
}

/**
 * The one age the platform asks for at sign-up (Terms of Service 2.1). The
 * Privacy Policy and the Australian region config quote the same number so a
 * reader never meets two different ages on two different pages.
 */
export const PLATFORM_MINIMUM_AGE = 18;

export const REGION_CONFIGS: Record<string, RegionConfig> = {
  UK: {
    code: 'UK',
    name: 'United Kingdom',
    currency: 'GBP',
    currencySymbol: '£',
    locale: 'en-GB',
    timezone: 'Europe/London',
    dateFormat: 'DD/MM/YYYY',
    gdprApplicable: true,
    vatRate: 0.20,
    vatInclusive: true,
    regulatoryBody: 'ICO (Information Commissioner\'s Office)',
    regulatoryUrl: 'https://ico.org.uk/',
    ageOfConsent: 13,
    dataResidency: 'EU/UK',
    supportHours: '09:00-18:00 GMT',
  },
  EU: {
    code: 'EU',
    name: 'European Union',
    currency: 'EUR',
    currencySymbol: '€',
    locale: 'en-EU',
    timezone: 'Europe/Brussels',
    dateFormat: 'DD/MM/YYYY',
    gdprApplicable: true,
    vatRate: 0.21, // Average EU VAT
    vatInclusive: true,
    regulatoryBody: 'National DPA',
    regulatoryUrl: 'https://edpb.europa.eu/',
    ageOfConsent: 16,
    dataResidency: 'EU',
    supportHours: '09:00-18:00 CET',
  },
  ANZ: {
    code: 'ANZ',
    name: 'Australia & New Zealand',
    currency: 'AUD',
    currencySymbol: '$',
    locale: 'en-AU',
    timezone: 'Australia/Sydney',
    dateFormat: 'DD/MM/YYYY',
    gdprApplicable: false,
    vatRate: 0.10, // GST
    vatInclusive: true,
    regulatoryBody: 'OAIC',
    regulatoryUrl: 'https://www.oaic.gov.au/',
    // The Privacy Act 1988 sets no digital age of consent (the OAIC assesses
    // capacity case by case), so the number every Australian surface quotes is
    // the platform's own minimum age from the Terms (2.1): 18.
    ageOfConsent: PLATFORM_MINIMUM_AGE,
    dataResidency: 'ANZ',
    supportHours: '09:00-18:00 AEST',
  },
  US: {
    code: 'US',
    name: 'United States',
    currency: 'USD',
    currencySymbol: '$',
    locale: 'en-US',
    timezone: 'America/New_York',
    dateFormat: 'MM/DD/YYYY',
    gdprApplicable: false,
    vatRate: 0, // Sales tax varies by state
    vatInclusive: false,
    regulatoryBody: 'FTC / State AGs',
    regulatoryUrl: 'https://www.ftc.gov/',
    ageOfConsent: 13, // COPPA
    dataResidency: 'US',
    supportHours: '09:00-18:00 EST',
  },
  ROW: {
    code: 'ROW',
    name: 'Rest of World',
    currency: 'USD',
    currencySymbol: '$',
    locale: 'en-US',
    timezone: 'UTC',
    dateFormat: 'YYYY-MM-DD',
    gdprApplicable: false,
    vatRate: 0,
    vatInclusive: false,
    regulatoryBody: 'Local regulators',
    // Empty on purpose: athena.com is not a domain ATHENA owns, and there is
    // no single regulator for the rest of the world to point at.
    regulatoryUrl: '',
    ageOfConsent: 13,
    dataResidency: 'Regional',
    supportHours: '24/7 online',
  },
};

// UK/EU specific pricing (VAT inclusive)
export const UK_PRICING = {
  PREMIUM_CAREER: {
    monthly: 7.99,
    annual: 79.99,
    stripePriceId: {
      monthly: 'price_uk_career_monthly',
      annual: 'price_uk_career_annual',
    },
  },
  PREMIUM_PROFESSIONAL: {
    monthly: 19.99,
    annual: 199.99,
    stripePriceId: {
      monthly: 'price_uk_professional_monthly',
      annual: 'price_uk_professional_annual',
    },
  },
  PREMIUM_ENTREPRENEUR: {
    monthly: 14.99,
    annual: 149.99,
    stripePriceId: {
      monthly: 'price_uk_entrepreneur_monthly',
      annual: 'price_uk_entrepreneur_annual',
    },
  },
  PREMIUM_CREATOR: {
    monthly: 79.99,
    annual: 799.99,
    stripePriceId: {
      monthly: 'price_uk_creator_monthly',
      annual: 'price_uk_creator_annual',
    },
  },
};

export const EU_PRICING = {
  PREMIUM_CAREER: {
    monthly: 9.99,
    annual: 99.99,
    stripePriceId: {
      monthly: 'price_eu_career_monthly',
      annual: 'price_eu_career_annual',
    },
  },
  PREMIUM_PROFESSIONAL: {
    monthly: 24.99,
    annual: 249.99,
    stripePriceId: {
      monthly: 'price_eu_professional_monthly',
      annual: 'price_eu_professional_annual',
    },
  },
  PREMIUM_ENTREPRENEUR: {
    monthly: 19.99,
    annual: 199.99,
    stripePriceId: {
      monthly: 'price_eu_entrepreneur_monthly',
      annual: 'price_eu_entrepreneur_annual',
    },
  },
  PREMIUM_CREATOR: {
    monthly: 99.99,
    annual: 999.99,
    stripePriceId: {
      monthly: 'price_eu_creator_monthly',
      annual: 'price_eu_creator_annual',
    },
  },
};

// UK Online Safety Act compliance requirements
export const UK_ONLINE_SAFETY_CONFIG = {
  // Age verification requirements
  ageVerificationRequired: false, // Not yet mandated for our category
  minimumAge: 13,
  
  // Content moderation requirements
  illegalContentRemovalHours: 24,
  harmfulContentReviewHours: 48,
  
  // Reporting requirements
  reportingMechanismRequired: true,
  transparencyReportRequired: true,
  transparencyReportFrequency: 'annual',
  
  // Safety features
  blockingRequired: true,
  mutingRequired: true,
  contentFilteringAvailable: true,
  
  // Regulator contact
  ofcomUrl: 'https://www.ofcom.org.uk/',
};

/**
 * Online Safety Act 2021 (Cth) and the eSafety Commissioner.
 *
 * ATHENA is a Queensland company, so this is the home regime; the UK config
 * above is layered on for members there. The review targets are the same
 * numbers because the platform runs one moderation queue, not one per
 * regulator, and the reporting, blocking and appeal mechanisms the UK Act asks
 * for are the ones the Basic Online Safety Expectations ask for too.
 */
export const AU_ONLINE_SAFETY_CONFIG = {
  act: 'Online Safety Act 2021 (Cth)',
  expectations: 'Basic Online Safety Expectations',

  // Age
  ageVerificationRequired: false,
  minimumAge: PLATFORM_MINIMUM_AGE,

  // Content moderation targets
  illegalContentRemovalHours: 24,
  harmfulContentReviewHours: 48,

  // Reporting requirements
  reportingMechanismRequired: true,
  transparencyReportRequired: true,
  transparencyReportFrequency: 'annual',

  // Safety features
  blockingRequired: true,
  mutingRequired: true,
  contentFilteringAvailable: true,

  // Regulator contact
  regulator: 'eSafety Commissioner',
  regulatorUrl: 'https://www.esafety.gov.au/',
  complaintUrl: 'https://www.esafety.gov.au/report',
};

/**
 * What a member can ask of us under the Privacy Act 1988 (Cth). The APP set is
 * the home regime for every member; UK and EU members also have the GDPR set
 * below. Response periods are the ones the Privacy Center and the Australian
 * Privacy Statement already promise, so the API cannot drift from the page.
 */
export const AU_PRIVACY_CONFIG = {
  act: 'Privacy Act 1988 (Cth)',
  principles: 'Australian Privacy Principles',
  regulator: 'Office of the Australian Information Commissioner (OAIC)',
  regulatorShortName: 'OAIC',
  regulatorUrl: 'https://www.oaic.gov.au/',
  complaintUrl: 'https://www.oaic.gov.au/privacy/privacy-complaints',

  // APP 12.4 and APP 13.5 ask for a response within a reasonable period, which
  // the OAIC reads as 30 days.
  accessResponseDays: 30,
  correctionResponseDays: 30,
  complaintAcknowledgeDays: 7,
  complaintResolveDays: 30,

  // s 26WH: an eligible data breach is assessed within 30 days of suspicion.
  ndbAssessmentDays: 30,

  rights: [
    {
      id: 'access',
      principle: 'APP 12',
      name: 'See what we hold about you',
      description: 'Download a copy of your personal information from the Privacy Center, without charge.',
    },
    {
      id: 'correction',
      principle: 'APP 13',
      name: 'Correct it',
      description: 'Have inaccurate, out-of-date or incomplete information corrected, or your statement recorded beside it.',
    },
    {
      id: 'direct_marketing_opt_out',
      principle: 'APP 7',
      name: 'Say no to marketing',
      description: 'Opt out of direct marketing at any time; every marketing email carries an unsubscribe link.',
    },
    {
      id: 'anonymity',
      principle: 'APP 2',
      name: 'Deal with us anonymously where practicable',
      description: 'Use a pseudonym on the platform; a legal name is only needed where a payment or the law requires it.',
    },
    {
      id: 'overseas_disclosure',
      principle: 'APP 5 and APP 8',
      name: 'Know where your information goes',
      description: 'Be told which providers handle your information and where, before it is disclosed overseas.',
    },
    {
      id: 'complaint',
      principle: 'APP 1 and Part V',
      name: 'Complain',
      description: 'Complain to us first, and to the OAIC if you are not satisfied with our answer.',
    },
  ],
};

/**
 * The six GDPR rights the platform exercises for UK and EU members, kept here
 * beside the APP set so both endpoints read from one list.
 */
export const GDPR_RIGHTS = [
  { id: 'access', article: 'Article 15', name: 'Right of Access', description: 'Request a copy of your personal data' },
  { id: 'rectification', article: 'Article 16', name: 'Right to Rectification', description: 'Correct inaccurate personal data' },
  { id: 'erasure', article: 'Article 17', name: 'Right to Erasure', description: 'Request deletion of your personal data' },
  { id: 'restriction', article: 'Article 18', name: 'Right to Restriction', description: 'Limit how we process your data' },
  { id: 'portability', article: 'Article 20', name: 'Right to Portability', description: 'Receive your data in a portable format' },
  { id: 'objection', article: 'Article 21', name: 'Right to Object', description: 'Object to certain types of processing' },
];

/**
 * A mailbox on a domain ATHENA actually owns, or nothing.
 *
 * Mirrors client/src/lib/contact.ts: dpo@athena.com was once published as the
 * statutory contact for data-subject requests, and ATHENA does not own
 * athena.com, so a rights request sent there went to a stranger. Until
 * CONTACT_DOMAIN is set, the honest answer is null and the in-product route
 * that genuinely reaches the team.
 */
export function resolveContactEmail(box: 'privacy' | 'dpo' | 'support' | 'legal'): string | null {
  const domain = (process.env.CONTACT_DOMAIN || process.env.NEXT_PUBLIC_CONTACT_DOMAIN || '').trim();
  return domain ? `${box}@${domain}` : null;
}

/** Where a privacy question goes when there is no mailbox to publish. */
export const PRIVACY_CONTACT_ROUTE = '/privacy-center';

// GDPR-specific requirements
export const GDPR_CONFIG = {
  // Data subject rights
  dsarResponseDays: 30,
  dsarExtensionDays: 60, // For complex requests
  
  // Breach notification
  breachNotificationHours: 72,
  
  // Consent requirements
  explicitConsentRequired: true,
  granularConsentRequired: true,
  consentWithdrawalEasy: true,
  
  // Data minimization
  dataMinimizationEnforced: true,
  purposeLimitationEnforced: true,
  
  // International transfers
  sccsRequired: true, // Standard Contractual Clauses
  adequacyDecisionCountries: ['UK', 'Canada', 'Japan', 'South Korea', 'Argentina'],
  
  // DPO requirements
  dpoRequired: true, // For large-scale processing
  // Null until a domain ATHENA owns is configured; see resolveContactEmail.
  dpoContact: resolveContactEmail('dpo'),
  dpoContactRoute: PRIVACY_CONTACT_ROUTE,
};

/**
 * Get region configuration from country code
 */
export function getRegionFromCountry(countryCode: string): string {
  const ukCountries = ['GB', 'UK'];
  const euCountries = [
    'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
    'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
    'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  ];
  const anzCountries = ['AU', 'NZ'];
  const rowCountries = ['JP', 'KR', 'IN', 'BR', 'MX'];
  
  if (ukCountries.includes(countryCode)) return 'UK';
  if (euCountries.includes(countryCode)) return 'EU';
  if (anzCountries.includes(countryCode)) return 'ANZ';
  if (countryCode === 'US') return 'US';
  if (rowCountries.includes(countryCode)) return 'ROW';
  
  return 'ROW';
}

/**
 * Get pricing for region
 */
export function getPricingForRegion(region: string) {
  switch (region) {
    case 'UK':
      return UK_PRICING;
    case 'EU':
      return EU_PRICING;
    default:
      return null; // Use default pricing
  }
}

/**
 * Check if GDPR applies to region
 */
export function isGDPRRegion(region: string): boolean {
  return region === 'UK' || region === 'EU';
}

/**
 * Format currency for region
 */
export function formatCurrency(amount: number, region: string): string {
  const config = REGION_CONFIGS[region] || REGION_CONFIGS.ANZ;
  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: config.currency,
  }).format(amount);
}

/**
 * Format date for region
 */
export function formatDate(date: Date, region: string): string {
  const config = REGION_CONFIGS[region] || REGION_CONFIGS.ANZ;
  return new Intl.DateTimeFormat(config.locale, {
    dateStyle: 'medium',
  }).format(date);
}
