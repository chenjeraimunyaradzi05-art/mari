/**
 * The offline queue's two ways of never ending.
 *
 * flushOfflineQueue kept anything that threw and counted nothing, and the
 * queue had no ceiling. Its only producer queued a POST to a path the server
 * has never served, so every message a member wrote offline 404ed on every
 * reconnection and was put straight back — forever, on a queue that only ever
 * grew. These assert that a failing action is eventually let go of, that a
 * refusal is let go of immediately, and that the queue has a size.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (key: string) => store.get(key) ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        store.set(key, value);
      }),
      removeItem: jest.fn(async (key: string) => {
        store.delete(key);
      }),
      clear: jest.fn(async () => store.clear()),
    },
  };
});

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { addEventListener: jest.fn(() => () => undefined) },
  addEventListener: jest.fn(() => () => undefined),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  MAX_QUEUED_ACTIONS,
  MAX_REPLAY_ATTEMPTS,
  UnreplayableAction,
  flushOfflineQueue,
  pendingOfflineActions,
  queueOfflineAction,
} from '../offlineSync';

const action = (id: string) => ({
  id,
  createdAt: new Date().toISOString(),
  type: 'api',
  payload: { method: 'post', url: '/messages/conversations/c1/messages', data: { content: id } },
});

describe('the offline action queue', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it('gives up on an action that keeps failing instead of replaying it forever', async () => {
    await queueOfflineAction(action('first'));
    const alwaysFails = async () => {
      throw new Error('network unreachable');
    };

    for (let round = 1; round < MAX_REPLAY_ATTEMPTS; round += 1) {
      await flushOfflineQueue(alwaysFails);
      expect(await pendingOfflineActions()).toHaveLength(1);
    }

    await flushOfflineQueue(alwaysFails);
    expect(await pendingOfflineActions()).toEqual([]);
  });

  it('drops an action the server refused on the first replay', async () => {
    await queueOfflineAction(action('refused'));

    await flushOfflineQueue(async () => {
      throw new UnreplayableAction('POST /messages/conversations/c1/messages answered 403');
    });

    expect(await pendingOfflineActions()).toEqual([]);
  });

  it('keeps the attempt count across flushes rather than restarting it', async () => {
    await queueOfflineAction(action('counted'));
    const alwaysFails = async () => {
      throw new Error('network unreachable');
    };

    await flushOfflineQueue(alwaysFails);
    await flushOfflineQueue(alwaysFails);

    const [pending] = await pendingOfflineActions();
    expect(pending.attempts).toBe(2);
  });

  it('clears an action that finally goes through', async () => {
    await queueOfflineAction(action('eventually'));
    const replayed: string[] = [];

    await flushOfflineQueue(async (queued) => {
      replayed.push(queued.payload.url);
    });

    expect(replayed).toEqual(['/messages/conversations/c1/messages']);
    expect(await pendingOfflineActions()).toEqual([]);
  });

  it('caps the queue, dropping the oldest rather than growing without bound', async () => {
    for (let i = 0; i < MAX_QUEUED_ACTIONS + 5; i += 1) {
      await queueOfflineAction(action(`action-${i}`));
    }

    const pending = await pendingOfflineActions();
    expect(pending).toHaveLength(MAX_QUEUED_ACTIONS);
    expect(pending[0].id).toBe('action-5');
    expect(pending[pending.length - 1].id).toBe(`action-${MAX_QUEUED_ACTIONS + 4}`);
  });

  it('starts again rather than throwing when the stored queue is unreadable', async () => {
    await AsyncStorage.setItem('athena:offline-queue', 'not json at all');

    expect(await pendingOfflineActions()).toEqual([]);
    await expect(flushOfflineQueue(async () => undefined)).resolves.toBeUndefined();
  });
});
