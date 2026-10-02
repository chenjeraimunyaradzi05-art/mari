'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '@/lib/store';
import { Shield, Download, Trash2, Eye, Bell, Lock, Cookie, ChevronRight, AlertTriangle, Check, Loader2, FileText, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import complianceService from '@/lib/services/compliance.service';
import type { LegalDocument, LegalAgreementRecord } from '@/lib/services/compliance.service';
import { contactLink } from '@/lib/contact';
import { downloadBlob } from '@/lib/download';
import { StepUpFields } from '@/components/account/StepUpFields';
import { getStoredPreference } from '@/lib/utils';
import { QuickExitButton } from '../dashboard/safety/QuickExit';
import { EmergencyHelp } from '@/components/safety/EmergencyHelp';

interface ConsentState {
  MARKETING_EMAIL: boolean;
  MARKETING_SMS: boolean;
  MARKETING_PUSH: boolean;
  DATA_PROCESSING: boolean;
  ANALYTICS: boolean;
  PERSONALIZATION: boolean;
  THIRD_PARTY_SHARING: boolean;
}

/**
 * A request as GET /api/gdpr/dsar returns it. The link to a finished export is
 * `exportUrl`, with `exportExpiresAt` beside it; this page used to read a
 * `downloadUrl` that the API has never sent, so no request in the history ever
 * showed a way to fetch its file.
 */
interface DSARRequest {
  id: string;
  type: 'EXPORT' | 'DELETION' | 'RECTIFICATION' | 'RESTRICTION' | 'PORTABILITY';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';
  createdAt: string;
  completedAt?: string | null;
  exportUrl?: string | null;
  exportExpiresAt?: string | null;
}

const REQUEST_TYPE_LABELS: Record<string, string> = {
  EXPORT: 'Copy of your data',
  DELETION: 'Account deletion',
  RECTIFICATION: 'Correction',
  RESTRICTION: 'Pause on how we use your data',
  PORTABILITY: 'Data to take elsewhere',
};

const REQUEST_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Waiting',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Done',
  REJECTED: 'Not carried out',
};

/**
 * What the API said went wrong, in its own words, else ours. The routes answer
 * `error` on a refusal and `message` from the shared handler, and axios
 * throws on either.
 */
function serverMessage(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: { error?: unknown; message?: unknown } } })?.response?.data;
  if (typeof data?.error === 'string' && data.error) return data.error;
  if (typeof data?.message === 'string' && data.message) return data.message;
  return fallback;
}

/**
 * The API path of an export link, or null when it is not one of ours. The link
 * is a path on this site (`/api/gdpr/download/<token>`) and the route behind it
 * wants the session header, which a link a member clicks cannot carry, so it is
 * fetched through the shared client instead and handed over as a file.
 */
function exportPathOf(downloadUrl: string): string | null {
  try {
    const { pathname } = new URL(downloadUrl, 'https://athena.invalid');
    return pathname.startsWith('/api/gdpr/download/') ? pathname.replace(/^\/api/, '') : null;
  } catch {
    return null;
  }
}

function hasExpired(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const when = new Date(iso).getTime();
  return !Number.isNaN(when) && when < Date.now();
}

const CONSENT_DESCRIPTIONS: Record<keyof ConsentState, { title: string; description: string; required?: boolean }> = {
  MARKETING_EMAIL: {
    title: 'Marketing Emails',
    description: 'Receive promotional emails, newsletters, and special offers about our platform and partners.',
  },
  MARKETING_SMS: {
    title: 'Marketing SMS',
    description: 'Receive promotional text messages with offers and updates.',
  },
  MARKETING_PUSH: {
    title: 'Push Notifications',
    description: 'Receive push notifications for promotions, new features, and personalized recommendations.',
  },
  DATA_PROCESSING: {
    title: 'Essential Data Processing',
    description: 'Required for providing our core services including account management and platform functionality.',
    required: true,
  },
  ANALYTICS: {
    title: 'Analytics & Improvement',
    description: 'Help us improve the platform by allowing anonymous usage analytics and performance monitoring.',
  },
  PERSONALIZATION: {
    title: 'Personalized Experience',
    description: 'Allow us to personalize your feed, job recommendations, and content based on your activity.',
  },
  THIRD_PARTY_SHARING: {
    title: 'Third-Party Services',
    description: 'Allow sharing limited data with trusted partners to enhance your experience (e.g., payment processors, analytics).',
  },
};

