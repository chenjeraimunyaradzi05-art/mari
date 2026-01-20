'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { 
  ChevronLeft, 
  TrendingUp,
  Users,
  MessageSquare,
  Briefcase,
  Heart,
  DollarSign,
} from 'lucide-react';
import { api } from '@/lib/api';

interface EngagementMetrics {
  period: {
    label: string;
    days: number;
    start: string;
    end: string;
  };
  metrics: {
    newPosts: number;
    newComments: number;
    newLikes: number;
    newApplications: number;
    activeUsers: number;
  };
}

interface RevenueMetrics {
  mrr: number;
  arr: number;
  breakdown: Record<string, { count: number; revenue: number }>;
}

export default function AdminAnalyticsPage() {
  const [days, setDays] = useState(30);
  const { data: engagement, isLoading: engagementLoading } = useQuery<EngagementMetrics>({
    queryKey: ['admin-analytics-engagement', days],
    queryFn: async () => {
      const response = await api.get(`/admin/analytics/engagement?days=${days}`);
      return response.data;
    },
  });

  const { data: revenue, isLoading: revenueLoading } = useQuery<RevenueMetrics>({
    queryKey: ['admin-analytics-revenue'],
    queryFn: async () => {
      const response = await api.get('/admin/analytics/revenue');
      return response.data;
    },
  });

  const isLoading = engagementLoading || revenueLoading;

  const engagementCards = [
    { label: 'Active Users', value: engagement?.metrics.activeUsers || 0, icon: Users, color: 'text-blue-600' },
    { label: 'New Posts', value: engagement?.metrics.newPosts || 0, icon: MessageSquare, color: 'text-purple-600' },
    { label: 'New Comments', value: engagement?.metrics.newComments || 0, icon: MessageSquare, color: 'text-green-600' },
    { label: 'New Likes', value: engagement?.metrics.newLikes || 0, icon: Heart, color: 'text-pink-600' },
    { label: 'Job Applications', value: engagement?.metrics.newApplications || 0, icon: Briefcase, color: 'text-orange-600' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-gray-500 hover:text-gray-700">
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Platform Analytics</h1>
              <p className="text-gray-600 dark:text-gray-400">Metrics and insights</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : (
          <>
            {/* Revenue Section */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Revenue
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg shadow p-6 text-white">
                  <p className="text-purple-100 text-sm">Monthly Recurring Revenue</p>
                  <p className="text-3xl font-bold">AU${(revenue?.mrr || 0).toLocaleString()}</p>
                </div>
                <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg shadow p-6 text-white">
                  <p className="text-blue-100 text-sm">Annual Recurring Revenue</p>
                  <p className="text-3xl font-bold">AU${(revenue?.arr || 0).toLocaleString()}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                  <p className="text-gray-500 text-sm mb-3">Breakdown by Tier</p>
                  <div className="space-y-2">
                    {revenue?.breakdown && Object.entries(revenue.breakdown).map(([tier, data]) => (
                      <div key={tier} className="flex items-center justify-between">
                        <span className="text-gray-700 dark:text-gray-300">{tier}</span>
                        <div className="text-right">
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {data.count} users
                          </span>
                          <span className="text-gray-500 ml-2">
                            (AU${data.revenue.toLocaleString()}/mo)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* Engagement Section */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Engagement ({engagement?.period?.label || 'Last 30 Days'})
              </h2>
              <div className="mb-4 max-w-xs">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Time window
                </label>
                <select
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  className="input w-full"
                >
                  <option value={7}>Last 7 days</option>
                  <option value={30}>Last 30 days</option>
                  <option value={90}>Last 90 days</option>
                  <option value={180}>Last 180 days</option>
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {engagementCards.map((card) => (
                  <div key={card.label} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <card.icon className={`h-5 w-5 ${card.color}`} />
                      <span className="text-sm text-gray-500">{card.label}</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {card.value.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* Engagement Rate Calculations */}
            <section className="mt-8">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Key Ratios
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                  <p className="text-sm text-gray-500 mb-1">Posts per Active User</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {engagement?.metrics.activeUsers 
                      ? (engagement.metrics.newPosts / engagement.metrics.activeUsers).toFixed(2)
                      : '0'}
                  </p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                  <p className="text-sm text-gray-500 mb-1">Comments per Post</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {engagement?.metrics.newPosts 
                      ? (engagement.metrics.newComments / engagement.metrics.newPosts).toFixed(2)
                      : '0'}
                  </p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                  <p className="text-sm text-gray-500 mb-1">Likes per Post</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {engagement?.metrics.newPosts 
                      ? (engagement.metrics.newLikes / engagement.metrics.newPosts).toFixed(2)
                      : '0'}
                  </p>
                </div>
              </div>
            </section>

            {/* Future Enhancements Note */}
            <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
              <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
                Coming Soon
              </h3>
              <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                <li>• User growth charts over time</li>
                <li>• Revenue trend visualization</li>
                <li>• Cohort retention analysis</li>
                <li>• Geographic distribution maps</li>
                <li>• Real-time activity feed</li>
              </ul>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
