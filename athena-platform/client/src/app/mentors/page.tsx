'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  GraduationCap,
  Loader2,
  MessageSquare,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { mentorApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

const mentorModes = [
  {
    icon: Search,
    title: 'Find the right signal',
    description: 'Search by career lane, industry, lived experience, session format, and availability.',
  },
  {
    icon: CalendarClock,
    title: 'Book with context',
    description: 'Bring your role targets, resume, applications, and goals into the session.',
  },
  {
    icon: MessageSquare,
    title: 'Keep momentum',
    description: 'Turn mentor notes into tasks, follow-ups, interview prep, and new outreach.',
  },
];

const trustItems = [
  'Verified mentor profiles',
  'Structured session goals',
  'Safety-aware messaging',
  'Clear next steps after every conversation',
];

type Mentor = {
  id: string;
  userId: string;
  specializations?: unknown;
  yearsExperience?: number | null;
  hourlyRate?: string | number | null;
  isAvailable?: boolean;
  sessionCount?: number;
  rating?: string | number | null;
  reviewCount?: number;
  user?: {
    displayName?: string | null;
    headline?: string | null;
    bio?: string | null;
    avatar?: string | null;
  };
};

function specializationList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }

  return [];
}

function mentorName(mentor: Mentor) {
  return mentor.user?.displayName || 'ATHENA mentor';
}

function mentorInitials(mentor: Mentor) {
  return mentorName(mentor)
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'AM';
}

function formatRating(mentor: Mentor) {
  const reviews = mentor.reviewCount ?? 0;
  if (reviews === 0) return 'New';

  const rating = Number(mentor.rating ?? 0);
  return Number.isFinite(rating) ? rating.toFixed(1) : 'New';
}

