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

/** The AI chat's allowance for one window, as the server enforces it. */
export interface ChatAllowance {
  messages: number;
  windowSeconds: number;
}

/**
 * What a plan buys, from the table the server's paid routes are gated by
 * (services/entitlements.service). A page prints these and nothing it has made
 * up, so a card cannot promise what the gate does not enforce.
 */
export interface PlanEntitlementsView {
  aiTools: boolean;
  aiChat: ChatAllowance;
}

export interface PlansResponse {
  currency: string;
  trialDays: number;
  /** Days a first-time subscriber has to ask for her first payment back. */
  refundDays?: number;
  /**
   * The one GST sentence a price page prints beside a price. The server works it
   * out from the same registration its invoices read, so a price and the invoice
   * for it cannot disagree. Absent on an older server, and null when a price is
   * shown in a currency other than Australian dollars: print nothing then.
   */
  gst?: { registered: boolean; statement: string } | null;
  plans: PlanPrice[];
  /** What Free and a paid membership each get. Absent on an older server. */
  entitlements?: { free: PlanEntitlementsView; paid: PlanEntitlementsView };
  /**
   * True while an admin has paused new payments. Every upgrade would be refused
   * with a 503 until it is lifted, so a page holds its upgrade button and says
   * so. Absent on an older server, which is not guessed at.
   */
  paused?: boolean;
  /** The words to show when paused: the admin's own, or the server's default. */
  pauseMessage?: string | null;
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

/**
 * The chat allowance in words: "20 messages a day", "200 messages every 2 days".
 * Null when the server did not send one, so a page falls back to its plain
 * wording and does not print a number it was not given.
 */
export function describeChatAllowance(allowance: ChatAllowance | undefined): string | null {
  if (!allowance || !Number.isFinite(allowance.messages) || !Number.isFinite(allowance.windowSeconds)) return null;
  const { messages, windowSeconds } = allowance;
  const noun = messages === 1 ? 'message' : 'messages';

  const DAY = 24 * 60 * 60;
  const HOUR = 60 * 60;
  let window: string;
  if (windowSeconds % DAY === 0) {
    const days = windowSeconds / DAY;
    window = days === 1 ? 'a day' : `every ${days} days`;
  } else if (windowSeconds % HOUR === 0) {
    const hours = windowSeconds / HOUR;
    window = hours === 1 ? 'an hour' : `every ${hours} hours`;
  } else {
    const minutes = Math.max(1, Math.round(windowSeconds / 60));
    window = minutes === 1 ? 'a minute' : `every ${minutes} minutes`;
  }
  return `${messages} ${noun} ${window}`;
}

/** "month", "3 months", "year" — how often the price is charged. */
export function formatPlanInterval(plan: PlanPrice): string | null {
  if (!plan.interval) return null;
  const count = plan.intervalCount ?? 1;
  return count === 1 ? plan.interval : `${count} ${plan.interval}s`;
}
