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
const messageCount = jest.fn() as Query;
const conversationUpdate = jest.fn() as Query;
const conversationFindMany = jest.fn() as Query;
const conversationFindUnique = jest.fn() as Query;
const conversationCreate = jest.fn() as Query;
const followFindUnique = jest.fn() as Query;
const participantUpdateMany = jest.fn() as Query;
const userFindUnique = jest.fn() as Query;
const notificationCreate = jest.fn() as Query;
const liveStreamFindUnique = jest.fn() as Query;
const messageFindMany = jest.fn() as Query;
const messageUpdateMany = jest.fn() as Query;
const safetySettingsFindUnique = jest.fn() as Query;
// The DV safety page's own block list, the second place a block can be written.
const dvBlockFindFirst = jest.fn() as Query;
const transaction = jest.fn() as jest.Mock<(ops: Array<Promise<unknown>>) => Promise<unknown[]>>;

jest.mock('../../utils/prisma', () => ({
  prisma: {
    message: { create: messageCreate, findMany: messageFindMany, updateMany: messageUpdateMany, count: messageCount },
    conversation: {
      update: conversationUpdate,
      findMany: conversationFindMany,
      findUnique: conversationFindUnique,
      create: conversationCreate,
    },
    follow: { findUnique: followFindUnique },
    conversationParticipant: { updateMany: participantUpdateMany },
    user: { findUnique: userFindUnique },
    notification: { create: notificationCreate },
    liveStream: { findUnique: liveStreamFindUnique },
    userSafetySettings: { findUnique: safetySettingsFindUnique },
    // The DV safety page's own block list, the second place a block can be written: nobody is blocked there unless a test says so.
    dvSafetyProfile: { findFirst: dvBlockFindFirst, findUnique: jest.fn(async () => null), findMany: jest.fn(async () => []) },
    $transaction: transaction,
  },
}));

const authenticateSocketToken = jest.fn() as Query;
jest.mock('../../middleware/auth', () => ({ authenticateSocketToken }));

const isBlockedRelationship = jest.fn() as jest.Mock<(a: string, b: string) => Promise<boolean>>;
jest.mock('../../utils/safety-store', () => ({ isBlockedRelationship }));

// A broadcast a member makes is kept from everyone on either side of a block with her;
// the lists are read from both stores by audience.service, which has its own suites.
const blockedEitherWayIds = jest.fn() as jest.Mock<(userId: string) => Promise<string[]>>;
jest.mock('../audience.service', () => ({
  ...(jest.requireActual('../audience.service') as object),
  blockedEitherWayIds: (userId: string) => blockedEitherWayIds(userId),
}));

const canOpenConversation = jest.fn() as jest.Mock<(a: string, b: string) => Promise<{ allowed: boolean; reason?: string }>>;
jest.mock('../message-permissions.service', () => ({ canOpenConversation }));

const assertContentAllowed = jest.fn() as jest.Mock<(content: string, ctx: unknown) => Promise<void>>;
jest.mock('../moderation.service', () => ({ assertContentAllowed }));

const pushToUser = jest.fn();
jest.mock('../push.service', () => ({ pushToUser, pushPreview: (text: string) => text }));