export default function MentorsMarketingPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadMentors = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await mentorApi.getAll({
          search: searchQuery.trim() || undefined,
          available: true,
          limit: 6,
        });
        const payload = response.data;

        if (!cancelled) {
          setMentors(payload?.mentors || payload?.data || []);
        }
      } catch (err: any) {
        if (!cancelled) {
          setMentors([]);
          setError(err?.response?.data?.error || 'Unable to load mentors right now.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadMentors();

    return () => {
      cancelled = true;
    };
  }, [searchQuery]);

  const mentorCountLabel = useMemo(() => {
    if (loading) return 'Loading mentor profiles';
    if (mentors.length === 0) return 'No available mentors published';
    return `${mentors.length} available ${mentors.length === 1 ? 'mentor' : 'mentors'}`;
  }, [loading, mentors.length]);

  return (
    <main className="relative min-h-screen bg-aurora text-slate-950 dark:text-white">
      <div aria-hidden="true" className="cyber-grid pointer-events-none absolute inset-0 opacity-15" />
      <section className="relative border-b border-primary-100/60 dark:border-white/10">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:px-8">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary-200/70 bg-primary-50/80 px-3 py-1 text-xs font-semibold text-primary-700 backdrop-blur dark:border-primary-900/40 dark:bg-primary-900/20 dark:text-primary-300">
              <span className="status-dot status-dot-online h-1.5 w-1.5" />
              <Sparkles className="h-3.5 w-3.5" />
              Mentor intelligence
            </div>
            <h1 className="mt-6 max-w-4xl text-4xl font-semibold leading-tight text-slate-950 dark:text-white sm:text-6xl">
              Find mentors who make the <span className="gradient-text-cyber">next move</span> feel possible.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 dark:text-slate-300">
              ATHENA connects mentor discovery with your career goals, applications, learning path, and AI prep so each
              conversation turns into visible progress.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/dashboard/mentors" className="inline-flex items-center gap-2 rounded-xl bg-[linear-gradient(135deg,#f43f5e,#a855f7)] px-5 py-3 text-sm font-semibold text-white shadow-blossom transition hover:-translate-y-0.5">
                Find a mentor
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/dashboard/mentors/become-mentor" className="inline-flex items-center gap-2 rounded-xl border-2 border-primary-500 px-5 py-2.5 text-sm font-semibold text-primary-600 transition hover:bg-primary-50 dark:text-primary-300 dark:hover:bg-primary-950/40">
                Become a mentor
              </Link>
            </div>
          </div>

          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="kicker">Session readiness</div>
                <h2 className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">Before you book</h2>
              </div>
              <GraduationCap className="h-6 w-6 text-primary-600" />
            </div>
            <div className="mt-5 space-y-3">
              {trustItems.map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-xl border border-primary-100/60 bg-white/60 p-3 text-sm text-slate-700 backdrop-blur dark:border-white/10 dark:bg-slate-800/40 dark:text-slate-300">
                  <ShieldCheck className="h-4 w-4 flex-shrink-0 text-primary-600" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          {mentorModes.map((mode) => (
            <div key={mode.title} className="metric-card-futuristic card-lift rounded-xl p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-slate-950 dark:bg-slate-800 dark:text-white">
                <mode.icon className="h-5 w-5" />
              </div>
              <h2 className="mt-5 text-xl font-semibold text-slate-950 dark:text-white">{mode.title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">{mode.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="kicker">Available mentor paths</div>
            <h2 className="mt-2 text-3xl font-semibold text-slate-950 dark:text-white">
              Browse live mentor profiles without guessing where to start.
            </h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{mentorCountLabel}</p>
          </div>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search mentors..."
              className="w-full rounded-xl border border-primary-100 bg-white/80 py-3 pl-10 pr-4 text-sm text-slate-950 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-900/70 dark:text-white"
            />
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-8 flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading mentors...
          </div>
        ) : mentors.length === 0 ? (
          <div className="mt-8 rounded-xl border border-primary-100/60 bg-white/70 p-8 text-center dark:border-white/10 dark:bg-slate-800/40">
            <Users className="mx-auto mb-4 h-14 w-14 text-slate-300 dark:text-slate-600" />
            <h3 className="text-lg font-semibold text-slate-950 dark:text-white">No mentor profiles available</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {searchQuery ? 'Try another search term.' : 'Published mentor profiles will appear here once they are available.'}
            </p>
          </div>
        ) : (
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {mentors.map((mentor) => {
              const specializations = specializationList(mentor.specializations);
              const hourlyRate = Number(mentor.hourlyRate ?? 0);

              return (
                <div key={mentor.id} className="glass-card card-lift group rounded-xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-950 font-semibold text-white dark:bg-white dark:text-slate-950">
                      {mentorInitials(mentor)}
                    </div>
                    <div className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-400/10 dark:text-amber-200">
                      <Star className="h-3.5 w-3.5" />
                      {formatRating(mentor)}
                    </div>
                  </div>
                  <div className="mt-5 flex items-center gap-2">
                    <h3 className="font-semibold text-slate-950 dark:text-white">{mentorName(mentor)}</h3>
                    {mentor.isAvailable && <BadgeCheck className="h-4 w-4 text-primary-600" />}
                  </div>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {mentor.user?.headline || `${mentor.yearsExperience ?? 0} years of experience`}
                  </p>
                  <p className="mt-4 line-clamp-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                    {mentor.user?.bio || 'This mentor has not published a full bio yet.'}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(specializations.length ? specializations : ['General mentoring']).slice(0, 3).map((item) => (
                      <span key={item} className="rounded-lg bg-primary-50 px-2 py-1 text-xs font-semibold text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                        {item}
                      </span>
                    ))}
                  </div>
                  <div className="mt-5 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
                    <span>{mentor.sessionCount ?? 0} sessions</span>
                    <span>{hourlyRate ? `${formatCurrency(hourlyRate)}/hr` : 'Rate not listed'}</span>
                  </div>
                  <Link href="/dashboard/mentors" className="mt-5 inline-flex items-center text-sm font-semibold text-primary-700 dark:text-primary-300">
                    Open in dashboard
                    <ArrowRight className="ml-1 h-4 w-4 transition group-hover:translate-x-0.5" />
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="grid gap-4 overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#1a0a2e,#0d1b3e)] p-6 text-white md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-slate-950">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Ready to turn experience into momentum?</h2>
              <p className="mt-1 text-sm text-slate-300">Start with discovery, then bring your goals into the dashboard.</p>
            </div>
          </div>
          <Link href="/dashboard/mentors" className="inline-flex items-center justify-center rounded-lg bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100">
            Explore mentors
          </Link>
        </div>
      </section>
    </main>
  );
}
