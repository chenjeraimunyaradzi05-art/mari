'use client';

/**
 * The one notice a member sees when a part of ATHENA turns her away on the
 * women-only check, with the way forward beside it.
 *
 * Whichever button she pressed shows its own error, in the server's words; this
 * is the part that was missing: where to go. A member who has not completed the
 * check is sent to where she can, and one a reviewer refused is sent to the
 * appeal, not to a form that would only ask her to do it again. It stays until
 * she dismisses it, so it is not gone before she has read it, and it is a
 * single notice however many requests were refused at once.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { WOMAN_GATE_REFUSAL_EVENT, type WomanGateRefusal } from '@/lib/woman-gate-refusal';

export function WomanGateRefusalNotice() {
  const [refusal, setRefusal] = useState<WomanGateRefusal | null>(null);

  useEffect(() => {
    const onRefusal = (event: Event) => {
      const detail = (event as CustomEvent<WomanGateRefusal>).detail;
      if (detail?.message) setRefusal(detail);
    };
    window.addEventListener(WOMAN_GATE_REFUSAL_EVENT, onRefusal);
    return () => window.removeEventListener(WOMAN_GATE_REFUSAL_EVENT, onRefusal);
  }, []);

  if (!refusal) return null;

  return (
    <div
      role="alert"
      className="mx-4 mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100"
    >
      <div className="flex-1">
        <p>{refusal.message}</p>
        <Link
          href={refusal.setup}
          className="mt-2 inline-flex min-h-[44px] items-center font-semibold underline focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
        >
          {refusal.kind === 'REJECTED' ? 'Appeal this decision' : 'Complete the women-only check'}
        </Link>
      </div>
      <button
        type="button"
        onClick={() => setRefusal(null)}
        aria-label="Dismiss this notice"
        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 dark:hover:bg-amber-900/40"
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}
