'use client';

import { useState } from 'react';
import {
  Bell,
  Mail,
  MessageCircle,
  Briefcase,
  Users,
  Megaphone,
  Shield,
  Save,
} from 'lucide-react';
import { useNotificationPreferences, useUpdateNotificationPreferences, useAuth } from '@/lib/hooks';
import { cn } from '@/lib/utils';

type NotificationCategory = {
  id: string;
  name: string;
  description: string;
  icon: any;
  settings: {
    id: string;
    name: string;
    description: string;
    email: boolean;
    push: boolean;
    inApp: boolean;
  }[];
};

const defaultCategories: NotificationCategory[] = [
  {
    id: 'jobs',
    name: 'Jobs & Applications',
    description: 'Notifications about job opportunities and your applications',
    icon: Briefcase,
    settings: [
      {
        id: 'job_recommendations',
        name: 'Job Recommendations',
        description: 'New jobs matching your profile',
        email: true,
        push: true,
        inApp: true,
      },
      {
        id: 'application_updates',
        name: 'Application Updates',
        description: 'Status changes on your applications',
        email: true,
        push: true,
        inApp: true,
      },
      {
        id: 'saved_job_alerts',
        name: 'Saved Job Alerts',
        description: 'Updates on jobs you\'ve saved',
        email: true,
        push: false,
        inApp: true,
      },
    ],
  },
  {
    id: 'community',
    name: 'Community & Social',
    description: 'Interactions from other ATHENA members',
    icon: Users,
    settings: [
      {
        id: 'new_followers',
        name: 'New Followers',
        description: 'When someone follows you',
        email: false,
        push: true,
        inApp: true,
      },
      {
        id: 'post_interactions',
        name: 'Post Interactions',
        description: 'Likes and comments on your posts',
        email: false,
        push: true,
        inApp: true,
      },
      {
        id: 'mentions',
        name: 'Mentions',
        description: 'When someone mentions you',
        email: true,
        push: true,
        inApp: true,
      },
    ],
  },
  {
    id: 'messages',
    name: 'Messages',
    description: 'Direct messages and conversations',
    icon: MessageCircle,
    settings: [
      {
        id: 'new_messages',
        name: 'New Messages',
        description: 'When you receive a new message',
        email: true,
        push: true,
        inApp: true,
      },
      {
        id: 'message_requests',
        name: 'Message Requests',
        description: 'Messages from new connections',
        email: true,
        push: true,
        inApp: true,
      },
    ],
  },
  {
    id: 'marketing',
    name: 'Marketing & Updates',
    description: 'News, tips, and promotional content',
    icon: Megaphone,
    settings: [
      {
        id: 'newsletter',
        name: 'Weekly Newsletter',
        description: 'Career tips and community highlights',
        email: true,
        push: false,
        inApp: false,
      },
      {
        id: 'product_updates',
        name: 'Product Updates',
        description: 'New features and improvements',
        email: true,
        push: false,
        inApp: true,
      },
      {
        id: 'events',
        name: 'Events & Webinars',
        description: 'Upcoming ATHENA events',
        email: true,
        push: true,
        inApp: true,
      },
    ],
  },
  {
    id: 'security',
    name: 'Security & Account',
    description: 'Important account and security notifications',
    icon: Shield,
    settings: [
      {
        id: 'login_alerts',
        name: 'Login Alerts',
        description: 'Unusual login activity',
        email: true,
        push: true,
        inApp: true,
      },
      {
        id: 'password_changes',
        name: 'Password Changes',
        description: 'When your password is changed',
        email: true,
        push: true,
        inApp: true,
      },
    ],
  },
];

