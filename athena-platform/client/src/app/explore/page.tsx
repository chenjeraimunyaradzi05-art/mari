'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { VideoFeed } from '@/components/video';
import { Compass, TrendingUp, Users, Bookmark } from 'lucide-react';

export default function ExplorePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('for-you');

  return (
    <div className="h-[100dvh] flex flex-col bg-black">
      {/* Header with tabs */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent pt-4 pb-8">
        <div className="flex justify-center">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-transparent border-0">
              <TabsTrigger 
                value="for-you" 
                className="text-white/70 data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-white rounded-none bg-transparent"
              >
                For You
              </TabsTrigger>
              <TabsTrigger 
                value="following" 
                className="text-white/70 data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-white rounded-none bg-transparent"
              >
                Following
              </TabsTrigger>
              <TabsTrigger 
                value="trending" 
                className="text-white/70 data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-white rounded-none bg-transparent"
              >
                Trending
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Video feed */}
      <VideoFeed category={activeTab === 'for-you' ? undefined : activeTab} />

      {/* Bottom navigation */}
      <nav className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black to-transparent pb-4 pt-8">
        <div className="flex justify-around items-center max-w-md mx-auto">
          <button
            onClick={() => router.push('/explore')}
            className="flex flex-col items-center text-white"
          >
            <Compass className="w-6 h-6" />
            <span className="text-xs mt-1">Explore</span>
          </button>
          <button
            onClick={() => router.push('/explore/trending')}
            className="flex flex-col items-center text-white/60 hover:text-white"
          >
            <TrendingUp className="w-6 h-6" />
            <span className="text-xs mt-1">Trending</span>
          </button>
          <button
            onClick={() => router.push('/community')}
            className="flex flex-col items-center text-white/60 hover:text-white"
          >
            <Users className="w-6 h-6" />
            <span className="text-xs mt-1">Community</span>
          </button>
          <button
            onClick={() => router.push('/explore/saved')}
            className="flex flex-col items-center text-white/60 hover:text-white"
          >
            <Bookmark className="w-6 h-6" />
            <span className="text-xs mt-1">Saved</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
