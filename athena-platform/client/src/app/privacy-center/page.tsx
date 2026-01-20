'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store';
import { Shield, Download, Trash2, Edit3, Eye, EyeOff, Bell, Lock, Cookie, Globe, ChevronRight, AlertTriangle, Check, Loader2 } from 'lucide-react';
import Link from 'next/link';

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

export default function PrivacyCenterPage() {
  const { user, isAuthenticated } = useAuthStore();
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

  useEffect(() => {
    if (isAuthenticated) {
      fetchPrivacyData();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

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
    try {
      const res = await fetch('/api/gdpr/dsar/export', {
        method: 'POST',
        credentials: 'include',
      });
      const { data } = await res.json();
      if (data?.downloadUrl) {
        // Refresh DSAR history
        fetchPrivacyData();
        alert('Your data export is ready! Check your email for the download link.');
      }
    } catch (error) {
      console.error('Failed to request export:', error);
      alert('Failed to request data export. Please try again.');
    } finally {
      setExportLoading(false);
    }
  };

  const requestAccountDeletion = async () => {
    if (deleteInput !== 'DELETE_MY_ACCOUNT') return;

    try {
      const res = await fetch('/api/gdpr/dsar/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ confirmation: 'DELETE_MY_ACCOUNT' }),
      });
      if (res.ok) {
        alert('Your deletion request has been submitted. Your account will be deleted within 30 days.');
        setDeleteConfirm(false);
        setDeleteInput('');
        fetchPrivacyData();
      }
    } catch (error) {
      console.error('Failed to request deletion:', error);
      alert('Failed to submit deletion request. Please try again.');
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
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
          <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Your Data Rights</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {/* Export Data */}
              <button
                onClick={requestDataExport}
                disabled={exportLoading}
                className="flex items-center gap-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 transition text-left"
              >
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                  {exportLoading ? (
                    <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                  ) : (
                    <Download className="w-6 h-6 text-blue-600" />
                  )}
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">Download My Data</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Get a copy of all your personal data</p>
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
                  <h3 className="font-medium text-gray-900 dark:text-white">Delete My Account</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Permanently delete all your data</p>
                </div>
              </button>
            </div>
          </section>
        )}

        {/* Consent Management */}
        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-6">
            <Bell className="w-5 h-5 text-purple-600" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Communication Preferences</h2>
          </div>
          <div className="space-y-4">
            {(['MARKETING_EMAIL', 'MARKETING_SMS', 'MARKETING_PUSH'] as const).map((key) => (
              <div key={key} className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">{CONSENT_DESCRIPTIONS[key].title}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{CONSENT_DESCRIPTIONS[key].description}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consents[key]}
                    onChange={(e) => updateConsent(key, e.target.checked)}
                    className="sr-only peer"
                    disabled={!isAuthenticated}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                </label>
              </div>
            ))}
          </div>
        </section>

        {/* Data Processing Consents */}
        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-6">
            <Lock className="w-5 h-5 text-purple-600" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Data Processing</h2>
          </div>
          <div className="space-y-4">
            {(['DATA_PROCESSING', 'ANALYTICS', 'PERSONALIZATION', 'THIRD_PARTY_SHARING'] as const).map((key) => (
              <div key={key} className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-900 dark:text-white">{CONSENT_DESCRIPTIONS[key].title}</h3>
                    {CONSENT_DESCRIPTIONS[key].required && (
                      <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded">Required</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{CONSENT_DESCRIPTIONS[key].description}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer ml-4">
                  <input
                    type="checkbox"
                    checked={consents[key]}
                    onChange={(e) => updateConsent(key, e.target.checked)}
                    className="sr-only peer"
                    disabled={!isAuthenticated || CONSENT_DESCRIPTIONS[key].required}
                  />
                  <div className={`w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600 ${CONSENT_DESCRIPTIONS[key].required ? 'opacity-60 cursor-not-allowed' : ''}`}></div>
                </label>
              </div>
            ))}
          </div>
        </section>

        {/* Cookie Settings Link */}
        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Cookie className="w-5 h-5 text-purple-600" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Cookie Preferences</h2>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
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
          <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Request History</h2>
            <div className="space-y-3">
              {dsarHistory.map((request) => (
                <div key={request.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-750 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white capitalize">
                      {request.type.toLowerCase().replace('_', ' ')} Request
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
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
                      <a href={request.downloadUrl} className="text-purple-600 hover:underline text-sm">
                        Download
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Legal Links */}
        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Legal Documents</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <Link href="/privacy" className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750">
              <Eye className="w-5 h-5 text-gray-400" />
              <span className="text-gray-700 dark:text-gray-300">Privacy Policy</span>
            </Link>
            <Link href="/terms" className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750">
              <Globe className="w-5 h-5 text-gray-400" />
              <span className="text-gray-700 dark:text-gray-300">Terms of Service</span>
            </Link>
          </div>
        </section>

        {/* Contact DPO */}
        <section className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Questions about your privacy?</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Contact our Data Protection Officer for any privacy-related inquiries or to exercise your rights.
          </p>
          <a href="mailto:privacy@athena.com" className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700 font-medium">
            privacy@athena.com
          </a>
        </section>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Delete Account</h3>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Your account and all associated data will be permanently deleted within 30 days. This includes your profile, posts, messages, and all other content.
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Type <strong>DELETE_MY_ACCOUNT</strong> to confirm:
            </p>
            <input
              type="text"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg mb-4 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="DELETE_MY_ACCOUNT"
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setDeleteConfirm(false);
                  setDeleteInput('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
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
