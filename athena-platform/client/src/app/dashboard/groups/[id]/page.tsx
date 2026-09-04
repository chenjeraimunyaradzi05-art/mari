'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { Trash2, Users } from 'lucide-react';
import {
  useAuthStore,
  useCreateGroupPost,
  useDeleteGroupPost,
  useGroup,
  useGroupPosts,
  useJoinGroup,
  useLeaveGroup,
} from '@/lib/hooks';
import { Avatar } from '@/components/ui/avatar';
import { renderSocialText } from '@/lib/social-text';

type GroupPost = {
  id: string;
  groupId: string;
  authorId: string;
  content: string;
  createdAt: string;
  author?: {
    id: string;
    displayName?: string | null;
    avatar?: string | null;
    headline?: string | null;
  } | null;
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
  const deletePost = useDeleteGroupPost();

  const posts: GroupPost[] = useMemo(() => (Array.isArray(postsRaw) ? postsRaw : []), [postsRaw]);
  const [content, setContent] = useState('');
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  if (!group) {
    return (
      <div className="max-w-3xl mx-auto p-6 text-slate-500">Loading…</div>
    );
  }

  const canPost = !!user && group.isMember;
  // The server lets the author, or a group admin or moderator, remove a post.
  const canModerate = group.role === 'admin' || group.role === 'moderator';

  const removePost = (post: GroupPost) => {
    if (!window.confirm('Remove this post from the group?')) return;
    deletePost.mutate({ groupId: group.id, postId: post.id });
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
            <div className="font-medium text-slate-900 dark:text-white mb-2">Post to group</div>
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
          <div className="mt-6 text-sm text-slate-500">Log in to join and post.</div>
        )}
      </div>

      <div className="space-y-3">
        {posts.length === 0 ? (
          <div className="text-slate-500">No posts yet.</div>
        ) : (
          posts.map((p) => {
            const authorId = p.author?.id ?? p.authorId;
            const authorName = p.author?.displayName?.trim() || 'Member';
            const canRemove = !!user && (user.id === authorId || canModerate);

            return (
              <article key={p.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/profile/${authorId}`} className="flex items-center gap-3 min-w-0">
                    <Avatar
                      src={p.author?.avatar ?? undefined}
                      alt={authorName}
                      fallback={authorName.slice(0, 2).toUpperCase()}
                      size="sm"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-900 hover:underline dark:text-white">
                        {authorName}
                      </span>
                      {p.author?.headline && (
                        <span className="block truncate text-xs text-slate-500">{p.author.headline}</span>
                      )}
                    </span>
                  </Link>
                  {canRemove && (
                    <button
                      type="button"
                      onClick={() => removePost(p)}
                      disabled={deletePost.isPending}
                      className="p-1 text-slate-400 hover:text-red-600"
                      aria-label="Remove post"
                      title="Remove post"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="mt-3 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
                  {renderSocialText(p.content)}
                </div>
                <div className="mt-2 text-xs text-slate-500" suppressHydrationWarning>
                  {isHydrated
                    ? formatDistanceToNow(new Date(p.createdAt), { addSuffix: true })
                    : p.createdAt.slice(0, 10)}
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
