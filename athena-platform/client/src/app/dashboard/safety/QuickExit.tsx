'use client';

/**
 * Quick exit: leave ATHENA for a harmless page, in one keystroke or one tap.
 *
 * The mechanism was written once and used once. It was declared inside the
 * Safety page and bound to Escape there, and nowhere else — so the pages a
 * woman is most likely to be looking at when someone walks in behind her had
 * no way off them. Browsing DV-safe housing, writing down the addresses she
 * could go to, reading the crisis lines: none of those had it. The one page
 * that did was the settings page where she turned it on.
 *
 * It lives here as a hook and a button so every page she uses can carry it,
 * reading the same stored setting and the same address she chose. Pages
 * import it from the Safety route because that is where the feature belongs;
 * it is a plain module, not a route.
 */

import { useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DoorOpen } from 'lucide-react';
import { dvSafeApi } from '@/lib/api';
import { useAuthStore } from '@/lib/hooks';
import { cn } from '@/lib/utils';

/** Where she goes if she has not chosen somewhere. A search engine is unremarkable on any screen. */
export const DEFAULT_EXIT_URL = 'https://www.google.com';

/**
 * Leaves for a harmless page, and makes Back come here no more.
 *
 * The history entry is replaced first, so that even if the navigation itself
 * is slow the current URL is no longer the one in the address bar, and Back
 * from wherever she lands does not return to ATHENA.
 */
export function quickExit(url: string): void {
  try {
    window.history.replaceState(null, '', '/');
  } catch {
    // Some browsers refuse; leaving still matters more.
  }
  window.location.replace(url || DEFAULT_EXIT_URL);
}

type QuickExitSettings = { safeExitEnabled: boolean; safeExitUrl: string };

/**
 * The exit, wired to the member's own setting.
 *
 * `enabled` is whether she has turned Escape-to-leave on. The button is shown
 * regardless of that flag on the safety surfaces — a woman who has never
 * opened the DV settings still deserves a way off the page — but the keyboard
 * shortcut only binds when she asked for it, because Escape has other jobs in
 * a form and silently hijacking it would be its own surprise.
 *
 * Signed-out visitors never make the request; they get the default address.
 */
export function useQuickExit(): { exit: () => void; exitUrl: string; escapeEnabled: boolean } {
  const { isAuthenticated, isLoading } = useAuthStore();

  const settings = useQuery({
    queryKey: ['dv-safe-settings'],
    queryFn: dvSafeApi.getSettings,
    enabled: isAuthenticated && !isLoading,
    select: (response) => response.data as QuickExitSettings,
    // Her exit address changes rarely and every page that carries the button
    // asks for it, so the answer is shared rather than refetched per screen.
    staleTime: 5 * 60 * 1000,
  });

  const exitUrl = settings.data?.safeExitUrl || DEFAULT_EXIT_URL;
  const escapeEnabled = Boolean(settings.data?.safeExitEnabled);
  const exit = useCallback(() => quickExit(exitUrl), [exitUrl]);

  useEffect(() => {
    if (!escapeEnabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') exit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [escapeEnabled, exit]);

  return { exit, exitUrl, escapeEnabled };
}

/**
 * The button itself. `variant` is only about where it sits: `inline` for a
 * page header that has somewhere to put it, `floating` for a page that does
 * not and needs it pinned within reach of a thumb.
 */
export function QuickExitButton({
  variant = 'inline',
  className,
}: {
  variant?: 'inline' | 'floating';
  className?: string;
}) {
  const { exit, escapeEnabled } = useQuickExit();

  return (
    <button
      type="button"
      onClick={exit}
      title={escapeEnabled ? 'Leaves ATHENA now. The Escape key does the same.' : 'Leaves ATHENA now.'}
      className={cn(
        'inline-flex items-center gap-2 rounded-xl bg-rose-600 font-semibold text-white shadow hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2',
        variant === 'floating'
          ? 'fixed bottom-5 right-5 z-40 px-4 py-3 text-sm shadow-lg'
          : 'px-5 py-3 text-sm',
        className
      )}
    >
      <DoorOpen className="h-5 w-5" /> Quick exit
    </button>
  );
}
