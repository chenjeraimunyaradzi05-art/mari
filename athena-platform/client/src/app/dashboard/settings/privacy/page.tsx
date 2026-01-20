'use client';

import { useEffect, useMemo, useState } from 'react';
import { Database, Trash2, Download, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { useExportMyData, useDeleteAccount } from '@/lib/hooks';
import { userApi } from '@/lib/api';
import { getStoredPreference } from '@/lib/utils';

export default function PrivacySettingsPage() {
  const exportMyData = useExportMyData();
  const deleteAccount = useDeleteAccount();
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [consentMarketing, setConsentMarketing] = useState(false);
  const [consentDataProcessing, setConsentDataProcessing] = useState(false);
  const [consentCookies, setConsentCookies] = useState(false);
  const [consentDoNotSell, setConsentDoNotSell] = useState(false);

  const isUsRegion = useMemo(
    () => getStoredPreference('athena.region', 'ANZ') === 'US',
    []
  );
  const isUkEuRegion = useMemo(() => {
    const region = getStoredPreference('athena.region', 'ANZ');
    return region === 'UK' || region === 'EU';
  }, []);

  useEffect(() => {
    let active = true;

    userApi
      .getConsents()
      .then((response) => {
        if (!active) return;
        const data = response.data?.data;
        setConsentMarketing(!!data?.consentMarketing);
        setConsentDataProcessing(!!data?.consentDataProcessing);
        setConsentCookies(!!data?.consentCookies);
        setConsentDoNotSell(!!data?.consentDoNotSell);
      })
      .catch(() => {
        toast.error('Failed to load privacy preferences');
      });

    return () => {
      active = false;
    };
  }, []);

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      const response = await exportMyData.mutateAsync();
      const payload = response.data?.data;

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json;charset=utf-8',
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `athena-my-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast.success('Download started');
    } catch {
      // toast handled by hook
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDelete = async () => {
    const first = confirm(
      'Delete your account? This will remove personal profile data and revoke access.'
    );
    if (!first) return;

    const second = confirm('This cannot be undone. Are you sure?');
    if (!second) return;

    await deleteAccount.mutateAsync();
  };

  const handleSaveConsents = async () => {
    setIsSaving(true);
    try {
      await userApi.updateConsents({
        consentMarketing,
        consentDataProcessing,
        consentCookies,
        consentDoNotSell: isUsRegion ? consentDoNotSell : undefined,
      });
      toast.success('Privacy preferences updated');
    } catch {
      toast.error('Failed to update privacy preferences');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Privacy & Data
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Download your data or delete your account
        </p>
      </div>

      <div className="card">
        <div className="flex items-start space-x-4">
          <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Privacy Preferences
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Control how your data is used for personalization and marketing.
            </p>

            <div className="mt-4 space-y-3">
              <label className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    Data processing
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Allow ATHENA to process your data to deliver core services.
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={consentDataProcessing}
                  onChange={(e) => setConsentDataProcessing(e.target.checked)}
                />
              </label>

              <label className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    Cookies & analytics
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Enable cookies for analytics and product improvements.
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={consentCookies}
                  onChange={(e) => setConsentCookies(e.target.checked)}
                />
              </label>

              <label className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    Marketing updates
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Receive product updates and offers via email.
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={consentMarketing}
                  onChange={(e) => setConsentMarketing(e.target.checked)}
                />
              </label>

              {isUsRegion && (
                <label className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      Do Not Sell/Share My Personal Information
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Opt out of the sale or sharing of personal information.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={consentDoNotSell}
                    onChange={(e) => setConsentDoNotSell(e.target.checked)}
                  />
                </label>
              )}
            </div>

            <div className="mt-5">
              <button
                type="button"
                onClick={handleSaveConsents}
                disabled={isSaving}
                className="btn-primary px-4 py-2"
              >
                {isSaving ? 'Saving…' : 'Save preferences'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {isUkEuRegion && (
        <div className="card">
          <div className="flex items-start space-x-4">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                UK/EU GDPR Rights
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                You can request access, correction, restriction, or deletion of your data at any time.
              </p>
              <div className="mt-3 text-sm text-gray-600 dark:text-gray-300">
                For UK users, ATHENA follows UK GDPR and ICO guidance. Learn more in the{' '}
                <a className="text-primary-600 hover:underline" href="/privacy">Privacy Policy</a>.
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex items-start space-x-4">
          <div className="p-2 bg-primary-50 dark:bg-primary-900/30 rounded-lg">
            <Database className="w-5 h-5 text-primary-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Download My Data
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Export a JSON copy of your account data.
            </p>

            <div className="mt-4">
              <button
                type="button"
                onClick={handleDownload}
                disabled={isDownloading || exportMyData.isPending}
                className="btn-outline px-4 py-2 inline-flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                {isDownloading ? 'Preparing…' : 'Download'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-start space-x-4">
          <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
            <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Delete Account
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Deletes personal profile data and revokes access by anonymizing your account.
            </p>

            <div className="mt-4">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteAccount.isPending}
                className="btn-outline px-4 py-2 inline-flex items-center gap-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <Trash2 className="w-4 h-4" />
                {deleteAccount.isPending ? 'Deleting…' : 'Delete my account'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
