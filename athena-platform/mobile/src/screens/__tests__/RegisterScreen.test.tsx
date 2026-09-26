/**
 * Signing up, rendered.
 *
 * The sign-up form is where two of the platform's promises are kept or not:
 * ATHENA is for adult women, so an account is only created with a date of
 * birth showing she is 18 or over and with the woman's self-attestation
 * ticked. Both are checked on the server too; these make sure the phone asks
 * for them, sends them, and does not send a registration that the server
 * would have to be relied on to refuse.
 */

import React from 'react';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { act } from 'react-test-renderer';
import { Alert } from 'react-native';
import type { ReactTestRenderer } from 'react-test-renderer';

const mockRegister = jest.fn<(...args: any[]) => any>();

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ register: mockRegister }),
}));

import { RegisterScreen } from '../auth/RegisterScreen';
import { press, pressableWithText, renderScreen, unmountScreens } from './renderScreen';

const navigation = { navigate: jest.fn() } as { navigate: jest.Mock };

// The first render in a file pays for React Native's whole lazy module graph.
jest.setTimeout(30_000);

const STRONG_PASSWORD = 'Correct-Horse-9';

function type(screen: ReactTestRenderer, placeholder: string, value: string): void {
  const input = screen.root
    .findAll((node) => typeof node.props?.placeholder === 'string', { deep: 'all' })
    .find((node) => node.props.placeholder === placeholder);
  expect(input).toBeDefined();
  act(() => input!.props.onChangeText(value));
}

/** A date of birth `years` years ago today, give or take `days`. */
function bornYearsAgo(years: number, days = 0): string {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() - years);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function fillIn(screen: ReactTestRenderer, overrides: Partial<Record<'dob' | 'password', string>> = {}) {
  type(screen, 'First Name', ' Mara ');
  type(screen, 'Last Name', 'Nguyen');
  type(screen, 'Email', ' Mara@Example.com ');
  type(screen, 'Password (min 12 characters)', overrides.password ?? STRONG_PASSWORD);
  type(screen, 'Date of birth (YYYY-MM-DD)', overrides.dob ?? bornYearsAgo(30));
}

async function attest(screen: ReactTestRenderer) {
  await press(pressableWithText(screen, 'I confirm that I am a woman')!);
}

describe('RegisterScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockRegister.mockResolvedValue({ verificationRequired: false });
  });

  afterEach(() => {
    unmountScreens();
    jest.restoreAllMocks();
  });

  it('will not create an account without the self-attestation', async () => {
    const screen = await renderScreen(<RegisterScreen navigation={navigation as never} />);
    await fillIn(screen);

    await press(pressableWithText(screen, 'Create Account')!);

    expect(mockRegister).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith('Error', expect.stringContaining('self-attestation'));
  });

  it('will not create an account for someone under 18, even by a day', async () => {
    const screen = await renderScreen(<RegisterScreen navigation={navigation as never} />);
    await fillIn(screen, { dob: bornYearsAgo(18, 1) });
    await attest(screen);

    await press(pressableWithText(screen, 'Create Account')!);

    expect(mockRegister).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith('Date of birth', expect.stringContaining('at least 18'));
  });

  it('will not accept a date of birth it cannot read', async () => {
    const screen = await renderScreen(<RegisterScreen navigation={navigation as never} />);
    await fillIn(screen, { dob: '01/02/1990' });
    await attest(screen);

    await press(pressableWithText(screen, 'Create Account')!);

    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('holds the password to the server’s rule before sending anything', async () => {
    const screen = await renderScreen(<RegisterScreen navigation={navigation as never} />);
    await fillIn(screen, { password: 'short' });
    await attest(screen);

    await press(pressableWithText(screen, 'Create Account')!);

    expect(mockRegister).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith('Error', expect.stringContaining('at least 12 characters'));
  });

  it('sends the attestation, the date of birth and a persona the server has', async () => {
    const dob = bornYearsAgo(18);
    const screen = await renderScreen(<RegisterScreen navigation={navigation as never} />);
    await fillIn(screen, { dob });
    await press(pressableWithText(screen, 'Entrepreneur')!);
    await attest(screen);

    await press(pressableWithText(screen, 'Create Account')!);

    expect(mockRegister).toHaveBeenCalledWith({
      firstName: 'Mara',
      lastName: 'Nguyen',
      email: 'mara@example.com',
      password: STRONG_PASSWORD,
      persona: 'ENTREPRENEUR',
      womanSelfAttested: true,
      dateOfBirth: dob,
    });
  });

  it('sends her to verify her email, and to sign in afterwards, when the server asks for verification', async () => {
    mockRegister.mockResolvedValue({ verificationRequired: true });
    const screen = await renderScreen(<RegisterScreen navigation={navigation as never} />);
    await fillIn(screen);
    await attest(screen);

    await press(pressableWithText(screen, 'Create Account')!);

    expect(Alert.alert).toHaveBeenCalledWith('Check your inbox', expect.any(String), expect.any(Array));
    const buttons = (Alert.alert as unknown as jest.Mock).mock.calls.at(-1)?.[2] as Array<{ onPress?: () => void }>;
    buttons[0].onPress?.();
    expect(navigation.navigate).toHaveBeenCalledWith('Login');
  });

  it('says why the server refused, rather than leaving the button sitting there', async () => {
    mockRegister.mockRejectedValue({ response: { data: { message: 'An account with this email already exists' } } });
    const screen = await renderScreen(<RegisterScreen navigation={navigation as never} />);
    await fillIn(screen);
    await attest(screen);

    await press(pressableWithText(screen, 'Create Account')!);

    expect(Alert.alert).toHaveBeenCalledWith('Registration Failed', 'An account with this email already exists');
    expect(pressableWithText(screen, 'Create Account')!.props.disabled).toBe(false);
  });
});
