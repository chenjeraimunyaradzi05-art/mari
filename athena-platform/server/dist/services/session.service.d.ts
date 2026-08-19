/**
 * Session Management Service
 * Handles token rotation, session tracking, and revocation
 */
export interface SessionInfo {
    id: string;
    userAgent?: string;
    ipAddress?: string;
    createdAt: Date;
    expiresAt: Date;
    revokedAt?: Date | null;
    isCurrent: boolean;
}
export declare const sessionService: {
    findActiveSessionByAccessToken(accessToken: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        expiresAt: Date;
        ipAddress: string | null;
        userAgent: string | null;
        token: string;
        refreshToken: string | null;
        revokedAt: Date | null;
    } | null>;
    findActiveSessionByRefreshToken(refreshToken: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        expiresAt: Date;
        ipAddress: string | null;
        userAgent: string | null;
        token: string;
        refreshToken: string | null;
        revokedAt: Date | null;
    } | null>;
    /**
     * Create a new session
     */
    createSession(userId: string, accessToken: string, refreshToken: string, userAgent?: string, ipAddress?: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        expiresAt: Date;
        ipAddress: string | null;
        userAgent: string | null;
        token: string;
        refreshToken: string | null;
        revokedAt: Date | null;
    }>;
    /**
     * Rotate refresh token (revoke old session, create new one)
     */
    rotateRefreshToken(oldRefreshToken: string, newAccessToken: string, newRefreshToken: string, userAgent?: string, ipAddress?: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        expiresAt: Date;
        ipAddress: string | null;
        userAgent: string | null;
        token: string;
        refreshToken: string | null;
        revokedAt: Date | null;
    }>;
    /**
     * Revoke a specific session
     */
    revokeSession(sessionId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        expiresAt: Date;
        ipAddress: string | null;
        userAgent: string | null;
        token: string;
        refreshToken: string | null;
        revokedAt: Date | null;
    }>;
    /**
     * Revoke all sessions for a user (logout all devices)
     */
    revokeAllUserSessions(userId: string): Promise<import(".prisma/client").Prisma.BatchPayload>;
    /**
     * Get all active sessions for a user
     */
    getUserActiveSessions(userId: string): Promise<SessionInfo[]>;
    /**
     * Validate session (check if not revoked and not expired)
     */
    validateSession(refreshToken: string): Promise<boolean>;
    /**
     * Detect refresh-token reuse: if a token belongs to a *revoked* session,
     * treat it as a compromise and revoke every active session for that user.
     * Returns the affected userId (or null if no revoked match was found).
     */
    detectRefreshTokenReuse(refreshToken: string): Promise<string | null>;
    /**
     * Cleanup expired sessions (runs periodically)
     */
    cleanupExpiredSessions(): Promise<import(".prisma/client").Prisma.BatchPayload>;
};
//# sourceMappingURL=session.service.d.ts.map