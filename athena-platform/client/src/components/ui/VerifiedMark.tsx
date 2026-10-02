import { BadgeCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The tick beside a member's name when her identity has been checked, by a
 * photo ID check that passed or by a person at ATHENA who looked at what she
 * sent. It is drawn only from the server's `isVerified`, which nothing a member
 * sends can set, and it is not drawn for the other badges: an employer,
 * educator, mentor or creator badge says something different and is not this.
 */
export function VerifiedMark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center text-emerald-600 dark:text-emerald-400', className)} title="Identity verified">
      <BadgeCheck className="h-5 w-5" aria-hidden="true" />
      <span className="sr-only">Identity verified</span>
    </span>
  );
}
