'use client';

/**
 * A footer column that is always open on a wide screen and folds to its
 * heading on a phone, where six open columns of links would be a page of
 * scrolling. The server renders the open form so links are in the HTML.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export function FooterColumn({ title, children }: { title: string; children: ReactNode }) {
  const [wide, setWide] = useState(true);

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)');
    const sync = () => setWide(mql.matches);
    sync();
    mql.addEventListener?.('change', sync);
    return () => mql.removeEventListener?.('change', sync);
  }, []);

  if (wide) {
    return (
      <nav aria-label={title}>
        <h3 className="eyebrow-soft text-rose-500 dark:text-rose-300">{title}</h3>
        <div className="mt-2">{children}</div>
      </nav>
    );
  }

  return (
    <details className="group rounded-xl">
      <summary className="eyebrow-soft focusable flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl py-1.5 text-rose-500 [&::-webkit-details-marker]:hidden dark:text-rose-300">
        {title}
        <ChevronDown className="h-4 w-4 text-rose-400 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <nav aria-label={title} className="pb-2">
        {children}
      </nav>
    </details>
  );
}