export default function NotificationsSettingsPage() {
  const { user } = useAuth();
  const { data: savedPreferences } = useNotificationPreferences();
  const updatePreferences = useUpdateNotificationPreferences();
  const [categories, setCategories] = useState(defaultCategories);
  const [hasChanges, setHasChanges] = useState(false);

  const handleToggle = (
    categoryId: string,
    settingId: string,
    channel: 'email' | 'push' | 'inApp'
  ) => {
    setCategories((prev) =>
      prev.map((category) => {
        if (category.id !== categoryId) return category;
        return {
          ...category,
          settings: category.settings.map((setting) => {
            if (setting.id !== settingId) return setting;
            return {
              ...setting,
              [channel]: !setting[channel],
            };
          }),
        };
      })
    );
    setHasChanges(true);
  };

  const handleSave = () => {
    const preferences = categories.flatMap((category) =>
      category.settings.map((setting) => ({
        id: setting.id,
        email: setting.email,
        push: setting.push,
        inApp: setting.inApp,
      }))
    );

    updatePreferences.mutate(
      { preferences },
      {
        onSuccess: () => {
          setHasChanges(false);
        },
      }
    );
  };

  const handleToggleAll = (channel: 'email' | 'push' | 'inApp', enabled: boolean) => {
    setCategories((prev) =>
      prev.map((category) => ({
        ...category,
        settings: category.settings.map((setting) => ({
          ...setting,
          [channel]: enabled,
        })),
      }))
    );
    setHasChanges(true);
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Notification Settings
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Control how and when you receive notifications
          </p>
        </div>
        {hasChanges && (
          <button
            onClick={handleSave}
            disabled={updatePreferences.isPending}
            className="btn-primary px-4 py-2 flex items-center space-x-2"
          >
            <Save className="w-4 h-4" />
            <span>{updatePreferences.isPending ? 'Saving...' : 'Save Changes'}</span>
          </button>
        )}
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
          Quick Actions
        </h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleToggleAll('email', true)}
            className="btn-outline px-3 py-1.5 text-sm"
          >
            Enable All Email
          </button>
          <button
            onClick={() => handleToggleAll('email', false)}
            className="btn-outline px-3 py-1.5 text-sm"
          >
            Disable All Email
          </button>
          <button
            onClick={() => handleToggleAll('push', true)}
            className="btn-outline px-3 py-1.5 text-sm"
          >
            Enable All Push
          </button>
          <button
            onClick={() => handleToggleAll('push', false)}
            className="btn-outline px-3 py-1.5 text-sm"
          >
            Disable All Push
          </button>
        </div>
      </div>

      {/* Notification Categories */}
      <div className="space-y-6">
        {categories.map((category) => (
          <div key={category.id} className="card">
            <div className="flex items-start space-x-4 mb-6">
              <div className="p-2 bg-primary-50 dark:bg-primary-900/30 rounded-lg">
                <category.icon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {category.name}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {category.description}
                </p>
              </div>
            </div>

            {/* Table Header */}
            <div className="hidden sm:grid sm:grid-cols-4 gap-4 mb-4 text-sm font-medium text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800 pb-2">
              <div>Notification</div>
              <div className="text-center">Email</div>
              <div className="text-center">Push</div>
              <div className="text-center">In-App</div>
            </div>

            {/* Settings */}
            <div className="space-y-4">
              {category.settings.map((setting) => (
                <div
                  key={setting.id}
                  className="sm:grid sm:grid-cols-4 gap-4 items-center py-2"
                >
                  <div className="mb-2 sm:mb-0">
                    <p className="font-medium text-gray-900 dark:text-white text-sm">
                      {setting.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {setting.description}
                    </p>
                  </div>
                  <div className="flex sm:justify-center">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={setting.email}
                        onChange={() => handleToggle(category.id, setting.id, 'email')}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                      <span className="sm:hidden ml-2 text-sm text-gray-500">Email</span>
                    </label>
                  </div>
                  <div className="flex sm:justify-center">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={setting.push}
                        onChange={() => handleToggle(category.id, setting.id, 'push')}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                      <span className="sm:hidden ml-2 text-sm text-gray-500">Push</span>
                    </label>
                  </div>
                  <div className="flex sm:justify-center">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={setting.inApp}
                        onChange={() => handleToggle(category.id, setting.id, 'inApp')}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                      <span className="sm:hidden ml-2 text-sm text-gray-500">In-App</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Email Digest */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Email Digest
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">
                Daily Digest
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Receive a daily summary of your notifications
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">
                Weekly Digest
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Receive a weekly summary every Monday
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" defaultChecked className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
