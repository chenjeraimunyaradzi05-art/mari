/**
 * GDPR Context Provider
 * Global state management for GDPR compliance
 * Phase 4: UK/EU Market Launch
 */

'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';

// Types
export interface CookiePreferences {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
  functional: boolean;
}

export interface GDPRContextType {
  // Cookie consent
  cookieConsent: CookiePreferences | null;
  showCookieBanner: boolean;
  acceptAllCookies: () => Promise<void>;
  rejectOptionalCookies: () => Promise<void>;
  saveCookiePreferences: (prefs: Omit<CookiePreferences, 'essential'>) => Promise<void>;
  openCookieSettings: () => void;
  closeCookieBanner: () => void;

  // Region detection
  userRegion: string | null;
  isGDPRRegion: boolean;
  isUKRegion: boolean;
  isEURegion: boolean;

  // Privacy mode
  privacyMode: boolean;
  setPrivacyMode: (enabled: boolean) => void;

  // Consent modal
  showConsentModal: boolean;
  openConsentModal: () => void;
  closeConsentModal: () => void;

  // Loading states
  isLoading: boolean;
}

const GDPRContext = createContext<GDPRContextType | undefined>(undefined);

const COOKIE_CONSENT_KEY = 'athena_cookie_consent';
const PRIVACY_MODE_KEY = 'athena_privacy_mode';
const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000').replace(/\/$/, '');

// EU/EEA country codes
const EU_COUNTRIES = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'IS', 'LI', 'NO'
];

interface GDPRProviderProps {
  children: ReactNode;
}

