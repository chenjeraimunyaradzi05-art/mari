'use client';

import React, { useState } from 'react';
import { 
  Users, MessageCircle, Calendar, Hash, 
  Search, Filter, Plus, Heart, Share2, 
  MoreHorizontal, LayoutDashboard, Globe, 
  TrendingUp, UserPlus, Bell, Settings,
  Image as ImageIcon, Link as LinkIcon, Smile
} from 'lucide-react';

// --- Types ---
type ViewState = 'discover' | 'my-groups' | 'events' | 'discussions';

interface Group {
  id: string;
  name: string;
  description: string;
  members: number;
  postsPerDay: number;
  category: string;
  image: string;
  isJoined: boolean;
  tags: string[];
}

interface Post {
  id: string;
  author: string;
  avatar: string;
  group: string;
  content: string;
  likes: number;
  comments: number;
  time: string;
}

// --- Mock Data ---
const GROUPS: Group[] = [
  {
    id: '1',
    name: 'React Developers',
    description: 'A community for React.js enthusiasts to share knowledge, tips, and projects.',
    members: 12500,
    postsPerDay: 45,
    category: 'Technology',
    image: 'bg-sky-100 text-sky-600',
    isJoined: true,
    tags: ['React', 'Frontend', 'JavaScript']
  },
  {
    id: '2',
    name: 'Startup Founders',
    description: 'Connect with fellow entrepreneurs, find co-founders, and get advice on scaling.',
    members: 8200,
    postsPerDay: 28,
    category: 'Business',
    image: 'bg-amber-100 text-amber-600',
    isJoined: false,
    tags: ['Startup', 'Business', 'Networking']
  },
  {
    id: '3',
    name: 'Digital Nomads',
    description: 'Tips and tricks for working remotely while traveling the world.',
    members: 15000,
    postsPerDay: 60,
    category: 'Lifestyle',
    image: 'bg-emerald-100 text-emerald-600',
    isJoined: true,
    tags: ['Remote Work', 'Travel', 'Lifestyle']
  },
  {
    id: '4',
    name: 'UI/UX Design Hub',
    description: 'Share your designs, get feedback, and discuss the latest design trends.',
    members: 9800,
    postsPerDay: 35,
    category: 'Design',
    image: 'bg-rose-100 text-rose-600',
    isJoined: false,
    tags: ['Design', 'UI/UX', 'Figma']
  }
];

const RECENT_POSTS: Post[] = [
  {
    id: '1',
    author: 'Sarah Jenkins',
    avatar: 'SJ',
    group: 'React Developers',
    content: 'Just released a new open-source library for handling complex forms in React. Check it out! 🚀',
    likes: 124,
    comments: 45,
    time: '2 hours ago'
  },
  {
    id: '2',
    author: 'Mike Ross',
    avatar: 'MR',
    group: 'Startup Founders',
    content: 'Looking for a technical co-founder for a fintech startup. MVP is ready. DM me if interested.',
    likes: 89,
    comments: 23,
    time: '5 hours ago'
  }
];

// --- Components ---

const GroupCard = ({ group }: { group: Group }) => (
  <div className="bg-white p-6 rounded-2xl border border-slate-200 hover:shadow-md transition-all group cursor-pointer">
    <div className="flex items-start justify-between mb-4">
      <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${group.image}`}>
        <Hash className="w-8 h-8" />
      </div>
      <button className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
        group.isJoined 
          ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' 
          : 'bg-sky-600 text-white hover:bg-sky-700'
      }`}>
        {group.isJoined ? 'Joined' : 'Join Group'}
      </button>
    </div>
    
    <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-sky-600 transition-colors">{group.name}</h3>
    <p className="text-slate-500 text-sm mb-4 line-clamp-2">{group.description}</p>
    
    <div className="flex flex-wrap gap-2 mb-6">
      {group.tags.map((tag, i) => (
        <span key={i} className="px-2 py-1 bg-slate-50 text-slate-500 rounded-md text-xs font-medium border border-slate-100">
          #{tag}
        </span>
      ))}
    </div>

    <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-xs text-slate-500 font-medium">
      <span className="flex items-center gap-1">
        <Users className="w-4 h-4" /> {group.members.toLocaleString()} Members
      </span>
      <span className="flex items-center gap-1">
        <TrendingUp className="w-4 h-4 text-emerald-500" /> {group.postsPerDay} posts/day
      </span>
    </div>
  </div>
);

const PostCard = ({ post }: { post: Post }) => (
  <div className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-sky-200 transition-colors">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-600">
          {post.avatar}
        </div>
        <div>
          <h4 className="font-bold text-slate-900 text-sm">{post.author}</h4>
          <p className="text-xs text-slate-500">in <span className="font-medium text-sky-600">{post.group}</span> • {post.time}</p>
        </div>
      </div>
      <button className="text-slate-400 hover:text-slate-600">
        <MoreHorizontal className="w-5 h-5" />
      </button>
    </div>
    
    <p className="text-slate-700 mb-4 leading-relaxed">
      {post.content}
    </p>

    <div className="flex items-center gap-6 text-slate-500 text-sm">
      <button className="flex items-center gap-2 hover:text-rose-500 transition-colors">
        <Heart className="w-4 h-4" /> {post.likes}
      </button>
      <button className="flex items-center gap-2 hover:text-sky-600 transition-colors">
        <MessageCircle className="w-4 h-4" /> {post.comments}
      </button>
      <button className="flex items-center gap-2 hover:text-sky-600 transition-colors ml-auto">
        <Share2 className="w-4 h-4" /> Share
      </button>
    </div>
  </div>
);

