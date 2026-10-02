/**
 * A connection that outlives the account behind it.
 *
 * A socket authenticates once, at the handshake. Suspending or banning a
 * member, changing her role, or deleting her account ended her access on the
 * REST API at once (every request re-reads the account) and left the
 * connections she already had open going: they kept delivering her messages and
 * kept accepting what she sent into other members' inboxes and a host's live
 * chat until they happened to drop. Two things hold that now, and both are
 * pinned here:
 *
 *  - a session revocation announces itself and every socket on those sessions
 *    is told and closed (disconnectRevokedSockets), whichever reason it was;
 *  - a socket that is somehow still open re-reads its owner's standing before
 *    it sends, and a suspended, banned or vanished account is refused and
 *    disconnected.
 */

import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Server as SocketIOServer } from 'socket.io';

type Query = jest.Mock<(args?: any) => Promise<unknown>>;

const userFindUnique = jest.fn() as Query;
const messageCreate = jest.fn() as Query;
const transaction = jest.fn() as jest.Mock<(ops: Array<Promise<unknown>>) => Promise<unknown[]>>;

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: { findUnique: userFindUnique },
    message: { create: messageCreate },
    conversation: { update: jest.fn() },
    conversationParticipant: { updateMany: jest.fn() },
    userSafetySettings: { findUnique: jest.fn() },
    notification: { create: jest.fn(async () => ({})) },
    $transaction: transaction,
  },
}));

const SUSPENDED_MESSAGE = 'This account has been suspended. If you believe this is a mistake, you can appeal from the sign-in page.';
jest.mock('../../middleware/auth', () => ({
  authenticateSocketToken: jest.fn(),
  SUSPENDED_ACCOUNT_MESSAGE:
    'This account has been suspended. If you believe this is a mistake, you can appeal from the sign-in page.',
}));

const isBlockedRelationship = jest.fn() as jest.Mock<(a: string, b: string) => Promise<boolean>>;
jest.mock('../../utils/safety-store', () => ({ isBlockedRelationship }));

const canOpenConversation = jest.fn() as jest.Mock<(a: string, b: string) => Promise<{ allowed: boolean; reason?: string }>>;
jest.mock('../message-permissions.service', () => ({ canOpenConversation }));

const assertContentAllowed = jest.fn() as jest.Mock<(content: string, ctx: unknown) => Promise<void>>;
jest.mock('../moderation.service', () => ({ assertContentAllowed }));

jest.mock('../push.service', () => ({ pushToUser: jest.fn(), pushPreview: (text: string) => text }));

// Every rule about who may write to whom is in sendDirectMessage, which has its
// own tests; what this suite pins is that a closed account never reaches it.
const sendDirectMessage = jest.fn(async (..._args: unknown[]) => ({ message: { id: 'm-1' } }));
jest.mock('../direct-message.service', () => ({
  findDirectConversation: jest.fn(async () => null),
  sendDirectMessage: (...args: unknown[]) => sendDirectMessage(...args),
}));

jest.mock('../message-expiry.service', () => ({
  conversationTtl: jest.fn(async () => null),
  expiryFor: jest.fn(() => null),
}));

const postChatMessage = jest.fn() as jest.Mock<(streamId: string, userId: string, content: string) => Promise<unknown>>;
jest.mock('../livestream.service', () => ({
  LIVE_CHAT_MAX_LENGTH: 500,
  postChatMessage,
  recordViewerCount: jest.fn(),
}));

jest.mock('../presence.service', () => ({ announcePresence: jest.fn(async () => 0) }));

