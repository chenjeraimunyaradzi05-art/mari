/**
 * The socket is a second door into a member's inbox and into a host's live
 * chat, and until this suite nothing tested what stands in it.
 *
 * Every route suite mocks initializeSocketHandlers out, and the only socket
 * test was the handshake's token check. So the rules the REST routes are
 * tested for — a ceiling on how fast one account can send, no thread across
 * a block, the recipient's "who can message me", the women-only floor, the
 * age gate, content moderation — were enforced on the socket by code nothing
 * would notice being deleted. These drive the real handlers through a
 * stand-in for Socket.IO: the server hands the connection callback a socket,
 * the test fires events at it and reads back what was emitted where.
 *
 * The throttles are the real in-memory ones, so each test sends as its own
 * account; the window is per account and would otherwise carry over.
 */

import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Server as SocketIOServer } from 'socket.io';

type Query = jest.Mock<(args?: any) => Promise<unknown>>;

const messageCreate = jest.fn() as Query;
const conversationUpdate = jest.fn() as Query;
const participantUpdateMany = jest.fn() as Query;
const userFindUnique = jest.fn() as Query;
const notificationCreate = jest.fn() as Query;
const liveStreamFindUnique = jest.fn() as Query;
const transaction = jest.fn() as jest.Mock<(ops: Array<Promise<unknown>>) => Promise<unknown[]>>;

jest.mock('../../utils/prisma', () => ({
  prisma: {
    message: { create: messageCreate },
    conversation: { update: conversationUpdate },
    conversationParticipant: { updateMany: participantUpdateMany },
    user: { findUnique: userFindUnique },
    notification: { create: notificationCreate },
    liveStream: { findUnique: liveStreamFindUnique },
    $transaction: transaction,
  },
}));

const authenticateSocketToken = jest.fn() as Query;
jest.mock('../../middleware/auth', () => ({ authenticateSocketToken }));

const isBlockedRelationship = jest.fn() as jest.Mock<(a: string, b: string) => Promise<boolean>>;
jest.mock('../../utils/safety-store', () => ({ isBlockedRelationship }));

const canOpenConversation = jest.fn() as jest.Mock<(a: string, b: string) => Promise<{ allowed: boolean; reason?: string }>>;
jest.mock('../message-permissions.service', () => ({ canOpenConversation }));

const assertContentAllowed = jest.fn() as jest.Mock<(content: string, ctx: unknown) => Promise<void>>;
jest.mock('../moderation.service', () => ({ assertContentAllowed }));

const pushToUser = jest.fn();
jest.mock('../push.service', () => ({ pushToUser, pushPreview: (text: string) => text }));

