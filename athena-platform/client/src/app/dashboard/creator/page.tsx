'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Calendar,
  Clock,
  DollarSign,
  Download,
  Eye,
  Gift,
  Heart,
  Loader2,
  Settings,
  Upload,
  Radio,
  User,
  Users,
  Video,
  Wallet,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/hooks';
import { CREATOR_SHARE_RANGE_PERCENT, GIFT_POINT_VALUE_AUD, MINIMUM_PAYOUT_AUD } from '@/lib/pricing';

// The server refuses a payout below this; the button says so instead of
// letting someone press it and read the refusal in a toast. It is the price
// book's figure, the same one the server and the Terms read.
const MIN_PAYOUT_AUD = MINIMUM_PAYOUT_AUD;

interface CreatorStats {
  totalEarnings: number;
  periodEarnings: number;
  pendingEarnings: number;
  availableForPayout: number;
  /** ATHENA is looking into a card payment connected to her gifts; withdrawals are paused. */
  payoutHold: boolean;
  /** What she keeps of each gift at her creator tier, in per cent; null when the server did not say. */
  giftSharePercent: number | null;
  tierName: string | null;
  totalViews: number;
  periodViews: number;
  totalLikes: number;
  totalFollowers: number;
  newFollowers: number;
  totalVideos: number;
  liveStreamMinutes: number;
  giftsReceived: number;
}

interface EarningsBreakdown {
  source: string;
  amount: number;
  percentage: number;
  trend: 'up' | 'down' | 'stable';
}

interface RecentVideo {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  views: number;
  likes: number;
  earnings: number;
  createdAt: string;
}

interface TopGifter {
  id: string;
  displayName: string;
  avatar: string | null;
  totalGifts: number;
  totalValue: number;
}

interface AnalyticsResponse {
  summary?: {
    totalPosts?: number;
    totalViews?: number;
    totalLikes?: number;
    totalComments?: number;
    totalShares?: number;
    totalGiftValue?: number;
    totalEarningsFromGifts?: number;
    newFollowers?: number;
    engagementRate?: number;
  };
  profile?: {
    totalEarnings?: number;
    pendingPayout?: number;
  };
  dailyStats?: Array<{
    date: string;
    views?: number;
    likes?: number;
    comments?: number;
    gifts?: number;
    followers?: number;
  }>;
  topPosts?: Array<any>;
}

function pointsToCurrency(points: number | null | undefined): number {
  return (points || 0) * GIFT_POINT_VALUE_AUD;
}

function getPeriodDays(period: '7d' | '30d' | '90d' | 'all'): number {
  if (period === '7d') return 7;
  if (period === '30d') return 30;
  return 90;
}

function postTitle(post: any): string {
  if (typeof post?.title === 'string' && post.title.trim()) return post.title;
  if (typeof post?.content === 'string' && post.content.trim()) {
    return post.content.length > 72 ? `${post.content.slice(0, 72)}...` : post.content;
  }
  return 'Untitled post';
}

function aggregateTopGifters(gifts: any[]): TopGifter[] {
  const bySender = new Map<string, TopGifter>();

  for (const gift of gifts) {
    const sender = gift.sender || {};
    const id = sender.id || gift.senderId || 'unknown';
    const existing = bySender.get(id) || {
      id,
      displayName: sender.displayName || 'Anonymous supporter',
      avatar: sender.avatar || null,
      totalGifts: 0,
      totalValue: 0,
    };

    existing.totalGifts += 1;
    existing.totalValue += pointsToCurrency(gift.creatorShare ?? gift.giftValue);
    bySender.set(id, existing);
  }

  return Array.from(bySender.values())
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, 5);
}

