import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const QUEUE_KEY = 'athena:offline-queue';

/**
 * How many actions the queue will hold.
 *
 * There was no ceiling at all, and nothing ever left the queue except by
 * succeeding, so a phone that spent a week failing to send grew an AsyncStorage
 * entry that was read and rewritten in full on every reconnection. The oldest
 * action is the one dropped when the queue is full: a message she typed a
 * fortnight ago is not the one she is still waiting on.
 */
export const MAX_QUEUED_ACTIONS = 50;

/**
 * How many times a replay may fail before the action is given up on.
 *
 * flushOfflineQueue used to keep anything that threw, forever, with no count
 * of how many times it had already thrown. One malformed action — and there
 * was one: the chat screen queued a POST to a path the server does not serve —
 * replayed into the same failure on every single reconnection for the life of
 * the install.
 */
export const MAX_REPLAY_ATTEMPTS = 5;

export type OfflineAction = {
  id: string;
  createdAt: string;
  type: string;
  payload: any;
  /**
   * Replays that have already failed. Absent on actions queued by an older
   * build, which is read as none.
   */
  attempts?: number;
};

/**
 * Thrown by a replay handler for a failure that will never come good — a
 * request the server refused on its merits rather than one it never received.
 * Retrying a 403 or a 422 only produces another 403, so the action is dropped
 * on the spot instead of burning through MAX_REPLAY_ATTEMPTS reconnections.
 */
export class UnreplayableAction extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnreplayableAction';
  }
}

async function readQueue(): Promise<OfflineAction[]> {
  try {
    const existing = await AsyncStorage.getItem(QUEUE_KEY);
    if (!existing) return [];
    const parsed = JSON.parse(existing);
    return Array.isArray(parsed) ? (parsed as OfflineAction[]) : [];
  } catch (error) {
    // A queue that cannot be parsed is a queue that would poison every flush
    // from here on. Start again rather than throw out of a background sync.
    console.warn('[offline] The queued actions could not be read and have been discarded:', error instanceof Error ? error.message : error);
    return [];
  }
}

async function writeQueue(queue: OfflineAction[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function queueOfflineAction(action: OfflineAction) {
  const queue = await readQueue();
  queue.push(action);
  const overflow = queue.length - MAX_QUEUED_ACTIONS;
  if (overflow > 0) {
    queue.splice(0, overflow);
    console.warn(`[offline] The queue was full, so ${overflow} of the oldest pending action(s) were dropped.`);
  }
  await writeQueue(queue);
}

/** Everything still waiting to be replayed. Exported for the tests and for diagnostics. */
export async function pendingOfflineActions(): Promise<OfflineAction[]> {
  return readQueue();
}

export async function flushOfflineQueue(handler: (action: OfflineAction) => Promise<void>) {
  const queue = await readQueue();
  if (queue.length === 0) return;

  const remaining: OfflineAction[] = [];
  for (const action of queue) {
    try {
      await handler(action);
    } catch (error) {
      if (error instanceof UnreplayableAction) {
        console.warn(`[offline] Giving up on a queued ${action.type} action the server refused: ${error.message}`);
        continue;
      }
      const attempts = (action.attempts ?? 0) + 1;
      if (attempts >= MAX_REPLAY_ATTEMPTS) {
        console.warn(`[offline] Giving up on a queued ${action.type} action after ${attempts} failed replays.`);
        continue;
      }
      remaining.push({ ...action, attempts });
    }
  }

  await writeQueue(remaining);
}

export function startOfflineSync(handler: (action: OfflineAction) => Promise<void>) {
  return NetInfo.addEventListener((state) => {
    if (state.isConnected) {
      flushOfflineQueue(handler);
    }
  });
}
