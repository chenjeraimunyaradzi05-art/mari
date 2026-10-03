/**
 * Closing an account, from the phone.
 *
 * The app lets a woman create an account and, until now, had no way to start
 * closing one: no button, no word about where to go. Deleting is done on the
 * web, where it asks again for her password and her second factor and shows the
 * server's own answer when it refuses (a legal hold, or billing that could not
 * be ended). The phone says that, says what it does, and opens the page, rather
 * than leaving a member to guess that the app cannot do what she needs.
 */

import React from 'react';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { Alert } from 'react-native';

const mockList = jest.fn<(...args: any[]) => any>();
const mockOpenOnWeb = jest.fn<(path: string) => Promise<void>>();

jest.mock('../../services/api', () => ({
  unwrapApiData: (payload: any) => payload?.data ?? payload,
  sessionsApi: {
    list: (...args: unknown[]) => mockList(...args),
    revoke: jest.fn(),
    signOutEverywhere: jest.fn(),
    changePassword: jest.fn(),
    lockAccount: jest.fn(),
  },
  webUrl: (path: string) => `https://web.test${path}`,
}));
jest.mock('../OpensOnWebScreen', () => ({ openOnWeb: (path: string) => mockOpenOnWeb(path) }));
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ logout: jest.fn() }) }));

import { SecurityScreen } from '../SecurityScreen';
import { press, pressableWithText, renderScreen, settle, shows, unmountScreens } from './renderScreen';

jest.setTimeout(30_000);

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  mockList.mockResolvedValue({ data: { success: true, data: [] } });
  mockOpenOnWeb.mockResolvedValue(undefined);
});

afterEach(() => {
  unmountScreens();
  jest.restoreAllMocks();
});

describe('the delete-account card', () => {
  it('says what deleting does and where it is done, without pretending the phone does it', async () => {
    const screen = await renderScreen(<SecurityScreen />);

    expect(shows(screen, 'Delete your account')).toBe(true);
    expect(shows(screen, 'cannot be undone')).toBe(true);
    expect(shows(screen, 'ends any membership you pay for')).toBe(true);
    expect(shows(screen, 'on the web')).toBe(true);
    expect(shows(screen, 'password again')).toBe(true);
  });

  it('opens the Privacy Centre on the web, where the deletion is made', async () => {
    const screen = await renderScreen(<SecurityScreen />);

    await press(pressableWithText(screen, 'Delete my account on the web')!);

    expect(mockOpenOnWeb).toHaveBeenCalledWith('/privacy-center');
  });

  it('says where to find it when the page will not open', async () => {
    mockOpenOnWeb.mockRejectedValue(new Error('no browser'));
    const screen = await renderScreen(<SecurityScreen />);

    await press(pressableWithText(screen, 'Delete my account on the web')!);
    await settle();

    expect(Alert.alert).toHaveBeenCalledWith('We could not open the web page', expect.stringMatching(/Privacy Centre/));
  });
});
