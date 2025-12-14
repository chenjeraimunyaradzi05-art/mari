'use client';

import React, { useState } from 'react';
import { 
  Newspaper, FileText, TrendingUp, ArrowRight, CheckCircle,
  MessageSquare, Search, Filter, Tag,
  ChevronRight, Download, X, Plus, Calendar, Target,
  LayoutDashboard, Share2, Bookmark, User, PenTool
} from 'lucide-react';

// --- Types ---
type ViewState = 'overview' | 'latest' | 'popular' | 'categories' | 'archive';

interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  author: string;
  category: string;
  readTime: string;
  date: string;
  image?: string;
}

interface Category {
  id: string;
  name: string;
  count: number;
  color: string;
}

// --- Mock Data ---
const BLOG_POSTS: BlogPost[] = [
  { 
    id: '1', 
    title: 'The Future of Decentralized Finance', 
    excerpt: 'Exploring how DeFi is reshaping the global banking landscape and what it means for traditional institutions.', 
    author: 'Alex Rivera', 
    category: 'Industry', 
    readTime: '8 min', 
    date: 'Dec 12, 2025' 
  },
  { 
    id: '2', 
    title: 'Athena Product Update: Q4 2025', 
    excerpt: 'New features, performance improvements, and a look ahead at our 2026 roadmap.', 
    author: 'Sarah Chen', 
    category: 'Product', 
    readTime: '5 min', 
    date: 'Dec 05, 2025' 
  },
  { 
    id: '3', 
    title: 'Building Scalable React Applications', 
    excerpt: 'Lessons learned from migrating our core platform to a micro-frontend architecture.', 
    author: 'Marcus Johnson', 
    category: 'Engineering', 
    readTime: '12 min', 
    date: 'Nov 28, 2025' 
  },
  { 
    id: '4', 
    title: 'Cultivating a Remote-First Culture', 
    excerpt: 'How we maintain connection and collaboration across 12 different time zones.', 
    author: 'Jessica Wu', 
    category: 'Culture', 
    readTime: '6 min', 
    date: 'Nov 15, 2025' 
  },
];

const CATEGORIES: Category[] = [
  { id: '1', name: 'Product', count: 24, color: 'text-orange-600 bg-orange-50' },
  { id: '2', name: 'Engineering', count: 18, color: 'text-blue-600 bg-blue-50' },
  { id: '3', name: 'Industry', count: 12, color: 'text-purple-600 bg-purple-50' },
  { id: '4', name: 'Culture', count: 8, color: 'text-emerald-600 bg-emerald-50' },
];

// --- Components ---
const ArticleViewer = ({ post, onClose }: { post: BlogPost; onClose: () => void }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
    <div className="bg-white rounded-2xl w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
            <PenTool className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 line-clamp-1">{post.title}</h3>
            <p className="text-xs text-slate-500">By {post.author} • {post.date}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600">
            <Share2 className="w-5 h-5" />
          </button>
          <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600">
            <Bookmark className="w-5 h-5" />
          </button>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="flex-1 bg-slate-50 p-8 overflow-y-auto flex justify-center">
        <div className="max-w-2xl w-full bg-white p-12 shadow-sm min-h-[800px]">
          <span className="inline-block px-3 py-1 rounded-full bg-orange-50 text-orange-600 text-xs font-bold mb-6">
            {post.category}
          </span>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6 leading-tight">
            {post.title}
          </h1>
          <div className="flex items-center gap-4 mb-8 pb-8 border-b border-slate-100">
            <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-slate-400" />
            </div>
            <div>
              <div className="font-bold text-slate-900">{post.author}</div>
              <div className="text-sm text-slate-500">{post.readTime} read • {post.date}</div>
            </div>
          </div>
          <div className="prose prose-slate max-w-none">
            <p className="text-lg text-slate-600 leading-relaxed mb-6">
              {post.excerpt}
            </p>
            <p className="text-slate-600 leading-relaxed mb-4">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
            </p>
            <p className="text-slate-600 leading-relaxed mb-4">
              Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
            </p>
            <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">Key Takeaways</h3>
            <ul className="list-disc pl-5 space-y-2 text-slate-600 mb-6">
              <li>Understanding the core principles of the topic.</li>
              <li>Analyzing the impact on current workflows.</li>
              <li>Future predictions and strategic planning.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
);

interface OverviewViewProps {
  onSelectPost: (post: BlogPost) => void;
  onNavigate: (view: ViewState) => void;
}