export default function CreatorDashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<CreatorStats | null>(null);
  const [earningsBreakdown, setEarningsBreakdown] = useState<EarningsBreakdown[]>([]);
  const [recentVideos, setRecentVideos] = useState<RecentVideo[]>([]);
  const [topGifters, setTopGifters] = useState<TopGifter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [requestingPayout, setRequestingPayout] = useState(false);
  // The server refused the payout until she has accepted the current Creator
  // Terms Addendum (a creator from before it existed, or before it was last
  // rewritten). Her earnings are untouched; this holds where it sent her.
  const [termsNeeded, setTermsNeeded] = useState<{ message: string; href: string } | null>(null);

  const profileHref = user?.id ? `/profile/${user.id}` : '/profile';

  const requestPayout = async () => {
    setRequestingPayout(true);
    try {
      const response = await api.post('/creator/payouts/request');
      const paid = Number(response.data?.data?.amount) || 0;
      // Not a number of days: the money goes to her Stripe account now, and Stripe
      // pays her bank on a schedule of its own, which this page cannot know.
      toast.success('Payout requested. It is on its way to your Stripe account, and Stripe then pays your bank on its own schedule.');
      // Subtracted, not zeroed. The server now pays out exactly the balance it
      // claimed and leaves anything credited since — a gift that landed while
      // the request was in flight is still hers — so showing zero here would
      // tell her money she still has is gone until the next refresh.
      setStats((current) =>
        current
          ? {
              ...current,
              pendingEarnings: Math.max(0, current.pendingEarnings - paid),
              availableForPayout: Math.max(0, current.availableForPayout - paid),
            }
          : current
      );
    } catch (err: any) {
      const refusal = err?.response?.data ?? {};
      if (refusal.code === 'CREATOR_TERMS_REQUIRED') {
        setTermsNeeded({
          message: refusal.error || refusal.message || 'Please read and accept the Creator Terms Addendum before you are paid.',
          href: typeof refusal.setup === 'string' ? refusal.setup : '/creator-terms',
        });
        return;
      }
      toast.error(refusal.error || refusal.message || 'The payout could not be requested.');
    } finally {
      setRequestingPayout(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setLoading(true);
      setError(null);

      try {
        const days = getPeriodDays(selectedPeriod);
        const [analyticsResponse, profileResponse, giftsResponse] = await Promise.all([
          api.get('/creator/analytics', { params: { days } }),
          api.get('/creator/profile'),
          api.get('/creator/gifts/received', { params: { limit: 100 } }),
        ]);

        if (cancelled) return;

        const analytics = (analyticsResponse.data?.data || {}) as AnalyticsResponse;
        const summary = analytics.summary || {};
        const profile = analytics.profile || {};
        const creatorProfile = profileResponse.data?.data || {};
        const gifts = Array.isArray(giftsResponse.data?.data) ? giftsResponse.data.data : [];

        const periodEarnings = pointsToCurrency(summary.totalEarningsFromGifts);
        const lifetimeEarnings = pointsToCurrency(profile.totalEarnings);
        const pendingEarnings = pointsToCurrency(profile.pendingPayout);

        setStats({
          totalEarnings: lifetimeEarnings,
          periodEarnings,
          pendingEarnings,
          availableForPayout: pendingEarnings,
          payoutHold: Boolean(creatorProfile.payoutHold),
          giftSharePercent: typeof creatorProfile.tier?.revShare === 'number' ? creatorProfile.tier.revShare : null,
          tierName: typeof creatorProfile.tier?.name === 'string' ? creatorProfile.tier.name : null,
          totalViews: summary.totalViews || 0,
          periodViews: summary.totalViews || 0,
          totalLikes: summary.totalLikes || 0,
          totalFollowers: creatorProfile.followerCount || 0,
          newFollowers: summary.newFollowers || 0,
          totalVideos: summary.totalPosts || 0,
          liveStreamMinutes: 0,
          giftsReceived: gifts.length,
        });

        setEarningsBreakdown(
          periodEarnings > 0
            ? [{ source: 'Creator gifts', amount: periodEarnings, percentage: 100, trend: 'stable' }]
            : []
        );

        setRecentVideos(
          (analytics.topPosts || []).map((post) => ({
            id: post.id,
            title: postTitle(post),
            thumbnailUrl: post.thumbnailUrl || post.imageUrl || null,
            views: post.viewCount || 0,
            likes: post.likeCount || 0,
            earnings: 0,
            createdAt: post.createdAt || new Date().toISOString(),
          }))
        );

        setTopGifters(aggregateTopGifters(gifts));
      } catch (err: any) {
        if (cancelled) return;
        setStats(null);
        setEarningsBreakdown([]);
        setRecentVideos([]);
        setTopGifters([]);
        setError(err?.response?.data?.message || 'Creator analytics are unavailable right now.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [selectedPeriod]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(value);
  };

  const formatNumber = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toString();
  };

  const periodLabel = selectedPeriod === 'all' ? 'Last 90 days' : `Last ${getPeriodDays(selectedPeriod)} days`;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:h-20">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Creator Dashboard</h1>
              <p className="text-sm text-slate-500">Manage your content and earnings</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={selectedPeriod}
                onChange={(event) => setSelectedPeriod(event.target.value as any)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="all">All available</option>
              </select>
              <Button asChild variant="outline">
                <Link href="/dashboard/live">
                  <Radio className="w-4 h-4 mr-2" />
                  Go live
                </Link>
              </Button>
              <Button asChild>
                <Link href="/dashboard/creator-studio">
                  <Upload className="w-4 h-4 mr-2" />
                  Publish a reel
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <Card className="mb-8 border-red-200 bg-red-50">
            <CardContent className="pt-6 text-red-700">{error}</CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-indigo-100 text-sm font-medium">{periodLabel}</p>
                  <p className="text-3xl font-bold mt-1">{formatCurrency(stats?.periodEarnings || 0)}</p>
                  <div className="flex items-center mt-2 text-indigo-100">
                    <Gift className="w-4 h-4 mr-1" />
                    <span className="text-sm">Gift earnings</span>
                  </div>
                </div>
                <div className="p-3 bg-white/20 rounded-full">
                  <DollarSign className="w-8 h-8" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-sm font-medium">Total Views</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">{formatNumber(stats?.totalViews || 0)}</p>
                  <div className="flex items-center mt-2 text-green-600">
                    <ArrowUpRight className="w-4 h-4 mr-1" />
                    <span className="text-sm">{formatNumber(stats?.periodViews || 0)} in period</span>
                  </div>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <Eye className="w-8 h-8 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-sm font-medium">Followers</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">{formatNumber(stats?.totalFollowers || 0)}</p>
                  <div className="flex items-center mt-2 text-green-600">
                    <ArrowUpRight className="w-4 h-4 mr-1" />
                    <span className="text-sm">+{formatNumber(stats?.newFollowers || 0)} in period</span>
                  </div>
                </div>
                <div className="p-3 bg-pink-100 rounded-full">
                  <Users className="w-8 h-8 text-pink-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-sm font-medium">Gifts Received</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">{formatNumber(stats?.giftsReceived || 0)}</p>
                  <div className="flex items-center mt-2 text-slate-500">
                    <Clock className="w-4 h-4 mr-1" />
                    <span className="text-sm">Streaming data pending</span>
                  </div>
                </div>
                <div className="p-3 bg-yellow-100 rounded-full">
                  <Gift className="w-8 h-8 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="w-5 h-5 mr-2 text-indigo-600" />
                  Earnings Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                {earningsBreakdown.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    No creator earnings recorded for this period.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {earningsBreakdown.map((item) => (
                      <div key={item.source} className="flex items-center">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-slate-700">{item.source}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-slate-900">
                                {formatCurrency(item.amount)}
                              </span>
                              {item.trend === 'up' && <ArrowUpRight className="w-4 h-4 text-green-500" />}
                              {item.trend === 'down' && <ArrowDownRight className="w-4 h-4 text-red-500" />}
                            </div>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-2">
                            <div
                              className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                              style={{ width: `${item.percentage}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center">
                    <Video className="w-5 h-5 mr-2 text-indigo-600" />
                    Top Content
                  </CardTitle>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={profileHref}>View all</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {recentVideos.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    No posts or videos have analytics in this period.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentVideos.map((video) => (
                      <div key={video.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                        <div className="w-24 h-14 bg-slate-200 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {video.thumbnailUrl ? (
                            <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <Video className="w-8 h-8 text-slate-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-slate-900 truncate">{video.title}</h4>
                          <div className="flex flex-wrap items-center gap-4 mt-1 text-sm text-slate-500">
                            <span className="flex items-center">
                              <Eye className="w-4 h-4 mr-1" />
                              {formatNumber(video.views)}
                            </span>
                            <span className="flex items-center">
                              <Heart className="w-4 h-4 mr-1" />
                              {formatNumber(video.likes)}
                            </span>
                            <span className="flex items-center">
                              <Calendar className="w-4 h-4 mr-1" />
                              {new Date(video.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-green-600">{formatCurrency(video.earnings)}</p>
                          <p className="text-xs text-slate-500">Tracked gifts</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Wallet className="w-5 h-5 mr-2 text-indigo-600" />
                  Your Wallet
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-500">Available for Payout</p>
                  <p className="text-2xl font-bold text-slate-900">{formatCurrency(stats?.availableForPayout || 0)}</p>
                </div>
                <div className="p-4 bg-yellow-50 rounded-lg">
                  <p className="text-sm text-yellow-700">Pending</p>
                  <p className="text-lg font-semibold text-yellow-800">{formatCurrency(stats?.pendingEarnings || 0)}</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-green-700">Lifetime Earnings</p>
                  <p className="text-lg font-semibold text-green-800">{formatCurrency(stats?.totalEarnings || 0)}</p>
                </div>
                <Button
                  className="w-full"
                  onClick={requestPayout}
                  disabled={requestingPayout || Boolean(stats?.payoutHold) || (stats?.availableForPayout ?? 0) < MIN_PAYOUT_AUD}
                >
                  {requestingPayout ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  Request payout
                </Button>
                {termsNeeded && (
                  <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                    {termsNeeded.message}{' '}
                    <Link href={termsNeeded.href} className="font-semibold underline">
                      Read and accept it
                    </Link>
                  </p>
                )}
                <p className="text-xs text-slate-500 text-center">
                  {stats?.payoutHold
                    ? 'Withdrawals are paused while ATHENA looks into a card payment connected to some of the gifts you were sent. Your balance is safe and keeps growing, and we will write to you when withdrawals are open again.'
                    : (stats?.availableForPayout ?? 0) < MIN_PAYOUT_AUD
                      ? `You can ask for a payout once your balance reaches A$${MIN_PAYOUT_AUD}. Until then it carries over.`
                      : 'Stripe pays it into your bank on its own schedule.'}
                </p>
                {/* The exact share and the rules, beside the button that moves the money. */}
                <p className="text-xs text-slate-500 text-center">
                  {stats?.giftSharePercent != null
                    ? `You keep ${stats.giftSharePercent}% of each gift${stats.tierName ? ` at ${stats.tierName} tier` : ''}.`
                    : `You keep ${CREATOR_SHARE_RANGE_PERCENT.min}% to ${CREATOR_SHARE_RANGE_PERCENT.max}% of each gift, by creator tier.`}{' '}
                  ATHENA takes no fee when you withdraw. Payouts are in Australian dollars, go to your own verified
                  Stripe account, and are only made when you ask. There is no other minimum or waiting period.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Gift className="w-5 h-5 mr-2 text-indigo-600" />
                  Top Supporters
                </CardTitle>
              </CardHeader>
              <CardContent>
                {topGifters.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    No supporters recorded yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {topGifters.map((gifter, index) => (
                      <div key={gifter.id} className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          index === 0 ? 'bg-yellow-100 text-yellow-700' :
                          index === 1 ? 'bg-slate-100 text-slate-700' :
                          index === 2 ? 'bg-orange-100 text-orange-700' :
                          'bg-slate-50 text-slate-500'
                        }`}>
                          {index + 1}
                        </div>
                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center overflow-hidden">
                          {gifter.avatar ? (
                            <img src={gifter.avatar} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-indigo-600 font-semibold">
                              {gifter.displayName.charAt(0)}
                            </span>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-slate-900">{gifter.displayName}</p>
                          <p className="text-sm text-slate-500">{gifter.totalGifts} gifts</p>
                        </div>
                        <p className="font-semibold text-indigo-600">{formatCurrency(gifter.totalValue)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              {/* Each of these goes somewhere real. The previous three
                  ("Stream Settings", "View Analytics", "Manage Subscribers")
                  had no handler and no page behind them. */}
              <CardContent className="space-y-2">
                <Button asChild variant="outline" className="w-full justify-start">
                  <Link href="/dashboard/creator-studio">
                    <Video className="w-4 h-4 mr-2" />
                    Publish a reel
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full justify-start">
                  <Link href={profileHref}>
                    <User className="w-4 h-4 mr-2" />
                    Your public profile
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full justify-start">
                  <Link href="/dashboard/settings/notifications">
                    <Settings className="w-4 h-4 mr-2" />
                    Notification settings
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
