'use client';

/**
 * The join-request inbox for a private group's admins and moderators. The
 * approve and deny routes have existed since private groups did; until now
 * nothing called them, so a private group could not admit anyone from the
 * app.
 */

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { Check, Loader2, X } from 'lucide-react';
import { groupsApi } from '@/lib/api';
import { Avatar } from '@/components/ui/avatar';

type JoinRequest = {
  id: string;
  userId: string;
  createdAt: string;
  user?: { id: string; firstName?: string | null; lastName?: string | null; displayName?: string | null; avatar?: string | null; headline?: string | null } | null;
};

const errorMessage = (error: unknown) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message;

function nameOf(request: JoinRequest): string {
  const u = request.user;
  return u?.displayName?.trim() || [u?.firstName, u?.lastName].filter(Boolean).join(' ').trim() || 'Member';
}

export function GroupJoinRequests({ groupId }: { groupId: string }) {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['group-join-requests', groupId],
    queryFn: () => groupsApi.listJoinRequests(groupId),
    select: (response) => (Array.isArray(response.data?.data) ? (response.data.data as JoinRequest[]) : []),
  });

  const settle = () => {
    queryClient.invalidateQueries({ queryKey: ['group-join-requests', groupId] });
    queryClient.invalidateQueries({ queryKey: ['group', groupId] });
    queryClient.invalidateQueries({ queryKey: ['group-members', groupId] });
  };

  const approve = useMutation({
    mutationFn: (requestId: string) => groupsApi.approveJoinRequest(groupId, requestId),
    onSuccess: () => {
      settle();
      toast.success('Added to the group');
    },
    onError: (error) => toast.error(errorMessage(error) || 'Could not approve that request'),
  });

  const deny = useMutation({
    mutationFn: (requestId: string) => groupsApi.denyJoinRequest(groupId, requestId),
    onSuccess: () => {
      settle();
      toast.success('Request declined');
    },
    onError: (error) => toast.error(errorMessage(error) || 'Could not decline that request'),
  });

  if (isLoading) {
    return (
      <div className="card flex justify-center p-8">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }
  if (isError) {
    return <div className="card p-6 text-sm text-slate-500">Could not load the join requests.</div>;
  }
  if (!data || data.length === 0) {
    return <div className="card p-6 text-sm text-slate-500 dark:text-slate-400">Nobody is waiting to join.</div>;
  }

  const busy = approve.isPending || deny.isPending;

  return (
    <ul className="card divide-y divide-slate-100 p-0 dark:divide-slate-800">
      {data.map((request) => {
        const name = nameOf(request);
        return (
          <li key={request.id} className="flex items-center gap-3 p-4">
            <Link href={`/profile/${request.userId}`} className="flex-shrink-0">
              <Avatar src={request.user?.avatar || undefined} alt={name} fallback={name.slice(0, 2).toUpperCase()} size="sm" />
            </Link>
            <div className="min-w-0 flex-1">
              <Link href={`/profile/${request.userId}`} className="block truncate text-sm font-medium text-slate-900 hover:underline dark:text-white">
                {name}
              </Link>
              <p className="truncate text-xs text-slate-500">
                {request.user?.headline ? `${request.user.headline} · ` : ''}
                asked {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => approve.mutate(request.id)}
              disabled={busy}
              className="btn-primary inline-flex items-center gap-1 px-3 py-1.5 text-xs"
            >
              <Check className="h-3.5 w-3.5" /> Approve
            </button>
            <button
              type="button"
              onClick={() => deny.mutate(request.id)}
              disabled={busy}
              className="btn-outline inline-flex items-center gap-1 px-3 py-1.5 text-xs"
            >
              <X className="h-3.5 w-3.5" /> Decline
            </button>
          </li>
        );
      })}
    </ul>
  );
}
