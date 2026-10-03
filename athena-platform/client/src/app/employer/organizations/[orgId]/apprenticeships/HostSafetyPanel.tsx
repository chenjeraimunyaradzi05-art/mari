'use client';

/**
 * "Before you can place apprentices": the two things ATHENA asks of a host.
 *
 * An apprentice is often a young person starting a first job in a workplace
 * ATHENA has never seen. An organisation may open a listing, take applications
 * and confirm a placement only while it is verified (the badge on its page) AND
 * holds an approved host safety attestation that has not run out. This panel
 * shows where each stands and, for an owner or admin, collects the attestation.
 *
 * The attestation is the organisation's own statement, in yes or no, about its
 * safety policy, workers' compensation cover, supervision, incident reporting,
 * a complaints route and its obligations for young workers, with a named safety
 * contact and an ABN. A member of ATHENA staff reads it and writes down what
 * they did to be satisfied. Every statement has to be true before ATHENA will
 * look at it: if something is not in place yet, the answer is to put it in
 * place first, not to say no and send it anyway.
 *
 * It is about the organisation only. ATHENA does not collect or hold anyone's
 * police or background check, and the panel says so.
 *
 * The server holds every rule; this collects, and shows the server's own
 * sentence when it refuses.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { CheckCircle2, Circle, Clock, Loader2, ShieldCheck, XCircle } from 'lucide-react';
import { hostSafetyApi, type HostSafetyStatus } from '@/lib/verification-api';
import { cn } from '@/lib/utils';

const inputClass = 'w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm dark:border-slate-700';
const labelClass = 'text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400';

const serverMessage = (err: unknown, fallback: string): string => {
  const data = (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data;
  return data?.message || data?.error || fallback;
};
const longDate = (iso: string) => new Date(iso).toLocaleDateString('en-AU', { dateStyle: 'long' });

const EMPTY_FORM = { safetyContactName: '', safetyContactEmail: '', safetyContactPhone: '', abn: '' };

/** The status the apprenticeships page reads to decide whether to offer Publish. Same query key, so it is one request. */
export const hostSafetyQueryKey = (organizationId: string) => ['host-safety', organizationId] as const;

export function useHostSafety(organizationId: string) {
  return useQuery({
    queryKey: hostSafetyQueryKey(organizationId),
    queryFn: () => hostSafetyApi.status(organizationId),
    select: (r) => r.data?.data as HostSafetyStatus,
    // A refusal here means the viewer is not on the team; the server still
    // decides everything, so the page simply offers nothing extra.
    retry: false,
  });
}

function Step({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      {done ? <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" aria-hidden="true" /> : <Circle className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" aria-hidden="true" />}
      <span className="text-slate-700 dark:text-slate-200">{children}</span>
    </li>
  );
}

