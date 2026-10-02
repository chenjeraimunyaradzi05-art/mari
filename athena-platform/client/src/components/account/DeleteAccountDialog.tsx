'use client';

/**
 * Closing her own account, said the same way wherever she can do it.
 *
 * Settings had three buttons that did two different things: two called an
 * endpoint that anonymised the account row and left her posts, messages, bank
 * connections and safety records where they were while the screen said "all
 * associated data", one filed a request and then told her it would be carried
 * out within thirty days when it is carried out at once. And none of them said
 * a word about her membership, which kept being charged. Now they all open this,
 * which calls the one endpoint that runs the full erasure, says what that does
 * in the words the Privacy Policy uses, asks again for her password (and her
 * second factor, when it is on) because it cannot be undone, and shows the
 * server's own answer when it refuses: a hold, or billing that could not be
 * ended, in which case nothing has been deleted.
 */

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { useDeleteAccount } from '@/lib/hooks';
import { StepUpFields } from './StepUpFields';

/** Typing it is what keeps this from being a one-click action. */
export const DELETE_ACCOUNT_PHRASE = 'DELETE_MY_ACCOUNT';

type DeleteAccountDialogProps = {
  open: boolean;
  onClose: () => void;
};

function messageOf(error: unknown): string | null {
  const response = (error as { response?: { data?: { message?: unknown; error?: unknown } } } | null)?.response;
  if (!response) return error ? 'We could not reach the server. Nothing has been deleted. Please try again.' : null;
  const sentence = [response.data?.message, response.data?.error].find(
    (candidate): candidate is string => typeof candidate === 'string' && candidate.trim().length > 0
  );
  return sentence ?? 'Your account could not be deleted. Nothing has been changed. Please try again.';
}

export function DeleteAccountDialog({ open, onClose }: DeleteAccountDialogProps) {
  const deleteAccount = useDeleteAccount();
  const [typed, setTyped] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const confirmRef = useRef<HTMLInputElement | null>(null);

  // Whether two-factor is on, so the code is asked for plainly. The same query
  // the security page makes, so the answer is usually already there.
  const { data: twoFactorEnabled } = useQuery({
    queryKey: ['two-factor-status'],
    queryFn: () => api.get('/auth/2fa/status'),
    select: (response) => Boolean(response?.data?.data?.enabled),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !deleteAccount.isPending) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose, deleteAccount.isPending]);

  if (!open) return null;

  const close = () => {
    if (deleteAccount.isPending) return;
    setTyped('');
    setPassword('');
    setCode('');
    deleteAccount.reset();
    onClose();
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (typed !== DELETE_ACCOUNT_PHRASE || deleteAccount.isPending) return;
    deleteAccount.mutate({
      ...(password ? { currentPassword: password } : {}),
      ...(code.trim() ? { code: code.trim() } : {}),
    });
  };

  const refusal = messageOf(deleteAccount.error);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4" onClick={close}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
        aria-describedby="delete-account-what"
        onClick={(event) => event.stopPropagation()}
        onSubmit={submit}
        className="my-auto w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-slate-800"
      >
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <AlertTriangle className="h-6 w-6 text-red-600" aria-hidden="true" />
          </div>
          <div>
            <h2 id="delete-account-title" className="text-lg font-semibold text-slate-900 dark:text-white">
              Delete your account
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">This cannot be undone</p>
          </div>
        </div>

        <div id="delete-account-what" className="mb-4 space-y-2 text-sm text-slate-600 dark:text-slate-400">
          <p>
            We erase your profile, posts, messages and the rest of your personal information straight away, and you are signed out everywhere.
          </p>
          <p>
            If you pay for a membership, it ends today and you are not charged again. If we cannot end it, nothing is deleted and we tell you.
          </p>
          <p>
            Gift points you have bought, and creator earnings you have not withdrawn, are not paid out or refunded when your account is deleted. Withdraw your earnings first if you want them.
          </p>
          <p>
            A few records the law makes us keep, like payments and invoices, stay for seven years without your name or anything that identifies you. Copies in our backups are not removed at once: they age out as backups are replaced.
          </p>
        </div>

        <StepUpFields
          password={password}
          code={code}
          onPasswordChange={setPassword}
          onCodeChange={setCode}
          codeRequired={Boolean(twoFactorEnabled)}
          disabled={deleteAccount.isPending}
        />

        <label htmlFor="delete-account-confirmation" className="label mt-4">
          Type <strong>{DELETE_ACCOUNT_PHRASE}</strong> to confirm
        </label>
        <input
          id="delete-account-confirmation"
          ref={confirmRef}
          type="text"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          placeholder={DELETE_ACCOUNT_PHRASE}
          className="input min-h-11"
          autoComplete="off"
          spellCheck={false}
          disabled={deleteAccount.isPending}
        />

        {refusal && (
          <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
            {refusal}
          </p>
        )}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={close}
            disabled={deleteAccount.isPending}
            className="min-h-11 flex-1 rounded-lg border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 disabled:opacity-60 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={typed !== DELETE_ACCOUNT_PHRASE || deleteAccount.isPending}
            className="min-h-11 flex-1 rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deleteAccount.isPending ? 'Deleting…' : 'Delete my account'}
          </button>
        </div>
      </form>
    </div>
  );
}
