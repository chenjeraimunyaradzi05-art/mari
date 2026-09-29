'use client';

/**
 * The events she hosts: who is coming, changing a listing, calling it off.
 *
 * The events page told a host her attendees were on a list, and there was no
 * list — no route returned one, to her or to staff — and a listing, once
 * written, could not be changed or cancelled from anywhere in the product.
 * This panel is built on GET /api/events/mine and the host routes beside it.
 *
 * The list of names is deliberately thin. It is the name each woman shows the
 * platform and when she registered; a woman with Safe Mode on, a private
 * profile, or a block either way with the host is counted but not named. A
 * list of who will be in a given room at a given hour is exactly what someone
 * looking for a woman who has left would want, and a host is a member like
 * any other.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { CalendarCheck, Loader2, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui';
import { EditHostedEventDialog, type HostedEvent } from './EditHostedEventDialog';
import { AddToCalendar } from '@/components/events/AddToCalendar';

type Registrant = { id: string; registeredAt: string; name: string | null; nameWithheld: boolean };
type RegistrationList = { total: number; withheld: number; registrations: Registrant[] };

function apiMessage(error: unknown, fallback: string): string {
  const payload = (error as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
  return payload?.message || payload?.error || fallback;
}

function startOfToday(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

/**
 * Who has registered. Shared with the admin events console, where the server
 * returns full names instead, because staff are the ones who act on a report.
 */
export function Registrants({ eventId }: { eventId: string }) {
  const list = useQuery({
    queryKey: ['event-registrations', eventId],
    queryFn: () => api.get(`/events/${eventId}/registrations`),
    select: (response) => response.data.data as RegistrationList,
  });

  if (list.isLoading) {
    return <Loader2 className="mt-3 h-4 w-4 animate-spin text-slate-400" aria-label="Loading who is coming" />;
  }
  if (list.isError || !list.data) {
    return (
      <p className="mt-3 text-sm text-slate-600 dark:text-slate-300" role="alert">
        The list did not load. Nobody has been removed from it.{' '}
        <button type="button" onClick={() => list.refetch()} className="font-medium text-primary-600 hover:underline">
          Try again
        </button>
      </p>
    );
  }
  if (list.data.total === 0) {
    return <p className="mt-3 text-sm text-slate-500">Nobody has registered yet.</p>;
  }

  const named = list.data.registrations.filter((r) => !r.nameWithheld);
  return (
    <div className="mt-3 space-y-2 text-sm">
      {named.length > 0 && (
        <ul className="grid gap-1 sm:grid-cols-2">
          {named.map((r) => (
            <li key={r.id} className="text-slate-700 dark:text-slate-300">
              {r.name}
              <span className="ml-2 text-xs text-slate-400">registered {format(new Date(r.registeredAt), 'd MMM')}</span>
            </li>
          ))}
        </ul>
      )}
      {list.data.withheld > 0 && (
        <p className="text-xs text-slate-500">
          {list.data.withheld} {list.data.withheld === 1 ? 'person has' : 'people have'} registered without showing a
          name, because of their privacy settings. They are counted in your numbers.
        </p>
      )}
    </div>
  );
}

/**
 * The reasons a host can give. The server takes these codes and nothing else
 * from a host: the reason goes to every woman who registered with nobody
 * reading it first, so a free-text box would be a way to send them all a new
 * address without the review a change of place goes through.
 */
const CANCEL_REASONS = [
  { value: 'HOST_UNAVAILABLE', label: 'I can no longer run it' },
  { value: 'VENUE_UNAVAILABLE', label: 'The venue is no longer available' },
  { value: 'TOO_FEW_REGISTERED', label: 'Not enough people registered' },
  { value: 'OTHER', label: 'Another reason' },
] as const;
type CancelReason = (typeof CANCEL_REASONS)[number]['value'];

