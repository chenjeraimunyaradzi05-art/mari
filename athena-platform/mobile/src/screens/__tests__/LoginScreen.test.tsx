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

import { LoginScreen } from '../auth/LoginScreen';
import { press, pressableWithText, renderScreen, unmountScreens } from './renderScreen';
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
});
