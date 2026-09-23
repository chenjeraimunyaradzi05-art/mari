'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  DollarSign,
  Loader2,
  TrendingUp,
  Eye,
  Video,
  ThumbsUp,
  Users,
  Clock,
  Globe,
  Sparkles,
} from 'lucide-react';
import { api, aiAlgorithmsApi } from '@/lib/api';

/**
 * This page used to be typed against a CreatorAnalytics that does not exist.
 * It read totalComments, totalShares, avgWatchTime, engagementRate,
 * topCategories, peakViewingHours and contentPerformance, none of which are
 * columns on the model — so `analytics.topCategories.map` threw a TypeError on
 * render for every member who opened it from the AI hub.
 *
 * The types below are the row GET /ai-algorithms/creator-analytics actually
 * returns. Everything the page shows now comes from one of these fields, and a
 * figure is rendered only when the row genuinely holds it: a creator is better
 * served by an honest blank than by a confident zero she cannot act on.
 *
 * The earnings the page leads with come from somewhere else entirely — see
 * IncomeStreamResult below — because the CreatorAnalytics row is a cache that
 * nothing on the server currently fills, whereas her gifts are real rows.
 */
type CreatorAnalytics = {
  id: string;
  userId: string;
  followerCount: number;
  followingCount: number;
  totalVideos: number;
  totalViews: number;
  avgViews: number | null;
  totalLikes: number;
  // Stored as a ratio — (likes + comments + shares) / views — not a percentage.
  avgEngagementRate: number | null;
  audienceGender: Record<string, number> | null;
  audienceAge: Record<string, number> | null;
  audienceLocation: Record<string, number> | null;
  peakActiveHours: number[] | null;
  // Prisma Decimal, which arrives over the wire as a string.
  totalEarnings: string | number;
  monthlyEarnings: Record<string, number> | null;
  revenueBySource: Record<string, number> | null;
  creatorTier: string;
  isMonetized: boolean;
  monetizedAt: string | null;
};

/**
 * The projections endpoint selects six columns rather than returning the whole
 * row, so it is a narrower shape than CreatorAnalytics and gets its own type.
 */
type IncomeProjections = {
  followerCount: number;
  avgEngagementRate: number | null;
  creatorTier: string;
  projectedIncome: { conservative: number; realistic: number; optimistic: number } | null;
  topRevenueStreams: Array<{ stream: string; potential: number; effort: string }> | null;
};

/**
 * GET /api/algorithms/income-stream, which nothing in the web app was reading.
 * It is the one creator endpoint that aggregates live tables at request time —
 * gifts actually received in the last thirty days, posts actually published,
 * and whether Stripe Connect has been switched on — so it is what the page
 * leads with. `channels` is deliberately not rendered: its currentShare
 * percentages are fixed constants in algorithm.service, and printing them as a
 * creator's revenue mix would be making a number up about her.
 */
type IncomeStreamResult = {
  creatorStatus: 'non_creator' | 'emerging' | 'growing' | 'established';
  revenuePotentialScore: number;
  diversificationScore: number;
  monthlyEarnings: number;
  avgGiftValue: number;
  followerCount: number;
  actionPlan: string[];
  channels: Array<{ name: string; currentShare: number; potentialShare: number }>;
};

type IncomeStreamEnvelope = { success: boolean; data: IncomeStreamResult };

const TIER_STYLES: Record<string, string> = {
  BRONZE: 'from-amber-500 to-orange-500',
  SILVER: 'from-slate-400 to-slate-500',
  GOLD: 'from-yellow-400 to-amber-500',
  PLATINUM: 'from-fuchsia-500 to-violet-500',
};

/** A record of key/number pairs is only worth a chart when it has real entries. */
function entriesOf(breakdown: Record<string, number> | null | undefined): Array<[string, number]> {
  if (!breakdown || typeof breakdown !== 'object') return [];
  return Object.entries(breakdown)
    .filter(([, value]) => typeof value === 'number' && Number.isFinite(value) && value > 0)
    .sort((a, b) => b[1] - a[1]);
}

function hoursOf(peak: number[] | null | undefined): number[] {
  if (!Array.isArray(peak)) return [];
  return peak.filter((hour) => Number.isInteger(hour) && hour >= 0 && hour <= 23);
}

