'use client';

/**
 * Who reacted to a post, and how. Opened from the reaction summary on a
 * card. The tabs narrow the list to one reaction; each row links to the
 * person's profile and offers a follow button for anyone the viewer does not
 * follow yet, so the list doubles as a place to find people worth following.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Avatar } from '@/components/ui/avatar';
import { postApi, userApi, REACTIONS, type ReactionType } from '@/lib/api';
import { cn } from '@/lib/utils';
import { reactionEmoji, reactionLabel, type ReactionCounts } from './ReactionBar';

type Reactor = {
  type: ReactionType;
  reactedAt: string;
  user: {
    id: string;
    name: string;
    avatar: string | null;
    headline: string | null;
    isFollowing: boolean;
    isSelf: boolean;
  };
};

export function ReactionsDialog({
  postId,
  counts,
  open,
  onClose,
}: {
  postId: string;
  counts: ReactionCounts;
  open: boolean;
  onClose: () => void;
}) {
  const [type, setType] = useState<ReactionType | 'ALL'>('ALL');
  const [followed, setFollowed] = useState<Record<string, boolean>>({});

  const { data, isLoading, isError } = useQuery({
    queryKey: ['post-reactions', postId, type],
    queryFn: () => postApi.getReactions(postId, type === 'ALL' ? { limit: 50 } : { type, limit: 50 }),
    enabled: open,
    select: (response) => (Array.isArray(response.data?.data) ? (response.data.data as Reactor[]) : []),
  });

  const tabs = REACTIONS.filter((reaction) => (counts[reaction.type] ?? 0) > 0);
  const total = Object.values(counts).reduce((sum, n) => sum + (n ?? 0), 0);

  const toggleFollow = async (person: Reactor['user']) => {
    const current = followed[person.id] ?? person.isFollowing;
    const next = !current;
    setFollowed((prev) => ({ ...prev, [person.id]: next }));
    try {
      const response = await (next ? userApi.follow(person.id) : userApi.unfollow(person.id));
      if (next) toast.success(response.data?.requested ? 'Request sent' : `Following ${person.name}`);
    } catch {
      setFollowed((prev) => ({ ...prev, [person.id]: current }));
      toast.error('Could not update the follow');
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Reactions" size="sm">
      <div className="space-y-3">
        {tabs.length > 1 && (
          <div className="flex flex-wrap gap-1" role="tablist" aria-label="Reaction type">
            <button
              type="button"
              role="tab"
              aria-selected={type === 'ALL'}
              onClick={() => setType('ALL')}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium',
                type === 'ALL' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              )}
            >
              All {total.toLocaleString()}
            </button>
            {tabs.map((reaction) => (
              <button
                key={reaction.type}
                type="button"
                role="tab"
                aria-selected={type === reaction.type}
                onClick={() => setType(reaction.type)}
                title={reaction.label}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium',
                  type === reaction.type ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                )}
              >
                {reaction.emoji} {(counts[reaction.type] ?? 0).toLocaleString()}
              </button>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : isError ? (
          <p className="py-6 text-center text-sm text-slate-500">Could not load who reacted.</p>
        ) : !data || data.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">Nobody yet.</p>
        ) : (
          <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
            {data.map((row) => {
              const on = followed[row.user.id] ?? row.user.isFollowing;
              return (
                <li key={`${row.user.id}-${row.type}`} className="flex items-center gap-3 py-2">
                  <Link href={`/profile/${row.user.id}`} onClick={onClose} className="relative flex-shrink-0">
                    <Avatar src={row.user.avatar || undefined} alt={row.user.name} fallback={row.user.name.slice(0, 2).toUpperCase()} size="sm" />
                    <span
                      className="absolute -bottom-1 -right-1 rounded-full bg-white text-xs leading-none dark:bg-slate-900"
                      title={reactionLabel(row.type)}
                      aria-label={reactionLabel(row.type)}
                    >
                      {reactionEmoji(row.type)}
                    </span>
                  </Link>
                  <span className="min-w-0 flex-1">
                    <Link href={`/profile/${row.user.id}`} onClick={onClose} className="block truncate text-sm font-medium text-slate-900 hover:underline dark:text-white">
                      {row.user.name}
                    </Link>
                    {row.user.headline && <span className="block truncate text-xs text-slate-500">{row.user.headline}</span>}
                  </span>
                  {!row.user.isSelf && (
                    <button
                      type="button"
                      onClick={() => void toggleFollow(row.user)}
                      aria-pressed={on}
                      className={cn('px-3 py-1 text-xs', on ? 'btn-outline' : 'btn-primary')}
                    >
                      {on ? 'Following' : 'Follow'}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}
