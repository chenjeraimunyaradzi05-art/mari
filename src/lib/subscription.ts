import { SubscriptionTier } from '@prisma/client';

export const SUBSCRIPTION_PLANS = {
  [SubscriptionTier.free]: {
    name: 'Free',
    priceCents: 0,
    features: [
      'Basic Profile',
      'Job Search',
      'Limited Applications (5/mo)',
    ],
  },
  [SubscriptionTier.premium]: {
    name: 'Premium',
    priceCents: 1900, // $19.00
    features: [
      'Verified Badge',
      'Unlimited Applications',
      'Priority Support',
      'See Who Viewed Profile',
    ],
  },
  [SubscriptionTier.premium_plus]: {
    name: 'Premium+',
    priceCents: 4900, // $49.00
    features: [
      'All Premium Features',
      'AI Resume Review',
      'Featured Profile',
      'Direct Messaging to Recruiters',
    ],
  },
  [SubscriptionTier.creator]: {
    name: 'Creator',
    priceCents: 2900, // $29.00
    features: [
      'Live Streaming',
      'Monetization Tools',
      'Audience Analytics',
      'Custom Branding',
    ],
  },
};

export function getPlanDetails(tier: SubscriptionTier) {
  return SUBSCRIPTION_PLANS[tier];
}

export function hasAccess(userTier: SubscriptionTier, requiredTier: SubscriptionTier): boolean {
  const tiers: SubscriptionTier[] = [
    SubscriptionTier.free,
    SubscriptionTier.premium,
    SubscriptionTier.premium_plus,
  ];
  
  // Creator is a separate track, handled differently usually
  if (userTier === SubscriptionTier.creator) return true; // Simplified for now

  const userLevel = tiers.indexOf(userTier);
  const requiredLevel = tiers.indexOf(requiredTier);

  return userLevel >= requiredLevel;
}
