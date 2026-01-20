/**
 * Consent Management Service
 * Handles granular consent tracking, verification, and audit
 * Phase 4: UK/EU Market Launch
 */

import { PrismaClient, ConsentType, ConsentStatus } from '@prisma/client';

const prisma = new PrismaClient();

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
   * Check if user has granted specific consent
   */
  async hasConsent(userId: string, consentType: ConsentType): Promise<boolean> {
    const consent = await prisma.consentRecord.findUnique({
      where: { userId_consentType: { userId, consentType } },
    });
    return consent?.status === ConsentStatus.GRANTED;
  }

  /**
   * Check multiple consents at once
   */
  async hasConsents(
    userId: string,
    consentTypes: ConsentType[]
  ): Promise<Record<ConsentType, boolean>> {
    const consents = await prisma.consentRecord.findMany({
      where: {
        userId,
        consentType: { in: consentTypes },
      },
    });

    const result: Record<string, boolean> = {};
    for (const type of consentTypes) {
      const consent = consents.find(c => c.consentType === type);
      result[type] = consent?.status === ConsentStatus.GRANTED;
    }
    return result as Record<ConsentType, boolean>;
  }

  /**
   * Get consent state for Privacy Center UI
   */
  async getConsentState(userId: string): Promise<{
    groups: Record<string, { enabled: boolean; consents: any[] }>;
    lastUpdated: Date | null;
  }> {
    const consents = await prisma.consentRecord.findMany({
      where: { userId },
    });

    const groups: Record<string, { enabled: boolean; consents: any[] }> = {};

    for (const [groupName, types] of Object.entries(CONSENT_GROUPS)) {
      const groupConsents = types.map(type => {
        const consent = consents.find(c => c.consentType === type);
        const config = CONSENT_DESCRIPTIONS[type];
        return {
          type,
          ...config,
          granted: consent?.status === ConsentStatus.GRANTED,
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

    return { groups, lastUpdated };
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
      return {
        allowed: false,
        reason: `User has not granted ${CONSENT_DESCRIPTIONS[requiredConsent].title} consent`,
      };
    }

    return { allowed: true };
  }
}

export const consentService = new ConsentService();
