'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Info, Search, ShieldCheck, Timer, User } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useChatStore } from '@/lib/stores/chat.store';
import { usePresenceStore } from '@/lib/stores/presence.store';
import { DISAPPEARING_MESSAGE_OPTIONS, messageApi } from '@/lib/api';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function ConversationDetails() {
  const { activeConversationId, conversations, messages, setDisappearingTtl } = useChatStore();
  const { isOnline } = usePresenceStore();
  const [savingTtl, setSavingTtl] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ id: string; senderId: string; content: string; createdAt: string }> | null>(null);
  const [searching, setSearching] = useState(false);

  const conversation = conversations.find((c) => c.id === activeConversationId);
  const participant = conversation?.participants?.[0];

  const runSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    const q = query.trim();
    if (!q || !conversation) return;
    setSearching(true);
    try {
      const res = await messageApi.search(conversation.id, q);
      setResults(Array.isArray(res.data?.data) ? [...res.data.data].reverse() : []);
    } catch {
      toast.error('Search failed');
    } finally {
      setSearching(false);
    }
  };

  // A hit that is on screen scrolls into view; the thread only holds the
  // latest messages, so older hits are listed without a jump.
  const jumpTo = (id: string) => {
    const el = document.getElementById(`msg-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-rose-400');
      setTimeout(() => el.classList.remove('ring-2', 'ring-rose-400'), 1500);
    }
  };

  // Shared media is whatever has actually been sent in this thread — no
  // placeholder tiles standing in for files that do not exist.
  const sharedMedia = useMemo(() => {
    const thread = activeConversationId ? messages[activeConversationId] || [] : [];
    return thread
      .flatMap((message) => message.attachments || [])
      .filter((attachment) => attachment.type === 'image' || attachment.type === 'video')
      .slice(-9)
      .reverse();
  }, [messages, activeConversationId]);

  if (!conversation || !participant) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 p-6">
        <Info className="w-8 h-8 mb-2" />
        <p className="text-sm">Select a conversation to see details.</p>
      </div>
    );
  }

  const ttl = conversation.disappearingTtlSeconds ?? null;

  // Either side may set the timer. The server writes a system message into
  // the thread naming who changed it and pushes the new setting to both
  // people, so the other person is told rather than left to notice.
  const changeTtl = async (raw: string) => {
    const next = raw === 'off' ? null : Number(raw);
    if (next === ttl) return;
    setSavingTtl(true);
    try {
      await messageApi.updateConversationSettings(conversation.id, next);
      setDisappearingTtl(conversation.id, next);
      toast.success(
        next === null
          ? 'Disappearing messages are off'
          : `New messages disappear after ${DISAPPEARING_MESSAGE_OPTIONS.find((o) => o.value === next)?.label}`
      );
    } catch (error) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || 'Could not change the timer');
    } finally {
      setSavingTtl(false);
    }
  };

  return (
    <div className="h-full flex flex-col border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <div className="p-5 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <Avatar
            src={participant.avatar}
            fallback={participant.name?.slice(0, 2).toUpperCase() || 'U'}
            className="w-12 h-12"
          />
          <div className="min-w-0">
            <p className="text-base font-semibold text-slate-900 dark:text-white truncate">
              {participant.name}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {conversation.isTyping
                ? 'Typing...'
                : isOnline(participant.id)
                ? 'Active now'
                : 'Offline'}
            </p>
          </div>
        </div>
        {participant.isVerified && (
          <div className="mt-3 flex items-center gap-2">
            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              <ShieldCheck className="w-3 h-3 mr-1" /> Verified
            </Badge>
          </div>
        )}
      </div>

      <div className="p-5 space-y-6 overflow-y-auto">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500">Actions</p>
          <div className="mt-3 space-y-2">
            <Link
              href={`/profile/${participant.id}`}
              className={cn(buttonVariants({ variant: 'outline' }), 'w-full justify-start')}
            >
              <User className="w-4 h-4 mr-2" /> View Profile
            </Link>
          </div>
        </div>

        <div>
          <p className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500">Search in conversation</p>
          <form onSubmit={runSearch} className="mt-3 flex items-center gap-2">
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (!e.target.value.trim()) setResults(null);
              }}
              placeholder="Find a message"
              aria-label="Search messages"
              className="input flex-1 text-sm"
            />
            <button type="submit" disabled={searching || !query.trim()} aria-label="Search" className="btn-outline p-2">
              <Search className="h-4 w-4" />
            </button>
          </form>
          {results && (
            <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">
              {results.length === 0 && <li className="text-xs text-slate-500">No messages match.</li>}
              {results.map((hit) => (
                <li key={hit.id}>
                  <button
                    type="button"
                    onClick={() => jumpTo(hit.id)}
                    className="w-full rounded-lg border border-slate-100 px-2 py-1.5 text-left text-xs hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                  >
                    <span className="block truncate text-slate-800 dark:text-slate-200">{hit.content}</span>
                    <span className="text-[10px] text-slate-400">
                      {hit.senderId === participant.id ? participant.name : 'You'} · {format(new Date(hit.createdAt), 'd MMM, h:mm a')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500">
            Disappearing messages
          </p>
          <label className="mt-3 flex items-center gap-3">
            <span className="rounded-lg bg-slate-100 p-2 text-slate-500 dark:bg-slate-800">
              <Timer className="w-4 h-4" />
            </span>
            <select
              value={ttl === null ? 'off' : String(ttl)}
              onChange={(event) => void changeTtl(event.target.value)}
              disabled={savingTtl}
              aria-label="Disappearing messages timer"
              className="input flex-1 text-sm"
            >
              {DISAPPEARING_MESSAGE_OPTIONS.map((option) => (
                <option key={option.label} value={option.value === null ? 'off' : String(option.value)}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {ttl
              ? 'New messages in this chat are deleted for both of you once the timer runs out. Messages sent before you changed it stay.'
              : 'Turn on a timer and new messages delete themselves for both of you when it runs out.'}
          </p>
        </div>

        <div>
          <p className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500">Shared Media</p>
          {sharedMedia.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              Nothing shared in this conversation yet.
            </p>
          ) : (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {sharedMedia.map((attachment) => (
                <a
                  key={attachment.id}
                  href={attachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="aspect-square overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  {attachment.type === 'image' ? (
                    // eslint-disable-next-line @next/next/no-img-element -- served from the media CDN, outside the image config
                    <img
                      src={attachment.url}
                      alt={attachment.name || 'Shared image'}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <video src={attachment.url} className="h-full w-full object-cover" />
                  )}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
