/**
 * Per-account login lockout
 * =========================
 * Tracks failed login attempts keyed by email + IP and locks that tuple
 * temporarily after too many failures. Backed by Redis when available;
 * gracefully degrades to a no-op if Redis isn't reachable so the platform
 * keeps working in single-instance dev / minimal infra setups.
 */
export interface LockoutStatus {
    locked: boolean;
    retryAfterSeconds: number;
}
/**
 * Returns whether the account is currently locked, and how long the caller
 * should wait before retrying.
 */
export declare function getLockoutStatus(email: string, ipAddress?: string): Promise<LockoutStatus>;
/**
 * Records a failed login attempt. If the count crosses MAX_FAILURES inside
 * the rolling window, places a lock on the account.
 */
export declare function recordFailedLogin(email: string, ipAddress?: string): Promise<LockoutStatus>;
/**
 * Clears the failed-attempts counter (call on successful login).
 */
export declare function clearFailedLogins(email: string, ipAddress?: string): Promise<void>;
//# sourceMappingURL=loginAttempts.d.ts.map