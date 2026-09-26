'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { getPreferredLocale } from '@/lib/utils';

/**
 * What a membership tier costs, as the server reads it from the Stripe price
 * checkout will charge. Shared by the public pricing page and the billing page
 * so the two cannot disagree with each other or with checkout.
 *
 * Both pages used to print their own numbers: A$29 a month or A$290 a year for
 * Pro, A$99 for an Enterprise tier checkout refused, while the Pro button
 * started a monthly checkout at whatever the Stripe price really was. A price
 * on either page now comes from GET /api/subscriptions/plans or is not shown.
 */
export interface PlanPrice {
  tier: string;
  available: boolean;
  currency?: string;
  /** In the currency's smallest unit, as Stripe holds it. */
  unitAmount?: number;
  /** In major units. */
  amount?: number;
  interval?: 'day' | 'week' | 'month' | 'year';
  intervalCount?: number;
}

export interface PlansResponse {
  currency: string;
  trialDays: number;
  plans: PlanPrice[];
}

/** The tier the "Pro" plan on both pages checks out. */
export const PRO_TIER = 'PREMIUM_CAREER';

export function usePlanPrices() {
  return useQuery({
    queryKey: ['subscription', 'plans'],
    queryFn: async () => {
      const { data } = await api.get('/subscriptions/plans');
      return data.data as PlansResponse;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * A price to the cent, in its own currency. The shared formatCurrency rounds to
 * whole units, which would print A$9.99 as A$10 — a price the member is not
 * charged.
 */
export function formatPlanAmount(plan: PlanPrice): string | null {
  if (!plan.available || plan.amount == null || !plan.currency) return null;
  try {
    return new Intl.NumberFormat(getPreferredLocale(), {
      style: 'currency',
      currency: plan.currency,
    }).format(plan.amount);
  } catch {
    return `${plan.amount} ${plan.currency}`;
  }
}

/** "month", "3 months", "year" — how often the price is charged. */
export function formatPlanInterval(plan: PlanPrice): string | null {
  if (!plan.interval) return null;
  const count = plan.intervalCount ?? 1;
  return count === 1 ? plan.interval : `${count} ${plan.interval}s`;
}