export function GDPRProvider({ children }: GDPRProviderProps) {
  const [cookieConsent, setCookieConsent] = useState<CookiePreferences | null>(null);
  const [showCookieBanner, setShowCookieBanner] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [userRegion, setUserRegion] = useState<string | null>(null);
  const [privacyMode, setPrivacyModeState] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Computed region flags
  const isUKRegion = userRegion === 'UK' || userRegion === 'GB';
  const isEURegion = userRegion !== null && EU_COUNTRIES.includes(userRegion);
  const isGDPRRegion = isUKRegion || isEURegion;

  // Get visitor ID for anonymous cookie tracking
  const getVisitorId = useCallback(() => {
    if (typeof window === 'undefined') return '';
    
    let visitorId = localStorage.getItem('athena_visitor_id');
    if (!visitorId) {
      visitorId = `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('athena_visitor_id', visitorId);
    }
    return visitorId;
  }, []);

  // Detect user region from timezone and locale
  const detectRegion = useCallback(() => {
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const locale = navigator.language;

      // Check timezone
      if (timezone.startsWith('Europe/London') || timezone === 'GB') {
        return 'UK';
      } else if (timezone.startsWith('Europe/')) {
        // Try to get specific country from locale
        const countryCode = locale.split('-')[1]?.toUpperCase();
        if (countryCode && EU_COUNTRIES.includes(countryCode)) {
          return countryCode;
        }
        return 'EU';
      } else if (timezone.startsWith('America/')) {
        return 'US';
      } else if (timezone.startsWith('Australia/') || timezone.startsWith('Pacific/Auckland')) {
        return 'ANZ';
      }

      // Fallback to locale
      const countryCode = locale.split('-')[1]?.toUpperCase();
      if (countryCode === 'GB' || countryCode === 'UK') return 'UK';
      if (countryCode && EU_COUNTRIES.includes(countryCode)) return countryCode;
      if (countryCode === 'US') return 'US';
      if (countryCode === 'AU' || countryCode === 'NZ') return 'ANZ';

      return 'ANZ'; // Default
    } catch {
      return 'ANZ';
    }
  }, []);

  // Load saved preferences on mount
  useEffect(() => {
    const loadSavedPreferences = async () => {
      try {
        // Detect region
        const region = detectRegion();
        setUserRegion(region);

        // Load cookie consent from localStorage
        const savedConsent = localStorage.getItem(COOKIE_CONSENT_KEY);
        if (savedConsent) {
          const parsed = JSON.parse(savedConsent);
          setCookieConsent(parsed);
          applyConsentToAnalytics(parsed);
        } else {
          // Show banner for GDPR regions
          const isGDPR = region === 'UK' || region === 'GB' || EU_COUNTRIES.includes(region);
          setShowCookieBanner(isGDPR);
        }

        // Load privacy mode
        const savedPrivacyMode = localStorage.getItem(PRIVACY_MODE_KEY);
        if (savedPrivacyMode) {
          setPrivacyModeState(savedPrivacyMode === 'true');
        }
      } catch (err) {
        console.error('Failed to load GDPR preferences:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadSavedPreferences();
  }, [detectRegion]);

  // Apply consent to third-party analytics
  const applyConsentToAnalytics = (prefs: CookiePreferences) => {
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

    // Disable tracking if analytics not consented
    if (!prefs.analytics) {
      // Disable GA
      win['ga-disable-GA_MEASUREMENT_ID'] = true;
    }

    // Facebook Pixel
    if (win.fbq && !prefs.marketing) {
      win.fbq('consent', 'revoke');
    }
  };

  // Save cookie preferences
  const saveCookiePreferences = useCallback(
    async (prefs: Omit<CookiePreferences, 'essential'>) => {
      const fullPrefs: CookiePreferences = {
        essential: true, // Always required
        ...prefs,
      };

      // Save to localStorage
      localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(fullPrefs));
      setCookieConsent(fullPrefs);
      setShowCookieBanner(false);
      setShowConsentModal(false);

      // Apply to analytics
      applyConsentToAnalytics(fullPrefs);

      // Save to server for logged-in users
      try {
        const visitorId = getVisitorId();
        await fetch(`${API_BASE}/api/gdpr/cookies`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            visitorId,
            ...prefs,
          }),
        });
      } catch (err) {
        console.error('Failed to save cookie consent to server:', err);
      }
    },
    [getVisitorId]
  );

  // Accept all cookies
  const acceptAllCookies = useCallback(async () => {
    await saveCookiePreferences({
      analytics: true,
      marketing: true,
      functional: true,
    });
  }, [saveCookiePreferences]);

  // Reject optional cookies
  const rejectOptionalCookies = useCallback(async () => {
    await saveCookiePreferences({
      analytics: false,
      marketing: false,
      functional: false,
    });
  }, [saveCookiePreferences]);

  // Open cookie settings modal
  const openCookieSettings = useCallback(() => {
    setShowConsentModal(true);
  }, []);

  // Close cookie banner
  const closeCookieBanner = useCallback(() => {
    setShowCookieBanner(false);
  }, []);

  // Open consent modal
  const openConsentModal = useCallback(() => {
    setShowConsentModal(true);
  }, []);

  // Close consent modal
  const closeConsentModal = useCallback(() => {
    setShowConsentModal(false);
  }, []);

  // Set privacy mode
  const setPrivacyMode = useCallback((enabled: boolean) => {
    setPrivacyModeState(enabled);
    localStorage.setItem(PRIVACY_MODE_KEY, enabled.toString());

    // If privacy mode enabled, revoke optional cookies
    if (enabled && cookieConsent) {
      saveCookiePreferences({
        analytics: false,
        marketing: false,
        functional: false,
      });
    }
  }, [cookieConsent, saveCookiePreferences]);

  const value: GDPRContextType = {
    cookieConsent,
    showCookieBanner,
    acceptAllCookies,
    rejectOptionalCookies,
    saveCookiePreferences,
    openCookieSettings,
    closeCookieBanner,
    userRegion,
    isGDPRRegion,
    isUKRegion,
    isEURegion,
    privacyMode,
    setPrivacyMode,
    showConsentModal,
    openConsentModal,
    closeConsentModal,
    isLoading,
  };

  return <GDPRContext.Provider value={value}>{children}</GDPRContext.Provider>;
}

export function useGDPRContext() {
  const context = useContext(GDPRContext);
  if (context === undefined) {
    throw new Error('useGDPRContext must be used within a GDPRProvider');
  }
  return context;
}

export default GDPRContext;
