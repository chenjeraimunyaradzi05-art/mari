'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Eye, Gift, Radio, Send, Trophy, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { livestreamApi, type LiveChatMessage, type LiveStream } from '@/lib/api-extensions';
import { useAuthStore } from '@/lib/store';
import { useSocket } from '@/lib/hooks/use-socket';
import { LivePlayer } from '@/components/live/LivePlayer';
import { Avatar } from '@/components/ui/avatar';
import { renderSocialText } from '@/lib/social-text';
import { cn } from '@/lib/utils';

/**
 * Watch a live stream: the player, the room's chat, the viewer count and
 * gifts. Chat and counts arrive over the stream's socket room; the page
 * polls the stream every fifteen seconds as well, so a viewer without a
 * socket (signed out) still sees the status change.
 */

type GiftOption = { id: string; name: string; value: number; icon: string; description: string };

type Row =
  | { kind: 'chat'; id: string; message: LiveChatMessage }
  | { kind: 'gift'; id: string; text: string; icon: string }
  | { kind: 'system'; id: string; text: string };

const POLL_MS = 15000;
const MAX_ROWS = 300;

function initials(name: string | null | undefined): string {
  return (name || 'A')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

const errorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

export default function LiveWatchPage() {
  const params = useParams<{ id: string }>();
  const streamId = params?.id;
  const { user, isAuthenticated, isLoading: authLoading } = useAuthStore();
  const { socket, connected } = useSocket();

  const [stream, setStream] = useState<LiveStream | null>(null);
  const [missing, setMissing] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [viewers, setViewers] = useState(0);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [gifts, setGifts] = useState<GiftOption[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [showGifts, setShowGifts] = useState(false);
  const [gifting, setGifting] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<Array<{ rank: number; user: { id: string; displayName: string | null }; points: number }>>([]);
  const [ending, setEnding] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const append = useCallback((row: Row) => {
    setRows((prev) => {
      if (prev.some((r) => r.id === row.id)) return prev;
      const next = [...prev, row];
      return next.length > MAX_ROWS ? next.slice(next.length - MAX_ROWS) : next;
    });
  }, []);

  const loadStream = useCallback(async () => {
    if (!streamId) return;
    try {
      const res = await livestreamApi.get(streamId);
      const data: LiveStream | undefined = res.data?.data;
      if (!data) throw new Error('missing');
      setStream(data);
      setViewers((current) => Math.max(current, data.viewerCount));
    } catch (error) {
      if ((error as { response?: { status?: number } })?.response?.status === 404) setMissing(true);
    }
  }, [streamId]);

  useEffect(() => {
    if (authLoading || !streamId) return;
    void loadStream();
    livestreamApi
      .messages(streamId, { limit: 100 })
      .then((res) => {
        const list: LiveChatMessage[] = Array.isArray(res.data?.data) ? res.data.data : [];
        setRows(list.map((message) => ({ kind: 'chat', id: message.id, message })));
      })
      .catch(() => {});
    const timer = setInterval(() => void loadStream(), POLL_MS);
    return () => clearInterval(timer);
  }, [authLoading, streamId, loadStream]);

  useEffect(() => {
    if (!isAuthenticated) return;
    livestreamApi.gifts().then((r) => setGifts(Array.isArray(r.data?.data) ? r.data.data : [])).catch(() => {});
    livestreamApi.wallet().then((r) => setBalance(Number(r.data?.data?.balance) || 0)).catch(() => {});
  }, [isAuthenticated]);

  // The room: chat, viewer count, gifts and status changes. Keyed on the
  // socket instance and its connection, so a replaced or reconnected socket
  // re-joins the room.
  useEffect(() => {
    if (authLoading || !streamId || !socket || !connected) return;

    const onMessage = (payload: { streamId?: string; message?: LiveChatMessage }) => {
      if (payload?.streamId !== streamId || !payload.message) return;
      append({ kind: 'chat', id: payload.message.id, message: payload.message });
    };
    const onViewers = (payload: { streamId?: string; count?: number }) => {
      if (payload?.streamId === streamId && typeof payload.count === 'number') setViewers(payload.count);
    };
    const onGift = (payload: {
      streamId?: string;
      gift?: { name: string; icon: string; value: number };
      sender?: { id: string; displayName: string | null };
      totalGiftPoints?: number;
      at?: string;
    }) => {
      if (payload?.streamId !== streamId || !payload.gift) return;
      append({
        kind: 'gift',
        id: `gift-${payload.at ?? Date.now()}-${payload.sender?.id ?? ''}`,
        icon: payload.gift.icon,
        text: `${payload.sender?.displayName || 'Someone'} sent a ${payload.gift.name}`,
      });
      if (typeof payload.totalGiftPoints === 'number') {
        setStream((current) => (current ? { ...current, totalGiftPoints: payload.totalGiftPoints as number } : current));
      }
    };
    const onStatus = (payload: { streamId?: string; status?: LiveStream['status'] }) => {
      if (payload?.streamId !== streamId || !payload.status) return;
      setStream((current) => (current ? { ...current, status: payload.status as LiveStream['status'] } : current));
      append({
        kind: 'system',
        id: `status-${payload.status}-${Date.now()}`,
        text: payload.status === 'LIVE' ? 'The stream has started' : 'The stream has ended',
      });
      void loadStream();
    };
    const onError = (payload: { message?: string }) => {
      if (payload?.message) toast.error(payload.message);
    };

    socket.on('live:message', onMessage);
    socket.on('live:viewers', onViewers);
    socket.on('live:gift', onGift);
    socket.on('live:status', onStatus);
    socket.on('live:error', onError);
    socket.emit('live:join', streamId);

    return () => {
      socket.off('live:message', onMessage);
      socket.off('live:viewers', onViewers);
      socket.off('live:gift', onGift);
      socket.off('live:status', onStatus);
      socket.off('live:error', onError);
      if (socket.connected) socket.emit('live:leave', streamId);
    };
  }, [authLoading, streamId, socket, connected, append, loadStream]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [rows.length]);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !streamId || sending) return;
    setSending(true);
    try {
      if (socket?.connected) {
        socket.emit('live:chat', { streamId, content });
      } else {
        const res = await livestreamApi.say(streamId, content);
        const message: LiveChatMessage | undefined = res.data?.data;
        if (message) append({ kind: 'chat', id: message.id, message });
      }
      setDraft('');
    } catch (error) {
      toast.error(errorMessage(error, 'Message not sent'));
    } finally {
      setSending(false);
    }
  };

  const sendGift = async (gift: GiftOption) => {
    if (!streamId) return;
    setGifting(gift.id);
    try {
      const res = await livestreamApi.gift(streamId, gift.id);
      const next = res.data?.data;
      if (typeof next?.balance === 'number') setBalance(next.balance);
      toast.success(`${gift.icon} ${gift.name} sent`);
      setShowGifts(false);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not send the gift'));
    } finally {
      setGifting(null);
    }
  };

  const loadLeaderboard = async () => {
    if (!streamId) return;
    try {
      const res = await livestreamApi.leaderboard(streamId, { limit: 5 });
      setLeaderboard(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch {
      setLeaderboard([]);
    }
  };

  const endStream = async () => {
    if (!stream || !window.confirm('End the stream for everyone?')) return;
    setEnding(true);
    try {
      const res = await livestreamApi.end(stream.id);
      if (res.data?.data) setStream(res.data.data);
      toast.success('Stream ended');
    } catch (error) {
      toast.error(errorMessage(error, 'Could not end the stream'));
    } finally {
      setEnding(false);
    }
  };

  const isLive = stream?.status === 'LIVE';
  const hostName = stream?.host.displayName || 'ATHENA member';
  const canChat = isAuthenticated && (isLive || stream?.isHost);

  const playerMessage = useMemo(() => {
    if (!stream) return undefined;
    if (stream.status === 'SCHEDULED') return `${hostName} has not started yet. Stay here and it will begin on its own.`;
    if (stream.status === 'ENDED') return 'This stream has ended.';
    return 'Waiting for the host to start streaming...';
  }, [stream, hostName]);

  if (missing) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-16 text-center">
        <Radio className="mx-auto h-8 w-8 text-slate-300" />
        <h1 className="mt-3 text-xl font-semibold text-slate-900 dark:text-white">Stream not found</h1>
        <p className="mt-1 text-slate-500">It may have been removed, or the link is wrong.</p>
        <Link href="/live" className="btn-primary mt-4 inline-flex px-4 py-2">
          See who is live
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6">
      <Link href="/live" className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
        &larr; All live streams
      </Link>

      <div className="mt-4 grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <LivePlayer
            src={isLive ? stream?.playbackUrl : null}
            poster={stream?.thumbnailUrl}
            waitingMessage={playerMessage}
            className="aspect-video w-full rounded-xl"
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              {stream ? (
                <Link href={`/profile/${stream.hostId}`}>
                  <Avatar src={stream.host.avatar ?? undefined} fallback={initials(hostName)} size="md" />
                </Link>
              ) : null}
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">{stream?.title ?? 'Loading...'}</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {stream ? (
                    <Link href={`/profile/${stream.hostId}`} className="hover:underline">
                      {hostName}
                    </Link>
                  ) : null}
                  {stream?.category ? ` · ${stream.category}` : ''}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold uppercase tracking-wide',
                  isLive ? 'bg-red-600 text-white' : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                )}
              >
                {isLive && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />}
                {stream?.status === 'SCHEDULED' ? 'Starting soon' : stream?.status === 'ENDED' ? 'Ended' : 'Live'}
              </span>
              <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300">
                <Eye className="h-4 w-4" /> {isLive ? viewers : stream?.peakViewers ?? 0}
                {!isLive && ' peak'}
              </span>
              <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300">
                <Gift className="h-4 w-4" /> {stream?.totalGiftPoints ?? 0} pts
              </span>
              {stream?.isHost && stream.status !== 'ENDED' && (
                <button type="button" onClick={endStream} disabled={ending} className="btn-outline px-3 py-1 text-xs text-red-600">
                  {ending ? 'Ending...' : 'End stream'}
                </button>
              )}
            </div>
          </div>

          {stream?.description && (
            <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{renderSocialText(stream.description)}</p>
          )}

          {stream?.isHost && (
            <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              You are the host. Stream settings, your key and the encoder details are in{' '}
              <Link href="/dashboard/live" className="font-medium underline">
                your live console
              </Link>
              .
            </p>
          )}
        </div>

        {/* Chat */}
        <div className="flex h-[70vh] flex-col rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:h-[calc(100vh-8rem)]">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <Users className="h-4 w-4" /> Live chat
            </h2>
            <button
              type="button"
              onClick={() => void loadLeaderboard()}
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            >
              <Trophy className="h-3.5 w-3.5" /> Top gifters
            </button>
          </div>

          {leaderboard.length > 0 && (
            <ol className="border-b border-slate-200 px-4 py-2 text-xs dark:border-slate-800">
              {leaderboard.map((entry) => (
                <li key={entry.user.id} className="flex justify-between py-0.5 text-slate-600 dark:text-slate-300">
                  <span>
                    {entry.rank}. {entry.user.displayName || 'Member'}
                  </span>
                  <span>{entry.points} pts</span>
                </li>
              ))}
            </ol>
          )}

          <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
            {rows.length === 0 && (
              <p className="py-6 text-center text-xs text-slate-500">
                {isLive ? 'Say hello. Nobody has spoken yet.' : 'The chat opens when the stream starts.'}
              </p>
            )}
            {rows.map((row) =>
              row.kind === 'chat' ? (
                <div key={row.id} className="flex items-start gap-2 text-sm">
                  <Avatar
                    src={row.message.user?.avatar ?? undefined}
                    fallback={initials(row.message.user?.displayName)}
                    size="xs"
                  />
                  <p className="min-w-0 flex-1 break-words text-slate-800 dark:text-slate-200">
                    <span className={cn('mr-1 font-semibold', row.message.isHost ? 'text-rose-600' : 'text-slate-900 dark:text-white')}>
                      {row.message.user?.displayName || 'Member'}
                      {row.message.isHost ? ' (host)' : ''}
                    </span>
                    {renderSocialText(row.message.content)}
                  </p>
                </div>
              ) : row.kind === 'gift' ? (
                <div key={row.id} className="rounded-lg bg-amber-50 px-3 py-1.5 text-center text-xs font-medium text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                  {row.icon} {row.text}
                </div>
              ) : (
                <div key={row.id} className="text-center text-xs text-slate-500">
                  {row.text}
                </div>
              )
            )}
          </div>

          {showGifts && gifts.length > 0 && (
            <div className="border-t border-slate-200 px-4 py-3 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Send a gift</span>
                <span>{balance ?? 0} pts available</span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {gifts.map((gift) => (
                  <button
                    key={gift.id}
                    type="button"
                    onClick={() => void sendGift(gift)}
                    disabled={!isLive || gifting !== null || (balance ?? 0) < gift.value}
                    className="rounded-lg border border-slate-200 px-2 py-2 text-center text-xs hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    <span className="block text-xl">{gift.icon}</span>
                    <span className="block font-medium text-slate-900 dark:text-white">{gift.name}</span>
                    <span className="block text-slate-500">{gift.value} pts</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-slate-200 p-3 dark:border-slate-800">
            {canChat ? (
              <form onSubmit={send} className="flex items-center gap-2">
                {!stream?.isHost && (
                  <button
                    type="button"
                    onClick={() => setShowGifts((v) => !v)}
                    aria-pressed={showGifts}
                    aria-label="Send a gift"
                    className="rounded-lg p-2 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                  >
                    <Gift className="h-5 w-5" />
                  </button>
                )}
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  maxLength={500}
                  placeholder={`Message as ${user?.displayName || 'you'}`}
                  className="input flex-1 text-sm"
                />
                <button type="submit" disabled={!draft.trim() || sending} className="btn-primary p-2" aria-label="Send">
                  <Send className="h-4 w-4" />
                </button>
              </form>
            ) : isAuthenticated ? (
              <p className="text-center text-xs text-slate-500">Chat opens when the stream is live.</p>
            ) : (
              <Link href={`/login?redirect=${encodeURIComponent(`/live/${streamId}`)}`} className="btn-primary block w-full py-2 text-center text-sm">
                Sign in to chat
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