export default function CreatorAnalyticsPage() {
  const [analytics, setAnalytics] = useState<CreatorAnalytics | null>(null);
  const [projections, setProjections] = useState<IncomeProjections | null>(null);
  const [income, setIncome] = useState<IncomeStreamResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    // Three independent sources, settled rather than raced: one of them going
    // down should cost this page a section, not the whole screen.
    const [analyticsRes, projectionsRes, incomeRes] = await Promise.allSettled([
      aiAlgorithmsApi.getCreatorAnalytics(),
      aiAlgorithmsApi.getIncomeProjections(),
      api.get<IncomeStreamEnvelope>('/algorithms/income-stream'),
    ]);

    if (analyticsRes.status === 'fulfilled') setAnalytics(analyticsRes.value.data?.data ?? null);
    if (projectionsRes.status === 'fulfilled') setProjections(projectionsRes.value.data?.data ?? null);
    if (incomeRes.status === 'fulfilled') setIncome(incomeRes.value.data?.data ?? null);

    if (analyticsRes.status === 'rejected' && incomeRes.status === 'rejected') {
      const failure = analyticsRes.reason as { response?: { data?: { error?: string } } };
      setError(failure?.response?.data?.error || 'Failed to load creator analytics');
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatCurrency = (num: number) =>
    new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);

  // Gift earnings arrive as points converted to dollars, so they are routinely
  // a few dollars and change. Rounding those to the nearest dollar would hide
  // most of what a new creator has actually earned.
  const formatMoney = (num: number) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(num);

  const formatHour = (hour: number) => {
    if (hour === 0) return '12am';
    if (hour === 12) return '12pm';
    return hour < 12 ? `${hour}am` : `${hour - 12}pm`;
  };

  // Every counter on the row starts at its default and only moves once the
  // platform measures her. Until then there is nothing to report, and saying
  // "0 views" would read as a measurement rather than the absence of one.
  const measured = Boolean(
    analytics &&
      (analytics.totalVideos > 0 ||
        analytics.totalViews > 0 ||
        analytics.totalLikes > 0 ||
        analytics.followerCount > 0 ||
        typeof analytics.avgEngagementRate === 'number')
  );

  const earnings = analytics ? Number(analytics.totalEarnings) : 0;
  const hasEarnings = Number.isFinite(earnings) && earnings > 0;
  const revenueSources = entriesOf(analytics?.revenueBySource);
  const monthlyEarnings = entriesOf(analytics?.monthlyEarnings).sort((a, b) => a[0].localeCompare(b[0]));
  const genderMix = entriesOf(analytics?.audienceGender);
  const ageMix = entriesOf(analytics?.audienceAge);
  const locationMix = entriesOf(analytics?.audienceLocation);
  const peakHours = hoursOf(analytics?.peakActiveHours);

  // The server models income from her follower count and engagement rate. With
  // neither measured the model returns zeros, and a zero here is an artefact of
  // the formula rather than a forecast, so the whole card stays away.
  const forecast = projections?.projectedIncome ?? null;
  const hasIncomeForecast = Boolean(
    forecast &&
      [forecast.conservative, forecast.realistic, forecast.optimistic].some(
        (value) => typeof value === 'number' && Number.isFinite(value) && value > 0
      )
  );
  const revenueStreams = hasIncomeForecast && Array.isArray(projections?.topRevenueStreams)
    ? projections.topRevenueStreams.filter((stream) => stream && typeof stream.stream === 'string')
    : [];

  const tier = analytics?.creatorTier || projections?.creatorTier || 'BRONZE';
  const tierGradient = TIER_STYLES[tier] || TIER_STYLES.BRONZE;

  // Monetisation is read from the income-stream endpoint rather than the
  // analytics row: creatorStatus is 'non_creator' exactly when CreatorProfile
  // .isMonetized is false, and that column is the one Stripe Connect and the
  // webhooks actually write.
  const isMonetized = income ? income.creatorStatus !== 'non_creator' : analytics?.isMonetized === true;
  const actionPlan = Array.isArray(income?.actionPlan) ? income.actionPlan.filter(Boolean) : [];

  // Whether there is anything at all to show, so the page can be honest in one
  // place rather than rendering a wall of empty cards.
  const hasAnything = Boolean(analytics || income);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      <div>
        <div className="flex items-center gap-2 text-pink-600">
          <DollarSign className="w-5 h-5" />
          <span className="text-sm font-semibold uppercase tracking-wider">IncomeStream</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mt-2">
          Creator Analytics &amp; Income
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Your reach and your earnings on ATHENA, as we have measured them.
        </p>
      </div>

      {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-pink-600" />
        </div>
      ) : !hasAnything ? (
        <div className="text-center py-20">
          <Video className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-white">
            No creator profile yet
          </h3>
          <p className="text-slate-500 mt-1">
            Share your first reel and your creator profile opens up here.
          </p>
        </div>
      ) : (
        <>
          {/* Tier and monetisation, the two facts held about her account. */}
          <div className={`bg-gradient-to-br ${tierGradient} rounded-2xl p-8 text-white`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-sm font-medium uppercase tracking-wider opacity-80">
                  Creator tier
                </h2>
                <p className="text-3xl md:text-4xl font-bold mt-1 capitalize">
                  {tier.toLowerCase()}
                </p>
              </div>
              <div className="text-sm sm:text-right">
                {isMonetized ? (
                  <>
                    <p className="font-medium">Monetisation is on</p>
                    {analytics?.monetizedAt && (
                      <p className="opacity-80">
                        since {new Date(analytics.monetizedAt).toLocaleDateString('en-AU')}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="opacity-90">
                    Monetisation is not switched on for your account yet.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Gifts received in the last thirty days. Counted from real rows at
              request time, so a zero here is a measurement and is shown. */}
          {income && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
              <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-pink-600" />
                Gifts received, last 30 days
              </h3>
              <div className="grid grid-cols-2 gap-6 mt-4">
                <div>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">
                    {formatMoney(income.monthlyEarnings)}
                  </p>
                  <p className="text-sm text-slate-500 mt-1">from your community</p>
                </div>
                {income.avgGiftValue > 0 && (
                  <div>
                    <p className="text-3xl font-bold text-slate-900 dark:text-white">
                      {formatMoney(income.avgGiftValue)}
                    </p>
                    <p className="text-sm text-slate-500 mt-1">average gift</p>
                  </div>
                )}
              </div>
              {income.monthlyEarnings === 0 && (
                <p className="text-sm text-slate-500 mt-4">
                  No gifts yet this month. They land here the moment someone sends one.
                </p>
              )}
            </div>
          )}

          {/* Projected income — shown only when the model had real numbers to work from. */}
          {hasIncomeForecast && forecast && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
              <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-pink-600" />
                Monthly income, modelled
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                Estimated from your follower count and engagement rate. It is a model, not a
                measurement, and no money moves on it.
              </p>
              <div className="grid grid-cols-3 gap-4 mt-5">
                {[
                  ['Conservative', forecast.conservative],
                  ['Realistic', forecast.realistic],
                  ['Optimistic', forecast.optimistic],
                ].map(([label, value]) => (
                  <div key={label as string} className="text-center">
                    <p className="text-xs uppercase tracking-wider text-slate-400">{label}</p>
                    <p className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white mt-1">
                      {formatCurrency(Number(value))}
                    </p>
                  </div>
                ))}
              </div>

              {revenueStreams.length > 0 && (
                <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    Where that could come from
                  </p>
                  {revenueStreams.map((stream) => (
                    <div
                      key={stream.stream}
                      className="flex items-center justify-between text-sm p-2 rounded-lg bg-slate-50 dark:bg-slate-800"
                    >
                      <span className="text-slate-700 dark:text-slate-300">{stream.stream}</span>
                      <span className="flex items-center gap-3">
                        <span className="text-xs uppercase tracking-wider text-slate-400">
                          {String(stream.effort || '').toLowerCase()} effort
                        </span>
                        <span className="font-medium text-slate-900 dark:text-white">
                          {formatCurrency(Number(stream.potential) || 0)}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Reach. Nothing here renders until at least one counter has moved. */}
          {measured && analytics ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                <div className="flex items-center gap-2 text-slate-500 mb-2">
                  <Users className="w-4 h-4" />
                  <span className="text-sm">Followers</span>
                </div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {formatNumber(analytics.followerCount)}
                </p>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                <div className="flex items-center gap-2 text-slate-500 mb-2">
                  <Video className="w-4 h-4" />
                  <span className="text-sm">Videos</span>
                </div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {formatNumber(analytics.totalVideos)}
                </p>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                <div className="flex items-center gap-2 text-slate-500 mb-2">
                  <Eye className="w-4 h-4" />
                  <span className="text-sm">Views</span>
                </div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {formatNumber(analytics.totalViews)}
                </p>
                {typeof analytics.avgViews === 'number' && (
                  <p className="text-xs text-slate-400 mt-1">
                    {formatNumber(Math.round(analytics.avgViews))} per video
                  </p>
                )}
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                <div className="flex items-center gap-2 text-slate-500 mb-2">
                  <ThumbsUp className="w-4 h-4" />
                  <span className="text-sm">Likes</span>
                </div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {formatNumber(analytics.totalLikes)}
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-r from-slate-50 to-pink-50 dark:from-slate-800 dark:to-pink-900/20 rounded-xl p-6 text-center">
              <TrendingUp className="w-10 h-10 text-pink-400 mx-auto mb-3" />
              <h3 className="font-semibold text-slate-900 dark:text-white">
                We have not measured your reach yet
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                Followers, views, likes and engagement appear here once your content has been
                counted. We would rather leave this blank than show you a number we have not
                earned.
              </p>
            </div>
          )}

          {/* Engagement rate is nullable, so it stands on its own. */}
          {analytics && typeof analytics.avgEngagementRate === 'number' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-slate-500">Engagement rate</span>
                <span className="font-medium text-slate-900 dark:text-white">
                  {(analytics.avgEngagementRate * 100).toFixed(1)}%
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-pink-500 rounded-full"
                  style={{ width: `${Math.min(analytics.avgEngagementRate * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Likes, comments and shares as a share of your views.
              </p>
            </div>
          )}

          {/* Audience and timing, each shown only when the row carries it. */}
          {(genderMix.length > 0 || ageMix.length > 0 || locationMix.length > 0 || peakHours.length > 0) && (
            <div className="grid md:grid-cols-2 gap-6">
              {[
                { title: 'Who watches you', icon: Users, rows: genderMix },
                { title: 'Their age', icon: Users, rows: ageMix },
                { title: 'Where they are', icon: Globe, rows: locationMix },
              ]
                .filter((section) => section.rows.length > 0)
                .map((section) => (
                  <div
                    key={section.title}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6"
                  >
                    <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                      <section.icon className="w-4 h-4 text-pink-600" />
                      {section.title}
                    </h3>
                    <div className="space-y-3">
                      {section.rows.map(([label, share]) => (
                        <div key={label}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-slate-600 dark:text-slate-400 capitalize">
                              {label.replace(/_/g, ' ').toLowerCase()}
                            </span>
                            <span className="font-medium text-slate-900 dark:text-white">
                              {share}%
                            </span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-pink-400 to-purple-500 rounded-full"
                              style={{ width: `${Math.min(share, 100)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

              {peakHours.length > 0 && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-pink-600" />
                    When they are online
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {peakHours.map((hour) => (
                      <span
                        key={hour}
                        className="px-3 py-1 rounded-full bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-300 text-sm font-medium"
                      >
                        {formatHour(hour)}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-3">Your best hours to post.</p>
                </div>
              )}
            </div>
          )}

          {/* The all-time revenue cached on the analytics row, which is a
              different figure from the thirty-day gift total above. */}
          {(hasEarnings || revenueSources.length > 0 || monthlyEarnings.length > 0) && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-pink-600" />
                Revenue on record, all time
              </h3>
              {hasEarnings && (
                <p className="text-3xl font-bold text-slate-900 dark:text-white">
                  {formatCurrency(earnings)}
                </p>
              )}
              {revenueSources.length > 0 && (
                <div className="mt-5 space-y-2">
                  {revenueSources.map(([source, amount]) => (
                    <div
                      key={source}
                      className="flex items-center justify-between text-sm p-2 rounded-lg bg-slate-50 dark:bg-slate-800"
                    >
                      <span className="text-slate-700 dark:text-slate-300 capitalize">
                        {source.replace(/_/g, ' ')}
                      </span>
                      <span className="font-medium text-slate-900 dark:text-white">
                        {formatCurrency(amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {monthlyEarnings.length > 0 && (
                <div className="mt-5">
                  <p className="text-sm font-medium text-slate-900 dark:text-white mb-2">
                    Month by month
                  </p>
                  <div className="space-y-1">
                    {monthlyEarnings.slice(-6).map(([month, amount]) => (
                      <div key={month} className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">{month}</span>
                        <span className="text-slate-900 dark:text-white">
                          {formatCurrency(amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* General coaching from the income-stream endpoint. It is the same
              advice for everyone, so it is headed as advice rather than dressed
              up as a plan built from her numbers. */}
          {actionPlan.length > 0 && (
            <div className="bg-gradient-to-r from-slate-50 to-pink-50 dark:from-slate-800 dark:to-pink-900/20 rounded-xl p-6">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-pink-600" />
                Ways creators grow on ATHENA
              </h3>
              <div className="grid md:grid-cols-2 gap-3">
                {actionPlan.map((step, index) => (
                  <div
                    key={step}
                    className="flex items-start gap-3 p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700"
                  >
                    <span className="w-6 h-6 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {index + 1}
                    </span>
                    <p className="text-slate-700 dark:text-slate-300 text-sm">{step}</p>
                  </div>
                ))}
              </div>
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
