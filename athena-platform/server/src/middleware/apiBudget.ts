/**
 * How many API calls a caller may make in a window, judged by who is calling.
 *
 * The one limiter in front of /api used to key on the address alone and give
 * every address the same 100 calls in 15 minutes. That is a fair wall for a
 * stranger and the wrong one for a member: the dashboard polls for
 * notifications and unread messages every thirty seconds and spends three to
 * eight calls on every page, so a woman using the product in the ordinary way
 * ran out in about ten minutes, and from then on every call, her session
 * refresh included, answered 429 until the window turned over. Members behind
 * one campus or office address spent a single budget between them.
 *
 * So the budget follows the caller:
 *
 *   - Someone presenting a valid access token is counted as that member, under
 *     her own key, whatever address she is on. The token is checked for its
 *     signature, its expiry and that it is an access token, and nothing else:
 *     there is no database read in front of every request. A token that is
 *     forged, expired or of the wrong kind is not an identity and falls
 *     through to the address, so presenting garbage never buys a larger
 *     budget. Staff accounts, whose work is bulk by nature, get a larger one.
 *   - Everyone else is counted by address, 100 per window in production, as
 *     before. The address is the visitor's own when the web proxy has proved
 *     it forwarded it (middleware/trustedProxy.ts), which has to be mounted
 *     ahead of this. An IPv6 address counts as its /64: a single subscriber is
 *     handed a whole /64, so keying on the full address would give a script a
 *     fresh budget for every request.
 *
 * The counters live in the shared store (Redis when it is configured), so
 * every instance of the API draws on the same budget.
 *
 * What this is not: it is not the limit on any one dangerous thing. Sign-in,
 * sign-up, refresh and password reset have their own much tighter limiters
 * (credentialLimiters below and src/index.ts), and posting, messaging, search,
 * upload and reporting each have theirs (socialLimits.ts, rateLimiter.ts). This
 * is the ceiling on everything else, and it is set to be reached only by a
 * script.
 */

import type { Request } from 'express';
import rateLimit, { type RateLimitRequestHandler, type Store } from 'express-rate-limit';
import { verifyToken } from '../utils/jwt';
import { SharedRateLimitStore } from '../utils/rate-limit-store';

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

/** Roles whose work reaches other members' records or the moderation queue. */
const STAFF_ROLES: ReadonlySet<string> = new Set(['MODERATOR', 'ADMIN', 'SUPER_ADMIN']);

export type CallerKind = 'anonymous' | 'member' | 'staff';

export interface Caller {
  /** The counter this caller's requests are added to. */
  key: string;
  kind: CallerKind;
}

/**
 * The first four groups of an IPv6 address, the /64 a subscriber is given, or
 * the address itself when it is IPv4. An IPv4-mapped IPv6 address is the IPv4
 * address, which is how Node reports one over a dual-stack socket.
 */
export function addressKey(address: string | undefined): string {
  if (!address) return 'unknown';

  const mapped = address.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (mapped) return mapped[1];
  if (!address.includes(':')) return address;

  // Drop a zone (fe80::1%eth0) and expand the "::" so the first four groups are the first four groups.
  const bare = address.split('%')[0].toLowerCase();
  const halves = bare.split('::');
  if (halves.length > 2) return address;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? head.length !== 8 : missing < 0) return address;

  const groups = [...head, ...(halves.length === 2 ? Array(missing).fill('0') : []), ...tail];
  if (groups.length !== 8 || !groups.every((group) => /^[0-9a-f]{1,4}$/.test(group))) return address;
  return `${groups.slice(0, 4).map((group) => group.replace(/^0+(?=.)/, '')).join(':')}::/64`;
}

const callers = new WeakMap<Request, Caller>();

/**
 * Who a request counts as. Decided once per request, because the limiter asks
 * twice (for the key and for the budget) and a signature check is not free.
 */
export function identifyCaller(req: Request): Caller {
  const known = callers.get(req);
  if (known) return known;

  let caller: Caller = { key: `ip:${addressKey(req.ip || req.socket?.remoteAddress)}`, kind: 'anonymous' };

  const header = req.headers.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    try {
      const payload = verifyToken(header.slice('Bearer '.length).trim(), 'access');
      if (typeof payload.userId === 'string' && payload.userId) {
        caller = { key: `user:${payload.userId}`, kind: STAFF_ROLES.has(payload.role) ? 'staff' : 'member' };
      }
    } catch {
      // Forged, expired, the wrong kind of token, or no signing key: she is
      // counted by address like anyone else, and authenticate will say why.
    }
  }

  callers.set(req, caller);
  return caller;
}

