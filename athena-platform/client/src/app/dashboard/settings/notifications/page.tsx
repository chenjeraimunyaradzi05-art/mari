'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Briefcase,
  Loader2,
  Megaphone,
  MessageCircle,
  Save,
  Shield,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useNotificationPreferences, useUpdateNotificationPreferences } from '@/lib/hooks';

type NotificationPreferences = {
  email: {
    jobMatches: boolean;
    applications: boolean;
    messages: boolean;
    mentions: boolean;
    newsletter: boolean;
  };
  push: {
    jobMatches: boolean;
    applications: boolean;
    messages: boolean;
    mentions: boolean;
  };
  inApp: {
    all: boolean;
  };
};

type EmailPreferenceKey = keyof NotificationPreferences['email'];
type PushPreferenceKey = keyof NotificationPreferences['push'];

type PreferenceSetting = {
  id: string;
  name: string;
  description: string;
  emailKey?: EmailPreferenceKey;
  pushKey?: PushPreferenceKey;
};

type NotificationCategory = {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  settings: PreferenceSetting[];
};

const DEFAULT_PREFERENCES: NotificationPreferences = {
  email: {
    jobMatches: true,
    applications: true,
    messages: true,
    mentions: true,
    newsletter: true,
  },
  push: {
    jobMatches: true,
    applications: true,
    messages: true,
    mentions: true,
  },
  inApp: {
    all: true,
  },
};

const notificationCategories: NotificationCategory[] = [
  {
    id: 'jobs',
    name: 'Jobs & Applications',
    description: 'Notifications about job opportunities and applications',
    icon: Briefcase,
    settings: [
      {
        id: 'jobMatches',
        name: 'Job Matches',
        description: 'New jobs matching your profile',
        emailKey: 'jobMatches',
        pushKey: 'jobMatches',
      },
      {
        id: 'applications',
        name: 'Application Updates',
        description: 'Status changes on your applications',
        emailKey: 'applications',
        pushKey: 'applications',
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
        id: 'mentions',
        name: 'Mentions',
        description: 'When someone mentions you',
        emailKey: 'mentions',
        pushKey: 'mentions',
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
        id: 'messages',
        name: 'New Messages',
        description: 'When you receive a new message',
        emailKey: 'messages',
        pushKey: 'messages',
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
        name: 'Newsletter',
        description: 'Career tips and community highlights',
        emailKey: 'newsletter',
      },
    ],
  },
];

function normalizePreferences(input: any): NotificationPreferences {
  return {
    email: {
      jobMatches: typeof input?.email?.jobMatches === 'boolean' ? input.email.jobMatches : DEFAULT_PREFERENCES.email.jobMatches,
      applications: typeof input?.email?.applications === 'boolean' ? input.email.applications : DEFAULT_PREFERENCES.email.applications,
      messages: typeof input?.email?.messages === 'boolean' ? input.email.messages : DEFAULT_PREFERENCES.email.messages,
      mentions: typeof input?.email?.mentions === 'boolean' ? input.email.mentions : DEFAULT_PREFERENCES.email.mentions,
      newsletter: typeof input?.email?.newsletter === 'boolean' ? input.email.newsletter : DEFAULT_PREFERENCES.email.newsletter,
    },
    push: {
      jobMatches: typeof input?.push?.jobMatches === 'boolean' ? input.push.jobMatches : DEFAULT_PREFERENCES.push.jobMatches,
      applications: typeof input?.push?.applications === 'boolean' ? input.push.applications : DEFAULT_PREFERENCES.push.applications,
      messages: typeof input?.push?.messages === 'boolean' ? input.push.messages : DEFAULT_PREFERENCES.push.messages,
      mentions: typeof input?.push?.mentions === 'boolean' ? input.push.mentions : DEFAULT_PREFERENCES.push.mentions,
    },
    inApp: {
      all: typeof input?.inApp?.all === 'boolean' ? input.inApp.all : DEFAULT_PREFERENCES.inApp.all,
    },
  };
}

