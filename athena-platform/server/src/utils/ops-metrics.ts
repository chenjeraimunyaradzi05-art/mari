/**
 * What has broken on the money paths since this process started.
 *
 * A Stripe webhook handler that threw, or an escrow hold the sweep could not
 * capture, used to fail into the log and nowhere else: the line scrolled past
 * and the only remaining sign was a member whose payment never applied. Nobody
 * could answer "is anything wrong right now?" without shelling into the box and
 * reading the log. This keeps a count per named operation plus the last few
 * failure messages, so /health/detailed can say WHAT broke rather than only
 * that something did.
 *
 * Three shapes, because they are answers to three different questions:
 *
 *  - recordSuccess / recordFailure count EVENTS, and a failure also keeps its
 *    message in a small ring buffer. Only failures reach the ring, and only the
 *    ring decides whether we are currently degraded.
 *  - recordIgnored counts work we deliberately did not do: a caller turned away
 *    at the door, an event type nothing here handles. It is a plain counter with
 *    no ring entry on purpose. The Stripe webhook endpoint is public and exempt
 *    from the rate limiter, so anything a stranger can trigger has to be counted
 *    somewhere it cannot evict real failures or flip the health state.
 *  - recordCondition is a GAUGE: how many of something are in a bad state right
 *    now, overwritten each time it is read. Standing conditions that need a
 *    human - escrow holds that have already lapsed - were being recorded as
 *    failures once per sweep, so the count climbed forever and health could
 *    never come back. A gauge goes down again when the condition is resolved.
 *
 * Deliberately small and deliberately honest. Everything here lives in one
 * process's memory: the counts start at zero when the process starts, they are
 * lost on restart, and a second instance behind the load balancer keeps its own
 * separate set. The snapshot says so in `note` rather than letting a reader
 * assume these are platform-wide totals. Anything that has to survive a deploy
 * belongs in Prometheus (utils/metrics.ts), not here.
 *
 * Nothing in this file may throw. It is wired into webhook handlers, and
 * observability that crashes the thing it observes is worse than none.
 */

/** Enough failures to see a pattern, few enough that the memory never matters. */
const FAILURE_RING_SIZE = 20;

/** A stack-trace-sized string in a health response helps nobody. */
const MAX_MESSAGE_LENGTH = 300;

/**
 * Callers here pass fixed strings, but a caller that ever passed something
 * derived from a payment intent id would grow this map for the life of the
 * process. Past the cap, new names are counted under OVERFLOW_OPERATION; the
 * failure ring still records the real name, so nothing is actually lost.
 */
const MAX_OPERATIONS = 100;
const OVERFLOW_OPERATION = '(other)';

/** How far back "recent" reaches when deciding whether we are currently degraded. */
export const RECENT_FAILURE_WINDOW_MS = 15 * 60 * 1000;

export interface OpsOperationCounts {
  success: number;
  failure: number;
  /**
   * Arrived and was deliberately not processed. Never a sign that anything is
   * wrong with us, so it is kept apart from `failure` and out of the ring.
   */
  ignored: number;
  lastFailureAt: string | null;
}

export interface OpsFailure {
  at: string;
  operation: string;
  message: string;
}

/** How many of something are in a bad state right now, as of `at`. */
export interface OpsCondition {
  count: number;
  at: string;
  /** What the number means and who has to act; null when there is nothing to add. */
  detail: string | null;
}

export interface OpsSnapshot {
  /** When this process started counting. */
  since: string;
  /** Says out loud what these numbers are and are not. */
  note: string;
  totals: { success: number; failure: number; ignored: number };
  operations: Record<string, OpsOperationCounts>;
  /** Newest first, at most FAILURE_RING_SIZE of them. */
  recentFailures: OpsFailure[];
  /**
   * Standing conditions, as last measured. Unlike the counts above these are
   * not cumulative: a zero here means the thing it names is clear right now.
   */
  conditions: Record<string, OpsCondition>;
}

const startedAt = new Date();
const counts = new Map<string, OpsOperationCounts>();
const conditions = new Map<string, OpsCondition>();

// Oldest first; the oldest is dropped once the ring is full.
const failures: OpsFailure[] = [];

function truncate(message: string): string {
  return message.length > MAX_MESSAGE_LENGTH ? `${message.slice(0, MAX_MESSAGE_LENGTH)}…` : message;
}

/**
 * A thrown value is not always an Error, and can even be an object whose
 * `message` getter throws, so every step here is defensive. When there is no
 * message to be had we say so instead of inventing one.
 */
function messageOf(error: unknown): string {
  try {
    if (error instanceof Error && error.message) return truncate(error.message);
    if (typeof error === 'string' && error) return truncate(error);
    if (error && typeof error === 'object') {
      const message = (error as { message?: unknown }).message;
      if (typeof message === 'string' && message) return truncate(message);
    }
    return 'No message on the thrown value';
  } catch {
    return 'Unreadable error value';
  }
}

