import Link from 'next/link';
import { ArrowRight, Users, Sparkles, MessageCircle } from 'lucide-react';

export default function NetworkPage() {
  return (
    <div className="container mx-auto max-w-5xl px-4 py-12">
      <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
        <Users className="h-5 w-5" />
        <span className="text-sm font-semibold uppercase tracking-wider">Network</span>
      </div>
      <h1 className="mt-3 text-3xl font-bold">Grow your network</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-400">
        Connect with mentors, peers, and hiring teams across the ATHENA ecosystem.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Link href="/mentors" className="group rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 hover:shadow-md transition">
          <div className="flex items-center gap-2 text-sm font-semibold text-rose-600 dark:text-rose-400">
            <Sparkles className="h-4 w-4" /> Mentors
          </div>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Find guidance for career moves or leadership growth.</p>
          <span className="mt-3 inline-flex items-center gap-2 text-rose-600 dark:text-rose-400 text-sm font-medium">
            Find mentors <ArrowRight className="h-4 w-4" />
          </span>
        </Link>

        <Link href="/community" className="group rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 hover:shadow-md transition">
          <div className="flex items-center gap-2 text-sm font-semibold text-rose-600 dark:text-rose-400">
            <MessageCircle className="h-4 w-4" /> Community
          </div>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Join discussions and collaborate with peers.</p>
          <span className="mt-3 inline-flex items-center gap-2 text-rose-600 dark:text-rose-400 text-sm font-medium">
            Open community <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
      </div>
    </div>
  );
}