jest.mock('../direct-message.service', () => ({
  findDirectConversation: jest.fn(async () => null),
  getOrCreateDirectConversation: jest.fn(async () => ({ id: 'conv-1' })),
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

jest.mock('../i18n.service', () => ({
  i18nService: { tSync: jest.fn(() => 'You have a new message') },
  NOTIFICATION_KEYS: { MESSAGE_RECEIVED: 'notifications.message_received' },
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { initializeSocketHandlers } from '../socket.service';
import { SOCIAL_LIMITS } from '../../middleware/socialLimits';
import { ApiError } from '../../middleware/errorHandler';

// ------------------------------------------------------------------ harness

type Handler = (...args: any[]) => unknown;
type Emission = { rooms: string[]; event: string; payload: unknown };

/** Everything the server emitted through io.to(...), with the rooms it chose. */
const roomEmissions: Emission[] = [];
let connectionHandler: ((socket: FakeSocket) => void) | undefined;
let authMiddleware: ((socket: any, next: (err?: Error) => void) => unknown) | undefined;

const chain = (rooms: string[]) => ({
  to: (room: string) => chain([...rooms, room]),
  emit: (event: string, payload?: unknown) => {
    roomEmissions.push({ rooms, event, payload });
    return true;
  },
});

const fakeIo = {
  use: (middleware: typeof authMiddleware) => {
    authMiddleware = middleware;
  },
  on: (event: string, handler: (socket: FakeSocket) => void) => {
    if (event === 'connection') connectionHandler = handler;
  },
  to: (room: string) => chain([room]),
  sockets: { sockets: new Map(), adapter: { rooms: new Map() } },
};

let socketCount = 0;

class FakeSocket {
  id = `socket-${(socketCount += 1)}`;
  handlers = new Map<string, Handler>();
  /** What the server said back to this socket alone. */
  said: Array<{ event: string; payload: unknown }> = [];
  rooms = new Set<string>();
  broadcast = { emit: jest.fn() };
  constructor(public userId: string) {}
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
  disconnect() {}
  to(room: string) {
    return chain([room]);
  }
  async fire(event: string, ...args: unknown[]) {
    const handler = this.handlers.get(event);
    if (!handler) throw new Error(`No handler for ${event}`);
    await handler(...args);
  }
  errors(event: string) {
    return this.said.filter((entry) => entry.event === event).map((entry) => entry.payload);
  }
}

function connect(userId: string): FakeSocket {
  const socket = new FakeSocket(userId);
  connectionHandler!(socket);
  return socket;
}

let accountCount = 0;
/** A fresh account name, so the per-account throttles start empty. */
const account = (name: string) => `${name}-${(accountCount += 1)}`;

/** An adult member in good standing, as the gate and the notification read her. */
const memberRow = (overrides: Record<string, unknown> = {}) => ({
  womanVerificationStatus: 'UNVERIFIED',
  dateOfBirth: new Date('1991-04-02'),
  dvSafetyProfile: null,
  profile: null,
  preferredLocale: 'en-AU',
  region: 'AU',
  ...overrides,
});

beforeAll(() => {
  initializeSocketHandlers(fakeIo as unknown as SocketIOServer);
});

beforeEach(() => {
  jest.clearAllMocks();
  roomEmissions.length = 0;
  userFindUnique.mockResolvedValue(memberRow());
  isBlockedRelationship.mockResolvedValue(false);
  canOpenConversation.mockResolvedValue({ allowed: true });
  assertContentAllowed.mockResolvedValue(undefined);
  messageCreate.mockImplementation(async (args: any) => ({
    id: `m-${messageCreate.mock.calls.length}`,
    ...args.data,
    sender: { id: args.data.senderId, firstName: 'Amira', lastName: 'K', avatar: null },
  }));
  conversationUpdate.mockResolvedValue({});
  participantUpdateMany.mockResolvedValue({ count: 1 });
  transaction.mockImplementation(async (ops) => Promise.all(ops));
  notificationCreate.mockImplementation(async (args: any) => ({ id: 'n-1', ...args.data }));
  postChatMessage.mockResolvedValue({ id: 'chat-1' });
});

// ------------------------------------------------------------------ handshake

describe('the handshake', () => {
  it('turns away a connection that carries no token, before any handler is reached', async () => {
    const next = jest.fn();
    await authMiddleware!({ handshake: { auth: {}, headers: {} } }, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Authentication required' }));
    expect(authenticateSocketToken).not.toHaveBeenCalled();
  });

  it('turns away a token the session check refuses, without saying why', async () => {
    authenticateSocketToken.mockRejectedValue(new ApiError(401, 'Session revoked'));
    const next = jest.fn();
    await authMiddleware!({ handshake: { auth: { token: 'tok' }, headers: {} } }, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Authentication failed' }));
  });
});

// ------------------------------------------------------------------ messages:send

describe('messages:send', () => {
  it('stores the message, delivers it once to the thread and the recipient, and notifies her', async () => {
    const amira = account('amira');
    const sender = connect(amira);

    await sender.fire('messages:send', { receiverId: 'bea', content: '  Are you coming on Thursday?  ' });

    expect(messageCreate).toHaveBeenCalledTimes(1);
    expect(messageCreate.mock.calls[0][0].data).toMatchObject({
      conversationId: 'conv-1',
      senderId: amira,
      receiverId: 'bea',
      content: 'Are you coming on Thursday?',
      type: 'TEXT',
    });

    const delivered = roomEmissions.filter((e) => e.event === 'messages:new');
    expect(delivered).toHaveLength(1);
    expect(delivered[0].rooms).toEqual([`conversation:${[amira, 'bea'].sort().join(':')}`, 'user:bea']);

    expect(notificationCreate.mock.calls[0][0].data).toMatchObject({ userId: 'bea', type: 'MESSAGE' });
    // Nobody for Bea is connected, so her phone hears about it instead.
    expect(pushToUser).toHaveBeenCalledWith('bea', 'MESSAGE', expect.objectContaining({ link: `/dashboard/messages?user=${amira}` }));
    expect(sender.errors('messages:error')).toEqual([]);
  });

  it(`holds one account to ${SOCIAL_LIMITS.message.max} messages in the window, as the REST route does`, async () => {
    const sender = connect(account('flooder'));

    for (let i = 0; i < SOCIAL_LIMITS.message.max; i += 1) {
      await sender.fire('messages:send', { receiverId: 'bea', content: `line ${i}` });
    }
    expect(sender.errors('messages:error')).toEqual([]);

    await sender.fire('messages:send', { receiverId: 'bea', content: 'one more' });

    expect(sender.errors('messages:error')).toEqual([
      { message: 'You are sending messages very quickly. Take a short break and try again.' },
    ]);
    expect(messageCreate).toHaveBeenCalledTimes(SOCIAL_LIMITS.message.max);
  });

  it('refuses a message with nobody, or yourself, on the other end', async () => {
    const me = account('solo');
    const sender = connect(me);

    await sender.fire('messages:send', { content: 'hello?' });
    await sender.fire('messages:send', { receiverId: me, content: 'note to self' });

    expect(sender.errors('messages:error')).toEqual([{ message: 'Choose someone to message' }, { message: 'Choose someone to message' }]);
    expect(messageCreate).not.toHaveBeenCalled();
  });

  it('refuses a thread across a block, before anything else about the recipient is read', async () => {
    const him = account('blocked');
    const sender = connect(him);
    isBlockedRelationship.mockResolvedValue(true);

    await sender.fire('messages:send', { receiverId: 'her', content: 'why did you block me' });

    expect(isBlockedRelationship).toHaveBeenCalledWith(him, 'her');
    expect(sender.errors('messages:error')).toEqual([{ message: 'You cannot message this user' }]);
    expect(canOpenConversation).not.toHaveBeenCalled();
    expect(assertContentAllowed).not.toHaveBeenCalled();
    expect(messageCreate).not.toHaveBeenCalled();
    expect(roomEmissions).toEqual([]);
    expect(pushToUser).not.toHaveBeenCalled();
  });

  it('holds the women-only floor: an account a reviewer refused cannot message anyone', async () => {
    const sender = connect(account('refused'));
    userFindUnique.mockResolvedValue(memberRow({ womanVerificationStatus: 'REJECTED' }));

    await sender.fire('messages:send', { receiverId: 'bea', content: 'hi' });

    expect(sender.errors('messages:error')).toEqual([expect.objectContaining({ code: 'WOMAN_VERIFICATION_REJECTED' })]);
    expect(messageCreate).not.toHaveBeenCalled();
  });

  it('holds the age gate: no date of birth, or under the minimum age, sends nothing', async () => {
    const sender = connect(account('nodob'));
    userFindUnique.mockResolvedValue(memberRow({ dateOfBirth: null }));
    await sender.fire('messages:send', { receiverId: 'bea', content: 'hi' });

    const young = new Date();
    young.setFullYear(young.getFullYear() - 14);
    userFindUnique.mockResolvedValue(memberRow({ dateOfBirth: young }));
    await sender.fire('messages:send', { receiverId: 'bea', content: 'hi' });

    expect(sender.errors('messages:error')).toEqual([
      expect.objectContaining({ code: 'DATE_OF_BIRTH_REQUIRED' }),
      expect.objectContaining({ code: 'MINIMUM_AGE_NOT_MET' }),
    ]);
    expect(messageCreate).not.toHaveBeenCalled();
  });

  it('honours the recipient’s choice of who may message her, in her words', async () => {
    const sender = connect(account('stranger'));
    canOpenConversation.mockResolvedValue({ allowed: false, reason: 'Bea only takes messages from people she follows.' });

    await sender.fire('messages:send', { receiverId: 'bea', content: 'hi' });

    expect(sender.errors('messages:error')).toEqual([{ message: 'Bea only takes messages from people she follows.' }]);
    expect(assertContentAllowed).not.toHaveBeenCalled();
    expect(messageCreate).not.toHaveBeenCalled();
  });

  it('screens the text the same way the REST route does, and stores nothing it refuses', async () => {
    const sender = connect(account('abusive'));
    assertContentAllowed.mockRejectedValue(new ApiError(422, 'This message was not sent because it breaks the community guidelines.'));

    await sender.fire('messages:send', { receiverId: 'bea', content: 'something vile' });

    expect(assertContentAllowed).toHaveBeenCalledWith('something vile', expect.objectContaining({ kind: 'message' }));
    expect(sender.errors('messages:error')).toEqual([{ message: 'This message was not sent because it breaks the community guidelines.' }]);
    expect(messageCreate).not.toHaveBeenCalled();
    expect(roomEmissions).toEqual([]);
  });

  it('refuses an empty or over-long message with the reason, and never asks the moderator about it', async () => {
    const sender = connect(account('wordy'));

    await sender.fire('messages:send', { receiverId: 'bea', content: '   ' });
    await sender.fire('messages:send', { receiverId: 'bea', content: 'x'.repeat(4001) });

    const errors = sender.errors('messages:error') as Array<{ message: string }>;
    expect(errors).toHaveLength(2);
    expect(errors[0].message).toMatch(/required/);
    expect(errors[1].message).toMatch(/4000 characters or fewer/);
    expect(assertContentAllowed).not.toHaveBeenCalled();
    expect(messageCreate).not.toHaveBeenCalled();
  });

  it('says only "Failed to send message" when something inside breaks', async () => {
    const sender = connect(account('unlucky'));
    transaction.mockRejectedValue(new Error('connection to 10.0.3.7:5432 refused'));

    await sender.fire('messages:send', { receiverId: 'bea', content: 'hello' });

    expect(sender.errors('messages:error')).toEqual([{ message: 'Failed to send message' }]);
  });
});

// ------------------------------------------------------------------ live streams

describe('live chat and the live room', () => {
  it('posts through the shared door, with the text tidied, for a viewer in good standing', async () => {
    const viewer = account('viewer');
    const socket = connect(viewer);

    await socket.fire('live:chat', { streamId: 'stream-1', content: '  so good!  ' });

    expect(postChatMessage).toHaveBeenCalledWith('stream-1', viewer, 'so good!');
    expect(socket.errors('live:error')).toEqual([]);
  });

  it(`holds one account to ${SOCIAL_LIMITS.liveChat.max} chat messages a minute across every stream`, async () => {
    const socket = connect(account('spammer'));

    for (let i = 0; i < SOCIAL_LIMITS.liveChat.max; i += 1) {
      // Alternating rooms: opening a second stream does not buy a second budget.
      await socket.fire('live:chat', { streamId: i % 2 ? 'stream-1' : 'stream-2', content: `spam ${i}` });
    }
    await socket.fire('live:chat', { streamId: 'stream-1', content: 'and again' });

    expect(postChatMessage).toHaveBeenCalledTimes(SOCIAL_LIMITS.liveChat.max);
    expect(socket.errors('live:error')).toEqual([
      { streamId: 'stream-1', message: 'You are sending messages very quickly. Take a short break and try again.' },
    ]);
  });

  it('passes a refusal from the chat door back to the sender', async () => {
    const socket = connect(account('removed'));
    postChatMessage.mockRejectedValue(new ApiError(403, 'You cannot take part in this stream.'));

    await socket.fire('live:chat', { streamId: 'stream-1', content: 'let me back in' });

    expect(socket.errors('live:error')).toEqual([{ streamId: 'stream-1', message: 'You cannot take part in this stream.' }]);
  });

  it('keeps someone on either side of a block out of the host’s room, not just her chat', async () => {
    const him = account('ex');
    const socket = connect(him);
    liveStreamFindUnique.mockResolvedValue({ id: 'stream-1', status: 'LIVE', hostId: 'host' });
    isBlockedRelationship.mockResolvedValue(true);

    await socket.fire('live:join', 'stream-1');

    expect(isBlockedRelationship).toHaveBeenCalledWith(him, 'host');
    expect(socket.rooms.has('live:stream-1')).toBe(false);
    expect(socket.errors('live:error')).toEqual([{ streamId: 'stream-1', message: 'You cannot take part in this stream.' }]);
  });

  it('lets a viewer into a stream that is live, and not into one that is not', async () => {
    const socket = connect(account('fan'));
    liveStreamFindUnique.mockResolvedValue({ id: 'stream-1', status: 'LIVE', hostId: 'host' });
    await socket.fire('live:join', 'stream-1');
    expect(socket.rooms.has('live:stream-1')).toBe(true);

    liveStreamFindUnique.mockResolvedValue({ id: 'stream-2', status: 'SCHEDULED', hostId: 'host' });
    await socket.fire('live:join', 'stream-2');
    expect(socket.rooms.has('live:stream-2')).toBe(false);
    expect(socket.errors('live:error')).toEqual([{ streamId: 'stream-2', message: 'This stream is not live' }]);
  });
});