const OverviewView = ({ onSelectPost, onNavigate }: OverviewViewProps) => (
  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
    {/* Hero Card */}
    <div className="relative bg-slate-900/50 rounded-3xl overflow-hidden p-8 md:p-12">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
      <div className="absolute top-0 right-0 w-2/3 h-full bg-linear-to-l from-orange-900/40 to-transparent" />
      
      <div className="relative z-10 max-w-2xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/20 border border-orange-500/30 backdrop-blur-sm mb-6">
          <Newspaper className="w-4 h-4 text-orange-400" />
          <span className="text-xs font-bold text-orange-100 uppercase tracking-wider">Athena Blog</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
          Stories from the <span className="text-orange-500">Edge.</span>
        </h1>
        <p className="text-lg text-slate-300 mb-8">
          Insights, updates, and deep dives from the team building the future of finance.
        </p>
        <div className="flex flex-wrap gap-4">
          <button onClick={() => onNavigate('latest')} className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold transition-colors flex items-center gap-2">
            Read Latest <ArrowRight className="w-4 h-4" />
          </button>
          <button onClick={() => onNavigate('categories')} className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-colors backdrop-blur-sm">
            Browse Topics
          </button>
        </div>
      </div>
    </div>

    {/* Quick Stats */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5 text-orange-600" />
          </div>
          <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-full">Active</span>
        </div>
        <div className="text-3xl font-bold text-slate-900 mb-1">128</div>
        <div className="text-sm text-slate-500">Published Posts</div>
      </div>
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
            <User className="w-5 h-5 text-blue-600" />
          </div>
          <span className="text-xs font-bold text-slate-500">Readers</span>
        </div>
        <div className="text-3xl font-bold text-slate-900 mb-1">12.5k</div>
        <div className="text-sm text-slate-500">Monthly Subscribers</div>
      </div>
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-purple-600" />
          </div>
          <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded-full">Engaged</span>
        </div>
        <div className="text-3xl font-bold text-slate-900 mb-1">850+</div>
        <div className="text-sm text-slate-500">Comments this week</div>
      </div>
    </div>

    {/* Main Content Grid */}
    <div className="grid lg:grid-cols-3 gap-8">
      {/* Latest Posts */}
      <div className="lg:col-span-2 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Latest Stories</h2>
          <button className="text-sm font-bold text-orange-600 hover:text-orange-700">View All</button>
        </div>
        <div className="space-y-6">
          {BLOG_POSTS.map((post) => (
            <div 
              key={post.id}
              onClick={() => onSelectPost(post)}
              className="group bg-white p-6 rounded-2xl border border-slate-200 hover:border-orange-200 hover:shadow-md transition-all cursor-pointer flex flex-col md:flex-row gap-6"
            >
              <div className="w-full md:w-48 h-32 bg-slate-100 rounded-xl flex items-center justify-center shrink-0 overflow-hidden">
                <div className="w-full h-full bg-slate-200 group-hover:scale-105 transition-transform duration-500" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-full">{post.category}</span>
                  <span className="text-xs text-slate-400">• {post.readTime} read</span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 group-hover:text-orange-700 transition-colors mb-2">{post.title}</h3>
                <p className="text-slate-500 text-sm line-clamp-2 mb-4">{post.excerpt}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-slate-200 rounded-full" />
                    <span className="text-xs font-medium text-slate-600">{post.author}</span>
                  </div>
                  <span className="text-xs text-slate-400">{post.date}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sidebar Widgets */}
      <div className="space-y-8">
        {/* Categories */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200">
          <h3 className="font-bold text-slate-900 mb-4">Categories</h3>
          <div className="space-y-3">
            {CATEGORIES.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between group cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${cat.color.split(' ')[0]}`} />
                  <span className="text-slate-600 group-hover:text-slate-900 transition-colors">{cat.name}</span>
                </div>
                <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-full">{cat.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Newsletter */}
        <div className="bg-orange-900 rounded-2xl p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-orange-800 rounded-full -mr-16 -mt-16 opacity-50" />
          <div className="relative z-10">
            <h3 className="font-bold text-lg mb-2">Subscribe</h3>
            <p className="text-orange-200 text-sm mb-4">Get the latest stories delivered to your inbox weekly.</p>
            <div className="space-y-2">
              <input 
                type="email" 
                placeholder="Enter your email" 
                className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-orange-200/50 focus:outline-none focus:border-white/40 text-sm"
              />
              <button className="w-full py-2 bg-white text-orange-900 rounded-lg text-sm font-bold hover:bg-orange-50 transition-colors">
                Subscribe
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default function BlogPage() {
  const [currentView, setCurrentView] = useState<ViewState>('overview');
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex">
      {/* Sidebar Navigation */}
      <div className="w-64 bg-white border-r border-slate-200 hidden lg:flex flex-col p-4 sticky top-0 h-screen">
        <div className="mb-8 px-4 pt-4">
          <div className="flex items-center gap-2 text-orange-600 font-bold text-xl">
            <Newspaper className="w-6 h-6" />
            <span>Blog</span>
          </div>
        </div>
        
        <nav className="space-y-1 flex-1">
          <button onClick={() => setCurrentView('overview')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'overview' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-slate-600 hover:bg-slate-100'}`}><LayoutDashboard className="w-5 h-5" /><span className="font-medium">Overview</span></button>
          <button onClick={() => setCurrentView('latest')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'latest' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-slate-600 hover:bg-slate-100'}`}><Calendar className="w-5 h-5" /><span className="font-medium">Latest</span></button>
          <button onClick={() => setCurrentView('popular')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'popular' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-slate-600 hover:bg-slate-100'}`}><TrendingUp className="w-5 h-5" /><span className="font-medium">Popular</span></button>
          <button onClick={() => setCurrentView('categories')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'categories' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-slate-600 hover:bg-slate-100'}`}><Tag className="w-5 h-5" /><span className="font-medium">Topics</span></button>
          <button onClick={() => setCurrentView('archive')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'archive' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-slate-600 hover:bg-slate-100'}`}><FileText className="w-5 h-5" /><span className="font-medium">Archive</span></button>
        </nav>

        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 mt-4">
          <h4 className="font-bold text-slate-900 mb-2 text-sm">Write for Us</h4>
          <p className="text-xs text-slate-500 mb-3">Share your expertise with the community.</p>
          <button className="w-full py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50">
            Submit Pitch
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 md:p-8 pb-24 lg:pb-8 overflow-y-auto h-screen">
        {currentView === 'overview' && <OverviewView onSelectPost={setSelectedPost} onNavigate={setCurrentView} />}
        {/* Placeholders for other views */}
        {currentView !== 'overview' && (
          <div className="flex items-center justify-center h-full text-slate-500">
            View content coming soon...
          </div>
        )}
      </div>

      {/* Modals */}
      {selectedPost && (
        <ArticleViewer post={selectedPost} onClose={() => setSelectedPost(null)} />
      )}
    </div>
  );
}