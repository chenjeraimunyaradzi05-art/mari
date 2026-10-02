'use client';

/**
 * Where else to turn, shown under a report's confirmation for the reasons that
 * have somewhere (lib/report-next-steps). It renders nothing for any other.
 */

import { Phone, ExternalLink } from 'lucide-react';
import { nextStepsFor } from '@/lib/report-next-steps';
import { cn } from '@/lib/utils';

export function ReportNextSteps({ reason, className }: { reason: string | null | undefined; className?: string }) {
  const steps = nextStepsFor(reason);
  if (!steps) return null;

  return (
    <section
      aria-label="Where else to turn"
      className={cn(
        'rounded-xl border border-rose-200 bg-rose-50 p-4 text-left text-sm text-rose-950 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-50',
        className
      )}
    >
      <h3 className="font-semibold">{steps.heading}</h3>
      {steps.paragraphs.map((paragraph) => (
        <p key={paragraph} className="mt-2 leading-6">
          {paragraph}
        </p>
      ))}
      <ul className="mt-3 flex flex-wrap gap-2">
        {steps.links.map((link) => (
          <li key={link.href}>
            <a
              href={link.href}
              {...(link.phone ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-rose-300 bg-white px-3 py-2 font-medium text-rose-800 hover:bg-rose-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:border-rose-800 dark:bg-slate-900 dark:text-rose-100 dark:hover:bg-slate-800"
            >
              {link.phone ? <Phone className="h-4 w-4" aria-hidden="true" /> : <ExternalLink className="h-4 w-4" aria-hidden="true" />}
              {link.label}
              {!link.phone && <span className="sr-only"> (opens in a new tab)</span>}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default ReportNextSteps;
