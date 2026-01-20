'use client';

import { useState } from 'react';
import Link from 'next/link';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
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

export default function CommunityPage() {
  const [activeTab, setActiveTab] = useState<TabId>('for-you');

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-primary-600">
            <Sparkles className="w-5 h-5" />
            <span className="text-sm font-semibold uppercase tracking-wider">Community</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mt-2">
            Discover insights, celebrate wins, and grow your network
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
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
        {[
          { label: 'Active members today', value: '12.4k', icon: Users, accent: 'bg-blue-50 text-blue-600' },
          { label: 'New discussions', value: '328', icon: MessageSquare, accent: 'bg-purple-50 text-purple-600' },
          { label: 'Hiring signals', value: '74', icon: Briefcase, accent: 'bg-emerald-50 text-emerald-600' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex items-center gap-4"
          >
            <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', stat.accent)}>
              <stat.icon className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-semibold text-gray-900 dark:text-white">{stat.value}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</div>
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
          <div className="flex items-center space-x-1 border-b border-gray-200 dark:border-gray-800">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center space-x-2 px-4 py-3 text-sm font-medium border-b-2 transition',
                  activeTab === tab.id
                    ? 'text-primary-600 border-primary-600'
                    : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
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
            <Feed tab={activeTab} />
          )}
        </div>

        {/* Right rail */}
        <aside className="space-y-6">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Trending topics</h2>
              <Flame className="w-4 h-4 text-orange-500" />
            </div>
            <div className="space-y-3">
              {[
                { tag: '#AIcareer', posts: '2.4k posts' },
                { tag: '#NegotiationWins', posts: '1.1k posts' },
                { tag: '#RemoteHiring', posts: '980 posts' },
                { tag: '#PortfolioReview', posts: '740 posts' },
              ].map((topic) => (
                <div
                  key={topic.tag}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800"
                >
                  <div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">{topic.tag}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{topic.posts}</div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-gray-400" />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Upcoming events</h2>
              <CalendarDays className="w-4 h-4 text-primary-600" />
            </div>
            <div className="space-y-4">
              {[
                { title: 'Hiring Manager AMA', date: 'Today · 4:00 PM' },
                { title: 'Portfolio teardown live', date: 'Tomorrow · 6:30 PM' },
                { title: 'Women in Product meetup', date: 'Fri · 12:00 PM' },
              ].map((event) => (
                <div key={event.title} className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary-50 dark:bg-primary-900/30 text-primary-600 flex items-center justify-center">
                    <CalendarDays className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">{event.title}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{event.date}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Community leaderboard</h2>
              <Trophy className="w-4 h-4 text-yellow-500" />
            </div>
            <div className="space-y-3">
              {[
                { name: 'Avery Bell', points: '4,320 pts' },
                { name: 'Priya Das', points: '3,980 pts' },
                { name: 'Jordan Kim', points: '3,615 pts' },
              ].map((member, index) => (
                <div key={member.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 flex items-center justify-center text-xs font-semibold">
                      {index + 1}
                    </div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{member.name}</div>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{member.points}</div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
