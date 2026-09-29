'use client';

/**
 * Release notes the team has published, newest first.
 *
 * The changelog used to be an array in this page's source, so only a code
 * deploy could add to it and the sitemap's promise of weekly changes could
 * never be kept. A release note is now an article on the blog, written and
 * published by staff at /admin/blog like any other, carrying the tag
 * "changelog"; this lists those, and the full note lives on the blog.
 */

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';

/** The tag that files a blog article under the changelog. */
export const CHANGELOG_TAG = 'changelog';

type Note = { id: string; slug: string; title: string; excerpt: string | null; publishedAt: string };

export function ReleaseNotes() {
  const notes = useQuery({
    queryKey: ['blog', { tag: CHANGELOG_TAG, page: 1, limit: 50 }],
    queryFn: () => api.get('/blog', { params: { tag: CHANGELOG_TAG, page: 1, limit: 50 } }),
    select: (r) => (Array.isArray(r.data?.data) ? (r.data.data as Note[]) : []),
  });

  if (notes.isLoading) {
    return (
      <div className="mt-8 space-y-4" aria-label="Loading the latest release notes">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
        ))}
      </div>
    );
  }

  // A failed load is not "nothing new". Saying nothing here would read as
  // though the last release was the newest one written into the page.
  if (notes.isError) {
    return (
      <div className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300" role="alert">
        The latest release notes did not load, so the list below may not be the newest.{' '}
        <button type="button" onClick={() => notes.refetch()} className="font-medium underline">
          Try again
        </button>
      </div>
    );
  }

  const items = notes.data ?? [];
  if (items.length === 0) return null;

  return (
    <div className="mt-8 space-y-6">
      {items.map((note) => (
        <article key={note.id} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            {format(new Date(note.publishedAt), 'd MMMM yyyy')}
          </p>
          <h2 className="mt-1 text-lg font-semibold">{note.title}</h2>
          {note.excerpt && <p className="mt-2 text-sm leading-6 text-muted-foreground">{note.excerpt}</p>}
          <Link href={`/blog/${note.slug}`} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            Read the full note <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </article>
      ))}
    </div>
  );
}
