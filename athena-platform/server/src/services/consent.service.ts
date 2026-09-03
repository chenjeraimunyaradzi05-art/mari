/**
 * Consent Management Service
 * Handles granular consent tracking, verification, and audit
 * Phase 4: UK/EU Market Launch
 */

import { ConsentType, ConsentStatus, DSARStatus, DSARType } from '@prisma/client';
import { prisma } from '../utils/prisma';

// Consent type groupings for UI
export const CONSENT_GROUPS = {
  marketing: [
    ConsentType.MARKETING_EMAIL,
    ConsentType.MARKETING_SMS,
    ConsentType.MARKETING_PUSH,
  ],
  dataProcessing: [
    ConsentType.DATA_PROCESSING,
    ConsentType.PERSONALIZATION,
    ConsentType.THIRD_PARTY_SHARING,
  ],
  analytics: [ConsentType.ANALYTICS],
  cookies: [
    ConsentType.COOKIE_ESSENTIAL,
    ConsentType.COOKIE_ANALYTICS,
    ConsentType.COOKIE_MARKETING,
    ConsentType.COOKIE_FUNCTIONAL,
  ],
};

// Consent descriptions for UI
export const CONSENT_DESCRIPTIONS: Record<ConsentType, { title: string; description: string; required: boolean }> = {
  [ConsentType.MARKETING_EMAIL]: {
    title: 'Marketing Emails',
    description: 'Receive promotional emails, newsletters, and special offers',
    required: false,
  },
  [ConsentType.MARKETING_SMS]: {
    title: 'Marketing SMS',
    description: 'Receive promotional text messages',
    required: false,
  },
  [ConsentType.MARKETING_PUSH]: {
    title: 'Push Notifications',
    description: 'Receive push notifications for promotions and updates',
    required: false,
  },
  [ConsentType.DATA_PROCESSING]: {
    title: 'Data Processing',
    description: 'Allow processing of your data to provide our services',
    required: true,
  },
  [ConsentType.ANALYTICS]: {
    title: 'Analytics',
    description: 'Help us improve by allowing anonymous usage analytics',
    required: false,
  },
  [ConsentType.PERSONALIZATION]: {
    title: 'Personalization',
    description: 'Allow personalized recommendations based on your activity',
    required: false,
  },
  [ConsentType.THIRD_PARTY_SHARING]: {
    title: 'Third-Party Sharing',
    description: 'Allow sharing data with trusted partners for enhanced services',
    required: false,
  },
  [ConsentType.COOKIE_ESSENTIAL]: {
    title: 'Essential Cookies',
    description: 'Required for the website to function properly',
    required: true,
  },
  [ConsentType.COOKIE_ANALYTICS]: {
    title: 'Analytics Cookies',
    description: 'Help us understand how visitors interact with our website',
    required: false,
  },
  [ConsentType.COOKIE_MARKETING]: {
    title: 'Marketing Cookies',
    description: 'Used to track visitors across websites for advertising',
    required: false,
  },
  [ConsentType.COOKIE_FUNCTIONAL]: {
    title: 'Functional Cookies',
    description: 'Enable enhanced functionality and personalization',
    required: false,
  },
};

const ALL_CONSENT_TYPES = Object.keys(CONSENT_DESCRIPTIONS) as ConsentType[];

// The consent record behind each banner toggle. Essential cookies have no
// toggle because the service cannot run without them.
const COOKIE_CATEGORY_CONSENTS = {
  analytics: ConsentType.COOKIE_ANALYTICS,
  marketing: ConsentType.COOKIE_MARKETING,
  functional: ConsentType.COOKIE_FUNCTIONAL,
} as const;

export type CookieCategory = keyof typeof COOKIE_CATEGORY_CONSENTS;

export type CookiePreferences = Record<CookieCategory, boolean>;

/**
 * Article 18 lets a member freeze a kind of processing without erasing
 * anything, and the freeze has to survive their own later clicks: a restriction
 * outranks a live consent record until it is lifted.
 *
 * Only processing this codebase can actually switch off appears here. A
 * category we cannot enforce would be a promise on a screen and nothing behind
 * it, which is worse than not offering it. Each one names the consent records
 * it freezes, because consent is what every processing path in the platform
 * consults before it acts.
 */
export type RestrictableProcessing =
  | 'MARKETING'
  | 'ANALYTICS'
  | 'PERSONALIZATION'
  | 'THIRD_PARTY_SHARING';

