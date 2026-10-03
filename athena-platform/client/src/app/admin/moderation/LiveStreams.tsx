'use client';

/**
 * Live streams, for the moderators.
 *
 * Until this a stream that broke the rules could be stopped by one person only:
 * its host. A moderator with a report in front of her could uphold it and then do
 * nothing to the broadcast it was about. Deciding a report on a stream now ends
 * it; this is the direct way in, for one nobody has reported yet, and for putting
 * one back when a decision is reversed. Ending a stream is for good (it cannot be
 * restarted and the host's key is refused), so it asks why and says so first.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { Loader2, Radio } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

type StaffStream = {
  id: string;
  title: string;
  status: 'SCHEDULED' | 'LIVE' | 'ENDED';
  viewerCount: number;
  messageCount: number;
  startedAt: string | null;
  endedAt: string | null;
  suspendedAt: string | null;
  suspendedReason: string | null;
  host: { id: string; displayName: string | null };
};

const errorMessage = (error: unknown) =>
  (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.message ??
  (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.error;

export function LiveStreamsPanel() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<'live' | 'taken-down'>('live');
  const [endingId, setEndingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const streams = useQuery({
    queryKey: ['admin-livestreams', view],
    queryFn: () => api.get('/admin/moderation/livestreams', { params: view === 'taken-down' ? { suspended: true } : {} }),
    select: (response) => (Array.isArray(response.data?.streams) ? response.data.streams : []) as StaffStream[],
  });

  const end = useMutation({
    mutationFn: ({ id, why }: { id: string; why: string }) => api.post(`/admin/moderation/livestreams/${id}/suspend`, { reason: why }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-livestreams'] });
      setEndingId(null);
      setReason('');
      toast.success('Stream ended');
    },
    onError: (error) => toast.error(errorMessage(error) || 'Could not end that stream'),
  });

  const putBack = useMutation({
    mutationFn: (id: string) => api.post(`/admin/moderation/livestreams/${id}/lift`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-livestreams'] });
      toast.success('Stream put back. It is still ended; its host can prepare a new one.');
    },
    onError: (error) => toast.error(errorMessage(error) || 'Could not put that stream back'),
  });

  const rows = streams.data ?? [];

  return (
    <section id="live-streams" className="mb-8 scroll-mt-6" aria-labelledby="live-streams-heading">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="live-streams-heading" className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
          <Radio className="h-5 w-5 text-rose-600" /> Live streams
        </h2>
        <div className="flex gap-2" role="tablist" aria-label="Which streams">
          {(['live', 'taken-down'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={view === tab}
              onClick={() => {
                setView(tab);
                setEndingId(null);
              }}
              className={cn(
                'rounded-full px-3 py-1 text-sm font-medium',
                view === tab ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
              )}
            >
              {tab === 'live' ? 'Live now' : 'Taken down'}
            </button>
          ))}
        </div>
      </div>

      {streams.isLoading ? (
        <div className="flex justify-center rounded-xl border border-slate-200 bg-white py-6 dark:border-slate-700 dark:bg-slate-900">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : streams.isError ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">
          The streams could not be loaded. Do not read that as nothing being live: refresh, and tell an administrator if it
          keeps failing.
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">
          {view === 'live' ? 'Nobody is live right now.' : 'No stream has been taken down.'}
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-700 dark:bg-slate-900">
          {rows.map((stream) => (
            <li key={stream.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 dark:text-white">{stream.title}</p>
                  <p className="text-xs text-slate-500">
                    <Link href={`/profile/${stream.host.id}`} className="hover:underline">
                      {stream.host.displayName?.trim() || 'Member'}
                    </Link>
                    {view === 'live'
                      ? ` · ${stream.viewerCount} watching · ${stream.messageCount} chat messages${
                          stream.startedAt ? ` · started ${formatDistanceToNow(new Date(stream.startedAt), { addSuffix: true })}` : ''
                        }`
                      : stream.suspendedAt
                        ? ` · ended ${formatDistanceToNow(new Date(stream.suspendedAt), { addSuffix: true })}`
                        : ''}
                  </p>
                  {view === 'taken-down' && stream.suspendedReason && (
                    <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-300">Reason on record: {stream.suspendedReason}</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  {view === 'live' && stream.status === 'LIVE' && (
                    <>
                      <Link href={`/live/${stream.id}`} target="_blank" className="btn-outline px-3 py-1.5 text-sm">
                        Watch
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setEndingId(stream.id);
                          setReason('');
                        }}
                        className="btn-outline px-3 py-1.5 text-sm text-red-600"
                      >
                        End stream
                      </button>
                    </>
                  )}
                  {view === 'taken-down' && (
                    <button
                      type="button"
                      disabled={putBack.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            'Put this stream back? It stays ended, but it will be listed and open to view again, and its key may push. Use this for a decision reversed on appeal.'
                          )
                        ) {
                          putBack.mutate(stream.id);
                        }
                      }}
                      className="btn-outline px-3 py-1.5 text-sm"
                    >
                      Put back
                    </button>
                  )}
                </div>
              </div>

              {endingId === stream.id && (
                <form
                  className="mt-3 space-y-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!reason.trim()) return;
                    end.mutate({ id: stream.id, why: reason.trim() });
                  }}
                >
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    This ends the stream for everyone and for good: it cannot be restarted, it will not be listed, and its host
                    key stops working. The host is told that our team ended it. What you write here is kept on record and is
                    not shown to the host.
                  </p>
                  <textarea
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    rows={2}
                    maxLength={500}
                    required
                    placeholder="Why this stream is being ended"
                    aria-label="Why this stream is being ended"
                    className="input w-full text-sm"
                  />
                  <div className="flex gap-2">
                    <button type="submit" disabled={end.isPending || !reason.trim()} className="btn-primary px-3 py-1.5 text-sm">
                      {end.isPending ? 'Ending...' : 'End it for good'}
                    </button>
                    <button type="button" onClick={() => setEndingId(null)} className="text-sm text-slate-500 hover:underline">
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default LiveStreamsPanel;
