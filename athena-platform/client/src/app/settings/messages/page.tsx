'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, MessageCircle, Bell, Shield, Users, Ban, Volume2, VolumeX } from 'lucide-react';

export default function MessagesSettingsPage() {
  const [settings, setSettings] = useState({
    allowMessagesFrom: 'connections', // 'everyone', 'connections', 'none'
    readReceipts: true,
    typingIndicators: true,
    soundNotifications: true,
    pushNotifications: true,
    emailDigest: 'daily', // 'instant', 'daily', 'weekly', 'none'
    autoArchive: false,
    spamFilter: 'moderate', // 'aggressive', 'moderate', 'off'
  });

  const handleSave = () => {
    // Simulating save
    alert('Settings saved successfully!');
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
                  onChange={(e) => setSettings({ ...settings, allowMessagesFrom: e.target.value })}
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
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <div>
                <div className="font-medium text-slate-900 dark:text-white">Read receipts</div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Let others know when you&apos;ve read their messages
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.readReceipts}
                  onChange={(e) => setSettings({ ...settings, readReceipts: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-primary-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <div>
                <div className="font-medium text-slate-900 dark:text-white">Typing indicators</div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Show when you&apos;re typing a message
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.typingIndicators}
                  onChange={(e) => setSettings({ ...settings, typingIndicators: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-primary-600"></div>
              </label>
            </div>
          </div>
        </section>

        {/* Notifications */}
        <section className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm mb-6 border border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notifications
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <div className="flex items-center gap-3">
                {settings.soundNotifications ? (
                  <Volume2 className="w-5 h-5 text-primary-600" />
                ) : (
                  <VolumeX className="w-5 h-5 text-slate-400" />
                )}
                <div>
                  <div className="font-medium text-slate-900 dark:text-white">Sound notifications</div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Play sound when receiving messages
                  </div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.soundNotifications}
                  onChange={(e) => setSettings({ ...settings, soundNotifications: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-primary-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <div>
                <div className="font-medium text-slate-900 dark:text-white">Push notifications</div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Receive push notifications on your device
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.pushNotifications}
                  onChange={(e) => setSettings({ ...settings, pushNotifications: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-primary-600"></div>
              </label>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <div className="font-medium text-slate-900 dark:text-white mb-2">Email digest</div>
              <select
                value={settings.emailDigest}
                onChange={(e) => setSettings({ ...settings, emailDigest: e.target.value })}
                className="w-full p-2 border rounded-lg dark:bg-slate-800 dark:border-slate-600"
              >
                <option value="instant">Instant (every message)</option>
                <option value="daily">Daily summary</option>
                <option value="weekly">Weekly summary</option>
                <option value="none">None</option>
              </select>
            </div>
          </div>
        </section>

        {/* Spam Protection */}
        <section className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm mb-6 border border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Ban className="w-5 h-5" />
            Spam Protection
          </h2>
          <div className="space-y-3">
            {[
              { value: 'aggressive', label: 'Aggressive', desc: 'Block most unsolicited messages' },
              { value: 'moderate', label: 'Moderate', desc: 'Balanced spam filtering (recommended)' },
              { value: 'off', label: 'Off', desc: 'Don\'t filter messages automatically' },
            ].map((option) => (
              <label
                key={option.value}
                className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition ${
                  settings.spamFilter === option.value
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="spamFilter"
                  value={option.value}
                  checked={settings.spamFilter === option.value}
                  onChange={(e) => setSettings({ ...settings, spamFilter: e.target.value })}
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

        {/* Save Button */}
        <div className="flex justify-end gap-4">
          <Link
            href="/dashboard/settings"
            className="px-6 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            Cancel
          </Link>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
