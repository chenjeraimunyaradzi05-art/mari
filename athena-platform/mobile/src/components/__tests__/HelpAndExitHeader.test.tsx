/**
 * The header of a safety-adjacent screen: Emergency help, and the quick exit
 * beside it. The quick exit was on the three wellness screens and nowhere on the
 * Safety screen, which is where the panic button is, nor on Help & Support, nor
 * on her sign-in and devices. These hold the header to carrying both, and hold
 * the navigator to using it on each of those screens.
 */
import React from 'react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { Linking } from 'react-native';

const mockSettings = jest.fn<(...args: any[]) => any>();
const mockReset = jest.fn();

jest.mock('../../services/api', () => ({
  unwrapApiData: (payload: any) => payload?.data ?? payload,
  safetyApi: { settings: (...args: unknown[]) => mockSettings(...args) },
  webUrl: (path: string) => `https://athena.example${path}`,
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ reset: mockReset, navigate: jest.fn() }),
}));

import { HelpAndExitHeaderRight } from '../pillar/HelpAndExitHeader';
import { DEFAULT_EXIT_URL, forgetExitAddress } from '../pillar/QuickExit';
import { byLabel, press, renderScreen, unmountScreens } from '../../screens/__tests__/renderScreen';

jest.setTimeout(30_000);

beforeEach(() => {
  jest.clearAllMocks();
  forgetExitAddress();
  mockSettings.mockResolvedValue({ data: { success: true, data: { safeExitUrl: 'https://www.bom.gov.au' } } });
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
});

afterEach(() => {
  unmountScreens();
  jest.restoreAllMocks();
});

describe('the header a safety screen carries', () => {
  it('has Emergency help and the quick exit, side by side', async () => {
    const header = await renderScreen(<HelpAndExitHeaderRight />);

    expect(byLabel(header, 'Emergency help')).not.toBeNull();
    expect(byLabel(header, 'Quick exit')).not.toBeNull();
  });

  it('leaves for the page she chose, and resets the app to the feed', async () => {
    const header = await renderScreen(<HelpAndExitHeaderRight />);

    await press(byLabel(header, 'Quick exit')!);

    expect(mockReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Main' }] });
    expect(Linking.openURL).toHaveBeenCalledWith('https://www.bom.gov.au');
  });

  it('still leaves, for the default page, when her settings cannot be read', async () => {
    mockSettings.mockRejectedValue(new Error('Network Error'));

    const header = await renderScreen(<HelpAndExitHeaderRight />);
    await press(byLabel(header, 'Quick exit')!);

    expect(Linking.openURL).toHaveBeenCalledWith(DEFAULT_EXIT_URL);
  });
});

describe('the screens that carry it', () => {
  // The navigator imports every screen in the app, so it is read rather than
  // rendered: what is held is that each of these routes names the header.
  const navigator = readFileSync(join(__dirname, '../../navigation/AppNavigator.tsx'), 'utf8');
  const routeOf = (name: string): string => {
    const start = navigator.indexOf(`name="${name}"`);
    if (start < 0) throw new Error(`no route named ${name}`);
    // From the route's name to the end of its element.
    return navigator.slice(start, navigator.indexOf('/>', start + navigator.slice(start).indexOf('component=')) + 2);
  };

  it.each(['Safety', 'HelpSupport', 'Security', 'Wellness', 'WellnessCheckIn', 'WellnessK10'])(
    '%s has the quick exit in its header',
    (name) => {
      expect(routeOf(name)).toContain('headerRight: () => <HelpAndExitHeaderRight />');
    }
  );

  it('is imported from the shared header, not redrawn', () => {
    expect(navigator).toContain("from '../components/pillar/HelpAndExitHeader'");
  });
});
