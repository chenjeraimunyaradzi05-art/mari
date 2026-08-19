'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  Calendar,
  CheckCircle2,
  Compass,
  FileText,
  GraduationCap,
  HeartHandshake,
  LayoutDashboard,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  useAuth,
  useCourses,
  useEvents,
  useFeed,
  useGroups,
  useJobRecommendations,
  useMentors,
  useMyApplications,
  useMyCourses,
  useSavedJobs,
} from '@/lib/hooks';
import { PERSONA_LABELS } from '@/lib/utils';

type PersonaAction = {
  title: string;
  detail: string;
  href: string;
  icon: LucideIcon;
};

type LiveMetric = {
  label: string;
  value: number | string;
  helper: string;
  icon: LucideIcon;
  isLoading?: boolean;
};

const personaActions: Record<string, PersonaAction[]> = {
  EARLY_CAREER: [
    { title: 'Find roles', detail: 'Review matched jobs and apprenticeships.', href: '/dashboard/jobs', icon: Briefcase },
    { title: 'Build skills', detail: 'Browse courses and track enrollments.', href: '/dashboard/learn', icon: BookOpen },
    { title: 'Practice interviews', detail: 'Use the AI coach for live feedback.', href: '/dashboard/ai/interview-coach', icon: Sparkles },
  ],
  MID_CAREER: [
    { title: 'Review matches', detail: 'See roles aligned to your profile.', href: '/dashboard/jobs', icon: Search },
    { title: 'Plan your path', detail: 'Map next steps with Career Compass.', href: '/dashboard/ai/career-path', icon: Compass },
    { title: 'Find mentors', detail: 'Connect with leaders in your field.', href: '/dashboard/mentors', icon: Users },
  ],
  ENTREPRENEUR: [
    { title: 'Formation suite', detail: 'Manage company setup and launch tasks.', href: '/dashboard/formation', icon: LayoutDashboard },
    { title: 'Finance workspace', detail: 'Track accounting, tax, and cashflow.', href: '/dashboard/finance', icon: TrendingUp },
    { title: 'Validate ideas', detail: 'Stress-test a concept before build.', href: '/dashboard/ai/idea-validator', icon: Sparkles },
  ],
  CREATOR: [
    { title: 'Creator studio', detail: 'Review audience and creator analytics.', href: '/dashboard/creator', icon: Sparkles },
    { title: 'Generate content', detail: 'Draft posts, emails, and campaigns.', href: '/dashboard/ai/content-generator', icon: FileText },
    { title: 'Community feed', detail: 'Publish and respond to community posts.', href: '/dashboard/community', icon: Users },
  ],
  MENTOR: [
    { title: 'Mentor sessions', detail: 'Manage bookings and session follow-up.', href: '/dashboard/mentor', icon: HeartHandshake },
    { title: 'Mentor marketplace', detail: 'Preview the public mentor directory.', href: '/dashboard/mentors', icon: Users },
    { title: 'Events', detail: 'Find workshops and community sessions.', href: '/dashboard/events', icon: Calendar },
  ],
  EDUCATION_PROVIDER: [
    { title: 'Course catalog', detail: 'Review learner-facing course listings.', href: '/dashboard/learn', icon: GraduationCap },
    { title: 'Provider page', detail: 'Check education provider visibility.', href: '/dashboard/learn/providers', icon: BookOpen },
    { title: 'Applications', detail: 'Track education applications.', href: '/dashboard/learn/applications', icon: FileText },
  ],
  EMPLOYER: [
    { title: 'Employer workspace', detail: 'Manage organizations, jobs, and hiring.', href: '/employer', icon: Briefcase },
    { title: 'Post a role', detail: 'Create salary-transparent opportunities.', href: '/employer/organizations', icon: FileText },
    { title: 'Talent search', detail: 'Search people, mentors, and skills.', href: '/dashboard/search', icon: Search },
  ],
  REAL_ESTATE: [
    { title: 'Housing engine', detail: 'Open housing and property workflows.', href: '/dashboard/housing', icon: ShieldCheck },
    { title: 'Finance health', detail: 'Review readiness and affordability.', href: '/dashboard/finance/health', icon: TrendingUp },
    { title: 'Safety settings', detail: 'Check privacy and account controls.', href: '/dashboard/settings/security', icon: ShieldCheck },
  ],
  GOVERNMENT_NGO: [
    { title: 'Impact reports', detail: 'Review program and community reporting.', href: '/dashboard/impact/reports', icon: FileText },
    { title: 'Community groups', detail: 'Browse active support communities.', href: '/dashboard/groups', icon: Users },
    { title: 'Trust center', detail: 'Review safety, privacy, and access areas.', href: '/dashboard/impact', icon: ShieldCheck },
  ],
};

