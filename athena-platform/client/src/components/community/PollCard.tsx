'use client';

import { useState } from 'react';
import { BarChart3, Check, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { useVoteInPoll } from '@/lib/social-hooks';

export interface PollResults {
  options: Array<{ id: string; text: string; votes: number; percent: number }>;
  totalVotes: number;
  myVote: string | null;
  endsAt: string;
  isClosed: boolean;
}

interface PollCardProps {
  postId: string;
  poll: PollResults;
  canVote: boolean;
  compact?: boolean;
}

/**
 * A poll: options to pick from until you have voted or it has closed, then
 * results. The vote is optimistic so the bars move the moment you choose.
 */
export function PollCard({ postId, poll, canVote, compact = false }: PollCardProps) {
  const vote = useVoteInPoll();
  const [local, setLocal] = useState<PollResults>(poll);
  const showResults = local.myVote !== null || local.isClosed || !canVote;

  const choose = (optionId: string) => {
    if (!canVote || local.isClosed || vote.isPending) return;
    const previous = local;
    // Optimistic: move the vote before the server confirms it.
    const options = local.options.map((option) => ({ ...option }));
    const wasFor = local.myVote;
    if (wasFor) {
      const prev = options.find((o) => o.id === wasFor);
      if (prev) prev.votes = Math.max(0, prev.votes - 1);
    }
    const next = options.find((o) => o.id === optionId);
    if (next) next.votes += 1;
    const total = options.reduce((sum, o) => sum + o.votes, 0);
    setLocal({
      ...local,
      myVote: optionId,
      totalVotes: total,
      options: options.map((o) => ({ ...o, percent: total ? Math.round((o.votes / total) * 100) : 0 })),
    });
    vote.mutate(
      { postId, optionId },
      {
        onSuccess: (res) => {
          if (res.data?.data) setLocal(res.data.data);
        },
        onError: () => setLocal(previous),
      }
    );
  };

  const closesIn = (() => {
    const date = new Date(local.endsAt);
    if (Number.isNaN(date.getTime())) return '';
    return local.isClosed ? `Closed ${formatDistanceToNow(date, { addSuffix: true })}` : `Closes ${formatDistanceToNow(date, { addSuffix: true })}`;
  })();

  return (
    <div className={cn('rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60', compact && 'p-2')}>
      <ul className="space-y-2">
        {local.options.map((option) => {
          const mine = local.myVote === option.id;
          return (
            <li key={option.id}>
              {showResults ? (
                <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                  <div
                    className={cn('absolute inset-y-0 left-0 transition-[width]', mine ? 'bg-rose-100 dark:bg-rose-900/40' : 'bg-slate-100 dark:bg-slate-800')}
                    style={{ width: `${option.percent}%` }}
                  />
                  <button
                    type="button"
                    disabled={!canVote || local.isClosed || vote.isPending}
                    onClick={() => choose(option.id)}
                    className="relative flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm"
                    aria-pressed={mine}
                  >
                    <span className={cn('flex items-center gap-2 text-slate-800 dark:text-slate-100', mine && 'font-semibold')}>
                      {mine && <Check className="h-4 w-4 text-rose-600" />}
                      {option.text}
                    </span>
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{option.percent}%</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => choose(option.id)}
                  disabled={vote.isPending}
                  className="w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-left text-sm font-medium text-rose-700 transition hover:bg-rose-50 dark:border-rose-800 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-900/20"
                >
                  {option.text}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-2 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1">
          <BarChart3 className="h-3.5 w-3.5" /> {local.totalVotes} {local.totalVotes === 1 ? 'vote' : 'votes'}
        </span>
        {closesIn && (
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> {closesIn}
          </span>
        )}
        {!canVote && !local.isClosed && <span>Sign in to vote</span>}
      </p>
    </div>
  );
}

export default PollCard;