// The real direct-message service, so messages:send is held to the rules the REST
// route is: the request cap, a declined request, quiet delivery. Only the lookup
// the read-receipt handler uses is replaced; sendDirectMessage reaches its own
// copy of it, which reads the mocked database below. The service used to be
// mocked whole here, which is why the socket door skipping those rules went
// unseen.
const findDirectConversation = jest.fn() as jest.Mock<(a: string, b: string) => Promise<string | null>>;
jest.mock('../direct-message.service', () => ({
  ...(jest.requireActual('../direct-message.service') as object),
  findDirectConversation: (a: string, b: string) => findDirectConversation(a, b),
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

const announcePresence = jest.fn() as jest.Mock<(userId: string, state: 'online' | 'offline') => Promise<number>>;
jest.mock('../presence.service', () => ({ announcePresence }));

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
type Emission = { rooms: string[]; except: string[]; event: string; payload: unknown };

/** Everything the server emitted through io.to(...), with the rooms it chose. */
const roomEmissions: Emission[] = [];
let connectionHandler: ((socket: FakeSocket) => void) | undefined;
let authMiddleware: ((socket: any, next: (err?: Error) => void) => unknown) | undefined;

const chain = (rooms: string[], except: string[] = []): {
  to: (room: string) => unknown;
  except: (excluded: string | string[]) => unknown;
  emit: (event: string, payload?: unknown) => boolean;
} => ({
  to: (room: string) => chain([...rooms, room], except),
  except: (excluded: string | string[]) => chain(rooms, [...except, ...(Array.isArray(excluded) ? excluded : [excluded])]),
  emit: (event: string, payload?: unknown) => {
    roomEmissions.push({ rooms, except, event, payload });
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

/**
 * The thread the next send finds. `existing` says whether it was there already
 * or is opened by this very message; the request fields are the thread's own.
 */
let threadMembers: string[] = [];
let threadFields: Record<string, unknown> = {};
function givenThread(
  sender: string,
  receiver: string,
  { existing = true, ...fields }: { existing?: boolean } & Record<string, unknown> = {}
) {
  threadMembers = [sender, receiver];
  threadFields = fields;
  conversationFindMany.mockResolvedValue(
    existing ? [{ id: 'conv-1', participants: [{ userId: sender }, { userId: receiver }] }] : []
  );
}

/** An adult member in good standing, as the gate and the notification read her. */
const memberRow = (overrides: Record<string, unknown> = {}) => ({
  allowMessages: true,
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
  dvBlockFindFirst.mockResolvedValue(null);
  blockedEitherWayIds.mockResolvedValue([]);
  canOpenConversation.mockResolvedValue({ allowed: true });
  assertContentAllowed.mockResolvedValue(undefined);
  messageCreate.mockImplementation(async (args: any) => ({
    id: `m-${messageCreate.mock.calls.length}`,
    ...args.data,
    sender: { id: args.data.senderId, firstName: 'Amira', lastName: 'K', avatar: null },
  }));
  conversationUpdate.mockResolvedValue({});
  conversationCreate.mockResolvedValue({ id: 'conv-1' });
  conversationFindMany.mockResolvedValue([]);
  conversationFindUnique.mockImplementation(async () => ({
    id: 'conv-1',
    requestedById: null,
    requestAcceptedAt: null,
    requestDeclinedAt: null,
    disappearingTtlSeconds: null,
    participants: threadMembers.map((userId) => ({ userId, isMuted: false })),
    ...threadFields,
  }));
  followFindUnique.mockResolvedValue({ followerId: 'bea' });
  messageCount.mockResolvedValue(0);
  threadMembers = [];
  threadFields = {};
  participantUpdateMany.mockResolvedValue({ count: 1 });
  transaction.mockImplementation(async (ops) => Promise.all(ops));
  notificationCreate.mockImplementation(async (args: any) => ({ id: 'n-1', ...args.data }));
  postChatMessage.mockResolvedValue({ id: 'chat-1' });
  findDirectConversation.mockResolvedValue(null);
  announcePresence.mockResolvedValue(0);
  messageFindMany.mockResolvedValue([]);
  messageUpdateMany.mockResolvedValue({ count: 0 });
  safetySettingsFindUnique.mockResolvedValue(null);
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
    givenThread(amira, 'bea', { existing: false });

    await sender.fire('messages:send', { receiverId: 'bea', content: '  Are you coming on Thursday?  ' });

    expect(messageCreate).toHaveBeenCalledTimes(1);
    expect(messageCreate.mock.calls[0][0].data).toMatchObject({
      conversationId: 'conv-1',
      senderId: amira,
      receiverId: 'bea',
      content: 'Are you coming on Thursday?',
      type: 'TEXT',
    });

    // Once to her, by the one delivery the REST route uses, and once to the
    // sender's own devices, which is how a socket client sees its own line.
    const delivered = roomEmissions.filter((e) => e.event === 'messages:new');
    expect(delivered.map((e) => e.rooms)).toEqual([['user:bea'], [`user:${amira}`]]);
    expect(roomEmissions.filter((e) => e.event === 'messages:new_count').map((e) => e.rooms)).toEqual([['user:bea']]);

    // No bell entry per message, as the REST route has always had none.
    expect(notificationCreate).not.toHaveBeenCalled();
    // Nobody for Bea is connected, so her phone hears about it instead.
    expect(pushToUser).toHaveBeenCalledWith('bea', 'MESSAGE', expect.objectContaining({ link: `/dashboard/messages?user=${amira}` }));
    expect(sender.errors('messages:error')).toEqual([]);
  });

  it(`holds one account to ${SOCIAL_LIMITS.message.max} messages in the window, as the REST route does`, async () => {
    const flooder = account('flooder');
    const sender = connect(flooder);
    givenThread(flooder, 'bea');

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

  it('refuses a thread across a block written only to the DV safety page, as it refuses one on the platform list', async () => {
    const him = account('blocked-dv');
    const sender = connect(him);
    dvBlockFindFirst.mockResolvedValue({ userId: 'her' });

    await sender.fire('messages:send', { receiverId: 'her', content: 'why did you block me' });

    expect(sender.errors('messages:error')).toEqual([{ message: 'You cannot message this user' }]);
    expect(canOpenConversation).not.toHaveBeenCalled();
    expect(messageCreate).not.toHaveBeenCalled();
    expect(roomEmissions).toEqual([]);
    expect(pushToUser).not.toHaveBeenCalled();
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

  it('refuses a message to a member who has closed her messages, in a thread that exists or a new one, and stores nothing', async () => {
    // "Close my messages" (User.allowMessages) is checked on the socket door as
    // on the REST one: any client can emit the event, so this is the door that
    // matters if the check is only on the other.
    const sender = connect(account('persistent'));
    userFindUnique.mockImplementation(async (args: any) =>
      args?.where?.id === 'bea' ? memberRow({ allowMessages: false }) : memberRow()
    );

    givenThread('persistent', 'bea', { existing: true });
    await sender.fire('messages:send', { receiverId: 'bea', content: 'are you there?' });
    givenThread('persistent', 'bea', { existing: false });
    await sender.fire('messages:send', { receiverId: 'bea', content: 'please answer' });

    expect(sender.errors('messages:error')).toEqual([
      { message: 'This user is not accepting messages' },
      { message: 'This user is not accepting messages' },
    ]);
    expect(messageCreate).not.toHaveBeenCalled();
    expect(roomEmissions.filter((e) => e.event === 'messages:new')).toEqual([]);
    expect(pushToUser).not.toHaveBeenCalled();
  });

  it('screens the text the same way the REST route does, and stores nothing it refuses', async () => {
    const sender = connect(account('abusive'));
    assertContentAllowed.mockRejectedValue(new ApiError(422, 'This message was not sent because it breaks the community guidelines.'));

    await sender.fire('messages:send', { receiverId: 'bea', content: 'something vile' });

    expect(assertContentAllowed).toHaveBeenCalledWith('something vile', expect.objectContaining({ kind: 'message' }));
    expect(sender.errors('messages:error')).toEqual([{ message: 'This message was not sent because it breaks the community guidelines.' }]);
    expect(messageCreate).not.toHaveBeenCalled();
    // A first message the gate refuses must not leave an empty request waiting in her inbox.
    expect(conversationCreate).not.toHaveBeenCalled();
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
    const unlucky = account('unlucky');
    const sender = connect(unlucky);
    givenThread(unlucky, 'bea');
    transaction.mockRejectedValue(new Error('connection to 10.0.3.7:5432 refused'));

    await sender.fire('messages:send', { receiverId: 'bea', content: 'hello' });

    expect(sender.errors('messages:error')).toEqual([{ message: 'Failed to send message' }]);
  });
});

// ------------------------------------------------------------------ message requests

// The socket was a second door that skipped the request rules. It called
// getOrCreateDirectConversation, which hands back an existing thread without
// looking at it, and never assertCanSendInConversation, so an opener could send
// without limit, a declined sender could keep writing to the woman who had said
// no, a reply never accepted a request, and every line buzzed her phone. Any
// client can emit this event, so none of those was a rule at all.
describe('messages:send and message requests', () => {
  it('lets the opener introduce herself, and the first line knocks once, saying it is a request', async () => {
    const opener = account('opener');
    const socket = connect(opener);
    givenThread(opener, 'bea', { existing: false, requestedById: opener });
    followFindUnique.mockResolvedValue(null); // Bea does not follow her, so it is a request

    await socket.fire('messages:send', { receiverId: 'bea', content: 'Hi Bea, I am a friend of Ana' });

    expect(conversationCreate.mock.calls[0][0].data.requestedById).toBe(opener);
    expect(messageCreate).toHaveBeenCalledTimes(1);
    expect(pushToUser).toHaveBeenCalledWith('bea', 'MESSAGE', expect.objectContaining({
      title: expect.stringContaining('wants to message you'),
      link: '/dashboard/messages?tab=requests',
    }));
    expect(socket.errors('messages:error')).toEqual([]);
  });

  it('refuses the opener a fourth message before an answer, writes nothing and says why', async () => {
    const opener = account('eager');
    const socket = connect(opener);
    givenThread(opener, 'bea', { requestedById: opener });
    messageCount.mockResolvedValue(3);

    await socket.fire('messages:send', { receiverId: 'bea', content: 'Did you see my message?' });

    expect(socket.errors('messages:error')).toEqual([
      { message: 'Wait for them to accept your message request before sending more' },
    ]);
    expect(messageCreate).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
    expect(roomEmissions).toEqual([]);
    expect(pushToUser).not.toHaveBeenCalled();
    expect(notificationCreate).not.toHaveBeenCalled();
  });

  it('keeps a declined request closed to the one who asked, however many times she tries', async () => {
    const declined = account('declined');
    const socket = connect(declined);
    givenThread(declined, 'bea', { requestedById: declined, requestDeclinedAt: new Date() });

    await socket.fire('messages:send', { receiverId: 'bea', content: 'Please, just one thing' });
    await socket.fire('messages:send', { receiverId: 'bea', content: 'Please?' });

    expect(socket.errors('messages:error')).toEqual([
      { message: 'They declined your message request' },
      { message: 'They declined your message request' },
    ]);
    expect(messageCreate).not.toHaveBeenCalled();
    expect(roomEmissions).toEqual([]);
    expect(pushToUser).not.toHaveBeenCalled();
  });

  it('delivers a later request line without a push, a badge or a notification', async () => {
    const opener = account('second');
    const socket = connect(opener);
    givenThread(opener, 'bea', { requestedById: opener });
    messageCount.mockResolvedValue(1); // one already sent, still under the cap

    await socket.fire('messages:send', { receiverId: 'bea', content: 'Just one more thing' });

    expect(messageCreate).toHaveBeenCalledTimes(1);
    // It reaches her thread, and nothing buzzes or lights up for it.
    expect(roomEmissions.filter((e) => e.event === 'messages:new').map((e) => e.rooms)).toEqual([['user:bea'], [`user:${opener}`]]);
    expect(roomEmissions.some((e) => e.event === 'messages:new_count')).toBe(false);
    expect(pushToUser).not.toHaveBeenCalled();
    expect(notificationCreate).not.toHaveBeenCalled();
  });

  it('treats the asked person replying as accepting, as the REST route does', async () => {
    const bea = account('bea');
    const socket = connect(bea);
    givenThread(bea, 'opener-1', { requestedById: 'opener-1' });

    await socket.fire('messages:send', { receiverId: 'opener-1', content: 'Hi, yes, happy to chat' });

    const update = conversationUpdate.mock.calls[0][0].data;
    expect(update.requestAcceptedAt).toBeInstanceOf(Date);
    expect(update.requestDeclinedAt).toBeNull();
    expect(socket.errors('messages:error')).toEqual([]);
  });

  it('stays quiet for a muted thread too', async () => {
    const sender = account('friend');
    const socket = connect(sender);
    givenThread(sender, 'bea');
    conversationFindUnique.mockImplementation(async () => ({
      id: 'conv-1',
      requestedById: null,
      requestAcceptedAt: null,
      requestDeclinedAt: null,
      disappearingTtlSeconds: null,
      participants: [{ userId: sender, isMuted: false }, { userId: 'bea', isMuted: true }],
    }));

    await socket.fire('messages:send', { receiverId: 'bea', content: 'No rush' });

    expect(messageCreate).toHaveBeenCalledTimes(1);
    expect(pushToUser).not.toHaveBeenCalled();
    expect(roomEmissions.some((e) => e.event === 'messages:new_count')).toBe(false);
  });

  it('refuses a send to a thread the sender is not part of', async () => {
    const stranger = account('stranger');
    const socket = connect(stranger);
    // The lookup finds a thread, but it is between two other people.
    conversationFindMany.mockResolvedValue([{ id: 'conv-1', participants: [{ userId: stranger }, { userId: 'bea' }] }]);
    threadMembers = ['someone', 'bea'];

    await socket.fire('messages:send', { receiverId: 'bea', content: 'hello' });

    expect(socket.errors('messages:error')).toEqual([{ message: 'Not a participant' }]);
    expect(messageCreate).not.toHaveBeenCalled();
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

  it('tells a muted viewer why her line did not go, and a viewer in slow mode how long to wait', async () => {
    const socket = connect(account('muted'));
    postChatMessage.mockRejectedValueOnce(
      new ApiError(403, 'The host has muted you in this chat for about 5 more minutes. You can keep watching.')
    );
    await socket.fire('live:chat', { streamId: 'stream-1', content: 'hello?' });

    postChatMessage.mockRejectedValueOnce(new ApiError(429, 'Slow mode is on. You can send another message in 12 seconds.'));
    await socket.fire('live:chat', { streamId: 'stream-1', content: 'hello??' });

    expect(socket.errors('live:error')).toEqual([
      { streamId: 'stream-1', message: 'The host has muted you in this chat for about 5 more minutes. You can keep watching.' },
      { streamId: 'stream-1', message: 'Slow mode is on. You can send another message in 12 seconds.' },
    ]);
  });

  it('says what went wrong only when it is something she can act on, and never a database error', async () => {
    const socket = connect(account('unlucky'));
    postChatMessage.mockRejectedValueOnce(new Error('Invalid `prisma.liveStreamMessage.create()` invocation: connection reset'));
    await socket.fire('live:chat', { streamId: 'stream-1', content: 'hello' });

    postChatMessage.mockRejectedValueOnce(new ApiError(500, 'Recipient not found'));
    await socket.fire('live:chat', { streamId: 'stream-1', content: 'hello again' });

    // The moderation check being down is an operational refusal she is owed the words of.
    postChatMessage.mockRejectedValueOnce(new ApiError(503, 'We cannot check messages right now. Please try again shortly.'));
    await socket.fire('live:chat', { streamId: 'stream-1', content: 'hello once more' });

    expect(socket.errors('live:error')).toEqual([
      { streamId: 'stream-1', message: 'Message not sent' },
      { streamId: 'stream-1', message: 'Message not sent' },
      { streamId: 'stream-1', message: 'We cannot check messages right now. Please try again shortly.' },
    ]);
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

// ------------------------------------------------------------------ presence

describe('presence', () => {
  it('hands "online" to the presence audience rule instead of telling every socket', async () => {
    const her = account('her');
    const socket = connect(her);

    await socket.fire('presence:online');

    expect(announcePresence).toHaveBeenCalledWith(her, 'online');
    expect(socket.broadcast.emit).not.toHaveBeenCalled();
  });

  it('announces offline once, through the same rule, only when her last socket closes', async () => {
    const her = account('her');
    const phone = connect(her);
    const laptop = connect(her);

    await phone.fire('disconnect');
    expect(announcePresence).not.toHaveBeenCalled();

    await laptop.fire('disconnect');
    expect(announcePresence).toHaveBeenCalledTimes(1);
    expect(announcePresence).toHaveBeenCalledWith(her, 'offline');
    expect(laptop.broadcast.emit).not.toHaveBeenCalled();
  });
});

// ------------------------------------------------------------------ read receipts

describe('messages:mark_read', () => {
  const readReceipts = () => roomEmissions.filter((e) => e.event === 'messages:read');

  beforeEach(() => {
    findDirectConversation.mockResolvedValue('conv-9');
    messageFindMany.mockResolvedValue([{ id: 'm-1' }, { id: 'm-2' }]);
    messageUpdateMany.mockResolvedValue({ count: 2 });
  });

  it('marks the messages read and tells the sender, when she has not hidden receipts', async () => {
    const reader = account('reader');
    const socket = connect(reader);

    await socket.fire('messages:mark_read', 'sender');

    expect(messageUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: ['m-1', 'm-2'] } } }));
    expect(readReceipts().map((e) => e.rooms)).toEqual([
      [`conversation:${[reader, 'sender'].sort().join(':')}`],
      ['user:sender'],
    ]);
    expect(readReceipts()[0].payload).toEqual({ conversationId: 'conv-9', readerId: reader, messageIds: ['m-1', 'm-2'] });
  });

  it('marks them read but tells nobody when she has hidden read receipts', async () => {
    const socket = connect(account('private'));
    safetySettingsFindUnique.mockResolvedValue({ hideReadReceipts: true });

    await socket.fire('messages:mark_read', 'sender');

    expect(messageUpdateMany).toHaveBeenCalledTimes(1);
    expect(readReceipts()).toEqual([]);
  });

  it('does not tell the person who opened a request, until it is accepted, that she read it', async () => {
    const reader = account('asked');
    const socket = connect(reader);
    // `sender` wrote first, to someone she does not follow, and nobody has said yes.
    threadFields = { requestedById: 'sender', requestAcceptedAt: null };

    await socket.fire('messages:mark_read', 'sender');

    // Read all the same, so her own badge clears; the opener is not told.
    expect(messageUpdateMany).toHaveBeenCalledTimes(1);
    expect(readReceipts()).toEqual([]);
  });

  it('does not tell the opener of a request that was declined either', async () => {
    const socket = connect(account('declined'));
    threadFields = { requestedById: 'sender', requestAcceptedAt: null, requestDeclinedAt: new Date() };

    await socket.fire('messages:mark_read', 'sender');

    expect(readReceipts()).toEqual([]);
  });

  it('tells the sender once the request is accepted, and always tells someone who was the one asked', async () => {
    const accepted = connect(account('accepted'));
    threadFields = { requestedById: 'sender', requestAcceptedAt: new Date() };
    await accepted.fire('messages:mark_read', 'sender');
    expect(readReceipts().length).toBeGreaterThan(0);

    // She opened it herself: it is the other person who is reading, and the
    // request rule is about what the opener may learn, so the sender here is not the opener.
    roomEmissions.length = 0;
    const opener = account('opener');
    const socket = connect(opener);
    threadFields = { requestedById: opener, requestAcceptedAt: null };
    await socket.fire('messages:mark_read', 'someone-she-wrote-to');
    expect(readReceipts().length).toBeGreaterThan(0);
  });

  it('withholds the receipt when her settings cannot be read', async () => {
    const socket = connect(account('unreadable'));
    safetySettingsFindUnique.mockRejectedValue(new Error('connection reset'));

    await socket.fire('messages:mark_read', 'sender');

    expect(messageUpdateMany).toHaveBeenCalledTimes(1);
    expect(readReceipts()).toEqual([]);
  });

  // The inbox list hides a thread across a block, but a client that still had
  // it open, or any client naming his id, could mark his old messages read and
  // so tell him she had been there.
  it('marks them read but tells nobody across a block, in either store', async () => {
    const reader = account('blocker');
    const socket = connect(reader);
    isBlockedRelationship.mockResolvedValue(true);

    await socket.fire('messages:mark_read', 'him');

    expect(isBlockedRelationship).toHaveBeenCalledWith(reader, 'him');
    expect(messageUpdateMany).toHaveBeenCalledTimes(1);
    expect(readReceipts()).toEqual([]);

    // A block written to the DV safety page alone, by either of them.
    isBlockedRelationship.mockResolvedValue(false);
    dvBlockFindFirst.mockResolvedValue({ userId: 'him' });
    await socket.fire('messages:mark_read', 'him');

    expect(messageUpdateMany).toHaveBeenCalledTimes(2);
    expect(readReceipts()).toEqual([]);
  });

  it('withholds the receipt when the block lists cannot be read', async () => {
    const socket = connect(account('unreadable-blocks'));
    isBlockedRelationship.mockRejectedValue(new Error('connection reset'));

    await socket.fire('messages:mark_read', 'sender');

    expect(messageUpdateMany).toHaveBeenCalledTimes(1);
    expect(readReceipts()).toEqual([]);
  });
});

// ------------------------------------------------------------------ the pair room

// The pair room carries the typing notices and the read receipts between two
// members. Anyone could join any pair's room by naming the other member, and the
// typing handlers emitted into it with no check while the channel notices had
// one: a man she had blocked could sit in their room and watch her "typing" come
// and go.
describe('the pair room across a block', () => {
  const pairRoom = (a: string, b: string) => `conversation:${[a, b].sort().join(':')}`;
  const typingNotices = () =>
    roomEmissions.filter((e) => e.event === 'messages:user_typing' || e.event === 'messages:user_stopped_typing');

  it('sends a typing notice into the pair room when there is no block, in either payload shape', async () => {
    const typist = account('typist');
    const socket = connect(typist);

    await socket.fire('messages:typing', { receiverId: 'bea', conversationId: 'conv-1' });
    await socket.fire('messages:stop_typing', 'bea');

    expect(typingNotices()).toEqual([
      { rooms: [pairRoom(typist, 'bea')], except: [], event: 'messages:user_typing', payload: { userId: typist, conversationId: 'conv-1' } },
      { rooms: [pairRoom(typist, 'bea')], except: [], event: 'messages:user_stopped_typing', payload: { userId: typist, conversationId: undefined } },
    ]);
  });

  it('sends no typing notice to someone on either side of a block with her', async () => {
    const her = account('her');
    const socket = connect(her);
    // Read in both stores and both directions by audience.service; here the list simply names him.
    blockedEitherWayIds.mockResolvedValue(['him']);

    await socket.fire('messages:typing', { receiverId: 'him', conversationId: 'conv-1' });
    await socket.fire('messages:stop_typing', { receiverId: 'him' });
    // Someone she has no block with is still told.
    await socket.fire('messages:typing', { receiverId: 'bea', conversationId: 'conv-2' });

    expect(typingNotices()).toEqual([
      { rooms: [pairRoom(her, 'bea')], except: [], event: 'messages:user_typing', payload: { userId: her, conversationId: 'conv-2' } },
    ]);
  });

  it('sends nothing, rather than everything, when the block lists cannot be read', async () => {
    const socket = connect(account('unreadable-pair'));
    blockedEitherWayIds.mockRejectedValue(new Error('connection reset'));

    await socket.fire('messages:typing', 'bea');
    await socket.fire('messages:stop_typing', 'bea');

    expect(typingNotices()).toEqual([]);
  });

  it('reads her block lists once in a while, not on every keystroke', async () => {
    const socket = connect(account('pair-keystrokes'));

    for (let i = 0; i < 5; i += 1) await socket.fire('messages:typing', 'bea');

    expect(blockedEitherWayIds).toHaveBeenCalledTimes(1);
    expect(typingNotices()).toHaveLength(5);
  });

  it('does not let a member into the room of a pair she is on either side of a block with', async () => {
    const him = account('ex');
    const socket = connect(him);
    blockedEitherWayIds.mockResolvedValue(['her']);

    await socket.fire('messages:join_conversation', 'her');
    expect(socket.rooms.has(pairRoom(him, 'her'))).toBe(false);

    // The room of a pair with no block between them is open as before.
    await socket.fire('messages:join_conversation', 'bea');
    expect(socket.rooms.has(pairRoom(him, 'bea'))).toBe(true);
  });

  it('refuses the join when the block lists cannot be read, and ignores a join that names nobody', async () => {
    const socket = connect(account('unreadable-join'));
    blockedEitherWayIds.mockRejectedValue(new Error('connection reset'));

    await socket.fire('messages:join_conversation', 'bea');
    await socket.fire('messages:join_conversation', '');
    await socket.fire('messages:join_conversation', { not: 'a string' });

    // Her own user room from the connection, and no pair room at all.
    expect([...socket.rooms].filter((room) => room.startsWith('conversation:'))).toEqual([]);
  });
});

// ------------------------------------------------------------------ channel typing

describe('channels:typing', () => {
  const typingNotices = () => roomEmissions.filter((e) => e.event === 'channels:user_typing' || e.event === 'channels:user_stopped_typing');

  it('names her to the channel, and to nobody on either side of a block with her', async () => {
    const typist = account('typist');
    const socket = connect(typist);
    // The lists are read in both stores and both directions: she blocked him, and the
    // second blocked her from the DV page alone.
    blockedEitherWayIds.mockResolvedValue(['him', 'dv-blocked-her']);

    await socket.fire('channels:typing', 'c1');
    await socket.fire('channels:stop_typing', 'c1');

    expect(typingNotices()).toEqual([
      {
        rooms: ['channel:c1'],
        except: ['user:him', 'user:dv-blocked-her'],
        event: 'channels:user_typing',
        payload: { channelId: 'c1', userId: typist },
      },
      {
        rooms: ['channel:c1'],
        except: ['user:him', 'user:dv-blocked-her'],
        event: 'channels:user_stopped_typing',
        payload: { channelId: 'c1', userId: typist },
      },
    ]);
  });

  it('is sent to the whole channel when she has no block', async () => {
    const socket = connect(account('free'));

    await socket.fire('channels:typing', 'c1');

    expect(typingNotices().map((e) => [e.rooms, e.except])).toEqual([[['channel:c1'], []]]);
  });

  it('sends nothing, rather than everything, when the block lists cannot be read', async () => {
    const socket = connect(account('unreadable-blocks'));
    blockedEitherWayIds.mockRejectedValue(new Error('connection reset'));

    await socket.fire('channels:typing', 'c1');
    await socket.fire('channels:stop_typing', 'c1');

    expect(typingNotices()).toEqual([]);
  });

  it('reads her block lists once in a while, not on every keystroke', async () => {
    const socket = connect(account('keystrokes'));
    blockedEitherWayIds.mockResolvedValue(['him']);

    for (let i = 0; i < 5; i += 1) await socket.fire('channels:typing', 'c1');

    expect(blockedEitherWayIds).toHaveBeenCalledTimes(1);
    expect(typingNotices()).toHaveLength(5);
  });

  it('ignores an event that does not name a channel', async () => {
    const socket = connect(account('nameless'));

    await socket.fire('channels:typing', '');
    await socket.fire('channels:typing', { not: 'a string' });

    expect(typingNotices()).toEqual([]);
    expect(blockedEitherWayIds).not.toHaveBeenCalled();
  });
});
