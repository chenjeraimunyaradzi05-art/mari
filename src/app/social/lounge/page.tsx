'use client';

import React, { useState } from 'react';
import { MessageSquare, Heart, Share2, Search, TrendingUp, Flame, MessageCircle } from 'lucide-react';

// Mock Data
const CATEGORIES = [
  { id: 'all', name: 'All Topics' },
  { id: 'workouts', name: 'Workouts & Training' },
  { id: 'nutrition', name: 'Nutrition & Diet' },
  { id: 'mental-health', name: 'Mental Wellness' },
  { id: 'gear', name: 'Gear & Equipment' },
  { id: 'success', name: 'Success Stories' },
];

const THREADS = [
  {
    id: 1,
    author: { name: 'Sarah Jenkins', avatar: 'S', color: 'bg-rose-500' },
    title: 'Best pre-workout meal for early morning runs?',
    preview: 'I have been trying to get into morning running but I struggle with energy levels. What do you guys eat before a 6am run?',
    category: 'Nutrition',
    likes: 24,
    comments: 12,
    time: '2h ago',
    tags: ['Running', 'Breakfast', 'Energy']
  },
  {
    id: 2,
    author: { name: 'Mike Ross', avatar: 'M', color: 'bg-blue-500' },
    title: 'Finally hit my 100kg deadlift goal! 🎉',
    preview: 'After 6 months of consistent training, I finally broke through my plateau. Here is what I changed in my routine...',
    category: 'Success Stories',
    likes: 156,
    comments: 43,
    time: '4h ago',
    tags: ['Lifting', 'PR', 'Motivation']
  },
  {
    id: 3,
    author: { name: 'Emma Wilson', avatar: 'E', color: 'bg-emerald-500' },
    title: 'Yoga for runners - 15 min routine',
    preview: 'Sharing my go-to yoga flow for tight hamstrings and hips. Perfect for post-run recovery.',
    category: 'Workouts',
    likes: 89,
    comments: 8,
    time: '6h ago',
    tags: ['Yoga', 'Recovery', 'Flexibility']
  },
  {
    id: 4,
    author: { name: 'David Chen', avatar: 'D', color: 'bg-amber-500' },
    title: 'Review: New Garmin Forerunner 965',
    preview: 'Is it worth the upgrade? I have been testing it for a week and here are my thoughts on the new AMOLED display.',
    category: 'Gear',
    likes: 45,
    comments: 21,
    time: '1d ago',
    tags: ['Tech', 'Reviews', 'Running']
  }
];

const TRENDING = [
  '#SummerShred', '#MarathonTraining', '#PlantBased', '#HomeGym', '#MeditationChallenge'
];

export default function SocialLounge() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredThreads = THREADS.filter(thread => {
    const matchesCategory = activeCategory === 'all' || thread.category.toLowerCase().includes(activeCategory.replace('-', ' '));
    const matchesSearch = thread.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          thread.preview.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-rose-600 rounded-lg flex items-center justify-center text-white font-bold">
              <MessageSquare className="w-5 h-5" />
            </div>
            <span className="font-bold text-xl text-slate-900">Wellness Lounge</span>
          </div>
          <button className="px-4 py-2 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-500 transition-colors text-sm">
            New Post
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 flex gap-8">
        {/* Left Sidebar - Navigation */}
        <div className="hidden lg:block w-64 shrink-0 space-y-6">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <h3 className="font-bold text-slate-900 mb-4 px-2">Categories</h3>
            <div className="space-y-1">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                    activeCategory === cat.id 
                      ? 'bg-rose-50 text-rose-700' 
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-linear-to-br from-rose-500 to-rose-600 p-6 rounded-2xl text-white shadow-lg shadow-rose-900/20">
            <h3 className="font-bold text-lg mb-2">Weekly Challenge</h3>
            <p className="text-rose-100 text-sm mb-4">Join 500+ members in the 30-day plank challenge!</p>
            <button className="w-full py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg text-sm font-bold transition-colors">
              Join Now
            </button>
          </div>
        </div>

        {/* Main Feed */}
        <div className="flex-1 min-w-0">
          {/* Search Bar */}
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search discussions..." 
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all shadow-xs"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Threads */}
          <div className="space-y-4">
            {filteredThreads.map(thread => (
              <div key={thread.id} className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-rose-200 transition-all cursor-pointer group shadow-xs hover:shadow-md">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0 ${thread.author.color}`}>
                    {thread.author.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-slate-900 text-sm">{thread.author.name}</span>
                      <span className="text-slate-400 text-xs">• {thread.time}</span>
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full font-medium">
                        {thread.category}
                      </span>
                    </div>
                    <h3 className="font-bold text-lg text-slate-900 mb-2 group-hover:text-rose-600 transition-colors">
                      {thread.title}
                    </h3>
                    <p className="text-slate-600 text-sm leading-relaxed mb-4 line-clamp-2">
                      {thread.preview}
                    </p>
                    
                    <div className="flex items-center gap-6">
                      <button className="flex items-center gap-1.5 text-slate-600 hover:text-rose-600 transition-colors text-sm font-medium">
                        <Heart className="w-4 h-4" />
                        {thread.likes}
                      </button>
                      <button className="flex items-center gap-1.5 text-slate-600 hover:text-rose-600 transition-colors text-sm font-medium">
                        <MessageCircle className="w-4 h-4" />
                        {thread.comments}
                      </button>
                      <button className="flex items-center gap-1.5 text-slate-600 hover:text-rose-600 transition-colors text-sm font-medium ml-auto">
                        <Share2 className="w-4 h-4" />
                        Share
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Sidebar - Trending */}
        <div className="hidden xl:block w-80 shrink-0 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-rose-500" />
              <h3 className="font-bold text-slate-900">Trending Topics</h3>
            </div>
            <div className="space-y-3">
              {TRENDING.map((tag, i) => (
                <div key={i} className="flex items-center justify-between group cursor-pointer">
                  <span className="text-slate-600 font-medium group-hover:text-rose-600 transition-colors">{tag}</span>
                  <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
                    {(5 - i) * 12}k posts
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2 mb-4">
              <Flame className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-slate-900">Top Contributors</h3>
            </div>
            <div className="space-y-4">
              {[1, 2, 3].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-xs font-bold text-slate-600">
                    U{i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-slate-900">User Name</div>
                    <div className="text-xs text-slate-500">1.2k points</div>
                  </div>
                  <button className="text-xs font-bold text-rose-600 hover:text-rose-700">Follow</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
