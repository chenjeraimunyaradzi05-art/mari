'use client';

/**
 * Who is in a group, and what its admins and moderators can do about them.
 * Moderators mute and remove; admins also change roles and ban. Every action
 * is a route that already existed; this is the first screen to reach them.
 */

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Loader2, Shield, VolumeX } from 'lucide-react';
import { groupsApi } from '@/lib/api';
import { useAuthStore } from '@/lib/hooks';
import { Avatar } from '@/components/ui/avatar';

type DbRole = 'ADMIN' | 'MODERATOR' | 'MEMBER';
type Member = { userId: string; role: DbRole; displayName: string; avatar: string | null; joinedAt: string; isMuted: boolean };

const errorMessage = (error: unknown) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message;

const ROLE_LABEL: Record<DbRole, string> = { ADMIN: 'Admin', MODERATOR: 'Moderator', MEMBER: 'Member' };

export function GroupMembers({ groupId, viewerRole }: { groupId: string; viewerRole: 'admin' | 'moderator' | 'member' | null }) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const isAdmin = viewerRole === 'admin';
  const canModerate = isAdmin || viewerRole === 'moderator';

  const { data, isLoading, isError } = useQuery({
    queryKey: ['group-members', groupId],
    queryFn: () => groupsApi.listMembers(groupId),
    select: (response) => (Array.isArray(response.data?.data) ? (response.data.data as Member[]) : []),
  });

  const settle = (message: string) => () => {
    queryClient.invalidateQueries({ queryKey: ['group-members', groupId] });
    queryClient.invalidateQueries({ queryKey: ['group', groupId] });
    toast.success(message);
  };
  const failed = (fallback: string) => (error: unknown) => toast.error(errorMessage(error) || fallback);

  const changeRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: DbRole }) => groupsApi.updateMemberRole(groupId, userId, role),
    onSuccess: settle('Role updated'),
    onError: failed('Could not change the role'),
  });
  const remove = useMutation({
    mutationFn: (userId: string) => groupsApi.removeMember(groupId, userId),
    onSuccess: settle('Removed from the group'),
    onError: failed('Could not remove that member'),
  });
  const mute = useMutation({
    mutationFn: ({ userId, muted }: { userId: string; muted: boolean }) =>
      muted ? groupsApi.unmuteMember(groupId, userId) : groupsApi.muteMember(groupId, userId, 24 * 60),
    onSuccess: (_res, { muted }) => settle(muted ? 'Unmuted' : 'Muted for 24 hours')(),
    onError: failed('Could not change the mute'),
  });
  const ban = useMutation({
    mutationFn: (userId: string) => groupsApi.banMember(groupId, userId),
    onSuccess: settle('Banned from the group'),
    onError: failed('Could not ban that member'),
  });

  if (isLoading) {
    return (
      <div className="card flex justify-center p-8">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }
  if (isError || !data) {
    return <div className="card p-6 text-sm text-slate-500">Could not load the members.</div>;
  }

  const busy = changeRole.isPending || remove.isPending || mute.isPending || ban.isPending;

  return (
    <ul className="card divide-y divide-slate-100 p-0 dark:divide-slate-800">
      {data.map((member) => {
        const name = member.displayName?.trim() || 'Member';
        const isSelf = member.userId === user?.id;
        // Admins are only managed by other admins; nobody manages themselves here.
        const manageable = canModerate && !isSelf && (member.role !== 'ADMIN' || isAdmin);
        return (
          <li key={member.userId} className="flex flex-wrap items-center gap-3 p-4">
            <Link href={`/profile/${member.userId}`} className="flex-shrink-0">
              <Avatar src={member.avatar || undefined} alt={name} fallback={name.slice(0, 2).toUpperCase()} size="sm" />
            </Link>
            <div className="min-w-0 flex-1">
              <Link href={`/profile/${member.userId}`} className="flex items-center gap-2 text-sm font-medium text-slate-900 hover:underline dark:text-white">
                <span className="truncate">{name}</span>
                {isSelf && <span className="text-xs font-normal text-slate-400">(you)</span>}
              </Link>
              <p className="flex items-center gap-2 text-xs text-slate-500">
                {member.role !== 'MEMBER' && (
                  <span className="inline-flex items-center gap-1 text-primary-700 dark:text-primary-300">
                    <Shield className="h-3 w-3" /> {ROLE_LABEL[member.role]}
                  </span>
                )}
                {member.isMuted && (
                  <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
                    <VolumeX className="h-3 w-3" /> Muted
                  </span>
                )}
              </p>
            </div>

            {manageable && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {isAdmin && (
                  <select
                    value={member.role}
                    onChange={(event) => changeRole.mutate({ userId: member.userId, role: event.target.value as DbRole })}
                    disabled={busy}
                    aria-label={`Role for ${name}`}
                    className="input py-1 text-xs"
                  >
                    <option value="MEMBER">Member</option>
                    <option value="MODERATOR">Moderator</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                )}
                <button
                  type="button"
                  onClick={() => mute.mutate({ userId: member.userId, muted: member.isMuted })}
                  disabled={busy}
                  className="btn-outline px-2.5 py-1 text-xs"
                >
                  {member.isMuted ? 'Unmute' : 'Mute 24h'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Remove ${name} from the group?`)) remove.mutate(member.userId);
                  }}
                  disabled={busy}
                  className="btn-outline px-2.5 py-1 text-xs"
                >
                  Remove
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Ban ${name}? They cannot rejoin.`)) ban.mutate(member.userId);
                    }}
                    disabled={busy}
                    className="px-2.5 py-1 text-xs font-medium text-red-600 hover:text-red-700"
                  >
                    Ban
                  </button>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
