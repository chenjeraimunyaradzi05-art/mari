'use client';

/**
 * The one gate every admin screen sits behind.
 *
 * proxy.ts puts /admin behind a session, so a signed-out visitor is sent to
 * sign in. It cannot see a role, though, and until this layout existed there
 * was nothing else: any signed-in member could open /admin/breaches or
 * /admin/compliance, get the page shell, and watch every request on it fail
 * with a 403 — a screen that looked like a broken admin console rather than
 * one she was never meant to open. The API still refuses every piece of data
 * behind these pages on its own; this only stops the shell rendering for
 * somebody it was not built for.
 *
 * Moderators work the report queue, content moderation and appeals, and the
 * admin index shows them a landing for exactly those, so those paths are
 * theirs. Everything else under /admin is the platform admin's alone, which is
 * the same split the server's admin router enforces.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useAuthStore } from '@/lib/hooks';

const MODERATOR_PATHS = ['/admin/moderation', '/admin/content', '/admin/appeals'];

function moderatorMayOpen(pathname: string): boolean {
  return pathname === '/admin' || MODERATOR_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore();
  const pathname = usePathname() ?? '/admin';

  // The session is still being restored: say nothing either way yet, rather
  // than flashing a refusal at an admin whose account has not loaded.
  if (isLoading && !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" aria-label="Checking your access" />
      </div>
    );
  }

  const role = user?.role;
  const allowed = role === 'ADMIN' || (role === 'MODERATOR' && moderatorMayOpen(pathname));

  if (!allowed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <ShieldAlert className="h-14 w-14 text-slate-400" />
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">This part of ATHENA is for staff</h1>
        <p className="max-w-md text-slate-600 dark:text-slate-400">
          {role === 'MODERATOR'
            ? 'Moderators work the report queue, content moderation and appeals. The rest of admin belongs to the platform admins.'
            : 'Your account does not have access to the admin console.'}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {role === 'MODERATOR' ? (
            <Link href="/admin/moderation" className="btn-primary px-4 py-2">
              Report queue
            </Link>
          ) : null}
          <Link href="/dashboard" className="btn-outline px-4 py-2">
            Back to your dashboard
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
