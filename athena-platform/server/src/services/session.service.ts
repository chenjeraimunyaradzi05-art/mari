import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { hashOpaqueToken } from '../utils/opaqueToken';
import { getTokenExpiresInSeconds } from '../utils/jwt';

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

export const sessionService = {
  async findActiveSessionByAccessToken(accessToken: string) {
    const hashedToken = hashOpaqueToken(accessToken);
    const session =
      await prisma.session.findUnique({
        where: { token: hashedToken },
      }) ||
      await prisma.session.findUnique({
        where: { token: accessToken },
      });

    if (!session) return null;
    if (session.revokedAt) return null;
    if (session.expiresAt < new Date()) return null;

    return session;
  },

  async findActiveSessionByRefreshToken(refreshToken: string) {
    const hashedRefreshToken = hashOpaqueToken(refreshToken);
    const session =
      await prisma.session.findFirst({
        where: { refreshToken: hashedRefreshToken },
      }) ||
      await prisma.session.findFirst({
        where: { refreshToken },
      });

    if (!session) return null;
    if (session.revokedAt) return null;
    if (session.expiresAt < new Date()) return null;

    return session;
  },

  /**
   * Create a new session
   */
  async createSession(
    userId: string,
    accessToken: string,
    refreshToken: string,
    userAgent?: string,
    ipAddress?: string
  ) {
    const refreshExpiresIn = getTokenExpiresInSeconds(refreshToken);

    const session = await prisma.session.create({
      data: {
        userId,
        token: hashOpaqueToken(accessToken),
        refreshToken: hashOpaqueToken(refreshToken),
        expiresAt: new Date(Date.now() + (refreshExpiresIn ?? 7 * 24 * 60 * 60) * 1000),
        userAgent,
        ipAddress,
      },
    });

    logger.info(`Session created for user ${userId}`, {
      sessionId: session.id,
      ipAddress,
      userAgent: userAgent ? userAgent.substring(0, 100) : undefined,
    });

    return session;
  },

  /**
   * Rotate refresh token (revoke old session, create new one)
   */
  async rotateRefreshToken(
    oldRefreshToken: string,
    newAccessToken: string,
    newRefreshToken: string,
    userAgent?: string,
    ipAddress?: string
  ) {
    // Find and revoke old session
    const oldSession = await sessionService.findActiveSessionByRefreshToken(oldRefreshToken);

    if (!oldSession) {
      throw new Error('Session not found or expired');
    }

    // Revoke old session
    await prisma.session.update({
      where: { id: oldSession.id },
      data: { revokedAt: new Date() },
    });

    // Create new session
    const newSession = await sessionService.createSession(
      oldSession.userId,
      newAccessToken,
      newRefreshToken,
      userAgent,
      ipAddress
    );

    logger.info(`Token rotation completed for user ${oldSession.userId}`, {
      oldSessionId: oldSession.id,
      newSessionId: newSession.id,
    });

    return newSession;
  },

  /**
   * Revoke a specific session
   */
  async revokeSession(sessionId: string) {
    const session = await prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });

    logger.info(`Session revoked: ${sessionId}`, { userId: session.userId });
    return session;
  },

  /**
   * Revoke all sessions for a user (logout all devices)
   */
  async revokeAllUserSessions(userId: string) {
    const sessions = await prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null, // Only revoke active sessions
      },
      data: { revokedAt: new Date() },
    });

    logger.info(`All sessions revoked for user ${userId}`, {
      count: sessions.count,
    });

    return sessions;
  },

  /**
   * Get all active sessions for a user
   */
  async getUserActiveSessions(userId: string, currentAccessToken?: string): Promise<SessionInfo[]> {
    const sessions = await prisma.session.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        token: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        expiresAt: true,
        revokedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // "This device" is the session whose token the caller is using right now.
    // The newest session used to be assumed current, which pointed the label
    // at whichever device had signed in last, not the one looking at the list.
    const currentHashes = currentAccessToken
      ? new Set([hashOpaqueToken(currentAccessToken), currentAccessToken])
      : null;
    const anyMatch = currentHashes ? sessions.some((s) => currentHashes.has(s.token)) : false;

    return sessions.map(({ token, ...s }, idx) => ({
      ...s,
      userAgent: s.userAgent || undefined,
      ipAddress: s.ipAddress || undefined,
      revokedAt: s.revokedAt,
      isCurrent: currentHashes && anyMatch ? currentHashes.has(token) : !currentHashes && idx === 0,
    }));
  },

  /**
   * Validate session (check if not revoked and not expired)
   */
  async validateSession(refreshToken: string): Promise<boolean> {
    const session = await sessionService.findActiveSessionByRefreshToken(refreshToken);
    return !!session;
  },

  /**
   * Detect refresh-token reuse: if a token belongs to a *revoked* session,
   * treat it as a compromise and revoke every active session for that user.
   * Returns the affected userId (or null if no revoked match was found).
   */
  async detectRefreshTokenReuse(refreshToken: string): Promise<string | null> {
    const hashedRefreshToken = hashOpaqueToken(refreshToken);
    const revoked =
      (await prisma.session.findFirst({
        where: { refreshToken: hashedRefreshToken, revokedAt: { not: null } },
        select: { userId: true, id: true },
      })) ||
      (await prisma.session.findFirst({
        where: { refreshToken, revokedAt: { not: null } },
        select: { userId: true, id: true },
      }));

    if (!revoked) return null;

    const result = await prisma.session.updateMany({
      where: { userId: revoked.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    logger.warn('Refresh-token reuse detected — all sessions revoked', {
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
    const deleted = await prisma.session.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

    if (deleted.count > 0) {
      logger.info(`Cleaned up ${deleted.count} expired sessions`);
    }

    return deleted;
  },
};
