/**
 * Whether a Stripe secret key moves real money.
 *
 * Stripe's keys say so in their own prefix: `sk_live_` and `rk_live_` charge real
 * cards, `sk_test_` and `rk_test_` never do. Nothing here read the prefix, so a
 * deployment could go to its first public member on test keys, taking no money
 * and saying nothing, or a rehearsal could run on live ones. Test and live are
 * switched by which key is in the environment and nothing else; this only
 * reports which one that is. It imports nothing, so the health report and the
 * Stripe client can both use it, and a test that replaces the client does not
 * replace this.
 */

export type StripeMode = 'live' | 'test' | 'unknown';

/** The placeholder utils/stripe builds a client from when no key is set. */
const PLACEHOLDER_KEY = 'sk_test_not_configured';

export function stripeModeOf(key: string | undefined | null): StripeMode {
  const value = (key ?? '').trim();
  if (/^(sk|rk)_live_/.test(value)) return 'live';
  if (/^(sk|rk)_test_/.test(value) && value !== PLACEHOLDER_KEY) return 'test';
  return 'unknown';
}
