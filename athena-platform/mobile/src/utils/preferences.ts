import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';

export type LocalPreferences = {
  preferredLocale: string;
  preferredCurrency: string;
  timezone: string;
  region: string;
};

const STORAGE_KEY = 'athena.preferences';

const EU_COUNTRIES = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
]);

const SEA_COUNTRIES = new Set(['SG', 'PH', 'ID', 'TH', 'VN', 'MY']);
const MEA_COUNTRIES = new Set(['AE', 'SA', 'EG', 'ZA', 'KE', 'NG']);
const ROW_COUNTRIES = new Set(['JP', 'KR', 'IN', 'BR', 'MX']);

function regionFromCountry(country?: string | null): string {
  const code = (country || '').toUpperCase();
  if (code === 'AU' || code === 'NZ') return 'ANZ';
  if (code === 'US') return 'US';
  if (code === 'GB' || code === 'UK') return 'UK';
  if (EU_COUNTRIES.has(code)) return 'EU';
  if (SEA_COUNTRIES.has(code)) return 'SEA';
  if (MEA_COUNTRIES.has(code)) return 'MEA';
  if (ROW_COUNTRIES.has(code)) return 'ROW';
  return 'ROW';
}

function currencyForRegion(region: string): string {
  switch (region) {
    case 'ANZ':
      return 'AUD';
    case 'US':
      return 'USD';
    case 'UK':
      return 'GBP';
    case 'EU':
      return 'EUR';
    case 'SEA':
      return 'SGD';
    case 'MEA':
      return 'AED';
    case 'ROW':
    default:
      return 'USD';
  }
}

export function getDeviceDefaults(): LocalPreferences {
  const locales = Localization.getLocales?.() || [];
  const primary = locales[0];
  const countryCode = primary?.regionCode || primary?.countryCode || primary?.languageTag?.split('-')[1];
  const preferredLocale = primary?.languageTag || 'en-AU';
  const region = regionFromCountry(countryCode || null);

  return {
    preferredLocale,
    preferredCurrency: currencyForRegion(region),
    timezone: Localization.timezone || 'Australia/Sydney',
    region,
  };
}

export async function getLocalPreferences(): Promise<LocalPreferences | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LocalPreferences;
  } catch {
    return null;
  }
}

export async function setLocalPreferences(preferences: LocalPreferences): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
}

export async function resolvePreferences(input?: Partial<LocalPreferences>): Promise<LocalPreferences> {
  const deviceDefaults = getDeviceDefaults();
  const stored = await getLocalPreferences();
  return {
    ...deviceDefaults,
    ...stored,
    ...(input || {}),
  };
}
