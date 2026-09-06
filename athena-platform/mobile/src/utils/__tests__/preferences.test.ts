import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => []),
  getCalendars: jest.fn(() => []),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { getDeviceDefaults, getLocalPreferences, setLocalPreferences, resolvePreferences } from '../preferences';

const device = Localization as unknown as { getLocales: jest.Mock; getCalendars: jest.Mock };
const phone = (languageTag: string, regionCode: string, timeZone = 'Australia/Brisbane') => {
  device.getLocales.mockReturnValue([{ languageTag, regionCode }]);
  device.getCalendars.mockReturnValue([{ timeZone }]);
};

describe('local preferences', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    phone('en-AU', 'AU');
  });

  it('reads the device: an Australian phone gets AUD, the ANZ region and its own time zone', () => {
    expect(getDeviceDefaults()).toEqual({ preferredLocale: 'en-AU', preferredCurrency: 'AUD', timezone: 'Australia/Brisbane', region: 'ANZ' });
  });

  it('maps other countries to their region and currency, and unknown ones to the rest of the world', () => {
    phone('vi-VN', 'VN', 'Asia/Ho_Chi_Minh');
    expect(getDeviceDefaults()).toMatchObject({ preferredLocale: 'vi-VN', region: 'SEA', preferredCurrency: 'SGD', timezone: 'Asia/Ho_Chi_Minh' });

    phone('de-DE', 'DE');
    expect(getDeviceDefaults()).toMatchObject({ region: 'EU', preferredCurrency: 'EUR' });

    phone('is-IS', 'IS');
    expect(getDeviceDefaults()).toMatchObject({ region: 'ROW', preferredCurrency: 'USD' });

    device.getLocales.mockReturnValue([]);
    device.getCalendars.mockReturnValue([]);
    expect(getDeviceDefaults()).toEqual({ preferredLocale: 'en-AU', preferredCurrency: 'AUD', timezone: 'Australia/Sydney', region: 'ANZ' });
  });

  it('stores what the member chose and layers it over the device defaults', async () => {
    expect(await getLocalPreferences()).toBeNull();
    await setLocalPreferences({ preferredLocale: 'vi-VN', preferredCurrency: 'AUD', timezone: 'Australia/Brisbane', region: 'ANZ' });
    expect(await getLocalPreferences()).toMatchObject({ preferredLocale: 'vi-VN' });

    const resolved = await resolvePreferences({ preferredCurrency: 'USD' });
    expect(resolved).toEqual({ preferredLocale: 'vi-VN', preferredCurrency: 'USD', timezone: 'Australia/Brisbane', region: 'ANZ' });
  });

  it('shrugs off a corrupted store', async () => {
    await AsyncStorage.setItem('athena.preferences', '{not json');
    expect(await getLocalPreferences()).toBeNull();
    expect(await resolvePreferences()).toMatchObject({ preferredLocale: 'en-AU' });
  });
});
