import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { hashOpaqueToken } from '../utils/opaqueToken';
import { getTokenExpiresInSeconds } from '../utils/jwt';
import { sessionEvents, SessionRevokedEvent } from '../utils/session-events';

/**
 * Session Management Service
 * Handles token rotation, session tracking, and revocation
 *
 * Tokens are looked up by their SHA-256 only. A plaintext fallback used to sit
 * beside every lookup for sessions written before the hashing was added (August
 * 2026); the longest a refresh token has ever lived here is 30 days and that was
 * more than six weeks ago, so no unexpired row that could still match one
 * remains, and the fallback was only a way to spend a lookup on a value nobody
 * could hold.
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

/**
 * How long after a rotation the retired refresh token is still read as "the
 * same device asking twice" rather than "somebody replaying a stolen token".
 *
 * Two tabs, or a request retried after a dropped connection, present the same
 * token within moments of each other. The first rotates it; the second then
 * arrives with a token that now belongs to a revoked session, which is exactly
 * what reuse detection treats as theft, and the member was signed out of every
 * device for opening two tabs. Inside this window the replay is refused with a
 * "try again" and nothing else happens: no tokens are issued for it, so a thief
 * gains nothing from the window except not being noticed for ten seconds, while
 * a replay after it still revokes everything.
 */
export const REFRESH_REUSE_GRACE_MS = 10_000;

/**
 * Two requests rotated the same refresh token at once and this one lost. The
 * token is not stolen and the session is not over: the winner has already
 * issued the new pair, and asking again with it works.
 */
export class RefreshConflictError extends Error {
  constructor() {
    super('This refresh token was just rotated by another request');
    this.name = 'RefreshConflictError';
  }
}

/** What turned up when a refresh token that has no live session was presented. */
export type RefreshReplay =
  /** It never belonged to a session: a forgery, or a client that has long since lost its session. */
  | { kind: 'unknown' }
  /** It was retired a moment ago by the same device: another tab or a retry. Nothing was revoked. */
  | { kind: 'concurrent'; userId: string }
  /** It belonged to a session retired earlier: treated as theft, and every session of the account was revoked. */
  | { kind: 'reuse'; userId: string };

/** A missing user agent on both sides still counts as the same device; two different ones do not. */
function sameDevice(recorded: string | null | undefined, presented: string | null | undefined): boolean {
  return (recorded ?? '') === (presented ?? '');
}

/**
 * What a session keeps of its refresh token once it is ended on purpose: nothing.
 *
 * A refresh token that turns up after its session was *rotated* is the sign of
 * a stolen token, and that is what the hash left on a retired row is for
 * (detectRefreshTokenReuse). A session that was signed out, revoked from the
 * device list, ended by a password change or by a moderator's decision is not
 * that: its owner, or a moderator, closed it. The row kept its hash all the
 * same, so the device that had just been signed out refreshed with it, was read
 * as a thief replaying a rotated token, and every other session of the account
 * was burned. Signing out an old phone, or changing a password after a scare,
 * signed the member out of the device she or they did it on as soon as the old
 * one next came online, which with a fifteen minute access token is the next
 * quarter hour. Without the hash the token is an unknown one: refused, and
 * nothing else.
 */
const ENDED_ON_PURPOSE = { refreshToken: null } as const;

/**
 * Stops notifications reaching the phones of an account that has no session
 * left on any of them.
 *
 * A push token belongs to the handset, not to a session, so ending every
 * session left every handset registered: a phone signed out of everywhere, for
 * a member who had lost it, or whose abuser held it, went on lighting up with
 * message previews and safety alerts. The apps register again on their next
 * sign-in (registerPushToken sets the row active), so a member who signs back
 * in loses nothing. Best effort and last: the sessions are already ended, and
 * that is what refuses the account.
 */
