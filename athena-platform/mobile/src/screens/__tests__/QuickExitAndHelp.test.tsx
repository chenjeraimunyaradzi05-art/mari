/**
 * Three small things on the phone that must not fail quietly.
 *
 * The Emergency help button in the header, which opens the numbers to ring from
 * any screen without asking the API for anything.
 *
 * The quick exit on the wellness screens: one tap resets the app to the feed
 * and switches to a harmless page, the one she chose in her safety settings,
 * or a search engine when those cannot be read. And feedback from Help &
 * Support, which is sent from the app now instead of opening the web, and
 * keeps what she wrote when it does not go through.
 */

import React from 'react';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { Linking } from 'react-native';
import { act } from 'react-test-renderer';

const mockSettings = jest.fn<(...args: any[]) => any>();
const mockFeedback = jest.fn<(...args: any[]) => any>();
const mockReset = jest.fn();
const mockNavigate = jest.fn();

jest.mock('../../services/api', () => ({
  unwrapApiData: (payload: any) => payload?.data ?? payload,
  safetyApi: { settings: (...args: unknown[]) => mockSettings(...args) },
  feedbackApi: { send: (...args: unknown[]) => mockFeedback(...args) },
  webUrl: (path: string) => `https://athena.example${path}`,
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ reset: mockReset, navigate: mockNavigate }),
}));

import { DEFAULT_EXIT_URL, QuickExitButton, forgetExitAddress } from '../../components/pillar/QuickExit';
import { EmergencyHelpButton } from '../../components/pillar/EmergencyHelp';
import { HelpSupportScreen } from '../HelpSupportScreen';
import { byLabel, press, pressableWithText, renderScreen, settle, shows, unmountScreens } from './renderScreen';

jest.setTimeout(30_000);

beforeEach(() => {
  jest.clearAllMocks();
  forgetExitAddress();
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
});

afterEach(() => {
  unmountScreens();
  jest.restoreAllMocks();
});

