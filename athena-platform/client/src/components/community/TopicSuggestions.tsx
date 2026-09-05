'use client';

/**
 * Cold start: a member who follows no topics yet is offered the busiest ones
 * to follow, so the ranked feed has something to go on. Disappears once
 * they follow any, or dismiss it for the session.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Check, Hash, Plus, X } from 'lucide-react';
import { topicApi } from '@/lib/api';
import { useAuthStore } from '@/lib/hooks';
import { cn } from '@/lib/utils';

type Topic = { tag: string; posts: number; videos: number; total: number };

export function TopicSuggestions({ className }: { className?: string }) {
  const { isAuthenticated, isLoading } = useAuthStore();
  const queryClient = useQueryClient();
  const [dismissed, setDismissed] = useState(false);
  const [chosen, setChosen] = useState<Set<string>>(new Set());

  const following = useQuery({
    queryKey: ['followed-topics'],
    queryFn: topicApi.following,
    enabled: isAuthenticated && !isLoading,
    select: (response) => (Array.isArray(response.data?.data) ? (response.data.data as string[]) : []),
  });

  const trending = useQuery({
    queryKey: ['topics', 'trending', 30, 8],
    queryFn: () => topicApi.trending({ days: 30, limit: 8 }),
    enabled: isAuthenticated && !isLoading && following.data?.length === 0,
    select: (response) => (Array.isArray(response.data?.data) ? (response.data.data as Topic[]) : []),
  });

  const follow = useMutation({
    mutationFn: (tag: string) => topicApi.follow(tag),
    onSuccess: (_res, tag) => {
      setChosen((current) => new Set(current).add(tag));
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      toast.success(`Following #${tag}`);
    },
    onError: () => toast.error('Could not follow that topic'),
  });

  if (dismissed || !isAuthenticated || following.data === undefined || following.data.length > 0) return null;
  const topics = (trending.data ?? []).filter((t) => t.total > 0);
  if (topics.length === 0) return null;

  return (
    <section
      className={cn('bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 rounded-xl p-5', className)}
      aria-label="Topics to follow"
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
          <Hash className="h-4 w-4 text-rose-500" /> Shape your feed
        </h2>
        <button
          type="button"
          onClick={() => {
            setDismissed(true);
            queryClient.invalidateQueries({ queryKey: ['followed-topics'] });
          }}
          aria-label="Not now"
          className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
        Follow a few topics and your feed leans towards them, and says so.
      </p>
      <div className="flex flex-wrap gap-2">
        {topics.map((topic) => {
          const on = chosen.has(topic.tag);
          return (
            <button
              key={topic.tag}
              type="button"
              disabled={on || follow.isPending}
              onClick={() => follow.mutate(topic.tag)}
              aria-pressed={on}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition',
                on
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200'
                  : 'border-slate-200 text-slate-700 hover:border-rose-400 hover:text-rose-600 dark:border-slate-700 dark:text-slate-200'
              )}
            >
              {on ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}#{topic.tag}
            </button>
          );
        })}
      </div>
    </section>
  );
}
