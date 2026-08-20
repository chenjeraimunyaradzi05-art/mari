'use client';

import Link from 'next/link';
import { ChevronLeft, Settings, Globe, Bell, Shield, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AdminSettingsPage() {
  const settingSections = [
    {
      icon: Globe,
      title: 'Platform Settings',
      description: 'General platform configuration',
      items: [
        { label: 'Platform Name', value: 'ATHENA' },
        { label: 'Support Email', value: 'support@athena.com' },
        { label: 'Maintenance Mode', value: 'Disabled' },
      ],
    },
    {
      icon: Bell,
      title: 'Notification Settings',
      description: 'System-wide notification preferences',
      items: [
        { label: 'Email Notifications', value: 'Enabled' },
        { label: 'Push Notifications', value: 'Enabled' },
        { label: 'Admin Alerts', value: 'All Events' },
      ],
    },
    {
      icon: Shield,
      title: 'Security Settings',
      description: 'Security and access controls',
      items: [
        { label: 'Two-Factor Auth', value: 'Optional' },
        { label: 'Session Timeout', value: '7 days' },
        { label: 'Rate Limiting', value: '100 req/15min' },
      ],
    },
    {
      icon: Database,
      title: 'Data Management',
      description: 'Database and storage settings',
      items: [
        { label: 'Database', value: 'PostgreSQL' },
        { label: 'Storage', value: 'AWS S3' },
        { label: 'CDN', value: 'CloudFront' },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <header className="bg-white dark:bg-slate-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-slate-500 hover:text-slate-700">
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Platform Settings</h1>
              <p className="text-slate-600 dark:text-slate-400">Configure platform behavior</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {settingSections.map((section) => (
            <div key={section.title} className="bg-white dark:bg-slate-800 rounded-lg shadow">
              <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg">
                    <section.icon className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">{section.title}</h3>
                    <p className="text-sm text-slate-500">{section.description}</p>
                  </div>
                </div>
              </div>
              <div className="p-6 space-y-4">
                {section.items.map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400">{item.label}</span>
                    <span className="font-medium text-slate-900 dark:text-white">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Info Banner */}
        <div className="mt-8 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-6">
          <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-2">
            Settings Management
          </h3>
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Platform settings are currently managed through environment variables and configuration files. 
            A full settings management interface with real-time editing is planned for a future release.
          </p>
        </div>

        {/* Environment Info */}
        <div className="mt-6 bg-white dark:bg-slate-800 rounded-lg shadow p-6">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Environment Information</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-slate-500">Environment</span>
              <p className="font-medium text-slate-900 dark:text-white">
                {process.env.NODE_ENV || 'development'}
              </p>
            </div>
            <div>
              <span className="text-slate-500">Version</span>
              <p className="font-medium text-slate-900 dark:text-white">1.0.0</p>
            </div>
            <div>
              <span className="text-slate-500">Region</span>
              <p className="font-medium text-slate-900 dark:text-white">ap-southeast-2</p>
            </div>
            <div>
              <span className="text-slate-500">Last Deploy</span>
              <p className="font-medium text-slate-900 dark:text-white">
                {new Date().toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
