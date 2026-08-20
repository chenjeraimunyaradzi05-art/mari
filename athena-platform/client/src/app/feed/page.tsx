'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
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
  Clock,
  WifiOff,
} from 'lucide-react';
import { useFeed, useCreatePost, useLikePost, useUnlikePost, useAuth } from '@/lib/hooks';
import { formatDistanceToNow } from 'date-fns';
import {
  FALLBACK_POSTS,
  isFallbackPostId,
  type PublicFallbackFeedPost,
} from '@/lib/public-fallbacks';
import { arePublicFallbacksEnabled } from '@/lib/runtime-config';

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
    profileHref?: string;
  };
  _count?: {
    likes: number;
    comments: number;
  };
  likes?: { userId: string }[];
  media?: { url: string; type: string }[];
}

function getInitials(firstName?: string, lastName?: string) {
  const safeFirst = firstName?.trim().charAt(0) || 'A';
  const safeLast = lastName?.trim().charAt(0) || '';
  return `${safeFirst}${safeLast}`;
}

function PostCard({ post, currentUserId }: { post: Post; currentUserId?: string }) {
  const likePost = useLikePost();
  const unlikePost = useUnlikePost();
  const isFallbackPost = isFallbackPostId(post.id);
  const [isLiked, setIsLiked] = useState(
    post.likes?.some(like => like.userId === currentUserId) || false
  );
  const [likeCount, setLikeCount] = useState(post._count?.likes || 0);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const handleLike = async () => {
    if (isFallbackPost) {
      return;
    }

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

  const authorContent = (
    <>
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
          getInitials(post.author.firstName, post.author.lastName)
        )}
      </div>
      <div>
        <div className="font-semibold text-slate-900 dark:text-white hover:text-primary-600 transition">
          {post.author.firstName} {post.author.lastName}
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          {post.author.headline || 'ATHENA Member'}
        </div>
        <div className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span suppressHydrationWarning>
            {isHydrated
              ? formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })
              : post.createdAt.slice(0, 10)}
          </span>
        </div>
      </div>
    </>
  );

  return (
    <article className="card-lift glass-card rounded-xl p-5">
      {/* Author */}
      <div className="flex items-start justify-between mb-4">
        {post.author.profileHref ? (
          <Link href={post.author.profileHref} className="flex items-center gap-3">
            {authorContent}
          </Link>
        ) : (
          <div className="flex items-center gap-3">{authorContent}</div>
        )}
        <button className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-700">
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </div>

      {/* Content */}
      <div className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap mb-4">
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
      <div className="flex items-center justify-between border-b border-t border-slate-100 py-2 text-sm text-slate-500 dark:border-slate-700/50 dark:text-slate-400">
        <span>{likeCount} likes</span>
        <span>{post._count?.comments || 0} comments</span>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-3">
        <button 
          onClick={handleLike}
          disabled={isFallbackPost}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
            isLiked 
              ? 'text-red-500 bg-red-50 dark:bg-red-900/20' 
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
          } ${isFallbackPost ? 'cursor-not-allowed opacity-70' : ''}`}
        >
          <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
          Like
        </button>
        {isFallbackPost ? (
          <button
            disabled
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-slate-600 dark:text-slate-400 opacity-70 cursor-not-allowed"
          >
            <MessageSquare className="w-5 h-5" />
            Comment
          </button>
        ) : (
          <Link 
            href={`/dashboard/community/post/${post.id}`}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            <MessageSquare className="w-5 h-5" />
            Comment
          </Link>
        )}
        <button disabled={isFallbackPost} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition ${isFallbackPost ? 'cursor-not-allowed opacity-70' : ''}`}>
          <Share2 className="w-5 h-5" />
          Share
        </button>
        <button disabled={isFallbackPost} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition ${isFallbackPost ? 'cursor-not-allowed opacity-70' : ''}`}>
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
    <div className="glass-card rounded-xl p-5">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-pink-500 flex items-center justify-center text-white font-semibold flex-shrink-0">
          {getInitials(user?.firstName, user?.lastName)}
        </div>
        <div className="flex-1">
          {isExpanded ? (
            <form onSubmit={handleSubmit}>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Share a win, ask a question, or post a helpful resource..."
                className="w-full resize-none rounded-xl border border-slate-200/80 bg-white/70 p-3 text-slate-800 backdrop-blur focus:border-transparent focus:ring-2 focus:ring-primary-500 dark:border-white/10 dark:bg-slate-800/60 dark:text-white"
                rows={4}
                autoFocus
              />
              <div className="flex justify-end gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => setIsExpanded(false)}
                  className="rounded-lg px-4 py-2 text-slate-600 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!content.trim() || createPost.isPending}
                  className="rounded-lg bg-[linear-gradient(135deg,#f43f5e,#a855f7)] px-5 py-2 text-sm font-semibold text-white shadow-blossom transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {createPost.isPending ? 'Posting...' : 'Post'}
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setIsExpanded(true)}
              className="w-full rounded-full border border-slate-200/60 bg-slate-50/70 p-3 text-left text-slate-500 backdrop-blur transition hover:bg-slate-100/80 dark:border-white/10 dark:bg-slate-700/50 dark:text-slate-400 dark:hover:bg-slate-700"
            >
              What&apos;s on your mind?
            </button>
          )}
        </div>
      </div>
      {!isExpanded && (
        <div className="flex items-center justify-around mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition">
            <Play className="w-5 h-5 text-red-500" />
            Video
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition">
            <MessageCircle className="w-5 h-5 text-green-500" />
            Question
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition">
            <TrendingUp className="w-5 h-5 text-blue-500" />
            Win
          </button>
        </div>
      )}
    </div>
  );
}

export default function FeedPage() {
  const searchParams = useSearchParams();
  const [filter, setFilter] = useState<'latest' | 'trending' | 'following'>('latest');
  const { data: posts, isLoading, error } = useFeed({ sort: filter });
  const { user, isAuthenticated } = useAuth();
  const fallbackFromApi = Boolean(
    posts?.some((post: PublicFallbackFeedPost) => isFallbackPostId(post.id))
  );
  const isFallbackFeed =
    arePublicFallbacksEnabled() &&
    (searchParams.get('demoFallback') === '1' || fallbackFromApi || Boolean(error));
  const renderedPosts = isFallbackFeed ? FALLBACK_POSTS : posts;
  const feedUnavailable = !isFallbackFeed && Boolean(error);

  return (
    <div className="min-h-screen bg-aurora">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Feed */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-primary-600">
                  <Sparkles className="h-5 w-5" />
                  <span className="text-sm font-semibold uppercase tracking-wider">Social</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-500" />
                    </span>
                    Live
                  </span>
                </div>
                <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">Your Feed</h1>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFilter('latest')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    filter === 'latest'
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  Latest
                </button>
                <button
                  onClick={() => setFilter('trending')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    filter === 'trending'
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  Trending
                </button>
                <button
                  onClick={() => setFilter('following')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    filter === 'following'
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  Following
                </button>
              </div>
            </div>

            {/* Create Post */}
            {isAuthenticated && <CreatePostBox />}

            {isFallbackFeed && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-5 text-amber-950 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
                <div className="flex items-start gap-3">
                  <WifiOff className="mt-0.5 h-5 w-5 flex-shrink-0" />
                  <div>
                    <div className="font-semibold">Live community posts are reconnecting</div>
                    <p className="mt-1 text-sm leading-6 opacity-90">
                      Showing a curated launch feed so the public community page
                      still has context, navigation, and momentum.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {feedUnavailable && (
              <div className="rounded-2xl border border-red-200 bg-red-50/90 p-5 text-red-950 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-100">
                <div className="flex items-start gap-3">
                  <WifiOff className="mt-0.5 h-5 w-5 flex-shrink-0" />
                  <div>
                    <div className="font-semibold">Live community posts are unavailable</div>
                    <p className="mt-1 text-sm leading-6 opacity-90">
                      We could not load the live feed right now. Please try again shortly.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Posts */}
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="shimmer rounded-xl border border-white/20 bg-white/60 p-5 dark:border-white/10 dark:bg-slate-800/60">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-slate-200 dark:bg-slate-700" />
                      <div className="space-y-2">
                        <div className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-700" />
                        <div className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-700" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="h-4 w-full rounded bg-slate-200 dark:bg-slate-700" />
                      <div className="h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-700" />
                    </div>
                  </div>
                ))}
              </div>
            ) : renderedPosts && renderedPosts.length > 0 ? (
              <div className="space-y-4">
                {renderedPosts.map((post: Post) => (
                  <PostCard key={post.id} post={post} currentUserId={user?.id} />
                ))}
              </div>
            ) : (
              <div className="glass-card rounded-xl p-8 text-center">
                <Sparkles className="mx-auto mb-4 h-12 w-12 text-primary-400" />
                <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">Your feed is empty</h3>
                <p className="mb-4 text-slate-600 dark:text-slate-400">
                  {feedUnavailable
                    ? 'The live feed could not be loaded right now.'
                    : 'Start following people and join communities to see posts here.'}
                </p>
                <div className="flex justify-center gap-3">
                  <Link
                    href="/community"
                    className="rounded-lg bg-[linear-gradient(135deg,#f43f5e,#a855f7)] px-4 py-2 text-sm font-semibold text-white shadow-blossom transition hover:-translate-y-0.5"
                  >
                    Explore Communities
                  </Link>
                  <Link
                    href="/mentors"
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
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
            <div className="card-lift glass-card rounded-xl p-5">
              <h3 className="mb-4 font-semibold text-slate-900 dark:text-white">Quick Actions</h3>
              <div className="space-y-2">
                <Link 
                  href="/dashboard/community" 
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                >
                  <Users className="w-5 h-5 text-primary-600" />
                  <span className="text-slate-700 dark:text-slate-300">Community Feed</span>
                </Link>
                <Link 
                  href="/dashboard/create-post" 
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                >
                  <Plus className="w-5 h-5 text-green-600" />
                  <span className="text-slate-700 dark:text-slate-300">Create Post</span>
                </Link>
                <Link 
                  href="/explore" 
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                >
                  <Play className="w-5 h-5 text-red-600" />
                  <span className="text-slate-700 dark:text-slate-300">Explore Videos</span>
                </Link>
              </div>
            </div>

            {/* Trending Topics */}
            <div className="card-lift glass-card rounded-xl p-5">
              <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                <TrendingUp className="h-5 w-5 text-primary-500" />
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
            <div className="card-lift glass-card rounded-xl p-5">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-4">People to Follow</h3>
              <div className="space-y-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">
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
  );
}
