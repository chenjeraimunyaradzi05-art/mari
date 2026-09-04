import Link from 'next/link';
import { ArrowRight, Music, Radio, Sparkles, Video } from 'lucide-react';

const TILES = [
  {
    href: '/explore',
    icon: Sparkles,
    title: 'Explore feed',
    body: 'Swipe through trending video highlights.',
    cta: 'Open explore',
  },
  {
    href: '/live',
    icon: Radio,
    title: 'Live now',
    body: 'Watch members streaming right now, chat and send gifts.',
    cta: 'See who is live',
  },
  {
    href: '/sounds',
    icon: Music,
    title: 'Trending sounds',
    body: 'The audio reels are being made with this week, ready to use.',
    cta: 'Browse sounds',
  },
  {
    href: '/dashboard/creator-studio',
    icon: Video,
    title: 'Share a video',
    body: 'Upload your tips or behind-the-scenes journey.',
    cta: 'Create video',
  },
];

export default function VideosPage() {
  return (
    <div className="container mx-auto max-w-5xl px-4 py-12">
      <div className="flex items-center gap-2 text-primary-600">
        <Video className="h-5 w-5" />
        <span className="text-sm font-semibold uppercase tracking-wider">Videos</span>
      </div>
      <h1 className="mt-3 text-3xl font-bold">Short-form career video</h1>
      <p className="mt-2 text-muted-foreground">
        Watch quick tips, founder stories, and mentor guidance in under two minutes.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {TILES.map((tile) => (
          <Link
            key={tile.href}
            href={tile.href}
            className="group rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 hover:shadow-md transition"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-primary-600">
              <tile.icon className="h-4 w-4" /> {tile.title}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{tile.body}</p>
            <span className="mt-3 inline-flex items-center gap-2 text-primary-600 text-sm font-medium">
              {tile.cta} <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
