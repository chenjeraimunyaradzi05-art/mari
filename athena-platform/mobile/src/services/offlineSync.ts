import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const QUEUE_KEY = 'athena:offline-queue';

type OfflineAction = {
  id: string;
  createdAt: string;
  type: string;
  payload: any;
};

export async function queueOfflineAction(action: OfflineAction) {
  const existing = await AsyncStorage.getItem(QUEUE_KEY);
  const queue = existing ? (JSON.parse(existing) as OfflineAction[]) : [];
  queue.push(action);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function flushOfflineQueue(handler: (action: OfflineAction) => Promise<void>) {
  const existing = await AsyncStorage.getItem(QUEUE_KEY);
  const queue = existing ? (JSON.parse(existing) as OfflineAction[]) : [];
  if (queue.length === 0) return;

  const remaining: OfflineAction[] = [];
  for (const action of queue) {
    try {
      await handler(action);
    } catch {
      remaining.push(action);
    }
  }

  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
}

export function startOfflineSync(handler: (action: OfflineAction) => Promise<void>) {
  return NetInfo.addEventListener((state) => {
    if (state.isConnected) {
      flushOfflineQueue(handler);
    }
  });
}
