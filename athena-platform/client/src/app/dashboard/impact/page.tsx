'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Heart,
  Globe,
  Shield,
  Accessibility,
  Users,
  FileText,
  Loader2,
  TrendingUp,
  Award,
} from 'lucide-react';
import { impactApi } from '@/lib/api';

type ImpactSummary = {
  metricsSummary: Record<string, { count: number; totalValue: number }>;
  totalMetrics: number;
  programsEnrolled: number;
  programsCompleted: number;
};

const impactTiles = [
  {
    title: 'Support Programs',
    description: 'Access tailored programs for your community',
    href: '/dashboard/impact/programs',
    icon: Users,
    color: 'bg-purple-500',
  },
  {
    title: 'First Nations',
    description: 'Indigenous women communities & resources',
    href: '/dashboard/impact/indigenous',
    icon: Heart,
    color: 'bg-amber-500',
  },
  {
    title: 'Migrant Services',
    description: 'Credential recognition & language support',
    href: '/dashboard/impact/migrant',
    icon: Globe,
    color: 'bg-blue-500',
  },
  {
    title: 'Safety Planning',
    description: 'DV survivor support & exit strategies',
    href: '/dashboard/impact/safety',
    icon: Shield,
    color: 'bg-red-500',
  },
  {
    title: 'Accessibility',
    description: 'Disability support & workplace accommodations',
    href: '/dashboard/impact/accessibility',
    icon: Accessibility,
    color: 'bg-teal-500',
  },
  {
    title: 'Impact Reports',
    description: 'View community impact & outcomes',
    href: '/dashboard/impact/reports',
    icon: FileText,
    color: 'bg-indigo-500',
  },
];

export default function ImpactPage() {
  const [summary, setSummary] = useState<ImpactSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSummary = async () => {
      try {
        const response = await impactApi.getImpactSummary();
        setSummary(response.data?.data || null);
      } catch {
        // User may not have any impact data yet
        setSummary(null);
      } finally {
        setLoading(false);
      }
    };
    loadSummary();
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div>
        <div className="flex items-center gap-2 text-purple-600">
          <Heart className="w-5 h-5" />
          <span className="text-sm font-semibold uppercase tracking-wider">Social Impact</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mt-2">
          Community Support Hub
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Tailored programs and resources for marginalized communities
        </p>
      </div>

      {/* Impact Summary */}
      {!loading && summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-purple-600 mb-2">
              <Award className="w-4 h-4" />
              <span className="text-xs font-medium">Achievements</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.totalMetrics}</p>
            <p className="text-xs text-gray-500">Impact milestones</p>
          </div>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-blue-600 mb-2">
              <Users className="w-4 h-4" />
              <span className="text-xs font-medium">Programs</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.programsEnrolled}</p>
            <p className="text-xs text-gray-500">Enrolled</p>
          </div>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-emerald-600 mb-2">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs font-medium">Completed</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.programsCompleted}</p>
            <p className="text-xs text-gray-500">Programs finished</p>
          </div>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-amber-600 mb-2">
              <Heart className="w-4 h-4" />
              <span className="text-xs font-medium">Community</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {Object.keys(summary.metricsSummary).length}
            </p>
            <p className="text-xs text-gray-500">Impact areas</p>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading your impact summary...
        </div>
      )}

      {/* Navigation Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {impactTiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <Link
              key={tile.href}
              href={tile.href}
              className="group bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 hover:shadow-lg hover:border-purple-300 dark:hover:border-purple-700 transition-all"
            >
              <div className={`w-12 h-12 ${tile.color} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white group-hover:text-purple-600 transition-colors">
                {tile.title}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{tile.description}</p>
            </Link>
          );
        })}
      </div>

      {/* Partner Info */}
      <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Our Impact Partners
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          We work with government agencies, NGOs, and community organizations to deliver
          evidence-based support programs and track real outcomes for women from all backgrounds.
        </p>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="px-3 py-1 bg-white dark:bg-gray-800 rounded-full text-gray-600 dark:text-gray-300">
            Reconciliation Australia
          </span>
          <span className="px-3 py-1 bg-white dark:bg-gray-800 rounded-full text-gray-600 dark:text-gray-300">
            Settlement Council
          </span>
          <span className="px-3 py-1 bg-white dark:bg-gray-800 rounded-full text-gray-600 dark:text-gray-300">
            1800RESPECT
          </span>
          <span className="px-3 py-1 bg-white dark:bg-gray-800 rounded-full text-gray-600 dark:text-gray-300">
            Vision Australia
          </span>
          <span className="px-3 py-1 bg-white dark:bg-gray-800 rounded-full text-gray-600 dark:text-gray-300">
            Beyond Blue
          </span>
        </div>
      </div>

      <div className="text-center">
        <Link href="/dashboard" className="text-sm text-primary-600 hover:underline">
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
