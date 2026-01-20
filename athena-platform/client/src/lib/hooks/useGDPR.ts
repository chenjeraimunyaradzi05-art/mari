/**
 * GDPR Compliance Hooks
 * React hooks for GDPR functionality
 * Phase 4: UK/EU Market Launch
 */

import { useState, useEffect, useCallback } from 'react';
import { getAccessToken } from '@/lib/auth';

// Types
export interface ConsentState {
  marketing_email: boolean;
  marketing_sms: boolean;
  marketing_push: boolean;
  analytics: boolean;
  personalization: boolean;
  third_party_sharing: boolean;
  profiling: boolean;
  automated_decisions: boolean;
  research: boolean;
  product_updates: boolean;
  newsletter: boolean;
}

export interface CookieConsent {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
  functional: boolean;
  hasConsented: boolean;
  consentedAt?: string;
}

export interface DSARRequest {
  id: string;
  type: 'EXPORT' | 'DELETION' | 'RECTIFICATION' | 'RESTRICTION' | 'PORTABILITY';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';
  createdAt: string;
  dueDate: string;
  completedAt?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

/**
 * Hook for managing user consent preferences
 */
export function useConsent() {
  const [consents, setConsents] = useState<ConsentState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch current consents
  const fetchConsents = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/gdpr/consents`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch consents');

      const data = await response.json();
      setConsents(data.data);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Update a single consent
  const updateConsent = useCallback(
    async (type: keyof ConsentState, granted: boolean) => {
      const token = getAccessToken();
      if (!token) return;

      try {
        const response = await fetch(`${API_BASE}/api/gdpr/consents/${type}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ granted }),
        });

        if (!response.ok) throw new Error('Failed to update consent');

        // Update local state
        setConsents((prev) =>
          prev ? { ...prev, [type]: granted } : null
        );

        return true;
      } catch (consentUpdateError) {
        setError(consentUpdateError instanceof Error ? consentUpdateError.message : 'Unknown error');
        return false;
      }
    },
    []
  );

  // Bulk update consents
  const updateConsents = useCallback(
    async (updates: Array<{ type: keyof ConsentState; granted: boolean }>) => {
      const token = getAccessToken();
      if (!token) return;

      try {
        const response = await fetch(`${API_BASE}/api/gdpr/consents`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ consents: updates }),
        });

        if (!response.ok) throw new Error('Failed to update consents');

        // Refresh consents
        await fetchConsents();
        return true;
      } catch (bulkUpdateError) {
        setError(bulkUpdateError instanceof Error ? bulkUpdateError.message : 'Unknown error');
        return false;
      }
    },
    [fetchConsents]
  );

  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      fetchConsents();
    }
  }, [fetchConsents]);

  return {
    consents,
    loading,
    error,
    updateConsent,
    updateConsents,
    refetch: fetchConsents,
  };
}

/**
 * Hook for managing cookie consent
 */
