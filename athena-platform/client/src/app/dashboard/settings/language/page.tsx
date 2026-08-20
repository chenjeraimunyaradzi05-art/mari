'use client';

import { useEffect, useState } from 'react';
import {
  Globe,
  Check,
  Search,
  Info,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn, getPreferredCurrency, getPreferredLocale, setStoredPreference } from '@/lib/utils';
import { useAuthStore } from '@/lib/store';
import { userApi } from '@/lib/api';
import { setI18nLocale } from '@/i18n/next-i18n';
import { translateDocument } from '@/i18n/domTranslator';

const languages = [
  { code: 'en', name: 'English', nativeName: 'English', region: 'Global' },
  { code: 'en-AU', name: 'English (Australia)', nativeName: 'English', region: 'Australia' },
  { code: 'en-GB', name: 'English (UK)', nativeName: 'English', region: 'United Kingdom' },
  { code: 'en-US', name: 'English (US)', nativeName: 'English', region: 'United States' },
  { code: 'en-SG', name: 'English (Singapore)', nativeName: 'English', region: 'Singapore' },
  { code: 'en-PH', name: 'English (Philippines)', nativeName: 'English', region: 'Philippines' },
  { code: 'en-AE', name: 'English (UAE)', nativeName: 'English', region: 'United Arab Emirates' },
  { code: 'en-SA', name: 'English (Saudi Arabia)', nativeName: 'English', region: 'Saudi Arabia' },
  { code: 'en-EG', name: 'English (Egypt)', nativeName: 'English', region: 'Egypt' },
  { code: 'en-ZA', name: 'English (South Africa)', nativeName: 'English', region: 'South Africa' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', region: 'Global' },
  { code: 'es-MX', name: 'Spanish (Mexico)', nativeName: 'Español', region: 'Mexico' },
  { code: 'es-US', name: 'Spanish (US)', nativeName: 'Español', region: 'United States' },
  { code: 'fr', name: 'French', nativeName: 'Français', region: 'Global' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', region: 'Germany' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', region: 'Global' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)', nativeName: 'Português', region: 'Brazil' },
  { code: 'zh', name: 'Chinese (Simplified)', nativeName: '简体中文', region: 'China' },
  { code: 'zh-TW', name: 'Chinese (Traditional)', nativeName: '繁體中文', region: 'Taiwan' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', region: 'Japan' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', region: 'South Korea' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', region: 'India' },
  { code: 'fil-PH', name: 'Filipino', nativeName: 'Filipino', region: 'Philippines' },
  { code: 'id-ID', name: 'Indonesian', nativeName: 'Bahasa Indonesia', region: 'Indonesia' },
  { code: 'th-TH', name: 'Thai', nativeName: 'ไทย', region: 'Thailand' },
  { code: 'vi-VN', name: 'Vietnamese', nativeName: 'Tiếng Việt', region: 'Vietnam' },
  { code: 'ms-MY', name: 'Malay', nativeName: 'Bahasa Melayu', region: 'Malaysia' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', region: 'Global' },
  { code: 'ar-AE', name: 'Arabic (UAE)', nativeName: 'العربية', region: 'United Arab Emirates' },
  { code: 'ar-SA', name: 'Arabic (Saudi Arabia)', nativeName: 'العربية', region: 'Saudi Arabia' },
  { code: 'ar-EG', name: 'Arabic (Egypt)', nativeName: 'العربية', region: 'Egypt' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', region: 'Netherlands' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', region: 'Italy' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', region: 'Russia' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', region: 'Poland' },
];

const timezones = [
  { value: 'Australia/Sydney', label: 'Sydney (AEST)', offset: 'UTC+10/11' },
  { value: 'Australia/Melbourne', label: 'Melbourne (AEST)', offset: 'UTC+10/11' },
  { value: 'Australia/Brisbane', label: 'Brisbane (AEST)', offset: 'UTC+10' },
  { value: 'Australia/Perth', label: 'Perth (AWST)', offset: 'UTC+8' },
  { value: 'Pacific/Auckland', label: 'Auckland (NZST)', offset: 'UTC+12/13' },
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
  { value: 'Europe/Paris', label: 'Paris (CET)', offset: 'UTC+1/2' },
  { value: 'America/New_York', label: 'New York (EST)', offset: 'UTC-5/-4' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PST)', offset: 'UTC-8/-7' },
  { value: 'America/Chicago', label: 'Chicago (CST)', offset: 'UTC-6/-5' },
  { value: 'America/Sao_Paulo', label: 'São Paulo (BRT)', offset: 'UTC-3' },
  { value: 'America/Mexico_City', label: 'Mexico City (CST)', offset: 'UTC-6/-5' },
];

const dateFormats = [
  { value: 'DD/MM/YYYY', label: '31/12/2024', description: 'Day/Month/Year' },
  { value: 'MM/DD/YYYY', label: '12/31/2024', description: 'Month/Day/Year' },
  { value: 'YYYY-MM-DD', label: '2024-12-31', description: 'Year-Month-Day (ISO)' },
];

const timeFormats = [
  { value: '12h', label: '2:30 PM', description: '12-hour clock' },
  { value: '24h', label: '14:30', description: '24-hour clock' },
];

const regions = [
  { value: 'ANZ', label: 'Australia / New Zealand' },
  { value: 'US', label: 'United States' },
  { value: 'UK', label: 'United Kingdom' },
  { value: 'EU', label: 'European Union' },
  { value: 'JP', label: 'Japan' },
  { value: 'KR', label: 'South Korea' },
  { value: 'IN', label: 'India' },
  { value: 'BR', label: 'Brazil' },
  { value: 'MX', label: 'Mexico' },
  { value: 'LATAM', label: 'LatAm' },
  { value: 'SEA', label: 'Southeast Asia' },
  { value: 'MEA', label: 'Middle East & Africa' },
  { value: 'ROW', label: 'Rest of World' },
];

const currencies = [
  { value: 'AUD', label: 'AUD — Australian Dollar' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'JPY', label: 'JPY — Japanese Yen' },
  { value: 'KRW', label: 'KRW — South Korean Won' },
  { value: 'INR', label: 'INR — Indian Rupee' },
  { value: 'BRL', label: 'BRL — Brazilian Real' },
  { value: 'MXN', label: 'MXN — Mexican Peso' },
  { value: 'SGD', label: 'SGD — Singapore Dollar' },
  { value: 'PHP', label: 'PHP — Philippine Peso' },
  { value: 'IDR', label: 'IDR — Indonesian Rupiah' },
  { value: 'THB', label: 'THB — Thai Baht' },
  { value: 'VND', label: 'VND — Vietnamese Dong' },
  { value: 'MYR', label: 'MYR — Malaysian Ringgit' },
  { value: 'NZD', label: 'NZD — New Zealand Dollar' },
  { value: 'AED', label: 'AED — Emirati Dirham' },
  { value: 'SAR', label: 'SAR — Saudi Riyal' },
  { value: 'ZAR', label: 'ZAR — South African Rand' },
  { value: 'EGP', label: 'EGP — Egyptian Pound' },
];

const FALLBACK_LOCALE = 'en-AU';
const FALLBACK_CURRENCY = 'AUD';

export default function LanguageSettingsPage() {
  const { user, updateUser } = useAuthStore();
  const [selectedLanguage, setSelectedLanguage] = useState(
    user?.preferredLocale || FALLBACK_LOCALE
  );
  const [selectedTimezone, setSelectedTimezone] = useState(
    user?.timezone || 'Australia/Sydney'
  );
  const [selectedCurrency, setSelectedCurrency] = useState(
    (user?.preferredCurrency || FALLBACK_CURRENCY).toUpperCase()
  );
  const [selectedRegion, setSelectedRegion] = useState<string>(user?.region || 'ANZ');
  const [selectedDateFormat, setSelectedDateFormat] = useState('DD/MM/YYYY');
  const [selectedTimeFormat, setSelectedTimeFormat] = useState('12h');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setSelectedLanguage(user?.preferredLocale || getPreferredLocale());
    setSelectedCurrency((user?.preferredCurrency || getPreferredCurrency()).toUpperCase());
    if (user?.timezone) setSelectedTimezone(user.timezone);
    if (user?.region) setSelectedRegion(user.region);
    setIsHydrated(true);
  }, [user]);

  const filteredLanguages = languages.filter(
    (lang) =>
      lang.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lang.nativeName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await userApi.updatePreferences({
        preferredLocale: selectedLanguage,
        preferredCurrency: selectedCurrency,
        timezone: selectedTimezone,
        region: selectedRegion as 'ANZ' | 'US' | 'SEA' | 'MEA' | 'UK' | 'EU' | 'ROW' | 'JP' | 'KR' | 'IN' | 'BR' | 'MX' | 'LATAM',
      });

      updateUser(response.data.data);
      setStoredPreference('athena.locale', selectedLanguage);
      setStoredPreference('athena.currency', selectedCurrency);
      setStoredPreference('athena.timezone', selectedTimezone);
      setStoredPreference('athena.region', selectedRegion);
      setI18nLocale(selectedLanguage);
      translateDocument(selectedLanguage);
      toast.success('Preferences updated');
    } catch {
      toast.error('Failed to update preferences');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Language & Region
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Set your preferred language, timezone, and date formats
        </p>
      </div>

      {/* Language Selection */}
      <div className="card">
        <div className="flex items-center space-x-2 mb-4">
          <Globe className="w-5 h-5 text-primary-500" />
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Language
          </h2>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Select the language for the ATHENA interface
        </p>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search languages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Language List */}
        <div className="max-h-64 overflow-y-auto space-y-1">
          {filteredLanguages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => setSelectedLanguage(lang.code)}
              className={cn(
                'w-full flex items-center justify-between p-3 rounded-lg transition',
                selectedLanguage === lang.code
                  ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800'
              )}
            >
              <div className="flex items-center space-x-3">
                <span className="text-lg">{getLanguageFlag(lang.code)}</span>
                <div className="text-left">
                  <p className="font-medium text-slate-900 dark:text-white">
                    {lang.name}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {lang.nativeName}
                  </p>
                </div>
              </div>
              {selectedLanguage === lang.code && (
                <Check className="w-5 h-5 text-primary-500" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Timezone */}
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Timezone
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Used for displaying dates and scheduling
        </p>
        <select
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
          {isHydrated
            ? new Date().toLocaleTimeString(selectedLanguage, { timeZone: selectedTimezone })
            : '--:--'}
        </p>
      </div>

      {/* Region */}
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Region
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Used for compliance defaults and regional experiences
        </p>
        <select
          value={selectedRegion}
          onChange={(e) => setSelectedRegion(e.target.value)}
          className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500"
        >
          {regions.map((region) => (
            <option key={region.value} value={region.value}>
              {region.label}
            </option>
          ))}
        </select>
      </div>

      {/* Currency */}
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Currency
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Used for pricing, billing, and earnings
        </p>
        <select
          value={selectedCurrency}
          onChange={(e) => setSelectedCurrency(e.target.value)}
          className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500"
        >
          {currencies.map((currency) => (
            <option key={currency.value} value={currency.value}>
              {currency.label}
            </option>
          ))}
        </select>
      </div>

      {/* Date Format */}
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Date Format
        </h2>
        <div className="space-y-3">
          {dateFormats.map((format) => (
            <button
              key={format.value}
              onClick={() => setSelectedDateFormat(format.value)}
              className={cn(
                'w-full flex items-center justify-between p-4 rounded-lg border-2 transition',
                selectedDateFormat === format.value
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              )}
            >
              <div className="text-left">
                <p className="font-medium text-slate-900 dark:text-white">
                  {format.label}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {format.description}
                </p>
              </div>
              {selectedDateFormat === format.value && (
                <Check className="w-5 h-5 text-primary-500" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Time Format */}
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Time Format
        </h2>
        <div className="grid grid-cols-2 gap-4">
          {timeFormats.map((format) => (
            <button
              key={format.value}
              onClick={() => setSelectedTimeFormat(format.value)}
              className={cn(
                'p-4 rounded-lg border-2 text-center transition',
                selectedTimeFormat === format.value
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              )}
            >
              <p className="text-xl font-semibold text-slate-900 dark:text-white mb-1">
                {format.label}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {format.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Info Box */}
      <div className="card bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <div className="flex items-start space-x-3">
          <Info className="w-5 h-5 text-blue-500 mt-0.5" />
          <div>
            <p className="font-medium text-slate-900 dark:text-white">
              Translation Notice
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
              Some content may not be fully translated in all languages. We're
              continuously improving our translations. If you notice any issues,
              please let us know.
            </p>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="btn-primary px-8"
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

// Helper function to get flag emoji
function getLanguageFlag(code: string): string {
  const flags: Record<string, string> = {
    'en': '🌐',
    'en-AU': '🇦🇺',
    'en-GB': '🇬🇧',
    'en-US': '🇺🇸',
    'en-SG': '🇸🇬',
    'en-PH': '🇵🇭',
    'es': '🇪🇸',
    'es-MX': '🇲🇽',
    'fr': '🇫🇷',
    'de': '🇩🇪',
    'pt': '🇵🇹',
    'pt-BR': '🇧🇷',
    'zh': '🇨🇳',
    'zh-TW': '🇹🇼',
    'ja': '🇯🇵',
    'ko': '🇰🇷',
    'hi': '🇮🇳',
    'fil-PH': '🇵🇭',
    'id-ID': '🇮🇩',
    'th-TH': '🇹🇭',
    'vi-VN': '🇻🇳',
    'ms-MY': '🇲🇾',
    'ar': '🇸🇦',
    'ar-AE': '🇦🇪',
    'ar-SA': '🇸🇦',
    'ar-EG': '🇪🇬',
    'nl': '🇳🇱',
    'it': '🇮🇹',
    'ru': '🇷🇺',
    'pl': '🇵🇱',
  };
  return flags[code] || '🌐';
}
