'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '@/lib/store';
import { Shield, Download, Trash2, Eye, Bell, Lock, Cookie, ChevronRight, AlertTriangle, Check, Loader2, FileText, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import complianceService from '@/lib/services/compliance.service';
import type { LegalDocument, LegalAgreementRecord } from '@/lib/services/compliance.service';
import { contactLink } from '@/lib/contact';
import { safeHref } from '@/lib/safe-href';
import { getStoredPreference } from '@/lib/utils';

interface ConsentState {
  MARKETING_EMAIL: boolean;
  MARKETING_SMS: boolean;
  MARKETING_PUSH: boolean;
  DATA_PROCESSING: boolean;
  ANALYTICS: boolean;
  PERSONALIZATION: boolean;
  THIRD_PARTY_SHARING: boolean;
}

interface DSARRequest {
  id: string;
  type: 'EXPORT' | 'DELETION' | 'RECTIFICATION' | 'RESTRICTION';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';
  createdAt: string;
  completedAt?: string;
  downloadUrl?: string;
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
  const [deleteError, setDeleteError] = useState<string | null>(null);
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
    try {
      // Fetch consents
      const consentsRes = await fetch('/api/gdpr/consents', {
        credentials: 'include',
      });
      if (consentsRes.ok) {
        const { data } = await consentsRes.json();
        setConsents(prev => ({ ...prev, ...data }));
      }

      // Fetch DSAR history
      const dsarRes = await fetch('/api/gdpr/dsar', {
        credentials: 'include',
      });
      if (dsarRes.ok) {
        const { data } = await dsarRes.json();
        setDsarHistory(data || []);
      }
    } catch (error) {
      console.error('Failed to fetch privacy data:', error);
    } finally {
      setLoading(false);
    }
  };

  const isDocumentAcknowledged = (document: LegalDocument): boolean => {
    const agreementKey = getAgreementKey(document.documentType, document.version);
    if (acknowledgedAgreements.has(agreementKey)) {
      return true;
    }

    // Backward compatibility for users who acknowledged via data-processing consent
    // before document-level agreement history was introduced.
    return Boolean(isAuthenticated && document.required && consents.DATA_PROCESSING);
  };

  const getAcknowledgedAt = (document: LegalDocument): string | null => {
    const match = agreementHistory.find(
      (agreement) =>
        agreement.documentType === document.documentType &&
        agreement.documentVersion === document.version
    );

    if (match?.acceptedAt) {
      return formatDateLabel(match.acceptedAt);
    }

    if (isAuthenticated && document.required && consents.DATA_PROCESSING) {
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

    setConsents(prev => ({ ...prev, [key]: value }));
    setSaving(true);

    try {
      await fetch(`/api/gdpr/consents/${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ granted: value }),
      });
    } catch (error) {
      console.error('Failed to update consent:', error);
      setConsents(prev => ({ ...prev, [key]: !value }));
    } finally {
      setSaving(false);
    }
  };

  const requestDataExport = async () => {
    setExportLoading(true);
    setExportError(null);
    try {
      const res = await fetch('/api/gdpr/dsar/export', {
        method: 'POST',
        credentials: 'include',
      });
      const payload = await res.json();
      const data = payload?.data;
      if (res.ok && data?.downloadUrl) {
        // The export is built synchronously and the link comes back in this
        // response; nothing is emailed. It is shown here, where it was asked for.
        setExportReady({ downloadUrl: data.downloadUrl, expiresAt: data.expiresAt });
        fetchPrivacyData();
      } else {
        setExportError(payload?.error || payload?.message || 'We could not prepare your export just now. Please try again.');
      }
    } catch (error) {
      console.error('Failed to request export:', error);
      setExportError('We could not prepare your export just now. Please try again.');
    } finally {
      setExportLoading(false);
    }
  };

  const requestAccountDeletion = async () => {
    if (deleteInput !== 'DELETE_MY_ACCOUNT') return;
    setDeleteError(null);

    try {
      const res = await fetch('/api/gdpr/dsar/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ confirmation: 'DELETE_MY_ACCOUNT' }),
      });
      const payload = await res.json();
      if (res.ok) {
        // Erasure runs when the request is made, not within 30 days, so the
        // server's own account of what happened is what the member sees, and
        // there is no account left to stay signed in to.
        alert(payload?.message || 'Your personal data has been erased.');
        setDeleteConfirm(false);
        setDeleteInput('');
        logout();
        window.location.href = '/';
        return;
      }
      // A legal hold or an open dispute can stop erasure; the route says why.
      setDeleteError(payload?.error || payload?.message || 'Deletion could not be carried out right now.');
    } catch (error) {
      console.error('Failed to request deletion:', error);
      setDeleteError('We could not reach the server. Please try again.');
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
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
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
                <a
                  href={safeHref(exportReady.downloadUrl)}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  <Download className="h-4 w-4" /> Download my data
                </a>
              </div>
            )}

            {exportError && (
              <p className="mt-4 text-sm text-red-600 dark:text-red-400">{exportError}</p>
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
                    disabled={!isAuthenticated}
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
                    disabled={!isAuthenticated || CONSENT_DESCRIPTIONS[key].required}
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
                    <p className="font-medium text-slate-900 dark:text-white capitalize">
                      {request.type.toLowerCase().replace('_', ' ')} Request
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
                      {request.status}
                    </span>
                    {request.downloadUrl && (
                      <a href={safeHref(request.downloadUrl)} className="text-purple-600 hover:underline text-sm">
                        Download
                      </a>
                    )}
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
              makes us keep, such as payment records, are held without anything that identifies you.
            </p>
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
