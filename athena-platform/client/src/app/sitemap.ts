/**
 * The sitemap, built from what the site actually has.
 *
 * It used to be a static file of eight addresses under a domain the
 * platform does not use. It now lists the public pages, every published
 * article and every open job, under the configured site URL, and is rebuilt
 * hourly. If the API cannot be reached at build time the static pages still
 * go out.
 */

import type { MetadataRoute } from 'next';

export const revalidate = 3600;

const siteUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
const apiOrigin = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000').replace(/\/$/, '');

type Frequency = NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>;

/** Public pages, with how often they tend to change and how much they matter. */
const STATIC: Array<[string, Frequency, number]> = [
  ['/', 'daily', 1],
  ['/jobs', 'daily', 0.9],
  ['/blog', 'daily', 0.8],
  ['/courses', 'weekly', 0.8],
  ['/mentors', 'weekly', 0.8],
  ['/events', 'weekly', 0.7],
  ['/communities', 'weekly', 0.7],
  ['/apprenticeships', 'weekly', 0.7],
  ['/learning', 'weekly', 0.7],
  ['/certifications', 'weekly', 0.6],
  ['/skills-marketplace', 'weekly', 0.6],
  ['/salary-insights', 'weekly', 0.6],
  ['/pricing', 'monthly', 0.8],
  ['/about', 'monthly', 0.7],
  ['/team', 'monthly', 0.5],
  ['/press', 'monthly', 0.5],
  ['/impact', 'monthly', 0.5],
  ['/careers', 'monthly', 0.5],
  ['/business', 'monthly', 0.6],
  ['/formation', 'monthly', 0.6],
  ['/finances', 'monthly', 0.6],
  ['/capital', 'monthly', 0.6],
  ['/grants', 'monthly', 0.6],
  ['/accelerator', 'monthly', 0.5],
  ['/growth', 'monthly', 0.5],
  ['/ecosystem', 'monthly', 0.5],
  ['/discover', 'monthly', 0.5],
  ['/skills', 'monthly', 0.5],
  ['/mentorship', 'monthly', 0.6],
  ['/mentor-agreement', 'yearly', 0.3],
  ['/rfps', 'monthly', 0.4],
  ['/vendors', 'monthly', 0.4],
  ['/sounds', 'monthly', 0.3],
  ['/developers', 'monthly', 0.4],
  ['/changelog', 'weekly', 0.4],
  ['/help', 'monthly', 0.6],
  ['/safety-center', 'monthly', 0.6],
  ['/trust', 'monthly', 0.5],
  ['/status', 'daily', 0.3],
  ['/contact', 'yearly', 0.4],
  ['/contact-sales', 'yearly', 0.4],
  ['/waitlist', 'monthly', 0.5],
  ['/privacy', 'yearly', 0.3],
  ['/terms', 'yearly', 0.3],
  ['/cookies', 'yearly', 0.2],
  ['/accessibility', 'yearly', 0.2],
];

async function fetchPages<T>(path: string, maxPages = 10): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const res = await fetch(`${apiOrigin}/api${path}${path.includes('?') ? '&' : '?'}page=${page}&limit=100`, { next: { revalidate } });
    if (!res.ok) break;
    const json = (await res.json()) as { data?: T[]; pagination?: { pages?: number } };
    const items = Array.isArray(json.data) ? json.data : [];
    out.push(...items);
    if (items.length === 0 || page >= (json.pagination?.pages ?? 1)) break;
  }
  return out;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = STATIC.map(([path, changeFrequency, priority]) => ({ url: `${siteUrl}${path}`, changeFrequency, priority }));

  try {
    const articles = await fetchPages<{ slug: string; publishedAt?: string }>('/blog');
    for (const a of articles) {
      entries.push({ url: `${siteUrl}/blog/${encodeURIComponent(a.slug)}`, lastModified: a.publishedAt ? new Date(a.publishedAt) : undefined, changeFrequency: 'monthly', priority: 0.6 });
    }
  } catch {
    // The static pages still go out.
  }

  try {
    const jobs = await fetchPages<{ id: string; updatedAt?: string }>('/jobs');
    for (const job of jobs) {
      entries.push({ url: `${siteUrl}/jobs/${encodeURIComponent(job.id)}`, lastModified: job.updatedAt ? new Date(job.updatedAt) : undefined, changeFrequency: 'weekly', priority: 0.6 });
    }
  } catch {
    // As above.
  }

  return entries;
}
