'use client';

import { useState, useEffect, useMemo } from 'react';
import { Cookie, ChevronDown, ChevronUp, Check, X, Settings, Shield } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface CookiePreferences {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
  functional: boolean;
}

interface CookieCategory {
  key: keyof CookiePreferences;
  title: string;
  description: string;
  required: boolean;
  cookies: { name: string; purpose: string; duration: string }[];
}

const COOKIE_CATEGORIES: CookieCategory[] = [
  {
    key: 'essential',
    title: 'Essential Cookies',
    description: 'Required for the website to function properly. Cannot be disabled.',
    required: true,
    cookies: [
      { name: 'session_id', purpose: 'Maintains your login session', duration: 'Session' },
      { name: 'csrf_token', purpose: 'Security token to prevent cross-site attacks', duration: 'Session' },
      { name: 'cookie_consent', purpose: 'Stores your cookie preferences', duration: '1 year' },
    ],
  },
  {
    key: 'analytics',
    title: 'Analytics Cookies',
    description: 'Help us understand how visitors interact with our website to improve user experience.',
    required: false,
    cookies: [
      { name: '_ga', purpose: 'Google Analytics - distinguishes users', duration: '2 years' },
      { name: '_gid', purpose: 'Google Analytics - distinguishes users', duration: '24 hours' },
      { name: 'athena_analytics', purpose: 'Internal analytics tracking', duration: '1 year' },
    ],
  },
  {
    key: 'marketing',
    title: 'Marketing Cookies',
    description: 'Used to track visitors across websites for advertising purposes.',
    required: false,
    cookies: [
      { name: '_fbp', purpose: 'Facebook Pixel - tracks conversions', duration: '3 months' },
      { name: 'ads_session', purpose: 'Advertising session tracking', duration: '30 days' },
    ],
  },
  {
    key: 'functional',
    title: 'Functional Cookies',
    description: 'Enable enhanced functionality and personalization such as remembering preferences.',
    required: false,
    cookies: [
      { name: 'locale', purpose: 'Remembers your language preference', duration: '1 year' },
      { name: 'theme', purpose: 'Remembers your theme preference (dark/light)', duration: '1 year' },
      { name: 'recent_searches', purpose: 'Stores recent search queries', duration: '30 days' },
    ],
  },
];

const VISITOR_ID_KEY = 'athena_visitor_id';
const CONSENT_KEY = 'athena_cookie_consent';

function getVisitorId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem(VISITOR_ID_KEY);
  if (!id) {
    id = uuidv4();
    localStorage.setItem(VISITOR_ID_KEY, id);
  }
  return id;
}

function getStoredConsent(): CookiePreferences | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(CONSENT_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

function setStoredConsent(prefs: CookiePreferences): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CONSENT_KEY, JSON.stringify(prefs));
}

