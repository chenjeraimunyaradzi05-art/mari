'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  ArrowRight, 
  Sparkles, 
  Users, 
  MessageCircle, 
  Play,
  Heart,
  MessageSquare,
  Share2,
  Bookmark,
  MoreHorizontal,
  Plus,
  TrendingUp,
  Clock
} from 'lucide-react';
import { useFeed, useCreatePost, useLikePost, useUnlikePost, useAuth } from '@/lib/hooks';
import { formatDistanceToNow } from 'date-fns';

interface Post {
  id: string;
  content: string;
  createdAt: string;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    profileImage?: string;
    headline?: string;
  };
  _count?: {
    likes: number;
    comments: number;
  };
  likes?: { userId: string }[];
  media?: { url: string; type: string }[];
}

function PostCard({ post, currentUserId }: { post: Post; currentUserId?: string }) {
  const likePost = useLikePost();
  const unlikePost = useUnlikePost();
  const [isLiked, setIsLiked] = useState(
    post.likes?.some(like => like.userId === currentUserId) || false
  );
  const [likeCount, setLikeCount] = useState(post._count?.likes || 0);

  const handleLike = async () => {
    if (isLiked) {
      setIsLiked(false);
      setLikeCount(prev => prev - 1);
      unlikePost.mutate(post.id);
    } else {
      setIsLiked(true);
      setLikeCount(prev => prev + 1);
      likePost.mutate(post.id);
    }
  };

  return (
    <article className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition">
      {/* Author */}
      <div className="flex items-start justify-between mb-4">
        <Link href={`/profile/${post.author.id}`} className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-pink-500 flex items-center justify-center text-white font-semibold overflow-hidden">
            {post.author.profileImage ? (
              <Image 
                src={post.author.profileImage} 
                alt={post.author.firstName}
                width={48}
                height={48}
                className="object-cover"
              />
            ) : (
              `${post.author.firstName[0]}${post.author.lastName[0]}`
            )}
          </div>
          <div>
            <div className="font-semibold text-gray-900 dark:text-white hover:text-primary-600 transition">
              {post.author.firstName} {post.author.lastName}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {post.author.headline || 'ATHENA Member'}
            </div>
            <div className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
            </div>
          </div>
        </Link>
        <button className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition">
          <MoreHorizontal className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Content */}
      <div className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap mb-4">
        {post.content}
      </div>

      {/* Media */}
      {post.media && post.media.length > 0 && (
        <div className="mb-4 rounded-lg overflow-hidden">
          {post.media.map((m, idx) => (
            m.type === 'image' ? (
              <Image 
                key={idx}
                src={m.url} 
                alt="Post media"
                width={600}
                height={400}
                className="w-full object-cover"
              />
            ) : m.type === 'video' ? (
              <video key={idx} src={m.url} controls className="w-full" />
            ) : null
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 py-2 border-t border-b border-gray-100 dark:border-gray-700">
        <span>{likeCount} likes</span>
        <span>{post._count?.comments || 0} comments</span>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-3">
        <button 
          onClick={handleLike}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
            isLiked 
              ? 'text-red-500 bg-red-50 dark:bg-red-900/20' 
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
          Like
        </button>
        <Link 
          href={`/dashboard/community/post/${post.id}`}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
        >
          <MessageSquare className="w-5 h-5" />
          Comment
        </Link>
        <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
          <Share2 className="w-5 h-5" />
          Share
        </button>
        <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
          <Bookmark className="w-5 h-5" />
          Save
        </button>
      </div>
    </article>
  );
}

function CreatePostBox() {
  const [content, setContent] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const createPost = useCreatePost();
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    
    await createPost.mutateAsync({ content, visibility: 'public' });
    setContent('');
    setIsExpanded(false);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-pink-500 flex items-center justify-center text-white font-semibold flex-shrink-0">
          {user?.firstName?.[0]}{user?.lastName?.[0]}
        </div>
        <div className="flex-1">
          {isExpanded ? (
            <form onSubmit={handleSubmit}>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Share a win, ask a question, or post a helpful resource..."
                className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-lg resize-none focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                rows={4}
                autoFocus
              />
              <div className="flex justify-end gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => setIsExpanded(false)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!content.trim() || createPost.isPending}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
                >
                  {createPost.isPending ? 'Posting...' : 'Post'}
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setIsExpanded(true)}
              className="w-full text-left p-3 bg-gray-50 dark:bg-gray-700 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 transition"
            >
              What&apos;s on your mind?
            </button>
          )}
        </div>
      </div>
      {!isExpanded && (
        <div className="flex items-center justify-around mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
            <Play className="w-5 h-5 text-red-500" />
            Video
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
            <MessageCircle className="w-5 h-5 text-green-500" />
            Question
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
            <TrendingUp className="w-5 h-5 text-blue-500" />
            Win
          </button>
        </div>
      )}
    </div>
  );
}

export default function FeedPage() {
  const [filter, setFilter] = useState<'latest' | 'trending' | 'following'>('latest');
  const { data: posts, isLoading, error } = useFeed({ sort: filter });
  const { user, isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Feed */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-primary-600">
                  <Sparkles className="h-5 w-5" />
                  <span className="text-sm font-semibold uppercase tracking-wider">Social</span>
                </div>
                <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">Your Feed</h1>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFilter('latest')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    filter === 'latest'
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  Latest
                </button>
                <button
                  onClick={() => setFilter('trending')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    filter === 'trending'
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  Trending
                </button>
                <button
                  onClick={() => setFilter('following')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    filter === 'following'
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  Following
                </button>
              </div>
            </div>

            {/* Create Post */}
            {isAuthenticated && <CreatePostBox />}

            {/* Posts */}
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 animate-pulse">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700" />
                      <div className="space-y-2">
                        <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
                        <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded" />
                      <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
                <p className="text-gray-600 dark:text-gray-400 mb-4">Unable to load feed. Please try again.</p>
                <button 
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
                >
                  Retry
                </button>
              </div>
            ) : posts && posts.length > 0 ? (
              <div className="space-y-4">
                {posts.map((post: Post) => (
                  <PostCard key={post.id} post={post} currentUserId={user?.id} />
                ))}
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
                <Sparkles className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Your feed is empty</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Start following people and join communities to see posts here.
                </p>
                <div className="flex justify-center gap-3">
                  <Link 
                    href="/community" 
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
                  >
                    Explore Communities
                  </Link>
                  <Link 
                    href="/mentors" 
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                  >
                    Find Mentors
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <Link 
                  href="/dashboard/community" 
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
                  <Users className="w-5 h-5 text-primary-600" />
                  <span className="text-gray-700 dark:text-gray-300">Community Feed</span>
                </Link>
                <Link 
                  href="/dashboard/create-post" 
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
                  <Plus className="w-5 h-5 text-green-600" />
                  <span className="text-gray-700 dark:text-gray-300">Create Post</span>
                </Link>
                <Link 
                  href="/explore" 
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
                  <Play className="w-5 h-5 text-red-600" />
                  <span className="text-gray-700 dark:text-gray-300">Explore Videos</span>
                </Link>
              </div>
            </div>

            {/* Trending Topics */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary-600" />
                Trending Topics
              </h3>
              <div className="space-y-3">
                {['#CareerGrowth', '#TechJobs', '#RemoteWork', '#AISkills', '#Mentorship'].map((topic) => (
                  <Link 
                    key={topic}
                    href={`/search?q=${encodeURIComponent(topic)}`}
                    className="block text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 transition"
                  >
                    {topic}
                  </Link>
                ))}
              </div>
            </div>

            {/* Suggested Connections */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">People to Follow</h3>
              <div className="space-y-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Connect with mentors and peers to grow your network.
                </p>
                <Link 
                  href="/mentors"
                  className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 transition"
                >
                  Browse Mentors <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