const DiscoverView = () => (
  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
    {/* Hero Section */}
    <div className="relative bg-slate-900/50 rounded-3xl overflow-hidden p-8 md:p-12">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
      <div className="absolute top-0 right-0 w-2/3 h-full bg-linear-to-l from-sky-900/40 to-transparent" />
      
      <div className="relative z-10 max-w-2xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/20 border border-sky-500/30 backdrop-blur-sm mb-6">
          <Globe className="w-4 h-4 text-sky-400" />
          <span className="text-xs font-bold text-sky-100 uppercase tracking-wider">Community Hub</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
          Find your tribe.<br/>
          <span className="text-sky-500">Grow together.</span>
        </h1>
        <p className="text-lg text-slate-300 mb-8">
          Join thousands of professionals discussing technology, business, and design.
        </p>
        
        <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md p-2 rounded-xl border border-white/10 max-w-md">
          <Search className="w-5 h-5 text-slate-400 ml-2" />
          <input 
            type="text" 
            placeholder="Search for groups or topics..." 
            className="bg-transparent border-none text-white placeholder-slate-400 focus:ring-0 w-full"
          />
        </div>
      </div>
    </div>

    <div className="grid lg:grid-cols-3 gap-8">
      {/* Main Feed */}
      <div className="lg:col-span-2 space-y-8">
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-900">Popular Groups</h2>
            <button className="text-sm font-bold text-sky-600 hover:text-sky-700">Browse All</button>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {GROUPS.map((group) => (
              <GroupCard key={group.id} group={group} />
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-6">Trending Discussions</h2>
          <div className="space-y-4">
            {RECENT_POSTS.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        </div>
      </div>

      {/* Sidebar Widgets */}
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200">
          <h3 className="font-bold text-slate-900 mb-4">Create Community</h3>
          <p className="text-sm text-slate-500 mb-6">Start your own group and build a community around your interests.</p>
          <button className="w-full py-3 bg-sky-600 text-white rounded-xl font-bold hover:bg-sky-700 transition-colors flex items-center justify-center gap-2">
            <Plus className="w-5 h-5" /> Create Group
          </button>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200">
          <h3 className="font-bold text-slate-900 mb-4">Upcoming Events</h3>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="w-12 h-12 bg-sky-50 rounded-xl flex flex-col items-center justify-center text-sky-600 shrink-0">
                <span className="text-xs font-bold uppercase">Dec</span>
                <span className="text-lg font-bold">15</span>
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">React Summit 2025</h4>
                <p className="text-xs text-slate-500">Online • 10:00 AM</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-12 h-12 bg-sky-50 rounded-xl flex flex-col items-center justify-center text-sky-600 shrink-0">
                <span className="text-xs font-bold uppercase">Dec</span>
                <span className="text-lg font-bold">18</span>
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Startup Pitch Night</h4>
                <p className="text-xs text-slate-500">San Francisco • 6:00 PM</p>
              </div>
            </div>
          </div>
          <button className="w-full mt-4 py-2 text-sky-600 text-sm font-bold hover:bg-sky-50 rounded-lg transition-colors">
            View Calendar
          </button>
        </div>
      </div>
    </div>
  </div>
);

export default function SocialGroupsPage() {
  const [currentView, setCurrentView] = useState<ViewState>('discover');

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-slate-200 hidden lg:flex flex-col p-4 sticky top-0 h-screen">
        <div className="mb-8 px-4 pt-4">
          <div className="flex items-center gap-2 text-sky-600 font-bold text-xl">
            <Users className="w-6 h-6" />
            <span>Social Hub</span>
          </div>
        </div>
        
        <nav className="space-y-1 flex-1">
          <button onClick={() => setCurrentView('discover')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'discover' ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/20' : 'text-slate-600 hover:bg-slate-100'}`}>
            <Globe className="w-5 h-5" /><span className="font-medium">Discover</span>
          </button>
          <button onClick={() => setCurrentView('my-groups')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'my-groups' ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/20' : 'text-slate-600 hover:bg-slate-100'}`}>
            <Users className="w-5 h-5" /><span className="font-medium">My Groups</span>
          </button>
          <button onClick={() => setCurrentView('discussions')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'discussions' ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/20' : 'text-slate-600 hover:bg-slate-100'}`}>
            <MessageCircle className="w-5 h-5" /><span className="font-medium">Discussions</span>
          </button>
          <button onClick={() => setCurrentView('events')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'events' ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/20' : 'text-slate-600 hover:bg-slate-100'}`}>
            <Calendar className="w-5 h-5" /><span className="font-medium">Events</span>
          </button>
        </nav>

        <div className="p-4 bg-sky-50 rounded-xl border border-sky-100 mt-4">
          <div className="flex items-center gap-2 text-sky-900 font-bold mb-1">
            <UserPlus className="w-4 h-4" /> Invite Friends
          </div>
          <p className="text-xs text-sky-700 mb-3">Grow your network by inviting colleagues.</p>
          <button className="w-full py-2 bg-white border border-sky-200 rounded-lg text-xs font-bold text-sky-700 hover:bg-white/50">
            Send Invites
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 md:p-8 overflow-y-auto h-screen">
        {currentView === 'discover' && <DiscoverView />}
        
        {currentView !== 'discover' && (
          <div className="flex items-center justify-center h-full text-slate-500">
            <div className="text-center">
              <Users className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-bold text-slate-900">Coming Soon</h3>
              <p>This section is under development.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}