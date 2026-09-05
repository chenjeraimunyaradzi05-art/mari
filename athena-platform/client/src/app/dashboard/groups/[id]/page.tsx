'use client';

/**
 * A group's page: who it is for, join or leave, and its posts. Posts here
 * are full posts (reactions, comments, mentions, media, insights) that live
 * on this page only; a private group's posts are for members.
 */

import { useMemo, useState } from 'react';
import { Lock, Users } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { groupsApi } from '@/lib/api';
import { useAuthStore, useDeleteGroupPost, useGroup, useGroupPosts, useJoinGroup, useLeaveGroup } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import PostCard from '@/components/community/PostCard';
import { GroupComposer } from '@/components/community/GroupComposer';
import { GroupChat } from '@/components/community/GroupChat';
import { GroupMembers } from '@/components/community/GroupMembers';
import { GroupJoinRequests } from '@/components/community/GroupJoinRequests';

type Tab = 'posts' | 'chat' | 'members' | 'requests';

export default function GroupDetailPage() {
  const params = useParams<{ id: string }>();
  const groupId = params?.id;

  const { user } = useAuthStore();
  const { data: group } = useGroup(groupId);
  const { data: postsRaw = [], isError: postsError } = useGroupPosts(groupId);

  const joinGroup = useJoinGroup();
  const leaveGroup = useLeaveGroup();
  const deletePost = useDeleteGroupPost();
  const [tab, setTab] = useState<Tab>('posts');

  // The requests tab shows how many are waiting, so an admin sees it at once.
  const canModerateGroup = group?.role === 'admin' || group?.role === 'moderator';
  const joinRequests = useQuery({
    queryKey: ['group-join-requests', groupId],
    queryFn: () => groupsApi.listJoinRequests(groupId!),
    enabled: Boolean(groupId && canModerateGroup && group?.privacy === 'private'),
    select: (response) => (Array.isArray(response.data?.data) ? response.data.data : []),
  });

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

          <div className="flex items-center gap-2">
            {group.isMember ? (
              <button className="btn-outline" onClick={() => leaveGroup.mutate(group.id)} disabled={leaveGroup.isPending}>
                Leave
              </button>
            ) : (
              <button className="btn-primary" onClick={() => joinGroup.mutate(group.id)} disabled={joinGroup.isPending}>
                Join
              </button>
            )}
          </div>
        </div>

        {canPost && <GroupComposer groupId={group.id} groupName={group.name} />}

        {!user && <div className="mt-6 text-sm text-slate-500">Log in to join and post.</div>}
      </div>

      {group.isMember && (
        <div className="flex gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1 dark:bg-slate-800" role="tablist" aria-label="Group sections">
          {(
            [
              ['posts', 'Posts'],
              ['chat', 'Chat'],
              ['members', 'Members'],
              ...(canModerateGroup && group.privacy === 'private' ? ([['requests', 'Requests']] as Array<[Tab, string]>) : []),
            ] as Array<[Tab, string]>
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium',
                tab === value ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'
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

      {group.isMember && tab === 'chat' && <GroupChat groupId={group.id} canModerate={canModerateGroup} />}
      {group.isMember && tab === 'members' && <GroupMembers groupId={group.id} viewerRole={group.role} />}
      {group.isMember && tab === 'requests' && canModerateGroup && <GroupJoinRequests groupId={group.id} />}

      <div className={cn('space-y-4', group.isMember && tab !== 'posts' && 'hidden')}>
        {membersOnly || postsError ? (
          <div className="card flex items-start gap-3 p-5 text-sm text-slate-500 dark:text-slate-400">
            <Lock className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
            <span>This is a private group. Join to read and take part in its posts.</span>
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
