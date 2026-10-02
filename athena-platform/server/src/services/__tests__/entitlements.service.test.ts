/**
 * What a membership buys, and who counts as having paid.
 *
 * The facts used to live in three places that disagreed: the pricing page's own
 * lists, the AI router's constants, and a middleware that no route mounted whose
 * table promised three job applications a month, ten messages a day and a gated
 * company-formation feature. This is the one table, and these tests hold it to
 * the rule the gates share (a live paid subscription) and to the numbers the AI
 * router enforces for the chat.
 */

import { describe, it, expect, afterEach } from '@jest/globals';
import {
  chatAllowanceFor,
  entitlementsFor,
  freeChatAllowance,
  hasPaidEntitlement,
  paidChatAllowance,
  planEntitlements,
} from '../entitlements.service';
import { PAST_DUE_GRACE_DAYS } from '../../config/price-book';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-10-01T00:00:00.000Z');

const row = (over: Record<string, unknown> = {}) => ({
  tier: 'PREMIUM_CAREER',
  status: 'ACTIVE',
  currentPeriodStart: new Date(NOW.getTime() - 5 * DAY),
  ...over,
});

const CHAT_ENV = [
  'AI_CHAT_FREE_MAX_REQUESTS',
  'AI_CHAT_FREE_WINDOW_SECONDS',
  'AI_CHAT_PREMIUM_MAX_REQUESTS',
  'AI_CHAT_PREMIUM_WINDOW_SECONDS',
] as const;
const saved = Object.fromEntries(CHAT_ENV.map((name) => [name, process.env[name]]));

afterEach(() => {
  for (const name of CHAT_ENV) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  }
});

describe('who has paid', () => {
  it.each(['ACTIVE', 'TRIALING'])('a paid tier that is %s has', (status) => {
    expect(hasPaidEntitlement(row({ status }), NOW)).toBe(true);
  });

  it('a member with no subscription row is a free member', () => {
    expect(hasPaidEntitlement(null, NOW)).toBe(false);
    expect(hasPaidEntitlement(undefined, NOW)).toBe(false);
  });

  it('a row that names FREE has not, whatever its status', () => {
    expect(hasPaidEntitlement(row({ tier: 'FREE', status: 'ACTIVE' }), NOW)).toBe(false);
  });

  it.each(['CANCELED', 'UNPAID', 'INCOMPLETE', 'INCOMPLETE_EXPIRED', 'PAUSED'])(
    'a paid tier that is %s has lost paid access, whatever tier the row still names',
    (status) => {
      expect(hasPaidEntitlement(row({ status }), NOW)).toBe(false);
    }
  );

  it('a failed renewal keeps paid access through the grace, and loses it after', () => {
    const inside = row({ status: 'PAST_DUE', currentPeriodStart: new Date(NOW.getTime() - (PAST_DUE_GRACE_DAYS - 1) * DAY) });
    const after = row({ status: 'PAST_DUE', currentPeriodStart: new Date(NOW.getTime() - (PAST_DUE_GRACE_DAYS + 1) * DAY) });

    expect(hasPaidEntitlement(inside, NOW)).toBe(true);
    expect(hasPaidEntitlement(after, NOW)).toBe(false);
  });

  it('a past-due row with no period start has no grace to count from', () => {
    expect(hasPaidEntitlement(row({ status: 'PAST_DUE', currentPeriodStart: null }), NOW)).toBe(false);
  });

  it.each(['PREMIUM_CAREER', 'PREMIUM_PROFESSIONAL', 'PREMIUM_ENTREPRENEUR', 'PREMIUM_CREATOR', 'ENTERPRISE'])(
    '%s is paid, with the same entitlements: no tier is given a difference the server does not enforce',
    (tier) => {
      const entitlements = entitlementsFor(row({ tier }), NOW);
      expect(entitlements.plan).toBe('paid');
      expect(entitlements.aiTools).toBe(true);
      expect(entitlements.aiChat).toEqual(paidChatAllowance());
    }
  );
});