export function HostSafetyPanel({ organizationId }: { organizationId: string }) {
  const queryClient = useQueryClient();
  const [asking, setAsking] = useState(false);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState(EMPTY_FORM);

  const status = useHostSafety(organizationId);
  const data = status.data;

  const send = useMutation({
    mutationFn: () =>
      hostSafetyApi.submit(organizationId, {
        answers,
        safetyContactName: form.safetyContactName.trim(),
        ...(form.safetyContactEmail.trim() ? { safetyContactEmail: form.safetyContactEmail.trim() } : {}),
        ...(form.safetyContactPhone.trim() ? { safetyContactPhone: form.safetyContactPhone.trim() } : {}),
        abn: form.abn.trim(),
      }),
    onSuccess: (r) => {
      toast.success((r.data?.message as string | undefined) || 'Sent. A member of ATHENA staff will read it.', { duration: 8000 });
      setAsking(false);
      setAnswers({});
      setForm(EMPTY_FORM);
      queryClient.invalidateQueries({ queryKey: hostSafetyQueryKey(organizationId) });
    },
    onError: (err) => toast.error(serverMessage(err, 'That could not be sent.')),
  });

  if (status.isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Checking your organisation&rsquo;s host status
      </p>
    );
  }
  // Not on the team, or the request failed: nothing to show, and nothing is blocked here.
  if (status.isError || !data) return null;

  const { attestation } = data;
  const allAffirmed = data.questions.every((q) => answers[q.id] === true);
  const ready = allAffirmed && form.safetyContactName.trim().length >= 2 && (form.safetyContactEmail.trim() || form.safetyContactPhone.trim()) && form.abn.trim();

  return (
    <section aria-labelledby="host-safety-heading" className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-start gap-2">
        <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" aria-hidden="true" />
        <div>
          <h2 id="host-safety-heading" className="font-semibold text-slate-900 dark:text-white">
            {data.mayPlaceApprentices ? 'Your organisation can place apprentices through ATHENA' : 'Before you can place apprentices'}
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            An apprentice is often a young person starting a first job. ATHENA opens a listing, takes applications and confirms a placement only for an organisation that is verified and has sent a safety attestation that staff have approved. This is about your organisation. ATHENA does not collect or hold anyone&rsquo;s police or background check.
          </p>
        </div>
      </div>

      <ul className="space-y-1.5">
        <Step done={data.organization.isVerified}>
          {data.organization.isVerified ? (
            'Your organisation is verified.'
          ) : (
            <>
              Your organisation is not verified yet. An owner or admin can ask for that from{' '}
              <Link href={`/employer/organizations/${organizationId}`} className="font-medium underline">the organisation page</Link>.
            </>
          )}
        </Step>
        <Step done={attestation.standing === 'APPROVED'}>
          {attestation.standing === 'APPROVED' && attestation.expiresAt && `Your safety attestation is approved. It stands until ${longDate(attestation.expiresAt)}.`}
          {attestation.standing === 'PENDING' && 'Your safety attestation is with ATHENA staff, who will read it and tell you what they decide.'}
          {attestation.standing === 'REJECTED' && 'Your last safety attestation was not approved. You can send a new one.'}
          {attestation.standing === 'EXPIRED' && 'Your safety attestation has ended. Send a new one to place apprentices again.'}
          {attestation.standing === 'NONE' && 'You have not sent a safety attestation yet.'}
        </Step>
      </ul>

      {attestation.standing === 'REJECTED' && attestation.reviewNote && (
        <p className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-900 dark:bg-red-900/20 dark:text-red-100">
          <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" /> {attestation.reviewNote}
        </p>
      )}
      {attestation.standing === 'PENDING' && (
        <p className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-300">
          <Clock className="h-4 w-4" aria-hidden="true" /> Waiting for a decision.
        </p>
      )}
      {attestation.renewable && <p className="text-xs text-slate-500">It ends within {data.renewalWindowDays} days. You can send a renewal now.</p>}

      {!data.mayAttest ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Only an owner or admin of the organisation can send its safety attestation.</p>
      ) : (
        data.canSubmit &&
        !asking && (
          <button type="button" onClick={() => setAsking(true)} className="btn-primary min-h-[44px] px-4 text-sm">
            {attestation.standing === 'NONE' ? 'Send the safety attestation' : attestation.renewable ? 'Send a renewal' : 'Send a new attestation'}
          </button>
        )
      )}

      {asking && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send.mutate();
          }}
          className="space-y-4 border-t border-slate-100 pt-4 dark:border-slate-700"
        >
          <fieldset className="space-y-1">
            <legend className="text-sm font-medium text-slate-900 dark:text-white">Every one of these has to be true for your organisation</legend>
            <p className="text-xs text-slate-500">If something is not in place yet, put it in place first and send the attestation then.</p>
            {data.questions.map((q) => (
              <label key={q.id} className="flex min-h-[44px] items-start gap-3 py-1.5 text-sm text-slate-700 dark:text-slate-200">
                <input type="checkbox" checked={answers[q.id] === true} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.checked })} className="mt-1 h-4 w-4 rounded border-slate-300" />
                <span>{q.statement}</span>
              </label>
            ))}
          </fieldset>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <label htmlFor="host-contact-name" className={labelClass}>Who an apprentice tells about a safety problem</label>
              <input id="host-contact-name" value={form.safetyContactName} onChange={(e) => setForm({ ...form, safetyContactName: e.target.value })} maxLength={120} required className={cn('mt-1', inputClass)} />
            </div>
            <div>
              <label htmlFor="host-contact-email" className={labelClass}>Their email</label>
              <input id="host-contact-email" type="email" value={form.safetyContactEmail} onChange={(e) => setForm({ ...form, safetyContactEmail: e.target.value })} className={cn('mt-1', inputClass)} />
            </div>
            <div>
              <label htmlFor="host-contact-phone" className={labelClass}>Or their phone number</label>
              <input id="host-contact-phone" type="tel" value={form.safetyContactPhone} onChange={(e) => setForm({ ...form, safetyContactPhone: e.target.value })} className={cn('mt-1', inputClass)} />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="host-abn" className={labelClass}>Your organisation&rsquo;s ABN</label>
              <input id="host-abn" value={form.abn} onChange={(e) => setForm({ ...form, abn: e.target.value })} inputMode="numeric" placeholder="11 digits" required className={cn('mt-1', inputClass)} />
              <p className="mt-1 text-xs text-slate-500">Staff compare it with the Australian Business Register. Only the registered name and the ABN&rsquo;s status are kept from that.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" disabled={send.isPending || !ready} className="btn-primary min-h-[44px] px-4 text-sm">
              {send.isPending ? 'Sending...' : 'Send for review'}
            </button>
            <button type="button" onClick={() => setAsking(false)} className="min-h-[44px] px-3 text-sm text-slate-500 hover:underline">Cancel</button>
          </div>
        </form>
      )}
    </section>
  );
}
