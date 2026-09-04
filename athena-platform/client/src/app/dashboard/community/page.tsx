'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  Users,
  Award,
  Sparkles,
  MessageSquare,
  CalendarDays,
  Flame,
  ArrowUpRight,
  Trophy,
  Briefcase,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import Feed from '@/components/community/Feed';
import CreatePostWidget from '@/components/community/CreatePostWidget';
import AchievementsPanel from '@/components/community/AchievementsPanel';
import StoriesStrip from '@/components/community/StoriesStrip';

const tabs = [
  { id: 'for-you', name: 'For You', icon: TrendingUp },
  { id: 'following', name: 'Following', icon: Users },
  { id: 'achievements', name: 'Wins', icon: Award },
] as const;

type TabId = (typeof tabs)[number]['id'];

// Slices of the feed by kind of post. Wins and polls are the two the
// community asks for by name; the rest ride the type filter the API has.
const POST_FILTERS = [
  { value: 'all', label: 'Everything' },
  { value: 'win', label: '🏆 Wins' },
  { value: 'poll', label: 'Polls' },
  { value: 'video', label: 'Video' },
  { value: 'image', label: 'Photos' },
] as const;
type PostFilter = (typeof POST_FILTERS)[number]['value'];

type CommunityPost = {
  id: string;
  content?: string | null;
};

type CommunityEvent = {
  id: string;
  title: string;
  date: string;
  startTime?: string | null;
};

type LeaderboardEntry = {
  id?: string;
  displayName?: string | null;
  xp?: number | null;
  postCount?: number | null;
  currentStreak?: number | null;
  user?: {
    id?: string;
    displayName?: string | null;
  };
  _count?: {
    followers?: number;
  };
};

type CommunityStat = {
  label: string;
  value: string;
  icon: typeof Users;
  accent: string;
  isLoading?: boolean;
};

function formatCount(value: number | undefined): string {
  if (value === undefined) return '0';
  return new Intl.NumberFormat('en', { notation: value >= 1000 ? 'compact' : 'standard' }).format(value);
}