describe('QuickExitButton', () => {
  it('resets the app to the feed and opens the page she chose', async () => {
    mockSettings.mockResolvedValue({ data: { success: true, data: { safeExitUrl: 'https://www.bom.gov.au' } } });

    const screen = await renderScreen(<QuickExitButton />);
    await press(byLabel(screen, 'Quick exit')!);

    expect(mockReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Main' }] });
    expect(Linking.openURL).toHaveBeenCalledWith('https://www.bom.gov.au');
  });

  it('still leaves, for the default page, when her settings cannot be read', async () => {
    mockSettings.mockRejectedValue(new Error('Network Error'));

    const screen = await renderScreen(<QuickExitButton />);
    await press(byLabel(screen, 'Quick exit')!);

    expect(mockReset).toHaveBeenCalled();
    expect(Linking.openURL).toHaveBeenCalledWith(DEFAULT_EXIT_URL);
  });

  it('does not follow an address that is not a web page', async () => {
    mockSettings.mockResolvedValue({ data: { success: true, data: { safeExitUrl: 'javascript:alert(1)' } } });

    const screen = await renderScreen(<QuickExitButton />);
    await press(byLabel(screen, 'Quick exit')!);

    expect(Linking.openURL).toHaveBeenCalledWith(DEFAULT_EXIT_URL);
  });
});

describe('EmergencyHelpButton', () => {
  it('is a labelled button in the header, and the sheet stays shut until it is pressed', async () => {
    const screen = await renderScreen(<EmergencyHelpButton />);

    expect(byLabel(screen, 'Emergency help')).not.toBeNull();
    expect(shows(screen, 'Help')).toBe(true);
    expect(shows(screen, 'Lifeline')).toBe(false);
  });

  it('opens the numbers to ring, and says plainly that ATHENA cannot send anyone', async () => {
    mockSettings.mockReturnValue(new Promise(() => undefined));

    const screen = await renderScreen(<EmergencyHelpButton />);
    await press(byLabel(screen, 'Emergency help')!);

    expect(byLabel(screen, 'Call Emergency on 000')).not.toBeNull();
    expect(byLabel(screen, 'Call 1800RESPECT on 1800 737 732')).not.toBeNull();
    expect(byLabel(screen, 'Call Lifeline on 13 11 14')).not.toBeNull();
    expect(shows(screen, 'ATHENA cannot send anyone to you')).toBe(true);
    expect(shows(screen, 'New Zealand 111')).toBe(true);
  });

  it('dials the number she taps', async () => {
    const screen = await renderScreen(<EmergencyHelpButton />);
    await press(byLabel(screen, 'Emergency help')!);

    await press(byLabel(screen, 'Call 1800RESPECT on 1800 737 732')!);

    expect(Linking.openURL).toHaveBeenCalledWith('tel:1800737732');
  });

  it('leaves for the page she chose, from the sheet, and closes the sheet', async () => {
    mockSettings.mockResolvedValue({ data: { success: true, data: { safeExitUrl: 'https://www.bom.gov.au' } } });

    const screen = await renderScreen(<EmergencyHelpButton />);
    await press(byLabel(screen, 'Emergency help')!);
    await settle();
    await press(byLabel(screen, 'Quick exit')!);

    expect(mockReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Main' }] });
    expect(Linking.openURL).toHaveBeenCalledWith('https://www.bom.gov.au');
    expect(shows(screen, 'Lifeline')).toBe(false);
  });

  it('still opens, and still leaves for the default page, when her settings cannot be read', async () => {
    mockSettings.mockRejectedValue(new Error('Network Error'));

    const screen = await renderScreen(<EmergencyHelpButton />);
    await press(byLabel(screen, 'Emergency help')!);
    await press(byLabel(screen, 'Quick exit')!);

    expect(Linking.openURL).toHaveBeenCalledWith(DEFAULT_EXIT_URL);
    expect(mockReset).toHaveBeenCalled();
  });

  it('goes to the Safety centre, and opens the report form on the web', async () => {
    const screen = await renderScreen(<EmergencyHelpButton />);

    await press(byLabel(screen, 'Emergency help')!);
    await press(byLabel(screen, 'Safety centre')!);
    expect(mockNavigate).toHaveBeenCalledWith('Safety');
    expect(shows(screen, 'Lifeline')).toBe(false);

    await press(byLabel(screen, 'Emergency help')!);
    await press(byLabel(screen, 'Report something on ATHENA')!);
    expect(Linking.openURL).toHaveBeenCalledWith('https://athena.example/report');
  });

  it('closes from its own button', async () => {
    const screen = await renderScreen(<EmergencyHelpButton />);
    await press(byLabel(screen, 'Emergency help')!);
    expect(shows(screen, 'Lifeline')).toBe(true);

    await press(byLabel(screen, 'Close emergency help')!);

    expect(shows(screen, 'Lifeline')).toBe(false);
  });
});

describe('HelpSupportScreen feedback', () => {
  it('sends her feedback with its category, from the app', async () => {
    mockFeedback.mockResolvedValue({ data: { success: true, data: { id: 'f1' } } });

    const screen = await renderScreen(<HelpSupportScreen />);
    await press(pressableWithText(screen, 'Something is broken')!);
    await act(async () => {
      byLabel(screen, 'What would you like us to know?')?.props.onChangeText('The calculator froze on the deposit page.');
    });
    await press(pressableWithText(screen, 'Send')!);
    await settle();

    expect(mockFeedback).toHaveBeenCalledWith({ message: 'The calculator froze on the deposit page.', category: 'BUG', page: 'mobile:help' });
    expect(shows(screen, 'It has reached the ATHENA team')).toBe(true);
  });

  it('keeps what she wrote and says so when it does not send', async () => {
    mockFeedback.mockRejectedValue(new Error('Network Error'));

    const screen = await renderScreen(<HelpSupportScreen />);
    await act(async () => {
      byLabel(screen, 'What would you like us to know?')?.props.onChangeText('Please add a dark mode.');
    });
    await press(pressableWithText(screen, 'Send')!);
    await settle();

    expect(shows(screen, 'nothing you wrote has been lost')).toBe(true);
    expect(byLabel(screen, 'What would you like us to know?')?.props.value).toBe('Please add a dark mode.');
  });

  it('asks for a little more before sending a message too short for the server', async () => {
    const screen = await renderScreen(<HelpSupportScreen />);
    await act(async () => {
      byLabel(screen, 'What would you like us to know?')?.props.onChangeText('hi');
    });
    await press(pressableWithText(screen, 'Send')!);

    expect(mockFeedback).not.toHaveBeenCalled();
    expect(shows(screen, 'at least ten characters')).toBe(true);
  });
});
