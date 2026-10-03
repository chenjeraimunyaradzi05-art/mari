'use client';

/**
 * What a member who locked her own account is offered at sign-in.
 *
 * Locking refuses every way of signing in, the right password included, until
 * the link in the email we sent her is used. That email is the only way back,
 * and emails get lost, so sign-in says the account is locked and offers a new
 * one here. It goes to the address on the account whatever is typed, and the
 * route answers the same for every address, so nothing here says whether an
 * address has an account or whether it is locked.
 *
 * A button and not a form, because it sits inside the sign-in form. When the
 * refusal came from Google or Facebook there is no address typed, so it asks
 * for one.
 */

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { RESEND_COOLDOWN_SECONDS } from './CheckYourEmail';

/**
 * Whether a sign-in refusal is the locked-account one. Matches the server's
 * ACCOUNT_LOCKED_MESSAGE (middleware/auth.ts), which keeps these words for this
 * purpose and says nothing about being suspended: it is not a moderation state.
 */
export const isLockedAccountRefusal = (message: string | undefined): boolean =>
  Boolean(message && message.toLowerCase().includes('account is locked'));

type State = 'idle' | 'sending' | 'sent' | 'failed';

export function RequestUnlockLink({ email: knownEmail = '' }: { email?: string }) {
  const [typed, setTyped] = useState('');
  const [state, setState] = useState<State>('idle');
  const [cooldown, setCooldown] = useState(0);
  const email = (knownEmail || typed).trim();

  useEffect(() => {
    setState('idle');
    setCooldown(0);
  }, [knownEmail]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const send = async () => {
    if (!email || state === 'sending' || cooldown > 0) return;
    setState('sending');
    try {
      await api.post('/auth/request-unlock', { email });
      setState('sent');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch {
      setState('failed');
    }
  };

  return (
    <div
      role="group"
      aria-label="Unlock your account"
      className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200"
    >
      <p className="mb-3">
        The unlock link is in the email we sent when you locked your account. Look in your junk folder too. If you
        cannot find it, we can send a new one to the address on your account.
      </p>
      {knownEmail ? null : (
        <input
          type="email"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          // Enter here would otherwise submit the sign-in form it sits inside.
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            void send();
          }}
          placeholder="you@example.com"
          aria-label="Email address of the locked account"
          autoComplete="email"
          className="input mb-3 w-full text-sm"
        />
      )}
      <button
        type="button"
        onClick={() => void send()}
        disabled={!email || state === 'sending' || cooldown > 0}
        className="btn-primary inline-flex min-h-[44px] items-center justify-center px-4 text-sm disabled:cursor-not-allowed disabled:opacity-60"
      >
        {state === 'sending' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        {state === 'sending' ? 'Sending...' : cooldown > 0 ? `Send it again in ${cooldown}s` : 'Email me a new unlock link'}
      </button>
      <div role="status" aria-live="polite" className="mt-2 min-h-[1.25rem]">
        {state === 'sent' && (
          <p className="text-emerald-700 dark:text-emerald-300">
            If that account is locked, a link to unlock it is on its way. It works once, for 24 hours.
          </p>
        )}
        {state === 'failed' && (
          <p className="text-red-700 dark:text-red-300">
            We could not send another just now. Please wait a little and try again.
          </p>
        )}
      </div>
    </div>
  );
}
