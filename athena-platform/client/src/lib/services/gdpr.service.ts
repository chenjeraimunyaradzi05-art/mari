/**
 * GDPR Service - Client Side
 * API client for GDPR endpoints
 * Phase 4: UK/EU Market Launch
 */

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000').replace(/\/$/, '');

// Types
export type DSARType = 'EXPORT' | 'DELETION' | 'RECTIFICATION' | 'RESTRICTION' | 'PORTABILITY';
export type DSARStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';

export interface DSARRequest {
  id: string;
  type: DSARType;
  status: DSARStatus;
  createdAt: string;
  dueDate: string;
  completedAt?: string;
  downloadUrl?: string;
}

export interface ConsentRecord {
  type: string;
  granted: boolean;
  updatedAt: string;
  expiresAt?: string;
}

export interface CookieConsent {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
  functional: boolean;
  consentedAt?: string;
}

/**
 * Submit a data export request (DSAR)
 */
export async function requestDataExport(token: string): Promise<DSARRequest> {
  const response = await fetch(`${API_BASE}/api/gdpr/dsar/export`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to request data export');
  }

  const data = await response.json();
  return data.data;
}

/**
 * Submit a data deletion request (Right to Erasure)
 */
export async function requestDataDeletion(
  token: string,
  confirmation: string,
  reason?: string
): Promise<DSARRequest> {
  const response = await fetch(`${API_BASE}/api/gdpr/dsar/delete`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ confirmation, reason }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to request data deletion');
  }

  const data = await response.json();
  return data.data;
}

/**
 * Submit a data rectification request
 */
export async function requestDataRectification(
  token: string,
  corrections: Record<string, any>
): Promise<DSARRequest> {
  const response = await fetch(`${API_BASE}/api/gdpr/dsar/rectify`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ corrections }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to request data rectification');
  }

  const data = await response.json();
  return data.data;
}

/**
 * Get DSAR request history
 */
export async function getDSARHistory(token: string): Promise<DSARRequest[]> {
  const response = await fetch(`${API_BASE}/api/gdpr/dsar`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch DSAR history');
  }

  const data = await response.json();
  return data.data;
}

/**
 * Get specific DSAR request status
 */
export async function getDSARStatus(token: string, requestId: string): Promise<DSARRequest> {
  const response = await fetch(`${API_BASE}/api/gdpr/dsar/${requestId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch DSAR status');
  }

  const data = await response.json();
  return data.data;
}

/**
 * Download exported data
 */
export async function downloadExportedData(token: string, requestId: string): Promise<Blob> {
  const response = await fetch(`${API_BASE}/api/gdpr/download/${requestId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to download data');
  }

  return response.blob();
}

/**
 * Get user's consent records
 */
export async function getConsents(token: string): Promise<Record<string, boolean>> {
  const response = await fetch(`${API_BASE}/api/gdpr/consents`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch consents');
  }

  const data = await response.json();
  return data.data;
}

/**
 * Update a single consent
 */
export async function updateConsent(
  token: string,
  consentType: string,
  granted: boolean
): Promise<void> {
  const response = await fetch(`${API_BASE}/api/gdpr/consents/${consentType}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ granted }),
  });

  if (!response.ok) {
    throw new Error('Failed to update consent');
  }
}

/**
 * Bulk update consents
 */
export async function updateConsents(
  token: string,
  consents: Array<{ type: string; granted: boolean }>
): Promise<void> {
  const response = await fetch(`${API_BASE}/api/gdpr/consents`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ consents }),
  });

  if (!response.ok) {
    throw new Error('Failed to update consents');
  }
}

/**
 * Get cookie consent for visitor
 */
export async function getCookieConsent(visitorId: string): Promise<CookieConsent | null> {
  try {
    const response = await fetch(`${API_BASE}/api/gdpr/cookies/${visitorId}`);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.data;
  } catch {
    return null;
  }
}

/**
 * Save cookie consent
 */
export async function saveCookieConsent(
  visitorId: string,
  consent: Omit<CookieConsent, 'essential' | 'consentedAt'>
): Promise<void> {
  const response = await fetch(`${API_BASE}/api/gdpr/cookies`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      visitorId,
      ...consent,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to save cookie consent');
  }
}

/**
 * Get data processing purposes
 */
export function getDataProcessingPurposes(): Array<{
  id: string;
  name: string;
  description: string;
  required: boolean;
  legalBasis: string;
}> {
  return [
    {
      id: 'essential',
      name: 'Essential Services',
      description: 'Required for the platform to function properly, including authentication, security, and core features.',
      required: true,
      legalBasis: 'Contract performance',
    },
    {
      id: 'analytics',
      name: 'Analytics & Improvements',
      description: 'Helps us understand how you use the platform so we can improve our services.',
      required: false,
      legalBasis: 'Legitimate interest',
    },
    {
      id: 'personalization',
      name: 'Personalization',
      description: 'Allows us to customize your experience based on your preferences and behavior.',
      required: false,
      legalBasis: 'Consent',
    },
    {
      id: 'marketing_email',
      name: 'Email Marketing',
      description: 'Receive promotional emails about new features, courses, and opportunities.',
      required: false,
      legalBasis: 'Consent',
    },
    {
      id: 'marketing_push',
      name: 'Push Notifications',
      description: 'Receive push notifications about activity and updates.',
      required: false,
      legalBasis: 'Consent',
    },
    {
      id: 'third_party_sharing',
      name: 'Partner Services',
      description: 'Share your data with selected partners to provide enhanced services.',
      required: false,
      legalBasis: 'Consent',
    },
    {
      id: 'profiling',
      name: 'Career Profiling',
      description: 'Use AI to analyze your skills and suggest career paths.',
      required: false,
      legalBasis: 'Consent',
    },
    {
      id: 'research',
      name: 'Research & Development',
      description: 'Use anonymized data to improve our AI models and develop new features.',
      required: false,
      legalBasis: 'Legitimate interest',
    },
  ];
}

/**
 * Get data retention information
 */
export function getDataRetentionInfo(): Array<{
  category: string;
  retentionPeriod: string;
  reason: string;
}> {
  return [
    {
      category: 'Account Data',
      retentionPeriod: 'Until account deletion + 30 days',
      reason: 'Required for service provision and legal compliance',
    },
    {
      category: 'Activity Logs',
      retentionPeriod: '2 years',
      reason: 'Security and fraud prevention',
    },
    {
      category: 'Application Data',
      retentionPeriod: '3 years after last activity',
      reason: 'Service history and dispute resolution',
    },
    {
      category: 'Chat Messages',
      retentionPeriod: '1 year',
      reason: 'Service provision and safety',
    },
    {
      category: 'Payment Records',
      retentionPeriod: '7 years',
      reason: 'Tax and legal requirements',
    },
    {
      category: 'Consent Records',
      retentionPeriod: '5 years',
      reason: 'GDPR compliance evidence',
    },
  ];
}

export default {
  requestDataExport,
  requestDataDeletion,
  requestDataRectification,
  getDSARHistory,
  getDSARStatus,
  downloadExportedData,
  getConsents,
  updateConsent,
  updateConsents,
  getCookieConsent,
  saveCookieConsent,
  getDataProcessingPurposes,
  getDataRetentionInfo,
};
