'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CalendarDays,
  Lock,
  MessageCircle,
  Search,
  Users,
  X,
} from 'lucide-react';
import { groupsApi } from '@/lib/api';
import {
  EmptyState,
  FilterPill,
  PageHero,
  PageShell,
  Section,
  TileSkeleton,
} from '@/components/layout/PageShell';

/**
 * The public communities page.
 *
 * It used to be two hardcoded link tiles — a page about communities that never
 * showed a single one, while the database had six real groups sitting behind
 * `GET /api/groups`. Every group on this page now comes from that endpoint.
 * There are no placeholder groups; if the API returns nothing we say so plainly
 * rather than inventing rooms that do not exist.
 */

type Group = {
  id: string;
  name: string;
  description?: string | null;
  privacy?: string | null;
  memberCount?: number | null;
  isMember?: boolean | null;
};

/** Deterministic tile colours, matching the home rail so a group looks the same in both places. */
const GROUP_TINTS = [
  'from-rose-500 to-pink-500',
  'from-sky-500 to-cyan-500',
  'from-violet-500 to-indigo-500',
  'from-amber-500 to-orange-500',
  'from-emerald-500 to-teal-500',
  'from-fuchsia-500 to-purple-500',
];

/** The API always sends a count, so say it properly rather than "1 members". */
function memberLabel(count: number): string {
  return count === 1 ? '1 member' : `${count.toLocaleString('en-AU')} members`;
}

const OTHER_ROOMS = [
  {
    href: '/dashboard/groups',
    icon: Users,
    label: 'Your groups',
    blurb: 'The ones you have joined, and the form to start a new one.',
  },
  {
    href: '/network',
    icon: Users,
    label: 'Network',
    blurb: 'People on ATHENA, and the ones worth a first message.',
  },
  {
    href: '/events',
    icon: CalendarDays,
    label: 'Events',
    blurb: 'What is coming up, online and around the country.',
  },
  {
    href: '/feed',
    icon: MessageCircle,
    label: 'Feed',
    blurb: 'What members are posting today.',
  },
];

export default function CommunitiesPage() {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [joinedOnly, setJoinedOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;
    groupsApi
      .list()
      .then((r) => {
        if (cancelled) return;
        const data = r.data?.data;
        setGroups(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
        setGroups([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /* The "joined" filter only exists for someone who has actually joined something. */
  const anyJoined = (groups ?? []).some((g) => g.isMember);

  const visible = useMemo(() => {
    if (!groups) return [];
    const q = query.trim().toLowerCase();
    return groups.filter((g) => {
      if (joinedOnly && !g.isMember) return false;
      if (!q) return true;
      return (
        g.name.toLowerCase().includes(q) || (g.description ?? '').toLowerCase().includes(q)
      );
    });
  }, [groups, query, joinedOnly]);

  const isFiltered = query.trim().length > 0 || joinedOnly;

  const clearFilters = () => {
    setQuery('');
    setJoinedOnly(false);
  };

  return (
    <PageShell>
      <div className="space-y-6">
        <PageHero
          kicker="Communities"
          title="Find your people"
          description="Smaller rooms for whatever you are working on right now — a career change, a first business, a move back to the regions. You do not have to do it on your own."
          primaryAction={{ label: 'Start a group', href: '/dashboard/groups' }}
          secondaryAction={{ label: 'See what people are posting', href: '/feed' }}
        />

        <Section
          icon={Users}
          title="Groups you can join"
          description="Have a look inside before you decide. Joining takes one tap."
        >
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-0 flex-1 sm:max-w-sm">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search groups"
                aria-label="Search groups by name or description"
                className="focusable w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                  className="focusable absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {anyJoined && (
              <div className="flex flex-wrap gap-2">
                <FilterPill active={!joinedOnly} onClick={() => setJoinedOnly(false)}>
                  All groups
                </FilterPill>
                <FilterPill active={joinedOnly} onClick={() => setJoinedOnly(true)}>
                  Ones you have joined
                </FilterPill>
              </div>
            )}
          </div>

          {groups === null ? (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <TileSkeleton count={6} />
            </ul>
          ) : visible.length > 0 ? (
            <>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {visible.map((group, index) => {
                  const count = typeof group.memberCount === 'number' ? group.memberCount : null;
                  const isPrivate = (group.privacy ?? '').toLowerCase() === 'private';
                  return (
                    <li key={group.id}>
                      <Link
                        href={`/dashboard/groups/${group.id}`}
                        className="tile-soft focusable flex h-full flex-col p-4"
                      >
                        <span className="flex items-start gap-3">
                          <span
                            aria-hidden="true"
                            className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${
                              GROUP_TINTS[index % GROUP_TINTS.length]
                            } text-xs font-bold text-white`}
                          >
                            {group.name.slice(0, 2).toUpperCase()}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold leading-5 text-slate-900 dark:text-white">
                              {group.name}
                            </span>
                            {count !== null && (
                              <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">
                                {memberLabel(count)}
                              </span>
                            )}
                          </span>
                        </span>

                        {group.description && (
                          <span className="mt-3 line-clamp-3 block text-sm leading-6 text-slate-600 dark:text-slate-400">
                            {group.description}
                          </span>
                        )}

                        {(group.isMember || isPrivate) && (
                          <span className="mt-auto flex flex-wrap items-center gap-1.5 pt-3">
                            {group.isMember && (
                              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
                                Joined
                              </span>
                            )}
                            {isPrivate && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                <Lock className="h-2.5 w-2.5" aria-hidden="true" />
                                Private
                              </span>
                            )}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>

              <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-400">
                {visible.length === groups.length
                  ? `${visible.length} ${visible.length === 1 ? 'group' : 'groups'} so far. Start another if the room you need is missing.`
                  : `${visible.length} of ${groups.length} groups match.`}
              </p>
            </>
          ) : isFiltered && !failed ? (
            <div className="mt-4">
              <EmptyState
                icon={Search}
                reason="filtered"
                title="No groups match that"
                description="Try a shorter search, or clear it to see every group on ATHENA."
                onClear={clearFilters}
              />
            </div>
          ) : (
            <div className="mt-4">
              <EmptyState
                icon={Users}
                reason="empty"
                title={failed ? 'We could not load the groups' : 'No groups yet'}
                description={
                  failed
                    ? 'Something went wrong fetching them. Refresh the page, or start a group of your own in the meantime.'
                    : 'Nobody has started a group yet. If there is a room you keep wishing existed, you can be the one who opens it.'
                }
                primaryAction={{ label: 'Start a group', href: '/dashboard/groups' }}
                secondaryAction={{ label: 'Browse the feed', href: '/feed' }}
              />
            </div>
          )}
        </Section>

        <Section
          icon={MessageCircle}
          title="Other ways to meet people"
          description="Groups are one room of several."
        >
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {OTHER_ROOMS.map(({ href, icon: Icon, label, blurb }) => (
              <li key={href}>
                <Link href={href} className="tile-soft focusable flex h-full flex-col p-4">
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                    <Icon className="h-4 w-4 text-rose-500" aria-hidden="true" />
                    {label}
                  </span>
                  <span className="mt-1.5 block text-sm leading-6 text-slate-600 dark:text-slate-400">
                    {blurb}
                  </span>
                  <span className="mt-auto inline-flex items-center gap-1.5 pt-3 text-sm font-semibold text-rose-600 dark:text-rose-400">
                    Open <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </PageShell>
  );
}
