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

function Registrants({ eventId }: { eventId: string }) {
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

export function HostingPanel() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<HostedEvent | null>(null);

  const mine = useQuery({
    queryKey: ['my-events'],
    queryFn: () => api.get('/events/mine'),
    select: (response) => (response.data.data?.hosting ?? []) as HostedEvent[],
  });

  const cancel = useMutation({
    mutationFn: (id: string) => api.delete(`/events/${id}`),
    onSuccess: (response) => {
      const told = (response.data?.data?.registrantsTold as number | undefined) ?? 0;
      queryClient.invalidateQueries({ queryKey: ['my-events'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success(told > 0 ? `Cancelled. ${told} ${told === 1 ? 'person has' : 'people have'} been told.` : 'Cancelled.');
    },
    onError: (error) => toast.error(apiMessage(error, 'The event could not be cancelled. It is still listed.')),
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
          return (
            <li key={event.id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium text-slate-900 dark:text-white">{event.title}</h3>
                    {event.pendingReview ? (
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
                  <p className="mt-1 flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
                    <Users className="h-4 w-4" />
                    {event.attendees} registered
                    {typeof event.maxAttendees === 'number' ? ` of ${event.maxAttendees} places` : ''}
                  </p>
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
                  {!past && (
                    <>
                      <button type="button" className="btn-outline px-3 py-1.5 text-sm" onClick={() => setEditing(event)}>
                        Change
                      </button>
                      <button
                        type="button"
                        className="btn-outline px-3 py-1.5 text-sm text-rose-600"
                        disabled={cancel.isPending}
                        onClick={() => {
                          const who =
                            event.attendees > 0
                              ? ` The ${event.attendees} ${event.attendees === 1 ? 'person' : 'people'} registered will be told in the app.`
                              : '';
                          if (window.confirm(`Cancel "${event.title}"? The listing will be removed.${who}`)) {
                            cancel.mutate(event.id);
                          }
                        }}
                      >
                        {cancel.isPending && cancel.variables === event.id ? 'Cancelling...' : 'Cancel event'}
                      </button>
                    </>
                  )}
                </div>
              </div>
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
