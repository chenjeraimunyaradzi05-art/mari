'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  BookOpen,
  Briefcase,
  GraduationCap,
  MessageSquare,
  Play,
  Search as SearchIcon,
  Users,
} from 'lucide-react';
import { searchApi } from '@/lib/api';
import {
  EmptyState,
  FilterPill,
  PageHero,
  PageShell,
  Section,
  TileSkeleton,
} from '@/components/layout/PageShell';

/**
 * One search across everything on ATHENA.
 *
 * The old page had an input that did nothing: you could type into it, but the
 * only way to see a result was to click a category card, which threw your words
 * at another page. The search API (GET /api/search) has always returned ranked
 * results across jobs, courses, people, mentors, posts and videos — nothing on
 * the client was asking it. Now the input is wired to it, debounced, with the
 * query living in the URL so /search?q=… from the nav keeps working.
 *
 * Nothing here is invented: every card is a row the API returned, and no group
 * is rendered unless the search actually matched something in it.
 */

const RESULT_LIMIT = 30;
const DEBOUNCE_MS = 300;

type ResultType = 'job' | 'course' | 'user' | 'mentor' | 'post' | 'video';

/** Only the metadata fields the cards below read. The API sends more. */
type ResultMeta = {
  company?: { id?: string; name?: string | null } | null;
  organization?: { id?: string; name?: string | null } | null;
  provider?: string | null;
  location?: string | null;
  type?: string | null;
  isRemote?: boolean | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  durationMonths?: number | null;
  cost?: number | null;
  studyMode?: string[] | null;
  headline?: string | null;
  userId?: string | null;
  author?: { id?: string; displayName?: string | null } | null;
  likeCount?: number | null;
  commentCount?: number | null;
  viewCount?: number | null;
};

type SearchHit = {
  type: ResultType;
  id: string;
  title?: string | null;
  content?: string | null;
  highlight?: string | null;
  metadata?: ResultMeta | null;
};

type ApiType = 'all' | 'jobs' | 'courses' | 'users' | 'mentors' | 'posts' | 'videos';

/* The tabs, the API's `type` values and the result rows they group are three
   different vocabularies, so they are mapped in one place. */
const TABS: { value: ApiType; label: string }[] = [
  { value: 'all', label: 'Everything' },
  { value: 'jobs', label: 'Jobs' },
  { value: 'courses', label: 'Courses' },
  { value: 'users', label: 'People' },
  { value: 'mentors', label: 'Mentors' },
  { value: 'posts', label: 'Posts' },
  { value: 'videos', label: 'Videos' },
];

const GROUPS: {
  type: ResultType;
  title: string;
  icon: typeof Briefcase;
  /** Only jobs has a listing page that reads ?q=, so only jobs gets a "see all". */
  seeAll?: (q: string) => { label: string; href: string };
}[] = [
  {
    type: 'job',
    title: 'Jobs',
    icon: Briefcase,
    seeAll: (q) => ({ label: 'All jobs', href: `/jobs?q=${encodeURIComponent(q)}` }),
  },
  { type: 'course', title: 'Courses', icon: BookOpen },
  { type: 'user', title: 'People', icon: Users },
  { type: 'mentor', title: 'Mentors', icon: GraduationCap },
  { type: 'post', title: 'Posts', icon: MessageSquare },
  { type: 'video', title: 'Videos', icon: Play },
];

/* Where each result actually goes. A post opens its own page and a reel opens
   in the player, now that both routes exist; earlier every post result dropped
   the reader at the top of the feed and every reel at the top of Reels, with
   the thing they clicked nowhere in sight. */
function hrefFor(hit: SearchHit): string {
  const meta = hit.metadata ?? {};
  switch (hit.type) {
    case 'job':
      return `/jobs/${hit.id}`;
    case 'course':
      return `/dashboard/learn/${hit.id}`;
    case 'user':
      return `/profile/${hit.id}`;
    case 'mentor':
      return meta.userId ? `/profile/${meta.userId}` : '/mentors';
    case 'post':
      return `/posts/${hit.id}`;
    case 'video':
      return `/explore?video=${hit.id}`;
    default:
      return '/search';
  }
}

/* "#welding" typed into the box, or a hashtag clicked in a caption. */
const HASHTAG_QUERY = /^#([\p{L}\p{N}_]{2,64})$/u;

