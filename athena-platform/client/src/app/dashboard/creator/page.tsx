'use client';

import { useState, useEffect } from 'react';
import { 
  DollarSign, 
  Eye, 
  Heart, 
  Video, 
  TrendingUp, 
  Users, 
  Download,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Gift,
  Wallet,
  Play,
  Settings,
  BarChart3,
  Upload,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface CreatorStats {
  totalEarnings: number;
  thisMonthEarnings: number;
  pendingEarnings: number;
  availableForPayout: number;
  totalViews: number;
  thisMonthViews: number;
  totalLikes: number;
  totalFollowers: number;
  followerGrowth: number;
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

export default function CreatorDashboardPage() {
  const [stats, setStats] = useState<CreatorStats | null>(null);
  const [earningsBreakdown, setEarningsBreakdown] = useState<EarningsBreakdown[]>([]);
  const [recentVideos, setRecentVideos] = useState<RecentVideo[]>([]);
  const [topGifters, setTopGifters] = useState<TopGifter[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  useEffect(() => {
    // Mock data - replace with actual API calls
    const mockStats: CreatorStats = {
      totalEarnings: 12450.50,
      thisMonthEarnings: 2340.00,
      pendingEarnings: 450.25,
      availableForPayout: 1890.75,
      totalViews: 458320,
      thisMonthViews: 52400,
      totalLikes: 28450,
      totalFollowers: 8520,
      followerGrowth: 12.5,
      totalVideos: 45,
      liveStreamMinutes: 1240,
      giftsReceived: 3420,
    };

    const mockBreakdown: EarningsBreakdown[] = [
      { source: 'Live Gifts', amount: 1250.00, percentage: 53, trend: 'up' },
      { source: 'Video Views', amount: 680.00, percentage: 29, trend: 'up' },
      { source: 'Subscriptions', amount: 310.00, percentage: 13, trend: 'stable' },
      { source: 'Tips', amount: 100.00, percentage: 5, trend: 'down' },
    ];

    const mockVideos: RecentVideo[] = [
      { id: '1', title: 'My Journey to Tech Lead', thumbnailUrl: null, views: 12400, likes: 890, earnings: 124.00, createdAt: '2026-01-15' },
      { id: '2', title: 'Salary Negotiation Tips', thumbnailUrl: null, views: 8900, likes: 650, earnings: 89.00, createdAt: '2026-01-12' },
      { id: '3', title: 'Interview Prep Guide', thumbnailUrl: null, views: 6700, likes: 420, earnings: 67.00, createdAt: '2026-01-10' },
      { id: '4', title: 'Resume Building 101', thumbnailUrl: null, views: 5200, likes: 380, earnings: 52.00, createdAt: '2026-01-08' },
    ];

    const mockGifters: TopGifter[] = [
      { id: '1', displayName: 'Sarah M.', avatar: null, totalGifts: 45, totalValue: 450.00 },
      { id: '2', displayName: 'Emily K.', avatar: null, totalGifts: 32, totalValue: 280.00 },
      { id: '3', displayName: 'Jessica L.', avatar: null, totalGifts: 28, totalValue: 210.00 },
      { id: '4', displayName: 'Amanda R.', avatar: null, totalGifts: 22, totalValue: 165.00 },
      { id: '5', displayName: 'Michelle T.', avatar: null, totalGifts: 18, totalValue: 135.00 },
    ];

    setTimeout(() => {
      setStats(mockStats);
      setEarningsBreakdown(mockBreakdown);
      setRecentVideos(mockVideos);
      setTopGifters(mockGifters);
      setLoading(false);
    }, 500);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Creator Dashboard</h1>
              <p className="text-sm text-gray-500">Manage your content and earnings</p>
            </div>
            <div className="flex items-center gap-4">
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="all">All time</option>
              </select>
              <Button>
                <Upload className="w-4 h-4 mr-2" />
                Upload Video
              </Button>
              <Button variant="outline">
                <Play className="w-4 h-4 mr-2" />
                Go Live
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Earnings Card */}
          <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-indigo-100 text-sm font-medium">This Month</p>
                  <p className="text-3xl font-bold mt-1">{formatCurrency(stats?.thisMonthEarnings || 0)}</p>
                  <div className="flex items-center mt-2 text-indigo-100">
                    <ArrowUpRight className="w-4 h-4 mr-1" />
                    <span className="text-sm">+18% from last month</span>
                  </div>
                </div>
                <div className="p-3 bg-white/20 rounded-full">
                  <DollarSign className="w-8 h-8" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Views Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm font-medium">Total Views</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{formatNumber(stats?.totalViews || 0)}</p>
                  <div className="flex items-center mt-2 text-green-600">
                    <ArrowUpRight className="w-4 h-4 mr-1" />
                    <span className="text-sm">+{formatNumber(stats?.thisMonthViews || 0)} this month</span>
                  </div>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <Eye className="w-8 h-8 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Followers Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm font-medium">Followers</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{formatNumber(stats?.totalFollowers || 0)}</p>
                  <div className="flex items-center mt-2 text-green-600">
                    <ArrowUpRight className="w-4 h-4 mr-1" />
                    <span className="text-sm">+{stats?.followerGrowth}% growth</span>
                  </div>
                </div>
                <div className="p-3 bg-pink-100 rounded-full">
                  <Users className="w-8 h-8 text-pink-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Gifts Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm font-medium">Gifts Received</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{formatNumber(stats?.giftsReceived || 0)}</p>
                  <div className="flex items-center mt-2 text-gray-500">
                    <Clock className="w-4 h-4 mr-1" />
                    <span className="text-sm">{stats?.liveStreamMinutes} min streamed</span>
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
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-8">
            {/* Earnings Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="w-5 h-5 mr-2 text-indigo-600" />
                  Earnings Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {earningsBreakdown.map((item) => (
                    <div key={item.source} className="flex items-center">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700">{item.source}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900">
                              {formatCurrency(item.amount)}
                            </span>
                            {item.trend === 'up' && (
                              <ArrowUpRight className="w-4 h-4 text-green-500" />
                            )}
                            {item.trend === 'down' && (
                              <ArrowDownRight className="w-4 h-4 text-red-500" />
                            )}
                          </div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${item.percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Videos */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center">
                    <Video className="w-5 h-5 mr-2 text-indigo-600" />
                    Recent Videos
                  </CardTitle>
                  <Button variant="ghost" size="sm">View All</Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentVideos.map((video) => (
                    <div key={video.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="w-24 h-14 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Video className="w-8 h-8 text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 truncate">{video.title}</h4>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
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
                        <p className="text-xs text-gray-500">Earned</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-8">
            {/* Wallet Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Wallet className="w-5 h-5 mr-2 text-indigo-600" />
                  Your Wallet
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Available for Payout</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats?.availableForPayout || 0)}</p>
                </div>
                <div className="p-4 bg-yellow-50 rounded-lg">
                  <p className="text-sm text-yellow-700">Pending (7-day hold)</p>
                  <p className="text-lg font-semibold text-yellow-800">{formatCurrency(stats?.pendingEarnings || 0)}</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-green-700">Lifetime Earnings</p>
                  <p className="text-lg font-semibold text-green-800">{formatCurrency(stats?.totalEarnings || 0)}</p>
                </div>
                <Button className="w-full">
                  <Download className="w-4 h-4 mr-2" />
                  Request Payout
                </Button>
                <p className="text-xs text-gray-500 text-center">
                  Minimum payout: $50 AUD. Processing time: 3-5 business days.
                </p>
              </CardContent>
            </Card>

            {/* Top Gifters */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Gift className="w-5 h-5 mr-2 text-indigo-600" />
                  Top Supporters
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topGifters.map((gifter, index) => (
                    <div key={gifter.id} className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        index === 0 ? 'bg-yellow-100 text-yellow-700' :
                        index === 1 ? 'bg-gray-100 text-gray-700' :
                        index === 2 ? 'bg-orange-100 text-orange-700' :
                        'bg-gray-50 text-gray-500'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                        <span className="text-indigo-600 font-semibold">
                          {gifter.displayName.charAt(0)}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{gifter.displayName}</p>
                        <p className="text-sm text-gray-500">{gifter.totalGifts} gifts</p>
                      </div>
                      <p className="font-semibold text-indigo-600">{formatCurrency(gifter.totalValue)}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start">
                  <Settings className="w-4 h-4 mr-2" />
                  Stream Settings
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  View Analytics
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Users className="w-4 h-4 mr-2" />
                  Manage Subscribers
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
