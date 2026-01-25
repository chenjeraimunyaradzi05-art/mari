import Link from 'next/link';
import { ArrowRight, Users, Sparkles, MessageCircle } from 'lucide-react';

export default function CommunitiesPage() {
  return (
    <div className="container mx-auto max-w-5xl px-4 py-12">
      <div className="flex items-center gap-2 text-primary-600">
        <Users className="h-5 w-5" />
        <span className="text-sm font-semibold uppercase tracking-wider">Communities</span>
      </div>
      <h1 className="mt-3 text-3xl font-bold">Find your people</h1>
      <p className="mt-2 text-muted-foreground">
        Join interest-based communities, share insights, and grow together.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Link href="/community" className="group rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 hover:shadow-md transition">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary-600">
            <Sparkles className="h-4 w-4" /> Community hub
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Browse public spaces and curated circles.</p>
          <span className="mt-3 inline-flex items-center gap-2 text-primary-600 text-sm font-medium">
            Visit hub <ArrowRight className="h-4 w-4" />
          </span>
        </Link>

        <Link href="/dashboard/community" className="group rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 hover:shadow-md transition">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary-600">
            <MessageCircle className="h-4 w-4" /> Member feed
          </div>
          <p className="mt-2 text-sm text-muted-foreground">See updates from the people you follow.</p>
          <span className="mt-3 inline-flex items-center gap-2 text-primary-600 text-sm font-medium">
            Open feed <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
      </div>
    </div>
  );
}
