'use client';

/**
 * "Your provider check": how the person who lists a DV-safe, emergency or
 * transitional place asks ATHENA to check them.
 *
 * "Checked by ATHENA staff" on one of those places is a promise about the person
 * offering it as well as the place. A place can show as checked only while its
 * lister holds an approved provider check, so this is where a member asks for
 * one, sees where it stands, and asks again when it ends or is refused.
 *
 * It says plainly what is checked and what is not. A member of staff reads what
 * the lister tells us and records what they did to be satisfied (looking an ABN
 * up on the business register, speaking to a reference, an agreement with a
 * housing service). ATHENA does not run police or background checks and does
 * not ask for one.
 *
 * The server holds every rule; this only collects, and shows the server's own
 * sentence when it refuses.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { CheckCircle2, Clock, Loader2, ShieldCheck, XCircle } from 'lucide-react';
import { housingApi } from '@/lib/api';
import { cn } from '@/lib/utils';

type Standing = 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

type ProviderCheck = {
  standing: Standing;
  canApply: boolean;
  renewable: boolean;
  providerName?: string;
  relationship?: string;
  abn?: string | null;
  statement?: string | null;
  submittedAt?: string;
  reviewedAt?: string | null;
  expiresAt?: string | null;
  /** The reason a refusal gave. Staff's notes on an approval are not sent. */
  decisionNote?: string;
  relationships: Array<{ value: string; label: string }>;
  renewalWindowDays: number;
};

const inputClass = 'w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm dark:border-slate-700';
const labelClass = 'text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400';

const serverMessage = (err: unknown, fallback: string): string => {
  const data = (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data;
  return data?.message || data?.error || fallback;
};

const longDate = (iso: string) => new Date(iso).toLocaleDateString('en-AU', { dateStyle: 'long' });

export function ProviderCheckPanel() {
  const queryClient = useQueryClient();
  const [asking, setAsking] = useState(false);
  const [form, setForm] = useState({ providerName: '', relationship: 'OWNER', abn: '', statement: '' });

  const check = useQuery({
    queryKey: ['housing-provider-check'],
    queryFn: housingApi.getMyProviderCheck,
    select: (r) => r.data?.data as ProviderCheck,
  });

  const send = useMutation({
    mutationFn: () =>
      housingApi.askForProviderCheck({
        providerName: form.providerName.trim(),
        relationship: form.relationship,
        ...(form.abn.trim() ? { abn: form.abn.trim() } : {}),
        statement: form.statement.trim(),
      }),
    onSuccess: (r) => {
      toast.success((r.data?.message as string | undefined) || 'Sent. A member of staff will look at it.', { duration: 8000 });
      setAsking(false);
      setForm({ providerName: '', relationship: 'OWNER', abn: '', statement: '' });
      queryClient.invalidateQueries({ queryKey: ['housing-provider-check'] });
    },
    onError: (err) => toast.error(serverMessage(err, 'Could not send that')),
  });

  const data = check.data;

  return (
    <section id="provider-check" aria-labelledby="provider-check-heading" className="scroll-mt-24 space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
      <div className="flex items-start gap-2">
        <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" aria-hidden="true" />
        <div>
          <h3 id="provider-check-heading" className="text-sm font-semibold text-slate-900 dark:text-white">Your provider check</h3>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
            ATHENA checks who is offering a DV-safe, emergency or transitional place, as well as the place. Until a member of staff has approved your provider check, those places cannot show as checked. You tell us who you are and how you are connected to the places you list, and staff record what they did to be satisfied. We do not run police or background checks, and we do not ask for one.
          </p>
        </div>
      </div>

      {check.isLoading ? (
        <p className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading</p>
      ) : check.isError || !data ? (
        <p role="alert" className="text-xs text-red-600">
          Your provider check could not be loaded just now.{' '}
          <button type="button" onClick={() => check.refetch()} className="font-medium underline">Try again</button>
        </p>
      ) : (
        <>
          {data.standing === 'APPROVED' && data.expiresAt && (
            <p className="flex items-center gap-2 text-sm text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Approved. It stands until {longDate(data.expiresAt)}.
            </p>
          )}
          {data.standing === 'PENDING' && (
            <p className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-300">
              <Clock className="h-4 w-4" aria-hidden="true" /> Waiting for a member of staff to look at it. Your places that need it stay off the list until then.
            </p>
          )}
          {data.standing === 'REJECTED' && (
            <div className="space-y-1 text-sm text-red-700 dark:text-red-300">
              <p className="flex items-center gap-2"><XCircle className="h-4 w-4" aria-hidden="true" /> It was not approved.</p>
              {data.decisionNote && <p className="rounded-md bg-red-50 p-2 text-xs text-red-900 dark:bg-red-900/20 dark:text-red-100">{data.decisionNote}</p>}
            </div>
          )}
          {data.standing === 'EXPIRED' && (
            <p className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-300">
              <Clock className="h-4 w-4" aria-hidden="true" /> It has ended. Places that rested on it are off the list until a new check is approved.
            </p>
          )}
          {data.standing === 'NONE' && <p className="text-sm text-slate-600 dark:text-slate-300">You have not asked to be checked yet.</p>}
          {data.renewable && <p className="text-xs text-slate-500">It ends within {data.renewalWindowDays} days. You can ask for it to be renewed now.</p>}

          {data.canApply && !asking && (
            <button type="button" onClick={() => setAsking(true)} className="btn-secondary min-h-[44px] px-4 text-sm">
              {data.standing === 'NONE' ? 'Ask to be checked' : data.renewable ? 'Ask for a renewal' : 'Ask again'}
            </button>
          )}

          {asking && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send.mutate();
              }}
              className="grid gap-3 md:grid-cols-2"
            >
              <div>
                <label htmlFor="provider-name" className={labelClass}>Your name, or the name of the service</label>
                <input id="provider-name" value={form.providerName} onChange={(e) => setForm({ ...form, providerName: e.target.value })} maxLength={120} required className={cn('mt-1', inputClass)} />
              </div>
              <div>
                <label htmlFor="provider-relationship" className={labelClass}>How you are connected to the places you list</label>
                <select id="provider-relationship" value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })} className={cn('mt-1', inputClass)}>
                  {data.relationships.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label htmlFor="provider-abn" className={labelClass}>ABN (if you have one)</label>
                <input id="provider-abn" value={form.abn} onChange={(e) => setForm({ ...form, abn: e.target.value })} inputMode="numeric" placeholder="11 digits" className={cn('mt-1', inputClass)} />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="provider-statement" className={labelClass}>Tell us about the places you list and how you know them</label>
                <textarea
                  id="provider-statement"
                  value={form.statement}
                  onChange={(e) => setForm({ ...form, statement: e.target.value })}
                  maxLength={1000}
                  rows={3}
                  required
                  placeholder="For example: who owns the places, who else lives there, who we could speak to who knows you"
                  className={cn('mt-1', inputClass)}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 md:col-span-2">
                <button type="submit" disabled={send.isPending || !form.providerName.trim() || form.statement.trim().length < 20} className="btn-primary min-h-[44px] px-4 text-sm">
                  {send.isPending ? 'Sending...' : 'Send for a check'}
                </button>
                <button type="button" onClick={() => setAsking(false)} className="min-h-[44px] px-3 text-sm text-slate-500 hover:underline">Cancel</button>
              </div>
            </form>
          )}
        </>
      )}
    </section>
  );
}
