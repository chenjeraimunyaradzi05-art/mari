/**
 * Presence: who may see a member come online, and who is online right now.
 *
 * What is online is the socket layer's own record: socket.service keeps a map
 * of connected accounts (isUserOnline), and that is the whole of it. The
 * realtime layer runs on one instance — Socket.IO has no Redis adapter here,
 * so a room only reaches the sockets on the process that holds them — and
 * presence is exactly as wide as that.
 *
 * This file used to hold a Redis presence layer with away and busy states,
 * device types and cross-instance pub/sub. Nothing ever called its
 * initialize(), so none of it ran, and its own broadcast was the same
 * io.emit-to-everyone as the one that did run. What it left out is what
 * mattered. The live code announced "presence:user_online" and
 * "presence:user_offline" to every connected socket on the platform: no
 * block, no "hide my online status", no Safe Mode. Any account at all,
 * including a man she had blocked, could open a socket and watch a member's
 * user id come online and go offline, and the switch in her safety settings
 * that said it would stop that did nothing. And nothing told a client who was
 * already online when it connected, so ChatWindow showed someone who had been
 * on for an hour as offline until she happened to reconnect.
 *
 * So presence now has an audience, and the one rule is used both ways:
 *
 *   - It goes only to the people she has an established direct-message
 *     thread with. A request she has not accepted, or one she declined, is
 *     not an established thread: whoever sent it does not learn when she is
 *     on.
 *   - Never across a block, in either direction.
 *   - Never at all while she has hidden her online status or has Safe Mode on
 *     (in either of the two places Safe Mode is stored; see womanGateState).
 *
 * announcePresence pushes a change to that audience. onlineCounterpartsFor
 * answers the question the other way round, for a member who has just
 * connected: which of the people who would have been told are online now.
 */

import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { getBlockedRelationshipIds } from '../utils/safety-store';
import { emitToUserRoom } from './socket.service';

export type PresenceState = 'online' | 'offline';

/**
 * A reconnecting client says "I am online" every time its socket comes back,
 * and a page that reloads twice says it twice in as many seconds. Each
 * announcement reads her threads, her blocks and her settings, so a repeat
 * inside this window, with no offline in between, is not read again: the
 * people it would reach were told a moment ago.
 */
const ONLINE_REPEAT_WINDOW_MS = 10_000;
const recentlyAnnouncedOnline = new Map<string, number>();

/**
 * The other side of every direct-message thread this member has that is
 * established: opened without a request, or a request that was accepted, and
 * not declined. Group chats have no participant rows, so they never widen it.
 */
async function establishedCounterparts(userId: string): Promise<string[]> {
  const rows = await prisma.conversationParticipant.findMany({
    where: {
      userId: { not: userId },
      conversation: {
        participants: { some: { userId } },
        requestDeclinedAt: null,
        OR: [{ requestedById: null }, { requestAcceptedAt: { not: null } }],
      },
    },
    select: { userId: true },
  });
  return Array.from(new Set(rows.map((row) => row.userId)));
}

/**
 * The members among these who have asked not to be seen online: "hide my
 * online status" in her safety settings, or Safe Mode switched on in either
 * store. A woman who has told us she is in danger at home is not announced to
 * anyone, whatever the other switch says.
 */
export async function membersHidingPresence(userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const rows = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      safetySettings: { select: { hideOnlineStatus: true } },
      dvSafetyProfile: { select: { isSafeMode: true } },
      profile: { select: { isSafeMode: true } },
    },
  });
  const hidden = new Set<string>();
  for (const row of rows) {
    if (row.safetySettings?.hideOnlineStatus || row.dvSafetyProfile?.isSafeMode || row.profile?.isSafeMode) {
      hidden.add(row.id);
    }
  }
  return hidden;
}

/** Her established counterparts, less anyone on either side of a block with her. */
async function unblockedCounterparts(userId: string): Promise<string[]> {
  const [counterparts, blockedIds] = await Promise.all([
    establishedCounterparts(userId),
    getBlockedRelationshipIds(userId),
  ]);
  const blocked = new Set(blockedIds);
  return counterparts.filter((id) => !blocked.has(id));
}

/**
 * Everyone who may see this member's online state. Empty while she hides it.
 */
export async function presenceAudience(userId: string): Promise<string[]> {
  const hidden = await membersHidingPresence([userId]);
  if (hidden.has(userId)) return [];
  return unblockedCounterparts(userId);
}

/**
 * Tells her audience she has come online or gone offline, and returns how
 * many people that was.
 *
 * Offline goes to the same audience as online, and for the same reason: to a
 * member she hides from, an offline notice would say she had been on until
 * that moment. See withdrawPresence for the one case where offline has to go
 * out regardless.
 */
export async function announcePresence(userId: string, state: PresenceState): Promise<number> {
  const now = Date.now();
  if (state === 'online') {
    const last = recentlyAnnouncedOnline.get(userId);
    if (last !== undefined && now - last < ONLINE_REPEAT_WINDOW_MS) return 0;
    recentlyAnnouncedOnline.set(userId, now);
  } else {
    recentlyAnnouncedOnline.delete(userId);
  }

  try {
    const audience = await presenceAudience(userId);
    const event = state === 'online' ? 'presence:user_online' : 'presence:user_offline';
    for (const viewerId of audience) {
      emitToUserRoom(viewerId, event, { userId });
    }
    return audience.length;
  } catch (error) {
    // A presence dot is not worth a failed connection, but it is worth
    // knowing that nobody is being told: forget the announcement so the next
    // one is not skipped as a repeat, and say why.
    if (state === 'online') recentlyAnnouncedOnline.delete(userId);
    logger.warn('Presence not announced', {
      userId,
      state,
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}

/**
 * Takes back an "online" she has just asked to hide.
 *
 * When a member switches on "hide my online status" or Safe Mode while she is
 * connected, the people in her threads were told she was online a moment
 * earlier and would go on reading "Active now" until they reloaded, which is
 * the opposite of what she asked for. They already know she was on, so an
 * offline notice now tells them nothing new; it goes to her unblocked
 * counterparts even though her audience is now empty.
 */
export async function withdrawPresence(userId: string): Promise<number> {
  recentlyAnnouncedOnline.delete(userId);
  try {
    const counterparts = await unblockedCounterparts(userId);
    for (const viewerId of counterparts) {
      emitToUserRoom(viewerId, 'presence:user_offline', { userId });
    }
    return counterparts.length;
  } catch (error) {
    logger.warn('Presence not withdrawn', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}

/**
 * Which of the people this member would be told about are online right now:
 * her established, unblocked counterparts who are connected and are not
 * hiding. The same rule as announcePresence read from the other end, so a
 * client that seeds itself from this and then listens for changes sees
 * exactly what it would have seen had it been connected all along.
 *
 * `isOnline` is the socket layer's own answer, passed in so this file does
 * not decide what "connected" means.
 */
export async function onlineCounterpartsFor(
  viewerId: string,
  isOnline: (userId: string) => boolean
): Promise<string[]> {
  const counterparts = await unblockedCounterparts(viewerId);
  const connected = counterparts.filter((id) => isOnline(id));
  if (connected.length === 0) return [];
  const hidden = await membersHidingPresence(connected);
  return connected.filter((id) => !hidden.has(id));
}

/**
 * The shutdown hook in index.ts calls presenceService.cleanup(). Presence
 * holds no connections or timers of its own; the one thing it keeps between
 * calls is the short memory of who was announced online a moment ago, and
 * this forgets it.
 */
export const presenceService = {
  async cleanup(): Promise<void> {
    recentlyAnnouncedOnline.clear();
  },
};
