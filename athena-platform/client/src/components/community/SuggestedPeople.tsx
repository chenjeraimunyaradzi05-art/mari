'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { UserPlus, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { peopleApi, userApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

/**
 * People you may know, each with the honest reason they are suggested:
 * followed by someone you follow, the same career stage, the same city, or
 * widely followed. Following is optimistic and the row stays put so the
 * list does not jump under your hand.
 */
type Suggestion = {
  id: string;
  name: string;
  avatar: string | null;
  headline: string | null;
  reason: string;
  reasons: string[];
};

interface SuggestedPeopleProps {
  limit?: number;
  className?: string;
  compact?: boolean;
}

export function SuggestedPeople({ limit = 5, className, compact = false }: SuggestedPeopleProps) {
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const [followed, setFollowed] = useState<Record<string, boolean>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['people', 'suggested', limit],
    queryFn: async () => {
      const res = await peopleApi.suggested(limit);
      return (Array.isArray(res.data?.data) ? res.data.data : []) as Suggestion[];
    },
    enabled: isAuthenticated && !authLoading,
    staleTime: 5 * 60 * 1000,
  });

  if (!isAuthenticated || (!isLoading && (!data || data.length === 0))) return null;

  const toggle = async (person: Suggestion) => {
    const next = !followed[person.id];
    setFollowed((prev) => ({ ...prev, [person.id]: next }));
    try {
      await (next ? userApi.follow(person.id) : userApi.unfollow(person.id));
      if (next) toast.success(`Following ${person.name}`);
    } catch {
      setFollowed((prev) => ({ ...prev, [person.id]: !next }));
      toast.error('Could not update the follow');
    }
  };

  return (
    <section className={cn('rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900', className)} aria-label="People you may know">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">People you may know</h2>
        <Users className="h-4 w-4 text-rose-500" />
      </div>
      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 rounded-lg bg-slate-100 dark:bg-slate-800" />
          ))}
        </div>
      ) : (
        <ul className="space-y-3">
          {data!.map((person) => {
            const on = Boolean(followed[person.id]);
            return (
              <li key={person.id} className="flex items-center gap-3">
                <Link href={`/profile/${person.id}`} className="flex-shrink-0">
                  <Avatar src={person.avatar ?? undefined} fallback={person.name.slice(0, 2).toUpperCase()} size={compact ? 'sm' : 'md'} />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/profile/${person.id}`} className="block truncate text-sm font-semibold text-slate-900 hover:underline dark:text-white">
                    {person.name}
                  </Link>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400" title={person.reasons.join(' · ')}>
                    {person.reason}
                    {!compact && person.headline ? ` · ${person.headline}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void toggle(person)}
                  aria-pressed={on}
                  className={cn(
                    'inline-flex flex-shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition',
                    on
                      ? 'border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'
                      : 'bg-rose-600 text-white hover:bg-rose-700'
                  )}
                >
                  {!on && <UserPlus className="h-3 w-3" />}
                  {on ? 'Following' : 'Follow'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default SuggestedPeople;
