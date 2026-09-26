'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Search,
  Award,
  Clock,
  Users,
  ChevronDown,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  Pencil,
} from 'lucide-react';
import { useMentors } from '@/lib/hooks';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { formatCurrency, cn } from '@/lib/utils';
import { CardSkeleton } from '@/components/ui/loading';

const specializations = [
  'All Specializations',
  'Career Coaching',
  'Leadership',
  'Tech & Engineering',
  'Product Management',
  'Entrepreneurship',
  'Marketing',
  'Finance',
  'Work-Life Balance',
  'Personal Branding',
];

// "Highest Rated" was the default here, and nothing on the platform writes a
// rating: there is no review model, endpoint or form. The server also ignored
// the sort entirely, so all four options showed the same list. These are the
// orders the server now applies, each from something it actually records.
const sortOptions = [
  { value: 'sessions', label: 'Most Sessions' },
  { value: 'newest', label: 'Newest' },
  { value: 'price_low', label: 'Price: Low to High' },
  { value: 'price_high', label: 'Price: High to Low' },
];

const errorMessage = (e: unknown) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message;

interface OwnMentorProfile {
  id: string;
  isAvailable: boolean;
  hourlyRate: number | string | null;
  sessionCount: number;
}

/**
 * The mentor's own controls: whether she is taking new requests, and a way
 * back into the form that edits her rate and expertise.
 *
 * The become-a-mentor wizard has always told mentors they could "stop taking
 * new requests at any moment" from here, and there was no control to do it:
 * nothing on the client wrote `isAvailable = false`. Drawn only for a member
 * who has a mentor profile.
 */
function YourMentorProfile() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const profile = useQuery({
    queryKey: ['mentor-me'],
    queryFn: async () => (await api.get('/mentors/me')).data?.data as OwnMentorProfile | null,
    enabled: Boolean(user),
  });

  const availability = useMutation({
    mutationFn: async (isAvailable: boolean) =>
      (await api.patch('/mentors/me/availability', { isAvailable })).data?.data as OwnMentorProfile,
    onSuccess: (updated) => {
      queryClient.setQueryData(['mentor-me'], updated);
      queryClient.invalidateQueries({ queryKey: ['mentors'] });
      toast.success(
        updated.isAvailable
          ? 'You are taking new requests again.'
          : 'New requests are paused. Sessions already booked are unchanged.'
      );
    },
    onError: (error) => toast.error(errorMessage(error) || 'That did not save. Try again.'),
  });

  if (!user || profile.isLoading) return null;

  if (profile.isError) {
    return (
      <div className="card border border-amber-200 bg-amber-50 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        We could not check whether you have a mentor profile, so its controls are not shown.{' '}
        <button type="button" className="underline" onClick={() => profile.refetch()}>
          Try again
        </button>
      </div>
    );
  }

  const mine = profile.data;
  if (!mine) return null;

  return (
    <div className="card flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <h2 className="font-semibold text-slate-900 dark:text-white">Your mentor profile</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          {mine.isAvailable
            ? 'You are taking new requests. Mentees can see your free times and ask for a session.'
            : 'New requests are paused. Your profile shows you as unavailable and offers no times; sessions already booked are unchanged.'}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => availability.mutate(!mine.isAvailable)}
          disabled={availability.isPending}
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2 disabled:opacity-60',
            mine.isAvailable ? 'btn-outline' : 'btn-primary'
          )}
        >
          {mine.isAvailable ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
          {mine.isAvailable ? 'Pause new requests' : 'Take new requests'}
        </button>
        <Link href="/dashboard/mentors/become-mentor" className="btn-outline inline-flex items-center gap-2 px-4 py-2">
          <Pencil className="h-4 w-4" />
          Edit rate &amp; expertise
        </Link>
      </div>
    </div>
  );
}

function getDisplayName(mentor: any) {
  return mentor.user?.displayName || 'ATHENA Mentor';
}