function positiveInteger(raw: string | undefined, fallback: number): number {
  const parsed = parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export interface ApiBudgetOptions {
  windowMs?: number;
  /** Calls per window for an address that presents no valid token. */
  anonymousMax?: number;
  /** Calls per window for one signed-in member, on whatever address. */
  memberMax?: number;
  /** Calls per window for one staff account. */
  staffMax?: number;
  store?: Store;
  /** Defaults to NODE_ENV === 'production'. Outside production the budgets are relaxed. */
  production?: boolean;
}

/**
 * The budgets, from the environment. RATE_LIMIT_MAX is the anonymous one and
 * keeps its meaning (and its default of 100) from before there was more than
 * one; RATE_LIMIT_WINDOW_MS is the window for all of them. Outside production
 * they are relaxed, because one homepage load fans out to six calls and a
 * manual or end-to-end pass trips 100 in a few minutes.
 */
export function apiBudgetsFromEnv(production = process.env.NODE_ENV === 'production') {
  return {
    windowMs: positiveInteger(process.env.RATE_LIMIT_WINDOW_MS, FIFTEEN_MINUTES_MS),
    anonymousMax: positiveInteger(process.env.RATE_LIMIT_MAX, production ? 100 : 2000),
    memberMax: positiveInteger(process.env.RATE_LIMIT_MEMBER_MAX, production ? 1500 : 6000),
    staffMax: positiveInteger(process.env.RATE_LIMIT_STAFF_MAX, production ? 5000 : 10000),
  };
}

export function createApiBudget(options: ApiBudgetOptions = {}): RateLimitRequestHandler {
  const fromEnv = apiBudgetsFromEnv(options.production);
  const budgets = {
    windowMs: options.windowMs ?? fromEnv.windowMs,
    anonymousMax: options.anonymousMax ?? fromEnv.anonymousMax,
    memberMax: options.memberMax ?? fromEnv.memberMax,
    staffMax: options.staffMax ?? fromEnv.staffMax,
  };
  const maxFor: Record<CallerKind, number> = {
    anonymous: budgets.anonymousMax,
    member: budgets.memberMax,
    staff: budgets.staffMax,
  };

  return rateLimit({
    windowMs: budgets.windowMs,
    max: (req) => maxFor[identifyCaller(req).kind],
    keyGenerator: (req) => identifyCaller(req).key,
    message: { success: false, message: 'Too many requests, please try again later.' },
    // Both families of header: the standard RateLimit-* a current client reads,
    // and the X-RateLimit-* the API documentation has always promised and the
    // per-route limiters send. A 429 also carries Retry-After.
    standardHeaders: true,
    legacyHeaders: true,
    // The metrics scrape and the payment webhooks are not callers of the API in
    // this sense, and Stripe retries a refused webhook for days. The session
    // refresh is skipped because it has a limiter of its own (30 a minute per
    // address, in src/index.ts), and because it is made with an expired token,
    // so it would be counted as an anonymous call: members on a shared address
    // would then be signed out by the anonymous budget they are not part of.
    skip: (req: Request) => req.path === '/metrics' || req.path.startsWith('/webhooks') || req.path === '/auth/refresh',
    validate: { xForwardedForHeader: false },
    store: options.store ?? new SharedRateLimitStore('rl:budget:'),
  });
}

/**
 * Sign-in and sign-up, each on its own counter. They shared one, so a burst of
 * sign-ups from a shared address (a classroom, an event) spent the budget the
 * same people needed to sign in with, and the other way round. Ten attempts in
 * 15 minutes per address in production, the figure the API documentation gives;
 * the account lockout (utils/loginAttempts) is the tighter limit on one
 * account, and this is the one on one address.
 */
export function createCredentialLimiters(
  options: { production?: boolean; store?: (prefix: string) => Store } = {}
): { login: RateLimitRequestHandler; register: RateLimitRequestHandler } {
  const production = options.production ?? process.env.NODE_ENV === 'production';
  const storeFor = options.store ?? ((prefix: string) => new SharedRateLimitStore(prefix));
  const make = (prefix: string, message: string) =>
    rateLimit({
      windowMs: FIFTEEN_MINUTES_MS,
      max: production ? 10 : 100, // relaxed outside production
      message: { success: false, message },
      standardHeaders: true,
      legacyHeaders: false,
      validate: { xForwardedForHeader: false },
      store: storeFor(prefix),
    });

  return {
    login: make('rl:login:', 'Too many login attempts, please try again later.'),
    register: make('rl:register:', 'Too many sign-up attempts, please try again later.'),
  };
}
