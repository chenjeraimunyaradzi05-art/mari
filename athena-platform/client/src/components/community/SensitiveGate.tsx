'use client';

import { useState } from 'react';
import { EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * A post the author marked sensitive is blurred until the reader chooses to
 * see it. The choice is per post and per page view: nothing is remembered,
 * so a reader who scrolls past never has the content forced on them again.
 */
interface SensitiveGateProps {
  active: boolean;
  children: React.ReactNode;
  className?: string;
  label?: string;
}

export function SensitiveGate({ active, children, className, label = 'The author marked this as sensitive' }: SensitiveGateProps) {
  const [revealed, setRevealed] = useState(false);
  if (!active || revealed) return <>{children}</>;

  return (
    <div className={cn('relative overflow-hidden rounded-lg', className)}>
      <div className="pointer-events-none select-none blur-lg" aria-hidden>
        {children}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/60 p-4 text-center dark:bg-slate-900/60">
        <EyeOff className="h-5 w-5 text-slate-500" />
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Sensitive content</p>
        <p className="max-w-xs text-xs text-slate-500 dark:text-slate-400">{label}</p>
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="mt-1 rounded-full border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
        >
          Show
        </button>
      </div>
    </div>
  );
}

export default SensitiveGate;