function formatDateLabel(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString();
}

function getAgreementKey(documentType: string, documentVersion: string): string {
  return `${documentType}:${documentVersion}`;
}

/** What POST /api/gdpr/dsar/export hands back: the file is ready at once. */
interface ExportReady {
  downloadUrl: string;
  expiresAt?: string;
}

/**
 * The region the member has chosen in Settings, else the one the browser
 * suggests. ANZ is the platform's home and the fallback.
 */
function resolveRegion(): string {
  return getStoredPreference('athena.region', '') || complianceService.detectUserRegion();
}

export default function PrivacyCenterPage() {
  const { isAuthenticated, logout } = useAuthStore();
  const [region, setRegion] = useState('ANZ');
  const [exportReady, setExportReady] = useState<ExportReady | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadingExport, setDownloadingExport] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // Whether the member's saved choices were really read. Until they have been,
  // the switches below are not a statement about her account, so they are not
  // offered as one.
  const [consentsLoaded, setConsentsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [consents, setConsents] = useState<ConsentState>({
    MARKETING_EMAIL: false,
    MARKETING_SMS: false,
    MARKETING_PUSH: false,
    DATA_PROCESSING: true,
    ANALYTICS: false,
    PERSONALIZATION: false,
    THIRD_PARTY_SHARING: false,
  });
  const [dsarHistory, setDsarHistory] = useState<DSARRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  // Asked for again, because erasure cannot be undone: see StepUpFields.
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteCode, setDeleteCode] = useState('');
  const [legalDocuments, setLegalDocuments] = useState<LegalDocument[]>([]);
  const [agreementHistory, setAgreementHistory] = useState<LegalAgreementRecord[]>([]);
  const [legalLoading, setLegalLoading] = useState(true);
  const [legalError, setLegalError] = useState<string | null>(null);
  const [agreementMessage, setAgreementMessage] = useState<string | null>(null);
  const [agreeingDocumentId, setAgreeingDocumentId] = useState<string | null>(null);

  const acknowledgedAgreements = useMemo(() => {
    const entries = agreementHistory.map((agreement) =>
      getAgreementKey(agreement.documentType, agreement.documentVersion)
    );
    return new Set(entries);
  }, [agreementHistory]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchPrivacyData();
      fetchAgreementHistory();
    } else {
      setAgreementHistory([]);
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchLegalDocuments();
  }, []);

  const fetchLegalDocuments = async () => {
    try {
      setLegalLoading(true);
      const regionCode = resolveRegion();
      setRegion(regionCode);
      const documents = await complianceService.getLegalDocuments(regionCode);
      setLegalDocuments(Array.isArray(documents) ? documents : []);
      setLegalError(null);
    } catch (error) {
      console.error('Failed to fetch legal documents:', error);
      setLegalError('Unable to load legal documents right now. Please refresh and try again.');
    } finally {
      setLegalLoading(false);
    }
  };

  const fetchAgreementHistory = async () => {
    try {
      const history = await complianceService.getAgreementHistory();
      setAgreementHistory(Array.isArray(history) ? history : []);
    } catch (error) {
      console.error('Failed to fetch agreement history:', error);
    }
  };

  const fetchPrivacyData = async () => {
    setLoadError(null);
    // Through the shared client, which attaches her session. A bare fetch
    // arrived as nobody, was answered 401, and the page showed the defaults as
    // if they were her choices and an empty history as if she had made no
    // requests.
    const [consentsResult, historyResult] = await Promise.allSettled([api.get('/gdpr/consents'), api.get('/gdpr/dsar')]);

    if (consentsResult.status === 'fulfilled') {
      const saved = consentsResult.value.data?.data;
      setConsents((prev) => ({ ...prev, ...(saved && typeof saved === 'object' ? saved : {}) }));
      setConsentsLoaded(true);
    } else {
      console.error('Failed to fetch consents:', consentsResult.reason);
      setConsentsLoaded(false);
    }

    if (historyResult.status === 'fulfilled') {
      const history = historyResult.value.data?.data;
      setDsarHistory(Array.isArray(history) ? history : []);
    } else {
      console.error('Failed to fetch request history:', historyResult.reason);
    }

    if (consentsResult.status === 'rejected' || historyResult.status === 'rejected') {
      setLoadError(
        'We could not load your saved privacy choices just now. What is shown may not match what is saved, so please try again before you change anything.'
      );
    }
    setLoading(false);
  };

  const isDocumentAcknowledged = (document: LegalDocument): boolean => {
    const agreementKey = getAgreementKey(document.documentType, document.version);
    if (acknowledgedAgreements.has(agreementKey)) {
      return true;
    }

    return acknowledgedByConsent(document);
  };

  // Backward compatibility for users who acknowledged via data-processing consent
  // before document-level agreement history was introduced. Only where her saved
  // consents were really read: the switch's starting value is on, and a page that
  // could not reach the API would otherwise tell her she had acknowledged every
  // required document on the strength of a default.
  const acknowledgedByConsent = (document: LegalDocument): boolean =>
    Boolean(isAuthenticated && consentsLoaded && document.required && consents.DATA_PROCESSING);

  const getAcknowledgedAt = (document: LegalDocument): string | null => {
    const match = agreementHistory.find(
      (agreement) =>
        agreement.documentType === document.documentType &&
        agreement.documentVersion === document.version
    );

    if (match?.acceptedAt) {
      return formatDateLabel(match.acceptedAt);
    }

    if (acknowledgedByConsent(document)) {
      return 'Previously acknowledged';
    }

    return null;
  };

  const acknowledgeDocument = async (document: LegalDocument) => {
    if (!isAuthenticated || isDocumentAcknowledged(document)) {
      return;
    }

    try {
      setAgreementMessage(null);
      setAgreeingDocumentId(document.id);
      const response = await complianceService.recordAgreement(document.documentType, document.version);

      setAgreementHistory((previous) => {
        const filtered = previous.filter(
          (agreement) => agreement.documentType !== response.documentType
        );
        return [
          {
            documentType: response.documentType,
            documentVersion: response.documentVersion,
            acceptedAt: response.acceptedAt,
          },
          ...filtered,
        ];
      });

      setConsents((previous) => ({
        ...previous,
        DATA_PROCESSING: true,
      }));

      setAgreementMessage(`Acknowledged ${document.title} (${document.version}).`);
    } catch (error) {
      console.error('Failed to acknowledge legal document:', error);
      setAgreementMessage('Could not record your acknowledgement. Please try again.');
    } finally {
      setAgreeingDocumentId(null);
    }
  };

  const updateConsent = async (key: keyof ConsentState, value: boolean) => {
    if (CONSENT_DESCRIPTIONS[key].required && !value) return;

    setConsentError(null);
    setConsents(prev => ({ ...prev, [key]: value }));
    setSaving(true);

    try {
      await api.post(`/gdpr/consents/${key}`, { granted: value });
    } catch (error) {
      // The switch is put back and she is told, in the server's words where it
      // gave any (a choice paused under a request of hers says so). It used to
      // stay where she had left it whatever the answer was, which made a
      // refused choice look saved.
      console.error('Failed to update consent:', error);
      setConsents(prev => ({ ...prev, [key]: !value }));
      setConsentError(
        `${CONSENT_DESCRIPTIONS[key].title}: ${serverMessage(error, 'we could not save that choice, so it has been put back. Please try again.')}`
      );
    } finally {
      setSaving(false);
    }
  };

  const requestDataExport = async () => {
    setExportLoading(true);
    setExportError(null);
    setDownloadError(null);
    try {
      const res = await api.post('/gdpr/dsar/export');
      const data = res.data?.data;
      if (data?.downloadUrl) {
        // The export is built synchronously and the link comes back in this
        // response; nothing is emailed. It is shown here, where it was asked for.
        setExportReady({ downloadUrl: data.downloadUrl, expiresAt: data.expiresAt });
        fetchPrivacyData();
      } else {
        setExportError('We could not prepare your export just now. Please try again.');
      }
    } catch (error) {
      console.error('Failed to request export:', error);
      setExportError(serverMessage(error, 'We could not prepare your export just now. Please try again.'));
    } finally {
      setExportLoading(false);
    }
  };

  /**
   * Fetches a finished export with her session and hands it over as a file.
   * The link itself cannot be followed by the browser: the route wants the
   * session header, and a click does not send one.
   */
  const downloadExport = async (downloadUrl: string) => {
    setDownloadError(null);
    const path = exportPathOf(downloadUrl);
    if (!path) {
      setDownloadError('That link is not one we recognise. Please ask for a new copy of your data.');
      return;
    }

    setDownloadingExport(true);
    try {
      const file = await api.get(path, { responseType: 'blob' });
      downloadBlob(`athena-my-data-${new Date().toISOString().slice(0, 10)}.json`, file.data as Blob);
    } catch (error) {
      console.error('Failed to download export:', error);
      const status = (error as { response?: { status?: number } })?.response?.status;
      setDownloadError(
        status === 410
          ? 'That link has expired. Please ask for a new copy of your data.'
          : status === 404
            ? 'We could not find that copy any more. Please ask for a new one.'
            : 'We could not download your data just now. Please try again.'
      );
    } finally {
      setDownloadingExport(false);
    }
  };

  const requestAccountDeletion = async () => {
    if (deleteInput !== 'DELETE_MY_ACCOUNT') return;
    setDeleteError(null);

    try {
      const res = await api.post('/gdpr/dsar/delete', {
        confirmation: 'DELETE_MY_ACCOUNT',
        ...(deletePassword ? { currentPassword: deletePassword } : {}),
        ...(deleteCode.trim() ? { code: deleteCode.trim() } : {}),
      });
      // Erasure runs when the request is made, not within 30 days, so the
      // server's own account of what happened is what the member sees, and
      // there is no account left to stay signed in to.
      alert(res.data?.message || 'Your personal data has been erased.');
      setDeleteConfirm(false);
      setDeleteInput('');
      setDeletePassword('');
      setDeleteCode('');
      logout();
      window.location.href = '/';
    } catch (error) {
      console.error('Failed to request deletion:', error);
      // A legal hold or an open dispute can stop erasure; the route says why.
      const reached = Boolean((error as { response?: unknown })?.response);
      setDeleteError(
        reached
          ? serverMessage(error, 'Deletion could not be carried out right now.')
          : 'We could not reach the server. Please try again.'
      );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-700 to-indigo-800 text-white">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-10 h-10" />
            <h1 className="text-3xl font-bold">Privacy Center</h1>
          </div>
          <p className="text-purple-100 text-lg max-w-2xl">
            Control how your data is used and exercise your privacy rights. We are committed to transparency and giving you full control over your personal information.
          </p>

          {/* Privacy is also who can find you and who can reach you. Those
              settings live elsewhere, so the way to them is here. */}
          <nav aria-label="Safety shortcuts" className="mt-6">
            <p className="text-sm font-medium text-white">Looking for who can find or reach you?</p>
            <ul className="mt-2 flex flex-wrap gap-3">
              {isAuthenticated && (
                <>
                  <li>
                    <Link
                      href="/safety-center"
                      className="inline-flex min-h-[44px] items-center rounded-full bg-white/15 px-4 py-2 text-sm font-medium text-white hover:bg-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-purple-800"
                    >
                      Blocked members and your reports
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/dashboard/safety"
                      className="inline-flex min-h-[44px] items-center rounded-full bg-white/15 px-4 py-2 text-sm font-medium text-white hover:bg-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-purple-800"
                    >
                      Safe Mode
                    </Link>
                  </li>
                </>
              )}
              <li>
                <Link
                  href="/help/safety-center"
                  className="inline-flex min-h-[44px] items-center rounded-full bg-white/15 px-4 py-2 text-sm font-medium text-white hover:bg-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-purple-800"
                >
                  Crisis lines and support
                </Link>
              </li>
            </ul>
            <p className="mt-3 text-sm text-purple-100">
              If you are in danger now, call{' '}
              <a href="tel:000" className="font-semibold text-white underline">
                000
              </a>
              .
            </p>
          </nav>
        </div>
      </div>

      {/* A way off this page, for anyone who has to leave it in a hurry. */}
      <QuickExitButton variant="floating" className="print:hidden" />
      <EmergencyHelp className="print:hidden" />

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {loadError && (
          <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100">
            <p className="text-sm">{loadError}</p>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                void fetchPrivacyData();
              }}
              className="mt-3 inline-flex min-h-[44px] items-center rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2"
            >
              Try again
            </button>
          </div>
        )}

        {/* Quick Actions */}
        {isAuthenticated && (
          <section id="data-rights" className="scroll-mt-8 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">Your Data Rights</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {/* Export Data */}
              <button
                onClick={requestDataExport}
                disabled={exportLoading}
                className="flex items-center gap-4 p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition text-left"
              >
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                  {exportLoading ? (
                    <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                  ) : (
                    <Download className="w-6 h-6 text-blue-600" />
                  )}
                </div>
                <div>
                  <h3 className="font-medium text-slate-900 dark:text-white">Download My Data</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Get a copy of all your personal data</p>
                </div>
              </button>

              {/* Delete Account */}
              <button
                onClick={() => setDeleteConfirm(true)}
                className="flex items-center gap-4 p-4 border border-red-200 dark:border-red-900/50 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition text-left"
              >
                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="font-medium text-slate-900 dark:text-white">Delete My Account</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Erase your personal data now</p>
                </div>
              </button>
            </div>

            {exportReady && (
              <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-900/20">
                <p className="font-medium text-blue-900 dark:text-blue-100">Your export is ready.</p>
                <p className="mt-1 text-sm text-blue-800 dark:text-blue-200">
                  It is a JSON file of everything we hold about you.
                  {exportReady.expiresAt && ` The link works until ${formatDateLabel(exportReady.expiresAt)}.`}
                </p>
                <button
                  type="button"
                  onClick={() => downloadExport(exportReady.downloadUrl)}
                  disabled={downloadingExport}
                  className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-60"
                >
                  {downloadingExport ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download my data
                </button>
              </div>
            )}

            {exportError && (
              <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">{exportError}</p>
            )}
            {downloadError && (
              <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">{downloadError}</p>
            )}
          </section>
        )}

        {/* Home regime: the Privacy Act and the APPs for Australian members */}
        {region === 'ANZ' && (
          <section className="rounded-xl border border-rose-100 bg-gradient-to-r from-rose-50 to-amber-50 p-6 dark:border-rose-900/40 dark:from-rose-950/30 dark:to-amber-950/20">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Your rights in Australia</h2>
            <p className="mt-2 text-slate-700 dark:text-slate-300">
              ATHENA is a Queensland company, so the Privacy Act 1988 and the Australian Privacy Principles are the
              rules we keep for you. You can see and correct what we hold, say no to marketing, and if something is
              wrong, tell us first. We answer within 30 days, and if you are not satisfied you can take it to the
              Office of the Australian Information Commissioner.
            </p>
            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              <Link href="/privacy/au" className="inline-flex items-center gap-1 font-medium text-rose-700 hover:underline dark:text-rose-300">
                Read the Australian Privacy Statement <ChevronRight className="h-4 w-4" />
              </Link>
              <a
                href="https://www.oaic.gov.au/privacy/privacy-complaints"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-rose-700 hover:underline dark:text-rose-300"
              >
                Complain to the OAIC <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </div>
          </section>
        )}

        {/* Consent Management */}
        <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-purple-600" />
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Communication Preferences</h2>
            </div>
            {saving && (
              <span className="inline-flex items-center gap-1 text-xs text-purple-600">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
              </span>
            )}
          </div>
          {!isAuthenticated && (
            <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">Sign in to see and change your choices.</p>
          )}
          {consentError && (
            <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
              {consentError}
            </p>
          )}
          <div className="space-y-4">
            {(['MARKETING_EMAIL', 'MARKETING_SMS', 'MARKETING_PUSH'] as const).map((key) => (
              <div key={key} className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-700 last:border-0">
                <div>
                  <h3 className="font-medium text-slate-900 dark:text-white">{CONSENT_DESCRIPTIONS[key].title}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{CONSENT_DESCRIPTIONS[key].description}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consents[key]}
                    onChange={(e) => updateConsent(key, e.target.checked)}
                    className="sr-only peer"
                    aria-label={CONSENT_DESCRIPTIONS[key].title}
                    disabled={!isAuthenticated || !consentsLoaded}
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-purple-600"></div>
                </label>
              </div>
            ))}
          </div>
        </section>

        {/* Data Processing Consents */}
        <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center gap-2 mb-6">
            <Lock className="w-5 h-5 text-purple-600" />
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Data Processing</h2>
          </div>
          <div className="space-y-4">
            {(['DATA_PROCESSING', 'ANALYTICS', 'PERSONALIZATION', 'THIRD_PARTY_SHARING'] as const).map((key) => (
              <div key={key} className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-700 last:border-0">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-slate-900 dark:text-white">{CONSENT_DESCRIPTIONS[key].title}</h3>
                    {CONSENT_DESCRIPTIONS[key].required && (
                      <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded">Required</span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{CONSENT_DESCRIPTIONS[key].description}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer ml-4">
                  <input
                    type="checkbox"
                    checked={consents[key]}
                    onChange={(e) => updateConsent(key, e.target.checked)}
                    className="sr-only peer"
                    aria-label={CONSENT_DESCRIPTIONS[key].title}
                    disabled={!isAuthenticated || !consentsLoaded || CONSENT_DESCRIPTIONS[key].required}
                  />
                  <div className={`w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-purple-600 ${CONSENT_DESCRIPTIONS[key].required ? 'opacity-60 cursor-not-allowed' : ''}`}></div>
                </label>
              </div>
            ))}
          </div>
        </section>

        {/* Cookie Settings Link */}
        <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Cookie className="w-5 h-5 text-purple-600" />
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Cookie Preferences</h2>
          </div>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            Manage how we use cookies and similar technologies to improve your experience.
          </p>
          <Link
            href="/cookies"
            className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700 font-medium"
          >
            Manage Cookie Settings <ChevronRight className="w-4 h-4" />
          </Link>
        </section>

        {/* Request History */}
        {isAuthenticated && dsarHistory.length > 0 && (
          <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">Request History</h2>
            <div className="space-y-3">
              {dsarHistory.map((request) => (
                <div key={request.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {REQUEST_TYPE_LABELS[request.type] ?? 'Privacy request'}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Submitted {new Date(request.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded ${
                      request.status === 'COMPLETED' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                      request.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                      request.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {REQUEST_STATUS_LABELS[request.status] ?? request.status}
                    </span>
                    {request.exportUrl &&
                      (hasExpired(request.exportExpiresAt) ? (
                        <span className="text-sm text-slate-500 dark:text-slate-400">Link expired</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => downloadExport(request.exportUrl as string)}
                          disabled={downloadingExport}
                          className="min-h-[44px] rounded px-2 text-sm text-purple-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 disabled:opacity-60"
                        >
                          Download
                        </button>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Legal Documents */}
        <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between gap-3 mb-2">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Legal Documents</h2>
            {legalLoading && <Loader2 className="w-4 h-4 animate-spin text-purple-600" />}
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            Review current legal policies and record your acknowledgement.
          </p>

          {legalError && (
            <p className="text-sm text-red-600 dark:text-red-400 mb-4">{legalError}</p>
          )}

          {!legalLoading && legalDocuments.length === 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400">No legal documents are currently available.</p>
          )}

          <div className="space-y-3">
            {legalDocuments.map((document) => {
              const acknowledged = isDocumentAcknowledged(document);
              const acknowledgedAt = getAcknowledgedAt(document);

              return (
                <article
                  key={document.id}
                  className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50/70 dark:bg-slate-900/40"
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <FileText className="w-5 h-5 text-slate-400 mt-0.5" />
                      <div>
                        <h3 className="font-medium text-slate-900 dark:text-white">{document.title}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          Version {document.version} • Effective {formatDateLabel(document.effectiveDate)}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          {document.required && (
                            <span className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 px-2 py-0.5 rounded">
                              Required
                            </span>
                          )}
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${
                              acknowledged
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                            }`}
                          >
                            {acknowledged ? 'Acknowledged' : 'Pending acknowledgement'}
                          </span>
                        </div>
                        {acknowledgedAt && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                            {acknowledgedAt === 'Previously acknowledged'
                              ? acknowledgedAt
                              : `Acknowledged on ${acknowledgedAt}`}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 md:items-center md:justify-end">
                      <Link
                        href={document.url || '/privacy'}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800"
                      >
                        <Eye className="w-4 h-4" /> Review
                      </Link>

                      {isAuthenticated && document.required && (
                        <button
                          type="button"
                          onClick={() => acknowledgeDocument(document)}
                          disabled={acknowledged || agreeingDocumentId === document.id}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {agreeingDocumentId === document.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                          {acknowledged ? 'Acknowledged' : 'Acknowledge'}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {!isAuthenticated && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-4">
              Sign in to record legal acknowledgements on your account.
            </p>
          )}

          {agreementMessage && (
            <p className="text-sm text-purple-700 dark:text-purple-300 mt-4">{agreementMessage}</p>
          )}
        </section>

        {/* Privacy contact */}
        <section className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Questions about your privacy?</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            Contact our privacy team for any privacy-related inquiries or to exercise your rights.
          </p>
          <a href={contactLink('privacy').href} className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700 font-medium">
            {contactLink('privacy').label}
          </a>
        </section>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Delete Account</h3>
                <p className="text-sm text-slate-500">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Your profile, posts, messages and other personal data are erased as soon as you confirm. Records the law
              makes us keep, such as payment records, are held without anything that identifies you. If you pay for a
              membership, it ends today and you are not charged again; if we cannot end it, nothing is deleted. Gift
              points you have bought, and creator earnings you have not withdrawn, are not paid out or refunded:
              withdraw your earnings first if you want them.
            </p>
            <div className="mb-4">
              <StepUpFields
                password={deletePassword}
                code={deleteCode}
                onPasswordChange={setDeletePassword}
                onCodeChange={setDeleteCode}
              />
            </div>
            <label htmlFor="delete-account-confirmation" className="block text-sm text-slate-600 dark:text-slate-400 mb-2">
              Type <strong>DELETE_MY_ACCOUNT</strong> to confirm:
            </label>
            <input
              id="delete-account-confirmation"
              type="text"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg mb-4 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              placeholder="DELETE_MY_ACCOUNT"
            />
            {deleteError && (
              <p className="mb-4 text-sm text-red-600 dark:text-red-400">{deleteError}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setDeleteConfirm(false);
                  setDeleteInput('');
                  setDeletePassword('');
                  setDeleteCode('');
                  setDeleteError(null);
                }}
                className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={requestAccountDeletion}
                disabled={deleteInput !== 'DELETE_MY_ACCOUNT'}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
