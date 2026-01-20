'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Eye,
  Users,
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

interface AnalyticsData {
  trends: {
    views: { current: number; previous: number; change: number };
    applications: { current: number; previous: number; change: number };
    hires: { current: number; previous: number; change: number };
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
  };
  sourceBreakdown: {
    source: string;
    count: number;
    percentage: number;
  }[];
}

export default function AnalyticsPage() {
  const params = useParams();
  const orgId = params.orgId as string;

  const { data: analyticsData, isLoading } = useQuery({
    queryKey: ['employer-analytics', orgId],
    queryFn: async () => {
      const response = await api.get(`/employer/organizations/${orgId}/analytics`);
      return response.data;
    },
  });

  const analytics: AnalyticsData = analyticsData?.data || {
    trends: {
      views: { current: 0, previous: 0, change: 0 },
      applications: { current: 0, previous: 0, change: 0 },
      hires: { current: 0, previous: 0, change: 0 },
    },
    applicationFunnel: [],
    topJobs: [],
    timeToHire: { average: 0, fastest: 0, slowest: 0 },
    sourceBreakdown: [],
  };

  const TrendIndicator = ({ change }: { change: number }) => {
    if (change === 0) return null;
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
        className="inline-flex items-center text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Dashboard
      </Link>

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-blue-600" />
            Analytics
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Track your hiring performance and optimize your recruitment strategy
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Calendar className="h-4 w-4" />
          Last 30 days
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
          <p className="text-gray-500 mt-2">Loading analytics...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                  <Eye className="h-6 w-6 text-blue-600" />
                </div>
                <TrendIndicator change={analytics.trends.views.change} />
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {analytics.trends.views.current.toLocaleString()}
              </p>
              <p className="text-gray-500 text-sm">Job Views</p>
              <p className="text-xs text-gray-400 mt-1">
                vs {analytics.trends.views.previous.toLocaleString()} previous period
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
                  <FileText className="h-6 w-6 text-purple-600" />
                </div>
                <TrendIndicator change={analytics.trends.applications.change} />
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {analytics.trends.applications.current.toLocaleString()}
              </p>
              <p className="text-gray-500 text-sm">Applications Received</p>
              <p className="text-xs text-gray-400 mt-1">
                vs {analytics.trends.applications.previous.toLocaleString()} previous period
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <TrendIndicator change={analytics.trends.hires.change} />
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {analytics.trends.hires.current}
              </p>
              <p className="text-gray-500 text-sm">Successful Hires</p>
              <p className="text-xs text-gray-400 mt-1">
                vs {analytics.trends.hires.previous} previous period
              </p>
            </div>
          </div>

          {/* Application Funnel */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-600" />
              Application Funnel
            </h2>
            {analytics.applicationFunnel.length > 0 ? (
              <div className="space-y-4">
                {analytics.applicationFunnel.map((stage, index) => (
                  <div key={stage.stage}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700 dark:text-gray-300">{stage.stage}</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {stage.count} ({stage.percentage}%)
                      </span>
                    </div>
                    <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all"
                        style={{ width: `${stage.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No application data yet</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Performing Jobs */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-blue-600" />
                Top Performing Jobs
              </h2>
              {analytics.topJobs.length > 0 ? (
                <div className="space-y-4">
                  {analytics.topJobs.map((job, index) => (
                    <div
                      key={job.id}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 font-medium">
                          {index + 1}
                        </span>
                        <div>
                          <Link
                            href={`/jobs/${job.id}`}
                            className="font-medium text-gray-900 dark:text-white hover:text-blue-600"
                          >
                            {job.title}
                          </Link>
                          <div className="flex gap-4 text-xs text-gray-500">
                            <span>{job.views} views</span>
                            <span>{job.applications} apps</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {job.conversionRate.toFixed(1)}%
                        </p>
                        <p className="text-xs text-gray-500">conversion</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Briefcase className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Post jobs to see performance data</p>
                </div>
              )}
            </div>

            {/* Time to Hire */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-600" />
                Time to Hire
              </h2>
              {analytics.timeToHire.average > 0 ? (
                <div className="space-y-6">
                  <div className="text-center py-4">
                    <p className="text-5xl font-bold text-gray-900 dark:text-white">
                      {analytics.timeToHire.average}
                    </p>
                    <p className="text-gray-500">Average days to hire</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-green-600">{analytics.timeToHire.fastest}</p>
                      <p className="text-sm text-gray-500">Fastest (days)</p>
                    </div>
                    <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-red-600">{analytics.timeToHire.slowest}</p>
                      <p className="text-sm text-gray-500">Slowest (days)</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Make your first hire to see metrics</p>
                </div>
              )}
            </div>
          </div>

          {/* Application Sources */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              Application Sources
            </h2>
            {analytics.sourceBreakdown.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {analytics.sourceBreakdown.map((source) => (
                  <div
                    key={source.source}
                    className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center"
                  >
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{source.count}</p>
                    <p className="text-sm text-gray-500">{source.source}</p>
                    <p className="text-xs text-gray-400">{source.percentage}%</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Source data will appear when you receive applications</p>
              </div>
            )}
          </div>

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
