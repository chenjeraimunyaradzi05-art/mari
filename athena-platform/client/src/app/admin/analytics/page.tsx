'use client';

/**
 * Platform analytics for staff. Growth against the previous period, the
 * per-day series and the top content come from /api/analytics/* (the
 * analytics service's real aggregates, which nothing called before);
 * the engagement counts come from /admin/analytics/engagement as they did.
 *
 * Revenue comes from /admin/ops/revenue, summed from the amounts Stripe
 * recorded on each subscription. The older /admin/analytics/revenue priced
 * tiers named PRO and BUSINESS, which are not in the SubscriptionTier enum,
 * so it reported AU$0 forever; it is not read here any more.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Briefcase, ChevronLeft, DollarSign, Heart, MessageSquare, TrendingUp, Users, Sparkles, Activity } from 'lucide-react';
import { api } from '@/lib/api';
import { adminOpsApi, type RevenueSummary } from '@/lib/admin-ops-api';
import { analyticsApi, type EngagementSeries, type GrowthMetrics, type TopContent, type TopContentPeriod } from '@/lib/admin-analytics-api';
import { cn } from '@/lib/utils';

interface EngagementMetrics {
  period: { label: string; days: number; start: string; end: string };
  metrics: { newPosts: number; newComments: number; newLikes: number; newApplications: number; activeUsers: number };
}

const PERIODS: Array<[TopContentPeriod, string]> = [
  ['day', 'Today'],
  ['week', 'This week'],
  ['month', 'This month'],
];

function formatMoney(amount: number, currency: string | null) {
  if (!currency || currency === 'UNKNOWN') return amount.toLocaleString(undefined, { maximumFractionDigits: 2 });
  try {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

const tierLabel = (tier: string) => tier.replace(/^PREMIUM_/, '').replace(/_/g, ' ').toLowerCase();
const authorName = (a: { displayName: string | null }) => a.displayName || 'A member';

/** One side of the growth strip: this period against the one before it. */
function GrowthTile({ label, figures }: { label: string; figures: GrowthMetrics['users'] | undefined }) {
  if (!figures) return null;
  const change = figures.previous > 0 ? figures.growthPercent : null;
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-slate-900 dark:text-white">{figures.current.toLocaleString()}</p>
      <p className="text-sm text-slate-500 mt-1">
        {change === null
          ? figures.previous === 0 && figures.current === 0
            ? 'Nothing in either period yet'
            : 'No earlier period to compare against'
          : (
            <>
              <span className={cn('font-medium', change > 0 ? 'text-emerald-600' : change < 0 ? 'text-red-600' : 'text-slate-600')}>
                {change > 0 ? '+' : ''}{change}%
              </span>{' '}
              against {figures.previous.toLocaleString()} the period before
            </>
          )}
      </p>
    </div>
  );
}

