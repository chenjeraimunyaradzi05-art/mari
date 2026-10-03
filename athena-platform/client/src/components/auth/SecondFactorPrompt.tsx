'use client';

/**
 * The question the Google and Facebook buttons ask when the account they found
 * has two-factor on.
 *
 * They used to show "Please sign in with email and password", which is no way in
 * for a member who joined with Google or Facebook and so has no password: the
 * only road back to her own account was the reset-password email. The server now
 * takes the code with the same provider sign-in, so the button keeps hold of the
 * provider's proof, asks here, and sends both together. Nothing she types is
 * stored, and cancelling drops the provider's proof as well.
 */

import { useId, useState } from 'react';

type SecondFactorPromptProps = {
  provider: 'Google' | 'Facebook';
  pending: boolean;
  /** The server's sentence when the last code was refused; null before the first try. */
  error: string | null;
  onSubmit: (code: string) => void;
  onCancel: () => void;
};

/**
 * Whether an answer from the sign-in is the server asking for the second
 * factor (or refusing the one it was given), as opposed to refusing the sign-in.
 * The sign-in routes skip the refresh interceptor, so the sentence is all there
 * is to go on, the same sniff the email sign-in page makes.
 */
export function asksForSecondFactor(status: number | undefined, message: string | undefined): boolean {
  return (status === 401 || status === 400) && Boolean(message && message.toLowerCase().includes('two-factor'));
}

export function SecondFactorPrompt({ provider, pending, error, onSubmit, onCancel }: SecondFactorPromptProps) {
  const [code, setCode] = useState('');
  const inputId = useId();
  const hintId = useId();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (code.trim().length >= 6 && !pending) onSubmit(code.trim());
      }}
      className="w-full rounded-2xl border border-primary-200 bg-primary-50 p-4 dark:border-primary-900/40 dark:bg-primary-900/20"
      aria-label={`Two-factor code to finish signing in with ${provider}`}
    >
      <label htmlFor={inputId} className="label">
        Your two-factor code
      </label>
      <input
        id={inputId}
        type="text"
        value={code}
        onChange={(event) => setCode(event.target.value)}
        className="input min-h-11"
        inputMode="text"
        autoComplete="one-time-code"
        autoFocus
        maxLength={32}
        spellCheck={false}
        aria-describedby={hintId}
        aria-invalid={error ? 'true' : 'false'}
        disabled={pending}
      />
      <p id={hintId} className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        {provider} knows it is you; your ATHENA account also asks for the six-digit code from your authenticator app. If you have lost your phone, one of the recovery codes you saved works instead.
      </p>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      <div className="mt-3 flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="min-h-11 flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-60 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending || code.trim().length < 6}
          className="btn-primary min-h-11 flex-1 px-4 py-2 text-sm"
        >
          {pending ? 'Checking…' : 'Continue'}
        </button>
      </div>
    </form>
  );
}