function countItems(value: unknown): number {
  if (!value) return 0;
  if (Array.isArray(value)) return value.length;

  if (typeof value === 'object') {
    const record = value as Record<string, any>;
    const collectionKeys = ['data', 'jobs', 'posts', 'courses', 'mentors', 'events', 'groups'];
    for (const key of collectionKeys) {
      if (Array.isArray(record[key])) return record[key].length;
    }

    if (typeof record.total === 'number') return record.total;
    if (typeof record.totalCourses === 'number') return record.totalCourses;
    if (typeof record.pagination?.total === 'number') return record.pagination.total;
  }

  return 0;
}

export default function PersonaDashboard() {
  const params = useParams();
  const rawPersona = typeof params.persona === 'string' ? params.persona : '';
  const persona = rawPersona.toUpperCase();
  const validPersona = Object.keys(PERSONA_LABELS).includes(persona);

  const { user } = useAuth();
  const { data: recommendations, isLoading: loadingJobs } = useJobRecommendations();
  const { data: applications, isLoading: loadingApplications } = useMyApplications();
  const { data: savedJobs, isLoading: loadingSavedJobs } = useSavedJobs();
  const { data: myCourses, isLoading: loadingMyCourses } = useMyCourses();
  const { data: coursesData, isLoading: loadingCourses } = useCourses({ limit: 6 });
  const { data: feedData, isLoading: loadingFeed } = useFeed({ limit: 5 });
  const { data: mentorData, isLoading: loadingMentors } = useMentors({ limit: 6 });
  const { data: groups, isLoading: loadingGroups } = useGroups();
  const { data: events, isLoading: loadingEvents } = useEvents();

  if (!validPersona) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
          <h1 className="text-2xl font-bold">Invalid Persona</h1>
          <p className="mt-2 text-sm">The persona "{rawPersona}" does not exist.</p>
          <Link href="/dashboard/persona" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold">
            Choose a dashboard
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  const label = PERSONA_LABELS[persona] || persona;
  const userPersonaLabel = user?.persona ? PERSONA_LABELS[user.persona] || user.persona : null;
  const isCurrentPersona = user?.persona === persona;
  const actions = personaActions[persona] || personaActions.EARLY_CAREER;

  const profileFields = [
    user?.firstName,
    user?.lastName,
    user?.headline,
    user?.city,
    user?.country,
    user?.profile?.aboutMe,
  ];
  const profileProgress = Math.round((profileFields.filter(Boolean).length / profileFields.length) * 100);

  const liveMetrics: LiveMetric[] = [
    {
      label: 'Profile readiness',
      value: `${profileProgress}%`,
      helper: profileProgress >= 80 ? 'Core profile fields are mostly complete' : 'Add headline, location, and about details',
      icon: CheckCircle2,
    },
    {
      label: 'Job matches',
      value: countItems(recommendations),
      helper: 'Live role recommendations',
      icon: Search,
      isLoading: loadingJobs,
    },
    {
      label: 'Applications',
      value: countItems(applications),
      helper: 'Submitted role pipeline',
      icon: Briefcase,
      isLoading: loadingApplications,
    },
    {
      label: 'Saved jobs',
      value: countItems(savedJobs),
      helper: 'Shortlisted roles',
      icon: CheckCircle2,
      isLoading: loadingSavedJobs,
    },
    {
      label: 'Enrolled courses',
      value: countItems(myCourses),
      helper: 'Learning in progress',
      icon: BookOpen,
      isLoading: loadingMyCourses,
    },
    {
      label: 'Community updates',
      value: countItems(feedData),
      helper: 'Recent feed items',
      icon: Users,
      isLoading: loadingFeed,
    },
  ];

  const ecosystemMetrics: LiveMetric[] = [
    {
      label: 'Courses available',
      value: countItems(coursesData),
      helper: 'Current catalog results',
      icon: GraduationCap,
      isLoading: loadingCourses,
    },
    {
      label: 'Mentors available',
      value: countItems(mentorData),
      helper: 'Marketplace profiles',
      icon: HeartHandshake,
      isLoading: loadingMentors,
    },
    {
      label: 'Groups visible',
      value: countItems(groups),
      helper: 'Community spaces',
      icon: Users,
      isLoading: loadingGroups,
    },
    {
      label: 'Events listed',
      value: countItems(events),
      helper: 'Upcoming sessions',
      icon: Calendar,
      isLoading: loadingEvents,
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <section className="rounded-2xl border border-primary-100/70 bg-white p-6 shadow-sm dark:border-primary-900/30 dark:bg-gray-800">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-300">
              Persona dashboard
            </div>
            <h1 className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{label}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">
              Live account signals and active workspace links for this ATHENA persona.
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm dark:border-gray-700 dark:bg-gray-900/40">
            <div className="font-semibold text-gray-900 dark:text-white">
              {isCurrentPersona ? 'Active account persona' : 'Viewing alternate persona'}
            </div>
            <div className="mt-1 text-gray-500 dark:text-gray-400">
              {userPersonaLabel ? `Your account: ${userPersonaLabel}` : 'Account persona not set'}
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {liveMetrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.label} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="flex items-center justify-between gap-3">
                <div className="rounded-lg bg-primary-50 p-2 text-primary-600 dark:bg-primary-900/20 dark:text-primary-300">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-2xl font-bold text-gray-900 dark:text-white">
                  {metric.isLoading ? '...' : metric.value}
                </span>
              </div>
              <h2 className="mt-4 text-sm font-semibold text-gray-900 dark:text-white">{metric.label}</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{metric.helper}</p>
            </div>
          );
        })}
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Workspace Links</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Open the live areas most relevant to {label}.</p>
            </div>
            <Link href="/dashboard/persona" className="hidden items-center gap-2 text-sm font-semibold text-primary-700 hover:text-primary-800 dark:text-primary-300 sm:inline-flex">
              All personas
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="group rounded-xl border border-gray-200 p-4 transition hover:border-primary-300 hover:bg-primary-50/60 dark:border-gray-700 dark:hover:border-primary-700 dark:hover:bg-primary-950/20"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="rounded-lg bg-gray-100 p-2 text-gray-700 transition group-hover:bg-white group-hover:text-primary-700 dark:bg-gray-900 dark:text-gray-300 dark:group-hover:bg-gray-800 dark:group-hover:text-primary-300">
                      <Icon className="h-5 w-5" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-400 transition group-hover:text-primary-600" />
                  </div>
                  <h3 className="mt-4 font-semibold text-gray-900 dark:text-white">{action.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">{action.detail}</p>
                </Link>
              );
            })}
          </div>
        </div>

        <aside className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Live Ecosystem</h2>
          <div className="mt-5 space-y-4">
            {ecosystemMetrics.map((metric) => {
              const Icon = metric.icon;
              return (
                <div key={metric.label} className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-gray-100 p-2 text-gray-600 dark:bg-gray-900 dark:text-gray-300">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">{metric.label}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{metric.helper}</div>
                    </div>
                  </div>
                  <div className="text-sm font-bold text-gray-900 dark:text-white">
                    {metric.isLoading ? '...' : metric.value}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>
      </section>
    </div>
  );
}
