import { SubscriptionStatus, SubscriptionTier } from '@prisma/client';

type TierConfig = {
  label: string;
  monthlyPriceCents: number;
  currency: string;
  stripePriceEnv?: string;
  features: string[];
};

export const tierOrder: Record<SubscriptionTier, number> = {
  free: 0,
  premium: 1,
  premium_plus: 2,
  creator: 3,
};

export const tierConfig: Record<SubscriptionTier, TierConfig> = {
  free: {
    label: 'Free',
    monthlyPriceCents: 0,
    currency: 'AUD',
    features: ['Read-only dashboards', 'Community feed', 'Identity verification']
  },
  premium: {
    label: 'Premium',
    monthlyPriceCents: 1900,
    currency: 'AUD',
    stripePriceEnv: 'STRIPE_PRICE_PREMIUM',
    features: ['Full dashboards', 'Ad campaigns + leads', 'Support SLAs']
  },
  premium_plus: {
    label: 'Premium+',
    monthlyPriceCents: 4900,
    currency: 'AUD',
    stripePriceEnv: 'STRIPE_PRICE_PREMIUM_PLUS',
    features: ['Everything in Premium', 'Live + video studio', 'Advanced analytics']
  },
  creator: {
    label: 'Creator',
    monthlyPriceCents: 9900,
    currency: 'AUD',
    stripePriceEnv: 'STRIPE_PRICE_CREATOR',
    features: ['Creator payouts', 'Gifts + monetisation', 'Priority support']
  },
};

export const activeSubscriptionStatuses: SubscriptionStatus[] = [
  SubscriptionStatus.active,
  SubscriptionStatus.trialing,
  SubscriptionStatus.past_due,
];

export const paywallRules: Array<{ pattern: RegExp; minTier: SubscriptionTier; reason: string }> = [
  { pattern: /^\/dashboard/, minTier: SubscriptionTier.premium, reason: 'dashboard' },
  { pattern: /^\/videos/, minTier: SubscriptionTier.premium_plus, reason: 'video tools' },
  { pattern: /^\/live/, minTier: SubscriptionTier.premium_plus, reason: 'live streaming' },
  { pattern: /^\/creator/, minTier: SubscriptionTier.creator, reason: 'creator economy' },
];

export function tierMeets(required: SubscriptionTier, current?: SubscriptionTier | null) {
  const tier = current ?? SubscriptionTier.free;
  return tierOrder[tier] >= tierOrder[required];
}

export function resolvePriceId(tier: SubscriptionTier) {
  const envKey = tierConfig[tier].stripePriceEnv;
  if (!envKey) return null;
  const value = process.env[envKey];
  if (!value) throw new Error(`Missing env ${envKey} for tier ${tier}`);
  return value;
}

export function evaluatePaywall(pathname: string, subscription?: { tier?: SubscriptionTier | null; status?: SubscriptionStatus | null }) {
  const rule = paywallRules.find((r) => r.pattern.test(pathname));
  if (!rule) return { allowed: true as const };

  const status = subscription?.status ?? SubscriptionStatus.incomplete;
  const tier = subscription?.tier ?? SubscriptionTier.free;

  const isActive = activeSubscriptionStatuses.includes(status);
  const allowed = isActive && tierMeets(rule.minTier, tier);

  return {
    allowed,
    requiredTier: rule.minTier,
    reason: rule.reason,
    currentTier: tier,
    status,
  } as const;
}

export function isPaidTier(tier: SubscriptionTier) {
  return tier !== SubscriptionTier.free;
}
