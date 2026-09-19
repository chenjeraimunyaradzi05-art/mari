'use client';

import Link from 'next/link';
import {
  Briefcase,
  HeartPulse,
  Users,
  BookOpen,
  ArrowRight,
  Sparkles,
  Target,
  CheckCircle,
  Bookmark,
  ClipboardCheck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  useAuth,
  useJobRecommendations,
  useMyApplications,
  useFeed,
  useSavedJobs,
  useMyCourses,
  useOnboardingSteps,
} from '@/lib/hooks';
import { formatRelativeTime, PERSONA_LABELS, APPLICATION_STATUS_LABELS, APPLICATION_STATUS_COLORS } from '@/lib/utils';

type Tile = {
  name: string;
  value: number | null;
  isLoading: boolean;
  href: string;
  icon: LucideIcon;
};

// A count this page can prove: the length of a list the member owns.
// Anything else is shown as a dash, never a guess.
function countOf(value: unknown): number | null {
  return Array.isArray(value) ? value.length : null;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: recommendations, isLoading: loadingJobs } = useJobRecommendations();
  const { data: applications, isLoading: loadingApps } = useMyApplications();
  const { data: savedJobs, isLoading: loadingSaved } = useSavedJobs();
  const { data: myCourses, isLoading: loadingCourses } = useMyCourses();
  const { data: feedData, isLoading: loadingFeed } = useFeed({ limit: 5 });
  const { data: setupSteps } = useOnboardingSteps();

  // GET /posts/feed returns the posts as `data` itself. An older shape put
  // them under `posts`, which is why this card only ever showed its empty
  // state; both are read so a change on either side degrades gracefully.
  const feedPosts: any[] = Array.isArray(feedData) ? feedData : feedData?.posts ?? [];

  // Only the steps she has not done. The card goes away entirely once the
  // list is empty, rather than nagging with static copy.
  const setupTodo = (setupSteps ?? []).filter((step) => !step.completed);

  const quickActions = [
    { name: 'Find Jobs', href: '/dashboard/jobs', icon: Briefcase, color: 'bg-blue-500' },
    { name: 'AI Resume', href: '/dashboard/ai/resume', icon: Sparkles, color: 'bg-purple-500' },
    { name: 'Find Mentors', href: '/dashboard/mentors', icon: Users, color: 'bg-green-500' },
    { name: 'Learn Skills', href: '/dashboard/learn', icon: BookOpen, color: 'bg-orange-500' },
    { name: 'Check In', href: '/dashboard/wellness', icon: HeartPulse, color: 'bg-rose-500' },
  ];

  // Three tiles, each a list she owns. There is no history behind any of
  // them to compute a change against, so no trend is shown. (Profile views
  // and search appearances used to sit here as fixed numbers; nothing on the
  // server counts either, so they are gone until something does.)
  const tiles: Tile[] = [
    { name: 'Applications', value: countOf(applications), isLoading: loadingApps, href: '/dashboard/applications', icon: Briefcase },
    { name: 'Saved jobs', value: countOf(savedJobs), isLoading: loadingSaved, href: '/dashboard/jobs', icon: Bookmark },
    { name: 'Courses', value: countOf(myCourses), isLoading: loadingCourses, href: '/dashboard/learn/my-courses', icon: BookOpen },
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
              className="inline-flex items-center px-4 py-2 bg-white text-primary-600 rounded-lg font-medium hover:bg-slate-100 transition"
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
              <span className="font-medium text-slate-900 dark:text-white group-hover:text-primary-600 transition">
                {action.name}
              </span>
            </div>
          </Link>
        ))}
      </div>

      {/* Finish setting up: the incomplete concierge onboarding steps, gone
          once they are all done. */}
      {setupTodo.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-primary-600" aria-hidden="true" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Finish setting up
            </h2>
          </div>
          <p className="mt-1 mb-4 text-sm text-slate-500 dark:text-slate-400">
            A couple of small things that make ATHENA work better for you.
          </p>
          <ul className="space-y-3">
            {setupTodo.map((step) => (
              <li key={step.id}>
                <Link
                  href={step.action}
                  className="flex items-center justify-between gap-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-primary-50 dark:hover:bg-slate-700 transition group"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900 dark:text-white group-hover:text-primary-700 dark:group-hover:text-primary-300">
                      {step.title}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      {step.description}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 flex-shrink-0 text-slate-400 group-hover:text-primary-600" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Your numbers */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {tiles.map((tile) => (
          <Link
            key={tile.name}
            href={tile.href}
            className="card flex items-center gap-4 hover:shadow-md transition group"
          >
            <div className="w-10 h-10 rounded-lg bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center text-primary-600 dark:text-primary-300">
              <tile.icon className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {tile.isLoading ? '…' : tile.value ?? '—'}
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400 group-hover:text-primary-600 transition">
                {tile.name}
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Job Recommendations */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
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
                  <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
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
                  className="flex items-start space-x-4 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition group"
                >
                  <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center">
                    <Briefcase className="w-6 h-6 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-900 dark:text-white group-hover:text-primary-600 transition truncate">
                      {job.title}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400 truncate">
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
            <div className="text-center py-8 text-slate-500">
              <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nothing matched yet. Adding your skills helps.</p>
              <Link
                href="/dashboard/settings/profile"
                className="text-primary-600 hover:underline text-sm"
              >
                Add skills to your profile
              </Link>
            </div>
          )}
        </div>

        {/* Application Tracker */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
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
                  <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : applications?.length ? (
            <div className="space-y-3">
              {applications.slice(0, 4).map((app: any) => (
                <div
                  key={app.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-900 dark:text-white truncate">
                      {app.job?.title}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      Applied {formatRelativeTime(app.createdAt)}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      APPLICATION_STATUS_COLORS[app.status] || 'bg-slate-100 text-slate-800'
                    }`}
                  >
                    {APPLICATION_STATUS_LABELS[app.status] || app.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
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
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
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
                <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/4" />
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-full" />
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : feedPosts.length ? (
          <div className="space-y-4">
            {feedPosts.slice(0, 3).map((post: any) => {
              // The feed selects displayName and avatar for the author; the
              // following tab adds first and last name.
              const name =
                post.author?.displayName ||
                [post.author?.firstName, post.author?.lastName].filter(Boolean).join(' ') ||
                'ATHENA Member';
              return (
                <Link
                  key={post.id}
                  href={`/posts/${post.id}`}
                  className="flex items-start space-x-4 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                  <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-primary-600 font-semibold">
                    {name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-slate-900 dark:text-white">
                        {name}
                      </span>
                      <span className="text-sm text-slate-500">
                        {formatRelativeTime(post.createdAt)}
                      </span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 text-sm line-clamp-2">
                      {post.content}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Follow people to see their posts here</p>
          </div>
        )}
      </div>
    </div>
  );
}
