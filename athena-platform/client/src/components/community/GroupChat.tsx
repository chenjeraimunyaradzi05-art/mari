'use client';

/**
 * A group's chat room: the running conversation beside its posts. Members
 * read and send; a moderator pins and removes. The room refreshes every few
 * seconds while open, which is enough for a group's pace; live delivery over
 * the socket can follow.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { format, isToday } from 'date-fns';
import { Loader2, Pin, PinOff, Reply, Send, Trash2, X } from 'lucide-react';
import { groupsApi } from '@/lib/api';
import { useAuthStore } from '@/lib/hooks';
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

const REFRESH_MS = 8000;
const errorMessage = (error: unknown) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message;

function senderName(message: ChatMessage, selfId?: string): string {
  if (message.senderId === selfId) return 'You';
  return message.sender?.displayName?.trim() || 'Member';
}

export function GroupChat({ groupId, canModerate }: { groupId: string; canModerate: boolean }) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const messages = useQuery({
    queryKey: ['group-chat', groupId],
    queryFn: () => groupsApi.chatMessages(groupId, { limit: 100 }),
    refetchInterval: REFRESH_MS,
    select: (response) => {
      const payload = response.data?.data;
      const list = Array.isArray(payload?.messages) ? payload.messages : Array.isArray(payload) ? payload : [];
      return list as ChatMessage[];
    },
  });

  const pinned = useQuery({
    queryKey: ['group-chat-pinned', groupId],
    queryFn: () => groupsApi.pinnedChatMessages(groupId),
    select: (response) => (Array.isArray(response.data?.data) ? (response.data.data as ChatMessage[]) : []),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['group-chat', groupId] });
    queryClient.invalidateQueries({ queryKey: ['group-chat-pinned', groupId] });
  };

  const send = useMutation({
    mutationFn: (data: { content: string; replyToId?: string }) => groupsApi.sendChatMessage(groupId, data),
    onSuccess: () => {
      setDraft('');
      setReplyTo(null);
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error) || 'Could not send that'),
  });

  const remove = useMutation({
    mutationFn: (messageId: string) => groupsApi.deleteChatMessage(groupId, messageId),
    onSuccess: refresh,
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

  const list = useMemo(() => (messages.data ?? []).filter((m) => !m.deletedAt), [messages.data]);
  const count = list.length;
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [count]);

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
        {messages.isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : messages.isError ? (
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
