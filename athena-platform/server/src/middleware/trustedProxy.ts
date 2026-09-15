/**
 * The member's real address, from the one proxy allowed to say what it is.
 *
 * In production the browser never talks to this API directly: every call
 * goes through the Next.js route handlers on the web host, which fetch the
 * API from their own egress addresses. Left alone, that makes every visitor
 * look like the same handful of addresses, so the per-address limits are
 * shared by the whole site, the login lockout keys on the wrong address and
 * the new-device alerts never fire.
 *
 * The web host therefore forwards the visitor's address in
 * X-Athena-Client-Ip together with a shared secret in X-Athena-Proxy-Secret.
 * Only when the secret matches (PROXY_SHARED_SECRET, compared in constant
 * time) is the forwarded address believed; a request that carries the header
 * without the secret, or with the wrong one, is treated by its own address,
 * so a client calling the API directly cannot pick an address for itself.
 * Sockets connect to the API directly and are unaffected.
 */

import net from 'net';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { secretMatches } from '../utils/secret-compare';

export const PROXY_SECRET_HEADER = 'x-athena-proxy-secret';
export const PROXY_CLIENT_IP_HEADER = 'x-athena-client-ip';
const MIN_SECRET_LENGTH = 16;

declare module 'express-serve-static-core' {
  interface Request {
    /** True when req.ip was supplied by the trusted web proxy rather than the socket. */
    viaTrustedProxy?: boolean;
  }
}

/** The configured secret, or undefined when it is missing or too short to trust. */
export function proxySharedSecret(): string | undefined {
  const raw = process.env.PROXY_SHARED_SECRET?.trim();
  return raw && raw.length >= MIN_SECRET_LENGTH ? raw : undefined;
}

function headerValue(value: string | string[] | undefined): string | undefined {
  const single = Array.isArray(value) ? value[0] : value;
  return typeof single === 'string' && single.trim() ? single.trim() : undefined;
}

/**
 * The forwarded address, when the request proves it came from the web proxy
 * and the address is well-formed. Null otherwise.
 */
export function forwardedClientIp(
  headers: Record<string, string | string[] | undefined>,
  secret: string | undefined = proxySharedSecret()
): string | null {
  if (!secret) return null;
  if (!secretMatches(headerValue(headers[PROXY_SECRET_HEADER]), secret)) return null;
  const ip = headerValue(headers[PROXY_CLIENT_IP_HEADER]);
  return ip && net.isIP(ip) ? ip : null;
}

// A wrong secret is worth one line a minute, not one per request.
let lastRejectionLog = 0;
function noteRejected(req: Request): void {
  const now = Date.now();
  if (now - lastRejectionLog < 60_000) return;
  lastRejectionLog = now;
  logger.warn('Proxy identity headers presented with a secret that does not match', {
    ip: req.ip,
    path: req.path,
  });
}

export function trustedProxyIdentity(req: Request, _res: Response, next: NextFunction): void {
  const presented = headerValue(req.headers[PROXY_SECRET_HEADER]);
  if (!presented) return next();

  const ip = forwardedClientIp(req.headers);
  if (!ip) {
    noteRejected(req);
    return next();
  }

  // req.ip is a getter on Express's request prototype; an own property on
  // this request shadows it for everything downstream, the rate limiters and
  // the session records included.
  Object.defineProperty(req, 'ip', { value: ip, configurable: true, enumerable: true });
  req.viaTrustedProxy = true;
  next();
}
