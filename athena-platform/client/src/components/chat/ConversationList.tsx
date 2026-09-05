'use client';

/**
 * The inbox. Three views of the same list: the inbox itself, message requests
 * from people you do not follow, and what you archived. Each thread carries a
 * small menu to pin, mute or archive it; those are your own settings, saved on
 * the server so they follow you between devices.
 */

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { Archive, ArchiveRestore, BellOff, MoreHorizontal, Pin, PinOff, Volume2 } from 'lucide-react';
import { useConversations } from '@/lib/hooks';
import { messageApi } from '@/lib/api';
import { useChatStore, Conversation as StoreConversation } from '@/lib/stores/chat.store';
import { Skeleton } from '@/components/ui/loading';
import { cn } from '@/lib/utils';

type Tab = 'inbox' | 'requests' | 'archived';

type ApiConversation = {
  id: string;
  participant: { id: string; firstName: string; lastName: string; avatar?: string; isVerified?: boolean };
  lastMessage?: { senderId: string; content: string; createdAt: string; deletedAt?: string | null };
  unreadCount: number;
  updatedAt: string;
  disappearingTtlSeconds?: number | null;
  isPinned?: boolean;
  isMuted?: boolean;
  isArchived?: boolean;
  isRequest?: boolean;
  requestPending?: boolean;
  requestDeclined?: boolean;
};

