'use client';

/**
 * The next step on the financial roadmap and the months of expenses the
 * cash covers, in one line, for the finance hub and the health score
 * page. Quiet when there is no session to read a roadmap for.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ListChecks } from 'lucide-react';
import { strategyApi } from '@/lib/strategy-api';

type Roadmap = { steps: Array<{ key: string; title: string; status: string; href: string; detail: string }>; completed: number; total: number; personalRunwayMonths: number | null };

export function RoadmapStrip() {
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  useEffect(() => {
    strategyApi.roadmap().then((r) => setRoadmap(r.data?.data ?? null)).catch(() => setRoadmap(null));
  }, []);
  if (!roadmap) return null;
  const next = roadmap.steps.find((s) => s.status === 'next') ?? roadmap.steps.find((s) => s.status === 'in_progress');
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-rose-100 bg-rose-50/60 p-4 dark:border-rose-900/40 dark:bg-rose-900/10 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <ListChecks className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
        <div>
          <p className="text-sm font-medium text-slate-900 dark:text-white">
            {next ? `Next on your roadmap: ${next.title}` : 'Every step on your roadmap is in place'}
            <span className="ml-2 text-xs font-normal text-slate-500">{roadmap.completed} of {roadmap.total} done{roadmap.personalRunwayMonths !== null ? ` · cash covers ${roadmap.personalRunwayMonths} months` : ''}</span>
          </p>
          {next && <p className="text-xs text-slate-600 dark:text-slate-400">{next.detail}</p>}
        </div>
      </div>
      <Link href={next?.href ?? '/dashboard/finance/invest#roadmap'} className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-rose-600 hover:underline dark:text-rose-400">
        {next ? 'Do it' : 'See the roadmap'} <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