export const RESTRICTABLE_PROCESSING: Record<RestrictableProcessing, ConsentType[]> = {
  MARKETING: [
    ConsentType.MARKETING_EMAIL,
    ConsentType.MARKETING_SMS,
    ConsentType.MARKETING_PUSH,
    ConsentType.COOKIE_MARKETING,
  ],
  ANALYTICS: [ConsentType.ANALYTICS, ConsentType.COOKIE_ANALYTICS],
  PERSONALIZATION: [ConsentType.PERSONALIZATION, ConsentType.COOKIE_FUNCTIONAL],
  THIRD_PARTY_SHARING: [ConsentType.THIRD_PARTY_SHARING],
};

export const RESTRICTABLE_PROCESSING_TYPES = Object.keys(
  RESTRICTABLE_PROCESSING
) as RestrictableProcessing[];

// Reverse index, so a consent check can tell in memory whether a type is even
// restrictable and skip the restriction lookup entirely when it is not.
const RESTRICTION_GROUP_BY_CONSENT = new Map<ConsentType, RestrictableProcessing>(
  RESTRICTABLE_PROCESSING_TYPES.flatMap((group) =>
    RESTRICTABLE_PROCESSING[group].map(
      (consentType) => [consentType, group] as [ConsentType, RestrictableProcessing]
    )
  )
);

/** Shape of DSARRequest.requestDetails for a RESTRICTION request. */
interface RestrictionDetails {
  processingTypes?: unknown;
  reason?: unknown;
}

/**
 * Read the frozen categories back out of a stored restriction request.
 *
 * requestDetails is free text on the model, so anything unrecognised is
 * dropped: a category we no longer enforce must not be reported as enforced.
 */
export function parseRestrictedProcessing(requestDetails: string | null): RestrictableProcessing[] {
  if (!requestDetails) return [];

  let parsed: RestrictionDetails;
  try {
    parsed = JSON.parse(requestDetails) as RestrictionDetails;
  } catch {
    return [];
  }

  if (!Array.isArray(parsed?.processingTypes)) return [];

  return parsed.processingTypes.filter(
    (value): value is RestrictableProcessing =>
      typeof value === 'string' && value in RESTRICTABLE_PROCESSING
  );
}

export class ConsentService {
  /**
   * Initialize default consents for new user
   */
  async initializeUserConsents(
    userId: string,
    context: { ipAddress?: string; userAgent?: string; region?: string }
  ): Promise<void> {
    const requiredConsents = Object.entries(CONSENT_DESCRIPTIONS)
      .filter(([_, config]) => config.required)
      .map(([type]) => type as ConsentType);

    for (const consentType of requiredConsents) {
      await prisma.consentRecord.upsert({
        where: { userId_consentType: { userId, consentType } },
        update: {},
        create: {
          userId,
          consentType,
          status: ConsentStatus.GRANTED,
          version: '1.0',
          grantedAt: new Date(),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          region: context.region,
        },
      });
    }
  }

  /**
   * Whether a value coming off the wire names a consent we actually hold.
   */
  isKnownConsentType(value: string): value is ConsentType {
    return (ALL_CONSENT_TYPES as string[]).includes(value);
  }

  /**
   * Whether the service can run at all without this consent.
   */
  isRequiredConsent(consentType: ConsentType): boolean {
    return CONSENT_DESCRIPTIONS[consentType].required;
  }

  describeConsent(consentType: ConsentType) {
    return CONSENT_DESCRIPTIONS[consentType];
  }

  /**
   * Whether a value coming off the wire names a kind of processing that can
   * actually be restricted.
   */
  isRestrictableProcessing(value: unknown): value is RestrictableProcessing {
    return typeof value === 'string' && value in RESTRICTABLE_PROCESSING;
  }

  /**
   * The processing a member has frozen under Article 18 and not since lifted.
   *
   * A restriction lives on the DSARRequest row that asked for it: COMPLETED
   * means the freeze is in force, EXPIRED means it was lifted. There is nowhere
   * else to hold it without a schema change, and keeping it on the request is
   * also what lets a regulator read the decision and its date off one row.
   */
  async getRestrictedProcessing(userId: string): Promise<RestrictableProcessing[]> {
    const restrictions = await prisma.dSARRequest.findMany({
      where: {
        userId,
        type: DSARType.RESTRICTION,
        status: DSARStatus.COMPLETED,
      },
      select: { requestDetails: true },
    });

    const frozen = new Set<RestrictableProcessing>();
    for (const restriction of restrictions) {
      for (const processing of parseRestrictedProcessing(restriction.requestDetails)) {
        frozen.add(processing);
      }
    }

    return [...frozen];
  }

  /**
   * The consent records currently overridden by a restriction. Empty for the
   * overwhelming majority of members, so callers that need several answers at
   * once should read it once rather than per consent.
   */
  async getRestrictedConsentTypes(userId: string): Promise<Set<ConsentType>> {
    const frozen = await this.getRestrictedProcessing(userId);
    return new Set(frozen.flatMap((group) => RESTRICTABLE_PROCESSING[group]));
  }

