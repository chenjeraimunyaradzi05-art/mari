'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ChevronLeft, 
  ChevronRight, 
  MessageSquare,
  Eye,
  EyeOff,
  Trash2,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

interface Post {
  id: string;
  content: string;
  type: string;
  mediaUrls: string[] | null;
  likeCount: number;
  commentCount: number;
  reportCount: number;
  isHidden: boolean;
  createdAt: string;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    avatar: string | null;
  };
}

interface PostsResponse {
  posts: Post[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function AdminContentPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [showReported, setShowReported] = useState(false);

  const { data, isLoading } = useQuery<PostsResponse>({
    queryKey: ['admin-content-posts', page, showReported],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        reported: showReported.toString(),
        sortBy: showReported ? 'reportCount' : 'createdAt',
        sortOrder: 'desc',
      });
      const response = await api.get(`/admin/content/posts?${params.toString()}`);
      return response.data;
    },
  });

  const moderateMutation = useMutation({
    mutationFn: async ({ postId, action, reason }: { postId: string; action: string; reason?: string }) => {
      await api.patch(`/admin/content/posts/${postId}`, { action, reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-content-posts'] });
    },
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-gray-500 hover:text-gray-700">
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Content Moderation</h1>
              <p className="text-gray-600 dark:text-gray-400">Review and moderate user posts</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="flex gap-4 mb-6">
          <Button
            variant={!showReported ? 'default' : 'outline'}
            onClick={() => {
              setShowReported(false);
              setPage(1);
            }}
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            All Posts
          </Button>
          <Button
            variant={showReported ? 'default' : 'outline'}
            onClick={() => {
              setShowReported(true);
              setPage(1);
            }}
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            Reported Posts
          </Button>
        </div>

        {/* Posts Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {data?.posts.map((post) => (
              <div
                key={post.id}
                className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 ${
                  post.isHidden ? 'opacity-60 border-2 border-red-300' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    {/* Author */}
                    <div className="flex-shrink-0">
                      {post.author.avatar ? (
                        <img
                          src={post.author.avatar}
                          alt={`${post.author.firstName} ${post.author.lastName}`}
                          className="h-10 w-10 rounded-full"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                          <span className="text-purple-600 font-medium">
                            {post.author.firstName[0]}{post.author.lastName[0]}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Link
                          href={`/dashboard/profile/${post.author.id}`}
                          className="font-medium text-gray-900 dark:text-white hover:underline"
                        >
                          {post.author.firstName} {post.author.lastName}
                        </Link>
                        <span className="text-gray-500 text-sm">
                          {new Date(post.createdAt).toLocaleDateString()}
                        </span>
                        {post.isHidden && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                            Hidden
                          </span>
                        )}
                      </div>
                      <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                        {post.content.length > 300 ? `${post.content.slice(0, 300)}...` : post.content}
                      </p>

                      {/* Stats */}
                      <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                        <span>❤️ {post.likeCount}</span>
                        <span>💬 {post.commentCount}</span>
                        {post.reportCount > 0 && (
                          <span className="text-red-600 font-medium">
                            ⚠️ {post.reportCount} reports
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {post.isHidden ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => moderateMutation.mutate({ postId: post.id, action: 'unhide' })}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Unhide
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => moderateMutation.mutate({ postId: post.id, action: 'hide' })}
                      >
                        <EyeOff className="h-4 w-4 mr-1" />
                        Hide
                      </Button>
                    )}
                    {post.reportCount > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => moderateMutation.mutate({ postId: post.id, action: 'clearReports' })}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Clear Reports
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 border-red-300 hover:bg-red-50"
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this post?')) {
                          moderateMutation.mutate({ postId: post.id, action: 'delete' });
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            {data?.posts.length === 0 && (
              <div className="text-center py-12">
                <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">
                  {showReported ? 'No reported posts found' : 'No posts found'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Pagination */}
        {data && data.pagination.totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Page {page} of {data.pagination.totalPages}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page === data.pagination.totalPages}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
