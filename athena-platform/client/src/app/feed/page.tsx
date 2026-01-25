'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  ArrowRight, Sparkles, Users, MessageCircle, Play, Heart, 
  MessageSquare, Share2, Bookmark, MoreHorizontal,
  Briefcase, Award, RefreshCw
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { postApi } from '@/lib/api';

interface Post {
  id: string;
  content: string;
  type: 'text' | 'image' | 'video' | 'article' | 'job' | 'achievement';
  author: {
    id: string;
    firstName: string;
    lastName: string;
    headline?: string;
    avatar?: string;
  };
  likes: number;
  comments: number;
  shares: number;
  isLiked?: boolean;
  isSaved?: boolean;
  createdAt: string;
  media?: string[];
  tags?: string[];
}

interface FeedItem {
  type: 'post' | 'job' | 'course' | 'mentor' | 'achievement';
  data: Post;
}

export default function FeedPage() {
  const { user, isLoading: authLoading } = useAuthStore();
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const fetchFeed = useCallback(async () => {
    try {
      setLoading(true);
      
      const response = await postApi.getFeed({ page, limit: 20 });
      
      if (response.data?.success) {
        const posts = response.data.data?.posts || response.data.data || [];
        const items: FeedItem[] = posts.map((post: Post) => ({
          type: 'post' as const,
          data: post,
        }));
        setFeedItems(items);
      } else {
        setFeedItems(getSampleFeedItems());
      }
    } catch (err) {
      console.error('Failed to fetch feed:', err);
      setFeedItems(getSampleFeedItems());
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  const handleLike = async (postId: string) => {
    try {
      await postApi.like(postId);
      setFeedItems(items =>
        items.map(item => {
          if (item.type === 'post' && item.data.id === postId) {
            return {
              ...item,
              data: {
                ...item.data,
                isLiked: !item.data.isLiked,
                likes: item.data.isLiked ? item.data.likes - 1 : item.data.likes + 1,
              },
            };
          }
          return item;
        })
      );
    } catch (err) {
      console.error('Failed to like post:', err);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (authLoading || loading) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-12">
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto max-w-3xl px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 text-primary-600">
              <Sparkles className="h-5 w-5" />
              <span className="text-sm font-semibold uppercase tracking-wider">Your Feed</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
              Welcome back{user?.firstName ? `, ${user.firstName}` : ''}!
            </h1>
          </div>
          <button
            onClick={fetchFeed}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            <RefreshCw className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Create Post Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-pink-500 flex items-center justify-center text-white font-semibold">
              {user?.firstName?.[0] || 'U'}
            </div>
            <Link
              href="/dashboard/create-post"
              className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition text-sm"
            >
              Share an update, win, or question...
            </Link>
          </div>
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
            <Link href="/dashboard/create-post?type=image" className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-gray-600 dark:text-gray-400">
              <Play className="w-4 h-4 text-red-500" /> Video
            </Link>
            <Link href="/dashboard/create-post?type=article" className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-gray-600 dark:text-gray-400">
              <MessageCircle className="w-4 h-4 text-blue-500" /> Article
            </Link>
            <Link href="/dashboard/create-post?type=achievement" className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-gray-600 dark:text-gray-400">
              <Award className="w-4 h-4 text-yellow-500" /> Achievement
            </Link>
          </div>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Link
            href="/dashboard/community"
            className="flex flex-col items-center gap-2 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition"
          >
            <Users className="w-6 h-6 text-primary-600" />
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Community</span>
          </Link>
          <Link
            href="/explore"
            className="flex flex-col items-center gap-2 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition"
          >
            <Play className="w-6 h-6 text-red-500" />
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Videos</span>
          </Link>
          <Link
            href="/jobs"
            className="flex flex-col items-center gap-2 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition"
          >
            <Briefcase className="w-6 h-6 text-green-500" />
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Jobs</span>
          </Link>
        </div>

        {/* Feed Items */}
        <div className="space-y-4">
          {feedItems.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 text-center border border-gray-200 dark:border-gray-700">
              <Sparkles className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Your feed is empty
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Follow more people and topics to see updates here.
              </p>
              <Link href="/discover" className="btn-primary inline-flex items-center gap-2">
                Discover People <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            feedItems.map((item, index) => (
              <PostCard
                key={item.data.id || index}
                post={item.data}
                onLike={() => handleLike(item.data.id)}
                formatTimeAgo={formatTimeAgo}
              />
            ))
          )}
        </div>

        {/* Load More */}
        {feedItems.length > 0 && (
          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setPage(p => p + 1);
                fetchFeed();
              }}
              className="px-6 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750 transition"
            >
              Load more
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PostCard({ 
  post, 
  onLike, 
  formatTimeAgo 
}: { 
  post: Post; 
  onLike: () => void; 
  formatTimeAgo: (date: string) => string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="p-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-pink-500 flex items-center justify-center text-white font-semibold">
            {post.author?.avatar ? (
              <Image
                src={post.author.avatar}
                alt={`${post.author.firstName} ${post.author.lastName}`}
                width={48}
                height={48}
                className="rounded-full"
              />
            ) : (
              post.author?.firstName?.[0] || 'U'
            )}
          </div>
          <div>
            <Link
              href={`/profile/${post.author?.id}`}
              className="font-semibold text-gray-900 dark:text-white hover:underline"
            >
              {post.author?.firstName} {post.author?.lastName}
            </Link>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {post.author?.headline || 'ATHENA Member'}
            </p>
            <p className="text-xs text-gray-400">
              {formatTimeAgo(post.createdAt)}
            </p>
          </div>
        </div>
        <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition">
          <MoreHorizontal className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Content */}
      <div className="px-4 pb-3">
        <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{post.content}</p>
        
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {post.tags.map(tag => (
              <span
                key={tag}
                className="px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 text-xs rounded-full"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Media */}
      {post.media && post.media.length > 0 && (
        <div className="relative">
          <Image
            src={post.media[0]}
            alt="Post media"
            width={600}
            height={400}
            className="w-full object-cover"
          />
        </div>
      )}

      {/* Stats */}
      <div className="px-4 py-2 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700">
        <span>{post.likes} likes</span>
        <div className="flex items-center gap-4">
          <span>{post.comments} comments</span>
          <span>{post.shares} shares</span>
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 py-2 flex items-center justify-around border-t border-gray-100 dark:border-gray-700">
        <button
          onClick={onLike}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
            post.isLiked
              ? 'text-red-500 bg-red-50 dark:bg-red-900/20'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          <Heart className={`w-5 h-5 ${post.isLiked ? 'fill-current' : ''}`} />
          <span className="text-sm font-medium">Like</span>
        </button>
        <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
          <MessageSquare className="w-5 h-5" />
          <span className="text-sm font-medium">Comment</span>
        </button>
        <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
          <Share2 className="w-5 h-5" />
          <span className="text-sm font-medium">Share</span>
        </button>
        <button
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
            post.isSaved
              ? 'text-primary-600 bg-primary-50 dark:bg-primary-900/20'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          <Bookmark className={`w-5 h-5 ${post.isSaved ? 'fill-current' : ''}`} />
          <span className="text-sm font-medium">Save</span>
        </button>
      </div>
    </div>
  );
}

function getSampleFeedItems(): FeedItem[] {
  return [
    {
      type: 'post',
      data: {
        id: '1',
        content: "🎉 Just landed my dream job at a top tech company! After months of preparation, countless interviews, and a lot of self-doubt, I finally made it. Thank you to everyone who supported me along the way. If you're still on your job search journey, don't give up - your opportunity is coming!",
        type: 'achievement',
        author: {
          id: 'user1',
          firstName: 'Sarah',
          lastName: 'Chen',
          headline: 'Software Engineer at TechCorp',
        },
        likes: 234,
        comments: 45,
        shares: 12,
        isLiked: false,
        isSaved: false,
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        tags: ['career', 'newjob', 'success'],
      },
    },
    {
      type: 'post',
      data: {
        id: '2',
        content: "Hot take: The best career advice I ever received wasn't about networking or resume tips. It was simply: \"Be so good they can't ignore you.\" Focus on building real skills and creating value. Everything else follows.",
        type: 'text',
        author: {
          id: 'user2',
          firstName: 'Michael',
          lastName: 'Rodriguez',
          headline: 'Career Coach | Helping professionals level up',
        },
        likes: 512,
        comments: 89,
        shares: 67,
        isLiked: true,
        isSaved: false,
        createdAt: new Date(Date.now() - 7200000).toISOString(),
        tags: ['careeradvice', 'growth'],
      },
    },
    {
      type: 'post',
      data: {
        id: '3',
        content: "Just finished my certification in AI/ML! 🤖 The future of work is here, and I'm ready for it. If anyone's thinking about upskilling in AI, happy to share resources that helped me. The journey was challenging but absolutely worth it.",
        type: 'achievement',
        author: {
          id: 'user3',
          firstName: 'Priya',
          lastName: 'Sharma',
          headline: 'Data Scientist | AI Enthusiast',
        },
        likes: 178,
        comments: 32,
        shares: 8,
        isLiked: false,
        isSaved: true,
        createdAt: new Date(Date.now() - 14400000).toISOString(),
        tags: ['AI', 'certification', 'learning'],
      },
    },
  ];
}
