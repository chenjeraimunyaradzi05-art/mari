'use client';

/**
 * The appeal a suspended member can send from the sign-in page.
 *
 * The help pages offered "Account Suspension" and "Account Ban" appeals behind
 * a sign-in that refuses a suspended account, so the people those appeals are
 * for could never send one. This panel appears when sign-in answers that the
 * account is suspended, and sends the appeal with the address and password
 * she has just typed — the server checks them the way sign-in does, files the
 * appeal against that account, and issues no session.
 */

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

/** Whether a sign-in refusal is the suspended-account one. */
export const isSuspendedRefusal = (message: string | undefined): boolean =>
  Boolean(message && message.toLowerCase().includes('suspended'));

const REASON_MIN = 10;
const REASON_MAX = 5000;

export function SuspensionAppeal({ email, password }: { email: string; password: string }) {
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const send = async () => {
    setSending(true);
    setFailure(null);
    try {
      // A plain request rather than the shared client: that client answers a
      // 401 by trying to refresh a session she does not have, which would
      // replace the server's reason with a generic failure.
      const response = await fetch('/api/auth/suspension-appeal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, reason: reason.trim() }),
      });
      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        setFailure(body?.message || 'Your appeal could not be sent just now. Please try again.');
        return;
      }
      setSent(body?.message || 'Your appeal has been sent and a person will look at it.');
    } catch {
      setFailure('Your appeal could not be sent just now. Check your connection and try again.');
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200" role="status">
        {sent}
      </div>
    );
  }

  const length = reason.trim().length;

  return (
    <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
      <p className="text-sm font-medium text-slate-900 dark:text-white">Appeal this suspension</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Tell a reviewer why you think it is wrong. It is sent with the email and password above, which is how we know the
        account is yours; you will not be signed in.
      </p>
      <textarea
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        maxLength={REASON_MAX}
        className="input mt-3 min-h-[96px] w-full"
        placeholder="What happened, and anything the reviewer should know."
        aria-label="Why the suspension should be lifted"
      />
      {failure && (
        <p className="mt-2 text-sm text-red-700 dark:text-red-300" role="alert">
          {failure}
        </p>
      )}
      <button
        type="button"
        onClick={send}
        disabled={sending || length < REASON_MIN || !email || !password}
        className="btn-outline mt-3 px-4 py-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {sending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…
          </>
        ) : (
          'Send appeal'
        )}
      </button>
    </div>
  );
}
