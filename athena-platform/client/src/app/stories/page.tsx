import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BookOpen, CircleDashed } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Stories | ATHENA',
  description: 'Stories from the people you follow, and stories from members about what changed for them.',
};

// "Stories" means two different things here, and this route used to pick one
// for everybody: it was a bare redirect to the blog, because the public pages
// use "member stories" for success stories. A member who typed /stories
// looking for the 24-hour photos and clips at the top of her feed landed on a
// blog post instead, with nothing to say she was in the wrong place. So the
// route names both and lets her choose.
const TILES = [
  {
    href: '/feed',
    icon: CircleDashed,
    title: 'Stories from people you follow',
    body: 'The photos and clips that last 24 hours are in the Stories box at the top of the feed. Add yours with its Photo or Video button.',
    cta: 'Open the feed',
  },
  {
    href: '/blog',
    icon: BookOpen,
    title: 'Member stories',
    body: 'Women on the platform in their own words: the job, the business, the move, and what actually changed.',
    cta: 'Read them on the blog',
  },
];

export default function StoriesPage() {
  return (
    <div className="container mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-bold">Stories</h1>
      <p className="mt-2 text-muted-foreground">Two kinds live on ATHENA. Which were you looking for?</p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {TILES.map((tile) => (
          <Link
            key={tile.href}
            href={tile.href}
            className="group rounded-xl border border-slate-200 bg-white p-5 transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-primary-600">
              <tile.icon className="h-4 w-4" aria-hidden /> {tile.title}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{tile.body}</p>
            <span className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary-600">
              {tile.cta} <ArrowRight className="h-4 w-4" aria-hidden />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
