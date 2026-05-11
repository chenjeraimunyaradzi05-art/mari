'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  Bell,
  BookOpen,
  Briefcase,
  Calendar,
  CheckCircle,
  Clock,
  MessageSquare,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useAuth, useFeed, useJobRecommendations, useMyApplications } from '@/lib/hooks';
import {
  APPLICATION_STATUS_COLORS,
  APPLICATION_STATUS_LABELS,
  PERSONA_LABELS,
  formatRelativeTime,
} from '@/lib/utils';

const quickActions = [
  { name: 'Find roles', href: '/dashboard/jobs', icon: Briefcase, detail: 'Search and shortlist' },
  { name: 'Improve resume', href: '/dashboard/ai/resume', icon: Sparkles, detail: 'AI positioning help' },
  { name: 'Book mentors', href: '/dashboard/mentors', icon: Users, detail: 'Find expert support' },
  { name: 'Learn skills', href: '/dashboard/learn', icon: BookOpen, detail: 'Continue a path' },
];

const momentumSteps = [
  { label: 'Profile strength', value: '72%', hint: 'Add 3 skills to improve matches' },
  { label: 'Career focus', value: '4 lanes', hint: 'Jobs, mentors, learning, community' },
  { label: 'Weekly rhythm', value: '2 tasks', hint: 'Resume review and mentor outreach' },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const { data: recommendations, isLoading: loadingJobs } = useJobRecommendations();
  const { data: applications, isLoading: loadingApps } = useMyApplications();
  const { data: feedData, isLoading: loadingFeed } = useFeed({ limit: 5 });
  const isNewWelcome = searchParams?.get('welcome') === 'new' || !user?.lastLoginAt;

  const stats = [
    { name: 'Profile views', value: '234', change: '+12%', icon: Users },
    { name: 'Search appearances', value: '1,432', change: '+8%', icon: Search },
    { name: 'Applications', value: applications?.length || 0, change: '+3', icon: Briefcase },
    { name: 'Saved jobs', value: '18', change: '-2', icon: CheckCircle },
  ];

  return (
    <div className="page-shell space-y-6">
      <section className="bg-aurora relative overflow-hidden rounded-2xl border border-primary-100/60 shadow-lg dark:border-primary-900/30">
        <div aria-hidden="true" className="cyber-grid pointer-events-none absolute inset-0 opacity-50" />
        <div className="relative grid gap-0 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="p-6 sm:p-8">
            <div className="kicker">Command center</div>
            <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h1 className="max-w-3xl text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl dark:text-white">
                  {isNewWelcome
                    ? `Welcome to ATHENA, ${user?.firstName || 'there'}`
                    : `Welcome back, ${user?.firstName || 'there'}`}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base dark:text-slate-300">
                  {isNewWelcome
                    ? 'Set up your momentum across roles, mentors, learning, AI tools, and community.'
                    : "Here is today's view of your career momentum, recommendations, and next actions."}
                </p>
              </div>
              {user?.persona && (
                <span className="inline-flex w-fit items-center rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-sm font-semibold text-primary-800 dark:border-primary-400/20 dark:bg-primary-400/10 dark:text-primary-200">
                  {PERSONA_LABELS[user.persona] || user.persona}
                </span>
              )}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/dashboard/ai" className="btn-primary glow-primary">
                <Sparkles className="h-4 w-4" />
                Open AI coach
              </Link>
              <Link href="/dashboard/jobs" className="btn-outline">
                <Briefcase className="h-4 w-4" />
                Review matches
              </Link>
            </div>
          </div>

          <div className="glass-panel border-t border-white/20 p-6 backdrop-blur dark:border-white/5 lg:border-l lg:border-t-0">
            <div className="flex items-center justify-between">
              <div>
                <div className="kicker">Next best actions</div>
                <h2 className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">This week</h2>
              </div>
              <TrendingUp className="h-5 w-5 text-primary-600 dark:text-primary-300" />
            </div>
            <div className="mt-5 space-y-3">
              {momentumSteps.map((step) => (
                <div key={step.label} className="metric-card-futuristic">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">{step.label}</span>
                    <span className="text-sm font-semibold gradient-text-cyber">{step.value}</span>
                  </div>
                  <div className="progress-athena mt-3">
                    <div className="progress-athena-fill" style={{ width: step.value.includes('%') ? step.value : '68%' }} />
                  </div>
                  <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">{step.hint}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {quickActions.map((action) => (
          <Link key={action.name} href={action.href} className="card-lift panel group p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-50 to-purple-50 text-primary-600 dark:from-primary-900/40 dark:to-purple-900/30 dark:text-primary-300">
                <action.icon className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-primary-600 dark:group-hover:text-primary-300" />
            </div>
            <div className="mt-4 font-semibold text-slate-950 dark:text-white">{action.name}</div>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{action.detail}</p>
          </Link>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.name} className="metric-card-futuristic">
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-500 dark:text-slate-400">{stat.name}</div>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary-50 to-purple-50 dark:from-primary-900/30 dark:to-purple-900/20">
                <stat.icon className="h-4 w-4 text-primary-500 dark:text-primary-400" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-slate-950 dark:text-white">{stat.value}</span>
              <span className={stat.change.startsWith('-') ? 'text-sm font-semibold text-red-500' : 'text-sm font-semibold text-emerald-500'}>
                {stat.change}
              </span>
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="panel p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="kicker">Recommendations</div>
              <h2 className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">Best-fit roles</h2>
            </div>
            <Link href="/dashboard/jobs" className="inline-flex items-center text-sm font-semibold text-primary-700 hover:text-primary-800 dark:text-primary-300">
              View all
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>

          {loadingJobs ? (
            <div className="mt-5 space-y-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-20 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
              ))}
            </div>
          ) : recommendations?.jobs?.length ? (
            <div className="mt-5 divide-y divide-slate-200 dark:divide-slate-800">
              {recommendations.jobs.slice(0, 4).map((job: { id: string; title: string; location?: string; matchScore?: number; organization?: { name?: string } }) => (
                <Link key={job.id} href={`/dashboard/jobs/${job.id}`} className="group flex items-start gap-4 py-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                    <Briefcase className="h-5 w-5 text-slate-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-slate-950 group-hover:text-primary-700 dark:text-white dark:group-hover:text-primary-300">
                      {job.title}
                    </div>
                    <div className="mt-1 truncate text-sm text-slate-500 dark:text-slate-400">
                      {job.organization?.name} - {job.location}
                    </div>
                    {job.matchScore && (
                      <div className="mt-2 inline-flex items-center gap-1 rounded-lg bg-primary-50 px-2 py-1 text-xs font-semibold text-primary-700 dark:bg-primary-400/10 dark:text-primary-200">
                        <Target className="h-3 w-3" />
                        {job.matchScore}% match
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-state mt-5">
              <Briefcase className="mx-auto h-10 w-10 text-slate-400" />
              <p className="mt-3 font-medium text-slate-900 dark:text-white">Complete your profile to unlock better matches.</p>
              <Link href="/dashboard/settings/profile" className="mt-3 inline-flex text-sm font-semibold text-primary-700 dark:text-primary-300">
                Update profile
              </Link>
            </div>
          )}
        </div>

        <div className="panel p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="kicker">Pipeline</div>
              <h2 className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">Your applications</h2>
            </div>
            <Link href="/dashboard/applications" className="inline-flex items-center text-sm font-semibold text-primary-700 hover:text-primary-800 dark:text-primary-300">
              View all
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>

          {loadingApps ? (
            <div className="mt-5 space-y-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-16 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
              ))}
            </div>
          ) : applications?.length ? (
            <div className="mt-5 space-y-3">
              {applications.slice(0, 4).map((application: { id: string; status: string; createdAt: string; job?: { title?: string } }) => (
                <div key={application.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-950 dark:text-white">{application.job?.title}</div>
                      <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Applied {formatRelativeTime(application.createdAt)}
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold ${APPLICATION_STATUS_COLORS[application.status] || 'bg-slate-100 text-slate-800'}`}>
                      {APPLICATION_STATUS_LABELS[application.status] || application.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state mt-5">
              <CheckCircle className="mx-auto h-10 w-10 text-slate-400" />
              <p className="mt-3 font-medium text-slate-900 dark:text-white">No applications yet.</p>
              <Link href="/dashboard/jobs" className="mt-3 inline-flex text-sm font-semibold text-primary-700 dark:text-primary-300">
                Start applying
              </Link>
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="panel p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="kicker">Community</div>
              <h2 className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">Updates worth seeing</h2>
            </div>
            <Link href="/dashboard/community" className="inline-flex items-center text-sm font-semibold text-primary-700 hover:text-primary-800 dark:text-primary-300">
              See all
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>

          {loadingFeed ? (
            <div className="mt-5 space-y-3">
              {[1, 2].map((item) => (
                <div key={item} className="h-20 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
              ))}
            </div>
          ) : feedData?.posts?.length ? (
            <div className="mt-5 divide-y divide-slate-200 dark:divide-slate-800">
              {feedData.posts.slice(0, 3).map((post: { id: string; content?: string; createdAt: string; author?: { firstName?: string; lastName?: string } }) => (
                <Link key={post.id} href={`/dashboard/community/post/${post.id}`} className="flex items-start gap-4 py-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100 font-semibold text-primary-700 dark:bg-primary-900 dark:text-primary-200">
                    {post.author?.firstName?.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-950 dark:text-white">
                        {post.author?.firstName} {post.author?.lastName}
                      </span>
                      <span className="text-sm text-slate-500">{formatRelativeTime(post.createdAt)}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{post.content}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-state mt-5">
              <MessageSquare className="mx-auto h-10 w-10 text-slate-400" />
              <p className="mt-3 font-medium text-slate-900 dark:text-white">Follow people and groups to build your feed.</p>
            </div>
          )}
        </div>

        <div className="panel p-5">
          <div className="kicker">Upcoming</div>
          <h2 className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">Reminders</h2>
          <div className="mt-5 space-y-3">
            <Link href="/dashboard/settings/profile" className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
              <Calendar className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <div className="font-semibold">Complete your profile</div>
                <div className="mt-1 text-sm leading-6 opacity-80">Add skills and experience to improve matches.</div>
              </div>
            </Link>
            <Link href="/dashboard/ai/interview-coach" className="flex gap-3 rounded-lg border border-sky-200 bg-sky-50 p-4 text-sky-950 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-100">
              <Clock className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <div className="font-semibold">Practice interviews</div>
                <div className="mt-1 text-sm leading-6 opacity-80">Run a short prep session before applying.</div>
              </div>
            </Link>
            <Link href="/dashboard/notifications" className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-slate-800 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-200">
              <Bell className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <div className="font-semibold">Review notifications</div>
                <div className="mt-1 text-sm leading-6 opacity-80">Catch replies, updates, and new recommendations.</div>
              </div>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
