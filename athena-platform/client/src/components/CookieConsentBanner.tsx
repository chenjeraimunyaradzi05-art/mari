'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Cookie, Shield, Settings, Check, X } from 'lucide-react';
import { getPreferredLocale, getStoredPreference, setStoredPreference } from '@/lib/utils';
import { getMessages } from '@/i18n/messages';
import { userApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

const CONSENT_KEY = 'athena.consentCookies';
const CONSENT_MARKETING_KEY = 'athena.consentMarketing';
const CONSENT_ANALYTICS_KEY = 'athena.consentAnalytics';
const CONSENT_FUNCTIONAL_KEY = 'athena.consentFunctional';
const CONSENT_DATA_KEY = 'athena.consentDataProcessing';

interface CookiePreferences {
  essential: boolean;
  analytics: boolean;
  functional: boolean;
  marketing: boolean;
}

export default function CookieConsentBanner() {
  const { user } = useAuthStore();
  const locale = getPreferredLocale();
  const messages = useMemo(() => getMessages(locale), [locale]);
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [region, setRegion] = useState(getStoredPreference('athena.region', 'ANZ'));
  const [preferences, setPreferences] = useState<CookiePreferences>({
    essential: true,
    analytics: false,
    functional: false,
    marketing: false,
  });

  // Check if in GDPR region (UK/EU)
  const isGDPRRegion = region === 'UK' || region === 'EU';

  useEffect(() => {
    const consent = getStoredPreference(CONSENT_KEY, '');
    if (!consent) {
      // Small delay for better UX
      const timer = setTimeout(() => setVisible(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    setRegion(getStoredPreference('athena.region', user?.region || 'ANZ'));
  }, [user]);

  const persistConsents = async (prefs: CookiePreferences) => {
    setStoredPreference(CONSENT_KEY, 'true');
    setStoredPreference(CONSENT_ANALYTICS_KEY, String(prefs.analytics));
    setStoredPreference(CONSENT_FUNCTIONAL_KEY, String(prefs.functional));
    setStoredPreference(CONSENT_MARKETING_KEY, String(prefs.marketing));
    setStoredPreference(CONSENT_DATA_KEY, 'true');

    // Apply to analytics services
    applyConsentToServices(prefs);

    if (user?.id) {
      await userApi.updateConsents({
        consentCookies: true,
        consentMarketing: prefs.marketing,
        consentDataProcessing: true,
      });
    }
  };

  const applyConsentToServices = (prefs: CookiePreferences) => {
    if (typeof window === 'undefined') return;

    const win = window as Window & {
      gtag?: (...args: unknown[]) => void;
      fbq?: (...args: unknown[]) => void;
      'ga-disable-GA_MEASUREMENT_ID'?: boolean;
    };

    // Google Analytics consent mode
    if (win.gtag) {
      win.gtag('consent', 'update', {
        analytics_storage: prefs.analytics ? 'granted' : 'denied',
        ad_storage: prefs.marketing ? 'granted' : 'denied',
        functionality_storage: prefs.functional ? 'granted' : 'denied',
        personalization_storage: prefs.functional ? 'granted' : 'denied',
      });
    }

    if (!prefs.analytics) {
      win['ga-disable-GA_MEASUREMENT_ID'] = true;
    }

    // Facebook Pixel
    if (win.fbq && !prefs.marketing) {
      win.fbq('consent', 'revoke');
    }
  };

  const handleAcceptAll = async () => {
    const allAccepted: CookiePreferences = {
      essential: true,
      analytics: true,
      functional: true,
      marketing: true,
    };
    setPreferences(allAccepted);
    await persistConsents(allAccepted);
    setVisible(false);
  };

  const handleRejectOptional = async () => {
    const essentialOnly: CookiePreferences = {
      essential: true,
      analytics: false,
      functional: false,
      marketing: false,
    };
    setPreferences(essentialOnly);
    await persistConsents(essentialOnly);
    setVisible(false);
  };

  const handleSavePreferences = async () => {
    await persistConsents(preferences);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4 sm:bottom-4 sm:left-4 sm:right-auto sm:max-w-lg">
      <div className="rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cookie className="w-5 h-5 text-white" />
            <span className="font-semibold text-white">{messages['cookie.title'] || 'Cookie Preferences'}</span>
          </div>
          <button
            onClick={handleRejectOptional}
            className="p-1 hover:bg-white/10 rounded transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {!showDetails ? (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {messages['cookie.description'] || 'We use cookies to enhance your experience. Choose your preferences.'}
              </p>

              {region === 'US' && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {messages['cookie.ccpaNotice'] || 'California residents: See our Privacy Policy for CCPA details.'}
                </p>
              )}

              {isGDPRRegion && (
                <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  Protected under {region === 'UK' ? 'UK GDPR' : 'EU GDPR'}
                </p>
              )}

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  className="flex-1 px-4 py-2.5 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
                  onClick={handleAcceptAll}
                >
                  <Check className="w-4 h-4" />
                  {messages['cookie.acceptAll'] || 'Accept All'}
                </button>
                <button
                  className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  onClick={handleRejectOptional}
                >
                  {messages['cookie.rejectOptional'] || 'Essential Only'}
                </button>
              </div>

              <button
                onClick={() => setShowDetails(true)}
                className="w-full text-sm text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 flex items-center justify-center gap-1"
              >
                <Settings className="w-4 h-4" />
                {messages['cookie.manage'] || 'Customise preferences'}
              </button>
            </>
          ) : (
            <>
              {/* Essential - Always on */}
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900 dark:text-white">Essential</span>
                  <span className="text-xs text-green-600 font-medium">Always Active</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Required for the site to function</p>
              </div>

              {/* Analytics */}
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900 dark:text-white">Analytics</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.analytics}
                      onChange={(e) => setPreferences(p => ({ ...p, analytics: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-300 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Help us improve with usage data</p>
              </div>

              {/* Functional */}
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900 dark:text-white">Functional</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.functional}
                      onChange={(e) => setPreferences(p => ({ ...p, functional: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-300 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Remember your preferences</p>
              </div>

              {/* Marketing */}
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900 dark:text-white">Marketing</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.marketing}
                      onChange={(e) => setPreferences(p => ({ ...p, marketing: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-300 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Personalised ads and marketing</p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowDetails(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleSavePreferences}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Save Preferences
                </button>
              </div>
            </>
          )}

          {/* Footer Links */}
          <div className="flex gap-4 pt-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
            <Link href="/cookies" className="hover:text-purple-600 transition-colors">
              Cookie Policy
            </Link>
            <Link href="/privacy" className="hover:text-purple-600 transition-colors">
              Privacy
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
