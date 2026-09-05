'use client';

/**
 * A quiet pointer to Safe Mode from the safety plan page, so someone
 * building a plan learns the platform can also hide her, warn her people
 * and get her off the screen in one tap.
 */

import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

export function SafeModeBanner() {
  return (
    <Link
      href="/dashboard/safety"
      className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-100"
    >
      <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0" />
      <span>
        <span className="font-semibold">Safe Mode</span> hides you from search, closes your messages, keeps notifications vague, and
        adds a quick-exit button and a safety alert to your emergency contacts. Set it up here.
      </span>
    </Link>
  );
}
