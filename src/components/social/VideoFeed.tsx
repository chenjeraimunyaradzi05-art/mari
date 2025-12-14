'use client';

import React, { useEffect, useRef, useState } from 'react';
import { VideoPlayer, VideoPost } from './VideoPlayer';
import { Loader2, Plus, Search, Bell } from 'lucide-react';
import Link from 'next/link';

export function VideoFeed() {
  const [posts, setPosts] = useState<VideoPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch feed data
    async function fetchFeed() {
      try {
        const res = await fetch('/api/feed?type=social');
        if (res.ok) {
          const data = await res.json();
          setPosts(data.posts);
          if (data.posts.length > 0) {
            setActivePostId(data.posts[0].id);
          }
        }
      } catch (error) {
        console.error('Failed to fetch feed:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchFeed();
  }, []);

  // Intersection Observer to detect which video is in view
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('data-post-id');
            if (id) setActivePostId(id);
          }
        });
      },
      {
        threshold: 0.6, // 60% of the video must be visible
      }
    );

    const elements = document.querySelectorAll('.video-container');
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [posts]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)] bg-black">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)] bg-black text-white">
        <p>No posts available yet.</p>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="h-[calc(100vh-64px)] w-full overflow-y-scroll snap-y snap-mandatory scroll-smooth no-scrollbar bg-black relative"
    >
      {/* Header Overlay */}
      <div className="fixed top-20 left-4 z-50 flex gap-4">
        <Link href="/social/discover" className="p-2 bg-black/20 backdrop-blur-md rounded-full text-white hover:bg-black/40 transition-colors">
          <Search className="w-6 h-6" />
        </Link>
        <Link href="/social/notifications" className="p-2 bg-black/20 backdrop-blur-md rounded-full text-white hover:bg-black/40 transition-colors">
          <Bell className="w-6 h-6" />
        </Link>
      </div>

      {posts.map((post) => (
        <div 
          key={post.id} 
          data-post-id={post.id}
          className="video-container h-full w-full snap-start relative"
        >
          <VideoPlayer post={post} isActive={activePostId === post.id} />
        </div>
      ))}

      {/* Floating Upload Button */}
      <Link 
        href="/social/upload"
        className="fixed top-20 right-4 z-50 w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors border border-white/30"
      >
        <Plus className="w-6 h-6" />
      </Link>
    </div>
  );
}
