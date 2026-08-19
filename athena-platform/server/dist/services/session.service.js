"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionService = void 0;
const prisma_1 = require("../utils/prisma");
const logger_1 = require("../utils/logger");
const opaqueToken_1 = require("../utils/opaqueToken");
const jwt_1 = require("../utils/jwt");
exports.sessionService = {
    async findActiveSessionByAccessToken(accessToken) {
        const hashedToken = (0, opaqueToken_1.hashOpaqueToken)(accessToken);
        const session = await prisma_1.prisma.session.findUnique({
            where: { token: hashedToken },
        }) ||
            await prisma_1.prisma.session.findUnique({
                where: { token: accessToken },
            });
        if (!session)
            return null;
        if (session.revokedAt)
            return null;
        if (session.expiresAt < new Date())
            return null;
        return session;
    },
    async findActiveSessionByRefreshToken(refreshToken) {
        const hashedRefreshToken = (0, opaqueToken_1.hashOpaqueToken)(refreshToken);
        const session = await prisma_1.prisma.session.findFirst({
            where: { refreshToken: hashedRefreshToken },
        }) ||
            await prisma_1.prisma.session.findFirst({
                where: { refreshToken },
            });
        if (!session)
            return null;
        if (session.revokedAt)
            return null;
        if (session.expiresAt < new Date())
            return null;
        return session;
    },
    /**
     * Create a new session
     */
    async createSession(userId, accessToken, refreshToken, userAgent, ipAddress) {
        const refreshExpiresIn = (0, jwt_1.getTokenExpiresInSeconds)(refreshToken);
        const session = await prisma_1.prisma.session.create({
            data: {
                userId,
                token: (0, opaqueToken_1.hashOpaqueToken)(accessToken),
                refreshToken: (0, opaqueToken_1.hashOpaqueToken)(refreshToken),
                expiresAt: new Date(Date.now() + (refreshExpiresIn ?? 7 * 24 * 60 * 60) * 1000),
                userAgent,
                ipAddress,
            },
        });
        logger_1.logger.info(`Session created for user ${userId}`, {
            sessionId: session.id,
            ipAddress,
            userAgent: userAgent ? userAgent.substring(0, 100) : undefined,
        });
        return session;
    },
    /**
     * Rotate refresh token (revoke old session, create new one)
     */
    async rotateRefreshToken(oldRefreshToken, newAccessToken, newRefreshToken, userAgent, ipAddress) {
        // Find and revoke old session
        const oldSession = await exports.sessionService.findActiveSessionByRefreshToken(oldRefreshToken);
        if (!oldSession) {
            throw new Error('Session not found or expired');
        }
        // Revoke old session
        await prisma_1.prisma.session.update({
            where: { id: oldSession.id },
            data: { revokedAt: new Date() },
        });
        // Create new session
        const newSession = await exports.sessionService.createSession(oldSession.userId, newAccessToken, newRefreshToken, userAgent, ipAddress);
        logger_1.logger.info(`Token rotation completed for user ${oldSession.userId}`, {
            oldSessionId: oldSession.id,
            newSessionId: newSession.id,
        });
        return newSession;
    },
    /**
     * Revoke a specific session
     */
    async revokeSession(sessionId) {
        const session = await prisma_1.prisma.session.update({
            where: { id: sessionId },
            data: { revokedAt: new Date() },
        });
        logger_1.logger.info(`Session revoked: ${sessionId}`, { userId: session.userId });
        return session;
    },
    /**
     * Revoke all sessions for a user (logout all devices)
     */
    async revokeAllUserSessions(userId) {
        const sessions = await prisma_1.prisma.session.updateMany({
            where: {
                userId,
                revokedAt: null, // Only revoke active sessions
            },
            data: { revokedAt: new Date() },
        });
        logger_1.logger.info(`All sessions revoked for user ${userId}`, {
            count: sessions.count,
        });
        return sessions;
    },
    /**
     * Get all active sessions for a user
     */
    async getUserActiveSessions(userId) {
        const sessions = await prisma_1.prisma.session.findMany({
            where: {
                userId,
                revokedAt: null,
                expiresAt: { gt: new Date() },
            },
            select: {
                id: true,
                userAgent: true,
                ipAddress: true,
                createdAt: true,
                expiresAt: true,
                revokedAt: true,
            },
            orderBy: { createdAt: 'desc' },
        });
        // We'll assume the first session in the list is the current one if we know the current token
        return sessions.map((s, idx) => ({
            ...s,
            userAgent: s.userAgent || undefined,
            ipAddress: s.ipAddress || undefined,
            revokedAt: s.revokedAt,
            isCurrent: idx === 0, // This is a simple heuristic; in practice, you'd pass the current token
        }));
    },
    /**
     * Validate session (check if not revoked and not expired)
     */
    async validateSession(refreshToken) {
        const session = await exports.sessionService.findActiveSessionByRefreshToken(refreshToken);
        return !!session;
    },
    /**
     * Detect refresh-token reuse: if a token belongs to a *revoked* session,
     * treat it as a compromise and revoke every active session for that user.
     * Returns the affected userId (or null if no revoked match was found).
     */
    async detectRefreshTokenReuse(refreshToken) {
        const hashedRefreshToken = (0, opaqueToken_1.hashOpaqueToken)(refreshToken);
        const revoked = (await prisma_1.prisma.session.findFirst({
            where: { refreshToken: hashedRefreshToken, revokedAt: { not: null } },
            select: { userId: true, id: true },
        })) ||
            (await prisma_1.prisma.session.findFirst({
                where: { refreshToken, revokedAt: { not: null } },
                select: { userId: true, id: true },
            }));
        if (!revoked)
            return null;
        const result = await prisma_1.prisma.session.updateMany({
            where: { userId: revoked.userId, revokedAt: null },
            data: { revokedAt: new Date() },
        });
        logger_1.logger.warn('Refresh-token reuse detected — all sessions revoked', {
            userId: revoked.userId,
            revokedSessionId: revoked.id,
            sessionsRevoked: result.count,
        });
        return revoked.userId;
    },
    /**
     * Cleanup expired sessions (runs periodically)
     */
    async cleanupExpiredSessions() {
        const deleted = await prisma_1.prisma.session.deleteMany({
            where: {
                expiresAt: { lt: new Date() },
            },
        });
        if (deleted.count > 0) {
            logger_1.logger.info(`Cleaned up ${deleted.count} expired sessions`);
        }
        return deleted;
    },
};
//# sourceMappingURL=session.service.js.map