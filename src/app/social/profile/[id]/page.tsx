'use client';

import React, { useEffect, useState } from 'react';
import { ArrowLeft, Grid, Play, Users } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface ProfileData {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    profileImage?: string;
    bio?: string;
    followersCount: number;
    followingCount: number;
    isFollowing: boolean;
    _count: {
      posts: number;
    };
  };
  posts: {
    id: string;
    thumbnailUrl: string;
    likesCount: number;
  }[];
}

export default function ProfilePage() {
  const params = useParams();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch(`/api/social/profile/${params.id}`);
        if (res.ok) {
          const json = await res.json();
          setData(json);
          setFollowing(json.user.isFollowing);
        }
      } catch (error) {
        console.error('Failed to fetch profile', error);
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, [params.id]);

  const handleFollow = async () => {
    if (!data) return;
    
    // Optimistic update
    setFollowing(!following);
    
    try {
      const res = await fetch('/api/social/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: data.user.id }),
      });
      
      if (!res.ok) {
        setFollowing(following); // Revert
      }
    } catch (error) {
      setFollowing(following); // Revert
    }
  };

  if (loading) return <div className="min-h-screen bg-white flex items-center justify-center">Loading...</div>;
  if (!data) return <div className="min-h-screen bg-white flex items-center justify-center">User not found</div>;

  return (
    <div className="min-h-screen bg-white pb-20">
      {/* Header */}
      <div className="sticky top-0 bg-white z-10 border-b border-slate-100">
        <div className="flex items-center p-4">
          <Link href="/social/feed" className="p-2 -ml-2 hover:bg-slate-50 rounded-full">
            <ArrowLeft className="w-6 h-6 text-slate-900" />
          </Link>
          <h1 className="font-bold text-lg ml-2">{data.user.firstName} {data.user.lastName}</h1>
        </div>
      </div>

      {/* Profile Info */}
      <div className="p-4 flex flex-col items-center text-center">
        <div className="w-24 h-24 rounded-full bg-slate-200 mb-4 overflow-hidden">
          {data.user.profileImage ? (
            <img src={data.user.profileImage} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-slate-500">
              {data.user.firstName[0]}
            </div>
          )}
        </div>
        <h2 className="font-bold text-xl text-slate-900">@{data.user.firstName}{data.user.lastName}</h2>
        <p className="text-slate-500 text-sm mt-1">{data.user.bio || 'No bio yet.'}</p>

        <div className="flex gap-8 mt-6">
          <div className="text-center">
            <div className="font-bold text-slate-900">{data.user._count.posts}</div>
            <div className="text-xs text-slate-500">Posts</div>
          </div>
          <div className="text-center">
            <div className="font-bold text-slate-900">{data.user.followersCount + (following && !data.user.isFollowing ? 1 : (!following && data.user.isFollowing ? -1 : 0))}</div>
            <div className="text-xs text-slate-500">Followers</div>
          </div>
          <div className="text-center">
            <div className="font-bold text-slate-900">{data.user.followingCount}</div>
            <div className="text-xs text-slate-500">Following</div>
          </div>
        </div>

        <div className="flex gap-2 mt-6 w-full max-w-xs">
          <button 
            onClick={handleFollow}
            className={`flex-1 py-2 font-bold rounded-lg text-sm transition-colors ${
              following 
                ? 'bg-slate-100 text-slate-900 border border-slate-200' 
                : 'bg-rose-600 text-white hover:bg-rose-500'
            }`}
          >
            {following ? 'Following' : 'Follow'}
          </button>
          <Link 
            href={`/social/messages/${data.user.id}`}
            className="flex-1 py-2 bg-slate-100 text-slate-900 font-bold rounded-lg text-sm flex items-center justify-center"
          >
            Message
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-t border-b border-slate-200 mt-4">
        <button className="flex-1 py-3 flex justify-center border-b-2 border-slate-900">
          <Grid className="w-5 h-5 text-slate-900" />
        </button>
        <button className="flex-1 py-3 flex justify-center text-slate-400">
          <Play className="w-5 h-5" />
        </button>
        <button className="flex-1 py-3 flex justify-center text-slate-400">
          <Users className="w-5 h-5" />
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-3 gap-0.5 mt-0.5">
        {data.posts.map(post => (
          <div key={post.id} className="aspect-[3/4] bg-slate-100 relative">
            {post.thumbnailUrl && (
              <img src={post.thumbnailUrl} alt="" className="w-full h-full object-cover" />
            )}
            <div className="absolute bottom-1 left-1 text-white text-xs font-bold drop-shadow-md flex items-center gap-1">
              <Play className="w-3 h-3 fill-white" />
              {post.likesCount}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
