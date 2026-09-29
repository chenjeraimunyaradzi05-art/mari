/**
 * The socket client is the only thing that hears the server say "something
 * changed". Live notifications used to be written into a store nothing read,
 * and nothing listened for the direct-message count events at all, so the bell
 * and the Messages badge moved only on their 30-second polls. These pin the
 * routing from each server event to the listeners that refresh those caches,
 * the catch-up after a dropout, and the presence seed on connect.
 */

type Handler = (...args: unknown[]) => void;

class FakeSocket {
  connected = false;
  handlers = new Map<string, Handler[]>();
  emitted: Array<{ event: string; args: unknown[] }> = [];

  on(event: string, handler: Handler) {
    const list = this.handlers.get(event) ?? [];
    list.push(handler);
    this.handlers.set(event, list);
    return this;
  }

  emit(event: string, ...args: unknown[]) {
    this.emitted.push({ event, args });
    return this;
  }

  removeAllListeners() {
    this.handlers.clear();
    return this;
  }

  disconnect() {
    this.connected = false;
    return this;
  }

  connect() {
    this.connected = true;
    return this;
  }

  /** What the server sending `event` looks like to the client. */
  fire(event: string, ...args: unknown[]) {
    for (const handler of this.handlers.get(event) ?? []) handler(...args);
  }
}

let currentSocket: FakeSocket;
jest.mock('socket.io-client', () => ({
  io: jest.fn(() => {
    currentSocket = new FakeSocket();
    return currentSocket;
  }),
}));

const presence = jest.fn();
jest.mock('../api', () => ({
  API_ORIGIN: 'http://api.test',
  messageApi: { presence: (...args: unknown[]) => presence(...args) },
}));

jest.mock('../auth', () => ({ getAccessToken: () => 'token-1' }));

import { socketClient } from '../socket';
import { usePresenceStore } from '../stores/presence.store';

/** Lets the presence request (a resolved promise) settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('socketClient', () => {
  let onNotification: jest.Mock;
  let onUnread: jest.Mock;
  let stop: Array<() => void>;

  beforeEach(() => {
    presence.mockReset();
    presence.mockResolvedValue({ data: { data: { online: [] } } });
    usePresenceStore.setState({ onlineUsers: new Map() });
    socketClient.disconnect();
    socketClient.connect('token-1', 'me');
    onNotification = jest.fn();
    onUnread = jest.fn();
    stop = [socketClient.onNotification(onNotification), socketClient.onUnreadChange(onUnread)];
  });

  afterEach(() => {
    for (const unsubscribe of stop) unsubscribe();
    socketClient.disconnect();
  });

  it('tells the notification listeners when a notification arrives or is read', () => {
    currentSocket.fire('notifications:new', { id: 'n-1' });
    currentSocket.fire('notifications:updated', { id: 'n-1', isRead: true });
    currentSocket.fire('notifications:all_read');

    expect(onNotification).toHaveBeenCalledTimes(3);
    expect(onUnread).not.toHaveBeenCalled();
  });

  it('tells the unread listeners when a message lands or her counts are recomputed', () => {
    currentSocket.fire('messages:new_count', { conversationId: 'c-1' });
    currentSocket.fire('messages:unread_count_updated', { total: 3 });

    expect(onUnread).toHaveBeenCalledTimes(2);
    expect(onNotification).not.toHaveBeenCalled();
  });

  it('a listener that throws does not stop the others being told', () => {
    const second = jest.fn();
    stop.push(
      socketClient.onNotification(() => {
        throw new Error('render failed');
      })
    );
    stop.push(socketClient.onNotification(second));

    currentSocket.fire('notifications:new', { id: 'n-2' });

    expect(onNotification).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('an unsubscribed listener is not told again', () => {
    stop[0]();
    currentSocket.fire('notifications:new', { id: 'n-3' });
    expect(onNotification).not.toHaveBeenCalled();
  });

  it('asks the bell and the badge to catch up after a reconnect, not on the first connection', async () => {
    currentSocket.fire('connect');
    await settle();
    expect(onNotification).not.toHaveBeenCalled();
    expect(onUnread).not.toHaveBeenCalled();

    currentSocket.fire('disconnect');
    currentSocket.fire('connect');
    await settle();
    expect(onNotification).toHaveBeenCalledTimes(1);
    expect(onUnread).toHaveBeenCalledTimes(1);
  });

  it('seeds who is already online on connect, and marks offline anyone the answer leaves out', async () => {
    usePresenceStore.getState().setUserPresence('gone', { userId: 'gone', status: 'online' });
    presence.mockResolvedValue({ data: { data: { online: ['amara', 'jo'] } } });

    currentSocket.fire('connect');
    await settle();

    const store = usePresenceStore.getState();
    expect(store.isOnline('amara')).toBe(true);
    expect(store.isOnline('jo')).toBe(true);
    expect(store.isOnline('gone')).toBe(false);
    expect(currentSocket.emitted.map((e) => e.event)).toContain('presence:online');
  });

  it('a failed presence lookup leaves the store as it was rather than marking everyone offline', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    usePresenceStore.getState().setUserPresence('amara', { userId: 'amara', status: 'online' });
    presence.mockRejectedValue(new Error('network down'));

    currentSocket.fire('connect');
    await settle();

    expect(usePresenceStore.getState().isOnline('amara')).toBe(true);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('drops a presence answer that belongs to a connection that has since been replaced', async () => {
    let answer: (value: unknown) => void = () => undefined;
    presence.mockReturnValue(new Promise((resolve) => (answer = resolve)));

    currentSocket.fire('connect');
    // She signs in again (a new token) while the lookup is out.
    socketClient.connect('token-2', 'me');
    answer({ data: { data: { online: ['stale'] } } });
    await settle();

    expect(usePresenceStore.getState().isOnline('stale')).toBe(false);
  });
});
