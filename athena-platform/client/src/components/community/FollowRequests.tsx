'use client';

/**
 * People asking to follow you, for members who approve their followers.
 * Accepting makes them a follower at once; declining is quiet.
 */

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Check, UserCheck, X } from 'lucide-react';
import { userApi } from '@/lib/api';
import { useAuthStore } from '@/lib/hooks';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

export type FollowRequest = {
  id: string;
  createdAt: string;
  requester: { id: string; name: string; avatar: string | null; headline: string | null };
};

export function useFollowRequests(enabled = true) {
  const { isAuthenticated, isLoading } = useAuthStore();
  return useQuery({
    queryKey: ['follow-requests'],
    queryFn: userApi.followRequests,
    enabled: enabled && isAuthenticated && !isLoading,
    select: (response) => (Array.isArray(response.data?.data) ? (response.data.data as FollowRequest[]) : []),
    refetchInterval: 60_000,
  });
}

const errorMessage = (error: unknown) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message;

export function FollowRequests({ compact = false, className }: { compact?: boolean; className?: string }) {
  const queryClient = useQueryClient();
  const { data: requests = [] } = useFollowRequests();

  const answer = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) =>
      accept ? userApi.acceptFollowRequest(id) : userApi.declineFollowRequest(id),
    onSuccess: (_res, { accept }) => {
      queryClient.invalidateQueries({ queryKey: ['follow-requests'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success(accept ? 'They now follow you' : 'Request declined');
    },
    onError: (error) => toast.error(errorMessage(error) || 'Could not answer the request'),
  });

  if (requests.length === 0) return null;
  const shown = compact ? requests.slice(0, 3) : requests;

  return (
    <section
      id="follow-requests"
      className={cn('bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5', className)}
      aria-label="Follow requests"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
          <UserCheck className="h-4 w-4 text-rose-500" /> Follow requests
          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-900/40 dark:text-rose-200">
            {requests.length}
          </span>
        </h2>
        {compact && requests.length > shown.length && (
          <Link href="/dashboard/notifications#follow-requests" className="text-xs text-primary-600 hover:underline">
            See all
          </Link>
        )}
      </div>
      <ul className="space-y-3">
        {shown.map((request) => (
          <li key={request.id} className="flex items-center gap-3">
            <Link href={`/profile/${request.requester.id}`} className="flex-shrink-0">
              <Avatar
                src={request.requester.avatar || undefined}
                alt={request.requester.name}
                fallback={request.requester.name.slice(0, 2).toUpperCase()}
                size="sm"
              />
            </Link>
            <div className="min-w-0 flex-1">
              <Link href={`/profile/${request.requester.id}`} className="block truncate text-sm font-medium text-slate-900 hover:underline dark:text-white">
                {request.requester.name}
              </Link>
              {request.requester.headline && (
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">{request.requester.headline}</p>
              )}
            </div>
            <div className="flex flex-shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => answer.mutate({ id: request.id, accept: true })}
                disabled={answer.isPending}
                aria-label={`Accept ${request.requester.name}`}
                className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" /> Accept
              </button>
              <button
                type="button"
                onClick={() => answer.mutate({ id: request.id, accept: false })}
                disabled={answer.isPending}
                aria-label={`Decline ${request.requester.name}`}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
