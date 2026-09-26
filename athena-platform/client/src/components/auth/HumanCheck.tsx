'use client';

/**
 * The check that a sign-up is a person, on the password sign-up form.
 *
 * Registration had nothing on it but a per-address rate limit, so a script
 * rotating addresses could open as many accounts as it liked, each one landing
 * in the women-gate queue for a person to wade through. This is Cloudflare
 * Turnstile: most people never see a puzzle, it sets no tracking cookie, and
 * it does not send her to an advertising company to prove she is human.
 *
 * It renders only when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set, and the server
 * only insists on it when TURNSTILE_SECRET_KEY is set; the two are configured
 * together. When the script cannot load — a blocker, a flaky connection, a
 * policy that does not allow it — the form says so, rather than leaving a
 * button that will be refused for a reason she cannot see.
 */

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';

export const HUMAN_CHECK_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || '';

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

type TurnstileOptions = {
  sitekey: string;
  callback: (token: string) => void;
  'expired-callback'?: () => void;
  'error-callback'?: () => void;
  theme?: 'auto' | 'light' | 'dark';
};

type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileOptions) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      // Allow a later mount to try again rather than caching the failure.
      scriptPromise = null;
      reject(new Error('The sign-up check could not load'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/**
 * `onToken` receives a fresh token when the check passes and null when it
 * lapses or fails. A token is good for one submission; bump `resetKey` after a
 * refused sign-up so she is given a new one.
 */
export function HumanCheck({ onToken, resetKey }: { onToken: (token: string | null) => void; resetKey: number }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable'>('loading');

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!HUMAN_CHECK_SITE_KEY) return;
    let cancelled = false;

    loadScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: HUMAN_CHECK_SITE_KEY,
          theme: 'auto',
          callback: (token) => onTokenRef.current(token),
          'expired-callback': () => onTokenRef.current(null),
          'error-callback': () => onTokenRef.current(null),
        });
        setState('ready');
      })
      .catch(() => {
        if (!cancelled) setState('unavailable');
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (resetKey === 0 || !widgetIdRef.current || !window.turnstile) return;
    onTokenRef.current(null);
    window.turnstile.reset(widgetIdRef.current);
  }, [resetKey]);

  if (!HUMAN_CHECK_SITE_KEY) return null;

  return (
    <div>
      <div ref={containerRef} />
      {state === 'loading' && (
        <p className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading the sign-up check…
        </p>
      )}
      {state === 'unavailable' && (
        <p className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          The check that you are a person could not load, so sign-up cannot go through yet. Check your connection, or
          allow challenges.cloudflare.com if a blocker is on, then reload this page.
        </p>
      )}
    </div>
  );
}