const money = (n: number) =>
  n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${new Intl.NumberFormat('en-AU').format(n)}`;

function duration(months?: number | null): string | null {
  if (!months) return null;
  if (months < 12) return `${months} mo`;
  const years = months / 12;
  return years === 1 ? '1 yr' : `${Number.isInteger(years) ? years : years.toFixed(1)} yrs`;
}

function titleFor(hit: SearchHit): string {
  if (hit.title) return hit.title;
  if (hit.type === 'post') {
    const author = hit.metadata?.author?.displayName;
    return author ? `${author} posted` : 'A post on ATHENA';
  }
  return 'Result';
}

/** The line under the title: who or where, never padding. */
function subtitleFor(hit: SearchHit): string | null {
  const meta = hit.metadata ?? {};
  switch (hit.type) {
    case 'job':
      return [meta.company?.name, meta.location].filter(Boolean).join(' · ') || null;
    case 'course':
      return meta.provider || meta.organization?.name || null;
    case 'user':
    case 'mentor':
      return meta.headline || null;
    case 'post':
      return meta.author?.displayName ? `Posted by ${meta.author.displayName}` : null;
    default:
      return null;
  }
}

/** Short factual chips. Everything comes off the row; nothing is estimated. */
function chipsFor(hit: SearchHit): string[] {
  const meta = hit.metadata ?? {};
  const chips: string[] = [];

  if (hit.type === 'job') {
    if (meta.type) chips.push(String(meta.type).toLowerCase().replace(/_/g, ' '));
    if (meta.isRemote) chips.push('remote');
    if (typeof meta.salaryMin === 'number' && typeof meta.salaryMax === 'number') {
      chips.push(`${money(meta.salaryMin)}–${money(meta.salaryMax)}`);
    } else if (typeof meta.salaryMin === 'number') {
      chips.push(`from ${money(meta.salaryMin)}`);
    }
  }

  if (hit.type === 'course') {
    if (meta.type) chips.push(String(meta.type));
    const d = duration(meta.durationMonths);
    if (d) chips.push(d);
    if (meta.cost === 0) chips.push('free');
    else if (typeof meta.cost === 'number') chips.push(money(meta.cost));
    if (meta.studyMode?.[0]) chips.push(meta.studyMode[0].replace(/-/g, ' '));
  }

  if (hit.type === 'post') {
    if (meta.likeCount) chips.push(`${meta.likeCount} likes`);
    if (meta.commentCount) chips.push(`${meta.commentCount} comments`);
  }

  if (hit.type === 'video' && meta.viewCount) chips.push(`${meta.viewCount} views`);

  return chips;
}

function ResultCard({ hit }: { hit: SearchHit }) {
  const subtitle = subtitleFor(hit);
  const chips = chipsFor(hit);
  const excerpt = hit.highlight || hit.content || null;

  return (
    <li>
      <Link href={hrefFor(hit)} className="tile-soft focusable flex h-full flex-col p-4">
        <span className="line-clamp-2 text-sm font-semibold text-slate-900 dark:text-white">
          {titleFor(hit)}
        </span>

        {subtitle && (
          <span className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
            {subtitle}
          </span>
        )}

        {excerpt && (
          <span className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
            {excerpt}
          </span>
        )}

        {chips.length > 0 && (
          <span className="mt-auto flex flex-wrap gap-1.5 pt-3">
            {chips.map((chip) => (
              <span
                key={chip}
                className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold capitalize text-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                {chip}
              </span>
            ))}
          </span>
        )}
      </Link>
    </li>
  );
}

/* The starting state. Four places worth browsing when you have not typed
   anything yet — each one a page that exists. */
const SHORTCUTS = [
  { label: 'Jobs', description: 'Roles employers listed here', href: '/jobs', icon: Briefcase },
  { label: 'Courses', description: 'Training and what it led to', href: '/courses', icon: BookOpen },
  { label: 'Mentors', description: 'People offering their time', href: '/mentors', icon: GraduationCap },
  { label: 'The feed', description: 'What members are talking about', href: '/feed', icon: MessageSquare },
];

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchContent />
    </Suspense>
  );
}

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  /* The URL holds the search, so /search?q=nurse from the nav, a shared link
     and the back button all land on the same results. */
  const query = searchParams.get('q') ?? '';
  const tabParam = (searchParams.get('type') ?? 'all') as ApiType;
  const activeTab = TABS.some((t) => t.value === tabParam) ? tabParam : 'all';

  const [draft, setDraft] = useState(query);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const setParams = useCallback(
    (next: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(next)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      const qs = params.toString();
      /* replace, not push: typing eight letters should not put eight entries
         between the reader and the page they came from. */
      router.replace(qs ? `/search?${qs}` : '/search');
    },
    [router, searchParams]
  );

  /* Adopt a query that changed outside the input — a nav link, or going back. */
  useEffect(() => setDraft(query), [query]);

  /* Debounce the typing into the URL; the fetch below keys off the URL. */
  useEffect(() => {
    if (draft.trim() === query.trim()) return;
    const timer = setTimeout(() => setParams({ q: draft.trim() || null }), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, query, setParams]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setHits([]);
      setTotal(0);
      setLoading(false);
      setFailed(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    searchApi
      .unified({ q, type: activeTab, limit: RESULT_LIMIT })
      .then((response) => {
        if (cancelled) return;
        const results = response.data?.results;
        setHits(Array.isArray(results) ? (results as SearchHit[]) : []);
        setTotal(response.data?.total ?? 0);
        setFailed(false);
      })
      .catch(() => {
        if (cancelled) return;
        setHits([]);
        setTotal(0);
        setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [query, activeTab, reloadKey]);

  const grouped = useMemo(
    () =>
      GROUPS.map((group) => ({
        ...group,
        items: hits.filter((hit) => hit.type === group.type),
      })).filter((group) => group.items.length > 0),
    [hits]
  );

  const trimmed = query.trim();
  const hasQuery = trimmed.length > 0;
  const hashtag = HASHTAG_QUERY.exec(trimmed)?.[1]?.toLowerCase() ?? null;

  /* "Clear filters" is only offered when a category filter is actually on.
     Someone who searched everything and found nothing set no filters, and
     sending them to clear them wastes their time. */
  const clearCategory =
    activeTab === 'all' ? undefined : () => setParams({ type: null });

  const resultLine = () => {
    if (loading) return 'Searching…';
    if (failed) return 'The search could not be reached.';
    if (total === 0) return `Nothing matched “${trimmed}”.`;
    const shown = hits.length;
    const counted = `${total} ${total === 1 ? 'result' : 'results'} for “${trimmed}”`;
    return shown < total ? `${counted}, showing the first ${shown}` : counted;
  };

  return (
    <PageShell>
      <div className="space-y-6">
        <PageHero
          kicker="Search"
          title="One place to look for all of it"
          description="Jobs, courses, people, mentors and what everyone's posting — searched together. Start typing and the results come to you."
        />

        <section className="surface p-5">
          <div className="relative">
            <SearchIcon
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoComplete="off"
              aria-label="Search jobs, courses, people and posts"
              placeholder="Try a job title, a skill, a course or a name"
              className="focusable w-full rounded-lg border border-slate-300 bg-white py-3 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500"
            />
          </div>

          {hasQuery && (
            <div className="mt-4">
              <p className="kicker mb-2">Narrow it down</p>
              <div className="flex flex-wrap gap-2">
                {TABS.map((tab) => (
                  <FilterPill
                    key={tab.value}
                    active={activeTab === tab.value}
                    onClick={() => setParams({ type: tab.value === 'all' ? null : tab.value })}
                  >
                    {tab.label}
                  </FilterPill>
                ))}
              </div>
            </div>
          )}
        </section>

        {hashtag && (
          /* Reels are browsed by topic, so a hashtag search also offers the
             topic itself, which lists every reel carrying the tag rather than
             the handful the ranked search returns. */
          <Link
            href={`/explore?topic=${encodeURIComponent(hashtag)}`}
            className="tile-soft focusable flex items-center justify-between gap-4 p-4"
          >
            <span className="flex items-center gap-3">
              <Play className="h-5 w-5 text-rose-500" aria-hidden="true" />
              <span className="text-sm text-slate-700 dark:text-slate-300">
                Reels tagged <span className="font-semibold">#{hashtag}</span>
              </span>
            </span>
            <span className="text-sm font-medium text-rose-600 dark:text-rose-400">Open in Reels</span>
          </Link>
        )}

        {!hasQuery ? (
          <Section
            icon={SearchIcon}
            title="Start somewhere"
            description="Or browse one part of ATHENA at a time."
          >
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {SHORTCUTS.map((shortcut) => (
                <li key={shortcut.href}>
                  <Link
                    href={shortcut.href}
                    className="tile-soft focusable flex h-full flex-col p-4"
                  >
                    <shortcut.icon className="h-5 w-5 text-rose-500" aria-hidden="true" />
                    <span className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
                      {shortcut.label}
                    </span>
                    <span className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
                      {shortcut.description}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        ) : failed ? (
          <Section icon={SearchIcon} title="Results" description={resultLine()}>
            <div className="rounded-xl border border-slate-200 px-6 py-10 text-center dark:border-slate-800">
              <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">
                Something went wrong reaching the search. Your words are still in the box, so try
                again in a moment.
              </p>
              <button
                type="button"
                onClick={() => setReloadKey((k) => k + 1)}
                className="focusable mt-4 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
              >
                Try again
              </button>
            </div>
          </Section>
        ) : loading ? (
          <Section icon={SearchIcon} title="Results" description={resultLine()}>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <TileSkeleton count={6} className="h-36" />
            </ul>
          </Section>
        ) : grouped.length === 0 ? (
          <EmptyState
            icon={SearchIcon}
            /* On the Everything tab nothing is filtered — there is simply no
               match — so the reason has to say so. Telling the component a
               filter is on when none is set is how "clear your filters" ends up
               in front of someone who never set any. */
            reason={activeTab === 'all' ? 'empty' : 'filtered'}
            title={`Nothing matched “${trimmed}”`}
            description={
              activeTab === 'all'
                ? 'No jobs, courses, people or posts came back for those words. A shorter search, or a different spelling, usually turns something up.'
                : 'Nothing in this category matched. Searching everything may still turn something up.'
            }
            onClear={clearCategory}
          />
        ) : (
          <>
            <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">{resultLine()}</p>

            {grouped.map((group) => (
              <Section
                key={group.type}
                icon={group.icon}
                title={group.title}
                description={`${group.items.length} ${
                  group.items.length === 1 ? 'match' : 'matches'
                }`}
                action={group.seeAll?.(trimmed)}
              >
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {group.items.map((hit) => (
                    <ResultCard key={`${hit.type}-${hit.id}`} hit={hit} />
                  ))}
                </ul>
              </Section>
            ))}
          </>
        )}
      </div>
    </PageShell>
  );
}
