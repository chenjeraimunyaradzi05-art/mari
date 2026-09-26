/**
 * What ATHENA's OpenAI key may spend in a day, and what it has spent.
 *
 * There was no ceiling. The per-minute limiter (aiLimiter, ten requests a
 * minute) was the only thing between a premium account and the platform's
 * card: about 14,400 completions a day per account, four of the call sites set
 * no max_tokens so each one ran as long as the model liked, and nothing read
 * `completion.usage` — a grep for prompt_tokens across the server found
 * nothing — so nobody could have said afterwards what a day had cost or whose
 * spending it was.
 *
 * Two budgets, both counted in tokens, because tokens are what the provider
 * bills and what every completion reports. A price per token depends on which
 * model an operator configures (AI_OPENAI_CHAT_MODEL), and a price table kept
 * here would quietly go wrong the day the provider changed a price.
 *
 *  - Per member, per UTC day (AI_DAILY_TOKENS_PER_MEMBER). Once she has used
 *    it, the AI routes answer 429 until the day turns over. This is the one an
 *    account in a loop runs into.
 *  - For the whole platform, per UTC day (AI_DAILY_TOKENS_GLOBAL). Once that is
 *    used, every AI route answers 503 and `ai.budget_exhausted` is counted, so
 *    /health/detailed says why the AI stopped rather than leaving it in a log.
 *
 * The counts live in Redis so every instance shares them, and in this process
 * too, for the same reason the free chat quota keeps a local window (see
 * ai.routes localChatWindow): Redis being down must not be the moment the
 * ceiling disappears. With Redis down each instance holds its own count, so
 * the effective ceiling is the budget per instance rather than none at all.
 *
 * What this is not is a ledger. The counts expire with the day, and they are
 * not a record anyone can audit a month later; that needs a table, which is a
 * schema change and was handed on with this one.
 */

import { getRedisClient } from '../utils/cache';
import { recordFailure } from '../utils/ops-metrics';
import { logger } from '../utils/logger';

/** What the OpenAI SDK reports on a completion. Every field is optional there. */
export interface CompletionUsage {
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  total_tokens?: number | null;
}

/** Who a completion is spent on. Absent for work nobody asked for directly. */
export interface AiMeter {
  userId: string;
}

/**
 * Roughly two hundred chat turns at the reply cap, which is more than any
 * member working on her career uses in a day and a small fraction of what a
 * script can do in one.
 */
const DEFAULT_MEMBER_DAILY_TOKENS = 250_000;
/** The platform's day. An operator sets this to what the account can carry. */
const DEFAULT_GLOBAL_DAILY_TOKENS = 20_000_000;

function positiveIntFromEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function aiBudgetConfig(): { memberDailyTokens: number; globalDailyTokens: number } {
  return {
    memberDailyTokens: positiveIntFromEnv('AI_DAILY_TOKENS_PER_MEMBER', DEFAULT_MEMBER_DAILY_TOKENS),
    globalDailyTokens: positiveIntFromEnv('AI_DAILY_TOKENS_GLOBAL', DEFAULT_GLOBAL_DAILY_TOKENS),
  };
}

/** The UTC day a count belongs to, e.g. "2026-09-26". Midnight UTC is 10am in Brisbane. */
function dayOf(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function secondsUntilBudgetResets(now: Date = new Date()): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(1, Math.ceil((next - now.getTime()) / 1000));
}

const GLOBAL_SCOPE = 'global';
const memberScope = (userId: string) => `member:${userId}`;

// ---------------------------------------------------------------------------
// The in-process count
// ---------------------------------------------------------------------------

const localSpend = new Map<string, { day: string; tokens: number }>();
const LOCAL_SWEEP_AT = 20_000;

function localRead(scope: string, day: string): number {
  const entry = localSpend.get(scope);
  return entry && entry.day === day ? entry.tokens : 0;
}

function localAdd(scope: string, day: string, tokens: number): void {
  localSpend.set(scope, { day, tokens: localRead(scope, day) + tokens });
  if (localSpend.size > LOCAL_SWEEP_AT) {
    for (const [key, entry] of localSpend) {
      if (entry.day !== day) localSpend.delete(key);
    }
  }
}

/** For tests, which share a module registry across cases. */
export function resetAiBudgetForTests(): void {
  localSpend.clear();
}

// ---------------------------------------------------------------------------
// The shared count
// ---------------------------------------------------------------------------

/**
 * A budget check sits in front of every AI request, so it must never be the
 * slow part. The cache client connects lazily and queues commands while it
 * tries, which against a Redis that is not there can take seconds; half a
 * second is long enough for a Redis on the same network and short enough that
 * the local count takes over before a member notices.
 */
const REDIS_DEADLINE_MS = 500;

const redisKey = (scope: string, day: string) => `athena:ai:tokens:${scope}:${day}`;

