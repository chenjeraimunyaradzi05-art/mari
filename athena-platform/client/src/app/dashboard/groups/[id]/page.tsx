'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { Users } from 'lucide-react';
import { useAuthStore, useCreateGroupPost, useGroup, useGroupPosts, useJoinGroup, useLeaveGroup } from '@/lib/hooks';

type GroupPost = {
  id: string;
  groupId: string;
  authorId: string;
  content: string;
  createdAt: string;
};

export default function GroupDetailPage() {
  const params = useParams<{ id: string }>();
  const groupId = params?.id;

  const { user } = useAuthStore();
  const { data: group } = useGroup(groupId);
  const { data: postsRaw = [] } = useGroupPosts(groupId);

  const joinGroup = useJoinGroup();
  const leaveGroup = useLeaveGroup();
  const createPost = useCreateGroupPost();

  const posts: GroupPost[] = useMemo(() => (Array.isArray(postsRaw) ? postsRaw : []), [postsRaw]);
  const [content, setContent] = useState('');

  if (!group) {
    return (
      <div className="max-w-3xl mx-auto p-6 text-gray-500">Loading…</div>
    );
  }

  const canPost = !!user && group.isMember;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{group.name}</h1>
            <p className="text-gray-600 dark:text-gray-300 mt-2">{group.description}</p>
            <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
              <Users className="w-4 h-4" />
              <span>{group.memberCount} members</span>
              <span className="text-xs px-2 py-1 rounded-full border border-gray-200 text-gray-600 dark:text-gray-300">
                {group.privacy}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {group.isMember ? (
              <button
                className="btn-outline"
                onClick={() => leaveGroup.mutate(group.id)}
                disabled={leaveGroup.isPending}
              >
                Leave
              </button>
            ) : (
              <button
                className="btn-primary"
                onClick={() => joinGroup.mutate(group.id)}
                disabled={joinGroup.isPending}
              >
                Join
              </button>
            )}
          </div>
        </div>

        {canPost && (
          <div className="mt-6">
            <div className="font-medium text-gray-900 dark:text-white mb-2">Post to group</div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Share something with the group…"
              className="w-full input h-24"
            />
            <div className="mt-2 flex items-center gap-2">
              <button
                className="btn-primary"
                disabled={createPost.isPending || !content.trim()}
                onClick={() => {
                  createPost.mutate(
                    { groupId: group.id, content },
                    {
                      onSuccess: () => setContent(''),
                    }
                  );
                }}
              >
                {createPost.isPending ? 'Posting…' : 'Post'}
              </button>
            </div>
          </div>
        )}

        {!user && (
          <div className="mt-6 text-sm text-gray-500">Log in to join and post.</div>
        )}
      </div>

      <div className="space-y-3">
        {posts.length === 0 ? (
          <div className="text-gray-500">No posts yet.</div>
        ) : (
          posts.map((p) => (
            <div key={p.id} className="card p-4">
              <div className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">
                {p.content}
              </div>
              <div className="mt-2 text-xs text-gray-500">
                {formatDistanceToNow(new Date(p.createdAt), { addSuffix: true })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
