'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { userApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { getStoredPreference, setStoredPreference } from '@/lib/utils';

const CONSENT_KEY = 'athena.cookieConsent';

type ConsentState = {
  consentMarketing: boolean;
  consentDataProcessing: boolean;
  consentCookies: boolean;
  consentDoNotSell: boolean;
  updatedAt: string;
};

function getStoredConsent(): ConsentState | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(CONSENT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ConsentState;
  } catch {
    return null;
  }
}

function setStoredConsent(value: ConsentState) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CONSENT_KEY, JSON.stringify(value));
}

export default function CookieBanner() {
  const { isAuthenticated } = useAuthStore();
  const [visible, setVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const region = useMemo(() => getStoredPreference('athena.region', 'ANZ'), []);
  const isUkEu = region === 'UK' || region === 'EU';
  const isUs = region === 'US';

  useEffect(() => {
    const stored = getStoredConsent();
    if (!stored && (isUkEu || isUs)) {
      setVisible(true);
    }
  }, [isUkEu, isUs]);

  const saveConsent = async (values: Omit<ConsentState, 'updatedAt'>) => {
    const payload: ConsentState = {
      ...values,
      updatedAt: new Date().toISOString(),
    };

    setStoredConsent(payload);
    setStoredPreference('athena.consentUpdatedAt', payload.updatedAt);

    if (isAuthenticated) {
      try {
        setIsSaving(true);
        await userApi.updateConsents(values);
      } finally {
        setIsSaving(false);
      }
    }

    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 shadow-lg">
      <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Privacy & Cookies</h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 max-w-2xl">
            We use cookies to operate the platform, improve experiences, and measure performance. You can accept all cookies or reject optional ones.
          </p>
          {isUs && (
            <p className="text-[11px] text-gray-500 mt-1">
              California residents: You can opt out of certain data sharing at any time.
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={() => saveConsent({
              consentMarketing: false,
              consentDataProcessing: true,
              consentCookies: false,
              consentDoNotSell: isUs,
            })}
            className="px-4 py-2 text-xs font-semibold border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-200"
            disabled={isSaving}
          >
            Reject optional
          </button>
          <button
            type="button"
            onClick={() => saveConsent({
              consentMarketing: true,
              consentDataProcessing: true,
              consentCookies: true,
              consentDoNotSell: false,
            })}
            className="px-4 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-lg"
            disabled={isSaving}
          >
            Accept all
          </button>
          <Link
            href={isAuthenticated ? '/dashboard/settings/privacy' : '/cookies'}
            className="px-4 py-2 text-xs font-semibold text-primary-600 dark:text-primary-400"
          >
            Manage in Settings
          </Link>
        </div>
      </div>
    </div>
  );
}
