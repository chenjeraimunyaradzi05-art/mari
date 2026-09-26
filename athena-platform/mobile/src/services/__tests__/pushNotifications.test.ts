/**
 * Registering this phone for push.
 *
 * Two things went wrong here. A cold start that ended in a sign-in registered
 * the phone twice at the same moment, and the two registrations raced into
 * duplicate rows on the server — every notification buzzed twice, and after a
 * handover one duplicate stayed active under the previous member. And the
 * server moved a phone to whoever named its token; it now asks for the device
 * key it issued the first time, which the phone has to keep and present.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockStore = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockStore.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockStore.delete(key);
  }),
}));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  setNotificationChannelAsync: jest.fn(async () => undefined),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: 'ExponentPushToken[phone-1]' })),
  AndroidImportance: { HIGH: 4 },
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { extra: { eas: { projectId: '12345678-1234-1234-1234-123456789abc' } } },
  },
}));

const mockPost = jest.fn<(url: string, body: Record<string, unknown>) => Promise<unknown>>();
const mockDelete = jest.fn<(url: string, config: unknown) => Promise<unknown>>();

jest.mock('../api', () => ({
  api: {
    post: (url: string, body: Record<string, unknown>) => mockPost(url, body),
    delete: (url: string, config: unknown) => mockDelete(url, config),
  },
}));

import { DEVICE_KEY_STORE, syncPushToken, unsyncPushToken } from '../pushNotifications';

const ISSUED = 'k'.repeat(43);

describe('syncPushToken', () => {
  beforeEach(() => {
    mockStore.clear();
    mockPost.mockReset();
    mockDelete.mockReset();
    mockDelete.mockResolvedValue({});
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it('keeps the key the server issues and presents it on every registration after', async () => {
    mockPost.mockResolvedValueOnce({ data: { data: { id: 'pt1', platform: 'ios', deviceKey: ISSUED } } });
    mockPost.mockResolvedValueOnce({ data: { data: { id: 'pt1', platform: 'ios' } } });

    await syncPushToken();
    await syncPushToken();

    expect(mockPost.mock.calls[0][1]).not.toHaveProperty('deviceKey');
    expect(mockStore.get(DEVICE_KEY_STORE)).toBe(ISSUED);
    expect(mockPost.mock.calls[1][1]).toMatchObject({ token: 'ExponentPushToken[phone-1]', deviceKey: ISSUED });
  });

  it('never has two registrations in flight at once, so the second presents the first one’s key', async () => {
    let release!: () => void;
    mockPost.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ data: { data: { id: 'pt1', deviceKey: ISSUED } } });
        })
    );
    mockPost.mockResolvedValueOnce({ data: { data: { id: 'pt1' } } });

    const first = syncPushToken();
    const second = syncPushToken();
    // Let the first reach the server and stall there.
    for (let i = 0; i < 10 && !release; i++) await Promise.resolve();
    expect(mockPost).toHaveBeenCalledTimes(1);

    release();
    await Promise.all([first, second]);

    expect(mockPost).toHaveBeenCalledTimes(2);
    expect(mockPost.mock.calls[1][1]).toMatchObject({ deviceKey: ISSUED });
  });

  it('says plainly when the phone belongs to another account, and never rejects', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 409 } });

    await expect(syncPushToken()).resolves.toBeUndefined();

    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('registered for notifications on another ATHENA account'));
  });

  it('keeps the device key through a sign-out, because the next member on this phone needs it', async () => {
    mockStore.set(DEVICE_KEY_STORE, ISSUED);
    mockPost.mockResolvedValueOnce({ data: { data: { id: 'pt1' } } });

    await syncPushToken();
    await unsyncPushToken();

    expect(mockDelete).toHaveBeenCalledWith('/notifications/push-token', { data: { token: 'ExponentPushToken[phone-1]' } });
    expect(mockStore.get(DEVICE_KEY_STORE)).toBe(ISSUED);
  });
});
