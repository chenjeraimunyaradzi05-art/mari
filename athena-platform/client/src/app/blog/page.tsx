'use client';

/**
 * The blog. Every article here was written and published by staff through
 * /admin/blog; the page was "Coming soon" until there was somewhere to
 * write. Nothing is invented for the shelf: if nothing is published, it
 * says so.
 */

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Newspaper, Search, Tag } from 'lucide-react';
import { api } from '@/lib/api';
import { EmptyState, FilterPill, PageHero, PageShell, Section, TileSkeleton } from '@/components/layout/PageShell';

type Author = { id: string; firstName?: string; lastName?: string; displayName?: string | null; avatar?: string | null; headline?: string | null };
type Article = { id: string; slug: string; title: string; excerpt: string | null; coverImage: string | null; tags: string[]; publishedAt: string; author: Author };

const PAGE_SIZE = 12;
export const authorName = (a?: Author | null) => a?.displayName || [a?.firstName, a?.lastName].filter(Boolean).join(' ') || 'ATHENA';

function BlogList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tag = searchParams.get('tag') || '';
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const articles = useQuery({
    queryKey: ['blog', { tag, q, page }],
    queryFn: () => api.get('/blog', { params: { page, limit: PAGE_SIZE, ...(tag ? { tag } : {}), ...(q ? { q } : {}) } }),
    select: (r) => ({
      items: (Array.isArray(r.data?.data) ? r.data.data : []) as Article[],
      pages: (r.data?.pagination?.pages as number | undefined) ?? 1,
      total: (r.data?.pagination?.total as number | undefined) ?? 0,
    }),
  });
  const tags = useQuery({
    queryKey: ['blog-tags'],
    queryFn: () => api.get('/blog/tags'),
    select: (r) => (Array.isArray(r.data?.data) ? (r.data.data as Array<{ tag: string; count: number }>) : []),
  });

  const setTag = (next: string) => {
    setPage(1);
    router.push(next ? `/blog?tag=${encodeURIComponent(next)}` : '/blog');
  };
  const filtersOn = tag !== '' || q !== '';
  const items = articles.data?.items ?? [];

  return (
    <Section icon={Newspaper} title="Articles">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search articles" aria-label="Search articles" className="input w-full pl-9" />
        </label>
        {(tags.data?.length ?? 0) > 0 && (
          <>
            <FilterPill active={tag === ''} onClick={() => setTag('')}>
              All
            </FilterPill>
            {tags.data!.map((t) => (
              <FilterPill key={t.tag} active={tag === t.tag} onClick={() => setTag(tag === t.tag ? '' : t.tag)}>
                {t.tag} · {t.count}
              </FilterPill>
            ))}
          </>
        )}
      </div>

      {articles.isLoading ? (
        <TileSkeleton count={3} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Newspaper}
          reason={filtersOn ? 'filtered' : 'empty'}
          title={filtersOn ? 'No articles match' : 'Nothing published yet'}
          description={filtersOn ? 'Try another word or tag.' : 'Articles appear here as they are published.'}
          onClear={
            filtersOn
              ? () => {
                  setSearch('');
                  setTag('');
                }
              : undefined
          }
        />
      ) : (
        <>
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((a) => (
              <li key={a.id}>
                <Link href={`/blog/${a.slug}`} className="surface flex h-full flex-col overflow-hidden transition hover:shadow-md">
                  {a.coverImage && (
                    // eslint-disable-next-line @next/next/no-img-element -- covers come from any host staff paste in
                    <img src={a.coverImage} alt="" className="aspect-[16/9] w-full object-cover" loading="lazy" />
                  )}
                  <div className="flex flex-1 flex-col p-5">
                    <p className="text-xs text-slate-500">
                      {format(new Date(a.publishedAt), 'd MMMM yyyy')} · {authorName(a.author)}
                    </p>
                    <h3 className="mt-1 text-lg font-semibold leading-snug text-slate-900 dark:text-white">{a.title}</h3>
                    {a.excerpt && <p className="mt-2 line-clamp-3 text-sm text-slate-600 dark:text-slate-300">{a.excerpt}</p>}
                    {a.tags.length > 0 && (
                      <p className="mt-auto flex flex-wrap gap-1 pt-3">
                        {a.tags.map((t) => (
                          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            <Tag className="h-3 w-3" /> {t}
                          </span>
                        ))}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          {(articles.data?.pages ?? 1) > 1 && (
            <div className="mt-6 flex items-center justify-center gap-3 text-sm">
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="btn-outline disabled:opacity-50">
                Newer
              </button>
              <span className="text-slate-500">
                Page {page} of {articles.data?.pages}
              </span>
              <button type="button" onClick={() => setPage((p) => p + 1)} disabled={page >= (articles.data?.pages ?? 1)} className="btn-outline disabled:opacity-50">
                Older
              </button>
            </div>
          )}
        </>
      )}
    </Section>
  );
}

export default function BlogPage() {
  return (
    <PageShell width="wide">
      <PageHero kicker="Blog" title="Writing from ATHENA" description="Notes on building the platform, on money, work and safety for women in Australia, and on what we learn along the way." secondaryAction={{ label: 'Press', href: '/press' }} />
      <Suspense fallback={<TileSkeleton count={3} />}>
        <BlogList />
      </Suspense>
    </PageShell>
  );
}
