/**
 * Signing in, rendered.
 *
 * The sign-in form is the one screen every member passes through, and until
 * now nothing tested it. The two behaviours that matter most here are the ones
 * that are easy to break without noticing: the second factor has to appear
 * when the server asks for one — the first attempt is *meant* to fail with
 * "two-factor authentication required", and an app that treated that as bad
 * credentials would lock every protected account out of the phone — and a
 * failed sign-in has to say so rather than leaving the button sitting there.
 */

import React from 'react';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { act } from 'react-test-renderer';
import { Alert } from 'react-native';

const mockLogin = jest.fn<(...args: any[]) => any>();

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin }),
}));

const mockSuspensionAppeal = jest.fn<(...args: any[]) => any>();
const mockResendVerification = jest.fn<(...args: any[]) => any>();
const mockRequestUnlock = jest.fn<(...args: any[]) => any>();
jest.mock('../../services/api', () => ({
  authApi: {
    suspensionAppeal: (...args: unknown[]) => mockSuspensionAppeal(...args),
    resendVerification: (...args: unknown[]) => mockResendVerification(...args),
    requestUnlock: (...args: unknown[]) => mockRequestUnlock(...args),
  },
}));

const SUSPENDED =
  'This account has been suspended. If you believe this is a mistake, you can appeal from the sign-in page.';
const UNCONFIRMED = 'Please verify your email before signing in.';
const LOCKED =
  'This account is locked. You locked it to keep it safe, and the email we sent you has the link to unlock it. If you cannot find it, ask for a new one from the sign-in page.';

import { LoginScreen, isLockedRefusal, isUnverifiedRefusal } from '../auth/LoginScreen';
import { press, pressableWithText, renderScreen, shows, unmountScreens } from './renderScreen';
import type { ReactTestRenderer } from 'react-test-renderer';

const navigation = { navigate: jest.fn() } as never;

// The first render in a file pays for React Native's whole lazy module graph.
jest.setTimeout(30_000);

function type(screen: ReactTestRenderer, placeholder: string, value: string): void {
  const input = screen.root
    .findAll((node) => typeof node.props?.placeholder === 'string', { deep: 'all' })
    .find((node) => node.props.placeholder === placeholder);
  expect(input).toBeDefined();
  act(() => input!.props.onChangeText(value));
}

