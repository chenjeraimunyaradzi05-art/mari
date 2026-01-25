import Link from 'next/link';
import { ArrowRight, Sparkles, Target, GraduationCap } from 'lucide-react';

export default function SkillsPage() {
  return (
    <div className="container mx-auto max-w-5xl px-4 py-12">
      <div className="flex items-center gap-2 text-primary-600">
        <Target className="h-5 w-5" />
        <span className="text-sm font-semibold uppercase tracking-wider">Skills</span>
      </div>
      <h1 className="mt-3 text-3xl font-bold">Build in-demand skills</h1>
      <p className="mt-2 text-muted-foreground">
        See what hiring teams want and map the fastest path to mastery.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Link href="/skills-marketplace" className="group rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 hover:shadow-md transition">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary-600">
            <Sparkles className="h-4 w-4" /> Skills marketplace
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Identify trending skills and learning paths.</p>
          <span className="mt-3 inline-flex items-center gap-2 text-primary-600 text-sm font-medium">
            Explore skills <ArrowRight className="h-4 w-4" />
          </span>
        </Link>

        <Link href="/dashboard/learn" className="group rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 hover:shadow-md transition">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary-600">
            <GraduationCap className="h-4 w-4" /> Learning dashboard
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Track progress and enroll in new courses.</p>
          <span className="mt-3 inline-flex items-center gap-2 text-primary-600 text-sm font-medium">
            Go to learning <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
      </div>
    </div>
  );
}
