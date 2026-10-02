/**
 * Sign-in and devices, on the phone.
 *
 * The web had a page for the devices her account is signed in on and the phone
 * had nothing, so a woman who had lost a phone had to find a browser to get her
 * account back. What matters here is what she can and cannot do by mistake: she
 * is shown devices by name and never by the raw user-agent string; she cannot
 * end the session she is looking at by tapping the wrong row (there is no
 * button on it); nothing ends without her confirming; a failure is said, not
 * swallowed, and never reads as an empty list; and a password is only sent when
 * it is one the server will accept.
 */

import React from 'react';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { Alert } from 'react-native';
import { act } from 'react-test-renderer';

const mockList = jest.fn<(...args: any[]) => any>();
const mockRevoke = jest.fn<(...args: any[]) => any>();
const mockSignOutEverywhere = jest.fn<(...args: any[]) => any>();
const mockChangePassword = jest.fn<(...args: any[]) => any>();
const mockLockAccount = jest.fn<(...args: any[]) => any>();
const mockLogout = jest.fn<() => Promise<void>>();

jest.mock('../../services/api', () => ({
  unwrapApiData: (payload: any) => payload?.data ?? payload,
  sessionsApi: {
    list: (...args: unknown[]) => mockList(...args),
    revoke: (...args: unknown[]) => mockRevoke(...args),
    signOutEverywhere: (...args: unknown[]) => mockSignOutEverywhere(...args),
    changePassword: (...args: unknown[]) => mockChangePassword(...args),
    lockAccount: (...args: unknown[]) => mockLockAccount(...args),
  },
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ logout: mockLogout }),
}));

import { SecurityScreen } from '../SecurityScreen';
import { byLabel, press, pressableWithText, renderScreen, settle, shows, unmountScreens, visibleText } from './renderScreen';

jest.setTimeout(30_000);

const CHROME_ON_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const SAFARI_ON_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

const sessions = [
  { id: 's-here', userAgent: 'okhttp/4.12.0', ipAddress: '203.0.113.7', createdAt: '2026-10-01T02:00:00.000Z', isCurrent: true },
  { id: 's-laptop', userAgent: CHROME_ON_WINDOWS, ipAddress: '198.51.100.20', createdAt: '2026-09-28T10:30:00.000Z', isCurrent: false },
  { id: 's-old-phone', userAgent: SAFARI_ON_IPHONE, ipAddress: null, createdAt: '2026-09-20T08:15:00.000Z', isCurrent: false },
];

/** Answers the next Alert.alert by tapping the button with this style, as she would. */
function confirmNextAlert(style: 'destructive' | 'cancel') {
  (Alert.alert as unknown as jest.Mock).mockImplementationOnce((_title: unknown, _message: unknown, buttons: any) => {
    const button = (buttons as Array<{ style?: string; onPress?: () => unknown }>).find((entry) => entry.style === style);
    return button?.onPress?.();
  });
}

