/**
 * The membership screen, rendered.
 *
 * It is the one screen in the app about what a member is paying, and nothing
 * tested it. What matters here is what it must never say: that she is on the
 * free membership when the request that would have said otherwise failed,
 * and a price it was never given. And it must keep the way to manage a paid
 * membership in front of the member who has one.
 */

import React from 'react';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { Linking } from 'react-native';

const mockSubscription = jest.fn<(...args: any[]) => any>();
const mockPricing = jest.fn<(...args: any[]) => any>();

jest.mock('../../services/api', () => ({
  billingApi: {
    subscription: (...args: unknown[]) => mockSubscription(...args),
    pricing: (...args: unknown[]) => mockPricing(...args),
  },
  unwrapApiData: (payload: any) => payload?.data ?? payload,
  WEB_URL: 'https://athena.example',
}));

jest.mock('../../utils/preferences', () => ({
  getLocalPreferences: jest.fn(async () => ({ region: 'ANZ' })),
}));

import { UpgradeScreen } from '../UpgradeScreen';
import { press, pressableWithText, renderScreen, shows, textUnder, unmountScreens, visibleText } from './renderScreen';
import type { ReactTestRenderer } from 'react-test-renderer';

/** Everything on screen as one line, so a sentence split across Text children reads whole. */
const said = (screen: ReactTestRenderer): string => textUnder(screen.root).replace(/\s+/g, ' ');

// The first render in a file pays for React Native's whole lazy module graph.
jest.setTimeout(30_000);

const PRICES = { data: { success: true, data: { currency: 'AUD', subscriptionTiers: { PREMIUM_CAREER: 19.99, PREMIUM_PROFESSIONAL: 39.99 } } } };

describe('UpgradeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    mockPricing.mockResolvedValue(PRICES);
  });

  afterEach(() => {
    unmountScreens();
    jest.restoreAllMocks();
  });

  it('asks for the prices of the member’s own region', async () => {
    mockSubscription.mockResolvedValue({ data: { success: true, data: { tier: 'FREE' } } });

    await renderScreen(<UpgradeScreen />);

    expect(mockPricing).toHaveBeenCalledWith('AU');
  });

  it('names a paid tier, marks it, and keeps the way to manage it in reach', async () => {
    mockSubscription.mockResolvedValue({
      data: { success: true, data: { tier: 'PREMIUM_PROFESSIONAL', status: 'ACTIVE', currentPeriodEnd: '2026-10-26T00:00:00.000Z', cancelAtPeriodEnd: false } },
    });

    const screen = await renderScreen(<UpgradeScreen />);

    expect(said(screen)).toContain('You are on Professional');
    expect(shows(screen, 'Your plan')).toBe(true);
    expect(shows(screen, 'renews')).toBe(true);
    const manage = pressableWithText(screen, 'Manage my membership');
    expect(manage).not.toBeNull();
    await press(manage!);
    expect(Linking.openURL).toHaveBeenCalledWith('https://athena.example/settings');
  });

  it('never says she is on the free membership when her membership could not be loaded', async () => {
    mockSubscription.mockRejectedValue(new Error('Network Error'));

    const screen = await renderScreen(<UpgradeScreen />);

    expect(shows(screen, 'could not be loaded')).toBe(true);
    expect(said(screen)).not.toMatch(/You are on (Free|Career|Professional|Entrepreneur|Creator)/);
    expect(shows(screen, 'The free membership')).toBe(false);
  });

  it('shows no invented amount when the prices could not be loaded', async () => {
    mockSubscription.mockResolvedValue({ data: { success: true, data: { tier: 'FREE' } } });
    mockPricing.mockRejectedValue(new Error('Network Error'));

    const screen = await renderScreen(<UpgradeScreen />);
    const text = visibleText(screen);

    expect(shows(screen, 'Prices could not be loaded')).toBe(true);
    expect(text).not.toMatch(/\$\d/);
    expect(text).not.toContain('/month');
  });

  it('prices each tier from the server, in the currency it names, and marks the ones it did not price', async () => {
    mockSubscription.mockResolvedValue({ data: { success: true, data: { tier: 'FREE' } } });

    const screen = await renderScreen(<UpgradeScreen />);
    const text = visibleText(screen);

    expect(text).toContain('$19.99/month');
    expect(text).toContain('$39.99/month');
    // Entrepreneur and Creator had no price in the answer: a dash, not a guess.
    expect(text.match(/—/g)?.length).toBe(2);
    expect(said(screen)).toContain('You are on Free');
    // No purchase button: billing happens on the web, and the screen says so.
    expect(pressableWithText(screen, 'Manage my membership')).toBeNull();
    expect(pressableWithText(screen, 'See plans on the web')).not.toBeNull();
  });
});
