'use client';

import { useParams } from 'next/navigation';
import { PERSONA_LABELS } from '@/lib/utils';
import { Briefcase, Gavel, GraduationCap, Heart, Lightbulb, TrendingUp, Users } from 'lucide-react';

export default function PersonaDashboard() {
  const params = useParams();
  const persona = (params.persona as string).toUpperCase();
  const validPersona = Object.keys(PERSONA_LABELS).includes(persona);

  if (!validPersona) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-red-600">Invalid Persona</h1>
        <p>The persona "{params.persona}" does not exist.</p>
      </div>
    );
  }

  const label = PERSONA_LABELS[persona] || persona;

  return (
    <div className="p-6 space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          {label} Dashboard
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          Tailored resources and insights for {label}.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Placeholder Widgets */}
        <div className="card p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg text-primary-600">
              <TrendingUp className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-semibold">Recommended Path</h2>
          </div>
          <p className="text-sm text-gray-500">
            AI-driven career milestones for your {label} journey.
          </p>
          <div className="mt-4 h-32 bg-gray-100 dark:bg-gray-700/50 rounded-lg animate-pulse" />
        </div>

        <div className="card p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg text-green-600">
              <Users className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-semibold">Community</h2>
          </div>
          <p className="text-sm text-gray-500">
            Connect with other {label} professionals.
          </p>
           <div className="mt-4 h-32 bg-gray-100 dark:bg-gray-700/50 rounded-lg animate-pulse" />
        </div>

        <div className="card p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-purple-600">
              <Lightbulb className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-semibold">Insights</h2>
          </div>
          <p className="text-sm text-gray-500">
            Market trends relevant to {label}.
          </p>
           <div className="mt-4 h-32 bg-gray-100 dark:bg-gray-700/50 rounded-lg animate-pulse" />
        </div>
      </div>
    </div>
  );
}
