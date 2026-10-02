'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, MessageCircle, Bell, Shield, Users, Ban } from 'lucide-react';
import { notificationApi, safetyApi } from '@/lib/api';

type SaveState = { kind: 'idle' | 'saving' } | { kind: 'saved' } | { kind: 'error'; message: string };

// The page shows 'everyone'; UserSafetySettings.allowMessagesFrom stores 'all'.
type Audience = 'everyone' | 'connections' | 'none';
const toStored = (value: Audience) => (value === 'everyone' ? 'all' : value);
const fromStored = (value?: string): Audience => (value === 'all' ? 'everyone' : value === 'none' ? 'none' : 'connections');

const toggleClasses =
  "w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-primary-600";

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
      <div>
        <div className="font-medium text-slate-900 dark:text-white">{label}</div>
        <div className="text-sm text-slate-600 dark:text-slate-400">{description}</div>
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className={toggleClasses} />
      </label>
    </div>
  );
}

export default function MessagesSettingsPage() {
  // Every control maps to something the API persists and enforces: the first
  // two to UserSafetySettings, the last two to the stored notification
  // preferences. There was a third safety switch here, "Filter offensive
  // content", which was stored and read back and did nothing: messages are
  // screened the same way for everyone, whatever it said. It is gone rather
  // than left promising something, and the section where it sat now says
  // where the real tools are.
  // What the server does for a member who has never chosen (the page below reads
  // the real answer): anyone may write, and a thread from someone she does not
  // follow arrives as a request. Starting from "connections only" here meant that
  // when her settings could not be loaded, saving anything else on this page
  // narrowed who could message her without her having picked it.
  const [settings, setSettings] = useState({
    allowMessagesFrom: 'everyone' as Audience,
    readReceipts: true,
    pushMessages: true,
    emailMessages: true,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' });

  useEffect(() => {
    let cancelled = false;

    Promise.allSettled([safetyApi.getSettings(), notificationApi.getPreferences()])
      .then(([safety, notifications]) => {
        if (cancelled) return;
        const safetyData = safety.status === 'fulfilled' ? safety.value.data?.data : null;
        const notificationData =
          notifications.status === 'fulfilled' ? notifications.value.data?.data : null;

        setSettings((current) => ({
          allowMessagesFrom: safetyData
            ? fromStored(safetyData.allowMessagesFrom)
            : current.allowMessagesFrom,
          readReceipts: safetyData ? !safetyData.hideReadReceipts : current.readReceipts,
          pushMessages: notificationData?.push?.messages ?? current.pushMessages,
          emailMessages: notificationData?.email?.messages ?? current.emailMessages,
        }));
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
      await Promise.all([
        safetyApi.updateSettings({
          allowMessagesFrom: toStored(settings.allowMessagesFrom),
          hideReadReceipts: !settings.readReceipts,
        }),
        notificationApi.updatePreferences({
          push: { messages: settings.pushMessages },
          email: { messages: settings.emailMessages },
        }),
      ]);
      setSaveState({ kind: 'saved' });
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      setSaveState({
        kind: 'error',
        message:
          status === 401 || status === 403
            ? 'Sign in again to change your message settings.'
            : 'Your message settings could not be saved. Try again.',
      });
    }
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
            <MessageCircle className="w-7 h-7" />
            Message Settings
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            Control who can message you and how you receive notifications.
          </p>
        </div>

        {/* Who Can Message You */}
        <section className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm mb-6 border border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Who can message you
          </h2>
          <div className="space-y-3">
            {[
              { value: 'everyone', label: 'Everyone', desc: 'Anyone on ATHENA can send you messages' },
              { value: 'connections', label: 'Connections only', desc: 'Only people you\'re connected with' },
              { value: 'none', label: 'No one', desc: 'Block all incoming messages' },
            ].map((option) => (
              <label
                key={option.value}
                className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition ${
                  settings.allowMessagesFrom === option.value
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="allowMessagesFrom"
                  value={option.value}
                  checked={settings.allowMessagesFrom === option.value}
                  onChange={(e) =>
                    setSettings({ ...settings, allowMessagesFrom: e.target.value as Audience })
                  }
                  className="mt-1"
                />
                <div>
                  <div className="font-medium text-slate-900 dark:text-white">{option.label}</div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">{option.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </section>

        {/* Privacy Options */}
        <section className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm mb-6 border border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Privacy Options
          </h2>
          <div className="space-y-4">
            <ToggleRow
              label="Read receipts"
              description="Let others know when you've read their messages"
              checked={settings.readReceipts}
              onChange={(readReceipts) => setSettings({ ...settings, readReceipts })}
            />
          </div>
        </section>

        {/* Notifications */}
        <section className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm mb-6 border border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notifications
          </h2>
          <div className="space-y-4">
            <ToggleRow
              label="Push notifications"
              description="Receive push notifications for new messages"
              checked={settings.pushMessages}
              onChange={(pushMessages) => setSettings({ ...settings, pushMessages })}
            />
            <ToggleRow
              label="Email notifications"
              description="Receive emails about new messages"
              checked={settings.emailMessages}
              onChange={(emailMessages) => setSettings({ ...settings, emailMessages })}
            />
          </div>
        </section>

        {/* If someone is being unkind. The tools are on the conversation itself,
            where she is when she needs them; this says where, and where to undo. */}
        <section className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm mb-6 border border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
            <Ban className="w-5 h-5" />
            If someone is bothering you
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Open the conversation and choose <strong>Report member</strong> or <strong>Block member</strong> from
            its menu. A person you block cannot message you, and you can undo it any time in{' '}
            <Link href="/dashboard/settings/privacy" className="underline text-primary-700 dark:text-primary-300">
              Settings &gt; Privacy
            </Link>
            .
          </p>
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
            {saveState.kind === 'saved' && 'Message settings saved.'}
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
    </div>
  );
}
