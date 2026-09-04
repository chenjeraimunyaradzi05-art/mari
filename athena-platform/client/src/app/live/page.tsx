'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock, Eye, Radio, Users } from 'lucide-react';
import { livestreamApi, type LiveStream } from '@/lib/api-extensions';
import { useAuthStore } from '@/lib/store';
import { useSocket } from '@/lib/hooks/use-socket';
import { Avatar } from '@/components/ui/avatar';

/**
 * Who is live right now. Updates when a stream starts or ends (the server
 * pushes live:index_changed to everyone on this page) and polls as backup.
 */

const POLL_MS = 20000;

function initials(name: string | null | undefined): string {
  return (name || 'A')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function endedAgo(iso: string | null): string {
  if (!iso) return '';
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 60) return `${Math.max(1, minutes)} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

export default function LiveIndexPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const { socket, connected } = useSocket();
  const [live, setLive] = useState<LiveStream[]>([]);
  const [ended, setEnded] = useState<LiveStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const [liveRes, endedRes] = await Promise.all([
        livestreamApi.list({ status: 'LIVE', limit: 30 }),
        livestreamApi.list({ status: 'ENDED', limit: 6 }),
      ]);
      setLive(Array.isArray(liveRes.data?.data) ? liveRes.data.data : []);
      setEnded(Array.isArray(endedRes.data?.data) ? endedRes.data.data : []);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [authLoading, load]);

  useEffect(() => {
    if (authLoading || !socket || !connected) return;
    const onChange = () => void load();
    socket.on('live:index_changed', onChange);
    socket.emit('live:join_index');
    return () => {
      socket.off('live:index_changed', onChange);
      if (socket.connected) socket.emit('live:leave_index');
    };
  }, [authLoading, socket, connected, load]);

  return (
    <div className="container mx-auto max-w-5xl px-4 py-12">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <Radio className="h-5 w-5" />
            <span className="text-sm font-semibold uppercase tracking-wider">Live</span>
          </div>
          <h1 className="mt-3 text-3xl font-bold text-slate-900 dark:text-white">Live now</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Members streaming right now. Join one to chat, ask questions and send gifts.
          </p>
        </div>
        <Link
          href={isAuthenticated ? '/dashboard/live' : '/login?redirect=%2Fdashboard%2Flive'}
          className="btn-primary inline-flex items-center gap-2 px-4 py-2"
        >
          <Radio className="h-4 w-4" /> Go live
        </Link>
      </div>

      {loading ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 animate-pulse">
          {[0, 1, 2].map((i) => (
            <div key={i} className="aspect-video rounded-xl bg-slate-200 dark:bg-slate-800" />
          ))}
        </div>
      ) : failed ? (
        <p className="mt-8 text-sm text-slate-500">Live streams could not be loaded right now.</p>
      ) : live.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
          <Radio className="mx-auto h-8 w-8 text-slate-300" />
          <h2 className="mt-3 text-lg font-semibold text-slate-900 dark:text-white">Nobody is live right now</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Streams appear here the moment a host goes live. You could be first.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {live.map((stream) => (
            <Link
              key={stream.id}
              href={`/live/${stream.id}`}
              className="group overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="relative aspect-video bg-gradient-to-br from-rose-500 to-purple-600">
                {stream.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- media CDN
                  <img src={stream.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-4xl font-bold text-white/90">
                    {initials(stream.host.displayName)}
                  </div>
                )}
                <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-md bg-red-600 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> Live
                </span>
                <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-md bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
                  <Eye className="h-3 w-3" /> {stream.viewerCount}
                </span>
              </div>
              <div className="flex items-start gap-3 p-4">
                <Avatar src={stream.host.avatar ?? undefined} fallback={initials(stream.host.displayName)} size="sm" />
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900 group-hover:underline dark:text-white">{stream.title}</p>
                  <p className="truncate text-sm text-slate-500 dark:text-slate-400">
                    {stream.host.displayName || 'ATHENA member'}
                    {stream.category ? ` · ${stream.category}` : ''}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {ended.length > 0 && (
        <section className="mt-12">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
            <Clock className="h-4 w-4 text-slate-400" /> Recently ended
          </h2>
          <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            {ended.map((stream) => (
              <li key={stream.id} className="flex items-center gap-3 p-4">
                <Avatar src={stream.host.avatar ?? undefined} fallback={initials(stream.host.displayName)} size="sm" />
                <div className="min-w-0 flex-1">
                  <Link href={`/live/${stream.id}`} className="block truncate font-medium text-slate-900 hover:underline dark:text-white">
                    {stream.title}
                  </Link>
                  <p className="truncate text-xs text-slate-500">
                    {stream.host.displayName || 'ATHENA member'} · ended {endedAgo(stream.endedAt)}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                  <Users className="h-3 w-3" /> {stream.peakViewers} peak
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
