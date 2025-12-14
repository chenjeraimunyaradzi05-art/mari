'use client';

import React, { useState } from 'react';
import { 
  BookOpen, FileText, Star, ArrowRight, CheckCircle,
  Library, Search, Filter, Tag,
  ChevronRight, Download, X, Plus, Calendar, Target,
  LayoutDashboard, Share2, Bookmark, Video, Layers
} from 'lucide-react';

// --- Types ---
type ViewState = 'overview' | 'categories' | 'latest' | 'favorites' | 'archived';

interface Resource {
  id: string;
  title: string;
  type: 'Guide' | 'Video' | 'Article' | 'Template';
  category: string;
  readTime?: string;
  date: string;
  description: string;
}

interface Category {
  id: string;
  name: string;
  count: number;
  icon: React.ElementType;
  color: string;
}

// --- Mock Data ---
const RESOURCES: Resource[] = [
  { id: '1', title: 'Getting Started with Athena', type: 'Guide', category: 'Onboarding', readTime: '5 min', date: 'Dec 10, 2025', description: 'A complete walkthrough of the Athena platform basics.' },
  { id: '2', title: 'Advanced Financial Reporting', type: 'Article', category: 'Finance', readTime: '12 min', date: 'Nov 28, 2025', description: 'Deep dive into creating custom financial reports and dashboards.' },
  { id: '3', title: 'User Management Best Practices', type: 'Video', category: 'Admin', readTime: '8 min', date: 'Dec 05, 2025', description: 'Video tutorial on managing user roles and permissions effectively.' },
  { id: '4', title: 'Q4 Marketing Strategy Template', type: 'Template', category: 'Marketing', readTime: 'N/A', date: 'Oct 15, 2025', description: 'Downloadable template for quarterly marketing planning.' },
];

const CATEGORIES: Category[] = [
  { id: '1', name: 'Onboarding', count: 12, icon: Target, color: 'text-emerald-600 bg-emerald-50' },
  { id: '2', name: 'Finance', count: 8, icon: Layers, color: 'text-blue-600 bg-blue-50' },
  { id: '3', name: 'Technical', count: 15, icon: FileText, color: 'text-purple-600 bg-purple-50' },
];

// --- Components ---
const FileViewer = ({ resource, onClose }: { resource: Resource; onClose: () => void }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
    <div className="bg-white rounded-2xl w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-teal-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">{resource.title}</h3>
            <p className="text-xs text-slate-500">{resource.type} • {resource.readTime}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600">
            <Bookmark className="w-5 h-5" />
          </button>
          <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600">
            <Download className="w-5 h-5" />
          </button>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="flex-1 bg-slate-100 p-8 overflow-y-auto flex items-center justify-center">
        <div className="bg-white shadow-lg p-12 max-w-2xl w-full min-h-[600px] flex flex-col items-center text-center">
          <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6">
            <BookOpen className="w-10 h-10 text-slate-300" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">{resource.title}</h2>
          <p className="text-slate-500 mb-8 max-w-md">
            This is a preview of the guide content. In a real application, the full article or video would be rendered here.
          </p>
          <div className="p-6 bg-teal-50 rounded-xl border border-teal-100 max-w-sm w-full">
            <h4 className="font-bold text-teal-900 mb-2">Summary</h4>
            <p className="text-sm text-teal-700">{resource.description}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
);

interface OverviewViewProps {
  onSelectResource: (resource: Resource) => void;
  onNavigate: (view: ViewState) => void;
}

