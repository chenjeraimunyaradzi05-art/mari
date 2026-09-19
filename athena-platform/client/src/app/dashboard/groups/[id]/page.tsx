'use client';

/**
 * A group's page: who it is for, join or leave, and its posts. Posts here
 * are full posts (reactions, comments, mentions, media, insights) that live
 * on this page only; a private group's posts are for members.
 *
 * Someone who asked to join a private group is told where her request
 * stands instead of being shown Join again, and a notification's link can
 * pick the tab with ?tab= so it lands on the requests or the chat.
 */

import { Suspense, useMemo, useState } from 'react';
import { Lock, Users } from 'lucide-react';
import { useParams, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { groupsApi } from '@/lib/api';
import {
  useAuthStore,
  useCancelMyGroupJoinRequest,
  useDeleteGroupPost,
  useGroup,
  useGroupPosts,
  useJoinGroup,
  useLeaveGroup,
  useMyGroupJoinRequest,
} from '@/lib/hooks';
import { cn } from '@/lib/utils';
import PostCard from '@/components/community/PostCard';
import { GroupComposer } from '@/components/community/GroupComposer';
import { GroupChat } from '@/components/community/GroupChat';
import { GroupMembers } from '@/components/community/GroupMembers';
import { GroupJoinRequests } from '@/components/community/GroupJoinRequests';
import { GroupSettings } from '@/components/community/GroupSettings';

type Tab = 'posts' | 'chat' | 'members' | 'requests' | 'settings';
const TABS: readonly Tab[] = ['posts', 'chat', 'members', 'requests', 'settings'];
const isTab = (value: string | null): value is Tab => !!value && (TABS as readonly string[]).includes(value);

function GroupDetailContent() {
  const params = useParams<{ id: string }>();
  const groupId = params?.id;
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get('tab');

  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const { data: group } = useGroup(groupId);
  const { data: postsRaw = [], isError: postsError } = useGroupPosts(groupId);

  const joinGroup = useJoinGroup();
  const leaveGroup = useLeaveGroup();
  const cancelRequest = useCancelMyGroupJoinRequest();
  const deletePost = useDeleteGroupPost();
  const [tab, setTab] = useState<Tab>(() => (isTab(requestedTab) ? requestedTab : 'posts'));

  // The requests tab shows how many are waiting, so an admin sees it at once.
  const canModerateGroup = group?.role === 'admin' || group?.role === 'moderator';
  const isGroupAdmin = group?.role === 'admin';
  const joinRequests = useQuery({
    queryKey: ['group-join-requests', groupId],
    queryFn: () => groupsApi.listJoinRequests(groupId!),
    enabled: Boolean(groupId && canModerateGroup && group?.privacy === 'private'),
    select: (response) => (Array.isArray(response.data?.data) ? response.data.data : []),
  });

  // The person who asked to join a private group is told where it stands.
  const asksToJoin = Boolean(user && group && !group.isMember && group.privacy === 'private');
  const myRequest = useMyGroupJoinRequest(asksToJoin ? group!.id : undefined);

  const posts: Array<{ id: string; author?: { id?: string } | null }> = useMemo(
    () => (Array.isArray(postsRaw) ? postsRaw : []),
    [postsRaw]
  );

  if (!group) {
    return <div className="max-w-3xl mx-auto p-6 text-slate-500">Loading…</div>;
  }

  const canPost = !!user && group.isMember;
  const membersOnly = group.privacy === 'private' && !group.isMember;
  // Admins and moderators can take down anyone's post; authors handle their own.
  const canModerate = group.role === 'admin' || group.role === 'moderator';
  const removeFor = (post: { id: string; author?: { id?: string } | null }) =>
    canModerate && post.author?.id !== user?.id
      ? () => {
          if (window.confirm('Remove this post from the group?')) deletePost.mutate({ groupId: group.id, postId: post.id });
        }
      : undefined;

  const requestStatus: string = (myRequest.data?.status as string | undefined) ?? group.joinRequestStatus ?? 'none';
  // The last admin cannot leave a group that still has members; she is told before she tries.
  const soleAdmin = isGroupAdmin && (group.adminCount ?? 1) <= 1;

  const tabs: Array<[Tab, string]> = [
    ['posts', 'Posts'],
    ['chat', 'Chat'],
    ['members', 'Members'],
    ...(canModerateGroup && group.privacy === 'private' ? ([['requests', 'Requests']] as Array<[Tab, string]>) : []),
    ...(isGroupAdmin ? ([['settings', 'Settings']] as Array<[Tab, string]>) : []),
  ];
  const activeTab: Tab = tabs.some(([value]) => value === tab) ? tab : 'posts';

  const join = () =>
    joinGroup.mutate(group.id, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['group-join-request', group.id] }),
    });
  const leave = () => {
    if (window.confirm(`Leave ${group.name}?`)) leaveGroup.mutate(group.id);
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{group.name}</h1>
            <p className="text-slate-600 dark:text-slate-300 mt-2">{group.description}</p>
            <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
              <Users className="w-4 h-4" />
              <span>{group.memberCount} members</span>
              <span className="text-xs px-2 py-1 rounded-full border border-slate-200 text-slate-600 dark:text-slate-300">
                {group.privacy}
              </span>
              {group.role && group.role !== 'member' && (
                <span className="text-xs px-2 py-1 rounded-full bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300">
                  You are a {group.role}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            {group.isMember ? (
              <>
                <button className="btn-outline" onClick={leave} disabled={leaveGroup.isPending}>
                  Leave
                </button>
                {soleAdmin && group.memberCount > 1 && (
                  <p className="max-w-[240px] text-right text-xs text-slate-500 dark:text-slate-400">
                    You&apos;re the only admin. Make someone else an admin before you leave.
                  </p>
                )}
                {soleAdmin && group.memberCount <= 1 && (
                  <button
                    type="button"
                    onClick={() => setTab('settings')}
                    className="text-xs text-slate-500 underline hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  >
                    Or close the group
                  </button>
                )}
              </>
            ) : !user || group.privacy !== 'private' ? (
              <button className="btn-primary" onClick={join} disabled={joinGroup.isPending}>
                Join
              </button>
            ) : requestStatus === 'pending' ? (
              <>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Request sent</span>
                <button
                  type="button"
                  onClick={() => cancelRequest.mutate(group.id)}
                  disabled={cancelRequest.isPending}
                  className="text-xs text-slate-500 underline hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  Cancel
                </button>
              </>
            ) : requestStatus === 'denied' ? (
              <p className="max-w-[240px] text-right text-sm text-slate-500 dark:text-slate-400">
                Your request wasn&apos;t approved this time.
              </p>
            ) : (
              <button className="btn-primary" onClick={join} disabled={joinGroup.isPending}>
                Ask to join
              </button>
            )}
          </div>
        </div>

        {canPost && <GroupComposer groupId={group.id} groupName={group.name} />}

        {!user && <div className="mt-6 text-sm text-slate-500">Log in to join and post.</div>}
      </div>

      {group.isMember && (
        <div className="flex gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1 dark:bg-slate-800" role="tablist" aria-label="Group sections">
          {tabs.map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={activeTab === value}
              onClick={() => setTab(value)}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium',
                activeTab === value ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'
              )}
            >
              {label}
              {value === 'requests' && (joinRequests.data?.length ?? 0) > 0 && (
                <span className="rounded-full bg-rose-600 px-1.5 text-[11px] font-semibold text-white">{joinRequests.data!.length}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {group.isMember && activeTab === 'chat' && <GroupChat groupId={group.id} canModerate={canModerateGroup} />}
      {group.isMember && activeTab === 'members' && (
        <GroupMembers groupId={group.id} viewerRole={group.role} canInvite={canModerateGroup || group.allowMemberInvites !== false} />
      )}
      {group.isMember && activeTab === 'requests' && canModerateGroup && <GroupJoinRequests groupId={group.id} />}
      {group.isMember && activeTab === 'settings' && isGroupAdmin && <GroupSettings group={group} />}

      <div className={cn('space-y-4', group.isMember && activeTab !== 'posts' && 'hidden')}>
        {membersOnly || postsError ? (
          <div className="card flex items-start gap-3 p-5 text-sm text-slate-500 dark:text-slate-400">
            <Lock className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
            <span>This is a private group. Its posts open up once you&apos;re in.</span>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-slate-500">No posts yet.</div>
        ) : (
          posts.map((post) => <PostCard key={post.id} post={post} source="group" onModeratorRemove={removeFor(post)} />)
        )}
      </div>
    </div>
  );
}

// useSearchParams needs a Suspense boundary above it.
export default function GroupDetailPage() {
  return (
    <Suspense fallback={<div className="max-w-3xl mx-auto p-6 text-slate-500">Loading…</div>}>
      <GroupDetailContent />
    </Suspense>
  );
}
