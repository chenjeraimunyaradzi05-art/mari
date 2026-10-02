'use client';

/**
 * The two things the server asks for again before it does something that cannot
 * be undone: her password, and a live second-factor code when she has two-factor
 * on. Closing an account is the first thing to ask, and it asks on both of the
 * ways in (Settings, and the Privacy Centre), so this is one component, not two
 * sets of boxes that can drift apart.
 *
 * An account that signs in only with Google or Facebook has no password to give,
 * and says so by leaving the box empty; the server asks for a password only of
 * an account that has one. The code box says plainly that it is only for people
 * who use two-factor, and takes either an authenticator code or one of the
 * recovery codes she saved, which is why it holds up to 32 characters and is not
 * a numeric field.
 */

import { useId } from 'react';

type StepUpFieldsProps = {
  password: string;
  code: string;
  onPasswordChange: (value: string) => void;
  onCodeChange: (value: string) => void;
  /** True when two-factor is known to be on, so the code is asked for in plain words rather than as an extra. */
  codeRequired?: boolean;
  disabled?: boolean;
};

export function StepUpFields({ password, code, onPasswordChange, onCodeChange, codeRequired = false, disabled = false }: StepUpFieldsProps) {
  const passwordId = useId();
  const passwordHintId = useId();
  const codeId = useId();
  const codeHintId = useId();

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor={passwordId} className="label">
          Your password
        </label>
        <input
          id={passwordId}
          type="password"
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
          className="input min-h-11"
          autoComplete="current-password"
          aria-describedby={passwordHintId}
          disabled={disabled}
        />
        <p id={passwordHintId} className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          We ask again so that nobody else can do this from a phone you left unlocked. If you only ever sign in with Google or Facebook, you have no password: leave this empty.
        </p>
      </div>

      <div>
        <label htmlFor={codeId} className="label">
          {codeRequired ? 'Authenticator code or recovery code' : 'Authenticator code or recovery code (only if you use two-factor)'}
        </label>
        <input
          id={codeId}
          type="text"
          value={code}
          onChange={(event) => onCodeChange(event.target.value)}
          className="input min-h-11"
          inputMode="text"
          autoComplete="one-time-code"
          maxLength={32}
          spellCheck={false}
          aria-describedby={codeHintId}
          disabled={disabled}
        />
        <p id={codeHintId} className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          The six digits from your authenticator app. If you have lost your phone, one of the recovery codes you saved works here instead.
        </p>
      </div>
    </div>
  );
}
