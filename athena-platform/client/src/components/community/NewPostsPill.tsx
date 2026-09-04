'use client';

/**
 * "3 new posts": the server tells followers when someone they follow posts,
 * and rather than shifting the list under the reader, a pill offers to load
 * them. Posts the reader wrote themselves are not counted.
 */

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowUp } from 'lucide-react';
import { useSocket } from '@/lib/hooks/use-socket';
import { useAuthStore } from '@/lib/hooks';
import { cn } from '@/lib/utils';

type NewPostEvent = { postId: string; authorId: string; authorName?: string };

export function NewPostsPill({ className }: { className?: string }) {
  const { socket } = useSocket();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<NewPostEvent[]>([]);

  useEffect(() => {
    if (!socket) return;
    const onNew = (event: NewPostEvent) => {
      if (!event?.postId || event.authorId === user?.id) return;
      setPending((current) => (current.some((e) => e.postId === event.postId) ? current : [...current, event]));
    };
    socket.on('feed:new', onNew);
    return () => {
      socket.off('feed:new', onNew);
    };
  }, [socket, user?.id]);

  if (pending.length === 0) return null;

  const names = Array.from(new Set(pending.map((e) => e.authorName).filter(Boolean))) as string[];
  const label =
    pending.length === 1
      ? `New post${names[0] ? ` from ${names[0]}` : ''}`
      : `${pending.length} new posts${names.length === 1 ? ` from ${names[0]}` : ''}`;

  return (
    <div className={cn('sticky top-2 z-20 flex justify-center', className)}>
      <button
        type="button"
        onClick={() => {
          setPending([]);
          queryClient.invalidateQueries({ queryKey: ['feed'] });
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-rose-700"
      >
        <ArrowUp className="h-4 w-4" /> {label}
      </button>
    </div>
  );
}
