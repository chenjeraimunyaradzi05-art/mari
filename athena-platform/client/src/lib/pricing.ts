/**
 * Pricing — single source of truth.
 *
 * Every price shown anywhere in the app must come from this module so the
 * numbers can never drift between the pricing page, checkout, and marketing
 * copy (audit item P0.3). Savings are COMPUTED from the prices — never
 * hard-code a "Save X%" string.
 */

export interface PlanPricing {
  id: 'free' | 'pro' | 'enterprise';
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: 'AUD';
}

export const PLAN_PRICING: Record<PlanPricing['id'], PlanPricing> = {
  free: { id: 'free', name: 'Free', monthlyPrice: 0, yearlyPrice: 0, currency: 'AUD' },
  pro: { id: 'pro', name: 'Pro', monthlyPrice: 29, yearlyPrice: 290, currency: 'AUD' },
  enterprise: { id: 'enterprise', name: 'Enterprise', monthlyPrice: 99, yearlyPrice: 990, currency: 'AUD' },
};

/** Trial and refund policy constants — keep FAQ/marketing copy in sync with these. */
export const TRIAL_DAYS = 14;
export const REFUND_DAYS = 30;

/**
 * Percentage saved by paying yearly instead of 12 monthly payments.
 * Floored so we never overstate the saving (29/mo → 290/yr = 16%, not "20%").
 */
export function yearlySavingsPercent(plan: PlanPricing): number {
  if (plan.monthlyPrice <= 0) return 0;
  const fullYear = plan.monthlyPrice * 12;
  return Math.max(0, Math.floor(((fullYear - plan.yearlyPrice) / fullYear) * 100));
}

/**
 * Whole months of the year effectively free on the yearly plan
 * (29/mo → 290/yr = 2 months free). Use this for badge copy — it is exact.
 */
export function yearlyMonthsFree(plan: PlanPricing): number {
  if (plan.monthlyPrice <= 0) return 0;
  return Math.floor(12 - plan.yearlyPrice / plan.monthlyPrice);
}

/** Badge copy for the yearly toggle, derived — never hard-coded. */
export function yearlySavingsBadge(plan: PlanPricing = PLAN_PRICING.pro): string {
  const months = yearlyMonthsFree(plan);
  if (months >= 1) return `${months} month${months === 1 ? '' : 's'} free`;
  const pct = yearlySavingsPercent(plan);
  return pct > 0 ? `Save ${pct}%` : '';
}
