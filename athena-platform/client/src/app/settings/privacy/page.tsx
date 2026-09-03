'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, Shield, Eye, Users, Globe, Lock, UserX, Download, Trash2 } from 'lucide-react';
import { api, safetyApi } from '@/lib/api';

type SaveState = { kind: 'idle' | 'saving' } | { kind: 'saved' } | { kind: 'error'; message: string };

type DeleteState =
  | { kind: 'idle' | 'submitting' }
  | { kind: 'requested'; dueDate: string | null }
  | { kind: 'error'; message: string };

// The erasure endpoint rejects anything else, and typing it out is what keeps
// this from being a one-click action.
const DELETE_CONFIRMATION = 'DELETE_MY_ACCOUNT';

export default function PrivacySettingsPage() {
  // Every control here maps to a column the API actually persists. Toggles
  // without a backing store were removed rather than left to report a save that
  // never happened.
  const [settings, setSettings] = useState({
    profileVisibility: 'public', // 'public', 'connections', 'private'
    showOnlineStatus: true,
    showInMentorSearch: true,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' });
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleteState, setDeleteState] = useState<DeleteState>({ kind: 'idle' });

  useEffect(() => {
    let cancelled = false;

    safetyApi
      .getSettings()
      .then((response) => {
        const data = response.data?.data;
        if (cancelled || !data) return;
        setSettings({
          profileVisibility: data.profileVisibility ?? 'public',
          showOnlineStatus: !data.hideOnlineStatus,
          showInMentorSearch: !data.hideFromSearch,
        });
      })
      .catch(() => {
        // Falls back to the defaults already in state.
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    setSaveState({ kind: 'saving' });
    try {
      await safetyApi.updateSettings({
        profileVisibility: settings.profileVisibility as 'public' | 'connections' | 'private',
        hideOnlineStatus: !settings.showOnlineStatus,
        hideFromSearch: !settings.showInMentorSearch,
      });
      setSaveState({ kind: 'saved' });
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      setSaveState({
        kind: 'error',
        message:
          status === 401 || status === 403
            ? 'Sign in again to change your privacy settings.'
            : 'Your privacy settings could not be saved. Try again.',
      });
    }
  };

  const handleRequestDeletion = async () => {
    if (deleteInput !== DELETE_CONFIRMATION) return;

    setDeleteState({ kind: 'submitting' });
    try {
      const response = await api.post('/gdpr/dsar/delete', { confirmation: DELETE_CONFIRMATION });
      setDeleteState({ kind: 'requested', dueDate: response.data?.data?.dueDate ?? null });
      setIsDeleteOpen(false);
      setDeleteInput('');
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      setDeleteState({
        kind: 'error',
        message:
          status === 401 || status === 403
            ? 'Sign in again to request account deletion.'
            : 'Your deletion request could not be submitted. Try again.',
      });
    }
  };

  const closeDeleteDialog = () => {
    setIsDeleteOpen(false);
    setDeleteInput('');
    if (deleteState.kind === 'error') setDeleteState({ kind: 'idle' });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard/settings"
            className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Settings
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Shield className="w-7 h-7" />
            Privacy Settings
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            Control your privacy and who can see your information.
          </p>
        </div>

        {/* Profile Visibility */}
        <section className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm mb-6 border border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Profile Visibility
          </h2>
          <div className="space-y-3">
            {[
              { value: 'public', label: 'Public', desc: 'Anyone can view your profile', icon: Globe },
              { value: 'connections', label: 'Connections Only', desc: 'Only your connections can view your profile', icon: Users },
              { value: 'private', label: 'Private', desc: 'Only you can see your profile', icon: Lock },
            ].map((option) => (
              <label
                key={option.value}
                className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition ${
                  settings.profileVisibility === option.value
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="profileVisibility"
                  value={option.value}
                  checked={settings.profileVisibility === option.value}
                  onChange={(e) => setSettings({ ...settings, profileVisibility: e.target.value })}
                  className="mt-1"
                />
                <option.icon className="w-5 h-5 text-slate-500 mt-0.5" />
                <div>
                  <div className="font-medium text-slate-900 dark:text-white">{option.label}</div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">{option.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </section>

        {/* Activity & Presence */}
        <section className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm mb-6 border border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Activity & Presence
          </h2>
          <div className="space-y-4">
            {[
              { key: 'showOnlineStatus', label: 'Show online status', desc: 'Display green dot when you\'re online' },
              { key: 'showInMentorSearch', label: 'Appear in mentor search', desc: 'Let mentees find you in search results' },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
                <div>
                  <div className="font-medium text-slate-900 dark:text-white">{item.label}</div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">{item.desc}</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings[item.key as keyof typeof settings] as boolean}
                    onChange={(e) => setSettings({ ...settings, [item.key]: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-primary-600"></div>
                </label>
              </div>
            ))}
          </div>
        </section>

        {/* Data & Account */}
        <section className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm mb-6 border border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <UserX className="w-5 h-5" />
            Data & Account
          </h2>
          <div className="space-y-4">
            <Link
              href="/privacy-center"
              className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            >
              <div className="flex items-center gap-3">
                <Download className="w-5 h-5 text-primary-600" />
                <div>
                  <div className="font-medium text-slate-900 dark:text-white">Download your data</div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">Get a copy of all your data</div>
                </div>
              </div>
              <span className="text-primary-600">→</span>
            </Link>
            <Link
              href="/privacy-center#data-rights"
              className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            >
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-primary-600" />
                <div>
                  <div className="font-medium text-slate-900 dark:text-white">GDPR rights</div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">Manage your data protection rights</div>
                </div>
              </div>
              <span className="text-primary-600">→</span>
            </Link>
            <button
              onClick={() => setIsDeleteOpen(true)}
              disabled={deleteState.kind === 'requested'}
              className="flex items-center justify-between w-full p-4 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition text-left disabled:opacity-60"
            >
              <div className="flex items-center gap-3">
                <Trash2 className="w-5 h-5 text-red-600" />
                <div>
                  <div className="font-medium text-red-700 dark:text-red-400">Delete account</div>
                  <div className="text-sm text-red-600 dark:text-red-500">Permanently delete your account and data</div>
                </div>
              </div>
              <span className="text-red-600">→</span>
            </button>
            <p aria-live="polite" className="text-sm">
              {deleteState.kind === 'requested' && (
                <span className="text-slate-600 dark:text-slate-400">
                  Deletion requested. Your account and data will be erased
                  {deleteState.dueDate
                    ? ` by ${new Date(deleteState.dueDate).toLocaleDateString()}`
                    : ' within 30 days'}
                  . Reach us through the{' '}
                  <Link href="/help" className="underline">
                    Help Center
                  </Link>{' '}
                  before then if you change your mind.
                </span>
              )}
              {deleteState.kind === 'error' && (
                <span className="text-red-600 dark:text-red-400">{deleteState.message}</span>
              )}
            </p>
          </div>
        </section>

        {/* Save Button */}
        <div className="flex flex-wrap items-center justify-end gap-4">
          <p
            aria-live="polite"
            className={`mr-auto text-sm ${
              saveState.kind === 'error'
                ? 'text-red-600 dark:text-red-400'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {saveState.kind === 'saved' && 'Privacy settings saved.'}
            {saveState.kind === 'error' && saveState.message}
          </p>
          <Link
            href="/dashboard/settings"
            className="px-6 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            Cancel
          </Link>
          <button
            onClick={handleSave}
            disabled={isLoading || saveState.kind === 'saving'}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-60"
          >
            {saveState.kind === 'saving' ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {isDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Delete account</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">This cannot be undone</p>
              </div>
            </div>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              We record an erasure request and delete your account within 30 days. That removes your profile,
              posts, messages, job applications and saved items, and it cannot be reversed once it has been
              processed.
            </p>
            <label htmlFor="delete-confirmation" className="block text-sm text-slate-600 dark:text-slate-400 mb-2">
              Type <strong>{DELETE_CONFIRMATION}</strong> to confirm:
            </label>
            <input
              id="delete-confirmation"
              type="text"
              value={deleteInput}
              onChange={(event) => setDeleteInput(event.target.value)}
              placeholder={DELETE_CONFIRMATION}
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg mb-4 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
            />
            {deleteState.kind === 'error' && (
              <p className="text-sm text-red-600 dark:text-red-400 mb-4">{deleteState.message}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={closeDeleteDialog}
                className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleRequestDeletion}
                disabled={deleteInput !== DELETE_CONFIRMATION || deleteState.kind === 'submitting'}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleteState.kind === 'submitting' ? 'Requesting...' : 'Request deletion'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
