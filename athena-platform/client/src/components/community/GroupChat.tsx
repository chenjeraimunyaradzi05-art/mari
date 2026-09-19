'use client';

/**
 * A group's chat room: the running conversation beside its posts. Members
 * read and send; a moderator pins and removes. New messages arrive over the
 * socket (the room is joined while the chat is open; the server checks
 * membership), with a slow poll as the safety net and a faster one when
 * there is no socket. History opens on the latest hundred messages and
 * "Load earlier" walks back from there.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { format, isToday } from 'date-fns';
import { Loader2, Pin, PinOff, Reply, Send, Trash2, X } from 'lucide-react';
import { groupsApi } from '@/lib/api';
import { useAuthStore } from '@/lib/hooks';
import { useSocket } from '@/lib/hooks/use-socket';
import { renderSocialText } from '@/lib/social-text';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

type ChatMessage = {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
  deletedAt?: string | null;
  metadata?: { pinned?: boolean } | null;
  sender?: { id: string; displayName: string | null; avatar: string | null } | null;
  replyTo?: { id: string; content: string; senderId: string } | null;
};

type ChatPage = { messages: ChatMessage[]; hasMore: boolean };
type Held = { groupId: string; messages: ChatMessage[]; hasEarlier: boolean | null };

const POLL_MS = 8000;
/** With a live socket the poll is only a safety net. */
const LIVE_POLL_MS = 60000;
const PAGE_SIZE = 100;

const errorMessage = (error: unknown) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message;

function senderName(message: ChatMessage, selfId?: string): string {
  if (message.senderId === selfId) return 'You';
  return message.sender?.displayName?.trim() || 'Member';
}

/** The server answers `{ messages, hasMore }`; an older shape was a bare list. */
function readPage(response: { data?: { data?: unknown } }): ChatPage {
  const payload = response.data?.data;
  if (Array.isArray(payload)) return { messages: payload as ChatMessage[], hasMore: false };
  const page = (payload ?? {}) as { messages?: unknown; hasMore?: unknown };
  return {
    messages: Array.isArray(page.messages) ? (page.messages as ChatMessage[]) : [],
    hasMore: page.hasMore === true,
  };
}

const byTime = (a: ChatMessage, b: ChatMessage) => a.createdAt.localeCompare(b.createdAt);

/**
 * Folds a fetched page into what is held. Anything the page covers by time
 * but no longer contains was removed, so it goes too: that is how a poll
 * notices a deletion without a separate event.
 */
function mergePage(held: ChatMessage[], page: ChatMessage[]): ChatMessage[] {
  if (page.length === 0) return held;
  const ids = new Set(page.map((message) => message.id));
  const from = page[0].createdAt;
  const to = page[page.length - 1].createdAt;
  const kept = held.filter((message) => !ids.has(message.id) && (message.createdAt < from || message.createdAt > to));
  return [...kept, ...page].sort(byTime);
}

function upsertMessage(held: ChatMessage[], message: ChatMessage): ChatMessage[] {
  return [...held.filter((m) => m.id !== message.id), message].sort(byTime);
}

