/**
 * The box that asks for the second factor on the phone has to be able to take a
 * recovery code.
 *
 * A member who has lost her phone signs in on a new one with one of the ten
 * recovery codes she saved: ten letters and numbers, printed in two groups. The
 * box was a number pad that stopped at eight characters, so the one way back in
 * that the server supports could not be typed on the device a woman in that
 * position is most likely to be holding. The sign-in screen on the web already
 * took one (32 characters, a text field); this holds the phone to the same.
 */

import React from 'react';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { act } from 'react-test-renderer';
import { Alert } from 'react-native';

const mockLogin = jest.fn<(...args: any[]) => any>();

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin }),
}));

jest.mock('../../services/api', () => ({
  authApi: {
    suspensionAppeal: jest.fn(),
    resendVerification: jest.fn(),
    requestUnlock: jest.fn(),
  },
}));

import { LoginScreen } from '../auth/LoginScreen';
import { press, pressableWithText, renderScreen, unmountScreens } from './renderScreen';
import type { ReactTestRenderer } from 'react-test-renderer';

const navigation = { navigate: jest.fn() } as never;

jest.setTimeout(30_000);

function input(screen: ReactTestRenderer, placeholder: string) {
  return screen.root.findAll((node) => node.props?.placeholder === placeholder, { deep: 'all' })[0];
}

function type(screen: ReactTestRenderer, placeholder: string, value: string): void {
  const field = input(screen, placeholder);
  expect(field).toBeDefined();
  act(() => field.props.onChangeText(value));
}

describe('LoginScreen second-factor box', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    unmountScreens();
    jest.restoreAllMocks();
  });

  async function askedForTheCode() {
    mockLogin.mockRejectedValueOnce({ response: { data: { message: 'Two-factor code required' } } });
    const screen = await renderScreen(<LoginScreen navigation={navigation} />);
    type(screen, 'Email', 'mara@example.com');
    type(screen, 'Password', 'correct horse battery');
    await press(pressableWithText(screen, 'Sign In')!);
    return screen;
  }

  it('is a text field long enough for a recovery code, not a number pad that stops at eight', async () => {
    const screen = await askedForTheCode();

    const box = input(screen, 'Authenticator code');
    expect(box).toBeDefined();
    expect(box.props.keyboardType).not.toBe('number-pad');
    expect(box.props.maxLength).toBeGreaterThanOrEqual(12);
    // Letters, so no autocorrect rewriting one.
    expect(box.props.autoCorrect).toBe(false);
  });

  it('sends a recovery code exactly as it was typed, dash and all, for the server to read', async () => {
    const screen = await askedForTheCode();
    mockLogin.mockResolvedValueOnce(undefined);

    type(screen, 'Authenticator code', 'ABCDE-FGHJK');
    await press(pressableWithText(screen, 'Sign In')!);

    expect(mockLogin).toHaveBeenLastCalledWith('mara@example.com', 'correct horse battery', 'ABCDE-FGHJK');
  });

  it('tells her a recovery code is accepted, in the words she is asked the question in', async () => {
    await askedForTheCode();

    expect(Alert.alert).toHaveBeenCalledWith('Authenticator Code Required', expect.stringMatching(/recovery code/i));
  });
});
