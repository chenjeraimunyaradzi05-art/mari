import Stripe from 'stripe';
import { SubscriptionStatus, SubscriptionTier } from '@prisma/client';
import { logger } from '@/lib/logger';
import { resolvePriceId, tierConfig, tierMeets, tierOrder } from '@/lib/membership';

const apiVersion = '2024-06-20' as Stripe.StripeConfig['apiVersion'];

let stripeClient: Stripe | null = null;

export const getStripe = () => {
  if (stripeClient) return stripeClient;
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    throw new Error('STRIPE_SECRET_KEY is not set');
  }
  stripeClient = new Stripe(secret, { apiVersion });
  return stripeClient;
};

const statusMap: Record<Stripe.Subscription.Status, SubscriptionStatus> = {
  active: SubscriptionStatus.active,
  trialing: SubscriptionStatus.trialing,
  past_due: SubscriptionStatus.past_due,
  canceled: SubscriptionStatus.canceled,
  unpaid: SubscriptionStatus.unpaid,
  incomplete: SubscriptionStatus.incomplete,
  incomplete_expired: SubscriptionStatus.incomplete_expired,
  paused: SubscriptionStatus.paused,
};

export const normalizeTier = (value?: string | null): SubscriptionTier => {
  if (!value) return SubscriptionTier.free;
  const maybe = value as SubscriptionTier;
  return maybe in tierOrder ? maybe : SubscriptionTier.free;
};

const toDate = (value?: number | null) => (value ? new Date(value * 1000) : null);

export function subscriptionToPrisma(sub: Stripe.Subscription) {
  const primaryItem = sub.items.data[0];
  const price = primaryItem?.price;
  const priceMetaTier = price?.metadata?.tier as SubscriptionTier | undefined;
  const tier = normalizeTier(sub.metadata?.tier ?? priceMetaTier);

  const latestInvoice = typeof sub.latest_invoice === 'string' ? undefined : sub.latest_invoice;

  return {
    userId: (sub.metadata?.userId as string) ?? undefined,
    tier,
    status: statusMap[sub.status],
    monthlyPrice: price?.unit_amount ?? tierConfig[tier].monthlyPriceCents,
    currency: price?.currency?.toUpperCase() ?? tierConfig[tier].currency,
    stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
    stripeSubscriptionId: sub.id,
    stripePriceId: price?.id,
    stripeProductId: price?.product as string | undefined,
    defaultPaymentMethodId:
      typeof sub.default_payment_method === 'string'
        ? sub.default_payment_method
        : sub.default_payment_method?.id,
    paymentMethodId:
      typeof sub.default_payment_method === 'string'
        ? sub.default_payment_method
        : sub.default_payment_method?.id,
    latestInvoiceId: latestInvoice?.id,
    latestInvoiceUrl: latestInvoice?.hosted_invoice_url,
    invoicePdfUrl: latestInvoice?.invoice_pdf,
    automaticTax: sub.automatic_tax?.enabled ?? false,
    taxRatePercent: latestInvoice?.tax ?? undefined,
    currentPeriodStart: toDate(sub.current_period_start),
    currentPeriodEnd: toDate(sub.current_period_end),
    nextBillingDate: toDate(sub.current_period_end),
    cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
    canceledAt: toDate(sub.canceled_at ?? null),
    lastInvoiceAt: toDate(latestInvoice?.created ?? null),
  };
}

export async function createCheckoutSession(params: {
  userId: string;
  email?: string;
  tier: SubscriptionTier;
  successUrl: string;
  cancelUrl: string;
  customerId?: string | null;
}) {
  const stripe = getStripe();
  const priceId = resolvePriceId(params.tier);
  if (!priceId) {
    throw new Error(`Stripe price not configured for tier ${params.tier}`);
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: params.customerId ?? undefined,
    customer_email: params.customerId ? undefined : params.email,
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    automatic_tax: { enabled: true },
    invoice_creation: { enabled: true },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    subscription_data: {
      metadata: { userId: params.userId, tier: params.tier },
      description: `${tierConfig[params.tier].label} membership`,
      trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
      default_tax_rates: [],
    },
    metadata: {
      userId: params.userId,
      tier: params.tier,
    },
    tax_id_collection: { enabled: true },
    payment_method_collection: 'always',
  });

  return session;
}

export async function createBillingPortalSession(params: { customerId: string; returnUrl: string }) {
  const stripe = getStripe();
  return stripe.billingPortal.sessions.create({
    customer: params.customerId,
    return_url: params.returnUrl,
  });
}

export function safeMapStatus(status: Stripe.Subscription.Status) {
  return statusMap[status] ?? SubscriptionStatus.active;
}

export function canDowngrade(current: SubscriptionTier, target: SubscriptionTier) {
  return tierMeets(current, target) || tierOrder[current] > tierOrder[target];
}

export function logStripeEvent(event: Stripe.Event) {
  logger.info('Stripe webhook event', { id: event.id, type: event.type });
}
