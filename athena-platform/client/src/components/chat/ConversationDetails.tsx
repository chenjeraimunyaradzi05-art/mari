'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { Info, ShieldCheck, User } from 'lucide-react';
import { useChatStore } from '@/lib/stores/chat.store';
import { usePresenceStore } from '@/lib/stores/presence.store';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function ConversationDetails() {
  const { activeConversationId, conversations, messages } = useChatStore();
  const { isOnline } = usePresenceStore();

  const conversation = conversations.find((c) => c.id === activeConversationId);
  const participant = conversation?.participants?.[0];

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
              href={`/dashboard/profile/${participant.id}`}
              className={cn(buttonVariants({ variant: 'outline' }), 'w-full justify-start')}
            >
              <User className="w-4 h-4 mr-2" /> View Profile
            </Link>
          </div>
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