describe('what each plan gets', () => {
  it('Free has no AI tools and a chat window; a paid membership has the tools and a larger window', () => {
    const { free, paid } = planEntitlements();

    expect(free.aiTools).toBe(false);
    expect(paid.aiTools).toBe(true);
    expect(free.aiChat).toEqual({ messages: 20, windowSeconds: 86_400 });
    expect(paid.aiChat).toEqual({ messages: 200, windowSeconds: 86_400 });
    expect(paid.aiChat.messages).toBeGreaterThan(free.aiChat.messages);
  });

  it('lists only what the server enforces: no application cap, mentor limit or course discount is promised', () => {
    const { free, paid } = planEntitlements();

    for (const plan of [free, paid]) {
      expect(Object.keys(plan).sort()).toEqual(['aiChat', 'aiTools']);
    }
  });

  it('reads the chat allowances from the environment, so a page prints what the gate enforces today', () => {
    process.env.AI_CHAT_FREE_MAX_REQUESTS = '7';
    process.env.AI_CHAT_FREE_WINDOW_SECONDS = '3600';
    process.env.AI_CHAT_PREMIUM_MAX_REQUESTS = '90';
    process.env.AI_CHAT_PREMIUM_WINDOW_SECONDS = '7200';

    expect(freeChatAllowance()).toEqual({ messages: 7, windowSeconds: 3600 });
    expect(paidChatAllowance()).toEqual({ messages: 90, windowSeconds: 7200 });
    expect(planEntitlements().free.aiChat).toEqual({ messages: 7, windowSeconds: 3600 });
  });

  it.each(['0', '-5', 'many', ''])('ignores %p and keeps the default', (value) => {
    process.env.AI_CHAT_FREE_MAX_REQUESTS = value;
    process.env.AI_CHAT_PREMIUM_WINDOW_SECONDS = value;

    expect(freeChatAllowance().messages).toBe(20);
    expect(paidChatAllowance().windowSeconds).toBe(86_400);
  });

  it('picks the window by who has paid', () => {
    expect(chatAllowanceFor(false)).toEqual(freeChatAllowance());
    expect(chatAllowanceFor(true)).toEqual(paidChatAllowance());
  });
});

describe('what one member is entitled to', () => {
  it('a member paid up on Pro: the tools and the larger window', () => {
    expect(entitlementsFor(row(), NOW)).toEqual({
      plan: 'paid',
      tier: 'PREMIUM_CAREER',
      status: 'ACTIVE',
      aiTools: true,
      aiChat: { messages: 200, windowSeconds: 86_400 },
    });
  });

  it('a trial is paid access', () => {
    expect(entitlementsFor(row({ status: 'TRIALING' }), NOW)).toMatchObject({ plan: 'paid', aiTools: true });
  });

  it('a member with no row is free, and the tier says FREE', () => {
    expect(entitlementsFor(null, NOW)).toEqual({
      plan: 'free',
      tier: 'FREE',
      status: null,
      aiTools: false,
      aiChat: { messages: 20, windowSeconds: 86_400 },
    });
  });

  it('a lapsed membership is free, though the row still names a paid tier and says why', () => {
    const lapsed = entitlementsFor(row({ status: 'CANCELED' }), NOW);

    expect(lapsed).toMatchObject({ plan: 'free', aiTools: false, tier: 'PREMIUM_CAREER', status: 'CANCELED' });
    expect(lapsed.aiChat).toEqual(freeChatAllowance());
  });

  it('a past-due membership beyond the grace is free', () => {
    const pausedTools = entitlementsFor(
      row({ status: 'PAST_DUE', currentPeriodStart: new Date(NOW.getTime() - (PAST_DUE_GRACE_DAYS + 2) * DAY) }),
      NOW
    );

    expect(pausedTools).toMatchObject({ plan: 'free', aiTools: false, status: 'PAST_DUE' });
  });
});