/** A compact per-day bar strip; height is relative to the busiest day in the window. */
function DailyBars({ label, points, tone }: { label: string; points: Array<{ date: string; value: number }>; tone: string }) {
  const max = Math.max(0, ...points.map((p) => p.value));
  const total = points.reduce((n, p) => n + p.value, 0);
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-sm text-slate-600 dark:text-slate-300">{label}</span>
        <span className="text-xs text-slate-500">{total.toLocaleString()} in the window</span>
      </div>
      {max === 0 ? (
        <p className="text-xs text-slate-400 py-3">Nothing on any day in this window.</p>
      ) : (
        <div className="flex items-end gap-px h-16" role="img" aria-label={`${label} per day`}>
          {points.map((p) => (
            <div
              key={p.date}
              title={`${p.date}: ${p.value.toLocaleString()}`}
              className={cn('flex-1 rounded-t-sm min-w-[2px]', tone)}
              style={{ height: `${Math.max(2, Math.round((p.value / max) * 100))}%` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const [days, setDays] = useState(30);
  const [period, setPeriod] = useState<TopContentPeriod>('week');

  const engagement = useQuery<EngagementMetrics>({
    queryKey: ['admin-analytics-engagement', days],
    queryFn: async () => (await api.get(`/admin/analytics/engagement?days=${days}`)).data,
  });
  const revenue = useQuery({
    queryKey: ['admin-ops-revenue'],
    queryFn: () => adminOpsApi.revenue(),
    select: (r) => r.data as RevenueSummary,
  });
  const growth = useQuery({
    queryKey: ['admin-analytics-growth', days],
    queryFn: () => analyticsApi.growth(days),
    select: (r) => r.data as GrowthMetrics,
  });
  const series = useQuery({
    queryKey: ['admin-analytics-series', days],
    queryFn: () => analyticsApi.engagement(days),
    select: (r) => r.data as EngagementSeries,
  });
  const top = useQuery({
    queryKey: ['admin-analytics-top-content', period],
    queryFn: () => analyticsApi.topContent(period, 10),
    select: (r) => r.data as TopContent,
  });

  const isLoading = engagement.isLoading || revenue.isLoading;
  const activeUsers = engagement.data?.metrics.activeUsers || 0;
  const newPosts = engagement.data?.metrics.newPosts || 0;
  const newComments = engagement.data?.metrics.newComments || 0;
  const newLikes = engagement.data?.metrics.newLikes || 0;
  const r = revenue.data;

  const engagementCards = [
    { label: 'Active Users', value: activeUsers, icon: Users, color: 'text-blue-600' },
    { label: 'New Posts', value: newPosts, icon: MessageSquare, color: 'text-purple-600' },
    { label: 'New Comments', value: newComments, icon: MessageSquare, color: 'text-green-600' },
    { label: 'New Likes', value: newLikes, icon: Heart, color: 'text-pink-600' },
    { label: 'Job Applications', value: engagement.data?.metrics.newApplications || 0, icon: Briefcase, color: 'text-orange-600' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <header className="bg-white dark:bg-slate-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-slate-500 hover:text-slate-700" aria-label="Back to admin">
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Platform Analytics</h1>
              <p className="text-slate-600 dark:text-slate-400">Growth, engagement and what is being read</p>
            </div>
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-12" role="status" aria-label="Loading">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
          </div>
        ) : (
          <>
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Revenue
              </h2>
              {!r ? (
                <p className="text-sm text-slate-500">Recorded subscription amounts could not be read.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg shadow p-6 text-white">
                    <p className="text-purple-100 text-sm">Monthly recurring revenue</p>
                    {r.mrr === null ? (
                      <>
                        <p className="text-xl font-semibold">{r.mixedCurrencies ? 'Mixed currencies' : 'Not recorded yet'}</p>
                        <p className="text-xs text-purple-100 mt-1">
                          {r.subscriptions.paying === 0 ? 'No paying subscriptions yet.' : `${r.subscriptions.recorded} of ${r.subscriptions.paying} paying subscriptions carry an amount.`}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-3xl font-bold">{formatMoney(r.mrr, r.currency)}</p>
                        <p className="text-xs text-purple-100 mt-1">
                          From {r.subscriptions.recorded} recorded {r.subscriptions.recorded === 1 ? 'subscription' : 'subscriptions'}
                          {r.subscriptions.notRecorded > 0 && `; ${r.subscriptions.notRecorded} without an amount`}
                        </p>
                      </>
                    )}
                  </div>
                  <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg shadow p-6 text-white">
                    <p className="text-blue-100 text-sm">Annualised</p>
                    <p className="text-3xl font-bold">{r.arr === null ? '—' : formatMoney(r.arr, r.currency)}</p>
                    <p className="text-xs text-blue-100 mt-1">Twelve times the monthly figure; not a forecast.</p>
                  </div>
                  <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
                    <p className="text-slate-500 text-sm mb-3">By tier</p>
                    {r.byTier.length === 0 ? (
                      <p className="text-sm text-slate-500">No paying subscriptions yet.</p>
                    ) : (
                      <ul className="space-y-2">
                        {r.byTier.map((t) => (
                          <li key={t.tier} className="flex items-center justify-between text-sm">
                            <span className="text-slate-700 dark:text-slate-300 capitalize">{tierLabel(t.tier)}</span>
                            <span className="text-right">
                              <span className="font-semibold text-slate-900 dark:text-white">{t.count} {t.count === 1 ? 'member' : 'members'}</span>
                              <span className="text-slate-500 ml-2">
                                {t.mrr === null ? (t.mixedCurrencies ? 'mixed currencies' : 'no amount recorded') : `${formatMoney(t.mrr, t.currency)}/mo`}
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </section>

            <section className="mb-8">
              <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Growth and engagement ({engagement.data?.period?.label || `${days} days`})
                </h2>
                <div className="max-w-xs">
                  <label htmlFor="analytics-window" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Time window
                  </label>
                  <select id="analytics-window" value={days} onChange={(event) => setDays(Number(event.target.value))} className="input w-full">
                    <option value={7}>Last 7 days</option>
                    <option value={30}>Last 30 days</option>
                    <option value={90}>Last 90 days</option>
                    <option value={180}>Last 180 days</option>
                  </select>
                </div>
              </div>

              {/* Growth strip */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {growth.isLoading ? (
                  <p className="text-sm text-slate-500">Comparing with the previous period…</p>
                ) : growth.data ? (
                  <>
                    <GrowthTile label="New members" figures={growth.data.users} />
                    <GrowthTile label="New posts" figures={growth.data.posts} />
                  </>
                ) : (
                  <p className="text-sm text-slate-500">Growth could not be read.</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {engagementCards.map((card) => (
                  <div key={card.label} className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <card.icon className={`h-5 w-5 ${card.color}`} />
                      <span className="text-sm text-slate-500">{card.label}</span>
                    </div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{card.value.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Daily series */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Day by day
              </h2>
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6 space-y-5">
                {series.isLoading ? (
                  <p className="text-sm text-slate-500">Counting each day…</p>
                ) : series.data ? (
                  <>
                    <DailyBars label="New members" points={series.data.newUsers} tone="bg-blue-500" />
                    <DailyBars label="Likes" points={series.data.likes} tone="bg-pink-500" />
                    <DailyBars label="Comments" points={series.data.comments} tone="bg-emerald-500" />
                    <p className="text-xs text-slate-500">Each bar is one day; the tallest bar is the busiest day in the window. Hover a bar for the date and count.</p>
                  </>
                ) : (
                  <p className="text-sm text-slate-500">The daily series could not be read.</p>
                )}
              </div>
            </section>

            {/* Top content */}
            <section className="mb-8">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Most engaged with
                </h2>
                <div className="flex gap-1" role="group" aria-label="Period">
                  {PERIODS.map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setPeriod(value)}
                      aria-pressed={period === value}
                      className={cn('rounded-full px-3 py-1 text-sm', period === value ? 'bg-purple-600 text-white' : 'bg-white text-slate-600 shadow dark:bg-slate-800 dark:text-slate-300')}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {top.isLoading ? (
                <p className="text-sm text-slate-500">Ranking…</p>
              ) : !top.data ? (
                <p className="text-sm text-slate-500">Top content could not be read.</p>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
                    <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Posts</h3>
                    {top.data.topPosts.length === 0 ? (
                      <p className="text-sm text-slate-500">No posts in this period.</p>
                    ) : (
                      <ol className="space-y-3">
                        {top.data.topPosts.map((p) => (
                          <li key={p.id} className="text-sm">
                            <p className="text-slate-900 dark:text-white line-clamp-2">{p.content || `(${p.type.toLowerCase()} post)`}</p>
                            <p className="text-xs text-slate-500">
                              {authorName(p.author)} · {p.likeCount} likes · {p.commentCount} comments · {p.viewCount} views
                            </p>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                  <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
                    <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Videos</h3>
                    {top.data.topVideos.length === 0 ? (
                      <p className="text-sm text-slate-500">No video posts in this period.</p>
                    ) : (
                      <ol className="space-y-3">
                        {top.data.topVideos.map((v) => (
                          <li key={v.id} className="text-sm">
                            <p className="text-slate-900 dark:text-white line-clamp-2">{v.content || '(video)'}</p>
                            <p className="text-xs text-slate-500">{authorName(v.author)} · {v.viewCount} views · {v.likeCount} likes</p>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                  <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
                    <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Creators</h3>
                    {top.data.topCreators.length === 0 ? (
                      <p className="text-sm text-slate-500">No creator posted in this period.</p>
                    ) : (
                      <ol className="space-y-3">
                        {top.data.topCreators.map((c) => (
                          <li key={c.id} className="text-sm">
                            <p className="text-slate-900 dark:text-white">{c.displayName || 'A creator'}</p>
                            <p className="text-xs text-slate-500">
                              {c.followers} followers · {c.totalViews} views · {c.totalLikes} likes · {c.totalComments} comments
                            </p>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                </div>
              )}
            </section>

            <section className="mt-8">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Key Ratios</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
                  <p className="text-sm text-slate-500 mb-1">Posts per Active User</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{activeUsers ? (newPosts / activeUsers).toFixed(2) : '0'}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
                  <p className="text-sm text-slate-500 mb-1">Comments per Post</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{newPosts ? (newComments / newPosts).toFixed(2) : '0'}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
                  <p className="text-sm text-slate-500 mb-1">Likes per Post</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{newPosts ? (newLikes / newPosts).toFixed(2) : '0'}</p>
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
