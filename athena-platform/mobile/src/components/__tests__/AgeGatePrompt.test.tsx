/**
 * The prompt that answers the server's refusals on the minimum age, from any
 * screen. A member with no date of birth is asked for it once and carries on;
 * one whose recorded date is under the minimum is told, in the server's words,
 * with no form to fill in and no number said back. Nothing is sent that the
 * server would refuse, and what it refuses is shown beside the box.
 */
import React from 'react';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { Alert } from 'react-native';
import { act } from 'react-test-renderer';

const mockListeners = new Set<(refusal: { code: string; message: string }) => void>();
const mockPost = jest.fn<(...args: any[]) => any>();
jest.mock('../../services/api', () => ({
  api: { post: (...args: unknown[]) => mockPost(...args) },
  onAgeGateRefusal: (listener: (refusal: { code: string; message: string }) => void) => {
    mockListeners.add(listener);
    return () => mockListeners.delete(listener);
  },
  webUrl: (path: string) => `https://web.test${path}`,
}));

const mockOpenOnWeb = jest.fn<(path: string) => Promise<void>>();
jest.mock('../../screens/OpensOnWebScreen', () => ({ openOnWeb: (path: string) => mockOpenOnWeb(path) }));

import { AgeGatePrompt } from '../AgeGatePrompt';
import { byLabel, press, pressableWithText, renderScreen, settle, shows, unmountScreens } from '../../screens/__tests__/renderScreen';

jest.setTimeout(30_000);

const MISSING = { code: 'DATE_OF_BIRTH_REQUIRED', message: 'Please add your date of birth before using this part of ATHENA.' };
const UNDER = { code: 'MINIMUM_AGE_NOT_MET', message: 'ATHENA accounts are for adults, so this part of the platform is not available on your account.' };

async function refused(refusal: { code: string; message: string }) {
  await act(async () => {
    for (const listener of Array.from(mockListeners)) listener(refusal);
  });
}

async function typeDate(screen: Awaited<ReturnType<typeof renderScreen>>, text: string) {
  await act(async () => {
    byLabel(screen, 'Date of birth, year then month then day')?.props.onChangeText(text);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockListeners.clear();
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  mockPost.mockResolvedValue({ data: { success: true } });
  mockOpenOnWeb.mockResolvedValue(undefined);
});

afterEach(() => {
  unmountScreens();
  jest.restoreAllMocks();
});

describe('before anything is refused', () => {
  it('shows nothing, and listens for the refusal', async () => {
    const screen = await renderScreen(<AgeGatePrompt />);

    expect(screen.toJSON()).toBeNull();
    expect(mockListeners.size).toBe(1);
  });

  it('stops listening when it goes away', async () => {
    const screen = await renderScreen(<AgeGatePrompt />);

    unmountScreens();

    expect(mockListeners.size).toBe(0);
    expect(screen).toBeTruthy();
  });
});

describe('an account with no date of birth', () => {
  it('is asked for it, in the server’s words, and told it is kept and cannot be changed', async () => {
    const screen = await renderScreen(<AgeGatePrompt />);

    await refused(MISSING);

    expect(shows(screen, 'Add your date of birth')).toBe(true);
    expect(shows(screen, MISSING.message)).toBe(true);
    expect(shows(screen, 'you cannot change it afterwards')).toBe(true);
    expect(byLabel(screen, 'Date of birth, year then month then day')).not.toBeNull();
  });

  it('will not send a date that is not one, or that makes her a child, and does not name the age', async () => {
    const screen = await renderScreen(<AgeGatePrompt />);
    await refused(MISSING);

    for (const text of ['', 'tomorrow', '2014-05-05', '1990-02-31']) {
      await typeDate(screen, text);
      await press(pressableWithText(screen, 'Save date of birth')!);
      expect(shows(screen, 'YYYY-MM-DD. ATHENA accounts are for adults.')).toBe(true);
    }

    expect(mockPost).not.toHaveBeenCalled();
    expect(shows(screen, '18')).toBe(false);
  });

  it('sends a good date to the set-once route, thanks her and closes', async () => {
    const screen = await renderScreen(<AgeGatePrompt />);
    await refused(MISSING);
    await typeDate(screen, ' 1990-04-01 ');

    await press(pressableWithText(screen, 'Save date of birth')!);
    await settle();

    expect(mockPost).toHaveBeenCalledWith('/users/me/date-of-birth', { dateOfBirth: '1990-04-01' });
    expect(Alert.alert).toHaveBeenCalledWith('Thank you', expect.stringMatching(/carry on/));
    expect(screen.toJSON()).toBeNull();
  });

  it('shows what the server refuses beside the box, and stays open so she can fix it', async () => {
    mockPost.mockRejectedValue({ response: { status: 409, data: { message: 'Your date of birth is already on file. Contact support if it is wrong.' } } });
    const screen = await renderScreen(<AgeGatePrompt />);
    await refused(MISSING);
    await typeDate(screen, '1990-04-01');

    await press(pressableWithText(screen, 'Save date of birth')!);
    await settle();

    expect(shows(screen, 'already on file')).toBe(true);
    expect(shows(screen, 'Save date of birth')).toBe(true);
  });

  it('closes on "Not now" and sends nothing', async () => {
    const screen = await renderScreen(<AgeGatePrompt />);
    await refused(MISSING);

    await press(pressableWithText(screen, 'Not now')!);

    expect(screen.toJSON()).toBeNull();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('asks again on the next refusal, with nothing left over from the last try', async () => {
    const screen = await renderScreen(<AgeGatePrompt />);
    await refused(MISSING);
    await typeDate(screen, 'nonsense');
    await press(pressableWithText(screen, 'Save date of birth')!);
    expect(shows(screen, 'YYYY-MM-DD')).toBe(true);
    await press(pressableWithText(screen, 'Not now')!);

    await refused(MISSING);

    expect(byLabel(screen, 'Date of birth, year then month then day')).not.toBeNull();
    expect(shows(screen, 'Please enter your date of birth as YYYY-MM-DD')).toBe(false);
  });
});

describe('an account whose date is under the minimum', () => {
  it('is told in the server’s words, with no form, and no number', async () => {
    const screen = await renderScreen(<AgeGatePrompt />);

    await refused(UNDER);

    expect(shows(screen, 'This account cannot do that')).toBe(true);
    expect(shows(screen, UNDER.message)).toBe(true);
    expect(byLabel(screen, 'Date of birth, year then month then day')).toBeNull();
    expect(shows(screen, '18')).toBe(false);
  });

  it('can write to us from it, and close it', async () => {
    const screen = await renderScreen(<AgeGatePrompt />);
    await refused(UNDER);

    await press(pressableWithText(screen, 'Contact us')!);
    expect(mockOpenOnWeb).toHaveBeenCalledWith('/contact');

    await press(pressableWithText(screen, 'Close')!);
    expect(screen.toJSON()).toBeNull();
  });

  it('says so, and says where to look, when the web page will not open', async () => {
    mockOpenOnWeb.mockRejectedValue(new Error('no browser'));
    const screen = await renderScreen(<AgeGatePrompt />);
    await refused(UNDER);

    await press(pressableWithText(screen, 'Contact us')!);
    await settle();

    expect(Alert.alert).toHaveBeenCalledWith('We could not open the web page', expect.stringMatching(/Contact us/));
  });
});
