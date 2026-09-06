'use client';

/**
 * One article, for reading. The body is Markdown rendered through an
 * allow-list, so nothing in it can run.
 */

import { use } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Loader2, Newspaper, Tag } from 'lucide-react';
import { api } from '@/lib/api';
import Markdown from '@/components/blog/Markdown';
import { EmptyState, PageShell } from '@/components/layout/PageShell';

type Author = { id: string; firstName?: string; lastName?: string; displayName?: string | null; avatar?: string | null; headline?: string | null };
type Article = { id: string; slug: string; title: string; excerpt: string | null; body: string; coverImage: string | null; tags: string[]; publishedAt: string; author: Author };

const authorName = (a?: Author | null) => a?.displayName || [a?.firstName, a?.lastName].filter(Boolean).join(' ') || 'ATHENA';

export default function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const article = useQuery({
    queryKey: ['blog-article', slug],
    queryFn: () => api.get(`/blog/${encodeURIComponent(slug)}`),
    select: (r) => r.data?.data as Article,
    retry: false,
  });

  return (
    <PageShell width="narrow" backTo={{ href: '/blog', label: 'All articles' }}>
      {article.isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
        </div>
      ) : article.isError || !article.data ? (
        <EmptyState icon={Newspaper} reason="empty" title="No article at this address" description="It may have been unpublished, or the link is wrong." primaryAction={{ label: 'All articles', href: '/blog' }} />
      ) : (
        <article>
          <header className="mb-8">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{format(new Date(article.data.publishedAt), 'd MMMM yyyy')}</p>
            <h1 className="mt-2 text-3xl font-semibold leading-tight text-slate-900 dark:text-white sm:text-4xl" style={{ textWrap: 'balance' }}>
              {article.data.title}
            </h1>
            {article.data.excerpt && <p className="mt-3 text-lg text-slate-600 dark:text-slate-300">{article.data.excerpt}</p>}
            <div className="mt-4 flex items-center gap-3">
              {article.data.author.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element -- avatars come from the media store
                <img src={article.data.author.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">{authorName(article.data.author).charAt(0)}</div>
              )}
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">{authorName(article.data.author)}</p>
                {article.data.author.headline && <p className="text-xs text-slate-500">{article.data.author.headline}</p>}
              </div>
            </div>
          </header>
          {article.data.coverImage && (
            // eslint-disable-next-line @next/next/no-img-element -- covers come from any host staff paste in
            <img src={article.data.coverImage} alt="" className="mb-8 w-full rounded-2xl object-cover" />
          )}
          <Markdown source={article.data.body} />
          {article.data.tags.length > 0 && (
            <footer className="mt-10 flex flex-wrap gap-2 border-t border-slate-200 pt-6 dark:border-slate-800">
              {article.data.tags.map((t) => (
                <Link key={t} href={`/blog?tag=${encodeURIComponent(t)}`} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">
                  <Tag className="h-3 w-3" /> {t}
                </Link>
              ))}
            </footer>
          )}
        </article>
      )}
    </PageShell>
  );
}
