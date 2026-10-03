'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Eye, Flag, Gift, Radio, Send, Trophy, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { livestreamApi, type LiveChatMessage, type LiveStream } from '@/lib/api-extensions';
import { useAuthStore } from '@/lib/store';
import { useSocket } from '@/lib/hooks/use-socket';
import { LivePlayer } from '@/components/live/LivePlayer';
import { TopUpModal } from '@/components/creator/TopUpModal';
import { ReportDialog } from '@/components/safety/ReportDialog';
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

// What a host can choose for slow mode and for a mute. Short, and a handful: the
// point is a quick answer while she is on camera, not a settings page.
const SLOW_MODE_CHOICES = [
  { seconds: 0, label: 'Off' },
  { seconds: 5, label: '5 seconds' },
  { seconds: 10, label: '10 seconds' },
  { seconds: 30, label: '30 seconds' },
  { seconds: 60, label: '1 minute' },
];
const MUTE_CHOICES = [
  { minutes: 5, label: '5 minutes' },
  { minutes: 10, label: '10 minutes' },
  { minutes: 30, label: '30 minutes' },
  { minutes: 60, label: '1 hour' },
];

/** "10 seconds" or "1 minute", for the line that explains slow mode to viewers. */
function paceLabel(seconds: number): string {
  if (seconds % 60 === 0) {
    const minutes = seconds / 60;
    return minutes === 1 ? '1 minute' : `${minutes} minutes`;
  }
  return `${seconds} seconds`;
}

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
  const [showTopUp, setShowTopUp] = useState(false);
  const [gifting, setGifting] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<Array<{ rank: number; user: { id: string; displayName: string | null }; points: number }>>([]);
  const [ending, setEnding] = useState(false);
  // Moderation. `reporting` is the thing the report dialog is open on; a viewer
  // the host has muted is told when, and her chat box says so until it runs out.
  const [reporting, setReporting] = useState<{ type: 'livestream' | 'live_message'; id: string; label: string } | null>(null);
  const [mutedUntil, setMutedUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [muteMinutes, setMuteMinutes] = useState(10);
  const [savingSlowMode, setSavingSlowMode] = useState(false);
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
    // A message the host removed has to leave every viewer's chat, not just
    // hers — otherwise the abuse she deleted is still on everybody's screen.
    const onMessageRemoved = (payload: { streamId?: string; messageId?: string }) => {
      if (payload?.streamId !== streamId || !payload.messageId) return;
      setRows((current) =>
        current.filter((row) => !(row.kind === 'chat' && row.message.id === payload.messageId))
      );
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
    const onStatus = (payload: { streamId?: string; status?: LiveStream['status']; suspended?: boolean }) => {
      if (payload?.streamId !== streamId || !payload.status) return;
      setStream((current) => (current ? { ...current, status: payload.status as LiveStream['status'] } : current));
      append({
        kind: 'system',
        id: `status-${payload.status}-${Date.now()}`,
        text:
          payload.status === 'LIVE'
            ? 'The stream has started'
            : payload.suspended
              ? 'This stream was ended by the ATHENA team'
              : 'The stream has ended',
      });
      void loadStream();
    };
    // Said to her alone, by the server, the moment the host mutes her: her chat
    // box then explains itself rather than seeming to break.
    const onMuted = (payload: { streamId?: string; until?: string }) => {
      if (payload?.streamId !== streamId || !payload.until) return;
      const until = new Date(payload.until).getTime();
      if (Number.isNaN(until)) return;
      setMutedUntil(until);
      setNow(Date.now());
    };
    const onUnmuted = (payload: { streamId?: string }) => {
      if (payload?.streamId === streamId) setMutedUntil(null);
    };
    const onSlowMode = (payload: { streamId?: string; seconds?: number | null }) => {
      if (payload?.streamId !== streamId) return;
      setStream((current) => (current ? { ...current, slowModeSeconds: payload.seconds ?? null } : current));
      append({
        kind: 'system',
        id: `slow-${payload.seconds ?? 0}-${Date.now()}`,
        text: payload.seconds ? `Slow mode is on: one message every ${paceLabel(payload.seconds)}` : 'Slow mode is off',
      });
    };
    const onError = (payload: { message?: string }) => {
      if (payload?.message) toast.error(payload.message);
    };

    socket.on('live:message', onMessage);
    socket.on('live:viewers', onViewers);
    socket.on('live:message_removed', onMessageRemoved);
    socket.on('live:gift', onGift);
    socket.on('live:status', onStatus);
    socket.on('live:muted', onMuted);
    socket.on('live:unmuted', onUnmuted);
    socket.on('live:slow_mode', onSlowMode);
    socket.on('live:error', onError);
    socket.emit('live:join', streamId);

    return () => {
      socket.off('live:message', onMessage);
      socket.off('live:viewers', onViewers);
      socket.off('live:message_removed', onMessageRemoved);
      socket.off('live:gift', onGift);
      socket.off('live:status', onStatus);
      socket.off('live:muted', onMuted);
      socket.off('live:unmuted', onUnmuted);
      socket.off('live:slow_mode', onSlowMode);
      socket.off('live:error', onError);
      if (socket.connected) socket.emit('live:leave', streamId);
    };
  }, [authLoading, streamId, socket, connected, append, loadStream]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [rows.length]);

  // A mute ends by itself, so the chat box has to come back by itself too.
  useEffect(() => {
    if (!mutedUntil) return;
    const wait = mutedUntil - Date.now();
    if (wait <= 0) {
      setMutedUntil(null);
      return;
    }
    const timer = setTimeout(() => {
      setNow(Date.now());
      setMutedUntil(null);
    }, wait + 250);
    return () => clearTimeout(timer);
  }, [mutedUntil]);

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

  // Removing a line she should not have had to read. The row goes immediately
  // rather than waiting for the socket to echo it back, because the point of
  // the control is that it is fast; if the call fails the row comes back with
  // the reason.
  const removeMessage = async (messageId: string) => {
    if (!streamId) return;
    const previous = rows;
    setRows((current) => current.filter((row) => !(row.kind === 'chat' && row.message.id === messageId)));
    try {
      await livestreamApi.removeMessage(streamId, messageId);
    } catch (error) {
      setRows(previous);
      toast.error(errorMessage(error, 'That message could not be removed'));
    }
  };

  const removeFromStream = async (userId: string, displayName?: string | null) => {
    if (!streamId) return;
    const who = displayName || 'That viewer';
    // Removal is a block, not a stream-scoped kick — it lasts past this stream,
    // which is what she almost always wants and is hard to discover from a
    // one-word button, so it is said plainly before it happens.
    if (!window.confirm(`Remove ${who} from this stream and block them? Their messages here will be deleted and they will not be able to reach you afterwards.`)) {
      return;
    }
    try {
      await livestreamApi.removeViewer(streamId, userId);
      setRows((current) => current.filter((row) => !(row.kind === 'chat' && row.message.user?.id === userId)));
      toast.success(`${who} has been removed and blocked`);
    } catch (error) {
      toast.error(errorMessage(error, 'That viewer could not be removed'));
    }
  };

  // The lighter answer than removing someone: she stays in the room and can
  // watch, her chat comes back by itself. Her lines stay, because a nuisance is
  // not always an abuser and the host can delete any of them herself.
  const muteViewer = async (userId: string, displayName?: string | null) => {
    if (!streamId) return;
    const who = displayName || 'That viewer';
    try {
      await livestreamApi.muteViewer(streamId, userId, muteMinutes);
      toast.success(`${who} is muted for ${MUTE_CHOICES.find((choice) => choice.minutes === muteMinutes)?.label ?? `${muteMinutes} minutes`}`);
    } catch (error) {
      toast.error(errorMessage(error, 'That viewer could not be muted'));
    }
  };

  const changeSlowMode = async (seconds: number) => {
    if (!streamId) return;
    setSavingSlowMode(true);
    try {
      const res = await livestreamApi.setSlowMode(streamId, seconds);
      if (res.data?.data) setStream(res.data.data);
      toast.success(seconds ? `Slow mode: one message every ${paceLabel(seconds)}` : 'Slow mode is off');
    } catch (error) {
      toast.error(errorMessage(error, 'Could not change slow mode'));
    } finally {
      setSavingSlowMode(false);
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
  const suspended = Boolean(stream?.suspended);
  const canChat = isAuthenticated && !suspended && (isLive || stream?.isHost);
  const muted = !stream?.isHost && mutedUntil !== null && mutedUntil > now;
  const slowSeconds = stream?.slowModeSeconds ?? 0;

  const playerMessage = useMemo(() => {
    if (!stream) return undefined;
    if (stream.status === 'SCHEDULED') return `${hostName} has not started yet. Stay here and it will begin on its own.`;
    if (stream.suspended) return 'This stream was ended by the ATHENA team.';
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
              {/* Anyone signed in who is not the host can tell us about the
                  stream itself, as distinct from one line of its chat. */}
              {isAuthenticated && stream && !stream.isHost && (
                <button
                  type="button"
                  onClick={() => setReporting({ type: 'livestream', id: stream.id, label: 'this stream' })}
                  className="inline-flex min-h-[32px] items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-500 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                >
                  <Flag className="h-3.5 w-3.5" /> Report
                </button>
              )}
            </div>
          </div>

          {stream?.description && (
            <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{renderSocialText(stream.description)}</p>
          )}

          {stream?.isHost && suspended && (
            <p role="status" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-900 dark:bg-rose-900/20 dark:text-rose-200">
              This stream was ended by the ATHENA team because it did not meet the community guidelines, and it cannot be
              restarted. If you think this was a mistake, please contact support.
            </p>
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

          {/* The host's tools for her own chat. Slow mode slows everyone at once;
              the length chosen here is what the Mute button on a line uses. */}
          {stream?.isHost && !suspended && stream.status !== 'ENDED' && (
            <div className="grid gap-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700 sm:grid-cols-2">
              <div>
                <label htmlFor="live-slow-mode" className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  Slow mode
                </label>
                <select
                  id="live-slow-mode"
                  aria-describedby="live-slow-mode-help"
                  value={slowSeconds}
                  onChange={(event) => void changeSlowMode(Number(event.target.value))}
                  disabled={savingSlowMode}
                  className="input mt-1 w-full text-sm"
                >
                  {SLOW_MODE_CHOICES.map((choice) => (
                    <option key={choice.seconds} value={choice.seconds}>
                      {choice.label}
                    </option>
                  ))}
                  {!SLOW_MODE_CHOICES.some((choice) => choice.seconds === slowSeconds) && (
                    <option value={slowSeconds}>{paceLabel(slowSeconds)}</option>
                  )}
                </select>
                <span id="live-slow-mode-help" className="mt-1 block text-xs text-slate-500">
                  One message per viewer in that time. Your own messages are never held back.
                </span>
              </div>
              <div>
                <label htmlFor="live-mute-length" className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  Mute a viewer for
                </label>
                <select
                  id="live-mute-length"
                  aria-describedby="live-mute-length-help"
                  value={muteMinutes}
                  onChange={(event) => setMuteMinutes(Number(event.target.value))}
                  className="input mt-1 w-full text-sm"
                >
                  {MUTE_CHOICES.map((choice) => (
                    <option key={choice.minutes} value={choice.minutes}>
                      {choice.label}
                    </option>
                  ))}
                </select>
                <span id="live-mute-length-help" className="mt-1 block text-xs text-slate-500">
                  Use Mute beside a message. They can keep watching; their chat comes back by itself.
                </span>
              </div>
            </div>
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
                <div key={row.id} className="group flex items-start gap-2 text-sm">
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
                  {/* The host's answer to someone spoiling her stream. Shown on
                      hover and focus so the chat stays readable, but reachable
                      by keyboard rather than hover-only. */}
                  {(isAuthenticated && row.message.user?.id !== user?.id) || (stream?.isHost && !row.message.isHost) ? (
                    <span className="flex shrink-0 gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
                      {/* Anyone can report a line that is not her own. The report
                          keeps the words, because the host can delete the row. */}
                      {isAuthenticated && row.message.user?.id !== user?.id && (
                        <button
                          type="button"
                          onClick={() => setReporting({ type: 'live_message', id: row.message.id, label: 'this chat message' })}
                          className="inline-flex min-h-[28px] items-center rounded px-1 text-xs text-slate-500 hover:text-rose-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                          title="Report this message"
                          aria-label="Report this message"
                        >
                          <Flag className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      )}
                      {stream?.isHost && !row.message.isHost && (
                        <>
                          <button
                            type="button"
                            onClick={() => removeMessage(row.message.id)}
                            className="min-h-[28px] rounded px-1 text-xs text-slate-500 hover:text-rose-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                            title="Delete this message"
                          >
                            Delete
                          </button>
                          {row.message.user?.id && (
                            <button
                              type="button"
                              onClick={() => void muteViewer(row.message.user!.id!, row.message.user?.displayName)}
                              className="min-h-[28px] rounded px-1 text-xs text-slate-500 hover:text-rose-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                              title="Mute them in this chat for a while. They can keep watching."
                            >
                              Mute
                            </button>
                          )}
                          {row.message.user?.id && (
                            <button
                              type="button"
                              onClick={() => removeFromStream(row.message.user!.id!, row.message.user?.displayName)}
                              className="min-h-[28px] rounded px-1 text-xs text-slate-500 hover:text-rose-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                              title="Remove from the stream and block"
                            >
                              Remove
                            </button>
                          )}
                        </>
                      )}
                    </span>
                  ) : null}
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
                <span className="flex items-center gap-2">
                  {balance ?? 0} pts available
                  <button
                    type="button"
                    onClick={() => setShowTopUp(true)}
                    className="font-medium text-rose-600 hover:underline dark:text-rose-400"
                  >
                    Top up
                  </button>
                </span>
              </div>
              {(balance ?? 0) < Math.min(...gifts.map((g) => g.value)) && (
                <p className="mt-2 text-xs text-slate-500">
                  You need points before you can send a gift.
                </p>
              )}
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
            {slowSeconds > 0 && canChat && !muted && !stream?.isHost && (
              <p id="slow-mode-note" className="mb-2 text-center text-xs text-slate-500">
                Slow mode is on: one message every {paceLabel(slowSeconds)}.
              </p>
            )}
            {suspended ? (
              <p className="text-center text-xs text-slate-500">This stream was ended by the ATHENA team.</p>
            ) : canChat && muted ? (
              <p role="status" className="text-center text-xs text-slate-600 dark:text-slate-300">
                The host has muted you in this chat until {new Date(mutedUntil as number).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.
                You can keep watching.
              </p>
            ) : canChat ? (
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
                  aria-describedby={slowSeconds && !stream?.isHost ? 'slow-mode-note' : undefined}
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

      {reporting && (
        <ReportDialog
          open
          onClose={() => setReporting(null)}
          targetType={reporting.type}
          targetId={reporting.id}
          targetLabel={reporting.label}
        />
      )}

      {showTopUp && (
        <TopUpModal
          isOpen={showTopUp}
          onClose={() => setShowTopUp(false)}
          onTopped={(points) => setBalance((current) => (current ?? 0) + points)}
        />
      )}
    </div>
  );
}