function Toggle({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <label className={`relative inline-flex items-center ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="sr-only peer"
        aria-label={label}
      />
      <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600" />
    </label>
  );
}

export default function NotificationsSettingsPage() {
  const { data: savedPreferences, isLoading, isError } = useNotificationPreferences();
  const updatePreferences = useUpdateNotificationPreferences();
  const [draft, setDraft] = useState<NotificationPreferences | null>(null);

  const persisted = useMemo(
    () => (savedPreferences ? normalizePreferences(savedPreferences) : null),
    [savedPreferences]
  );

  useEffect(() => {
    if (persisted) {
      setDraft(persisted);
    }
  }, [persisted]);

  const hasChanges = Boolean(
    draft &&
    persisted &&
    JSON.stringify(draft) !== JSON.stringify(persisted)
  );

  const handleToggleEmail = (key: EmailPreferenceKey) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            email: {
              ...current.email,
              [key]: !current.email[key],
            },
          }
        : current
    );
  };

  const handleTogglePush = (key: PushPreferenceKey) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            push: {
              ...current.push,
              [key]: !current.push[key],
            },
          }
        : current
    );
  };

  const handleToggleInApp = () => {
    setDraft((current) =>
      current
        ? {
            ...current,
            inApp: {
              all: !current.inApp.all,
            },
          }
        : current
    );
  };

  const handleSave = () => {
    if (!draft) return;
    updatePreferences.mutate(draft, {
      onSuccess: (response: any) => {
        setDraft(normalizePreferences(response?.data?.data));
      },
    });
  };

  const setAllEmail = (enabled: boolean) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            email: {
              jobMatches: enabled,
              applications: enabled,
              messages: enabled,
              mentions: enabled,
              newsletter: enabled,
            },
          }
        : current
    );
  };

  const setAllPush = (enabled: boolean) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            push: {
              jobMatches: enabled,
              applications: enabled,
              messages: enabled,
              mentions: enabled,
            },
          }
        : current
    );
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Notification Settings
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
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

      {isLoading ? (
        <div className="card flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading notification preferences...
        </div>
      ) : isError || !draft ? (
        <div className="card border-red-200 bg-red-50 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
          Notification preferences could not be loaded.
        </div>
      ) : (
        <>
          <div className="card">
            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
              Quick Actions
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setAllEmail(true)}
                className="btn-outline px-3 py-1.5 text-sm"
              >
                Enable All Email
              </button>
              <button
                onClick={() => setAllEmail(false)}
                className="btn-outline px-3 py-1.5 text-sm"
              >
                Disable All Email
              </button>
              <button
                onClick={() => setAllPush(true)}
                className="btn-outline px-3 py-1.5 text-sm"
              >
                Enable All Push
              </button>
              <button
                onClick={() => setAllPush(false)}
                className="btn-outline px-3 py-1.5 text-sm"
              >
                Disable All Push
              </button>
            </div>
          </div>

          <div className="space-y-6">
            {notificationCategories.map((category) => (
              <div key={category.id} className="card">
                <div className="flex items-start space-x-4 mb-6">
                  <div className="p-2 bg-primary-50 dark:bg-primary-900/30 rounded-lg">
                    <category.icon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                      {category.name}
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {category.description}
                    </p>
                  </div>
                </div>

                <div className="hidden sm:grid sm:grid-cols-3 gap-4 mb-4 text-sm font-medium text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-2">
                  <div>Notification</div>
                  <div className="text-center">Email</div>
                  <div className="text-center">Push</div>
                </div>

                <div className="space-y-4">
                  {category.settings.map((setting) => (
                    <div
                      key={setting.id}
                      className="sm:grid sm:grid-cols-3 gap-4 items-center py-2"
                    >
                      <div className="mb-2 sm:mb-0">
                        <p className="font-medium text-slate-900 dark:text-white text-sm">
                          {setting.name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {setting.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 sm:justify-center">
                        {setting.emailKey ? (
                          <Toggle
                            checked={draft.email[setting.emailKey]}
                            label={`${setting.name} email notifications`}
                            onChange={() => handleToggleEmail(setting.emailKey!)}
                          />
                        ) : (
                          <span className="text-xs text-slate-400">Not available</span>
                        )}
                        <span className="sm:hidden text-sm text-slate-500">Email</span>
                      </div>
                      <div className="flex items-center gap-2 sm:justify-center">
                        {setting.pushKey ? (
                          <Toggle
                            checked={draft.push[setting.pushKey]}
                            label={`${setting.name} push notifications`}
                            onChange={() => handleTogglePush(setting.pushKey!)}
                          />
                        ) : (
                          <span className="text-xs text-slate-400">Not available</span>
                        )}
                        <span className="sm:hidden text-sm text-slate-500">Push</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="flex items-start space-x-4">
              <div className="p-2 bg-primary-50 dark:bg-primary-900/30 rounded-lg">
                <Bell className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  In-App Notifications
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Alerts inside your ATHENA workspace
                </p>
              </div>
              <Toggle
                checked={draft.inApp.all}
                label="In-app notifications"
                onChange={handleToggleInApp}
              />
            </div>
          </div>

          <div className="card">
            <div className="flex items-start space-x-4">
              <div className="p-2 bg-primary-50 dark:bg-primary-900/30 rounded-lg">
                <Shield className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Security Notifications
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Account-security alerts remain required and are not configurable here.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
