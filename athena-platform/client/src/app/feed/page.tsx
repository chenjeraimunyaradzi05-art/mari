import Link from 'next/link';
import { ArrowRight, Sparkles, Users, MessageCircle, Play } from 'lucide-react';

export default function FeedPage() {
  return (
    <div className="container mx-auto max-w-5xl px-4 py-12">
      <div className="flex items-center gap-2 text-primary-600">
        <Sparkles className="h-5 w-5" />
        <span className="text-sm font-semibold uppercase tracking-wider">Social</span>
      </div>
      <h1 className="mt-3 text-3xl font-bold">Your Feed</h1>
      <p className="mt-2 text-muted-foreground">
        Catch up on community wins, career insights, and trending conversations.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Link href="/dashboard/community" className="group rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 hover:shadow-md transition">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary-600">
            <Users className="h-4 w-4" /> Community Feed
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Follow updates from your circles and curated topics.</p>
          <span className="mt-3 inline-flex items-center gap-2 text-primary-600 text-sm font-medium">
            Open feed <ArrowRight className="h-4 w-4" />
          </span>
        </Link>

        <Link href="/dashboard/create-post" className="group rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 hover:shadow-md transition">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary-600">
            <MessageCircle className="h-4 w-4" /> Share an update
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Post wins, questions, or helpful resources.</p>
          <span className="mt-3 inline-flex items-center gap-2 text-primary-600 text-sm font-medium">
            Create post <ArrowRight className="h-4 w-4" />
          </span>
        </Link>

        <Link href="/explore" className="group rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 hover:shadow-md transition md:col-span-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary-600">
            <Play className="h-4 w-4" /> Explore videos
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Discover short-form career tips and stories.</p>
          <span className="mt-3 inline-flex items-center gap-2 text-primary-600 text-sm font-medium">
            Browse explore <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
      </div>
    </div>
  );
}
