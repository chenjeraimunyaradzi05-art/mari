'use client';

import Link from 'next/link';
import {
  User,
  Database,
  CreditCard,
  Bell,
  Shield,
  Palette,
  Globe,
  HelpCircle,
  ChevronRight,
  LogOut,
} from 'lucide-react';
import { useAuth } from '@/lib/hooks';
import { cn } from '@/lib/utils';

const settingsGroups = [
  {
    title: 'Account',
    items: [
      {
        name: 'Profile',
        description: 'Update your personal information and profile',
        href: '/dashboard/settings/profile',
        icon: User,
      },
      {
        name: 'Privacy & Data',
        description: 'Download your data or delete your account',
        href: '/dashboard/settings/privacy',
        icon: Database,
      },
      {
        name: 'Billing & Subscription',
        description: 'Manage your subscription and payment methods',
        href: '/dashboard/settings/billing',
        icon: CreditCard,
      },
    ],
  },
  {
    title: 'Preferences',
    items: [
      {
        name: 'Notifications',
        description: 'Configure email and push notification preferences',
        href: '/dashboard/settings/notifications',
        icon: Bell,
      },
      {
        name: 'Appearance',
        description: 'Customize theme and display settings',
        href: '/dashboard/settings/appearance',
        icon: Palette,
      },
      {
        name: 'Language & Region',
        description: 'Set your preferred language and timezone',
        href: '/dashboard/settings/language',
        icon: Globe,
      },
    ],
  },
  {
    title: 'Security',
    items: [
      {
        name: 'Security',
        description: 'Password, two-factor authentication, and sessions',
        href: '/dashboard/settings/security',
        icon: Shield,
      },
    ],
  },
  {
    title: 'Support',
    items: [
      {
        name: 'Help Center',
        description: 'Get help and find answers to common questions',
        href: '/help',
        icon: HelpCircle,
        external: true,
      },
    ],
  },
];

export default function SettingsPage() {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    if (confirm('Are you sure you want to sign out?')) {
      await logout();
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Manage your account settings and preferences
        </p>
      </div>

      {/* Settings Groups */}
      <div className="space-y-6">
        {settingsGroups.map((group) => (
          <div key={group.title} className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-1">
              {group.title}
            </h2>
            <div className="card divide-y divide-gray-100 dark:divide-gray-800 p-0 overflow-hidden">
              {group.items.map((item, index) => (
                <Link
                  key={item.name}
                  href={item.href}
                  target={(item as any).external ? '_blank' : undefined}
                  className={cn(
                    'flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition',
                    index === 0 && 'rounded-t-xl',
                    index === group.items.length - 1 && 'rounded-b-xl'
                  )}
                >
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                      <item.icon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {item.name}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {item.description}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Logout */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-1">
          Session
        </h2>
        <div className="card p-0 overflow-hidden">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-between p-4 hover:bg-red-50 dark:hover:bg-red-900/20 transition text-left"
          >
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <LogOut className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="font-medium text-red-600 dark:text-red-400">Sign Out</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Sign out of your account on this device
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </div>

      {/* App Info */}
      <div className="text-center text-sm text-gray-400 dark:text-gray-500 pt-4">
        <p>ATHENA v1.0.0</p>
        <p className="mt-1">
          <Link href="/privacy" className="hover:underline">
            Privacy Policy
          </Link>
          {' • '}
          <Link href="/terms" className="hover:underline">
            Terms of Service
          </Link>
        </p>
      </div>
    </div>
  );
}
