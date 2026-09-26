'use client';

/**
 * A cohort, week by week.
 *
 * The twelve-week accelerator in the blueprint is a curriculum with a
 * deliverable at the end of each week. This is where a founder pays her
 * place, sees the sessions, marks a week done with what she produced, and
 * collects the certificate when the cohort has run its course. Without this
 * page the enrolment could never move past PENDING, which is what made the
 * completion certificate unreachable.
 */

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Award, CalendarDays, Check, CreditCard, ExternalLink, Loader2, Rocket, Video } from 'lucide-react';
import { businessApi } from '@/lib/api';
import { apiMessage } from '@/lib/strategy-api';
import { PaymentIntentForm } from '@/components/payments/PaymentIntentForm';
import { cn, formatCurrency, formatDate } from '@/lib/utils';

type Week = {
  weekNumber: number; sessionId: string; title: string; scheduledAt: string; durationMins: number;
  meetingUrl: string | null; recordingUrl: string | null;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'UPCOMING'; completedAt: string | null; note: string | null; deliverableUrl: string | null;
};
type Progress = {
  enrollmentId: string; status: string; paymentStatus: string;
  cohort: { id: string; name: string; startDate: string; endDate: string };
  totalWeeks: number; completedWeeks: number; percentComplete: number; currentWeekNumber: number | null;
  completedAt: string | null; weeks: Week[];
};
type Payment = { free?: boolean; clientSecret?: string | null; amountCents: number; currency: string; status?: string };

