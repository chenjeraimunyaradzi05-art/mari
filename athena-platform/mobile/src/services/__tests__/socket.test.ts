/**
 * The real-time client ran for the first time in this release, so every
 * assumption it makes about the server is asserted here: the address it dials,
 * the token it dials with, and the exact event names on both sides.
 *
 * All of them were wrong before. It read a SecureStore key nothing writes, it
 * dialled the API prefix instead of the origin Socket.IO listens on, and it
 * spoke names the server has never emitted or listened for. None of it showed
 * up as a failure, because `connect()` had no caller: the whole client was
 * dead code, and dead code cannot be wrong out loud.
 *
 * The names below are the ones in server/src/services/socket.service.ts.
 */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { apiUrl: 'https://api.athena.com/api' } } },
}));

interface FakeSocket {
  on: jest.Mock;
  emit: jest.Mock;
  disconnect: jest.Mock;
  removeAllListeners: jest.Mock;
  connected: boolean;
  id: string;
}

// Built inside the factory, which runs when socket.ts first requires
// socket.io-client — before anything at this file's top level has been
// evaluated — and handed back out here.
let mockSocket!: FakeSocket;

jest.mock('socket.io-client', () => {
  const socket: FakeSocket = {
    on: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
    removeAllListeners: jest.fn(),
    connected: true,
    id: 'socket-1',
  };
  mockSocket = socket;
  return { io: jest.fn(() => socket) };
});

import { io } from 'socket.io-client';
import { socketService } from '../socket';
import { setAuthTokens } from '../api';

const mockIo = io as unknown as jest.Mock;

/** Replays a server event onto the handler the service registered for it. */
function serverEmits(event: string, payload: unknown) {
  const registration = mockSocket.on.mock.calls.find((call) => call[0] === event);
  expect(registration).toBeDefined();
  (registration![1] as (data: unknown) => void)(payload);
}

describe('the phone’s real-time connection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setAuthTokens('access-token-1', null);
  });

  afterEach(() => {
    socketService.disconnect();
    setAuthTokens(null, null);
  });

  it('dials the server origin, not the API prefix', () => {
    socketService.connect();
    expect(mockIo).toHaveBeenCalledTimes(1);
    expect(mockIo.mock.calls[0][0]).toBe('https://api.athena.com');
  });

  it('hands over the token in force at the moment it connects, not a copy', () => {
    socketService.connect();
    const auth = (mockIo.mock.calls[0][1] as { auth: (cb: (payload: { token: string }) => void) => void }).auth;

    const first = jest.fn();
    auth(first);
    expect(first).toHaveBeenCalledWith({ token: 'access-token-1' });

    // The API layer rotates the access token on a 401; a reconnection has to
    // carry the new one or the server's socket middleware refuses it.
    setAuthTokens('access-token-2', null);
    const second = jest.fn();
    auth(second);
    expect(second).toHaveBeenCalledWith({ token: 'access-token-2' });
  });

  it('does not connect when nobody is signed in', () => {
    setAuthTokens(null, null);
    socketService.connect();
    expect(mockIo).not.toHaveBeenCalled();
  });

  it('opens one connection however many times it is asked', () => {
    socketService.connect();
    socketService.connect();
    expect(mockIo).toHaveBeenCalledTimes(1);
  });

  it('delivers the events the server actually emits', () => {
    socketService.connect();

    const heard: unknown[] = [];
    const unsubscribe = socketService.on('notifications:new', (payload) => heard.push(payload));

    serverEmits('notifications:new', { id: 'n1' });
    expect(heard).toEqual([{ id: 'n1' }]);

    unsubscribe();
    serverEmits('notifications:new', { id: 'n2' });
    expect(heard).toEqual([{ id: 'n1' }]);
  });

  it('subscribes to the notification room once connected', () => {
    socketService.connect();
    serverEmits('connect', undefined);
    expect(mockSocket.emit).toHaveBeenCalledWith('notifications:subscribe');
  });

  it('gives up rather than reconnecting when the session is revoked', () => {
    socketService.connect();
    serverEmits('session:revoked', { reason: 'PASSWORD_CHANGED' });
    expect(mockSocket.disconnect).toHaveBeenCalled();
    expect(socketService.isConnected()).toBe(false);
  });

  it('speaks the message events the server listens for', () => {
    socketService.connect();

    socketService.sendMessage('user-2', 'hello');
    expect(mockSocket.emit).toHaveBeenCalledWith('messages:send', { receiverId: 'user-2', content: 'hello' });

    // The read receipt is keyed on the other member, and it is
    // 'messages:mark_read'; 'messages:read' is what the server sends back.
    socketService.markMessagesRead('user-2');
    expect(mockSocket.emit).toHaveBeenCalledWith('messages:mark_read', 'user-2');

    socketService.joinConversation('user-2');
    expect(mockSocket.emit).toHaveBeenCalledWith('messages:join_conversation', 'user-2');

    // Typing is two events, not one event carrying a flag.
    socketService.startTyping('user-2', 'conversation-1');
    expect(mockSocket.emit).toHaveBeenCalledWith('messages:typing', { receiverId: 'user-2', conversationId: 'conversation-1' });
    socketService.stopTyping('user-2', 'conversation-1');
    expect(mockSocket.emit).toHaveBeenCalledWith('messages:stop_typing', { receiverId: 'user-2', conversationId: 'conversation-1' });
  });

  it('closes the connection on sign-out', () => {
    socketService.connect();
    socketService.disconnect();
    expect(mockSocket.disconnect).toHaveBeenCalled();
    expect(socketService.isConnected()).toBe(false);

    // And emits after that go nowhere rather than onto a stranger's socket.
    mockSocket.emit.mockClear();
    socketService.sendMessage('user-2', 'hello');
    expect(mockSocket.emit).not.toHaveBeenCalled();
  });
});