async function type(screen: Awaited<ReturnType<typeof renderScreen>>, label: string, text: string) {
  await act(async () => {
    byLabel(screen, label)?.props.onChangeText(text);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  mockList.mockResolvedValue({ data: { success: true, data: sessions } });
  mockRevoke.mockResolvedValue({ data: { success: true } });
  mockSignOutEverywhere.mockResolvedValue({ data: { success: true } });
  mockChangePassword.mockResolvedValue({ data: { success: true } });
  mockLockAccount.mockResolvedValue({ data: { success: true, data: { locked: true, unlockEmailSent: true } } });
  mockLogout.mockResolvedValue(undefined);
});

afterEach(() => {
  unmountScreens();
  jest.restoreAllMocks();
});

describe('the list of devices', () => {
  it('names each device by browser and system, marks this one, and never shows the raw string', async () => {
    const screen = await renderScreen(<SecurityScreen />);

    expect(shows(screen, 'Mobile app on Android')).toBe(true);
    expect(shows(screen, 'This device')).toBe(true);
    expect(shows(screen, 'Chrome on Windows')).toBe(true);
    expect(shows(screen, 'Safari on iPhone')).toBe(true);
    expect(visibleText(screen)).not.toContain('Mozilla/5.0');
    expect(visibleText(screen)).not.toContain('okhttp');
    expect(shows(screen, 'IP 198.51.100.20')).toBe(true);
  });

  it('gives this device no sign-out button, and every other device one that says which', async () => {
    const screen = await renderScreen(<SecurityScreen />);

    expect(byLabel(screen, 'Sign out Mobile app on Android')).toBeNull();
    expect(byLabel(screen, 'Sign out Chrome on Windows')).not.toBeNull();
    expect(byLabel(screen, 'Sign out Safari on iPhone')).not.toBeNull();
  });

  it('says so when the devices could not be loaded, rather than showing an empty list, and tries again on request', async () => {
    mockList.mockRejectedValueOnce(new Error('Network Error'));

    const screen = await renderScreen(<SecurityScreen />);

    expect(shows(screen, 'could not be loaded')).toBe(true);
    expect(shows(screen, 'No signed-in devices')).toBe(false);

    await press(pressableWithText(screen, 'Try again')!);
    await settle();

    expect(mockList).toHaveBeenCalledTimes(2);
    expect(shows(screen, 'Chrome on Windows')).toBe(true);
  });
});

describe('ending one device', () => {
  it('asks first, then ends it, then reads the list again', async () => {
    const screen = await renderScreen(<SecurityScreen />);
    confirmNextAlert('destructive');

    await press(byLabel(screen, 'Sign out Chrome on Windows')!);
    await settle();

    expect(Alert.alert).toHaveBeenCalledWith('Sign out this device?', expect.stringContaining('Chrome on Windows'), expect.any(Array));
    expect(mockRevoke).toHaveBeenCalledWith('s-laptop');
    expect(mockList).toHaveBeenCalledTimes(2);
  });

  it('ends nothing when she cancels', async () => {
    const screen = await renderScreen(<SecurityScreen />);
    confirmNextAlert('cancel');

    await press(byLabel(screen, 'Sign out Chrome on Windows')!);
    await settle();

    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(mockRevoke).not.toHaveBeenCalled();
  });

  it('says it did not work, and leaves the list as it was, when the server refuses', async () => {
    mockRevoke.mockRejectedValueOnce({ response: { status: 404, data: { message: 'Session not found' } } });
    const screen = await renderScreen(<SecurityScreen />);
    confirmNextAlert('destructive');

    await press(byLabel(screen, 'Sign out Chrome on Windows')!);
    await settle();

    expect(shows(screen, 'Session not found')).toBe(true);
    expect(mockList).toHaveBeenCalledTimes(1);
    expect(shows(screen, 'Chrome on Windows')).toBe(true);
  });
});

describe('signing out everywhere', () => {
  it('asks first, ends every session on the server, then signs this phone out too', async () => {
    const screen = await renderScreen(<SecurityScreen />);
    confirmNextAlert('destructive');

    await press(pressableWithText(screen, 'Sign out of every device')!);
    await settle();

    expect(mockSignOutEverywhere).toHaveBeenCalledTimes(1);
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('does not sign this phone out when the server could not end the sessions', async () => {
    mockSignOutEverywhere.mockRejectedValueOnce(new Error('Network Error'));
    const screen = await renderScreen(<SecurityScreen />);
    confirmNextAlert('destructive');

    await press(pressableWithText(screen, 'Sign out of every device')!);
    await settle();

    expect(mockLogout).not.toHaveBeenCalled();
    expect(shows(screen, 'could not be signed out')).toBe(true);
  });

  it('does nothing when she cancels', async () => {
    const screen = await renderScreen(<SecurityScreen />);
    confirmNextAlert('cancel');

    await press(pressableWithText(screen, 'Sign out of every device')!);
    await settle();

    expect(mockSignOutEverywhere).not.toHaveBeenCalled();
    expect(mockLogout).not.toHaveBeenCalled();
  });
});

describe('locking the account', () => {
  it('says what locking does, and how it differs from signing out everywhere', async () => {
    const screen = await renderScreen(<SecurityScreen />);

    expect(shows(screen, 'Lock my account')).toBe(true);
    expect(shows(screen, 'unlock it from a link we email you')).toBe(true);
    expect(shows(screen, 'anyone who knows your password can sign straight back in')).toBe(true);
  });

  it('asks first, locks on the server, tells her the email is on its way, then signs this phone out', async () => {
    const screen = await renderScreen(<SecurityScreen />);
    confirmNextAlert('destructive');

    await press(pressableWithText(screen, 'Lock my account')!);
    await settle();

    expect(Alert.alert).toHaveBeenNthCalledWith(1, 'Lock your account?', expect.stringContaining('including this phone'), expect.any(Array));
    expect(mockLockAccount).toHaveBeenCalledTimes(1);
    expect(Alert.alert).toHaveBeenNthCalledWith(2, 'Your account is locked', 'We have emailed you a link to unlock it.');
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('does not claim an email went when the server says it could not send one', async () => {
    mockLockAccount.mockResolvedValueOnce({ data: { success: true, data: { locked: true, unlockEmailSent: false } } });
    const screen = await renderScreen(<SecurityScreen />);
    confirmNextAlert('destructive');

    await press(pressableWithText(screen, 'Lock my account')!);
    await settle();

    const said = (Alert.alert as unknown as jest.Mock).mock.calls[1][1] as string;
    expect(said).toMatch(/could not send the unlock email/i);
    expect(said).not.toMatch(/we have emailed you/i);
    // She is locked all the same, so she is signed out of this phone.
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('does nothing when she cancels', async () => {
    const screen = await renderScreen(<SecurityScreen />);
    confirmNextAlert('cancel');

    await press(pressableWithText(screen, 'Lock my account')!);
    await settle();

    expect(mockLockAccount).not.toHaveBeenCalled();
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it('leaves her signed in, with the server reason, when the lock did not happen', async () => {
    mockLockAccount.mockRejectedValueOnce({ response: { status: 429, data: { message: 'Too many attempts from here. Please try again in an hour.' } } });
    const screen = await renderScreen(<SecurityScreen />);
    confirmNextAlert('destructive');

    await press(pressableWithText(screen, 'Lock my account')!);
    await settle();

    expect(mockLogout).not.toHaveBeenCalled();
    expect(shows(screen, 'Too many attempts from here')).toBe(true);
    expect(Alert.alert).toHaveBeenCalledTimes(1);
  });
});

describe('locking the account when no answer comes back', () => {
  it.each([
    ['no answer at all', new Error('timeout of 10000ms exceeded')],
    ['a gateway that gave up', { response: { status: 504, data: { message: 'Backend unavailable' } } }],
  ])('does not claim nothing happened after %s, because the lock may have gone through', async (_label, failure) => {
    mockLockAccount.mockRejectedValueOnce(failure);
    const screen = await renderScreen(<SecurityScreen />);
    confirmNextAlert('destructive');

    await press(pressableWithText(screen, 'Lock my account')!);
    await settle();

    expect(shows(screen, 'cannot tell whether your account was locked')).toBe(true);
    expect(shows(screen, 'Nothing has changed')).toBe(false);
    expect(mockLogout).not.toHaveBeenCalled();
  });
});

describe('changing the password', () => {
  const GOOD = 'Correct-Horse-9!';

  it.each([
    ['no current password', '', GOOD, GOOD, 'Enter your current password'],
    ['a new password that is too short', 'Old-Passw0rd!x', 'Sh0rt!', 'Sh0rt!', 'at least 12 characters'],
    ['a new password with no symbol', 'Old-Passw0rd!x', 'NoSymbolsHere123', 'NoSymbolsHere123', 'a symbol'],
    ['a new password that is the old one', 'Correct-Horse-9!', GOOD, GOOD, 'have not used here before'],
    ['two new passwords that differ', 'Old-Passw0rd!x', GOOD, 'Correct-Horse-8!', 'do not match'],
  ])('does not send %s', async (_label, current, next, confirm, expected) => {
    const screen = await renderScreen(<SecurityScreen />);
    await type(screen, 'Current password', current);
    await type(screen, 'New password', next);
    await type(screen, 'Confirm new password', confirm);

    await press(pressableWithText(screen, 'Change password')!);

    expect(mockChangePassword).not.toHaveBeenCalled();
    expect(shows(screen, expected)).toBe(true);
  });

  it('sends the current and new password, clears the form, says every other device is signed out, and reads the list again', async () => {
    const screen = await renderScreen(<SecurityScreen />);
    await type(screen, 'Current password', 'Old-Passw0rd!x');
    await type(screen, 'New password', GOOD);
    await type(screen, 'Confirm new password', GOOD);

    await press(pressableWithText(screen, 'Change password')!);
    await settle();

    expect(mockChangePassword).toHaveBeenCalledWith('Old-Passw0rd!x', GOOD);
    expect(shows(screen, 'every other device has been signed out')).toBe(true);
    expect(byLabel(screen, 'Current password')?.props.value).toBe('');
    expect(byLabel(screen, 'New password')?.props.value).toBe('');
    expect(mockList).toHaveBeenCalledTimes(2);
  });

  it('says what the server said when it refuses, and keeps what she typed', async () => {
    mockChangePassword.mockRejectedValueOnce({ response: { status: 401, data: { message: 'Current password is incorrect' } } });
    const screen = await renderScreen(<SecurityScreen />);
    await type(screen, 'Current password', 'Not-My-Passw0rd!');
    await type(screen, 'New password', GOOD);
    await type(screen, 'Confirm new password', GOOD);

    await press(pressableWithText(screen, 'Change password')!);
    await settle();

    expect(shows(screen, 'Current password is incorrect')).toBe(true);
    expect(shows(screen, 'every other device has been signed out')).toBe(false);
    expect(byLabel(screen, 'New password')?.props.value).toBe(GOOD);
  });
});
