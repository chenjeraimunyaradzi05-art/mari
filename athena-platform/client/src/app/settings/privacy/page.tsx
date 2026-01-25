'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Shield, Eye, EyeOff, Users, Globe, Lock, UserX, Download, Trash2 } from 'lucide-react';

export default function PrivacySettingsPage() {
  const [settings, setSettings] = useState({
    profileVisibility: 'public', // 'public', 'connections', 'private'
    showEmail: false,
    showPhone: false,
    showLocation: true,
    showActivity: true,
    showConnections: true,
    allowIndexing: true,
    showInMentorSearch: true,
    showOnlineStatus: true,
  });

  const handleSave = () => {
    alert('Privacy settings saved!');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard/settings"
            className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Settings
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Shield className="w-7 h-7" />
            Privacy Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Control your privacy and who can see your information.
          </p>
        </div>

        {/* Profile Visibility */}
        <section className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm mb-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
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
                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750'
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
                <option.icon className="w-5 h-5 text-gray-500 mt-0.5" />
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">{option.label}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">{option.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </section>

        {/* Contact Information */}
        <section className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm mb-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <EyeOff className="w-5 h-5" />
            Contact Information Visibility
          </h2>
          <div className="space-y-4">
            {[
              { key: 'showEmail', label: 'Show email address', desc: 'Display your email on your profile' },
              { key: 'showPhone', label: 'Show phone number', desc: 'Display your phone number on your profile' },
              { key: 'showLocation', label: 'Show location', desc: 'Display your city/country on your profile' },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-750 rounded-lg">
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">{item.label}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">{item.desc}</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings[item.key as keyof typeof settings] as boolean}
                    onChange={(e) => setSettings({ ...settings, [item.key]: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                </label>
              </div>
            ))}
          </div>
        </section>

        {/* Activity & Presence */}
        <section className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm mb-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Activity & Presence
          </h2>
          <div className="space-y-4">
            {[
              { key: 'showActivity', label: 'Show activity status', desc: 'Let others see when you\'re active' },
              { key: 'showConnections', label: 'Show connections', desc: 'Display your connection count on your profile' },
              { key: 'showOnlineStatus', label: 'Show online status', desc: 'Display green dot when you\'re online' },
              { key: 'showInMentorSearch', label: 'Appear in mentor search', desc: 'Let mentees find you in search results' },
              { key: 'allowIndexing', label: 'Allow search engine indexing', desc: 'Let your profile appear in Google search results' },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-750 rounded-lg">
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">{item.label}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">{item.desc}</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings[item.key as keyof typeof settings] as boolean}
                    onChange={(e) => setSettings({ ...settings, [item.key]: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                </label>
              </div>
            ))}
          </div>
        </section>

        {/* Data & Account */}
        <section className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm mb-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <UserX className="w-5 h-5" />
            Data & Account
          </h2>
          <div className="space-y-4">
            <Link
              href="/privacy-center"
              className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-750 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
            >
              <div className="flex items-center gap-3">
                <Download className="w-5 h-5 text-primary-600" />
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">Download your data</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Get a copy of all your data</div>
                </div>
              </div>
              <span className="text-primary-600">→</span>
            </Link>
            <Link
              href="/settings/privacy/gdpr"
              className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-750 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
            >
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-primary-600" />
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">GDPR rights</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Manage your data protection rights</div>
                </div>
              </div>
              <span className="text-primary-600">→</span>
            </Link>
            <button className="flex items-center justify-between w-full p-4 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition text-left">
              <div className="flex items-center gap-3">
                <Trash2 className="w-5 h-5 text-red-600" />
                <div>
                  <div className="font-medium text-red-700 dark:text-red-400">Delete account</div>
                  <div className="text-sm text-red-600 dark:text-red-500">Permanently delete your account and data</div>
                </div>
              </div>
              <span className="text-red-600">→</span>
            </button>
          </div>
        </section>

        {/* Save Button */}
        <div className="flex justify-end gap-4">
          <Link
            href="/dashboard/settings"
            className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
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