jest.mock('../i18n.service', () => ({
  i18nService: { tSync: jest.fn(() => 'You have a new message') },
  NOTIFICATION_KEYS: { MESSAGE_RECEIVED: 'notifications.message_received' },
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { closedAccountRefusal, disconnectRevokedSockets, initializeSocketHandlers } from '../socket.service';
import { sessionEvents } from '../../utils/session-events';

// ------------------------------------------------------------------ harness

type Handler = (...args: any[]) => unknown;

class FakeSocket {
  static count = 0;
  id = `socket-${(FakeSocket.count += 1)}`;
  handlers = new Map<string, Handler>();
  said: Array<{ event: string; payload: unknown }> = [];
  disconnected = false;
  rooms = new Set<string>();
  broadcast = { emit: jest.fn() };

  constructor(public userId: string, public sessionId?: string) {}

  on(event: string, handler: Handler) {
    this.handlers.set(event, handler);
  }
  emit(event: string, payload?: unknown) {
    this.said.push({ event, payload });
    return true;
  }
  join(room: string) {
    this.rooms.add(room);
  }
  leave(room: string) {
    this.rooms.delete(room);
  }
  disconnect() {
    this.disconnected = true;
  }
  to() {
    return { emit: jest.fn() };
  }
  async fire(event: string, ...args: unknown[]) {
    const handler = this.handlers.get(event);
    if (!handler) throw new Error(`No handler for ${event}`);
    await handler(...args);
  }
  heard(event: string) {
    return this.said.filter((entry) => entry.event === event).map((entry) => entry.payload);
  }
}

/** io.to(a).to(b).emit(...): the rooms are not what these tests are about. */
const chain = (): { to: () => unknown; emit: () => boolean } => ({ to: () => chain(), emit: () => true });

/** A Socket.IO server that holds the sockets the test puts in it. */
function fakeServer() {
  const sockets = new Map<string, FakeSocket>();
  let onConnection: ((socket: FakeSocket) => void) | undefined;
  const io = {
    use: () => undefined,
    on: (event: string, handler: (socket: FakeSocket) => void) => {
      if (event === 'connection') onConnection = handler;
    },
    to: () => chain(),
    sockets: { sockets, adapter: { rooms: new Map() } },
  };
  return {
    io: io as unknown as SocketIOServer,
    open(userId: string, sessionId?: string) {
      const socket = new FakeSocket(userId, sessionId);
      sockets.set(socket.id, socket);
      onConnection?.(socket);
      return socket;
    },
  };
}

let accountCount = 0;
/** A fresh account name, so the per-account send throttles start empty. */
const account = (name: string) => `${name}-${(accountCount += 1)}`;

const inGoodStanding = {
  isSuspended: false,
  bannedAt: null,
  dateOfBirth: new Date('1991-04-02'),
  womanVerificationStatus: 'UNVERIFIED',
  dvSafetyProfile: null,
  profile: null,
  preferredLocale: 'en-AU',
  region: 'AU',
};

// ------------------------------------------------------- closing sockets

describe('disconnectRevokedSockets', () => {
  it('tells every socket of the account why, and closes it, and leaves other accounts alone', () => {
    const server = fakeServer();
    const mine1 = server.open('u1', 's1');
    const mine2 = server.open('u1', 's2');
    const someoneElse = server.open('u2', 's3');

    const closed = disconnectRevokedSockets(server.io, { userId: 'u1', reason: 'suspended' });

    expect(closed).toBe(2);
    for (const socket of [mine1, mine2]) {
      expect(socket.heard('session:revoked')).toEqual([{ reason: 'suspended' }]);
      expect(socket.disconnected).toBe(true);
    }
    expect(someoneElse.disconnected).toBe(false);
    expect(someoneElse.heard('session:revoked')).toEqual([]);
  });

  it('closes only the named session when one device was signed out', () => {
    const server = fakeServer();
    const phone = server.open('u1', 'phone');
    const laptop = server.open('u1', 'laptop');

    const closed = disconnectRevokedSockets(server.io, { userId: 'u1', sessionId: 'phone', reason: 'revoked' });

    expect(closed).toBe(1);
    expect(phone.disconnected).toBe(true);
    expect(laptop.disconnected).toBe(false);
  });

  it('spares the session that did the revoking', () => {
    const server = fakeServer();
    const here = server.open('u1', 'here');
    const there = server.open('u1', 'there');

    const closed = disconnectRevokedSockets(server.io, { userId: 'u1', exceptSessionId: 'here', reason: 'password-changed' });

    expect(closed).toBe(1);
    expect(here.disconnected).toBe(false);
    expect(there.disconnected).toBe(true);
  });

  it('reports zero when the account has no open connection', () => {
    const server = fakeServer();
    server.open('u2', 's1');
    expect(disconnectRevokedSockets(server.io, { userId: 'u1', reason: 'banned' })).toBe(0);
  });

  it('does not match a socket that never named a user', () => {
    const server = fakeServer();
    const anonymous = server.open(undefined as unknown as string);
    disconnectRevokedSockets(server.io, { userId: 'u1', reason: 'banned' });
    expect(anonymous.disconnected).toBe(false);
  });
});

describe('what announces a revocation reaches the open sockets', () => {
  beforeAll(() => {
    sessionEvents.removeAllListeners('revoked');
  });

  it.each(['suspended', 'banned', 'role-changed', 'account-deleted', 'reuse-detected'] as const)(
    'closes her connections when the reason is %s',
    (reason) => {
      sessionEvents.removeAllListeners('revoked');
      const server = fakeServer();
      initializeSocketHandlers(server.io);
      const open = server.open('u1', 's1');
      const other = server.open('u2', 's2');

      sessionEvents.announceRevoked({ userId: 'u1', reason });

      expect(open.disconnected).toBe(true);
      expect(open.heard('session:revoked')).toEqual([{ reason }]);
      expect(other.disconnected).toBe(false);
    }
  );
});

// ------------------------------------------------- an account that closed

describe('a connection that is still open for an account that has since been closed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    isBlockedRelationship.mockResolvedValue(false);
    canOpenConversation.mockResolvedValue({ allowed: true });
    assertContentAllowed.mockResolvedValue(undefined);
    messageCreate.mockImplementation(async (args: any) => ({ id: 'm-1', ...args.data, sender: { id: args.data.senderId } }));
    transaction.mockImplementation(async (ops) => Promise.all(ops));
    postChatMessage.mockResolvedValue({ id: 'chat-1' });
    userFindUnique.mockResolvedValue(inGoodStanding);
  });

  function connected(userId: string) {
    sessionEvents.removeAllListeners('revoked');
    const server = fakeServer();
    initializeSocketHandlers(server.io);
    return server.open(userId, 'session-1');
  }

  it('reads her standing from the database, and says so in the words every other surface uses', async () => {
    userFindUnique.mockResolvedValue({ isSuspended: true, bannedAt: null });
    await expect(closedAccountRefusal('u1')).resolves.toEqual({ message: SUSPENDED_MESSAGE, code: 'ACCOUNT_SUSPENDED' });
    expect(userFindUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'u1' } }));
  });

  it('lets an account in good standing through', async () => {
    userFindUnique.mockResolvedValue({ isSuspended: false, bannedAt: null });
    await expect(closedAccountRefusal('u1')).resolves.toBeNull();
  });

  it.each([
    ['suspended', { isSuspended: true, bannedAt: null }],
    ['banned, with the suspension flag never set', { isSuspended: false, bannedAt: new Date() }],
    ['gone altogether', null],
  ])('refuses a direct message from an account that is %s, and drops the connection', async (_label, row) => {
    const sender = account('sender');
    const socket = connected(sender);
    userFindUnique.mockResolvedValue(row);

    await socket.fire('messages:send', { receiverId: 'someone-she-was-messaging', content: 'hello' });

    expect(socket.heard('messages:error')).toEqual([{ message: SUSPENDED_MESSAGE, code: 'ACCOUNT_SUSPENDED' }]);
    expect(socket.disconnected).toBe(true);
    // Nothing was written, and nobody was told.
    expect(sendDirectMessage).not.toHaveBeenCalled();
    expect(messageCreate).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it('refuses live chat from a suspended account, and drops the connection', async () => {
    const sender = account('chatter');
    const socket = connected(sender);
    userFindUnique.mockResolvedValue({ isSuspended: true, bannedAt: null });

    await socket.fire('live:chat', { streamId: 'stream-1', content: 'hi everyone' });

    expect(socket.heard('live:error')).toEqual([
      { streamId: 'stream-1', message: SUSPENDED_MESSAGE, code: 'ACCOUNT_SUSPENDED' },
    ]);
    expect(socket.disconnected).toBe(true);
    expect(postChatMessage).not.toHaveBeenCalled();
  });

  // The same rule authenticate applies to every write over HTTP. Live chat is
  // sent over the socket, so a member a reviewer has refused could otherwise
  // still speak in a host's room.
  it('refuses live chat from a member a reviewer has refused, in the gate\'s words, and keeps the connection', async () => {
    const socket = connected(account('refused'));
    userFindUnique.mockResolvedValue({ ...inGoodStanding, womanVerificationStatus: 'REJECTED' });

    await socket.fire('live:chat', { streamId: 'stream-1', content: 'hi everyone' });

    expect(socket.heard('live:error')).toEqual([
      { streamId: 'stream-1', message: expect.stringMatching(/appeal/i), code: 'WOMAN_VERIFICATION_REJECTED' },
    ]);
    // She can go on reading the room; only the writing is closed.
    expect(socket.disconnected).toBe(false);
    expect(postChatMessage).not.toHaveBeenCalled();
  });

  it('refuses live chat from an account whose date of birth is under the minimum', async () => {
    const socket = connected(account('minor'));
    const fifteen = new Date(Date.now() - 15 * 365 * 24 * 60 * 60 * 1000);
    userFindUnique.mockResolvedValue({ ...inGoodStanding, dateOfBirth: fifteen });

    await socket.fire('live:chat', { streamId: 'stream-1', content: 'hi everyone' });

    expect(socket.heard('live:error')).toEqual([
      expect.objectContaining({ streamId: 'stream-1', code: 'MINIMUM_AGE_NOT_MET' }),
    ]);
    expect(postChatMessage).not.toHaveBeenCalled();
  });

  it('lets a member whose check is still being reviewed speak', async () => {
    const pending = connected(account('pending'));
    userFindUnique.mockResolvedValue({ ...inGoodStanding, womanVerificationStatus: 'PENDING' });
    await pending.fire('live:chat', { streamId: 'stream-1', content: 'hello' });

    expect(pending.heard('live:error')).toEqual([]);
    expect(postChatMessage).toHaveBeenCalledTimes(1);
  });

  // An account with no date of birth (one made before it was asked for) is
  // refused every write over HTTP until she gives it (middleware/account-standing.ts),
  // and live chat is a write that arrives over a socket. Letting it speak here
  // would leave the one door the floor does not close. She keeps her connection
  // and can go on reading; the sentence says what to do.
  it('asks an account with no date of birth on file for it before it speaks, and keeps the connection', async () => {
    const older = connected(account('older'));
    userFindUnique.mockResolvedValue({ ...inGoodStanding, dateOfBirth: null });

    await older.fire('live:chat', { streamId: 'stream-1', content: 'hello' });

    expect(older.heard('live:error')).toEqual([
      { streamId: 'stream-1', message: expect.stringMatching(/date of birth/i), code: 'DATE_OF_BIRTH_REQUIRED' },
    ]);
    expect(older.disconnected).toBe(false);
    expect(postChatMessage).not.toHaveBeenCalled();
  });

  it('does not change what a member in good standing can do', async () => {
    const sender = account('member');
    const socket = connected(sender);

    await socket.fire('messages:send', { receiverId: 'her-friend', content: 'hello' });
    await socket.fire('live:chat', { streamId: 'stream-1', content: 'hi everyone' });

    expect(socket.disconnected).toBe(false);
    expect(socket.heard('messages:error')).toEqual([]);
    expect(socket.heard('live:error')).toEqual([]);
    expect(sendDirectMessage).toHaveBeenCalledWith({ senderId: sender, receiverId: 'her-friend', content: 'hello' });
    expect(postChatMessage).toHaveBeenCalledWith('stream-1', sender, 'hi everyone');
  });
});