const OverviewView = ({ onSelectResource, onNavigate }: OverviewViewProps) => (
  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
    {/* Hero Card */}
    <div className="relative bg-slate-900/50 rounded-3xl overflow-hidden p-8 md:p-12">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
      <div className="absolute top-0 right-0 w-2/3 h-full bg-linear-to-l from-teal-900/40 to-transparent" />
      
      <div className="relative z-10 max-w-2xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 border border-teal-500/30 backdrop-blur-sm mb-6">
          <Library className="w-4 h-4 text-teal-400" />
          <span className="text-xs font-bold text-teal-100 uppercase tracking-wider">Knowledge Base</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
          Master the platform, <span className="text-teal-500">Expertly.</span>
        </h1>
        <p className="text-lg text-slate-300 mb-8">
          Explore our comprehensive library of guides, tutorials, and documentation to get the most out of Athena.
        </p>
        <div className="flex flex-wrap gap-4">
          <button onClick={() => onNavigate('categories')} className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold transition-colors flex items-center gap-2">
            Browse Categories <ArrowRight className="w-4 h-4" />
          </button>
          <button onClick={() => onNavigate('latest')} className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-colors backdrop-blur-sm">
            New Arrivals
          </button>
        </div>
      </div>
    </div>

    {/* Quick Stats */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="w-10 h-10 bg-teal-50 rounded-lg flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-teal-600" />
          </div>
          <span className="text-xs font-bold text-teal-600 bg-teal-50 px-2 py-1 rounded-full">Total</span>
        </div>
        <div className="text-3xl font-bold text-slate-900 mb-1">142</div>
        <div className="text-sm text-slate-500">Available Guides</div>
      </div>
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
            <Star className="w-5 h-5 text-amber-600" />
          </div>
          <span className="text-xs font-bold text-slate-500">Popular</span>
        </div>
        <div className="text-3xl font-bold text-slate-900 mb-1">12</div>
        <div className="text-sm text-slate-500">Trending Topics</div>
      </div>
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="w-10 h-10 bg-rose-50 rounded-lg flex items-center justify-center">
            <Video className="w-5 h-5 text-rose-600" />
          </div>
          <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded-full">New</span>
        </div>
        <div className="text-3xl font-bold text-slate-900 mb-1">5</div>
        <div className="text-sm text-slate-500">Video Tutorials</div>
      </div>
    </div>

    {/* Categories & Featured */}
    <div className="grid lg:grid-cols-3 gap-8">
      {/* Categories */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Categories</h2>
        </div>
        <div className="space-y-3">
          {CATEGORIES.map((cat) => (
            <div key={cat.id} className="bg-white p-4 rounded-xl border border-slate-200 hover:border-teal-200 hover:shadow-sm transition-all cursor-pointer flex items-center justify-between group">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${cat.color}`}>
                  <cat.icon className="w-5 h-5" />
                </div>
                <span className="font-bold text-slate-700 group-hover:text-teal-700 transition-colors">{cat.name}</span>
              </div>
              <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-full">{cat.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Featured Resources */}
      <div className="lg:col-span-2 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Featured Guides</h2>
          <button className="text-sm font-bold text-teal-600 hover:text-teal-700">View All</button>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {RESOURCES.map((resource) => (
            <div 
              key={resource.id}
              onClick={() => onSelectResource(resource)}
              className="group bg-white p-4 rounded-xl border border-slate-200 hover:border-teal-200 hover:shadow-md transition-all cursor-pointer flex flex-col h-full"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center group-hover:bg-teal-50 transition-colors">
                  <FileText className="w-5 h-5 text-slate-400 group-hover:text-teal-500 transition-colors" />
                </div>
                <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-full">{resource.category}</span>
              </div>
              
              <h3 className="font-bold text-slate-900 group-hover:text-teal-700 transition-colors mb-2 line-clamp-2">{resource.title}</h3>
              <p className="text-sm text-slate-500 line-clamp-2 mb-4 flex-1">{resource.description}</p>
              
              <div className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-50">
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {resource.date}</span>
                <span className="flex items-center gap-1">{resource.readTime}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

export default function GuidesPage() {
  const [currentView, setCurrentView] = useState<ViewState>('overview');
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex">
      {/* Sidebar Navigation */}
      <div className="w-64 bg-white border-r border-slate-200 hidden lg:flex flex-col p-4 sticky top-0 h-screen">
        <div className="mb-8 px-4 pt-4">
          <div className="flex items-center gap-2 text-teal-600 font-bold text-xl">
            <Library className="w-6 h-6" />
            <span>Guides</span>
          </div>
        </div>
        
        <nav className="space-y-1 flex-1">
          <button onClick={() => setCurrentView('overview')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'overview' ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/20' : 'text-slate-600 hover:bg-slate-100'}`}><LayoutDashboard className="w-5 h-5" /><span className="font-medium">Overview</span></button>
          <button onClick={() => setCurrentView('categories')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'categories' ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/20' : 'text-slate-600 hover:bg-slate-100'}`}><Layers className="w-5 h-5" /><span className="font-medium">Categories</span></button>
          <button onClick={() => setCurrentView('latest')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'latest' ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/20' : 'text-slate-600 hover:bg-slate-100'}`}><Calendar className="w-5 h-5" /><span className="font-medium">Latest</span></button>
          <button onClick={() => setCurrentView('favorites')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'favorites' ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/20' : 'text-slate-600 hover:bg-slate-100'}`}><Star className="w-5 h-5" /><span className="font-medium">Favorites</span></button>
        </nav>

        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 mt-4">
          <h4 className="font-bold text-slate-900 mb-2 text-sm">Contribute</h4>
          <p className="text-xs text-slate-500 mb-3">Have knowledge to share?</p>
          <button className="w-full py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50">
            Submit Guide
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 md:p-8 pb-24 lg:pb-8 overflow-y-auto h-screen">
        {currentView === 'overview' && <OverviewView onSelectResource={setSelectedResource} onNavigate={setCurrentView} />}
        {/* Placeholders for other views */}
        {currentView !== 'overview' && (
          <div className="flex items-center justify-center h-full text-slate-500">
            View content coming soon...
          </div>
        )}
      </div>

      {/* Modals */}
      {selectedResource && (
        <FileViewer resource={selectedResource} onClose={() => setSelectedResource(null)} />
      )}
    </div>
  );
}