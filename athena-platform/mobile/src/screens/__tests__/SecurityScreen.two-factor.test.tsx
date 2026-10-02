/**
 * Two-factor on the phone's security screen.
 *
 * The phone can answer the two-factor question at sign-in but cannot turn it on,
 * off, or make new recovery codes, and nothing on the screen said so: a member
 * who looked for it found nothing and no hint where to go. It is on the web, and
 * the screen says that and opens the page, rather than pretending to a switch it
 * does not have. If the page will not open, she is told where to find it.
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

describe('the two-factor card', () => {
  it('says it is managed on the web, that recovery codes are saved there, and that the app asks for the code at sign-in', async () => {
    const screen = await renderScreen(<SecurityScreen />);

    expect(shows(screen, 'Two-factor sign-in')).toBe(true);
    expect(shows(screen, 'on the web')).toBe(true);
    expect(shows(screen, 'recovery codes')).toBe(true);
    expect(shows(screen, 'this app asks for the code when you sign in')).toBe(true);
  });

  it('opens the security settings page on the web', async () => {
    const screen = await renderScreen(<SecurityScreen />);

    await press(pressableWithText(screen, 'Manage two-factor on the web')!);

    expect(mockOpenOnWeb).toHaveBeenCalledWith('/dashboard/settings/security');
  });

  it('says where to find it when the page will not open', async () => {
    mockOpenOnWeb.mockRejectedValue(new Error('no browser'));
    const screen = await renderScreen(<SecurityScreen />);

    await press(pressableWithText(screen, 'Manage two-factor on the web')!);
    await settle();

    expect(Alert.alert).toHaveBeenCalledWith('We could not open the web page', expect.stringMatching(/Settings, then Security/));
  });
});
