'use client';

/**
 * Events, from the platform's side.
 *
 * This console could pin, feature and hide a listing and nothing else. Staff
 * could not change a listing, call one off, or see who was coming to it —
 * the routes for all three existed and were tested, and nothing in the product
 * reached them, so the only way to fix a wrong date or stop an event was SQL.
 *
 * Changing and cancelling go through the same routes the host uses
 * (PATCH /api/events/:id and POST /api/events/:id/cancel). Those are the ones
 * that tell every registrant, keep a copy of the listing for any report made
 * about it, and record the staff action; the older /admin/events write routes
 * do none of that, so they are used here only for the pin, feature and hide
 * switches they were built for.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Ban, ChevronLeft, Eye, EyeOff, Pencil, Pin, PinOff, Star, StarOff, Calendar, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { EditHostedEventDialog, type HostedEvent } from '@/app/dashboard/events/EditHostedEventDialog';
import { Registrants } from '@/app/dashboard/events/HostingPanel';

interface EventRow {
  id: string;
  title: string;
  description: string;
  type: string;
  format: string;
  date: string;
  startTime: string;
  endTime: string;
  hostName: string;
  hostUserId: string | null;
  isFeatured: boolean;
  isPinned: boolean;
  isHidden: boolean;
  cancelledAt: string | null;
  cancelledReason: string | null;
}

interface EventsResponse {
  events: EventRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

type Toggle = Partial<Pick<EventRow, 'isFeatured' | 'isPinned' | 'isHidden'>>;

function apiMessage(error: unknown, fallback: string): string {
  const payload = (error as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
  return payload?.message || payload?.error || fallback;
}

function startOfToday(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

/**
 * Staff write their own reason. It goes to every woman who registered and to
 * the host, word for word, so the form says so.
 */
function CancelForm({
  event,
  pending,
  onCancel,
  onClose,
}: {
  event: EventRow;
  pending: boolean;
  onCancel: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const ready = reason.trim().length >= 3;
  return (
    <form
      className="mt-4 space-y-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm dark:border-rose-900/50 dark:bg-rose-950/30"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onCancel(reason.trim());
      }}
    >
      <p className="text-slate-700 dark:text-slate-200">
        Cancel &ldquo;{event.title}&rdquo;? It stays listed, marked as cancelled, until its day has passed. Everyone who
        registered is told in the app{event.hostUserId ? ', and so is the member who is hosting it' : ''}. This cannot be
        undone.
      </p>
      <label className="block">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
          Why it is not going ahead. Registrants read this exactly as written.
        </span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          maxLength={500}
          required
          className="input mt-1 w-full"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={pending || !ready} className="bg-rose-600 text-white hover:bg-rose-700">
          {pending ? 'Cancelling...' : 'Cancel the event'}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={pending}>
          Keep it on
        </Button>
      </div>
    </form>
  );
}

