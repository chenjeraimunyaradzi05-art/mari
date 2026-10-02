'use client';

/**
 * Emergency help: one labelled button on every page a signed-in member sees,
 * which opens the numbers to ring and a way off the screen.
 *
 * The crisis lines sat on the Safety page, in the public footer and inside the
 * wellness pages, and the quick exit on the pages built for it. A woman who
 * needed either from the page she was already on, the feed, her messages, a
 * job, had to know the Safety page existed and find it first. This is that
 * entry, on all of them.
 *
 * What it holds to:
 *   - It asks nobody. The lines are in the code (lib/crisis-lines.ts), so it
 *     opens at once with the API down, on a bad signal, or while the page under
 *     it is still loading. Only the quick exit's address is read from her
 *     settings, and that falls back to a search engine if the read fails.
 *   - It is a button with a word on it, not a gesture and not a hidden corner.
 *     The word is "Emergency help": plain, and not "panic", which would be read
 *     by anyone looking over her shoulder.
 *   - It does not lie about what it can do. ATHENA cannot send help to anyone;
 *     the dialog says so, and says to ring 000.
 *   - A fault in it cannot take the page down, and cannot leave her without the
 *     one number that matters: the boundary below falls back to a plain link to
 *     000.
 */

import { Component, useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DoorOpen, Flag, LifeBuoy, Phone, ShieldCheck, X } from 'lucide-react';
import { useDrawsFloatingSlot, useQuickExit } from '@/app/dashboard/safety/QuickExit';
import { useAuthStore } from '@/lib/hooks';
import { crisisLinesFor, telHref } from '@/lib/crisis-lines';
import { SafetyAlertSection } from './SafetyAlert';
import { cn } from '@/lib/utils';

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** The quick exit, kept apart so that her settings are asked for only while the dialog is open. */
function DialogQuickExit() {
  const { exit } = useQuickExit();
  return (
    <button
      type="button"
      onClick={exit}
      className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2"
    >
      <DoorOpen className="h-5 w-5" aria-hidden="true" /> Quick exit
    </button>
  );
}

function EmergencyDialog({ region, onClose }: { region?: string | null; onClose: () => void }) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const { lines, regionLabel, elsewhere } = crisisLinesFor(region);

  // Focus goes into the dialog on open, so a keyboard or a screen reader is
  // taken to it, and Tab stays inside it until it closes.
  useEffect(() => {
    const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
  }, []);

  // Escape closes it wherever focus is. It is not stopped from travelling on:
  // a member who has turned on "Escape leaves ATHENA" in her safety settings
  // meant it for every screen, and a dialog that swallowed it would be the one
  // place her reflex did not work.
  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [onClose]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;
    const focusable = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    if (focusable.length === 0) return;
    const firstEl = focusable[0];
    const lastEl = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === firstEl) {
      event.preventDefault();
      lastEl.focus();
    } else if (!event.shiftKey && document.activeElement === lastEl) {
      event.preventDefault();
      firstEl.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center print:hidden"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
            <LifeBuoy className="h-5 w-5 text-rose-600" aria-hidden="true" /> Emergency help
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close emergency help"
            className="-m-2 inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
          If you are in danger now, call the emergency number first. ATHENA cannot send anyone to you; these are lines run by other services, answered by people.
        </p>

        {lines.length > 0 && (
          <ul className="mt-4 space-y-2" aria-label={`Phone lines in ${regionLabel}`}>
            {lines.map((line) => (
              <li key={line.key}>
                <a
                  href={telHref(line.phone)}
                  className="flex min-h-[44px] items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-slate-900 hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-500 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-white dark:hover:bg-rose-900/30"
                >
                  <Phone className="h-5 w-5 flex-shrink-0 text-rose-600" aria-hidden="true" />
                  <span>
                    <span className="block text-sm font-semibold">
                      {line.name} <span className="text-rose-700 dark:text-rose-300">{line.phone}</span>
                    </span>
                    <span className="block text-xs text-slate-600 dark:text-slate-400">{line.description}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}

        {elsewhere && <p className="mt-3 text-xs text-slate-600 dark:text-slate-400">{elsewhere}</p>}

        {/* Her own safety alert, for the member who set it up: there only when it can
            work, and it asks once more before it sends. */}
        <SafetyAlertSection />

        <div className="mt-4">
          <DialogQuickExit />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Leaves ATHENA at once, for a page that looks ordinary.</p>
        </div>

        <div className="mt-4 grid gap-2 border-t border-slate-200 pt-4 dark:border-slate-700 sm:grid-cols-2">
          <Link
            href="/report"
            onClick={onClose}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-rose-500 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Flag className="h-4 w-4" aria-hidden="true" /> Report a problem
          </Link>
          <Link
            href="/safety-center"
            onClick={onClose}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-rose-500 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Safety centre
          </Link>
        </div>
      </div>
    </div>
  );
}

function EmergencyHelpControl({ region, className }: { region?: string | null; className?: string }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const draws = useDrawsFloatingSlot('emergency-help', true);

  const close = useCallback(() => {
    setOpen(false);
    // Back to the button she pressed, so a keyboard is not left at the top of the page.
    triggerRef.current?.focus();
  }, []);

  if (!draws) return null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={cn(
          'fixed bottom-[4.75rem] right-5 z-40 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm font-semibold text-rose-700 shadow-lg hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 dark:border-rose-900/60 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-slate-800',
          className
        )}
      >
        <LifeBuoy className="h-5 w-5" aria-hidden="true" /> Emergency help
      </button>
      {open && <EmergencyDialog region={region} onClose={close} />}
    </>
  );
}

/**
 * If anything in the control fails, what is left is the one thing that must
 * not be: a plain link that dials the emergency number.
 */
class EmergencyBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <a
        href="tel:000"
        className="fixed bottom-[4.75rem] right-5 z-40 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white shadow-lg print:hidden"
      >
        Emergency 000
      </a>
    );
  }
}

export function EmergencyHelp({ region, className }: { region?: string | null; className?: string }) {
  return (
    <EmergencyBoundary>
      <EmergencyHelpControl region={region} className={className} />
    </EmergencyBoundary>
  );
}

/**
 * Every page a signed-in member can be on, not only the ones under the
 * dashboard shell. A good half of what she uses lives outside it (the reels,
 * jobs, events, search, a live room, a profile or post she followed a link to),
 * and the shell's button is not on any of them. The root layout mounts this
 * once; where a layout or a page below it carries the button as well, the claim
 * registry draws the one and the corner is never doubled.
 *
 * A visitor with no account is not shown it here: the public pages carry the
 * numbers in the footer, and the pages built for someone in trouble (the report
 * form, the appeal form, the wellness and housing pages) mount the button
 * themselves for anyone.
 */
export function SignedInEmergencyHelp() {
  const { isAuthenticated, user } = useAuthStore();
  const pathname = usePathname();
  if (!isAuthenticated) return null;
  return (
    <EmergencyHelp
      region={user?.region}
      // The reels' action buttons stand in this corner of the screen, from a
      // hand's width above the bottom; the button drops below them there.
      className={cn('print:hidden', pathname?.startsWith('/explore') && 'bottom-4')}
    />
  );
}
