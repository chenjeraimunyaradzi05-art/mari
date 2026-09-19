'use client';

/**
 * Who is in a group, and what its admins and moderators can do about them.
 * Moderators mute and remove; admins also change roles, ban, and see who is
 * banned so a ban can be lifted. Anyone allowed to invite can add someone by
 * name at the top. Every action is a route; this is the screen for them.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Loader2, Shield, UserPlus, VolumeX } from 'lucide-react';
import { groupsApi, mentionApi } from '@/lib/api';
import { useAuthStore } from '@/lib/hooks';
import { Avatar } from '@/components/ui/avatar';

type DbRole = 'ADMIN' | 'MODERATOR' | 'MEMBER';
type Member = { userId: string; role: DbRole; displayName: string; avatar: string | null; joinedAt: string; isMuted: boolean };
type Banned = { userId: string; displayName: string; avatar: string | null; bannedReason: string | null };
type Suggestion = { id: string; name: string; avatar: string | null; headline: string | null };

const errorMessage = (error: unknown) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message;

const ROLE_LABEL: Record<DbRole, string> = { ADMIN: 'Admin', MODERATOR: 'Moderator', MEMBER: 'Member' };

/** A reason is optional; cancelling the prompt cancels the action. */
function askReason(question: string): string | null {
  const answer = window.prompt(question, '');
  return answer === null ? null : answer.trim();
}

export function GroupMembers({
  groupId,
  viewerRole,
  canInvite = false,
}: {
  groupId: string;
  viewerRole: 'admin' | 'moderator' | 'member' | null;
  /** Plain members may add people when the group allows it; the server enforces it too. */
  canInvite?: boolean;
}) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const isAdmin = viewerRole === 'admin';
  const canModerate = isAdmin || viewerRole === 'moderator';
  const canAdd = canModerate || canInvite;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['group-members', groupId],
    queryFn: () => groupsApi.listMembers(groupId),
    select: (response) => (Array.isArray(response.data?.data) ? (response.data.data as Member[]) : []),
  });

  // Only admins can lift a ban, so only they are shown the banned.
  const banned = useQuery({
    queryKey: ['group-banned', groupId],
    queryFn: () => groupsApi.listBannedMembers(groupId),
    enabled: isAdmin,
    select: (response) => (Array.isArray(response.data?.data) ? (response.data.data as Banned[]) : []),
  });

  const settle = (message: string) => () => {
    queryClient.invalidateQueries({ queryKey: ['group-members', groupId] });
    queryClient.invalidateQueries({ queryKey: ['group-banned', groupId] });
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
    mutationFn: ({ userId, muted, reason }: { userId: string; muted: boolean; reason?: string }) =>
      muted ? groupsApi.unmuteMember(groupId, userId) : groupsApi.muteMember(groupId, userId, 24 * 60, reason),
    onSuccess: (_res, { muted }) => settle(muted ? 'Unmuted' : 'Muted for 24 hours')(),
    onError: failed('Could not change the mute'),
  });
  const ban = useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason?: string }) => groupsApi.banMember(groupId, userId, reason),
    onSuccess: settle('Banned from the group'),
    onError: failed('Could not ban that member'),
  });
  const unban = useMutation({
    mutationFn: (userId: string) => groupsApi.unbanMember(groupId, userId),
    onSuccess: settle('Ban lifted'),
    onError: failed('Could not lift that ban'),
  });

  // Add someone by name: the same member search the composer's @mentions use.
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  useEffect(() => {
    const q = search.trim();
    if (!canAdd || q.length < 1) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      mentionApi
        .suggest(q)
        .then((res) => {
          if (cancelled) return;
          setSuggestions(Array.isArray(res.data?.data) ? (res.data.data as Suggestion[]) : []);
        })
        .catch(() => {
          if (!cancelled) setSuggestions([]);
        });
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, canAdd]);

  const add = useMutation({
    mutationFn: (userId: string) => groupsApi.addMember(groupId, userId),
    onSuccess: (res) => {
      setSearch('');
      setSuggestions([]);
      queryClient.invalidateQueries({ queryKey: ['group-join-requests', groupId] });
      const pending = (res as { data?: { data?: { status?: string } } })?.data?.data?.status === 'pending';
      settle(pending ? 'Suggested. An admin will approve it.' : 'Added to the group')();
    },
    onError: failed('Could not add them'),
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

  const busy = changeRole.isPending || remove.isPending || mute.isPending || ban.isPending || unban.isPending || add.isPending;
  const memberIds = new Set(data.map((member) => member.userId));
  const people = suggestions.filter((suggestion) => !memberIds.has(suggestion.id));

  return (
    <div className="space-y-4">
      {canAdd && (
        <div className="card p-4">
          <label htmlFor="group-add-member" className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white">
            <UserPlus className="h-4 w-4 text-primary-600" aria-hidden="true" /> Add someone
          </label>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {canModerate ? 'Search by name; they join straight away.' : 'Search by name; an admin will approve it.'}
          </p>
          <div className="relative mt-2">
            <input
              id="group-add-member"
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Start typing a name"
              autoComplete="off"
              aria-autocomplete="list"
              aria-expanded={people.length > 0}
              className="input w-full"
            />
            {people.length > 0 && (
              <ul
                role="listbox"
                aria-label="People"
                className="absolute left-0 z-20 mt-1 max-h-60 w-full max-w-sm overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
              >
                {people.map((person) => (
                  <li key={person.id} role="option" aria-selected={false}>
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => add.mutate(person.id)}
                      disabled={busy}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <Avatar src={person.avatar || undefined} alt="" fallback={person.name.slice(0, 2).toUpperCase()} size="xs" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-slate-900 dark:text-white">{person.name}</span>
                        {person.headline && <span className="block truncate text-xs text-slate-500">{person.headline}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

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
                    onClick={() => {
                      if (member.isMuted) {
                        mute.mutate({ userId: member.userId, muted: true });
                        return;
                      }
                      const reason = askReason(`Mute ${name} for 24 hours? Add a reason if you like; they will see it.`);
                      if (reason === null) return;
                      mute.mutate({ userId: member.userId, muted: false, reason: reason || undefined });
                    }}
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
                        const reason = askReason(`Ban ${name}? They cannot rejoin unless an admin lifts it. Add a reason if you like; they will see it.`);
                        if (reason === null) return;
                        ban.mutate({ userId: member.userId, reason: reason || undefined });
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

      {isAdmin && banned.data && banned.data.length > 0 && (
        <details className="card p-4">
          <summary className="cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-200">
            Banned ({banned.data.length})
          </summary>
          <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
            {banned.data.map((person) => {
              const name = person.displayName?.trim() || 'Member';
              return (
                <li key={person.userId} className="flex flex-wrap items-center gap-3 py-3">
                  <Link href={`/profile/${person.userId}`} className="flex-shrink-0">
                    <Avatar src={person.avatar || undefined} alt={name} fallback={name.slice(0, 2).toUpperCase()} size="sm" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={`/profile/${person.userId}`} className="block truncate text-sm font-medium text-slate-900 hover:underline dark:text-white">
                      {name}
                    </Link>
                    {person.bannedReason && <p className="truncate text-xs text-slate-500">{person.bannedReason}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Lift the ban on ${name}? They can ask to join again.`)) unban.mutate(person.userId);
                    }}
                    disabled={busy}
                    className="btn-outline px-2.5 py-1 text-xs"
                  >
                    Unban
                  </button>
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </div>
  );
}
