'use client';

/**
 * How one post did, for its author: impressions and reach, every kind of
 * engagement, where it was seen, and new reach per day for the last week.
 */

import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { postApi } from '@/lib/api';
import { Modal } from '@/components/ui/modal';
import { formatCount } from './RepostButton';

export type PostInsights = {
  postId: string;
  postedAt: string;
  impressions: number;
  reach: number;
  reactions: { total: number; byType: Record<string, number> };
  comments: number;
  saves: number;
  reposts: number;
  shares: number;
  engagements: number;
  engagementRate: number;
  sources: Array<{ source: string; count: number }>;
  daily: Array<{ date: string; reach: number }>;
};

const SOURCE_LABELS: Record<string, string> = {
  feed: 'Community feed',
  home: 'Home',
  profile: 'Your profile',
  post: 'The post page',
  saved: 'Saved items',
  search: 'Search',
  topic: 'Topic pages',
  other: 'Elsewhere',
};

const REACTION_LABELS: Record<string, string> = {
  LIKE: 'Likes',
  CELEBRATE: 'Celebrations',
  SUPPORT: 'Support',
  INSIGHTFUL: 'Insightful',
  INSPIRED: 'Inspired',
};

export function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
      <p className="text-xl font-bold text-slate-900 dark:text-white">{typeof value === 'number' ? formatCount(value) : value}</p>
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      {hint && <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

export function ReachChart({ daily }: { daily: PostInsights['daily'] }) {
  const max = Math.max(1, ...daily.map((d) => d.reach));
  return (
    <div className="flex h-24 items-end gap-1.5" role="img" aria-label="New reach per day, last 7 days">
      {daily.map((day) => (
        <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-[10px] text-slate-500">{day.reach || ''}</span>
          <div
            className="w-full rounded-t bg-rose-500/80 dark:bg-rose-400/80"
            style={{ height: `${Math.max(2, (day.reach / max) * 64)}px` }}
            title={`${day.date}: ${day.reach}`}
          />
          <span className="text-[10px] text-slate-400">{day.date.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

export function PostInsightsDialog({ postId, open, onClose }: { postId: string; open: boolean; onClose: () => void }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['post-insights', postId],
    queryFn: () => postApi.getInsights(postId),
    enabled: open,
    select: (response) => response.data?.data as PostInsights,
  });

  return (
    <Modal isOpen={open} onClose={onClose} title="Post insights" size="md">
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : isError || !data ? (
        <p className="py-6 text-center text-sm text-slate-500">Could not load insights for this post.</p>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Impressions" value={data.impressions} hint="Times shown" />
            <Stat label="Reach" value={data.reach} hint="People who saw it" />
            <Stat label="Engagement" value={`${data.engagementRate}%`} hint={`${formatCount(data.engagements)} actions`} />
            <Stat label="Reactions" value={data.reactions.total} />
            <Stat label="Comments" value={data.comments} />
            <Stat label="Saves" value={data.saves} />
            <Stat label="Reposts" value={data.reposts} />
            <Stat label="Shares" value={data.shares} />
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">New reach, last 7 days</h3>
            <ReachChart daily={data.daily} />
          </div>

          {Object.keys(data.reactions.byType).length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">How people reacted</h3>
              <ul className="flex flex-wrap gap-2 text-xs">
                {Object.entries(data.reactions.byType).map(([type, count]) => (
                  <li key={type} className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {REACTION_LABELS[type] ?? type}: <strong>{count}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.sources.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Where it was seen</h3>
              <ul className="space-y-1.5">
                {data.sources.map((row) => {
                  const pct = data.reach ? Math.round((row.count / data.reach) * 100) : 0;
                  return (
                    <li key={row.source} className="text-xs">
                      <div className="flex justify-between text-slate-600 dark:text-slate-300">
                        <span>{SOURCE_LABELS[row.source] ?? row.source}</span>
                        <span>
                          {formatCount(row.count)} · {pct}%
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div className="h-full rounded-full bg-purple-500" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <p className="text-[11px] text-slate-400">
            Impressions count every time the post was on screen for a second or more. Reach counts each person once. Your own views are never counted.
          </p>
        </div>
      )}
    </Modal>
  );
}
