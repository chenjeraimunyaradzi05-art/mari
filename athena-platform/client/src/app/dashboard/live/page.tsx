'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Copy, Eye, Gift, Loader2, Radio, Square, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { livestreamApi, type LiveChatMessage, type LiveStream } from '@/lib/api-extensions';
import { useAuthStore } from '@/lib/store';
import { useSocket } from '@/lib/hooks/use-socket';
import { LivePlayer } from '@/components/live/LivePlayer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * The host's console: prepare a stream, get the encoder details, go live,
 * watch the room, end it. One stream is open at a time; preparing again
 * updates it rather than minting a second key.
 */

const CATEGORIES = [
  { value: '', label: 'No category' },
  { value: 'career', label: 'Career' },
  { value: 'learning', label: 'Learning' },
  { value: 'business', label: 'Business' },
  { value: 'wellbeing', label: 'Wellbeing' },
  { value: 'community', label: 'Community' },
  { value: 'q-and-a', label: 'Q&A' },
];

const errorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

async function copy(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  } catch {
    toast.error(`Could not copy the ${label.toLowerCase()}`);
  }
}

export default function LiveConsolePage() {
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const { socket, connected } = useSocket();
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [current, setCurrent] = useState<LiveStream | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<'start' | 'end' | null>(null);
  const [showKey, setShowKey] = useState(false);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [playbackUrl, setPlaybackUrl] = useState('');

  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [viewers, setViewers] = useState(0);

  const adopt = useCallback((stream: LiveStream | null) => {
    setCurrent(stream);
    if (stream) {
      setTitle(stream.title);
      setCategory(stream.category ?? '');
      setDescription(stream.description ?? '');
      setPlaybackUrl(stream.playbackUrl ?? '');
      setViewers(stream.viewerCount);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await livestreamApi.mine();
      const mine: LiveStream[] = Array.isArray(res.data?.data) ? res.data.data : [];
      setStreams(mine);
      adopt(mine.find((s) => s.status !== 'ENDED') ?? null);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not load your streams'));
    } finally {
      setLoading(false);
    }
  }, [adopt]);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    void load();
  }, [authLoading, isAuthenticated, load]);

  // Sit in the room (the host may before going live) to see chat and counts.
  useEffect(() => {
    const streamId = current?.id;
    if (!streamId || !socket || !connected) return;

    const onMessage = (payload: { streamId?: string; message?: LiveChatMessage }) => {
      if (payload?.streamId === streamId && payload.message) {
        setMessages((prev) => (prev.some((m) => m.id === payload.message!.id) ? prev : [...prev.slice(-99), payload.message!]));
      }
    };
    const onViewers = (payload: { streamId?: string; count?: number }) => {
      if (payload?.streamId === streamId && typeof payload.count === 'number') setViewers(payload.count);
    };
    const onGift = (payload: { streamId?: string; gift?: { name: string; icon: string }; sender?: { displayName: string | null }; totalGiftPoints?: number }) => {
      if (payload?.streamId !== streamId || !payload.gift) return;
      toast(`${payload.gift.icon} ${payload.sender?.displayName || 'Someone'} sent a ${payload.gift.name}`);
      if (typeof payload.totalGiftPoints === 'number') {
        setCurrent((c) => (c ? { ...c, totalGiftPoints: payload.totalGiftPoints as number } : c));
      }
    };

    socket.on('live:message', onMessage);
    socket.on('live:viewers', onViewers);
    socket.on('live:gift', onGift);
    socket.emit('live:join', streamId);
    livestreamApi.messages(streamId, { limit: 50 }).then((r) => setMessages(Array.isArray(r.data?.data) ? r.data.data : [])).catch(() => {});

    return () => {
      socket.off('live:message', onMessage);
      socket.off('live:viewers', onViewers);
      socket.off('live:gift', onGift);
      if (socket.connected) socket.emit('live:leave', streamId);
    };
  }, [current?.id, socket, connected]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) {
      toast.error('Give the stream a title');
      return;
    }
    setSaving(true);
    try {
      const res = await livestreamApi.create({
        title: title.trim(),
        description: description.trim() || undefined,
        category: category || undefined,
        playbackUrl: playbackUrl.trim() || undefined,
      });
      adopt(res.data?.data ?? null);
      toast.success(current ? 'Stream updated' : 'Stream prepared');
      void load();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not save the stream'));
    } finally {
      setSaving(false);
    }
  };

  const goLive = async () => {
    if (!current) return;
    setBusy('start');
    try {
      const res = await livestreamApi.start(current.id);
      adopt(res.data?.data ?? current);
      toast.success('You are live');
    } catch (error) {
      toast.error(errorMessage(error, 'Could not go live'));
    } finally {
      setBusy(null);
    }
  };

  const endStream = async () => {
    if (!current || !window.confirm('End the stream for everyone?')) return;
    setBusy('end');
    try {
      await livestreamApi.end(current.id);
      toast.success('Stream ended');
      setMessages([]);
      await load();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not end the stream'));
    } finally {
      setBusy(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const isLive = current?.status === 'LIVE';
  const ingestConfigured = Boolean(current?.ingestConfigured);
  const publicUrl = current ? `${typeof window !== 'undefined' ? window.location.origin : ''}/live/${current.id}` : '';
  const past = streams.filter((s) => s.status === 'ENDED');

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <Radio className="h-5 w-5" />
            <span className="text-sm font-semibold uppercase tracking-wider">Live</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">Your live console</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Prepare a stream, point your encoder at it, go live. Viewers find it on the Live page.
          </p>
        </div>
        {current && (
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold uppercase tracking-wide',
                isLive ? 'bg-red-600 text-white' : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
              )}
            >
              {isLive && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />}
              {isLive ? 'Live' : 'Ready'}
            </span>
            {isLive ? (
              <Button variant="outline" className="gap-2 text-red-600" onClick={endStream} disabled={busy !== null}>
                <Square className="h-4 w-4" /> {busy === 'end' ? 'Ending...' : 'End stream'}
              </Button>
            ) : (
              <Button className="gap-2" onClick={goLive} disabled={busy !== null}>
                <Radio className="h-4 w-4" /> {busy === 'start' ? 'Starting...' : 'Go live'}
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <form onSubmit={save} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Stream details</h2>
            <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="E.g. Ask me anything about switching into tech" />
            <div>
              <label htmlFor="live-category" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Category
              </label>
              <select
                id="live-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              >
                {CATEGORIES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="live-description" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                What it is about
              </label>
              <textarea
                id="live-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={2000}
                className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>
            {!ingestConfigured && (
              <div>
                <Input
                  label="Playback URL"
                  value={playbackUrl}
                  onChange={(e) => setPlaybackUrl(e.target.value)}
                  placeholder="https://.../index.m3u8"
                />
                <p className="mt-1 text-xs text-slate-500">
                  No ingest server is configured for this site, so stream with a service you already use (Mux, Cloudflare
                  Stream, a YouTube or Twitch HLS link) and paste its playback URL here. Chat, viewer counts and gifts
                  all run here regardless.
                </p>
              </div>
            )}
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : current ? 'Save changes' : 'Prepare stream'}
              </Button>
            </div>
          </form>

          {current && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 dark:border-slate-700 dark:bg-slate-900">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Encoder settings</h2>
              {ingestConfigured ? (
                <>
                  <p className="text-xs text-slate-500">
                    In OBS or Streamlabs choose Custom, then enter the server and key below. The stream goes live here the
                    moment the encoder connects, or when you press Go live.
                  </p>
                  <Field label="Server" value={current.ingestUrl ?? ''} onCopy={() => void copy(current.ingestUrl ?? '', 'Server URL')} />
                  <Field
                    label="Stream key"
                    value={showKey ? current.streamKey ?? '' : '•'.repeat(24)}
                    onCopy={() => void copy(current.streamKey ?? '', 'Stream key')}
                    extra={
                      <button type="button" onClick={() => setShowKey((v) => !v)} className="text-xs text-slate-500 underline">
                        {showKey ? 'Hide' : 'Reveal'}
                      </button>
                    }
                  />
                  <p className="text-xs text-slate-500">Never share the key: anyone holding it can stream as you.</p>
                </>
              ) : (
                <p className="text-xs text-slate-500">
                  Playback is coming from the URL you pasted above. When an ingest server is configured for this site,
                  the RTMP server and your private stream key appear here instead.
                </p>
              )}
              <Field label="Share link" value={publicUrl} onCopy={() => void copy(publicUrl, 'Link')} />
            </div>
          )}
        </div>

        <div className="space-y-4 lg:col-span-2">
          {current && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">On air</h2>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <Eye className="h-3.5 w-3.5" /> {viewers}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Gift className="h-3.5 w-3.5" /> {current.totalGiftPoints} pts
                  </span>
                </div>
              </div>
              <LivePlayer
                src={isLive ? current.playbackUrl : null}
                muted
                className="aspect-video w-full rounded-lg"
                waitingMessage={isLive ? 'Waiting for your encoder...' : 'Your preview appears here once you go live.'}
              />
              <div className="max-h-56 space-y-1 overflow-y-auto text-sm">
                {messages.length === 0 ? (
                  <p className="py-4 text-center text-xs text-slate-500">Chat from viewers shows up here.</p>
                ) : (
                  messages.map((m) => (
                    <p key={m.id} className="break-words text-slate-700 dark:text-slate-300">
                      <span className="mr-1 font-semibold text-slate-900 dark:text-white">{m.user?.displayName || 'Member'}</span>
                      {m.content}
                    </p>
                  ))
                )}
              </div>
              <Link href={`/live/${current.id}`} className="block text-center text-xs font-medium text-rose-600 hover:underline dark:text-rose-400">
                Open the viewer page
              </Link>
            </div>
          )}

          {past.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Past streams</h2>
              <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
                {past.map((s) => (
                  <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900 dark:text-white">{s.title}</p>
                      <p className="text-xs text-slate-500">{s.endedAt ? new Date(s.endedAt).toLocaleString('en-AU') : ''}</p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3 w-3" /> {s.peakViewers}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Gift className="h-3 w-3" /> {s.totalGiftPoints}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onCopy, extra }: { label: string; value: string; onCopy: () => void; extra?: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{label}</span>
        {extra}
      </div>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-800 dark:bg-slate-800 dark:text-slate-200">
          {value || '—'}
        </code>
        <button type="button" onClick={onCopy} aria-label={`Copy ${label}`} className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
          <Copy className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
