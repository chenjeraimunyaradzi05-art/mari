import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

/**
 * The bell, the thread list and the Messages badge are pushed to by the
 * socket, and used to be polled every thirty seconds as well, on every page of
 * the dashboard. Two polls every thirty seconds is four calls a minute on a
 * page nobody is touching, which is most of what an idle member spent of her
 * API budget. While the socket is up they now stay quiet; the moment it drops
 * the poll comes back, because that is the case it exists for.
 */

let connected = false;
const changeListeners = new Set<() => void>();
const setConnected = (value: boolean) => {
  connected = value;
  for (const listener of [...changeListeners]) listener();
};

jest.mock('../socket', () => ({
  socketClient: {
    isConnected: () => connected,
    onChange: (listener: () => void) => {
      changeListeners.add(listener);
      return () => changeListeners.delete(listener);
    },
    onNotification: () => () => undefined,
    onUnreadChange: () => () => undefined,
  },
}));

const getConversations = jest.fn();
const getAllNotifications = jest.fn();
jest.mock('../api', () => ({
  api: {},
  messageApi: { getConversations: (...args: unknown[]) => getConversations(...args) },
  notificationApi: { getAll: (...args: unknown[]) => getAllNotifications(...args) },
}));

jest.mock('../store', () => ({
  useAuthStore: () => ({ isAuthenticated: true, isLoading: false }),
  useUIStore: jest.fn(),
  useNotificationStore: jest.fn(),
  useMessageStore: jest.fn(),
}));
jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));

import { useNotifications, useUnreadMessageCount } from '../hooks';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** Lets the first fetch settle, then lets `ms` of fake time pass. */
async function pass(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  connected = false;
  changeListeners.clear();
  getConversations.mockReset().mockResolvedValue({ data: { unreadTotal: 0 } });
  getAllNotifications.mockReset().mockResolvedValue({ data: { data: { notifications: [], unreadCount: 0 } } });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('the Messages badge', () => {
  it('is not polled while the socket is connected', async () => {
    connected = true;
    renderHook(() => useUnreadMessageCount(), { wrapper });

    await pass(5);
    expect(getConversations).toHaveBeenCalledTimes(1);

    await pass(95_000);
    expect(getConversations).toHaveBeenCalledTimes(1);
  });

  it('is polled every thirty seconds when there is no socket', async () => {
    renderHook(() => useUnreadMessageCount(), { wrapper });

    await pass(5);
    expect(getConversations).toHaveBeenCalledTimes(1);

    await pass(95_000);
    expect(getConversations.mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it('starts polling again when the socket drops, and stops when it comes back', async () => {
    connected = true;
    renderHook(() => useUnreadMessageCount(), { wrapper });
    await pass(5);
    await pass(61_000);
    expect(getConversations).toHaveBeenCalledTimes(1);

    act(() => setConnected(false));
    await pass(5);
    const afterDrop = getConversations.mock.calls.length;
    await pass(61_000);
    expect(getConversations.mock.calls.length).toBeGreaterThan(afterDrop);

    act(() => setConnected(true));
    await pass(5);
    const afterReconnect = getConversations.mock.calls.length;
    await pass(95_000);
    expect(getConversations.mock.calls.length).toBe(afterReconnect);
  });
});

describe('the bell', () => {
  it('is quiet while the socket is up and polled when it is not', async () => {
    connected = true;
    const live = renderHook(() => useNotifications({ limit: 5 }), { wrapper });
    await pass(5);
    await pass(95_000);
    expect(getAllNotifications).toHaveBeenCalledTimes(1);
    live.unmount();

    getAllNotifications.mockClear();
    connected = false;
    renderHook(() => useNotifications({ limit: 5 }), { wrapper });
    await pass(5);
    await pass(95_000);
    expect(getAllNotifications.mock.calls.length).toBeGreaterThanOrEqual(4);
  });
});