  /**
   * Check if user has granted specific consent
   *
   * This is the single reader every processing path goes through, which is why
   * both the record's own expiry and any Article 18 restriction are applied
   * here rather than at each call site.
   */
  async hasConsent(userId: string, consentType: ConsentType): Promise<boolean> {
    const consent = await prisma.consentRecord.findUnique({
      where: { userId_consentType: { userId, consentType } },
    });

    if (consent?.status !== ConsentStatus.GRANTED) return false;

    // A consent that has run out is not a consent. Nothing sets expiresAt today,
    // but the column exists and an expired row must not be treated as live.
    if (consent.expiresAt && consent.expiresAt.getTime() <= Date.now()) return false;

    const group = RESTRICTION_GROUP_BY_CONSENT.get(consentType);
    if (!group) return true;

    const frozen = await this.getRestrictedProcessing(userId);
    return !frozen.includes(group);
  }

  /**
   * Refuse to carry out something the member has not agreed to. Callers that
   * would otherwise process data on a consent basis go through here.
   */
  async assertConsent(userId: string, consentType: ConsentType): Promise<void> {
    if (await this.hasConsent(userId, consentType)) return;

    throw new Error(
      `${CONSENT_DESCRIPTIONS[consentType].title} consent has not been granted by this member`
    );
  }

  /**
   * Mirror a cookie banner choice onto the member's consent records, so the
   * banner and the Privacy Centre are never two separate sources of truth.
   */
  async recordCookiePreferences(
    userId: string,
    preferences: CookiePreferences,
    context: { ipAddress?: string; userAgent?: string; region?: string }
  ): Promise<void> {
    await this.initializeUserConsents(userId, context);

    // A banner click cannot quietly undo an Article 18 restriction. The record
    // stored is the one we will actually honour.
    const permitted = await this.applyRestrictions(userId, preferences);

    for (const [category, consentType] of Object.entries(COOKIE_CATEGORY_CONSENTS)) {
      const granted = permitted[category as CookieCategory];
      const status = granted ? ConsentStatus.GRANTED : ConsentStatus.WITHDRAWN;

      await prisma.consentRecord.upsert({
        where: { userId_consentType: { userId, consentType } },
        update: {
          status,
          grantedAt: granted ? new Date() : null,
          withdrawnAt: granted ? null : new Date(),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          region: context.region,
        },
        create: {
          userId,
          consentType,
          status,
          version: '1.0',
          grantedAt: granted ? new Date() : null,
          withdrawnAt: granted ? null : new Date(),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          region: context.region,
        },
      });
    }
  }

  /**
   * The cookie categories a member has actually agreed to. This is what decides
   * whether the client may load an analytics or marketing script, so it comes
   * from the stored record rather than from whatever the browser reports. Null
   * when the member has never been asked.
   */
  async getCookiePreferences(userId: string): Promise<CookiePreferences | null> {
    const categories = Object.keys(COOKIE_CATEGORY_CONSENTS) as CookieCategory[];

    const records = await prisma.consentRecord.findMany({
      where: {
        userId,
        consentType: { in: categories.map((category) => COOKIE_CATEGORY_CONSENTS[category]) },
      },
    });

    if (records.length === 0) return null;

    const stored = categories.reduce((preferences, category) => {
      const record = records.find(c => c.consentType === COOKIE_CATEGORY_CONSENTS[category]);
      preferences[category] = record?.status === ConsentStatus.GRANTED;
      return preferences;
    }, {} as CookiePreferences);

    return this.applyRestrictions(userId, stored);
  }

  /**
   * Cookie choices with any restricted category forced off, so the banner
   * script is told what the platform will actually do rather than what the
   * member last clicked.
   */
  async applyRestrictions(
    userId: string,
    preferences: CookiePreferences
  ): Promise<CookiePreferences> {
    const frozen = await this.getRestrictedConsentTypes(userId);
    if (frozen.size === 0) return preferences;

    const categories = Object.keys(COOKIE_CATEGORY_CONSENTS) as CookieCategory[];
    return categories.reduce((permitted, category) => {
      permitted[category] =
        preferences[category] && !frozen.has(COOKIE_CATEGORY_CONSENTS[category]);
      return permitted;
    }, {} as CookiePreferences);
  }

