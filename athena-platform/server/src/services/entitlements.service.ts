/**
 * What a membership buys, in one place.
 *
 * Three things used to describe the same facts and could not agree. The pricing
 * and billing pages listed what Pro included in their own words. The AI router
 * decided who was Pro and how many chat messages each kind of member had, in its
 * own constants. And a middleware that nothing mounted held a third table, with
 * limits no route enforced: three job applications a month, ten messages a day,
 * mentor sessions a month, a "formation" feature that would have put company
 * registration behind a subscription. A member reading any of them was told
 * something the server did not do.
 *
 * This is the one table, and it lists only what the server really does:
 *
 *   - the six AI tools (resume optimiser, interview coach, opportunity radar,
 *     career path, content generator, idea validator) are for a live paid
 *     membership, and refused to everyone else (routes/ai.routes requireAiPremium);
 *   - the AI chat has a window of its own for each kind of member, a smaller one
 *     for Free and a larger one for a paid membership.
 *
 * Nothing else is gated by a plan. Job applications, mentor requests, courses,
 * company formation, messaging and the community are the same for every member:
 * an employment platform for women does not meter its members' applications,
 * and nothing here pretends it does. If the owner decides a limit is a product, it is
 * added here first, enforced on the server, and only then named on a page.
 *
 * Who counts as paid is utils/subscription-entitlement: a tier other than FREE
 * on a subscription that is ACTIVE or TRIALING, or past due inside the grace
 * after a failed renewal. The chat limits are operational settings, read from the
 * environment, so a page that prints them prints what the gate enforces today.
 */

import { hasLiveEntitlement, type SubscriptionStanding } from '../utils/subscription-entitlement';

/** The AI chat's allowance for one window. */
export interface ChatAllowance {
  /** Messages in the window. */
  messages: number;
  /** How long the window is, in seconds. */
  windowSeconds: number;
}

export interface PlanEntitlements {
  /** The six AI tools. */
  aiTools: boolean;
  aiChat: ChatAllowance;
}

const DAY_SECONDS = 24 * 60 * 60;

/** A whole number above zero from the environment, or the fallback when it is unset, not a number, or not above zero. */
function positiveIntFromEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] || String(fallback), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * The free member's chat window: 20 messages in 24 hours unless the environment
 * says otherwise (AI_CHAT_FREE_MAX_REQUESTS, AI_CHAT_FREE_WINDOW_SECONDS).
 */
export function freeChatAllowance(): ChatAllowance {
  return {
    messages: positiveIntFromEnv('AI_CHAT_FREE_MAX_REQUESTS', 20),
    windowSeconds: positiveIntFromEnv('AI_CHAT_FREE_WINDOW_SECONDS', DAY_SECONDS),
  };
}

/**
 * A paid member's chat window. Paid chat once had no period quota at all, so a
 * paying account's one ceiling was the per-minute limiter, and the usage
 * endpoint reported the chat as "unlimited". It is a much larger window, not none,
 * and the daily token budget (ai-budget.service) sits behind both.
 */
export function paidChatAllowance(): ChatAllowance {
  return {
    messages: positiveIntFromEnv('AI_CHAT_PREMIUM_MAX_REQUESTS', 200),
    windowSeconds: positiveIntFromEnv('AI_CHAT_PREMIUM_WINDOW_SECONDS', DAY_SECONDS),
  };
}

/**
 * What Free and a paid membership each get. A function rather than a constant
 * because the chat allowances come from the environment, and an operator who
 * changes one should see the pages follow without a deploy of the pages.
 */
export function planEntitlements(): { free: PlanEntitlements; paid: PlanEntitlements } {
  return {
    free: { aiTools: false, aiChat: freeChatAllowance() },
    paid: { aiTools: true, aiChat: paidChatAllowance() },
  };
}

/** The chat window for a member who is, or is not, on a live paid membership. */
export function chatAllowanceFor(paid: boolean): ChatAllowance {
  return paid ? paidChatAllowance() : freeChatAllowance();
}

/**
 * Whether a subscription row buys the paid features today. The one rule: the
 * gate on every paid route, the page that asks before it draws one, and the chat
 * quota all call this, so the page, the route and the quota cannot disagree about
 * who has paid. A lapsed membership, or one past due beyond the grace, is not
 * paid, whatever tier the row still names. A missing row is a free member.
 */
export function hasPaidEntitlement(
  subscription: SubscriptionStanding | null | undefined,
  now: Date = new Date()
): boolean {
  return hasLiveEntitlement(subscription, now);
}

export interface MemberEntitlements extends PlanEntitlements {
  /** Which row of the table applies to this member today. */
  plan: 'free' | 'paid';
  /** The tier the row names, which is not the same as what the member is entitled to. */
  tier: string;
  status: string | null;
}

/** What this member is entitled to, from the subscription row. */
export function entitlementsFor(
  subscription: (SubscriptionStanding & { status: string }) | null | undefined,
  now: Date = new Date()
): MemberEntitlements {
  const paid = hasPaidEntitlement(subscription, now);
  const table = planEntitlements();

  return {
    ...(paid ? table.paid : table.free),
    plan: paid ? 'paid' : 'free',
    tier: subscription?.tier ?? 'FREE',
    status: subscription?.status ?? null,
  };
}
