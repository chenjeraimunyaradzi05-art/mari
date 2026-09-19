/**
 * The one Stripe client. Every module that talks to Stripe used to build
 * its own with a placeholder key when none was configured, which meant a
 * code path outside the mocked ones would call Stripe with a key that could
 * only fail. Now: a real client when the key is set; outside production a
 * placeholder client so local work runs; in production without a key, a
 * client whose every use fails the request with a clear 503 rather than
 * reaching Stripe.
 */

import Stripe from 'stripe';
import { ApiError } from '../middleware/errorHandler';
import { logger } from './logger';

export const STRIPE_API_VERSION = '2023-10-16' as const;

let client: Stripe | null = null;
let clientKey: string | undefined;

/**
 * Whether this deployment has a Stripe key at all.
 *
 * This is the question a caller with a graceful fallback has to ask, because
 * getStripe() never answers it: outside production it hands back a placeholder
 * client, so testing its result for null always says "Stripe is ready".
 */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  // The cached client is only good for the key it was built from. Callers gate
  // on isStripeConfigured() and then ask for the client, so a client cached
  // before the key reached the environment would be handed back as though it
  // were configured - a placeholder quietly calling Stripe with
  // sk_test_not_configured while the real key sat unused.
  if (client && clientKey === key) return client;
  clientKey = key;
  if (key) {
    client = new Stripe(key, { apiVersion: STRIPE_API_VERSION });
    return client;
  }
  if (process.env.NODE_ENV === 'production') {
    client = new Proxy({} as Stripe, {
      get() {
        throw new ApiError(503, 'Payments are not configured on this deployment');
      },
    });
    return client;
  }
  logger.warn('STRIPE_SECRET_KEY is not set; Stripe calls outside the mocked paths will fail');
  client = new Stripe('sk_test_not_configured', { apiVersion: STRIPE_API_VERSION });
  return client;
}
