/**
 * Link previews for an article: title, excerpt and cover, so a shared link
 * shows the piece rather than the site's generic card. The lookup tells the
 * API it is for metadata, so it does not count as a read.
 */

import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const revalidate = 300;

const apiOrigin = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000').replace(/\/$/, '');

type Article = { slug: string; title: string; excerpt: string | null; coverImage: string | null; publishedAt: string; tags: string[]; author?: { firstName?: string; lastName?: string; displayName?: string | null } };

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const res = await fetch(`${apiOrigin}/api/blog/${encodeURIComponent(slug)}`, { headers: { 'x-athena-purpose': 'metadata' }, next: { revalidate } });
    if (!res.ok) return { title: 'Article not found | ATHENA', robots: { index: false } };
    const article = ((await res.json()) as { data?: Article }).data;
    if (!article) return { title: 'Article not found | ATHENA', robots: { index: false } };
    const description = article.excerpt || undefined;
    const author = article.author?.displayName || [article.author?.firstName, article.author?.lastName].filter(Boolean).join(' ') || undefined;
    return {
      title: `${article.title} | ATHENA`,
      description,
      alternates: { canonical: `/blog/${article.slug}` },
      openGraph: {
        type: 'article',
        title: article.title,
        description,
        url: `/blog/${article.slug}`,
        publishedTime: article.publishedAt,
        authors: author ? [author] : undefined,
        tags: article.tags,
        images: article.coverImage ? [{ url: article.coverImage }] : undefined,
      },
      twitter: { card: article.coverImage ? 'summary_large_image' : 'summary', title: article.title, description },
    };
  } catch {
    return { title: 'ATHENA Blog' };
  }
}

export default function ArticleLayout({ children }: { children: ReactNode }) {
  return children;
}