export default function AdminEventsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [hidden, setHidden] = useState<'all' | 'true' | 'false'>('all');
  const [attendeesOf, setAttendeesOf] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [editing, setEditing] = useState<HostedEvent | null>(null);
  const [loadingEdit, setLoadingEdit] = useState<string | null>(null);

  const params = useMemo(() => {
    const qs = new URLSearchParams({
      page: String(page),
      limit: '20',
      search: search.trim(),
    });
    if (hidden !== 'all') qs.set('hidden', hidden);
    return qs.toString();
  }, [page, search, hidden]);

  const { data, isLoading, isError, refetch } = useQuery<EventsResponse>({
    queryKey: ['admin-events', page, search, hidden],
    queryFn: async () => {
      const response = await api.get(`/admin/events?${params}`);
      return response.data;
    },
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-events'] });
    queryClient.invalidateQueries({ queryKey: ['events'] });
  };

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Toggle }) => {
      await api.patch(`/admin/events/${id}`, data);
    },
    onSuccess: refresh,
    // A switch that silently did nothing looked exactly like one that worked.
    onError: (error) => toast.error(apiMessage(error, 'That change was not saved.')),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.post(`/events/${id}/cancel`, { reason }),
    onSuccess: (response) => {
      const told = (response.data?.data?.registrantsTold as number | undefined) ?? 0;
      setCancelling(null);
      refresh();
      toast.success(told > 0 ? `Cancelled. ${told} ${told === 1 ? 'person has' : 'people have'} been told.` : 'Cancelled. Nobody had registered.');
    },
    onError: (error) => toast.error(apiMessage(error, 'The event could not be cancelled. It is still on.')),
  });

  // The edit dialog works on the listing as members see it (with the count
  // of who is registered, which the cap cannot go below), so it is fetched
  // fresh rather than pieced together from this table's row.
  const openEditor = async (id: string) => {
    setLoadingEdit(id);
    try {
      const response = await api.get(`/events/${id}`);
      setEditing(response.data?.data as HostedEvent);
    } catch (error) {
      toast.error(apiMessage(error, 'The listing did not load, so it cannot be changed just now.'));
    } finally {
      setLoadingEdit(null);
    }
  };

  const today = startOfToday();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <header className="bg-white dark:bg-slate-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-slate-500 hover:text-slate-700" aria-label="Back to admin">
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Events</h1>
              <p className="text-slate-600 dark:text-slate-400">
                Feature, pin or hide a listing; change it, call it off, or see who is coming.
              </p>
            </div>
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
          <div className="flex-1">
            <Input
              placeholder="Search events..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <select
            value={hidden}
            onChange={(e) => {
              setHidden(e.target.value as 'all' | 'true' | 'false');
              setPage(1);
            }}
            className="input w-full md:w-48"
            aria-label="Visibility"
          >
            <option value="all">All</option>
            <option value="false">Visible</option>
            <option value="true">Hidden or waiting on review</option>
          </select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : isError || !data ? (
          // A failed load is not an empty catalogue; "No events found" here
          // would tell staff there was nothing to moderate.
          <div className="rounded-lg bg-white p-10 text-center shadow dark:bg-slate-800" role="alert">
            <p className="font-medium text-slate-900 dark:text-white">The events did not load.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {data.events.map((event) => {
              const cancelled = Boolean(event.cancelledAt);
              const past = new Date(event.date).getTime() < today;
              return (
                <div
                  key={event.id}
                  className={`bg-white dark:bg-slate-800 rounded-lg shadow p-6 ${
                    event.isHidden ? 'opacity-60 border-2 border-red-300' : ''
                  }`}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <Calendar className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-medium text-slate-900 dark:text-white">{event.title}</span>
                          <span className="text-xs text-slate-500">{event.type.toLowerCase()}</span>
                          <span className="text-xs text-slate-500">{event.format.toLowerCase().replace('_', ' ')}</span>
                          {cancelled && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-100 text-rose-800">
                              Cancelled
                            </span>
                          )}
                          {event.isHidden && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                              {event.hostUserId ? 'Hidden or waiting on review' : 'Hidden'}
                            </span>
                          )}
                          {event.isPinned && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                              Pinned
                            </span>
                          )}
                          {event.isFeatured && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              Featured
                            </span>
                          )}
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 text-sm line-clamp-2">{event.description}</p>
                        <div className="text-xs text-slate-500 mt-2">
                          {new Date(event.date).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                          {' · '}
                          {event.startTime} to {event.endTime}
                          {' · '}
                          {event.hostUserId ? `Hosted by member ${event.hostName}` : `Curated: ${event.hostName}`}
                        </div>
                        {cancelled && (
                          <p className="mt-2 text-sm text-rose-700 dark:text-rose-300">
                            Cancelled {new Date(event.cancelledAt!).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}.
                            {event.cancelledReason ? ` ${event.cancelledReason}` : ''}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        aria-expanded={attendeesOf === event.id}
                        onClick={() => setAttendeesOf(attendeesOf === event.id ? null : event.id)}
                      >
                        <Users className="h-4 w-4 mr-1" />
                        {attendeesOf === event.id ? 'Hide the list' : 'Who is coming'}
                      </Button>
                      {!cancelled && !past && (
                        <>
                          <Button variant="outline" size="sm" disabled={loadingEdit === event.id} onClick={() => void openEditor(event.id)}>
                            <Pencil className="h-4 w-4 mr-1" />
                            {loadingEdit === event.id ? 'Opening...' : 'Change'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-rose-700"
                            aria-expanded={cancelling === event.id}
                            onClick={() => setCancelling(cancelling === event.id ? null : event.id)}
                          >
                            <Ban className="h-4 w-4 mr-1" />
                            Cancel
                          </Button>
                        </>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={updateMutation.isPending}
                        onClick={() => updateMutation.mutate({ id: event.id, data: { isPinned: !event.isPinned } })}
                      >
                        {event.isPinned ? <PinOff className="h-4 w-4 mr-1" /> : <Pin className="h-4 w-4 mr-1" />}
                        {event.isPinned ? 'Unpin' : 'Pin'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={updateMutation.isPending}
                        onClick={() => updateMutation.mutate({ id: event.id, data: { isFeatured: !event.isFeatured } })}
                      >
                        {event.isFeatured ? <StarOff className="h-4 w-4 mr-1" /> : <Star className="h-4 w-4 mr-1" />}
                        {event.isFeatured ? 'Unfeature' : 'Feature'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={updateMutation.isPending}
                        onClick={() => updateMutation.mutate({ id: event.id, data: { isHidden: !event.isHidden } })}
                      >
                        {event.isHidden ? <Eye className="h-4 w-4 mr-1" /> : <EyeOff className="h-4 w-4 mr-1" />}
                        {event.isHidden ? 'Unhide' : 'Hide'}
                      </Button>
                    </div>
                  </div>
                  {cancelling === event.id && !cancelled && (
                    <CancelForm
                      event={event}
                      pending={cancelMutation.isPending && cancelMutation.variables?.id === event.id}
                      onCancel={(reason) => cancelMutation.mutate({ id: event.id, reason })}
                      onClose={() => setCancelling(null)}
                    />
                  )}
                  {attendeesOf === event.id && (
                    <div className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-700">
                      <Registrants eventId={event.id} />
                    </div>
                  )}
                </div>
              );
            })}

            {data.events.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                {search.trim() || hidden !== 'all' ? 'No events match that search.' : 'No events have been listed yet.'}
              </div>
            )}
          </div>
        )}

        {data && data.pagination.totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-slate-500">
              Page {data.pagination.page} of {data.pagination.totalPages}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.pagination.totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </main>

      <EditHostedEventDialog event={editing} onClose={() => setEditing(null)} asStaff />
    </div>
  );
}
