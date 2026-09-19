/**
 * Cookie consent: the server ledger is the record, this browser is the cache.
 *
 * The banner used to write only localStorage and the legacy consent booleans on
 * the account, so the CookieConsent row and the ConsentRecord ledger that the
 * Privacy Center and consentService.hasConsent() read were never written by
 * the banner at all. These helpers send every choice to POST /api/gdpr/cookies
 * (which files it against the visitor cookie and, once signed in, the member's
 * ledger) and keep the localStorage keys only so the banner does not reopen on
 * every page while the request is in flight or the network is away.
 */

import { api } from './api';
import { getStoredPreference, setStoredPreference } from './utils';

export interface CookieChoices {
  analytics: boolean;
  functional: boolean;
  marketing: boolean;
}

export interface CookieConsentRecord extends CookieChoices {
  visitorId: string;
  essential: true;
  hasConsented: boolean;
  consentedAt: string | null;
}

/** The per-browser cache keys. `decided` is the one the banner opens on. */
export const COOKIE_CONSENT_CACHE_KEYS = {
  decided: 'athena.consentCookies',
  analytics: 'athena.consentAnalytics',
  functional: 'athena.consentFunctional',
  marketing: 'athena.consentMarketing',
  dataProcessing: 'athena.consentDataProcessing',
} as const;

type Envelope<T> = { success: boolean; data: T };

export const cookieConsentApi = {
  /** What this browser (or, once signed in, this member) has agreed to. */
  get: () => api.get('/gdpr/cookies') as Promise<{ data: Envelope<CookieConsentRecord> }>,
  /** Records the choice. The server answers with what it will actually honour. */
  save: (choices: CookieChoices) =>
    api.post('/gdpr/cookies', choices) as Promise<{ data: Envelope<CookieConsentRecord> }>,
};

/** The cached choice, or null when this browser has not decided yet. */
export function readCachedCookieChoices(): CookieChoices | null {
  if (!getStoredPreference(COOKIE_CONSENT_CACHE_KEYS.decided, '')) return null;
  return {
    analytics: getStoredPreference(COOKIE_CONSENT_CACHE_KEYS.analytics, 'false') === 'true',
    functional: getStoredPreference(COOKIE_CONSENT_CACHE_KEYS.functional, 'false') === 'true',
    marketing: getStoredPreference(COOKIE_CONSENT_CACHE_KEYS.marketing, 'false') === 'true',
  };
}

export function cacheCookieChoices(choices: CookieChoices): void {
  setStoredPreference(COOKIE_CONSENT_CACHE_KEYS.decided, 'true');
  setStoredPreference(COOKIE_CONSENT_CACHE_KEYS.analytics, String(choices.analytics));
  setStoredPreference(COOKIE_CONSENT_CACHE_KEYS.functional, String(choices.functional));
  setStoredPreference(COOKIE_CONSENT_CACHE_KEYS.marketing, String(choices.marketing));
  setStoredPreference(COOKIE_CONSENT_CACHE_KEYS.dataProcessing, 'true');
}

/**
 * Forgets the cached decision so the banner opens again on the next load. The
 * server record is left alone: it is replaced by whatever the member chooses
 * next, not blanked in between.
 */
export function clearCookieConsentCache(): void {
  if (typeof window === 'undefined') return;
  for (const key of Object.values(COOKIE_CONSENT_CACHE_KEYS)) {
    window.localStorage.removeItem(key);
  }
}
