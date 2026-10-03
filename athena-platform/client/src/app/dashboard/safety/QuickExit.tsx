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
 *
 * What it does and does not do. The button, or the Escape key pressed twice
 * quickly, replaces the page she is on with an ordinary one, so Back from
 * wherever she lands does not return to ATHENA. No website can clear the
 * browser's history list: pages she visited earlier are still in it. Clearing
 * the history, or browsing in a private window, is the only thing that
 * removes those, and the pages that offer this say so rather than promise it.
 */

import { useCallback, useEffect, useId, useSyncExternalStore } from 'react';
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
  exitNavigation.replace(url || DEFAULT_EXIT_URL);
}

/**
 * The one place the browser is told to leave. It exists so that a test can see
 * where a press of the exit button goes: a test browser cannot navigate, and
 * its location cannot be replaced, so without this the one thing the button is
 * for would be the one thing no test could check.
 */
export const exitNavigation = {
  replace: (url: string): void => window.location.replace(url),
};

type QuickExitSettings = { safeExitEnabled: boolean; safeExitUrl: string };

/**
 * How soon the second Escape has to follow the first. Long enough for a hand that
 * is shaking, short enough that an Escape pressed to close a menu and another
 * pressed a moment later for something else are not taken for it.
 */
export const DOUBLE_ESCAPE_MS = 700;

/**
 * The exit, wired to the member's own setting.
 *
 * `enabled` is whether she has turned Escape-to-leave on. The button is shown
 * regardless of that flag on the safety surfaces — a woman who has never
 * opened the DV settings still deserves a way off the page — and so is a second
 * way to leave by keyboard: Escape pressed twice quickly, on any page that carries
 * the button, whether or not she is signed in or has opened her settings. A woman
 * who is reading about safety with somebody behind her has not turned anything
 * on. A single Escape leaves only when she asked for that, because Escape has
 * other jobs in a form and silently hijacking it would be its own surprise.
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
    let lastEscapeAt = 0;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (escapeEnabled) {
        exit();
        return;
      }
      // Holding the key down repeats it, and an Escape that cancels an input
      // method's composition is not meant for us.
      if (event.repeat || event.isComposing) return;
      const now = Date.now();
      if (now - lastEscapeAt <= DOUBLE_ESCAPE_MS) {
        lastEscapeAt = 0;
        exit();
        return;
      }
      lastEscapeAt = now;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [escapeEnabled, exit]);

  return { exit, exitUrl, escapeEnabled };
}

/*
 * One floating exit on screen, however many places ask for one.
 *
 * The floating button is mounted by section layouts (wellness) and by single
 * pages (the public wellness and housing pages, the housing plan), and the
 * dashboard layout is meant to carry one for every page beneath it. Without
 * this, a page under two of those would stack two identical buttons in the
 * same corner — harmless to press, but a second copy of the one control she
 * must find without looking is a second thing to doubt. Every floating
 * instance registers here and only the first one registered draws itself; if
 * that one unmounts, the next takes over, so the corner is never left empty
 * while any of them is on the page.
 */
let floatingClaims: Record<string, string[]> = {};
const floatingListeners = new Set<() => void>();

function announceFloating(): void {
  floatingListeners.forEach((listener) => listener());
}

function subscribeFloating(listener: () => void): () => void {
  floatingListeners.add(listener);
  return () => {
    floatingListeners.delete(listener);
  };
}

const noFloatingClaimOnServer = (): string | undefined => undefined;

/** Test-only: forget every claim, so one test's buttons do not decide the next's. */
export function resetFloatingExitClaims(): void {
  floatingClaims = {};
  announceFloating();
}

/**
 * Whether this floating instance is the one that draws. Before any claim is
 * registered (the first render) every instance draws, so the exit is never
 * missing even for a frame; once they have registered, only the first does.
 *
 * `slot` names the corner this control keeps. The quick exit and the Emergency
 * help button each hold a slot of their own, so a layout and a page that both
 * carry the same control draw it once, and neither crowds the other out.
 */
export function useDrawsFloatingSlot(slot: string, active: boolean): boolean {
  const id = useId();
  useEffect(() => {
    if (!active) return;
    floatingClaims = { ...floatingClaims, [slot]: [...(floatingClaims[slot] ?? []), id] };
    announceFloating();
    return () => {
      floatingClaims = { ...floatingClaims, [slot]: (floatingClaims[slot] ?? []).filter((claim) => claim !== id) };
      announceFloating();
    };
  }, [active, id, slot]);
  const first = useSyncExternalStore(subscribeFloating, () => floatingClaims[slot]?.[0], noFloatingClaimOnServer);
  return !active || first === undefined || first === id;
}

function useDrawsFloatingExit(active: boolean): boolean {
  return useDrawsFloatingSlot('exit', active);
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
  const draws = useDrawsFloatingExit(variant === 'floating');

  if (!draws) return null;

  return (
    <button
      type="button"
      onClick={exit}
      title={
        escapeEnabled
          ? 'Leaves ATHENA now. The Escape key does the same.'
          : 'Leaves ATHENA now. Pressing the Escape key twice quickly does the same.'
      }
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