const when = (iso: string) => new Date(iso).toLocaleString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export default function CohortProgressPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [paying, setPaying] = useState(false);
  const [marking, setMarking] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [deliverableUrl, setDeliverableUrl] = useState('');
  const [openWeek, setOpenWeek] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await businessApi.getEnrollmentProgress(id);
      setProgress(res.data?.data ?? null);
      setError(null);
    } catch (err) {
      setError(apiMessage(err, 'That cohort could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const startPayment = async () => {
    setPaying(true);
    try {
      const res = await businessApi.payForEnrollment(id);
      const data: Payment = res.data?.data ?? res.data;
      setPayment(data);
      if (data?.free) {
        toast.success('Your place is confirmed.');
        await load();
      }
    } catch (err) {
      toast.error(apiMessage(err, 'The payment could not be started.'));
    } finally {
      setPaying(false);
    }
  };

  const markWeek = async (weekNumber: number) => {
    setMarking(weekNumber);
    try {
      await businessApi.markCohortWeek(id, { weekNumber, note: note.trim() || undefined, deliverableUrl: deliverableUrl.trim() || undefined });
      setNote('');
      setDeliverableUrl('');
      setOpenWeek(null);
      await load();
      toast.success(`Week ${weekNumber} marked done.`);
    } catch (err) {
      toast.error(apiMessage(err, 'That week could not be marked.'));
    } finally {
      setMarking(null);
    }
  };

  if (loading) {
    return <div className="mx-auto max-w-4xl p-6"><Loader2 className="h-6 w-6 animate-spin text-rose-500" /></div>;
  }
  if (error || !progress) {
    return (
      <div className="mx-auto max-w-4xl space-y-3 p-6">
        <p className="text-sm text-slate-600 dark:text-slate-300">{error ?? 'No cohort here.'}</p>
        <Link href="/dashboard/accelerator" className="text-sm font-medium text-rose-600 hover:underline dark:text-rose-400">Back to the accelerator</Link>
      </div>
    );
  }

  // A place that has ended — the cohort was cancelled, or staff released or
  // refunded it — is not one she can pay for or work through. It used to show
  // "Pay for my place" on a cancelled cohort, which the server then refused.
  const ended = progress.status === 'DROPPED';
  const unpaid = !ended && progress.paymentStatus !== 'PAID';
  const graduated = progress.status === 'COMPLETED' && progress.completedAt;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <Rocket className="h-5 w-5" />
            <span className="text-sm font-semibold uppercase tracking-wider">Accelerator</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white md:text-3xl">{progress.cohort.name}</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            {formatDate(progress.cohort.startDate)} to {formatDate(progress.cohort.endDate)} · {progress.completedWeeks} of {progress.totalWeeks} weeks done
          </p>
        </div>
        <Link href="/dashboard/accelerator" className="btn-secondary">All cohorts</Link>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-slate-900 dark:text-white">{progress.percentComplete}% through</span>
          <span className="text-slate-500">{progress.currentWeekNumber ? `Week ${progress.currentWeekNumber} next` : graduated ? 'Finished' : 'Not started'}</span>
        </div>
        <div className="mt-2 h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800">
          <div className="h-2.5 rounded-full bg-rose-500 transition-all" style={{ width: `${progress.percentComplete}%` }} />
        </div>
        {graduated && (
          <Link href={`/certificates/accelerator/${progress.enrollmentId}`} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-rose-600 hover:underline dark:text-rose-400">
            <Award className="h-4 w-4" /> Your certificate of completion
          </Link>
        )}
      </div>

      {ended && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900" role="status">
          <h2 className="font-semibold text-slate-900 dark:text-white">This place has ended</h2>
          <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
            {progress.paymentStatus === 'PAID'
              ? 'You paid for this place and the payment has not been returned yet. Tell us how to return it and we will.'
              : progress.paymentStatus === 'REFUNDED'
                ? 'Your payment for this place has been returned.'
                : 'You were not charged for this place.'}
          </p>
          {progress.paymentStatus === 'PAID' && (
            <Link href="/contact" className="mt-3 inline-block text-sm font-semibold text-rose-600 hover:underline dark:text-rose-400">
              Ask for your payment back
            </Link>
          )}
        </div>
      )}

      {unpaid && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 dark:border-amber-900/40 dark:bg-amber-900/10">
          <h2 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white"><CreditCard className="h-4 w-4" /> Your place is not paid yet</h2>
          <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">A week cannot be marked done until the place is paid.</p>
          {!payment && (
            <button type="button" onClick={startPayment} disabled={paying} className="btn-primary mt-3 inline-flex items-center gap-2">
              {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />} Pay for my place
            </button>
          )}
          {payment && !payment.free && payment.clientSecret && (
            <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
              <PaymentIntentForm
                clientSecret={payment.clientSecret}
                amountLabel={formatCurrency(payment.amountCents / 100, payment.currency?.toUpperCase() || 'AUD')}
                onAuthorised={async () => { setPayment(null); await load(); toast.success('Paid. Your place is confirmed.'); }}
                onSkip={() => setPayment(null)}
                skipLabel="Not now"
              />
            </div>
          )}
          {payment && !payment.free && !payment.clientSecret && (
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">Card payments are not switched on for this site yet, so the fee cannot be taken here.</p>
          )}
        </div>
      )}

      <ol className="space-y-3">
        {progress.weeks.map((week) => {
          const done = week.status === 'COMPLETED';
          const open = openWeek === week.weekNumber;
          return (
            <li key={week.sessionId} className={cn('rounded-2xl border p-5', done ? 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/50 dark:bg-emerald-900/10' : week.status === 'IN_PROGRESS' ? 'border-rose-200 dark:border-rose-900/50' : 'border-slate-200 dark:border-slate-800')}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex gap-3">
                  <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold', done ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300')}>
                    {done ? <Check className="h-4 w-4" /> : week.weekNumber}
                  </span>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">Week {week.weekNumber}: {week.title}</h3>
                    <p className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <CalendarDays className="h-3 w-3" /> {when(week.scheduledAt)} · {week.durationMins} min
                      {week.meetingUrl && <a href={week.meetingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-rose-600 hover:underline dark:text-rose-400"><Video className="h-3 w-3" /> Join</a>}
                      {week.recordingUrl && <a href={week.recordingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-rose-600 hover:underline dark:text-rose-400">Recording</a>}
                    </p>
                    {done && week.note && <p className="mt-2 rounded-lg bg-white/70 p-2 text-sm text-slate-700 dark:bg-slate-900/60 dark:text-slate-300">{week.note}</p>}
                    {done && week.deliverableUrl && (
                      <a href={week.deliverableUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:underline dark:text-rose-400">
                        What you produced <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {done && week.completedAt && <p className="mt-1 text-xs text-slate-400">Marked done {formatDate(week.completedAt)}</p>}
                  </div>
                </div>
                {!done && !unpaid && !ended && (
                  <button type="button" onClick={() => setOpenWeek(open ? null : week.weekNumber)} className="btn-secondary shrink-0 text-sm">
                    {open ? 'Cancel' : 'Mark done'}
                  </button>
                )}
              </div>

              {open && (
                <div className="mt-4 space-y-3 border-t border-slate-200 pt-4 dark:border-slate-700">
                  <label className="block">
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500">What you did this week</span>
                    <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={2000} placeholder="Ten customer interviews. Three said they would pay today." className="mt-1 w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm dark:border-slate-700" />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500">A link to the deliverable, if there is one</span>
                    <input value={deliverableUrl} onChange={(e) => setDeliverableUrl(e.target.value)} type="url" placeholder="https://" className="mt-1 w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm dark:border-slate-700" />
                  </label>
                  <button type="button" onClick={() => markWeek(week.weekNumber)} disabled={marking === week.weekNumber} className="btn-primary inline-flex items-center gap-2">
                    {marking === week.weekNumber ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Mark week {week.weekNumber} done
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {progress.weeks.length === 0 && (
        <p className="rounded-2xl border border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
          No sessions have been scheduled for this cohort yet. They appear here as the programme is set.
        </p>
      )}

      <p className="text-xs text-slate-500 dark:text-slate-400">
        The certificate is issued once every week is marked done and the cohort has ended, so an early tick-through cannot manufacture a graduation.
      </p>
    </div>
  );
}
