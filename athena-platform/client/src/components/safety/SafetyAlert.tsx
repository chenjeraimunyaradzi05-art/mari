'use client';

/**
 * The safety alert, from wherever she is.
 *
 * The alert (a message to the emergency contacts she chose, asking them to reach
 * her) could be sent from one place: a section near the bottom of her Safety
 * settings. A woman who needs it is almost never on that page. It is offered here
 * as well, inside Emergency help, which is on every page she can be on.
 *
 * What it holds to:
 *   - It is there only when it can work: the alert switched on, and at least one
 *     contact set to be told. Offering a button that can only say "nobody to
 *     tell" would be a way to waste a minute she may not have.
 *   - It cannot be sent by accident. It sits inside a dialog she opened on
 *     purpose, and sending takes a second press on a button that says what it
 *     will do.
 *   - It says what happened in the server's own words. The server knows whether
 *     anybody was actually reached, and this never decides that for itself.
 *   - It does not say how the message goes. The server emails a contact who has an
 *     address and texts one who has a number where text messages are switched on,
 *     so "emailed" would be wrong for a contact with only a phone number, and this
 *     page cannot know which applies. It says "a message", and the answer after
 *     sending says who was reached.
 *   - A failure is not the end of it. If the alert could not be sent, or nobody was
 *     reached, she is offered another go, because the dialog is the only place she
 *     can press it from and closing it to open it again costs time she may not have.
 *   - It does not claim more than it is. It tells her contacts; it cannot send
 *     anyone to her, and it says to ring 000 if she is in danger.
 *   - It asks for nothing the Safety page has not already fetched: the settings
 *     are the same cached read the quick exit uses.
 */

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { BellRing } from 'lucide-react';
import { dvSafeApi } from '@/lib/api';
import { useAuthStore } from '@/lib/hooks';

type AlertSettings = {
  panicButtonEnabled?: boolean;
  emergencyContacts?: Array<{ id: string; name: string; notifyOnPanic: boolean }>;
};

type AlertResult = {
  success: boolean;
  message: string;
  unreachableContacts?: string[];
};

export function SafetyAlertSection() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<AlertResult | null>(null);

  const settings = useQuery({
    queryKey: ['dv-safe-settings'],
    queryFn: dvSafeApi.getSettings,
    enabled: isAuthenticated && !isLoading,
    select: (response) => response.data as AlertSettings,
    staleTime: 5 * 60 * 1000,
  });

  const panic = useMutation({
    mutationFn: () => dvSafeApi.panic(),
    onSuccess: (response) => {
      setConfirming(false);
      setResult(response.data as AlertResult);
    },
    onError: () => {
      setConfirming(false);
      setResult({ success: false, message: 'The alert could not be sent. Call 000 if you are in danger.' });
    },
  });

  const toTell = (settings.data?.emergencyContacts ?? []).filter((contact) => contact.notifyOnPanic);
  if (!settings.data?.panicButtonEnabled || toTell.length === 0) return null;

  return (
    <section aria-labelledby="safety-alert-heading" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/50 dark:bg-rose-900/20">
      <h3 id="safety-alert-heading" className="flex items-center gap-2 text-sm font-semibold text-rose-900 dark:text-rose-100">
        <BellRing className="h-4 w-4" aria-hidden="true" /> Tell my emergency contacts
      </h3>

      {result ? (
        <>
          <p role="status" className="mt-2 text-sm text-rose-900 dark:text-rose-100">
            {/* The server's own words: it knows whether anybody was actually reached. */}
            {result.message}{' '}
            {result.unreachableContacts && result.unreachableContacts.length > 0 && `Could not reach ${result.unreachableContacts.join(', ')}: call them.`}
          </p>
          {!result.success && (
            <button
              type="button"
              onClick={() => {
                setResult(null);
                setConfirming(true);
              }}
              className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-800 hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-500 dark:border-rose-800 dark:bg-slate-900 dark:text-rose-200 dark:hover:bg-slate-800"
            >
              Try again
            </button>
          )}
        </>
      ) : confirming ? (
        <div className="mt-2">
          <p className="text-sm text-rose-900 dark:text-rose-100">
            Send your safety alert to {toTell.length === 1 ? 'your emergency contact' : `your ${toTell.length} emergency contacts`} now? They are
            sent a message asking them to reach you. Nobody else is told, and this page then says who the message reached. ATHENA cannot
            send anyone to you: if you are in danger, call 000.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => panic.mutate()}
              disabled={panic.isPending}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 disabled:opacity-60"
            >
              {panic.isPending ? 'Sending…' : 'Yes, send it'}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={panic.isPending}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-medium text-rose-800 hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-500 dark:border-rose-800 dark:bg-slate-900 dark:text-rose-200 dark:hover:bg-slate-800"
            >
              Not now
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2">
          <p className="text-xs text-rose-800 dark:text-rose-200">
            Sends a message to the people you chose and asks them to reach you. It asks you once more before it sends.
          </p>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="mt-2 inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-800 hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-500 dark:border-rose-800 dark:bg-slate-900 dark:text-rose-200 dark:hover:bg-slate-800"
          >
            Send my safety alert
          </button>
        </div>
      )}
    </section>
  );
}
