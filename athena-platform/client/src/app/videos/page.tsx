import Link from 'next/link';
import { ArrowRight, Play, Sparkles, Video } from 'lucide-react';

export default function VideosPage() {
  return (
    <div className="container mx-auto max-w-5xl px-4 py-12">
      <div className="flex items-center gap-2 text-primary-600">
        <Play className="h-5 w-5" />
        <span className="text-sm font-semibold uppercase tracking-wider">Videos</span>
      </div>
      <h1 className="mt-3 text-3xl font-bold">Short-form career video</h1>
      <p className="mt-2 text-muted-foreground">
        Watch quick tips, founder stories, and mentor guidance in under two minutes.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Link href="/explore" className="group rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 hover:shadow-md transition">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary-600">
            <Sparkles className="h-4 w-4" /> Explore feed
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Swipe through trending video highlights.</p>
          <span className="mt-3 inline-flex items-center gap-2 text-primary-600 text-sm font-medium">
            Open explore <ArrowRight className="h-4 w-4" />
          </span>
        </Link>

        <Link href="/dashboard/create-post" className="group rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 hover:shadow-md transition">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary-600">
            <Video className="h-4 w-4" /> Share a video
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Upload your tips or behind-the-scenes journey.</p>
          <span className="mt-3 inline-flex items-center gap-2 text-primary-600 text-sm font-medium">
            Create video <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
      </div>
    </div>
  );
}
