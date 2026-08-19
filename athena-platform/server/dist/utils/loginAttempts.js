"use strict";
/**
 * Per-account login lockout
 * =========================
 * Tracks failed login attempts keyed by email + IP and locks that tuple
 * temporarily after too many failures. Backed by Redis when available;
 * gracefully degrades to a no-op if Redis isn't reachable so the platform
 * keeps working in single-instance dev / minimal infra setups.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLockoutStatus = getLockoutStatus;
exports.recordFailedLogin = recordFailedLogin;
exports.clearFailedLogins = clearFailedLogins;
const cache_1 = require("./cache");
const FAILED_KEY_PREFIX = 'login:fails';
const LOCK_KEY_PREFIX = 'login:lock';
const MAX_FAILURES = parseInt(process.env.LOGIN_MAX_FAILURES || '5', 10);
const FAILURE_WINDOW_SECONDS = parseInt(process.env.LOGIN_FAILURE_WINDOW_SECONDS || `${15 * 60}`, 10);
const LOCK_DURATION_SECONDS = parseInt(process.env.LOGIN_LOCK_DURATION_SECONDS || `${15 * 60}`, 10);
function normalizeKeyPart(value) {
    return String(value || 'unknown')
        .toLowerCase()
        .replace(/[^a-z0-9:._-]/g, '_')
        .slice(0, 254);
}
function failKey(email, ipAddress) {
    return `${FAILED_KEY_PREFIX}:${normalizeKeyPart(email)}:${normalizeKeyPart(ipAddress)}`;
}
function lockKey(email, ipAddress) {
    return `${LOCK_KEY_PREFIX}:${normalizeKeyPart(email)}:${normalizeKeyPart(ipAddress)}`;
}
/**
 * Returns whether the account is currently locked, and how long the caller
 * should wait before retrying.
 */
async function getLockoutStatus(email, ipAddress) {
    const client = (0, cache_1.getRedisClient)();
    if (!client)
        return { locked: false, retryAfterSeconds: 0 };
    try {
        const ttl = await client.ttl(lockKey(email, ipAddress));
        if (ttl > 0) {
            return { locked: true, retryAfterSeconds: ttl };
        }
        return { locked: false, retryAfterSeconds: 0 };
    }
    catch {
        // Fail open — never lock users out due to a Redis error.
        return { locked: false, retryAfterSeconds: 0 };
    }
}
/**
 * Records a failed login attempt. If the count crosses MAX_FAILURES inside
 * the rolling window, places a lock on the account.
 */
async function recordFailedLogin(email, ipAddress) {
    const client = (0, cache_1.getRedisClient)();
    if (!client)
        return { locked: false, retryAfterSeconds: 0 };
    try {
        const key = failKey(email, ipAddress);
        const count = await client.incr(key);
        if (count === 1) {
            await client.expire(key, FAILURE_WINDOW_SECONDS);
        }
        if (count >= MAX_FAILURES) {
            await client.set(lockKey(email, ipAddress), '1', 'EX', LOCK_DURATION_SECONDS);
            await client.del(key);
            return { locked: true, retryAfterSeconds: LOCK_DURATION_SECONDS };
        }
        return { locked: false, retryAfterSeconds: 0 };
    }
    catch {
        return { locked: false, retryAfterSeconds: 0 };
    }
}
/**
 * Clears the failed-attempts counter (call on successful login).
 */
async function clearFailedLogins(email, ipAddress) {
    const client = (0, cache_1.getRedisClient)();
    if (!client)
        return;
    try {
        await client.del(failKey(email, ipAddress));
        await client.del(lockKey(email, ipAddress));
    }
    catch {
        // ignore
    }
}
//# sourceMappingURL=loginAttempts.js.map