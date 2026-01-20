'use client';

import Link from 'next/link';
import {
  Briefcase,
  TrendingUp,
  Users,
  BookOpen,
  ArrowRight,
  Sparkles,
  Target,
  Zap,
  Calendar,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { useAuth, useJobRecommendations, useMyApplications, useFeed } from '@/lib/hooks';
import { formatRelativeTime, PERSONA_LABELS, APPLICATION_STATUS_LABELS, APPLICATION_STATUS_COLORS } from '@/lib/utils';

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: recommendations, isLoading: loadingJobs } = useJobRecommendations();
  const { data: applications, isLoading: loadingApps } = useMyApplications();
  const { data: feedData, isLoading: loadingFeed } = useFeed({ limit: 5 });

  const quickActions = [
    { name: 'Find Jobs', href: '/dashboard/jobs', icon: Briefcase, color: 'bg-blue-500' },
    { name: 'AI Resume', href: '/dashboard/ai/resume', icon: Sparkles, color: 'bg-purple-500' },
    { name: 'Find Mentors', href: '/dashboard/mentors', icon: Users, color: 'bg-green-500' },
    { name: 'Learn Skills', href: '/dashboard/learn', icon: BookOpen, color: 'bg-orange-500' },
  ];

  const stats = [
    { name: 'Profile Views', value: '234', change: '+12%', trend: 'up' },
    { name: 'Search Appearances', value: '1,432', change: '+8%', trend: 'up' },
    { name: 'Applications', value: applications?.length || 0, change: '+3', trend: 'up' },
    { name: 'Saved Jobs', value: '18', change: '-2', trend: 'down' },
  ];

  return (
    <div className="p-6 space-y-8">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-primary-500 to-secondary-500 rounded-2xl p-6 text-white">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              Welcome back, {user?.firstName}! 👋
            </h1>
            <p className="mt-1 text-white/90">
              Here's what's happening with your career today.
            </p>
            {user?.persona && (
              <span className="inline-block mt-2 px-3 py-1 bg-white/20 rounded-full text-sm">
                {PERSONA_LABELS[user.persona] || user.persona}
              </span>
            )}
          </div>
          <div className="mt-4 md:mt-0">
            <Link
              href="/dashboard/ai"
              className="inline-flex items-center px-4 py-2 bg-white text-primary-600 rounded-lg font-medium hover:bg-gray-100 transition"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Try AI Career Coach
            </Link>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {quickActions.map((action) => (
          <Link
            key={action.name}
            href={action.href}
            className="card flex items-center space-x-3 hover:shadow-md transition group"
          >
            <div className={`w-10 h-10 ${action.color} rounded-lg flex items-center justify-center`}>
              <action.icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-medium text-gray-900 dark:text-white group-hover:text-primary-600 transition">
                {action.name}
              </span>
            </div>
          </Link>
        ))}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.name} className="card">
            <div className="text-sm text-gray-500 dark:text-gray-400">{stat.name}</div>
            <div className="mt-1 flex items-baseline">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {stat.value}
              </span>
              <span
                className={`ml-2 text-sm ${
                  stat.trend === 'up' ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {stat.change}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Job Recommendations */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Recommended for You
            </h2>
            <Link
              href="/dashboard/jobs"
              className="text-sm text-primary-600 hover:text-primary-700 flex items-center"
            >
              View all <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>

          {loadingJobs ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse flex space-x-4">
                  <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : recommendations?.jobs?.length ? (
            <div className="space-y-4">
              {recommendations.jobs.slice(0, 4).map((job: any) => (
                <Link
                  key={job.id}
                  href={`/dashboard/jobs/${job.id}`}
                  className="flex items-start space-x-4 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition group"
                >
                  <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                    <Briefcase className="w-6 h-6 text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 dark:text-white group-hover:text-primary-600 transition truncate">
                      {job.title}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {job.organization?.name} • {job.location}
                    </div>
                    {job.matchScore && (
                      <div className="mt-1 flex items-center text-sm">
                        <Target className="w-3 h-3 mr-1 text-green-500" />
                        <span className="text-green-600">{job.matchScore}% match</span>
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Complete your profile to get job recommendations</p>
            </div>
          )}
        </div>

        {/* Application Tracker */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Your Applications
            </h2>
            <Link
              href="/dashboard/applications"
              className="text-sm text-primary-600 hover:text-primary-700 flex items-center"
            >
              View all <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>

          {loadingApps ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse flex space-x-4">
                  <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : applications?.length ? (
            <div className="space-y-3">
              {applications.slice(0, 4).map((app: any) => (
                <div
                  key={app.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 dark:text-white truncate">
                      {app.job?.title}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Applied {formatRelativeTime(app.createdAt)}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      APPLICATION_STATUS_COLORS[app.status] || 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {APPLICATION_STATUS_LABELS[app.status] || app.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No applications yet</p>
              <Link
                href="/dashboard/jobs"
                className="text-primary-600 hover:underline text-sm"
              >
                Start applying to jobs
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Community Feed Preview */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Community Updates
          </h2>
          <Link
            href="/dashboard/community"
            className="text-sm text-primary-600 hover:text-primary-700 flex items-center"
          >
            See all posts <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
        </div>

        {loadingFeed ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="animate-pulse flex space-x-4">
                <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : feedData?.posts?.length ? (
          <div className="space-y-4">
            {feedData.posts.slice(0, 3).map((post: any) => (
              <Link
                key={post.id}
                href={`/dashboard/community/post/${post.id}`}
                className="flex items-start space-x-4 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition"
              >
                <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-primary-600 font-semibold">
                  {post.author?.firstName?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {post.author?.firstName} {post.author?.lastName}
                    </span>
                    <span className="text-sm text-gray-500">
                      {formatRelativeTime(post.createdAt)}
                    </span>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-2">
                    {post.content}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Follow people to see their posts here</p>
          </div>
        )}
      </div>

      {/* Upcoming Events / Reminders */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Upcoming
        </h2>
        <div className="space-y-3">
          <div className="flex items-center space-x-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <Calendar className="w-5 h-5 text-yellow-600" />
            <div>
              <div className="font-medium text-gray-900 dark:text-white">
                Complete your profile
              </div>
              <div className="text-sm text-gray-500">
                Add skills and experience to get better job matches
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <Clock className="w-5 h-5 text-blue-600" />
            <div>
              <div className="font-medium text-gray-900 dark:text-white">
                Weekly career tips
              </div>
              <div className="text-sm text-gray-500">
                New article: "5 Ways to Stand Out in Interviews"
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
