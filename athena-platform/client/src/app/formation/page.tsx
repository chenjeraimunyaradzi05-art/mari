import Link from 'next/link';
import { ArrowRight, Building2, Sparkles, Wallet } from 'lucide-react';

export default function FormationPage() {
  return (
    <div className="container mx-auto max-w-5xl px-4 py-12">
      <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
        <Building2 className="h-5 w-5" />
        <span className="text-sm font-semibold uppercase tracking-wider">Formation</span>
      </div>
      <h1 className="mt-3 text-3xl font-bold">Launch your business</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-400">
        Register your business, manage compliance, and unlock funding options.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Link href="/dashboard/formation" className="group rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 hover:shadow-md transition">
          <div className="flex items-center gap-2 text-sm font-semibold text-rose-600 dark:text-rose-400">
            <Sparkles className="h-4 w-4" /> Formation Studio
          </div>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Start a new registration or track progress.</p>
          <span className="mt-3 inline-flex items-center gap-2 text-rose-600 dark:text-rose-400 text-sm font-medium">
            Open studio <ArrowRight className="h-4 w-4" />
          </span>
        </Link>

        <Link href="/finances" className="group rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 hover:shadow-md transition">
          <div className="flex items-center gap-2 text-sm font-semibold text-rose-600 dark:text-rose-400">
            <Wallet className="h-4 w-4" /> Business finances
          </div>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Track expenses and plan cash flow.</p>
          <span className="mt-3 inline-flex items-center gap-2 text-rose-600 dark:text-rose-400 text-sm font-medium">
            View finances <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
      </div>
    </div>
  );
}
