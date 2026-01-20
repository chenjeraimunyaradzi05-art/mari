/**
 * Cookie Consent Banner Component
 * GDPR/UK GDPR Compliance
 * Phase 4: UK/EU Market Launch
 */

'use client';

import { useState, useEffect } from 'react';
import { X, Cookie, Shield, Settings, Check } from 'lucide-react';
import Link from 'next/link';

interface CookiePreferences {
  essential: boolean;
  analytics: boolean;
  functional: boolean;
  marketing: boolean;
}

const COOKIE_CONSENT_KEY = 'athena_cookie_consent';

export function CookieConsentBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    essential: true,
    analytics: false,
    functional: false,
    marketing: false,
  });

  useEffect(() => {
    // Check if user has already consented
    const savedConsent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!savedConsent) {
      // Delay showing banner for better UX
      const timer = setTimeout(() => setShowBanner(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const savePreferences = (prefs: CookiePreferences) => {
    const consentData = {
      ...prefs,
      consentedAt: new Date().toISOString(),
      version: '1.0',
    };
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(consentData));
    setShowBanner(false);

    // Apply preferences to analytics services
    applyConsentToServices(prefs);

    // Optionally send to server for audit
    sendConsentToServer(consentData);
  };

  const acceptAll = () => {
    const allAccepted: CookiePreferences = {
      essential: true,
      analytics: true,
      functional: true,
      marketing: true,
    };
    setPreferences(allAccepted);
    savePreferences(allAccepted);
  };

  const rejectOptional = () => {
    const essentialOnly: CookiePreferences = {
      essential: true,
      analytics: false,
      functional: false,
      marketing: false,
    };
    setPreferences(essentialOnly);
    savePreferences(essentialOnly);
  };

  const saveCustomPreferences = () => {
    savePreferences(preferences);
  };

  const applyConsentToServices = (prefs: CookiePreferences) => {
    if (typeof window === 'undefined') return;

    const win = window as Window & {
      gtag?: (...args: unknown[]) => void;
      fbq?: (...args: unknown[]) => void;
      'ga-disable-GA_MEASUREMENT_ID'?: boolean;
    };

    // Google Analytics
    if (win.gtag) {
      win.gtag('consent', 'update', {
        analytics_storage: prefs.analytics ? 'granted' : 'denied',
        ad_storage: prefs.marketing ? 'granted' : 'denied',
        functionality_storage: prefs.functional ? 'granted' : 'denied',
        personalization_storage: prefs.functional ? 'granted' : 'denied',
      });
    }

    // Disable GA if analytics not consented
    if (!prefs.analytics) {
      win['ga-disable-GA_MEASUREMENT_ID'] = true;
    }

    // Facebook Pixel
    if (win.fbq && !prefs.marketing) {
      win.fbq('consent', 'revoke');
    }
  };

  const sendConsentToServer = async (consentData: CookiePreferences & { consentedAt: string; version: string }) => {
    try {
      const visitorId = localStorage.getItem('athena_visitor_id') || 
        `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('athena_visitor_id', visitorId);

      await fetch('/api/gdpr/cookies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitorId, ...consentData }),
      });
    } catch {
      // Silently fail - consent is already saved locally
      console.debug('Could not send consent to server');
    }
  };

  if (!showBanner) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Cookie className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Cookie Preferences</h2>
              <p className="text-sm text-purple-100">We value your privacy</p>
            </div>
          </div>
          <button
            onClick={rejectOptional}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            We use cookies to enhance your experience, analyse site traffic, and for marketing purposes. 
            You can choose which cookies you&apos;d like to accept.
          </p>

          {/* Quick Actions */}
          {!showDetails && (
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <button
                onClick={acceptAll}
                className="flex-1 py-3 px-4 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
              >
                <Check className="w-5 h-5" />
                Accept All
              </button>
              <button
                onClick={rejectOptional}
                className="flex-1 py-3 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Essential Only
              </button>
              <button
                onClick={() => setShowDetails(true)}
                className="flex-1 py-3 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
              >
                <Settings className="w-5 h-5" />
                Customise
              </button>
            </div>
          )}

          {/* Detailed Preferences */}
          {showDetails && (
            <div className="space-y-4 mb-4">
              {/* Essential */}
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-green-600" />
                    <span className="font-semibold text-gray-900 dark:text-white">Essential</span>
                  </div>
                  <span className="text-sm text-green-600 font-medium">Always Active</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Required for the website to function. Cannot be disabled.
                </p>
              </div>

              {/* Analytics */}
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.analytics}
                        onChange={(e) => setPreferences(p => ({ ...p, analytics: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                    <span className="font-semibold text-gray-900 dark:text-white">Analytics</span>
                  </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Help us understand how visitors interact with our website to improve our services.
                </p>
              </div>

              {/* Functional */}
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.functional}
                        onChange={(e) => setPreferences(p => ({ ...p, functional: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                    <span className="font-semibold text-gray-900 dark:text-white">Functional</span>
                  </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Enable enhanced functionality like remembering your preferences.
                </p>
              </div>

              {/* Marketing */}
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.marketing}
                        onChange={(e) => setPreferences(p => ({ ...p, marketing: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                    <span className="font-semibold text-gray-900 dark:text-white">Marketing</span>
                  </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Used to deliver relevant advertisements and measure campaign effectiveness.
                </p>
              </div>

              {/* Save Button */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDetails(false)}
                  className="flex-1 py-3 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={saveCustomPreferences}
                  className="flex-1 py-3 px-4 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Save Preferences
                </button>
              </div>
            </div>
          )}

          {/* Links */}
          <div className="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Link href="/cookies" className="hover:text-purple-600 transition-colors">
              Cookie Policy
            </Link>
            <Link href="/privacy" className="hover:text-purple-600 transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-purple-600 transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CookieConsentBanner;