export function useCookieConsent() {
  const [consent, setConsent] = useState<CookieConsent | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  // Get or create visitor ID
  const getVisitorId = useCallback(() => {
    let visitorId = localStorage.getItem('athena_visitor_id');
    if (!visitorId) {
      visitorId = `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('athena_visitor_id', visitorId);
    }
    return visitorId;
  }, []);

  // Fetch cookie consent
  const fetchCookieConsent = useCallback(async () => {
    const visitorId = getVisitorId();

    try {
      const response = await fetch(`${API_BASE}/api/gdpr/cookies/${visitorId}`);
      if (!response.ok) throw new Error('Failed to fetch cookie consent');

      const data = await response.json();
      setConsent(data.data);
      setShowBanner(!data.data.hasConsented);
    } catch {
      // Default state if fetch fails
      setConsent({
        essential: true,
        analytics: false,
        marketing: false,
        functional: false,
        hasConsented: false,
      });
      setShowBanner(true);
    }
  }, [getVisitorId]);

  // Save cookie consent
  const saveCookieConsent = useCallback(
    async (preferences: Omit<CookieConsent, 'essential' | 'hasConsented' | 'consentedAt'>) => {
      const visitorId = getVisitorId();

      try {
        const response = await fetch(`${API_BASE}/api/gdpr/cookies`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            visitorId,
            ...preferences,
          }),
        });

        if (!response.ok) throw new Error('Failed to save cookie consent');

        // Successfully saved to server
        await response.json();
        setConsent({
          ...preferences,
          essential: true,
          hasConsented: true,
          consentedAt: new Date().toISOString(),
        });
        setShowBanner(false);

        // Apply consent to analytics
        applyConsentToAnalytics(preferences);

        return true;
      } catch (err) {
        console.error('Failed to save cookie consent:', err);
        return false;
      }
    },
    [getVisitorId]
  );

  // Accept all cookies
  const acceptAll = useCallback(() => {
    return saveCookieConsent({
      analytics: true,
      marketing: true,
      functional: true,
    });
  }, [saveCookieConsent]);

  // Reject optional cookies
  const rejectOptional = useCallback(() => {
    return saveCookieConsent({
      analytics: false,
      marketing: false,
      functional: false,
    });
  }, [saveCookieConsent]);

  // Apply consent to third-party analytics
  const applyConsentToAnalytics = (preferences: { analytics: boolean; marketing: boolean }) => {
    // Google Analytics
    if (typeof window !== 'undefined') {
      const win = window as Window & { gtag?: (...args: unknown[]) => void; fbq?: (...args: unknown[]) => void };
      if (win.gtag) {
        win.gtag('consent', 'update', {
          analytics_storage: preferences.analytics ? 'granted' : 'denied',
          ad_storage: preferences.marketing ? 'granted' : 'denied',
        });
      }

      // Facebook Pixel
      if (win.fbq && !preferences.marketing) {
        win.fbq('consent', 'revoke');
      }
    }
  };

  useEffect(() => {
    fetchCookieConsent();
  }, [fetchCookieConsent]);

  return {
    consent,
    showBanner,
    setShowBanner,
    saveCookieConsent,
    acceptAll,
    rejectOptional,
    refetch: fetchCookieConsent,
  };
}

/**
 * Hook for managing DSAR (Data Subject Access Request) requests
 */
export function useDSAR() {
  const [requests, setRequests] = useState<DSARRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch DSAR history
  const fetchRequests = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/gdpr/dsar`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch DSAR requests');

      const data = await response.json();
      setRequests(data.data);
    } catch (fetchErr) {
      setError(fetchErr instanceof Error ? fetchErr.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Request data export
  const requestExport = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return null;

    try {
      const response = await fetch(`${API_BASE}/api/gdpr/dsar/export`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to request data export');

      const data = await response.json();
      await fetchRequests();
      return data.data;
    } catch (exportErr) {
      setError(exportErr instanceof Error ? exportErr.message : 'Unknown error');
      return null;
    }
  }, [fetchRequests]);

  // Request account deletion
  const requestDeletion = useCallback(
    async (confirmation: string, reason?: string) => {
      const token = getAccessToken();
      if (!token) return null;

      try {
        const response = await fetch(`${API_BASE}/api/gdpr/dsar/delete`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ confirmation, reason }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to request deletion');
        }

        const data = await response.json();
        await fetchRequests();
        return data.data;
      } catch (deleteErr) {
        setError(deleteErr instanceof Error ? deleteErr.message : 'Unknown error');
        return null;
      }
    },
    [fetchRequests]
  );

  // Request data rectification
  const requestRectification = useCallback(
    async (corrections: Record<string, unknown>) => {
      const token = getAccessToken();
      if (!token) return null;

      try {
        const response = await fetch(`${API_BASE}/api/gdpr/dsar/rectify`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ corrections }),
        });

        if (!response.ok) throw new Error('Failed to request rectification');

        const data = await response.json();
        await fetchRequests();
        return data.data;
      } catch (rectifyErr) {
        setError(rectifyErr instanceof Error ? rectifyErr.message : 'Unknown error');
        return null;
      }
    },
    [fetchRequests]
  );

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  return {
    requests,
    loading,
    error,
    requestExport,
    requestDeletion,
    requestRectification,
    refetch: fetchRequests,
  };
}

/**
 * Hook for detecting user's region
 */
export function useRegion() {
  const [region, setRegion] = useState<string | null>(null);
  const [isGDPRRegion, setIsGDPRRegion] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const detectRegion = async () => {
      try {
        // Try to get region from timezone
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        
        // Map timezone to region
        let detectedRegion = 'ANZ';
        if (timezone.startsWith('Europe/London') || timezone === 'GB') {
          detectedRegion = 'UK';
        } else if (timezone.startsWith('Europe/')) {
          detectedRegion = 'EU';
        } else if (timezone.startsWith('America/')) {
          detectedRegion = 'US';
        } else if (timezone.startsWith('Australia/') || timezone.startsWith('Pacific/Auckland')) {
          detectedRegion = 'ANZ';
        }

        setRegion(detectedRegion);
        setIsGDPRRegion(detectedRegion === 'UK' || detectedRegion === 'EU');
      } catch (err) {
        console.error('Failed to detect region:', err);
        setRegion('ANZ');
        setIsGDPRRegion(false);
      } finally {
        setLoading(false);
      }
    };

    detectRegion();
  }, []);

  return { region, isGDPRRegion, loading };
}

const gdprHooks = {
  useConsent,
  useCookieConsent,
  useDSAR,
  useRegion,
};

export default gdprHooks;