function getHeadline(mentor: any) {
  return (
    mentor.user?.headline ||
    (mentor.yearsExperience
      ? `${mentor.yearsExperience}+ years of mentoring experience`
      : 'Career mentor')
  );
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

export default function MentorsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecialization, setSelectedSpecialization] = useState('All Specializations');
  const [sortBy, setSortBy] = useState('sessions');

  const { data, isLoading, isError, refetch } = useMentors({
    search: searchQuery,
    specialization:
      selectedSpecialization !== 'All Specializations'
        ? selectedSpecialization
        : undefined,
    sortBy,
  });

  const mentors = data?.mentors || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Find Your Mentor
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Connect with experienced professionals who can guide your next move.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/mentors/sessions" className="btn-outline px-5 py-2.5 text-center">
            My sessions
          </Link>
          {/* Become a mentor tells her that paid sessions need payouts
              connected "from the mentor dashboard", and this is that dashboard,
              so it has to be possible to get there from here. */}
          <Link href="/dashboard/earnings" className="btn-outline px-5 py-2.5 text-center">
            Payouts &amp; earnings
          </Link>
          <Link
            href="/dashboard/mentors/become-mentor"
            className="btn-primary px-6 py-2.5 text-center"
          >
            Become a Mentor
          </Link>
        </div>
      </div>

      <YourMentorProfile />

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search mentors by name or expertise..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-10 w-full"
          />
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <select
              value={selectedSpecialization}
              onChange={(e) => setSelectedSpecialization(e.target.value)}
              className="input appearance-none pr-10"
            >
              {specializations.map((specialization) => (
                <option key={specialization} value={specialization}>
                  {specialization}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="input appearance-none pr-10"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : isError ? (
          // A failed request used to fall through to "No mentors found", which
          // told her the directory was empty when it had not been read.
          <div className="col-span-full card py-12 text-center">
            <h3 className="mb-2 text-lg font-medium text-slate-900 dark:text-white">
              We could not load the mentors
            </h3>
            <p className="mb-4 text-slate-500 dark:text-slate-400">
              This is a problem on our side or with the connection, not an empty directory.
            </p>
            <button onClick={() => refetch()} className="btn-outline px-4 py-2">
              Try again
            </button>
          </div>
        ) : mentors.length ? (
          mentors.map((mentor: any) => {
            const displayName = getDisplayName(mentor);
            const headline = getHeadline(mentor);
            const specializationsList = toStringArray(mentor.specializations);
            const hourlyRate =
              mentor.hourlyRate !== null && mentor.hourlyRate !== undefined
                ? Number(mentor.hourlyRate)
                : null;

            return (
              <div
                key={mentor.id}
                className="card border border-transparent transition-shadow hover:shadow-lg"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex items-start space-x-4">
                    {mentor.user?.avatar ? (
                      <img
                        src={mentor.user.avatar}
                        alt={displayName}
                        className="h-16 w-16 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-100 font-semibold text-xl text-primary-600 dark:bg-primary-900">
                        {getInitials(displayName) || 'AM'}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-slate-900 dark:text-white">
                        {displayName}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {headline}
                      </p>
                    </div>
                  </div>

                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
                      mentor.isAvailable
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    )}
                  >
                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                    {mentor.isAvailable ? 'Available' : 'Unavailable'}
                  </span>
                </div>

                <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
                  <div className="flex items-center text-slate-500 dark:text-slate-400">
                    <Users className="mr-1 h-4 w-4" />
                    <span>{mentor.sessionCount || 0} sessions</span>
                  </div>
                  {mentor.yearsExperience ? (
                    <div className="flex items-center text-slate-500 dark:text-slate-400">
                      <Award className="mr-1 h-4 w-4" />
                      <span>{mentor.yearsExperience}+ years</span>
                    </div>
                  ) : null}
                </div>

                {specializationsList.length > 0 ? (
                  <div className="mb-4 flex flex-wrap gap-2">
                    {specializationsList.slice(0, 3).map((specialization, index) => (
                      <span
                        key={`${mentor.id}-${specialization}-${index}`}
                        className="rounded-full bg-primary-50 px-2 py-1 text-xs font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
                      >
                        {specialization}
                      </span>
                    ))}
                    {specializationsList.length > 3 ? (
                      <span className="px-2 py-1 text-xs font-medium text-slate-500">
                        +{specializationsList.length - 3} more
                      </span>
                    ) : null}
                  </div>
                ) : null}

                <p className="mb-4 line-clamp-3 text-sm text-slate-600 dark:text-slate-300">
                  {mentor.user?.bio || 'This mentor has not added a public bio yet.'}
                </p>

                <div className="mb-4 flex items-center justify-between text-sm">
                  <div className="flex items-center text-slate-500 dark:text-slate-400">
                    <Clock className="mr-1 h-4 w-4" />
                    <span>30 or 60 minute sessions</span>
                  </div>
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {/* Zero is a rate: she mentors for free, and "Rate on
                        request" hid the one thing most likely to bring a
                        mentee to her. Null is the rate she has not set. */}
                    {hourlyRate === null
                      ? 'Rate not set'
                      : hourlyRate === 0
                        ? 'Free'
                        : `${formatCurrency(hourlyRate)}/hour`}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Link
                    href={`/dashboard/mentors/${mentor.id}`}
                    className="flex-1 btn-outline py-2 text-center text-sm"
                  >
                    View Profile
                  </Link>
                  <Link
                    href={`/dashboard/mentors/${mentor.id}`}
                    className="flex-1 btn-primary py-2 text-center text-sm"
                  >
                    Book Session
                  </Link>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full card py-12 text-center">
            <Users className="mx-auto mb-4 h-12 w-12 text-slate-400" />
            <h3 className="mb-2 text-lg font-medium text-slate-900 dark:text-white">
              No mentors found
            </h3>
            <p className="mb-4 text-slate-500 dark:text-slate-400">
              Try adjusting your search or filters.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedSpecialization('All Specializations');
              }}
              className="btn-outline px-4 py-2"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

      <div className="card bg-gradient-to-r from-primary-600 to-secondary-600 text-white">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="mb-2 text-xl font-bold">Share Your Knowledge</h2>
            <p className="text-white/80">
              Join ATHENA as a mentor and help other women achieve their career goals.
            </p>
          </div>
          <Link
            href="/dashboard/mentors/become-mentor"
            className="btn flex-shrink-0 bg-white px-6 py-3 text-primary-600 hover:bg-slate-100"
          >
            Become a mentor
          </Link>
        </div>
      </div>
    </div>
  );
}