function CancelForm({
  event,
  pending,
  onCancel,
  onClose,
}: {
  event: HostedEvent;
  pending: boolean;
  onCancel: (reason: CancelReason) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<CancelReason>('HOST_UNAVAILABLE');
  const who =
    event.attendees > 0
      ? `The ${event.attendees} ${event.attendees === 1 ? 'person' : 'people'} registered will be told in the app, with the reason you choose.`
      : 'Nobody has registered yet.';
  return (
    <form
      className="mt-3 space-y-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm dark:border-rose-900/50 dark:bg-rose-950/30"
      onSubmit={(e) => {
        e.preventDefault();
        onCancel(reason);
      }}
    >
      <p className="text-slate-700 dark:text-slate-200">
        Cancel &ldquo;{event.title}&rdquo;? It stays on the events page marked as cancelled, so anyone who registered can
        see what happened to it. {who} This cannot be undone.
      </p>
      <label className="block">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Why it is not going ahead</span>
        <select value={reason} onChange={(e) => setReason(e.target.value as CancelReason)} className="input mt-1 w-full">
          {CANCEL_REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className="btn-primary bg-rose-600 px-3 py-1.5 text-sm hover:bg-rose-700">
          {pending ? 'Cancelling...' : 'Cancel the event'}
        </button>
        <button type="button" onClick={onClose} disabled={pending} className="btn-outline px-3 py-1.5 text-sm">
          Keep it on
        </button>
      </div>
    </form>
  );
}

export function HostingPanel() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<HostedEvent | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const mine = useQuery({
    queryKey: ['my-events'],
    queryFn: () => api.get('/events/mine'),
    select: (response) => (response.data.data?.hosting ?? []) as HostedEvent[],
  });

  const cancel = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: CancelReason }) => api.post(`/events/${id}/cancel`, { reason }),
    onSuccess: (response) => {
      const told = (response.data?.data?.registrantsTold as number | undefined) ?? 0;
      setCancelling(null);
      queryClient.invalidateQueries({ queryKey: ['my-events'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success(told > 0 ? `Cancelled. ${told} ${told === 1 ? 'person has' : 'people have'} been told.` : 'Cancelled.');
    },
    onError: (error) => toast.error(apiMessage(error, 'The event could not be cancelled. It is still on.')),
  });

  // Nothing to show a member who has never hosted: the panel only appears
  // once there is something in it, or when loading it failed.
  if (mine.isLoading) return null;
  if (mine.isError) {
    return (
      <div className="card text-sm text-slate-600 dark:text-slate-300" role="alert">
        The events you host did not load.{' '}
        <button type="button" onClick={() => mine.refetch()} className="font-medium text-primary-600 hover:underline">
          Try again
        </button>
      </div>
    );
  }
  const hosting = mine.data ?? [];
  if (hosting.length === 0) return null;

  const today = startOfToday();

  return (
    <section className="card space-y-4" aria-labelledby="hosting-heading">
      <div className="flex items-center gap-2">
        <CalendarCheck className="h-5 w-5 text-primary-600" />
        <h2 id="hosting-heading" className="text-lg font-semibold text-slate-900 dark:text-white">
          Events you are hosting
        </h2>
      </div>

      <ul className="divide-y divide-slate-200 dark:divide-slate-700">
        {hosting.map((event) => {
          const past = new Date(event.date).getTime() < today;
          const cancelled = Boolean(event.isCancelled);
          return (
            <li key={event.id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium text-slate-900 dark:text-white">{event.title}</h3>
                    {cancelled ? (
                      <Badge variant="default" className="bg-rose-600">Cancelled</Badge>
                    ) : event.pendingReview ? (
                      <Badge variant="default" className="bg-amber-500">Waiting on review</Badge>
                    ) : past ? (
                      <Badge variant="secondary">Finished</Badge>
                    ) : (
                      <Badge variant="default" className="bg-emerald-600">Published</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {format(new Date(event.date), 'EEEE d MMMM yyyy')} · {event.startTime} to {event.endTime}
                  </p>
                  {cancelled && (
                    <p className="mt-1 text-sm text-rose-700 dark:text-rose-300">
                      Cancelled{event.cancelledAt ? ` on ${format(new Date(event.cancelledAt), 'd MMMM')}` : ''}.
                      {event.cancelledReason ? ` ${event.cancelledReason}` : ''}
                    </p>
                  )}
                  <p className="mt-1 flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
                    <Users className="h-4 w-4" />
                    {event.attendees} registered
                    {typeof event.maxAttendees === 'number' ? ` of ${event.maxAttendees} places` : ''}
                  </p>
                  {!past && !cancelled && (
                    <div className="mt-2">
                      <AddToCalendar eventId={event.id} align="start" />
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-outline px-3 py-1.5 text-sm"
                    aria-expanded={open === event.id}
                    onClick={() => setOpen(open === event.id ? null : event.id)}
                  >
                    {open === event.id ? 'Hide the list' : 'Who is coming'}
                  </button>
                  {!past && !cancelled && (
                    <>
                      <button type="button" className="btn-outline px-3 py-1.5 text-sm" onClick={() => setEditing(event)}>
                        Change
                      </button>
                      <button
                        type="button"
                        className="btn-outline px-3 py-1.5 text-sm text-rose-600"
                        aria-expanded={cancelling === event.id}
                        onClick={() => setCancelling(cancelling === event.id ? null : event.id)}
                      >
                        Cancel event
                      </button>
                    </>
                  )}
                </div>
              </div>
              {cancelling === event.id && !cancelled && (
                <CancelForm
                  event={event}
                  pending={cancel.isPending && cancel.variables?.id === event.id}
                  onCancel={(reason) => cancel.mutate({ id: event.id, reason })}
                  onClose={() => setCancelling(null)}
                />
              )}
              {open === event.id && <Registrants eventId={event.id} />}
            </li>
          );
        })}
      </ul>

      <EditHostedEventDialog event={editing} onClose={() => setEditing(null)} />
    </section>
  );
}

export default HostingPanel;