export function GroupChat({ groupId, canModerate }: { groupId: string; canModerate: boolean }) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const { socket, connected } = useSocket();
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [held, setHeld] = useState<Held>({ groupId, messages: [], hasEarlier: null });
  const endRef = useRef<HTMLDivElement>(null);

  const latest = useQuery({
    queryKey: ['group-chat', groupId],
    queryFn: () => groupsApi.chatMessages(groupId, { limit: PAGE_SIZE }),
    refetchInterval: connected ? LIVE_POLL_MS : POLL_MS,
    select: readPage,
  });

  // Every fetch of the latest page folds into the history held here, so
  // earlier pages and live messages survive a refetch.
  const latestPage = latest.data;
  useEffect(() => {
    if (!latestPage) return;
    setHeld((prev) => {
      const base: Held = prev.groupId === groupId ? prev : { groupId, messages: [], hasEarlier: null };
      return {
        groupId,
        messages: mergePage(base.messages, latestPage.messages),
        hasEarlier: base.hasEarlier ?? latestPage.hasMore,
      };
    });
  }, [latestPage, groupId]);

  const pinned = useQuery({
    queryKey: ['group-chat-pinned', groupId],
    queryFn: () => groupsApi.pinnedChatMessages(groupId),
    select: (response) => (Array.isArray(response.data?.data) ? (response.data.data as ChatMessage[]) : []),
  });

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['group-chat', groupId] });
    queryClient.invalidateQueries({ queryKey: ['group-chat-pinned', groupId] });
  }, [queryClient, groupId]);

  // Live delivery: join the room while the chat is open, leave on the way out.
  useEffect(() => {
    if (!socket || !connected) return;

    const onMessage = (payload: { groupId?: string; message?: ChatMessage }) => {
      if (payload?.groupId !== groupId || !payload.message?.id) return;
      const message = payload.message;
      setHeld((prev) => (prev.groupId === groupId ? { ...prev, messages: upsertMessage(prev.messages, message) } : prev));
    };
    const onRemoved = (payload: { groupId?: string; messageId?: string }) => {
      if (payload?.groupId !== groupId || !payload.messageId) return;
      const gone = payload.messageId;
      setHeld((prev) => ({ ...prev, messages: prev.messages.filter((m) => m.id !== gone) }));
      queryClient.invalidateQueries({ queryKey: ['group-chat-pinned', groupId] });
    };
    const onPinned = (payload: { groupId?: string }) => {
      if (payload?.groupId === groupId) refresh();
    };

    socket.on('groups:message', onMessage);
    socket.on('groups:message_removed', onRemoved);
    socket.on('groups:message_pinned', onPinned);
    socket.emit('groups:join', groupId);

    return () => {
      socket.off('groups:message', onMessage);
      socket.off('groups:message_removed', onRemoved);
      socket.off('groups:message_pinned', onPinned);
      if (socket.connected) socket.emit('groups:leave', groupId);
    };
  }, [socket, connected, groupId, queryClient, refresh]);

  const loadEarlier = useMutation({
    mutationFn: (before: string) => groupsApi.chatMessages(groupId, { before, limit: PAGE_SIZE }),
    onSuccess: (response) => {
      const page = readPage(response);
      setHeld((prev) => ({
        groupId,
        messages: mergePage(prev.groupId === groupId ? prev.messages : [], page.messages),
        hasEarlier: page.hasMore,
      }));
    },
    onError: (error) => toast.error(errorMessage(error) || 'Could not load earlier messages'),
  });

  const send = useMutation({
    mutationFn: (data: { content: string; replyToId?: string }) => groupsApi.sendChatMessage(groupId, data),
    onSuccess: (response) => {
      setDraft('');
      setReplyTo(null);
      const message = (response as { data?: { data?: ChatMessage } })?.data?.data;
      if (message?.id && message.createdAt) {
        setHeld((prev) => (prev.groupId === groupId ? { ...prev, messages: upsertMessage(prev.messages, message) } : prev));
      }
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error) || 'Could not send that'),
  });

  const remove = useMutation({
    mutationFn: (messageId: string) => groupsApi.deleteChatMessage(groupId, messageId),
    onSuccess: (_res, messageId) => {
      setHeld((prev) => ({ ...prev, messages: prev.messages.filter((m) => m.id !== messageId) }));
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error) || 'Could not remove that message'),
  });

  const pin = useMutation({
    mutationFn: ({ messageId, pinned: next }: { messageId: string; pinned: boolean }) => groupsApi.pinChatMessage(groupId, messageId, next),
    onSuccess: (_res, { pinned: next }) => {
      refresh();
      toast.success(next ? 'Pinned' : 'Unpinned');
    },
    onError: (error) => toast.error(errorMessage(error) || 'Could not change the pin'),
  });

  const list = useMemo(
    () => (held.groupId === groupId ? held.messages : []).filter((m) => !m.deletedAt),
    [held, groupId]
  );
  const newestId = list[list.length - 1]?.id;
  // Scroll to the end for a new message, not when older ones are added above.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [newestId]);

  const oldest = list[0];
  const canLoadEarlier = held.groupId === groupId && held.hasEarlier === true && !!oldest;
  const loading = latest.isLoading && list.length === 0;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || send.isPending) return;
    send.mutate({ content, replyToId: replyTo?.id });
  };

  return (
    <div className="card flex h-[560px] flex-col p-0">
      {pinned.data && pinned.data.length > 0 && (
        <div className="border-b border-slate-100 bg-amber-50/60 px-4 py-2 text-sm dark:border-slate-800 dark:bg-amber-900/10">
          <p className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
            <Pin className="h-3 w-3" /> Pinned
          </p>
          <ul className="space-y-1">
            {pinned.data.slice(0, 3).map((message) => (
              <li key={message.id} className="truncate text-slate-700 dark:text-slate-200">
                <span className="font-medium">{message.sender?.displayName?.trim() || 'Member'}:</span> {message.content}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {canLoadEarlier && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => loadEarlier.mutate(oldest.createdAt)}
              disabled={loadEarlier.isPending}
              className="text-xs font-medium text-primary-700 hover:underline disabled:opacity-60 dark:text-primary-300"
            >
              {loadEarlier.isPending ? 'Loading…' : 'Load earlier'}
            </button>
          </div>
        )}
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : latest.isError && list.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">Could not load the chat.</p>
        ) : list.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">Nothing here yet. Say hello.</p>
        ) : (
          list.map((message) => {
            const mine = message.senderId === user?.id;
            const name = senderName(message, user?.id);
            const when = new Date(message.createdAt);
            const isPinned = Boolean(message.metadata?.pinned);
            return (
              <div key={message.id} className={cn('group flex gap-2', mine && 'flex-row-reverse')}>
                <Link href={`/profile/${message.senderId}`} className="mt-1 flex-shrink-0">
                  <Avatar src={message.sender?.avatar || undefined} alt={name} fallback={name.slice(0, 2).toUpperCase()} size="sm" />
                </Link>
                <div className={cn('max-w-[78%]', mine && 'text-right')}>
                  <div className={cn('mb-0.5 flex items-baseline gap-2 text-xs text-slate-500', mine && 'justify-end')}>
                    <span className="font-medium text-slate-700 dark:text-slate-300">{name}</span>
                    <span>{isToday(when) ? format(when, 'h:mm a') : format(when, 'd MMM, h:mm a')}</span>
                    {isPinned && <Pin className="h-3 w-3 text-amber-600" aria-label="Pinned" />}
                  </div>
                  <div
                    className={cn(
                      'inline-block rounded-2xl px-3.5 py-2 text-left text-sm',
                      mine ? 'rounded-tr-sm bg-primary-600 text-white' : 'rounded-tl-sm bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100'
                    )}
                  >
                    {message.replyTo && (
                      <div className={cn('mb-1 border-l-2 pl-2 text-xs', mine ? 'border-white/50 text-white/80' : 'border-slate-300 text-slate-500')}>
                        {message.replyTo.content || 'Message removed'}
                      </div>
                    )}
                    <p className="whitespace-pre-wrap break-words">{renderSocialText(message.content)}</p>
                  </div>
                  <div className={cn('mt-0.5 flex gap-2 text-xs text-slate-400 opacity-0 group-hover:opacity-100 focus-within:opacity-100', mine && 'justify-end')}>
                    <button type="button" onClick={() => setReplyTo(message)} className="inline-flex items-center gap-1 hover:text-slate-700">
                      <Reply className="h-3 w-3" /> Reply
                    </button>
                    {canModerate && (
                      <button
                        type="button"
                        onClick={() => pin.mutate({ messageId: message.id, pinned: !isPinned })}
                        className="inline-flex items-center gap-1 hover:text-slate-700"
                      >
                        {isPinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />} {isPinned ? 'Unpin' : 'Pin'}
                      </button>
                    )}
                    {(mine || canModerate) && (
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm('Remove this message?')) remove.mutate(message.id);
                        }}
                        className="inline-flex items-center gap-1 hover:text-red-600"
                      >
                        <Trash2 className="h-3 w-3" /> Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={submit} className="border-t border-slate-100 p-3 dark:border-slate-800">
        {replyTo && (
          <div className="mb-2 flex items-start justify-between gap-2 rounded-lg bg-slate-50 p-2 text-xs dark:bg-slate-800">
            <span className="min-w-0">
              <span className="font-medium text-slate-600 dark:text-slate-300">Replying to {senderName(replyTo, user?.id)}</span>
              <span className="block truncate text-slate-500">{replyTo.content}</span>
            </span>
            <button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply" className="text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={4000}
            placeholder="Message the group…"
            aria-label="Message"
            className="input flex-1"
          />
          <button type="submit" disabled={!draft.trim() || send.isPending} className="btn-primary inline-flex items-center gap-1 px-4 py-2 text-sm">
            <Send className="h-4 w-4" /> Send
          </button>
        </div>
      </form>
    </div>
  );
}