async function withDeadline<T>(work: Promise<T>): Promise<T | null> {
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), REDIS_DEADLINE_MS);
  });
  try {
    return await Promise.race([work, deadline]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function sharedRead(scopes: string[], day: string): Promise<Array<number | null>> {
  try {
    const client = getRedisClient();
    if (!client) return scopes.map(() => null);
    const values = await withDeadline(client.mget(...scopes.map((scope) => redisKey(scope, day))));
    if (!values) return scopes.map(() => null);
    return values.map((value) => {
      const parsed = Number.parseInt(value ?? '0', 10);
      return Number.isFinite(parsed) ? parsed : 0;
    });
  } catch (error) {
    logger.warn('AI budget: shared count unreadable, using this instance’s count', {
      error: error instanceof Error ? error.message : String(error),
    });
    return scopes.map(() => null);
  }
}

async function sharedAdd(scopes: string[], day: string, tokens: number): Promise<void> {
  try {
    const client = getRedisClient();
    if (!client) return;
    const pipeline = client.pipeline();
    for (const scope of scopes) {
      pipeline.incrby(redisKey(scope, day), tokens);
      // Two days, so a count read just after midnight UTC by an instance with
      // a slightly slow clock still finds yesterday's key rather than nothing.
      pipeline.expire(redisKey(scope, day), 2 * 24 * 60 * 60);
    }
    await withDeadline(pipeline.exec());
  } catch (error) {
    logger.warn('AI budget: shared count not updated; this instance’s count still holds', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ---------------------------------------------------------------------------
// Reading and spending
// ---------------------------------------------------------------------------

export interface AiSpendToday {
  member: number | null;
  global: number;
}

/**
 * Whichever of the two counts is higher is the one that is true: the shared
 * count is missing what this instance spent while Redis was away, and the local
 * count is missing what every other instance spent.
 */
export async function aiSpendToday(userId: string | null, now: Date = new Date()): Promise<AiSpendToday> {
  const day = dayOf(now);
  const scopes = userId ? [GLOBAL_SCOPE, memberScope(userId)] : [GLOBAL_SCOPE];
  const shared = await sharedRead(scopes, day);

  const global = Math.max(localRead(GLOBAL_SCOPE, day), shared[0] ?? 0);
  const member = userId ? Math.max(localRead(memberScope(userId), day), shared[1] ?? 0) : null;
  return { member, global };
}

export type AiBudgetVerdict =
  | { allowed: true }
  | { allowed: false; scope: 'member' | 'global'; resetIn: number; message: string };

function describeWait(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.max(1, Math.round((seconds % 3600) / 60));
  if (hours === 0) return `${minutes} min`;
  return `${hours}h ${minutes}m`;
}

/**
 * Whether one more AI request may be made on this member's behalf.
 *
 * The platform's budget is checked first because it is the one that says
 * something is wrong with the deployment rather than with her, and a member
 * who is told her allowance is gone when it is ATHENA's that is gone has been
 * told something untrue about herself.
 */
export async function checkAiBudget(userId: string | null, now: Date = new Date()): Promise<AiBudgetVerdict> {
  const { memberDailyTokens, globalDailyTokens } = aiBudgetConfig();
  const spent = await aiSpendToday(userId, now);
  const resetIn = secondsUntilBudgetResets(now);

  if (spent.global >= globalDailyTokens) {
    recordFailure(
      'ai.budget_exhausted',
      new Error(`platform AI budget of ${globalDailyTokens} tokens used for ${dayOf(now)}`)
    );
    return {
      allowed: false,
      scope: 'global',
      resetIn,
      message: `ATHENA's AI tools have reached today's spending limit and are paused for about ${describeWait(
        resetIn
      )}. Nothing is wrong with your account, and nothing you asked for has been charged.`,
    };
  }

  if (spent.member !== null && spent.member >= memberDailyTokens) {
    return {
      allowed: false,
      scope: 'member',
      resetIn,
      message: `You have used today's AI allowance. It resets in about ${describeWait(resetIn)}.`,
    };
  }

  return { allowed: true };
}

/**
 * Counts one completion against the member who asked for it and against the
 * platform. Never throws: the member has her answer by the time this runs, and
 * a counter that failed must not turn that answer into an error.
 *
 * A completion that reports no usage is logged rather than guessed at. Counting
 * the reply cap in its place would be inventing a number, and the provider
 * reports usage on every non-streaming completion, so a missing one is a
 * change on their side worth seeing.
 */
export async function recordAiSpend(
  meter: AiMeter | undefined,
  feature: string,
  usage: CompletionUsage | null | undefined,
  now: Date = new Date()
): Promise<void> {
  try {
    const total =
      typeof usage?.total_tokens === 'number'
        ? usage.total_tokens
        : (usage?.prompt_tokens ?? 0) + (usage?.completion_tokens ?? 0);

    if (!usage || !Number.isFinite(total) || total <= 0) {
      logger.warn('AI completion reported no token usage; not counted against the budget', { feature });
      return;
    }

    const day = dayOf(now);
    const scopes = meter ? [GLOBAL_SCOPE, memberScope(meter.userId)] : [GLOBAL_SCOPE];
    for (const scope of scopes) localAdd(scope, day, total);
    await sharedAdd(scopes, day, total);

    logger.info('AI completion', {
      feature,
      userId: meter?.userId ?? null,
      promptTokens: usage.prompt_tokens ?? null,
      completionTokens: usage.completion_tokens ?? null,
      totalTokens: total,
    });
  } catch (error) {
    logger.warn('AI budget: spend not recorded', {
      feature,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