function slotFor(operation: string): OpsOperationCounts {
  const key = counts.has(operation) || counts.size < MAX_OPERATIONS ? operation : OVERFLOW_OPERATION;
  let slot = counts.get(key);
  if (!slot) {
    slot = { success: 0, failure: 0, ignored: 0, lastFailureAt: null };
    counts.set(key, slot);
  }
  return slot;
}

/** Records that `operation` did what it was supposed to do, once. */
export function recordSuccess(operation: string): void {
  try {
    slotFor(operation).success += 1;
  } catch {
    // Counting is never worth failing a payment over.
  }
}

/**
 * Records that something reached `operation` and was deliberately not acted on:
 * a webhook post whose signature did not verify, an event type nothing here
 * handles.
 *
 * A counter and nothing else, deliberately. These are the paths an unauthenticated
 * stranger can reach, and while they were recorded with recordFailure() anyone on
 * the internet could push twenty bad signatures to evict every real failure from
 * the ring and hold /health/detailed at "degraded" for as long as they kept
 * posting. A number that only goes up here cannot do either, and still shows an
 * operator the one case that matters - a stale webhook secret, which looks like
 * every signature failing at once.
 */
export function recordIgnored(operation: string): void {
  try {
    slotFor(operation).ignored += 1;
  } catch {
    // Same reason as above.
  }
}

/**
 * Records that `count` of the thing `name` describes are in a bad state as of
 * now, replacing whatever was recorded before.
 *
 * For conditions that persist until a human fixes them. Recording those as
 * failures meant every re-check counted the same unresolved thing again, so the
 * total only ever grew and health never returned to healthy; a gauge falls back
 * to zero on the first check after they are dealt with.
 */
export function recordCondition(name: string, count: number, detail: string | null = null): void {
  try {
    // A count that is not a real number is not a measurement, and writing it
    // would leave an operator reading NaN as though it meant something.
    if (typeof count !== 'number' || !Number.isFinite(count) || count < 0) return;
    // Callers pass fixed names; the cap only stops a future caller that derives
    // one from a record id from growing this map for the life of the process.
    if (!conditions.has(name) && conditions.size >= MAX_OPERATIONS) return;
    conditions.set(name, {
      count: Math.floor(count),
      at: new Date().toISOString(),
      detail: typeof detail === 'string' && detail ? truncate(detail) : null,
    });
  } catch {
    // Same reason as above.
  }
}

/**
 * Records that `operation` failed, and keeps the message so an operator can see
 * which failure it was. `error` is whatever was thrown or caught.
 */
export function recordFailure(operation: string, error: unknown): void {
  try {
    const at = new Date().toISOString();
    const slot = slotFor(operation);
    slot.failure += 1;
    slot.lastFailureAt = at;

    failures.push({ at, operation, message: messageOf(error) });
    while (failures.length > FAILURE_RING_SIZE) {
      failures.shift();
    }
  } catch {
    // Same reason as above: the caller is mid-webhook and must not be disturbed.
  }
}

/**
 * How many of the retained failures happened inside `windowMs`. The health
 * endpoint uses this to go degraded while something is actively breaking,
 * rather than staying degraded forever because of one failure at boot.
 *
 * Only the retained failures are visible here, so during a storm of more than
 * FAILURE_RING_SIZE failures this undercounts. The totals in the snapshot are
 * the number to trust for volume; this one answers "is it happening now?".
 */
export function recentFailureCount(windowMs: number = RECENT_FAILURE_WINDOW_MS): number {
  try {
    const cutoff = Date.now() - windowMs;
    return failures.filter((failure) => {
      const at = Date.parse(failure.at);
      return Number.isFinite(at) && at >= cutoff;
    }).length;
  } catch {
    return 0;
  }
}

export function opsSnapshot(): OpsSnapshot {
  const operations: Record<string, OpsOperationCounts> = {};
  const currentConditions: Record<string, OpsCondition> = {};
  let success = 0;
  let failure = 0;
  let ignored = 0;

  try {
    for (const [operation, slot] of counts) {
      operations[operation] = { ...slot };
      success += slot.success;
      failure += slot.failure;
      ignored += slot.ignored;
    }
    for (const [name, condition] of conditions) {
      currentConditions[name] = { ...condition };
    }
  } catch {
    // Report what we managed to read rather than failing the health check.
  }

  return {
    since: startedAt.toISOString(),
    note:
      'Counts are in-memory and cover this process only. They start at zero when the process starts, are lost on restart, and other instances keep their own. Successes and failures accumulate; conditions are a reading taken at the time shown.',
    totals: { success, failure, ignored },
    operations,
    recentFailures: [...failures].reverse(),
    conditions: currentConditions,
  };
}

/** For tests. Nothing in the running server should call this. */
export function resetOpsMetrics(): void {
  counts.clear();
  conditions.clear();
  failures.length = 0;
}