async function stopPushNotifications(userId: string): Promise<void> {
  try {
    const stopped = await prisma.pushToken.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    });
    if (stopped.count > 0) {
      logger.info(`Push notifications stopped on ${stopped.count} device(s) after every session ended`, { userId });
    }
  } catch (error) {
    logger.warn('Could not stop push notifications after every session ended', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export const sessionService = {
  async findActiveSessionByAccessToken(accessToken: string) {
    const session = await prisma.session.findUnique({
      where: { token: hashOpaqueToken(accessToken) },
    });

    if (!session) return null;
    if (session.revokedAt) return null;
    if (session.expiresAt < new Date()) return null;

    return session;
  },

  async findActiveSessionByRefreshToken(refreshToken: string) {
    const session = await prisma.session.findFirst({
      where: { refreshToken: hashOpaqueToken(refreshToken) },
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
   * Rotate refresh token (revoke old session, create new one).
   *
   * Retiring the old session and creating the new one are one transaction, and
   * retiring it is conditional on it still being live. It used to be find,
   * then update, then create, so two requests holding the same token both
   * passed the find and both created a session: one refresh token produced two
   * live pairs, and the loser of the race could only look like a replay to the
   * next request. Now exactly one wins; the other gets RefreshConflictError,
   * which is not a theft and costs the member nothing.
   */
  async rotateRefreshToken(
    oldRefreshToken: string,
    newAccessToken: string,
    newRefreshToken: string,
    userAgent?: string,
    ipAddress?: string
  ) {
    const oldSession = await sessionService.findActiveSessionByRefreshToken(oldRefreshToken);

    if (!oldSession) {
      // The route found this session live a moment ago, so if it is gone now
      // another request retired it in between: the same lost race as below.
      throw new RefreshConflictError();
    }

    const refreshExpiresIn = getTokenExpiresInSeconds(newRefreshToken);

    const newSession = await prisma.$transaction(async (tx) => {
      const claimed = await tx.session.updateMany({
        where: { id: oldSession.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (claimed.count === 0) {
        throw new RefreshConflictError();
      }

      return tx.session.create({
        data: {
          userId: oldSession.userId,
          token: hashOpaqueToken(newAccessToken),
          refreshToken: hashOpaqueToken(newRefreshToken),
          expiresAt: new Date(Date.now() + (refreshExpiresIn ?? 7 * 24 * 60 * 60) * 1000),
          userAgent,
          ipAddress,
        },
      });
    });

    logger.info(`Token rotation completed for user ${oldSession.userId}`, {
      oldSessionId: oldSession.id,
      newSessionId: newSession.id,
    });

    return newSession;
  },

  /**
   * Revoke a specific session
   */
  async revokeSession(sessionId: string, reason: SessionRevokedEvent['reason'] = 'revoked') {
    const session = await prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date(), ...ENDED_ON_PURPOSE },
    });

    logger.info(`Session revoked: ${sessionId}`, { userId: session.userId });
    // A live socket on this session is told to go; the REST API already refuses it.
    sessionEvents.announceRevoked({ userId: session.userId, sessionId, reason });
    return session;
  },

  /**
   * Revoke all sessions for a user (logout all devices)
   */
  async revokeAllUserSessions(
    userId: string,
    options: { reason?: SessionRevokedEvent['reason']; exceptSessionId?: string } = {}
  ) {
    const sessions = await prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null, // Only revoke active sessions
        ...(options.exceptSessionId ? { id: { not: options.exceptSessionId } } : {}),
      },
      data: { revokedAt: new Date(), ...ENDED_ON_PURPOSE },
    });

    logger.info(`All sessions revoked for user ${userId}`, {
      count: sessions.count,
    });

    sessionEvents.announceRevoked({
      userId,
      exceptSessionId: options.exceptSessionId,
      reason: options.reason ?? 'revoked',
    });

    // Every session gone means no device is signed in any more. When one is
    // spared (a password change keeps the device it was made on) the handsets
    // cannot be told apart, so none is touched.
    if (!options.exceptSessionId) {
      await stopPushNotifications(userId);
    }

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
    const currentHash = currentAccessToken ? hashOpaqueToken(currentAccessToken) : null;
    const anyMatch = currentHash ? sessions.some((s) => s.token === currentHash) : false;

    return sessions.map(({ token, ...s }, idx) => ({
      ...s,
      userAgent: s.userAgent || undefined,
      ipAddress: s.ipAddress || undefined,
      revokedAt: s.revokedAt,
      isCurrent: currentHash && anyMatch ? token === currentHash : !currentHash && idx === 0,
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
   * Say what a refresh token with no live session is. Called only after
   * findActiveSessionByRefreshToken has come back empty.
   *
   * A token that belongs to a *revoked* session is a replay of a rotated one.
   * Replayed within REFRESH_REUSE_GRACE_MS by the same device it is a second
   * tab or a retry and nothing is revoked; replayed later, or from another
   * device, it is treated as a compromise and every active session for that
   * user is revoked.
   */
  async detectRefreshTokenReuse(
    refreshToken: string,
    context: { userAgent?: string } = {}
  ): Promise<RefreshReplay> {
    const retired = await prisma.session.findFirst({
      where: { refreshToken: hashOpaqueToken(refreshToken), revokedAt: { not: null } },
      select: { userId: true, id: true, revokedAt: true, userAgent: true },
    });

    if (!retired) return { kind: 'unknown' };

    const retiredFor = retired.revokedAt ? Date.now() - retired.revokedAt.getTime() : Number.POSITIVE_INFINITY;
    if (retiredFor <= REFRESH_REUSE_GRACE_MS && sameDevice(retired.userAgent, context.userAgent)) {
      logger.info('Refresh token presented again just after it was rotated; treated as a second tab or a retry', {
        userId: retired.userId,
        retiredSessionId: retired.id,
        retiredMsAgo: retiredFor,
      });
      return { kind: 'concurrent', userId: retired.userId };
    }

    const result = await prisma.session.updateMany({
      where: { userId: retired.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    logger.warn('Refresh-token reuse detected — all sessions revoked', {
      userId: retired.userId,
      revokedSessionId: retired.id,
      sessionsRevoked: result.count,
    });

    sessionEvents.announceRevoked({ userId: retired.userId, reason: 'reuse-detected' });
    // A stolen token may be in a stranger's hands, and so may the phone it came from.
    await stopPushNotifications(retired.userId);

    return { kind: 'reuse', userId: retired.userId };
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
