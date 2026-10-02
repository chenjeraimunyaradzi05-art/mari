'use client';

/**
 * A new confirmation link, from the three places a member can be stuck without one.
 *
 * Registration opens no session: the link in the email is what lets her sign
 * in, so a link that expired, or an email that never came, has to be something
 * she can fix from where she is stuck. The only resend used to be inside the
 * error state of the verify-email page, which she reaches only by opening an
 * expired link. Sign-in said "Please verify your email before signing in." and
 * stopped there, and the phone app had nothing at all.
 *
 * With an address (the sign-in page already has the one she typed) it is a
 * button, and deliberately not a form: it sits inside the sign-in form, and a
 * form inside a form is not valid HTML. Without one (the expired-link page) it
 * asks for the address, as a form of its own. Either
 * way it goes to the route that answers the same for every address, so it
 * cannot be used to ask whether somebody has an account, and the sentence it
 * shows is true whether or not there was one to send to. A failure is said as
 * a failure: the route only fails on the hourly sending limit or the network,
 * never on "no such account".
 */

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { RESEND_COOLDOWN_SECONDS } from './CheckYourEmail';

/**
 * Whether a sign-in refusal is the unconfirmed-address one. Matches the sentence
 * the server sends (middleware/auth.ts, EMAIL_NOT_VERIFIED_MESSAGE; pinned by
 * server/tests/integration/auth-recovery.test.ts), the same way
 * isSuspendedRefusal matches the suspended one.
 */
export const isUnverifiedEmailRefusal = (message: string | undefined): boolean =>
  Boolean(message && message.toLowerCase().includes('verify your email'));

type ResendState = 'idle' | 'sending' | 'sent' | 'failed';

export function ResendVerification({ email: knownEmail }: { email?: string }) {
  const [typed, setTyped] = useState('');
  const [state, setState] = useState<ResendState>('idle');
  const [cooldown, setCooldown] = useState(0);

  // A new address is a new question: what was said about the last one is not
  // an answer to it.
  useEffect(() => {
    setState('idle');
    setCooldown(0);
  }, [knownEmail]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const address = (knownEmail ?? typed).trim();

  const send = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!address || state === 'sending' || cooldown > 0) return;
    setState('sending');
    try {
      await api.post('/auth/resend-verification', { email: address });
      setState('sent');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch {
      setState('failed');
    }
  };

  const busy = state === 'sending' || cooldown > 0;
  const label =
    state === 'sending' ? 'Sending...' : cooldown > 0 ? `Send it again in ${cooldown}s` : knownEmail ? 'Send me a new link' : 'Resend';

  const Container = knownEmail ? 'div' : 'form';

  return (
    <Container
      {...(knownEmail ? { role: 'group' } : { onSubmit: send })}
      className="text-left"
      aria-label="Get a new confirmation link"
    >
      <p className="mb-2 text-sm text-slate-600 dark:text-slate-400">
        {knownEmail ? 'Did the email not arrive, or has the link expired? We can send a new one.' : 'Link expired? Get a new one.'}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        {knownEmail ? null : (
          <input
            type="email"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder="you@example.com"
            aria-label="Email address"
            autoComplete="email"
            required
            className="input flex-1 text-sm"
          />
        )}
        <button
          type={knownEmail ? 'button' : 'submit'}
          onClick={knownEmail ? () => void send() : undefined}
          disabled={busy || !address}
          className="btn-primary inline-flex min-h-[44px] items-center justify-center px-4 text-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          {state === 'sending' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {label}
        </button>
      </div>
      <div role="status" aria-live="polite" className="mt-2 min-h-[1.25rem] text-sm">
        {state === 'sent' && (
          <p className="text-emerald-700 dark:text-emerald-300">
            If that address has an account waiting to be confirmed, a new link is on its way. It works for 24 hours.
          </p>
        )}
        {state === 'failed' && (
          <p className="text-red-700 dark:text-red-300">
            We could not send another just now. Please wait a little and try again.
          </p>
        )}
      </div>
    </Container>
  );
}
