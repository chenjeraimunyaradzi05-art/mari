'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Eye,
  Briefcase,
  FileText,
  ArrowLeft,
  Calendar,
  Target,
  Clock,
  CheckCircle,
} from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';

/**
 * `previous` and `change` are null where there is nothing honest to compare
 * against: job views are a running total with no date attached to them, and a
 * window that saw no applications at all gives a percentage change nothing can
 * be divided by. The page says so rather than printing a zero that reads as a
 * collapse in interest.
 */
interface Trend {
  current: number;
  previous: number | null;
  change: number | null;
}

interface AnalyticsData {
  period: { days: number; startDate: string; endDate: string };
  trends: {
    views: Trend;
    applications: Trend;
    hires: Trend;
  };
  applicationFunnel: {
    stage: string;
    count: number;
    percentage: number;
  }[];
  topJobs: {
    id: string;
    title: string;
    views: number;
    applications: number;
    conversionRate: number;
  }[];
  timeToHire: {
    average: number;
    fastest: number;
    slowest: number;
    sampleSize: number;
  } | null;
}

const periodOptions = [
  { value: 7, label: 'Last 7 days' },
  { value: 30, label: 'Last 30 days' },
  { value: 90, label: 'Last 90 days' },
];

export default function AnalyticsPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const [days, setDays] = useState(30);

  const { data: analyticsData, isLoading } = useQuery<{ success: boolean; data: AnalyticsData }>({
    queryKey: ['employer-analytics', orgId, days],
    queryFn: async () => {
      const response = await api.get(`/employer/organizations/${orgId}/analytics`, {
        params: { days },
      });
      return response.data;
    },
  });

  // The page used to assume the payload already matched this shape and read
  // straight into `analytics.trends.views.change`, which threw on every
  // successful response because the route had never sent a `trends` key. Each
  // section now has its own fallback, so a response missing one of them costs
  // that card and not the page.
  const analytics = analyticsData?.data;
  const trends = analytics?.trends;
  const applicationFunnel = analytics?.applicationFunnel ?? [];
  const topJobs = analytics?.topJobs ?? [];
  const timeToHire = analytics?.timeToHire ?? null;

  const TrendIndicator = ({ change }: { change: number | null }) => {
    if (change === null || change === 0) return null;
    const isPositive = change > 0;
    return (
      <span className={`flex items-center text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {isPositive ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
        {Math.abs(change)}%
      </span>
    );
  };


  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Back Button */}
      <Link
        href={`/employer/organizations/${orgId}`}
        className="inline-flex items-center text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Dashboard
      </Link>

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-blue-600" />
            Analytics
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Track your hiring performance and optimize your recruitment strategy
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Calendar className="h-4 w-4" />
          <label htmlFor="analytics-period" className="sr-only">
            Reporting period
          </label>
          <select
            id="analytics-period"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-900"
          >
            {periodOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
          <p className="text-slate-500 mt-2">Loading analytics...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                  <Eye className="h-6 w-6 text-blue-600" />
                </div>
                <TrendIndicator change={trends?.views.change ?? null} />
              </div>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">
                {(trends?.views.current ?? 0).toLocaleString()}
              </p>
              <p className="text-slate-500 text-sm">Job Views</p>
              <p className="text-xs text-slate-400 mt-1">
                All time — views are counted per listing, not per day
              </p>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
                  <FileText className="h-6 w-6 text-purple-600" />
                </div>
                <TrendIndicator change={trends?.applications.change ?? null} />
              </div>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">
                {(trends?.applications.current ?? 0).toLocaleString()}
              </p>
              <p className="text-slate-500 text-sm">Applications Received</p>
              <p className="text-xs text-slate-400 mt-1">
                vs {(trends?.applications.previous ?? 0).toLocaleString()} previous period
              </p>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <TrendIndicator change={trends?.hires.change ?? null} />
              </div>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">
                {trends?.hires.current ?? 0}
              </p>
              <p className="text-slate-500 text-sm">Offers Accepted</p>
              <p className="text-xs text-slate-400 mt-1">
                vs {trends?.hires.previous ?? 0} previous period
              </p>
            </div>
          </div>

          {/* Application Funnel */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-600" />
              Application Funnel
            </h2>
            <p className="text-sm text-slate-500 -mt-2 mb-4">
              Where every application you have ever received stands today.
            </p>
            {applicationFunnel.length > 0 ? (
              <div className="space-y-4">
                {applicationFunnel.map((stage) => (
                  <div key={stage.stage}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-700 dark:text-slate-300">{stage.stage}</span>
                      <span className="font-medium text-slate-900 dark:text-white">
                        {stage.count} ({stage.percentage}%)
                      </span>
                    </div>
                    <div className="h-4 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all"
                        style={{ width: `${stage.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No application data yet</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Performing Jobs */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-blue-600" />
                Top Performing Jobs
              </h2>
              {topJobs.length > 0 ? (
                <div className="space-y-4">
                  {topJobs.map((job, index) => (
                    <div
                      key={job.id}
                      className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 font-medium">
                          {index + 1}
                        </span>
                        <div>
                          <Link
                            href={`/jobs/${job.id}`}
                            className="font-medium text-slate-900 dark:text-white hover:text-blue-600"
                          >
                            {job.title}
                          </Link>
                          <div className="flex gap-4 text-xs text-slate-500">
                            <span>{job.views} views</span>
                            <span>{job.applications} apps</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {job.conversionRate.toFixed(1)}%
                        </p>
                        <p className="text-xs text-slate-500">conversion</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <Briefcase className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Post jobs to see performance data</p>
                </div>
              )}
            </div>

            {/* Time to Hire */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-600" />
                Time to Hire
              </h2>
              <p className="text-sm text-slate-500 mb-4">
                Days from application to the offer being accepted.
              </p>
              {timeToHire ? (
                <div className="space-y-6">
                  <div className="text-center py-4">
                    <p className="text-5xl font-bold text-slate-900 dark:text-white">
                      {timeToHire.average}
                    </p>
                    <p className="text-slate-500">
                      Average, across {timeToHire.sampleSize}{' '}
                      {timeToHire.sampleSize === 1 ? 'hire' : 'hires'}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-green-600">{timeToHire.fastest}</p>
                      <p className="text-sm text-slate-500">Fastest (days)</p>
                    </div>
                    <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-red-600">{timeToHire.slowest}</p>
                      <p className="text-sm text-slate-500">Slowest (days)</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Make your first hire to see metrics</p>
                </div>
              )}
            </div>
          </div>

          {/*
            An "Application Sources" card used to sit here. Nothing records where
            an application came from — JobApplication has no source, referrer or
            channel column — so the card could only ever show its own empty
            state, promising a breakdown that had no data behind it. It belongs
            back on this page once applications carry a source, and not before.
          */}

          {/* Tips */}
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-6 text-white">
            <h2 className="text-lg font-semibold mb-3">💡 Tips to improve your hiring</h2>
            <ul className="space-y-2 text-sm opacity-90">
              <li>• Post jobs with clear titles and comprehensive descriptions to attract more qualified candidates</li>
              <li>• Respond to applications within 48 hours to keep candidates engaged</li>
              <li>• Use skills-based screening to identify top talent efficiently</li>
              <li>• Track your time-to-hire and work to reduce it for competitive advantage</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
