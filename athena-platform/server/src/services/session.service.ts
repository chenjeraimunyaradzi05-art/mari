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
  async getUserActiveSessions(userId: string): Promise<SessionInfo[]> {
    const sessions = await prisma.session.findMany({
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
  async validateSession(refreshToken: string): Promise<boolean> {
    const session = await sessionService.findActiveSessionByRefreshToken(refreshToken);
    return !!session;
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
