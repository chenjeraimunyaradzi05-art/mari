'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  DollarSign, 
  Loader2, 
  TrendingUp, 
  Eye, 
  Video, 
  PlayCircle,
  ThumbsUp,
  MessageCircle,
  Share2,
  Calendar,
  Target
} from 'lucide-react';
import { aiAlgorithmsApi } from '@/lib/api';

type CreatorAnalytics = {
  id: string;
  userId: string;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  followerCount: number;
  avgWatchTime: number;
  engagementRate: number;
  topCategories: string[];
  audienceDemographics: Record<string, number>;
  peakViewingHours: number[];
  contentPerformance: Array<{
    contentId: string;
    title: string;
    views: number;
    engagement: number;
  }>;
};

type IncomeProjection = {
  id: string;
  userId: string;
  projectedMonthlyIncome: number;
  projectedYearlyIncome: number;
  confidenceLevel: number;
  incomeStreams: Array<{
    source: string;
    amount: number;
    percentage: number;
  }>;
  growthRecommendations: string[];
  nextMilestone: string;
  milestoneProgress: number;
};

export default function CreatorAnalyticsPage() {
  const [analytics, setAnalytics] = useState<CreatorAnalytics | null>(null);
  const [projections, setProjections] = useState<IncomeProjection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [analyticsRes, projectionsRes] = await Promise.all([
        aiAlgorithmsApi.getCreatorAnalytics(),
        aiAlgorithmsApi.getIncomeProjections(),
      ]);
      setAnalytics(analyticsRes.data?.data);
      setProjections(projectionsRes.data?.data);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error?.response?.data?.error || 'Failed to load creator analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-pink-600">
          <DollarSign className="w-5 h-5" />
          <span className="text-sm font-semibold uppercase tracking-wider">IncomeStream</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mt-2">
          Creator Analytics & Income
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Track your growth and projected earnings on ATHENA
        </p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-pink-600" />
        </div>
      ) : (
        <>
          {/* Income Projections */}
          {projections && (
            <div className="bg-gradient-to-br from-pink-500 to-purple-600 rounded-2xl p-8 text-white">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div>
                  <h2 className="text-lg font-medium opacity-90">Projected Monthly Income</h2>
                  <p className="text-4xl md:text-5xl font-bold mt-2">
                    {formatCurrency(projections.projectedMonthlyIncome)}
                  </p>
                  <p className="opacity-75 mt-1">
                    {formatCurrency(projections.projectedYearlyIncome)} / year
                  </p>
                  <div className="mt-4 flex items-center gap-2 text-sm">
                    <div className="w-20 h-2 bg-white/30 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-white rounded-full"
                        style={{ width: `${projections.confidenceLevel}%` }}
                      />
                    </div>
                    <span className="opacity-90">{projections.confidenceLevel}% confidence</span>
                  </div>
                </div>

                {/* Income Breakdown */}
                <div className="bg-white/10 rounded-xl p-4 min-w-[200px]">
                  <h3 className="text-sm font-medium opacity-90 mb-3">Income Streams</h3>
                  <div className="space-y-2">
                    {projections.incomeStreams.map((stream) => (
                      <div key={stream.source} className="flex items-center justify-between text-sm">
                        <span className="opacity-75">{stream.source}</span>
                        <span className="font-medium">{formatCurrency(stream.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Milestone Progress */}
              {projections.nextMilestone && (
                <div className="mt-6 pt-6 border-t border-white/20">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4" />
                      <span className="text-sm font-medium">Next Milestone: {projections.nextMilestone}</span>
                    </div>
                    <span className="text-sm">{Math.round(projections.milestoneProgress)}%</span>
                  </div>
                  <div className="w-full h-2 bg-white/30 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-white rounded-full transition-all"
                      style={{ width: `${projections.milestoneProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Engagement Stats */}
          {analytics && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-gray-500 mb-2">
                    <Eye className="w-4 h-4" />
                    <span className="text-sm">Total Views</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatNumber(analytics.totalViews)}
                  </p>
                </div>
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-gray-500 mb-2">
                    <ThumbsUp className="w-4 h-4" />
                    <span className="text-sm">Total Likes</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatNumber(analytics.totalLikes)}
                  </p>
                </div>
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-gray-500 mb-2">
                    <MessageCircle className="w-4 h-4" />
                    <span className="text-sm">Comments</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatNumber(analytics.totalComments)}
                  </p>
                </div>
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-gray-500 mb-2">
                    <Share2 className="w-4 h-4" />
                    <span className="text-sm">Shares</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatNumber(analytics.totalShares)}
                  </p>
                </div>
              </div>

              {/* More Stats */}
              <div className="grid md:grid-cols-3 gap-6">
                {/* Engagement Overview */}
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Engagement Overview</h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-500">Followers</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {formatNumber(analytics.followerCount)}
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-500">Engagement Rate</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {analytics.engagementRate.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-pink-500 rounded-full"
                          style={{ width: `${Math.min(analytics.engagementRate * 10, 100)}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Avg. Watch Time</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {Math.floor(analytics.avgWatchTime / 60)}:{String(analytics.avgWatchTime % 60).padStart(2, '0')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Top Categories */}
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Top Categories</h3>
                  <div className="space-y-2">
                    {analytics.topCategories.map((category, index) => (
                      <div 
                        key={category}
                        className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg"
                      >
                        <span className="w-6 h-6 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center text-sm font-medium">
                          {index + 1}
                        </span>
                        <span className="text-gray-900 dark:text-white">{category}</span>
                      </div>
                    ))}
                    {analytics.topCategories.length === 0 && (
                      <p className="text-gray-500 text-sm">No content categories yet</p>
                    )}
                  </div>
                </div>

                {/* Peak Hours */}
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Peak Viewing Hours
                  </h3>
                  <div className="flex items-end justify-between h-32 gap-1">
                    {[...Array(24)].map((_, hour) => {
                      const isPeak = analytics.peakViewingHours.includes(hour);
                      return (
                        <div 
                          key={hour}
                          className={`flex-1 rounded-t transition-all ${
                            isPeak ? 'bg-pink-500' : 'bg-gray-200 dark:bg-gray-700'
                          }`}
                          style={{ 
                            height: isPeak ? '100%' : '30%',
                          }}
                          title={`${hour}:00`}
                        />
                      );
                    })}
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-2">
                    <span>12am</span>
                    <span>6am</span>
                    <span>12pm</span>
                    <span>6pm</span>
                    <span>12am</span>
                  </div>
                </div>
              </div>

              {/* Content Performance */}
              {analytics.contentPerformance.length > 0 && (
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Video className="w-4 h-4" />
                    Top Performing Content
                  </h3>
                  <div className="space-y-3">
                    {analytics.contentPerformance.map((content, index) => (
                      <div 
                        key={content.contentId}
                        className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                      >
                        <span className="text-2xl font-bold text-gray-300">#{index + 1}</span>
                        <div className="w-16 h-12 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center flex-shrink-0">
                          <PlayCircle className="w-6 h-6 text-gray-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 dark:text-white truncate">
                            {content.title}
                          </p>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <Eye className="w-3 h-3" />
                              {formatNumber(content.views)}
                            </span>
                            <span className="flex items-center gap-1">
                              <TrendingUp className="w-3 h-3" />
                              {content.engagement.toFixed(1)}% engagement
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Growth Recommendations */}
          {projections?.growthRecommendations && projections.growthRecommendations.length > 0 && (
            <div className="bg-gradient-to-r from-gray-50 to-pink-50 dark:from-gray-800 dark:to-pink-900/20 rounded-xl p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-pink-600" />
                Growth Recommendations
              </h3>
              <div className="grid md:grid-cols-2 gap-3">
                {projections.growthRecommendations.map((recommendation, index) => (
                  <div 
                    key={index}
                    className="flex items-start gap-3 p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
                  >
                    <span className="w-6 h-6 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {index + 1}
                    </span>
                    <p className="text-gray-700 dark:text-gray-300 text-sm">{recommendation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No Data State */}
          {!analytics && !projections && (
            <div className="text-center py-20">
              <Video className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">No creator data yet</h3>
              <p className="text-gray-500 mt-1">Start creating content to see your analytics and income projections</p>
            </div>
          )}
        </>
      )}

      <div className="text-center">
        <Link href="/dashboard/ai" className="text-sm text-primary-600 hover:underline">
          ← Back to AI Tools
        </Link>
      </div>
    </div>
  );
}
