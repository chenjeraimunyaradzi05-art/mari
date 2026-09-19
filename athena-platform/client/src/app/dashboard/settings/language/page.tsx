'use client';

/**
 * Language and region.
 *
 * The choices here are built from GET /api/region, so nothing offered can
 * be refused when it is saved. This page used to list 35 languages of which
 * three did anything and 13 regions of which six the server rejected, and a
 * Queensland member who chose Spanish, Arabic or Vietnamese (the three
 * languages ATHENA translates in full) was told 'Failed to update
 * preferences' because her region only allowed English. Language is now
 * hers whatever her region; the region decides currency and compliance
 * defaults. The Date and Time Format cards that saved nothing are gone.
 */

import { useEffect, useMemo, useState } from 'react';
import { Check, Globe, Info, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { cn, getPreferredCurrency, getPreferredLocale, setStoredPreference } from '@/lib/utils';
import { useAuthStore } from '@/lib/store';
import { regionApi, userApi } from '@/lib/api';
import { setI18nLocale } from '@/i18n/next-i18n';
import { translateDocument } from '@/i18n/domTranslator';
import { DICTIONARIES } from '@/i18n/dictionary';

type RegionConfig = {
  key: string;
  label: string;
  defaultLocale: string;
  defaultCurrency: string;
  supportedLocales: string[];
  supportedCurrencies: string[];
};
type RegionResponse = {
  regions: Record<string, RegionConfig>;
  supportedCurrencies: string[];
  supportedLocales: string[];
};
type RegionKey = NonNullable<Parameters<typeof userApi.updatePreferences>[0]['region']>;

const FALLBACK_LOCALE = 'en-AU';
const FALLBACK_CURRENCY = 'AUD';
const FALLBACK_REGION = 'ANZ';

const LANGUAGE_NAMES: Record<string, { name: string; nativeName: string; flag: string }> = {
  en: { name: 'English', nativeName: 'English', flag: '🌐' },
  'en-AU': { name: 'English (Australia)', nativeName: 'English', flag: '🇦🇺' },
  'en-NZ': { name: 'English (New Zealand)', nativeName: 'English', flag: '🇳🇿' },
  'en-GB': { name: 'English (UK)', nativeName: 'English', flag: '🇬🇧' },
  'en-IE': { name: 'English (Ireland)', nativeName: 'English', flag: '🇮🇪' },
  'en-US': { name: 'English (US)', nativeName: 'English', flag: '🇺🇸' },
  'en-SG': { name: 'English (Singapore)', nativeName: 'English', flag: '🇸🇬' },
  'en-PH': { name: 'English (Philippines)', nativeName: 'English', flag: '🇵🇭' },
  'en-AE': { name: 'English (UAE)', nativeName: 'English', flag: '🇦🇪' },
  'en-SA': { name: 'English (Saudi Arabia)', nativeName: 'English', flag: '🇸🇦' },
  'en-EG': { name: 'English (Egypt)', nativeName: 'English', flag: '🇪🇬' },
  'en-ZA': { name: 'English (South Africa)', nativeName: 'English', flag: '🇿🇦' },
  es: { name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  'es-MX': { name: 'Spanish (Mexico)', nativeName: 'Español', flag: '🇲🇽' },
  'es-US': { name: 'Spanish (US)', nativeName: 'Español', flag: '🇺🇸' },
  ar: { name: 'Arabic', nativeName: 'العربية', flag: '🌐' },
  'ar-AE': { name: 'Arabic (UAE)', nativeName: 'العربية', flag: '🇦🇪' },
  'ar-SA': { name: 'Arabic (Saudi Arabia)', nativeName: 'العربية', flag: '🇸🇦' },
  'ar-EG': { name: 'Arabic (Egypt)', nativeName: 'العربية', flag: '🇪🇬' },
  vi: { name: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳' },
  'vi-VN': { name: 'Vietnamese (Vietnam)', nativeName: 'Tiếng Việt', flag: '🇻🇳' },
};

const CURRENCY_NAMES: Record<string, string> = {
  AUD: 'Australian Dollar',
  NZD: 'New Zealand Dollar',
  USD: 'US Dollar',
  GBP: 'British Pound',
  EUR: 'Euro',
  SGD: 'Singapore Dollar',
  PHP: 'Philippine Peso',
  IDR: 'Indonesian Rupiah',
  THB: 'Thai Baht',
  VND: 'Vietnamese Dong',
  MYR: 'Malaysian Ringgit',
  AED: 'Emirati Dirham',
  SAR: 'Saudi Riyal',
  ZAR: 'South African Rand',
  EGP: 'Egyptian Pound',
  JPY: 'Japanese Yen',
  KRW: 'South Korean Won',
  INR: 'Indian Rupee',
  BRL: 'Brazilian Real',
  MXN: 'Mexican Peso',
};

const timezones = [
  { value: 'Australia/Brisbane', label: 'Brisbane (AEST)', offset: 'UTC+10' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)', offset: 'UTC+10/11' },
  { value: 'Australia/Melbourne', label: 'Melbourne (AEST/AEDT)', offset: 'UTC+10/11' },
  { value: 'Australia/Hobart', label: 'Hobart (AEST/AEDT)', offset: 'UTC+10/11' },
  { value: 'Australia/Adelaide', label: 'Adelaide (ACST/ACDT)', offset: 'UTC+9:30/10:30' },
  { value: 'Australia/Darwin', label: 'Darwin (ACST)', offset: 'UTC+9:30' },
  { value: 'Australia/Perth', label: 'Perth (AWST)', offset: 'UTC+8' },
  { value: 'Pacific/Auckland', label: 'Auckland (NZST/NZDT)', offset: 'UTC+12/13' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)', offset: 'UTC+8' },
  { value: 'Asia/Manila', label: 'Manila (PHT)', offset: 'UTC+8' },
  { value: 'Asia/Jakarta', label: 'Jakarta (WIB)', offset: 'UTC+7' },
  { value: 'Asia/Bangkok', label: 'Bangkok (ICT)', offset: 'UTC+7' },
  { value: 'Asia/Ho_Chi_Minh', label: 'Ho Chi Minh City (ICT)', offset: 'UTC+7' },
  { value: 'Asia/Kuala_Lumpur', label: 'Kuala Lumpur (MYT)', offset: 'UTC+8' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)', offset: 'UTC+9' },
  { value: 'Asia/Seoul', label: 'Seoul (KST)', offset: 'UTC+9' },
  { value: 'Asia/Kolkata', label: 'Kolkata (IST)', offset: 'UTC+5:30' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong (HKT)', offset: 'UTC+8' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)', offset: 'UTC+4' },
  { value: 'Asia/Riyadh', label: 'Riyadh (AST)', offset: 'UTC+3' },
  { value: 'Africa/Cairo', label: 'Cairo (EET)', offset: 'UTC+2' },
  { value: 'Africa/Johannesburg', label: 'Johannesburg (SAST)', offset: 'UTC+2' },
  { value: 'Europe/London', label: 'London (GMT/BST)', offset: 'UTC+0/1' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)', offset: 'UTC+1/2' },
  { value: 'America/New_York', label: 'New York (EST/EDT)', offset: 'UTC-5/-4' },
  { value: 'America/Chicago', label: 'Chicago (CST/CDT)', offset: 'UTC-6/-5' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT)', offset: 'UTC-8/-7' },
  { value: 'America/Sao_Paulo', label: 'São Paulo (BRT)', offset: 'UTC-3' },
  { value: 'America/Mexico_City', label: 'Mexico City (CST)', offset: 'UTC-6' },
];

const isEnglish = (code: string) => code === 'en' || code.startsWith('en-');
/** True for the languages the DOM translator carries a full dictionary for. */
const isTranslated = (code: string) => Object.prototype.hasOwnProperty.call(DICTIONARIES, code);

function describeLanguage(code: string) {
  const known = LANGUAGE_NAMES[code];
  if (known) return known;
  try {
    const name = new Intl.DisplayNames(['en'], { type: 'language' }).of(code);
    return { name: name || code, nativeName: code, flag: '🌐' };
  } catch {
    return { name: code, nativeName: code, flag: '🌐' };
  }
}

const errorMessage = (e: unknown) => {
  const data = (e as { response?: { data?: { message?: string; error?: string } } })?.response?.data;
  return data?.message || data?.error;
};

export default function LanguageSettingsPage() {
  const { user, updateUser } = useAuthStore();
  const [selectedLanguage, setSelectedLanguage] = useState(user?.preferredLocale || FALLBACK_LOCALE);
  const [selectedTimezone, setSelectedTimezone] = useState(user?.timezone || 'Australia/Brisbane');
  const [selectedCurrency, setSelectedCurrency] = useState((user?.preferredCurrency || FALLBACK_CURRENCY).toUpperCase());
  const [selectedRegion, setSelectedRegion] = useState<string>(user?.region || FALLBACK_REGION);
  const [isSaving, setIsSaving] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  const regionQuery = useQuery({
    queryKey: ['region-config'],
    queryFn: () => regionApi.get(),
    select: (r) => (r.data?.data ?? r.data) as RegionResponse,
    staleTime: 60 * 60 * 1000,
  });
  const config = regionQuery.data;

  useEffect(() => {
    setSelectedLanguage(user?.preferredLocale || getPreferredLocale());
    setSelectedCurrency((user?.preferredCurrency || getPreferredCurrency()).toUpperCase());
    if (user?.timezone) setSelectedTimezone(user.timezone);
    if (user?.region) setSelectedRegion(user.region);
    setIsHydrated(true);
  }, [user]);

  const regions = useMemo(() => (config ? Object.values(config.regions) : []), [config]);
  const region = config?.regions[selectedRegion] ?? regions[0];

  // Only choices that change something: English variants (dates, spelling)
  // and the languages carried in full. A saved locale outside that set stays
  // selectable so saving the page never silently changes it.
  const languages = useMemo(() => {
    if (!config) return [];
    const offered = config.supportedLocales.filter((code) => isEnglish(code) || isTranslated(code));
    const saved = user?.preferredLocale;
    if (saved && !offered.includes(saved) && config.supportedLocales.includes(saved)) offered.push(saved);
    const rank = (code: string) => (code === FALLBACK_LOCALE ? 0 : isEnglish(code) ? 1 : isTranslated(code) ? 2 : 3);
    return offered
      .map((code) => ({ code, ...describeLanguage(code), translated: isTranslated(code) }))
      .sort((a, b) => rank(a.code) - rank(b.code) || a.name.localeCompare(b.name));
  }, [config, user?.preferredLocale]);

  const currencies = region?.supportedCurrencies ?? [];

  // A region only takes its own currencies; when the region changes and the
  // current currency is not one of them, fall back to the region's default.
  useEffect(() => {
    if (!region) return;
    if (!region.supportedCurrencies.includes(selectedCurrency)) setSelectedCurrency(region.defaultCurrency);
  }, [region, selectedCurrency]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await userApi.updatePreferences({
        preferredLocale: selectedLanguage,
        preferredCurrency: selectedCurrency,
        timezone: selectedTimezone,
        region: selectedRegion as RegionKey,
      });

      updateUser(response.data.data);
      setStoredPreference('athena.locale', selectedLanguage);
      setStoredPreference('athena.currency', selectedCurrency);
      setStoredPreference('athena.timezone', selectedTimezone);
      setStoredPreference('athena.region', selectedRegion);
      setI18nLocale(selectedLanguage);
      translateDocument(selectedLanguage);
      toast.success('Saved');
    } catch (error) {
      toast.error(errorMessage(error) || 'That did not save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Language & Region</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Your language, your timezone, and the region that sets your currency</p>
      </div>

      {/* Language */}
      <div className="card">
        <div className="flex items-center space-x-2 mb-4">
          <Globe className="w-5 h-5 text-primary-500" />
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Language</h2>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          ATHENA is written in English and translated in full into Spanish, Arabic and Vietnamese. Another English variant changes how dates and times are shown.
        </p>

        {regionQuery.isLoading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-slate-500" role="status">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading the languages ATHENA offers…
          </div>
        ) : !config ? (
          <p className="py-4 text-sm text-slate-500">The list of languages could not be loaded. Please try again in a moment.</p>
        ) : (
          <div className="max-h-80 overflow-y-auto space-y-1" role="radiogroup" aria-label="Language">
            {languages.map((lang) => (
              <button
                key={lang.code}
                type="button"
                role="radio"
                aria-checked={selectedLanguage === lang.code}
                onClick={() => setSelectedLanguage(lang.code)}
                className={cn(
                  'w-full flex items-center justify-between p-3 rounded-lg transition',
                  selectedLanguage === lang.code
                    ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                )}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-lg" aria-hidden="true">{lang.flag}</span>
                  <div className="text-left">
                    <p className="font-medium text-slate-900 dark:text-white">{lang.name}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {lang.nativeName}
                      {lang.translated && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">Translated in full</span>}
                      {!lang.translated && !isEnglish(lang.code) && <span className="ml-2 text-xs text-slate-400">No translation yet</span>}
                    </p>
                  </div>
                </div>
                {selectedLanguage === lang.code && <Check className="w-5 h-5 text-primary-500" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Timezone */}
      <div className="card">
        <label htmlFor="timezone" className="block text-lg font-semibold text-slate-900 dark:text-white mb-2">Timezone</label>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Used for dates, reminders and bookings</p>
        <select
          id="timezone"
          value={selectedTimezone}
          onChange={(e) => setSelectedTimezone(e.target.value)}
          className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500"
        >
          {timezones.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label} ({tz.offset})
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2" suppressHydrationWarning>
          Current time:{' '}
          {isHydrated ? new Date().toLocaleTimeString(selectedLanguage, { timeZone: selectedTimezone }) : '--:--'}
        </p>
      </div>

      {/* Region */}
      <div className="card">
        <label htmlFor="region" className="block text-lg font-semibold text-slate-900 dark:text-white mb-2">Region</label>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Sets your currency and the privacy rules that apply to you. It does not change your language.</p>
        {config ? (
          <select
            id="region"
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500"
          >
            {regions.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-sm text-slate-500">Loading…</p>
        )}
      </div>

      {/* Currency */}
      <div className="card">
        <label htmlFor="currency" className="block text-lg font-semibold text-slate-900 dark:text-white mb-2">Currency</label>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Used for pricing, billing and earnings. Only the currencies your region bills in are offered.</p>
        {config ? (
          <select
            id="currency"
            value={selectedCurrency}
            onChange={(e) => setSelectedCurrency(e.target.value)}
            className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500"
          >
            {currencies.map((code) => (
              <option key={code} value={code}>
                {code}{CURRENCY_NAMES[code] ? ` — ${CURRENCY_NAMES[code]}` : ''}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-sm text-slate-500">Loading…</p>
        )}
      </div>

      <div className="card bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <div className="flex items-start space-x-3">
          <Info className="w-5 h-5 text-blue-500 mt-0.5" />
          <div>
            <p className="font-medium text-slate-900 dark:text-white">About translations</p>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
              Spanish, Arabic and Vietnamese are the community languages most spoken by women in Queensland after English, so those come first. If a phrase reads wrongly, tell us from the help centre and we will fix it.
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button type="button" onClick={handleSave} disabled={isSaving || !config} className="btn-primary px-8">
          {isSaving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}
