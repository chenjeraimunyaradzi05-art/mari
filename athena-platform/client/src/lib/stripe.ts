/**
 * Stripe.js, loaded once. Card entry happens in Stripe's own elements, so no
 * card detail ever touches this application. Configured by
 * NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY; without it, payment steps say so and
 * step aside rather than fail.
 */

import { loadStripe, type Stripe } from '@stripe/stripe-js';

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

let stripeLoad: Promise<Stripe | null> | null = null;

export const stripeConfigured = Boolean(publishableKey);

export function getStripe(): Promise<Stripe | null> | null {
  if (!publishableKey) return null;
  if (!stripeLoad) stripeLoad = loadStripe(publishableKey);
  return stripeLoad;
}
