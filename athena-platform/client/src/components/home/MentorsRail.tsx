'use client';

/**
 * People who have done it: three mentors from the platform's own list, with
 * what they help with, their experience and their rate. A visitor who taps
 * one is asked to sign in and brought back. Renders nothing with no mentors.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Star, Users } from 'lucide-react';
import { mentorApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Rail, SkeletonTiles, StaggerItem, StaggerList, TILE_GRADIENTS } from './RailShell';

type Mentor = {
  id: string;
  specializations?: unknown;
  yearsExperience?: number | null;
  hourlyRate?: number | string | null;
  rating?: number | string | null;
  reviewCount?: number | null;
  isAvailable?: boolean;
  user?: { id: string; displayName?: string | null; avatar?: string | null; headline?: string | null } | null;
};

const specs = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0) : []);
const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase() || 'M';

export function MentorsRail() {
  const [mentors, setMentors] = useState<Mentor[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    mentorApi
      .getAll({ limit: 3 })
      .then((r) => {
        if (cancelled) return;
        const list = r.data?.mentors ?? r.data?.data;
        setMentors(Array.isArray(list) ? list.slice(0, 3) : []);
      })
      .catch(() => {
        if (!cancelled) setMentors([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (mentors !== null && mentors.length === 0) return null;

  return (
    <Rail icon={Users} tone="rose" kicker="Mentors" title="People who have done it" titleId="home-mentors-title" description="Book a session with someone a few steps ahead of you." cta={{ href: '/mentors', label: 'All mentors' }}>
      <StaggerList className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {mentors === null ? (
          <SkeletonTiles count={3} height="h-44" />
        ) : (
          mentors.map((mentor, index) => {
            const name = mentor.user?.displayName?.trim() || 'ATHENA mentor';
            const areas = specs(mentor.specializations).slice(0, 3);
            const rate = mentor.hourlyRate != null ? Number(mentor.hourlyRate) : null;
            const rating = mentor.rating != null ? Number(mentor.rating) : null;
            return (
              <StaggerItem key={mentor.id}>
                <Link href={`/dashboard/mentors/${mentor.id}`} className="tile-glass group flex h-full flex-col p-4">
                  <span className="flex items-center gap-3">
                    {mentor.user?.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element -- avatars come from the media store
                      <img src={mentor.user.avatar} alt="" className="h-12 w-12 rounded-full object-cover ring-2 ring-white dark:ring-slate-900" />
                    ) : (
                      <span className={cn('flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br text-sm font-bold text-white', TILE_GRADIENTS[index % TILE_GRADIENTS.length])}>{initials(name)}</span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold text-slate-900 dark:text-white">{name}</span>
                      {mentor.user?.headline && <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{mentor.user.headline}</span>}
                    </span>
                  </span>
                  {areas.length > 0 && (
                    <span className="mt-3 flex flex-wrap gap-1.5">
                      {areas.map((a) => (
                        <span key={a} className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700 dark:bg-rose-500/15 dark:text-rose-200">
                          {a}
                        </span>
                      ))}
                    </span>
                  )}
                  <span className="mt-auto flex items-center gap-3 pt-4 text-[11px] text-slate-500 dark:text-slate-400">
                    {typeof mentor.yearsExperience === 'number' && mentor.yearsExperience > 0 && <span>{mentor.yearsExperience} yrs</span>}
                    {rating !== null && rating > 0 && (
                      <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                        <Star className="h-3 w-3 fill-current" /> {rating.toFixed(1)}
                      </span>
                    )}
                    <span className="ml-auto inline-flex items-center gap-2">
                      {rate !== null && <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700 dark:bg-white/10 dark:text-slate-200">{rate === 0 ? 'Free' : `$${rate}/hr`}</span>}
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-white transition-colors group-hover:bg-rose-500 dark:bg-white dark:text-slate-900 dark:group-hover:bg-rose-400">
                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </span>
                  </span>
                </Link>
              </StaggerItem>
            );
          })
        )}
      </StaggerList>
    </Rail>
  );
}