function extractTrendingTopics(posts: CommunityPost[]) {
  const topicCounts = new Map<string, number>();

  posts.forEach((post) => {
    const matches = post.content?.match(/#[\p{L}\p{N}_-]+/gu) ?? [];
    matches.forEach((tag) => {
      const normalized = tag.toLowerCase();
      topicCounts.set(normalized, (topicCounts.get(normalized) ?? 0) + 1);
    });
  });

  return Array.from(topicCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([tag, count]) => ({ tag, posts: `${formatCount(count)} ${count === 1 ? 'post' : 'posts'}` }));
}

function formatEventDate(event: CommunityEvent): string {
  const date = new Date(event.date);
  const dateText = Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return event.startTime ? `${dateText} · ${event.startTime}` : dateText;
}

function getLeaderboardName(entry: LeaderboardEntry): string {
  return entry.displayName || entry.user?.displayName || 'Member';
}

function getLeaderboardPoints(entry: LeaderboardEntry): string {
  if (typeof entry.xp === 'number') return `${formatCount(entry.xp)} XP`;
  if (typeof entry.postCount === 'number') return `${formatCount(entry.postCount)} posts`;
  if (typeof entry.currentStreak === 'number') return `${formatCount(entry.currentStreak)} day streak`;
  if (typeof entry._count?.followers === 'number') return `${formatCount(entry._count.followers)} followers`;

  return 'No score';
}

export default function CommunityPage() {
  const [activeTab, setActiveTab] = useState<TabId>('for-you');
  const [postFilter, setPostFilter] = useState<PostFilter>('all');
  const { data: feedOverview, isLoading: isLoadingFeedOverview } = useQuery({
    queryKey: ['community-dashboard', 'feed-overview'],
    queryFn: async () => {
      const res = await api.get('/posts/feed', { params: { tab: 'for-you', limit: 50 } });
      return {
        posts: (res.data?.data ?? []) as CommunityPost[],
        total: Number(res.data?.pagination?.total ?? res.data?.data?.length ?? 0),
      };
    },
  });
  const { data: events = [], isLoading: isLoadingEvents } = useQuery({
    queryKey: ['community-dashboard', 'events'],
    queryFn: async () => {
      const res = await api.get('/events');
      const allEvents = (res.data?.data ?? []) as CommunityEvent[];
      const now = Date.now();

      return allEvents
        .filter((event) => {
          const eventTime = new Date(event.date).getTime();
          return Number.isNaN(eventTime) || eventTime >= now;
        })
        .slice(0, 3);
    },
  });
  const { data: leaderboard = [], isLoading: isLoadingLeaderboard } = useQuery({
    queryKey: ['community-dashboard', 'leaderboard'],
    queryFn: async () => {
      const res = await api.get('/engagement/leaderboard', {
        params: { type: 'xp', period: 'weekly', limit: 3 },
      });
      return (res.data?.leaderboard ?? []) as LeaderboardEntry[];
    },
  });

  const trendingTopics = extractTrendingTopics(feedOverview?.posts ?? []);
  const stats: CommunityStat[] = [
    {
      label: 'Recent feed posts',
      value: formatCount(feedOverview?.total),
      icon: MessageSquare,
      accent: 'bg-blue-50 text-blue-600',
      isLoading: isLoadingFeedOverview,
    },
    {
      label: 'Upcoming events',
      value: formatCount(events.length),
      icon: CalendarDays,
      accent: 'bg-purple-50 text-purple-600',
      isLoading: isLoadingEvents,
    },
    {
      label: 'Leaderboard entries',
      value: formatCount(leaderboard.length),
      icon: Trophy,
      accent: 'bg-emerald-50 text-emerald-600',
      isLoading: isLoadingLeaderboard,
    },
  ];

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-primary-600">
            <Sparkles className="w-5 h-5" />
            <span className="text-sm font-semibold uppercase tracking-wider">Community</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mt-2">
            Discover insights, celebrate wins, and grow your network
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Curated updates from your circles, trending discussions, and new opportunities.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/dashboard/search?type=people"
            className="btn-secondary inline-flex items-center gap-2"
          >
            <Users className="w-4 h-4" />
            Find mentors
          </Link>
          <Link
            href="/dashboard/groups"
            className="btn-primary inline-flex items-center gap-2"
          >
            <MessageSquare className="w-4 h-4" />
            Join a group
          </Link>
        </div>
      </div>

      {/* Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center gap-4"
          >
            <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', stat.accent)}>
              <stat.icon className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-semibold text-slate-900 dark:text-white">
                {stat.isLoading ? <Loader2 className="h-5 w-5 animate-spin text-slate-400" /> : stat.value}
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
        <div className="space-y-6">
          {/* Status / Stories */}
          <StoriesStrip />

          {/* Create Post Widget */}
          <CreatePostWidget />

          {/* Tabs */}
          <div className="flex items-center space-x-1 border-b border-slate-200 dark:border-slate-800">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center space-x-2 px-4 py-3 text-sm font-medium border-b-2 transition',
                  activeTab === tab.id
                    ? 'text-primary-600 border-primary-600'
                    : 'text-slate-500 border-transparent hover:text-slate-700 hover:border-slate-300'
                )}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.name}</span>
              </button>
            ))}
          </div>

          {/* Posts Feed */}
          {activeTab === 'achievements' ? (
            <AchievementsPanel />
          ) : (
            <>
              <div className="flex flex-wrap gap-2 pt-3" role="tablist" aria-label="Kind of post">
                {POST_FILTERS.map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    role="tab"
                    aria-selected={postFilter === filter.value}
                    onClick={() => setPostFilter(filter.value)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium transition',
                      postFilter === filter.value
                        ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                    )}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
              <Feed tab={activeTab} contentType={postFilter} />
            </>
          )}
        </div>

        {/* Right rail */}
        <aside className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Trending topics</h2>
              <Flame className="w-4 h-4 text-orange-500" />
            </div>
            {isLoadingFeedOverview ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              </div>
            ) : trendingTopics.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
                No trending topics yet.
              </div>
            ) : (
              <div className="space-y-3">
                {trendingTopics.map((topic) => (
                  <div
                    key={topic.tag}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800"
                  >
                    <div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">{topic.tag}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{topic.posts}</div>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-slate-400" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Upcoming events</h2>
              <CalendarDays className="w-4 h-4 text-primary-600" />
            </div>
            {isLoadingEvents ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              </div>
            ) : events.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
                No upcoming events are connected.
              </div>
            ) : (
              <div className="space-y-4">
                {events.map((event) => (
                  <div key={event.id} className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary-50 dark:bg-primary-900/30 text-primary-600 flex items-center justify-center">
                      <CalendarDays className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">{event.title}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{formatEventDate(event)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Community leaderboard</h2>
              <Trophy className="w-4 h-4 text-yellow-500" />
            </div>
            {isLoadingLeaderboard ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
                No leaderboard entries yet.
              </div>
            ) : (
              <div className="space-y-3">
                {leaderboard.map((member, index) => (
                  <div key={member.id ?? member.user?.id ?? index} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center text-xs font-semibold">
                        {index + 1}
                      </div>
                      <div className="text-sm font-medium text-slate-900 dark:text-white">{getLeaderboardName(member)}</div>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{getLeaderboardPoints(member)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
