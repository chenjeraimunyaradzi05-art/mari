'use client';

/**
 * The recovery codes she has just been given, once.
 *
 * Turning two-factor on returns ten single-use codes, and that response is the
 * only time they exist in the clear: the server keeps hashes. The page used to
 * throw them away, so a member who enrolled had no codes until she found the
 * "Issue new codes" button, which wants her password and a live authenticator
 * code, and if she lost the phone first there was nothing. They are shown here
 * with the two ways she has to keep them somewhere other than the phone the
 * authenticator is on: copy, and download as a text file.
 *
 * It stays until she says she has saved them. There is no way to see them
 * again, and the text says so.
 */

import { useState } from 'react';
import toast from 'react-hot-toast';
import { downloadText } from '@/lib/download';

type RecoveryCodesProps = {
  codes: string[];
  /** She has saved them; hide the panel. */
  onSaved: () => void;
};

const BUTTON =
  'min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800';

/** What she keeps: the codes, one a line, with what they are for and what to do with them. */
export function recoveryCodesText(codes: string[], now: Date = new Date()): string {
  return [
    'ATHENA recovery codes',
    `Made ${now.toISOString().slice(0, 10)}`,
    '',
    'Each code signs you in once if you lose your authenticator app.',
    'Keep this somewhere other than the phone the app is on.',
    'Making a new set replaces this one.',
    '',
    ...codes,
    '',
  ].join('\n');
}

export function RecoveryCodes({ codes, onSaved }: RecoveryCodesProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(codes.join('\n'));
      setCopied(true);
      toast.success('Recovery codes copied');
    } catch {
      toast.error('We could not copy them. Select them and copy by hand, or download the file.');
    }
  };

  return (
    <div
      role="group"
      aria-labelledby="recovery-codes-title"
      className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/30"
    >
      <h3 id="recovery-codes-title" className="text-sm font-semibold text-amber-900 dark:text-amber-100">
        Save your recovery codes now
      </h3>
      <p role="alert" className="mt-1 text-sm text-amber-900 dark:text-amber-200">
        If you lose your phone, each of these signs you in once. We show them only this once and cannot show them again, so save them somewhere other than your phone.
      </p>

      <ul className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm text-slate-900 dark:text-slate-100 sm:grid-cols-5">
        {codes.map((code) => (
          <li key={code} className="rounded bg-white px-2 py-1.5 text-center dark:bg-slate-900">
            {code}
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={copy} className={BUTTON}>
          {copied ? 'Copied' : 'Copy codes'}
        </button>
        <button
          type="button"
          onClick={() => downloadText('athena-recovery-codes.txt', recoveryCodesText(codes))}
          className={BUTTON}
        >
          Download as a file
        </button>
        <button
          type="button"
          onClick={onSaved}
          className="min-h-11 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
        >
          I have saved them
        </button>
      </div>
    </div>
  );
}