export default function ConversationList() {
  const { data: apiConversations, isLoading } = useConversations();
  const { conversations, setConversations, patchConversation, activeConversationId } = useChatStore();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const tab: Tab = (searchParams.get('tab') as Tab) || 'inbox';
  const setTab = (next: Tab) => router.replace(next === 'inbox' ? '/dashboard/messages' : `/dashboard/messages?tab=${next}`);

  // Sync API data to the global store the thread and the badge read from.
  useEffect(() => {
    if (apiConversations) {
      const mapped: StoreConversation[] = (apiConversations as ApiConversation[]).map((c) => ({
        id: c.id,
        disappearingTtlSeconds: c.disappearingTtlSeconds ?? null,
        participants: [c.participant].map((p) => ({
          id: p.id,
          name: `${p.firstName} ${p.lastName}`,
          avatar: p.avatar || undefined,
          isVerified: p.isVerified,
        })),
        lastMessage: c.lastMessage
          ? {
              id: 'temp-id', // the list view does not carry message ids
              senderId: c.lastMessage.senderId,
              content: c.lastMessage.content,
              createdAt: c.lastMessage.createdAt,
              deletedAt: c.lastMessage.deletedAt ?? undefined,
              type: 'text',
            }
          : undefined,
        unreadCount: c.unreadCount,
        updatedAt: c.updatedAt,
        isPinned: Boolean(c.isPinned),
        isMuted: Boolean(c.isMuted),
        isArchived: Boolean(c.isArchived),
        isRequest: Boolean(c.isRequest),
        requestPending: Boolean(c.requestPending),
        requestDeclined: Boolean(c.requestDeclined),
      }));
      setConversations(mapped);
    }
  }, [apiConversations, setConversations]);

  const counts = useMemo(
    () => ({
      requests: conversations.filter((c) => c.isRequest && !c.isArchived).length,
      archived: conversations.filter((c) => c.isArchived).length,
    }),
    [conversations]
  );

  const visible = useMemo(() => {
    const list = conversations.filter((c) => {
      if (tab === 'archived') return c.isArchived;
      if (tab === 'requests') return c.isRequest && !c.isArchived;
      return !c.isArchived && !c.isRequest;
    });
    // Pinned first, then newest activity, the same order the server sends.
    return [...list].sort((a, b) => Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned)));
  }, [conversations, tab]);

  const setPreference = async (conversation: StoreConversation, prefs: { isPinned?: boolean; isMuted?: boolean; isArchived?: boolean }) => {
    setMenuFor(null);
    const previous = { isPinned: conversation.isPinned, isMuted: conversation.isMuted, isArchived: conversation.isArchived };
    patchConversation(conversation.id, prefs);
    try {
      await messageApi.updatePreferences(conversation.id, prefs);
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      if (prefs.isArchived === true) toast.success('Archived');
      else if (prefs.isArchived === false) toast.success('Back in your inbox');
      else if (prefs.isMuted === true) toast.success('Muted');
      else if (prefs.isMuted === false) toast.success('Unmuted');
      else if (prefs.isPinned === true) toast.success('Pinned');
      else if (prefs.isPinned === false) toast.success('Unpinned');
    } catch (error) {
      patchConversation(conversation.id, previous);
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || 'Could not save that');
    }
  };

  if (isLoading && conversations.length === 0) {
    return (
      <div className="p-4 space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const emptyText =
    tab === 'requests'
      ? 'No message requests. When someone you do not follow writes to you, it waits here.'
      : tab === 'archived'
        ? 'Nothing archived.'
        : conversations.length === 0
          ? 'No conversations yet.'
          : 'Your inbox is clear.';

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-200 p-4 pb-0 dark:border-slate-800">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Messages</h2>
        <div className="mt-3 flex gap-4 text-sm" role="tablist" aria-label="Message folders">
          {(
            [
              ['inbox', 'Inbox', 0],
              ['requests', 'Requests', counts.requests],
              ['archived', 'Archived', counts.archived],
            ] as Array<[Tab, string, number]>
          ).map(([value, label, count]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={cn(
                '-mb-px border-b-2 pb-2 font-medium',
                tab === value
                  ? 'border-blue-600 text-slate-900 dark:text-white'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              )}
            >
              {label}
              {count > 0 && (
                <span className="ml-1.5 rounded-full bg-blue-100 px-1.5 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {visible.length === 0 ? (
          <div className="p-4 text-sm text-slate-500">{emptyText}</div>
        ) : (
          visible.map((conversation) => {
            const isActive = pathname === `/dashboard/messages/${conversation.id}` || activeConversationId === conversation.id;
            const participant = conversation.participants[0] || { name: 'Unknown', avatar: undefined };
            const initials = participant.name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2);
            const menuOpen = menuFor === conversation.id;

            return (
              <div
                key={conversation.id}
                className={cn(
                  'group relative border-b border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60',
                  isActive && 'bg-blue-50 border-l-4 border-l-blue-600 dark:bg-blue-900/20'
                )}
              >
                <Link href={`/dashboard/messages/${conversation.id}`} className="block p-4 pr-10">
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      {participant.avatar ? (
                        <img src={participant.avatar} alt={participant.name} className="h-10 w-10 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-300 font-bold text-slate-600">{initials}</div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <h3 className="flex min-w-0 items-center gap-1 truncate text-sm font-medium text-slate-900 dark:text-white">
                          <span className="truncate">{participant.name}</span>
                          {conversation.isPinned && <Pin className="h-3 w-3 flex-shrink-0 text-slate-400" aria-label="Pinned" />}
                          {conversation.isMuted && <BellOff className="h-3 w-3 flex-shrink-0 text-slate-400" aria-label="Muted" />}
                        </h3>
                        {conversation.lastMessage && (
                          <span className="flex-shrink-0 text-xs text-slate-400">
                            {formatDistanceToNow(new Date(conversation.lastMessage.createdAt), { addSuffix: false })}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        <p className={cn('truncate text-sm', conversation.unreadCount > 0 && !conversation.isMuted ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-500')}>
                          {conversation.isRequest
                            ? 'Wants to message you'
                            : conversation.requestPending
                              ? 'Request sent'
                              : conversation.lastMessage
                                ? conversation.lastMessage.deletedAt
                                  ? 'Message unsent'
                                  : conversation.lastMessage.content || 'Sent an attachment'
                                : 'Started a conversation'}
                        </p>
                        {conversation.unreadCount > 0 && !conversation.isMuted && (
                          <span className="ml-2 rounded-full bg-blue-600 px-2 py-0.5 text-xs font-bold text-white">{conversation.unreadCount}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>

                <button
                  type="button"
                  aria-label={`Options for ${participant.name}`}
                  aria-expanded={menuOpen}
                  onClick={() => setMenuFor(menuOpen ? null : conversation.id)}
                  className={cn(
                    'absolute right-2 top-3 rounded-md p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 focus:opacity-100 dark:hover:bg-slate-700',
                    menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
                  )}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>

                {menuOpen && (
                  <div role="menu" className="absolute right-2 top-10 z-10 w-44 rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900">
                    {!conversation.isRequest && (
                      <button type="button" role="menuitem" onClick={() => setPreference(conversation, { isPinned: !conversation.isPinned })} className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800">
                        {conversation.isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                        {conversation.isPinned ? 'Unpin' : 'Pin to top'}
                      </button>
                    )}
                    <button type="button" role="menuitem" onClick={() => setPreference(conversation, { isMuted: !conversation.isMuted })} className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800">
                      {conversation.isMuted ? <Volume2 className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                      {conversation.isMuted ? 'Unmute' : 'Mute'}
                    </button>
                    <button type="button" role="menuitem" onClick={() => setPreference(conversation, { isArchived: !conversation.isArchived })} className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800">
                      {conversation.isArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                      {conversation.isArchived ? 'Unarchive' : 'Archive'}
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
