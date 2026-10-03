'use client';

/**
 * The one notice a member sees when a part of ATHENA turns her away on the
 * minimum age, with the way forward beside it.
 *
 * Whichever button she pressed shows its own error, in the server's words; this
 * is the part that was missing: where to go. A member whose account has no date
 * of birth is sent to the form that collects it, and once she has answered she
 * carries on. One whose recorded date is under the minimum is sent to us, because
 * there is nothing for her to fill in. It stays until she dismisses it, so it is
 * not gone before she has read it, and it is a single notice however many requests
 * were refused at once.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { AGE_GATE_CLEARED_EVENT, AGE_GATE_REFUSAL_EVENT, type AgeGateRefusal } from '@/lib/age-gate-refusal';

export function AgeGateRefusalNotice() {
  const [refusal, setRefusal] = useState<AgeGateRefusal | null>(null);

  useEffect(() => {
    const onRefusal = (event: Event) => {
      const detail = (event as CustomEvent<AgeGateRefusal>).detail;
      if (detail?.message) setRefusal(detail);
    };
    // Her date of birth was saved: a notice asking for it is now untrue. One that
    // says the account is under the minimum age is not answered by this, so it stays.
    const onCleared = () => setRefusal((current) => (current?.kind === 'DATE_REQUIRED' ? null : current));
    window.addEventListener(AGE_GATE_REFUSAL_EVENT, onRefusal);
    window.addEventListener(AGE_GATE_CLEARED_EVENT, onCleared);
    return () => {
      window.removeEventListener(AGE_GATE_REFUSAL_EVENT, onRefusal);
      window.removeEventListener(AGE_GATE_CLEARED_EVENT, onCleared);
    };
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
          {refusal.kind === 'UNDER_AGE' ? 'Contact us' : 'Add my date of birth'}
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
