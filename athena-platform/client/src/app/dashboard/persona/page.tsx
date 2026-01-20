'use client';

import Link from 'next/link';
import { PERSONA_LABELS } from '@/lib/utils';
import { ArrowRight, Users } from 'lucide-react';

export default function PersonaIndexPage() {
  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Personality Dashboards</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Select a personality type to explore its dedicated dashboard.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.entries(PERSONA_LABELS).map(([key, label]) => (
          <Link
            key={key}
            href={`/dashboard/persona/${key.toLowerCase()}`}
            className="group block p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-primary-500 dark:hover:border-primary-500 transition-colors shadow-sm"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-full text-primary-600 group-hover:bg-primary-100 dark:group-hover:bg-primary-900/40 transition-colors">
                <Users className="w-6 h-6" />
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-primary-500 transition-colors" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {label}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              View stats, resources, and paths for {label}.
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