  /**
   * Check multiple consents at once
   */
  async hasConsents(
    userId: string,
    consentTypes: ConsentType[]
  ): Promise<Record<ConsentType, boolean>> {
    const [consents, frozen] = await Promise.all([
      prisma.consentRecord.findMany({
        where: {
          userId,
          consentType: { in: consentTypes },
        },
      }),
      this.getRestrictedConsentTypes(userId),
    ]);

    const now = Date.now();
    const result: Record<string, boolean> = {};
    for (const type of consentTypes) {
      const consent = consents.find(c => c.consentType === type);
      result[type] =
        consent?.status === ConsentStatus.GRANTED &&
        !(consent.expiresAt && consent.expiresAt.getTime() <= now) &&
        !frozen.has(type);
    }
    return result as Record<ConsentType, boolean>;
  }

  /**
   * Get consent state for Privacy Center UI
   */
  async getConsentState(userId: string): Promise<{
    groups: Record<string, { enabled: boolean; consents: any[] }>;
    restrictedProcessing: RestrictableProcessing[];
    lastUpdated: Date | null;
  }> {
    const [consents, frozen, restrictedProcessing] = await Promise.all([
      prisma.consentRecord.findMany({ where: { userId } }),
      this.getRestrictedConsentTypes(userId),
      this.getRestrictedProcessing(userId),
    ]);

    const groups: Record<string, { enabled: boolean; consents: any[] }> = {};

    for (const [groupName, types] of Object.entries(CONSENT_GROUPS)) {
      const groupConsents = types.map(type => {
        const consent = consents.find(c => c.consentType === type);
        const config = CONSENT_DESCRIPTIONS[type];
        // A toggle showing "on" for processing we have frozen would tell the
        // member the opposite of the truth, so restriction wins the display too
        // and `restricted` is what the Privacy Centre uses to explain why.
        const restricted = frozen.has(type);
        return {
          type,
          ...config,
          granted: consent?.status === ConsentStatus.GRANTED && !restricted,
          restricted,
          updatedAt: consent?.updatedAt || null,
        };
      });

      groups[groupName] = {
        enabled: groupConsents.some(c => c.granted && !c.required),
        consents: groupConsents,
      };
    }

    const lastUpdated = consents.length > 0
      ? new Date(Math.max(...consents.map(c => c.updatedAt.getTime())))
      : null;

    return { groups, restrictedProcessing, lastUpdated };
  }

  /**
   * Withdraw all non-essential consents
   */
  async withdrawAllOptionalConsents(
    userId: string,
    context: { ipAddress?: string; userAgent?: string; region?: string }
  ): Promise<void> {
    const optionalTypes = Object.entries(CONSENT_DESCRIPTIONS)
      .filter(([_, config]) => !config.required)
      .map(([type]) => type as ConsentType);

    await prisma.consentRecord.updateMany({
      where: {
        userId,
        consentType: { in: optionalTypes },
      },
      data: {
        status: ConsentStatus.WITHDRAWN,
        withdrawnAt: new Date(),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        region: context.region,
      },
    });

    // Log the bulk withdrawal
    await prisma.privacyAuditLog.create({
      data: {
        userId,
        action: 'BULK_CONSENT_WITHDRAWAL',
        resourceType: 'ConsentRecord',
        details: { withdrawnTypes: optionalTypes },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        region: context.region,
      },
    });
  }

  /**
   * Get consent history for audit
   */
  async getConsentHistory(userId: string): Promise<any[]> {
    return prisma.privacyAuditLog.findMany({
      where: {
        userId,
        action: {
          in: ['CONSENT_GRANTED', 'CONSENT_WITHDRAWN', 'BULK_CONSENT_WITHDRAWAL'],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /**
   * Verify consent for a specific action (middleware helper)
   */
  async verifyConsentForAction(
    userId: string,
    action: 'marketing_email' | 'analytics' | 'personalization' | 'third_party'
  ): Promise<{ allowed: boolean; reason?: string }> {
    const consentMap: Record<string, ConsentType> = {
      marketing_email: ConsentType.MARKETING_EMAIL,
      analytics: ConsentType.ANALYTICS,
      personalization: ConsentType.PERSONALIZATION,
      third_party: ConsentType.THIRD_PARTY_SHARING,
    };

    const requiredConsent = consentMap[action];
    if (!requiredConsent) {
      return { allowed: false, reason: 'Unknown action type' };
    }

    const hasConsent = await this.hasConsent(userId, requiredConsent);
    if (!hasConsent) {
      // Distinguishing the two matters to whoever reads this: a withdrawn
      // consent can be asked for again, a restriction has to be lifted first.
      const frozen = await this.getRestrictedConsentTypes(userId);
      return {
        allowed: false,
        reason: frozen.has(requiredConsent)
          ? `${CONSENT_DESCRIPTIONS[requiredConsent].title} is restricted under this member's Article 18 request`
          : `User has not granted ${CONSENT_DESCRIPTIONS[requiredConsent].title} consent`,
      };
    }

    return { allowed: true };
  }
}

export const consentService = new ConsentService();
