import Link from 'next/link';
import { ArrowRight, TrendingUp, Briefcase, Sparkles } from 'lucide-react';

export default function SalaryInsightsPage() {
  return (
    <div className="container mx-auto max-w-5xl px-4 py-12">
      <div className="flex items-center gap-2 text-primary-600">
        <TrendingUp className="h-5 w-5" />
        <span className="text-sm font-semibold uppercase tracking-wider">Salary Insights</span>
      </div>
      <h1 className="mt-3 text-3xl font-bold">Benchmark compensation</h1>
      <p className="mt-2 text-muted-foreground">
        Compare roles, locations, and seniority to plan your next move.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Link href="/jobs" className="group rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 hover:shadow-md transition">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary-600">
            <Briefcase className="h-4 w-4" /> Explore roles
          </div>
          <p className="mt-2 text-sm text-muted-foreground">See salary ranges attached to open roles.</p>
          <span className="mt-3 inline-flex items-center gap-2 text-primary-600 text-sm font-medium">
            View jobs <ArrowRight className="h-4 w-4" />
          </span>
        </Link>

        <Link href="/dashboard/ai/career-path" className="group rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 hover:shadow-md transition">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary-600">
            <Sparkles className="h-4 w-4" /> Career path AI
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Forecast salary growth across milestones.</p>
          <span className="mt-3 inline-flex items-center gap-2 text-primary-600 text-sm font-medium">
            Open AI tool <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
      </div>
    </div>
  );
}