function has(screen: ReactTestRenderer, placeholder: string): boolean {
  return screen.root.findAll((node) => node.props?.placeholder === placeholder, { deep: 'all' }).length > 0;
}

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    unmountScreens();
    jest.restoreAllMocks();
  });

  it('will not call the server with an empty form', async () => {
    const screen = await renderScreen(<LoginScreen navigation={navigation} />);

    await press(pressableWithText(screen, 'Sign In')!);

    expect(mockLogin).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Please enter email and password');
  });

  it('asks for the authenticator code when the server says the account has one', async () => {
    mockLogin.mockRejectedValueOnce({ response: { data: { message: 'Two-factor authentication required' } } });

    const screen = await renderScreen(<LoginScreen navigation={navigation} />);
    type(screen, 'Email', 'mara@example.com');
    type(screen, 'Password', 'correct horse battery');
    expect(has(screen, 'Authenticator code')).toBe(false);

    await press(pressableWithText(screen, 'Sign In')!);

    // The refusal that asks for a second factor is not a refusal of the
    // password, and treating it as one would put every member with 2FA on into
    // an unwinnable loop on her phone.
    expect(has(screen, 'Authenticator code')).toBe(true);
    expect(Alert.alert).toHaveBeenCalledWith('Authenticator Code Required', expect.stringContaining('6-digit code'));
  });

  it('sends the code through on the second attempt', async () => {
    mockLogin.mockRejectedValueOnce({ response: { data: { message: 'Two-factor authentication required' } } });
    mockLogin.mockResolvedValueOnce(undefined);

    const screen = await renderScreen(<LoginScreen navigation={navigation} />);
    type(screen, 'Email', 'mara@example.com');
    type(screen, 'Password', 'correct horse battery');
    await press(pressableWithText(screen, 'Sign In')!);
    type(screen, 'Authenticator code', '123456');
    await press(pressableWithText(screen, 'Sign In')!);

    expect(mockLogin).toHaveBeenLastCalledWith('mara@example.com', 'correct horse battery', '123456');
    // The field goes away again once it has been accepted, so a later sign-in
    // on the same screen does not start half-way through the last one.
    expect(has(screen, 'Authenticator code')).toBe(false);
  });

  it('will not send a code that is too short to be one', async () => {
    mockLogin.mockRejectedValueOnce({ response: { data: { message: 'Two-factor authentication required' } } });

    const screen = await renderScreen(<LoginScreen navigation={navigation} />);
    type(screen, 'Email', 'mara@example.com');
    type(screen, 'Password', 'correct horse battery');
    await press(pressableWithText(screen, 'Sign In')!);
    mockLogin.mockClear();
    type(screen, 'Authenticator code', '12');
    await press(pressableWithText(screen, 'Sign In')!);

    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('reports a refused sign-in rather than doing nothing', async () => {
    mockLogin.mockRejectedValueOnce({ response: { data: { message: 'That email and password do not match.' } } });

    const screen = await renderScreen(<LoginScreen navigation={navigation} />);
    type(screen, 'Email', 'mara@example.com');
    type(screen, 'Password', 'wrong');
    await press(pressableWithText(screen, 'Sign In')!);

    expect(Alert.alert).toHaveBeenCalledWith('Login Failed', 'That email and password do not match.');
  });

  // The refusal tells her she can appeal from the sign-in page; in the app
  // that used to be an alert and nothing she could do with it.
  it('opens the appeal when the account is suspended, instead of an alert', async () => {
    mockLogin.mockRejectedValueOnce({ response: { status: 403, data: { message: SUSPENDED } } });

    const screen = await renderScreen(<LoginScreen navigation={navigation} />);
    type(screen, 'Email', 'mara@example.com');
    type(screen, 'Password', 'correct horse battery');
    await press(pressableWithText(screen, 'Sign In')!);

    expect(Alert.alert).not.toHaveBeenCalled();
    expect(shows(screen, 'Your account is suspended')).toBe(true);
    expect(has(screen, 'Why the suspension should be lifted')).toBe(true);
  });

  it('sends the appeal with the address and password she typed, and shows the answer', async () => {
    mockLogin.mockRejectedValueOnce({ response: { status: 403, data: { message: SUSPENDED } } });
    mockSuspensionAppeal.mockResolvedValueOnce({
      data: { success: true, message: 'Your appeal has been sent and a person will look at it.' },
    });

    const screen = await renderScreen(<LoginScreen navigation={navigation} />);
    type(screen, 'Email', 'mara@example.com');
    type(screen, 'Password', 'correct horse battery');
    await press(pressableWithText(screen, 'Sign In')!);
    type(screen, 'Why the suspension should be lifted', 'I was reported by my ex after I blocked him.');
    await press(pressableWithText(screen, 'Send appeal')!);

    expect(mockSuspensionAppeal).toHaveBeenCalledWith(
      'mara@example.com',
      'correct horse battery',
      'I was reported by my ex after I blocked him.'
    );
    expect(shows(screen, 'a person will look at it')).toBe(true);
  });

  it('will not send an appeal without at least a sentence, and says why', async () => {
    mockLogin.mockRejectedValueOnce({ response: { status: 403, data: { message: SUSPENDED } } });

    const screen = await renderScreen(<LoginScreen navigation={navigation} />);
    type(screen, 'Email', 'mara@example.com');
    type(screen, 'Password', 'correct horse battery');
    await press(pressableWithText(screen, 'Sign In')!);
    type(screen, 'Why the suspension should be lifted', 'no');
    await press(pressableWithText(screen, 'Send appeal')!);

    expect(mockSuspensionAppeal).not.toHaveBeenCalled();
    expect(shows(screen, 'at least a sentence')).toBe(true);
  });

  it("shows the server's reason when the appeal is refused", async () => {
    mockLogin.mockRejectedValueOnce({ response: { status: 403, data: { message: SUSPENDED } } });
    mockSuspensionAppeal.mockRejectedValueOnce({
      response: { status: 409, data: { message: 'Your appeal is already with a reviewer.' } },
    });

    const screen = await renderScreen(<LoginScreen navigation={navigation} />);
    type(screen, 'Email', 'mara@example.com');
    type(screen, 'Password', 'correct horse battery');
    await press(pressableWithText(screen, 'Sign In')!);
    type(screen, 'Why the suspension should be lifted', 'Please look at this again, it was a mistake.');
    await press(pressableWithText(screen, 'Send appeal')!);

    expect(shows(screen, 'already with a reviewer')).toBe(true);
    expect(has(screen, 'Why the suspension should be lifted')).toBe(true);
  });

  // Registration opens no session, so this is the first thing a new member can
  // meet when the email did not arrive, and the phone had no way to ask again.
  it('offers a new confirmation link, for the address she typed, when the address has not been confirmed', async () => {
    mockLogin.mockRejectedValueOnce({ response: { status: 403, data: { message: UNCONFIRMED } } });
    mockResendVerification.mockResolvedValueOnce({ data: { success: true } });

    const screen = await renderScreen(<LoginScreen navigation={navigation} />);
    type(screen, 'Email', 'mara@example.com');
    type(screen, 'Password', 'correct horse battery');
    await press(pressableWithText(screen, 'Sign In')!);

    // An alert and nothing else is what it used to be.
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(shows(screen, 'Confirm your email first')).toBe(true);
    expect(shows(screen, UNCONFIRMED)).toBe(true);
    expect(shows(screen, 'Your account is suspended')).toBe(false);

    await press(pressableWithText(screen, 'Send me a new link')!);

    expect(mockResendVerification).toHaveBeenCalledWith('mara@example.com');
    // Not "we have sent": the route does not say whether the address has an account.
    expect(shows(screen, 'a new link is on its way')).toBe(true);
    expect(shows(screen, 'if that address has an account waiting to be confirmed')).toBe(true);
  });

  it('says so when the new link could not be requested, rather than claiming one is on its way', async () => {
    mockLogin.mockRejectedValueOnce({ response: { status: 403, data: { message: UNCONFIRMED } } });
    mockResendVerification.mockRejectedValueOnce(new Error('network'));

    const screen = await renderScreen(<LoginScreen navigation={navigation} />);
    type(screen, 'Email', 'mara@example.com');
    type(screen, 'Password', 'correct horse battery');
    await press(pressableWithText(screen, 'Sign In')!);
    await press(pressableWithText(screen, 'Send me a new link')!);

    expect(shows(screen, 'could not send another just now')).toBe(true);
    expect(shows(screen, 'is on its way')).toBe(false);
  });

  it('offers a new unlock email, and not the appeal, when she locked the account herself', async () => {
    mockLogin.mockRejectedValueOnce({ response: { status: 403, data: { message: LOCKED } } });
    mockRequestUnlock.mockResolvedValueOnce({ data: { success: true } });

    const screen = await renderScreen(<LoginScreen navigation={navigation} />);
    type(screen, 'Email', 'mara@example.com');
    type(screen, 'Password', 'correct horse battery');
    await press(pressableWithText(screen, 'Sign In')!);

    expect(Alert.alert).not.toHaveBeenCalled();
    expect(shows(screen, 'Your account is locked')).toBe(true);
    expect(has(screen, 'Why the suspension should be lifted')).toBe(false);
    expect(pressableWithText(screen, 'Send me a new link')).toBeNull();

    await press(pressableWithText(screen, 'Email me a new unlock link')!);

    expect(mockRequestUnlock).toHaveBeenCalledWith('mara@example.com');
    expect(shows(screen, 'if that account is locked, a link to unlock it is on its way')).toBe(true);
  });

  it('forgets the panel when she changes the address, because it was for the account that was refused', async () => {
    mockLogin.mockRejectedValueOnce({ response: { status: 403, data: { message: UNCONFIRMED } } });

    const screen = await renderScreen(<LoginScreen navigation={navigation} />);
    type(screen, 'Email', 'mara@example.com');
    type(screen, 'Password', 'correct horse battery');
    await press(pressableWithText(screen, 'Sign In')!);
    expect(shows(screen, 'Confirm your email first')).toBe(true);

    type(screen, 'Email', 'someone.else@example.com');

    expect(shows(screen, 'Confirm your email first')).toBe(false);
  });

  it('shows neither panel for a wrong password', async () => {
    mockLogin.mockRejectedValueOnce({ response: { status: 401, data: { message: 'Invalid email or password' } } });

    const screen = await renderScreen(<LoginScreen navigation={navigation} />);
    type(screen, 'Email', 'mara@example.com');
    type(screen, 'Password', 'wrong');
    await press(pressableWithText(screen, 'Sign In')!);

    expect(Alert.alert).toHaveBeenCalledWith('Login Failed', 'Invalid email or password');
    expect(pressableWithText(screen, 'Send me a new link')).toBeNull();
    expect(pressableWithText(screen, 'Email me a new unlock link')).toBeNull();
  });
});

describe('the sign-in refusal matchers', () => {
  it('match the sentences the server sends and keep the three apart', () => {
    expect(isUnverifiedRefusal(UNCONFIRMED, 403)).toBe(true);
    expect(isUnverifiedRefusal(LOCKED, 403)).toBe(false);
    expect(isUnverifiedRefusal(SUSPENDED, 403)).toBe(false);
    expect(isLockedRefusal(LOCKED, 403)).toBe(true);
    expect(isLockedRefusal(UNCONFIRMED, 403)).toBe(false);
    expect(isLockedRefusal(SUSPENDED, 403)).toBe(false);
    // The brute-force lockout is a different thing and has no unlock link.
    expect(isLockedRefusal('Too many failed login attempts. Try again in 15 minutes.', 429)).toBe(false);
    // The status is checked when it is known.
    expect(isUnverifiedRefusal(UNCONFIRMED, 401)).toBe(false);
    expect(isLockedRefusal(LOCKED, 500)).toBe(false);
    expect(isUnverifiedRefusal(undefined)).toBe(false);
  });
});