export default function GranularCookieBanner() {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    essential: true,
    analytics: false,
    marketing: false,
    functional: false,
  });
  const [saving, setSaving] = useState(false);

  // Detect region from headers or stored preference
  const region = useMemo(() => {
    if (typeof window === 'undefined') return 'OTHER';
    return localStorage.getItem('athena.region') || 'OTHER';
  }, []);

  const isGDPRRegion = region === 'UK' || region === 'EU';

  useEffect(() => {
    const stored = getStoredConsent();
    if (!stored) {
      // Show banner for GDPR regions or first visit
      if (isGDPRRegion) {
        setVisible(true);
      }
    } else {
      setPreferences(stored);
    }
  }, [isGDPRRegion]);

  const savePreferences = async (prefs: CookiePreferences) => {
    setSaving(true);
    setStoredConsent(prefs);

    try {
      // Save to server
      const visitorId = getVisitorId();
      await fetch('/api/gdpr/cookies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          visitorId,
          ...prefs,
        }),
      });
    } catch (error) {
      console.error('Failed to save cookie preferences:', error);
    } finally {
      setSaving(false);
      setVisible(false);
    }
  };

  const acceptAll = () => {
    const allAccepted: CookiePreferences = {
      essential: true,
      analytics: true,
      marketing: true,
      functional: true,
    };
    setPreferences(allAccepted);
    savePreferences(allAccepted);
  };

  const rejectOptional = () => {
    const essentialOnly: CookiePreferences = {
      essential: true,
      analytics: false,
      marketing: false,
      functional: false,
    };
    setPreferences(essentialOnly);
    savePreferences(essentialOnly);
  };

  const saveCustom = () => {
    savePreferences(preferences);
  };

  const toggleCategory = (key: keyof CookiePreferences) => {
    if (key === 'essential') return; // Cannot toggle essential
    setPreferences(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (!visible) {
    // Floating settings button for users who want to update preferences
    return (
      <button
        onClick={() => setVisible(true)}
        className="fixed bottom-4 left-4 z-40 p-3 bg-white dark:bg-gray-800 rounded-full shadow-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition group"
        aria-label="Cookie Settings"
      >
        <Cookie className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-purple-600" />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setVisible(false)} />

      {/* Banner */}
      <div className="relative w-full max-w-2xl mx-4 mb-4 sm:mb-0 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
              <Shield className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Cookie Preferences</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Manage your privacy settings</p>
            </div>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            We use cookies and similar technologies to provide our services, understand how you use them, and improve your experience.
            {isGDPRRegion && ' Under GDPR, you have the right to accept or reject non-essential cookies.'}
          </p>
        </div>

        {/* Quick Actions */}
        {!showDetails && (
          <div className="p-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={rejectOptional}
                disabled={saving}
                className="flex-1 px-4 py-2.5 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750 transition"
              >
                Reject Optional
              </button>
              <button
                onClick={() => setShowDetails(true)}
                className="flex-1 px-4 py-2.5 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750 transition flex items-center justify-center gap-2"
              >
                <Settings className="w-4 h-4" />
                Customize
              </button>
              <button
                onClick={acceptAll}
                disabled={saving}
                className="flex-1 px-4 py-2.5 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
              >
                Accept All
              </button>
            </div>
          </div>
        )}

        {/* Detailed Settings */}
        {showDetails && (
          <div className="max-h-[60vh] overflow-y-auto">
            <div className="p-6 space-y-4">
              {COOKIE_CATEGORIES.map((category) => (
                <div key={category.key} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  {/* Category Header */}
                  <div
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-750 cursor-pointer"
                    onClick={() => setExpandedCategory(expandedCategory === category.key ? null : category.key)}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCategory(category.key);
                        }}
                        disabled={category.required}
                        className={`w-10 h-6 rounded-full relative transition ${
                          preferences[category.key]
                            ? 'bg-purple-600'
                            : 'bg-gray-300 dark:bg-gray-600'
                        } ${category.required ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        <span
                          className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                            preferences[category.key] ? 'translate-x-5' : 'translate-x-1'
                          }`}
                        />
                      </button>
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                          {category.title}
                          {category.required && (
                            <span className="text-xs bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded">
                              Required
                            </span>
                          )}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{category.description}</p>
                      </div>
                    </div>
                    {expandedCategory === category.key ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>

                  {/* Cookie Details */}
                  {expandedCategory === category.key && (
                    <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-500 dark:text-gray-400">
                            <th className="pb-2 font-medium">Cookie</th>
                            <th className="pb-2 font-medium">Purpose</th>
                            <th className="pb-2 font-medium">Duration</th>
                          </tr>
                        </thead>
                        <tbody className="text-gray-600 dark:text-gray-300">
                          {category.cookies.map((cookie) => (
                            <tr key={cookie.name} className="border-t border-gray-100 dark:border-gray-700">
                              <td className="py-2 font-mono text-xs">{cookie.name}</td>
                              <td className="py-2">{cookie.purpose}</td>
                              <td className="py-2 text-gray-400">{cookie.duration}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Save Button */}
            <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDetails(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 transition"
                >
                  Back
                </button>
                <button
                  onClick={saveCustom}
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>Saving...</>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Save Preferences
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer Links */}
        <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-750 flex justify-between text-xs text-gray-500 dark:text-gray-400">
          <a href="/privacy" className="hover:text-purple-600 transition">Privacy Policy</a>
          <a href="/cookies" className="hover:text-purple-600 transition">Cookie Policy</a>
          <a href="/privacy-center" className="hover:text-purple-600 transition">Privacy Center</a>
        </div>
      </div>
    </div>
  );
}
