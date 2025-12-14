'use client';

import React, { useState } from 'react';
import { 
  Microscope, FileText, TrendingUp, ArrowRight, CheckCircle,
  Globe, Search, Filter, PieChart,
  ChevronRight, Download, X, Plus, Calendar, Target,
  LayoutDashboard, Share2, Bookmark, BarChart3, FlaskConical
} from 'lucide-react';

// --- Types ---
type ViewState = 'overview' | 'reports' | 'market-data' | 'case-studies' | 'saved';

interface Resource {
  id: string;
  title: string;
  type: 'Report' | 'Analysis' | 'Case Study' | 'Whitepaper';
  category: string;
  pages?: number;
  date: string;
  description: string;
}

interface MarketStat {
  id: string;
  label: string;
  value: string;
  trend: 'up' | 'down' | 'neutral';
  change: string;
}

// --- Mock Data ---
const RESOURCES: Resource[] = [
  { id: '1', title: 'Global Fintech Market Outlook 2026', type: 'Report', category: 'Market Trends', pages: 45, date: 'Dec 08, 2025', description: 'Comprehensive analysis of emerging trends in the global financial technology sector.' },
  { id: '2', title: 'Consumer Behavior in Digital Banking', type: 'Analysis', category: 'Consumer Insights', pages: 22, date: 'Nov 25, 2025', description: 'Study on how Gen Z and Millennials interact with mobile banking applications.' },
  { id: '3', title: 'Case Study: AI in Risk Management', type: 'Case Study', category: 'Technology', pages: 15, date: 'Dec 01, 2025', description: 'Real-world application of machine learning models for credit risk assessment.' },
  { id: '4', title: 'Q3 2025 Economic Impact Brief', type: 'Whitepaper', category: 'Economics', pages: 10, date: 'Oct 20, 2025', description: 'Summary of macroeconomic factors affecting small business growth.' },
];

const MARKET_STATS: MarketStat[] = [
  { id: '1', label: 'Market Sentiment', value: 'Bullish', trend: 'up', change: '+12%' },
  { id: '2', label: 'Tech Adoption', value: 'High', trend: 'up', change: '+5.4%' },
  { id: '3', label: 'Risk Index', value: 'Moderate', trend: 'down', change: '-2.1%' },
];

// --- Components ---
const FileViewer = ({ resource, onClose }: { resource: Resource; onClose: () => void }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
    <div className="bg-white rounded-2xl w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">{resource.title}</h3>
            <p className="text-xs text-slate-500">{resource.type} • {resource.pages} Pages</p>
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
            <BarChart3 className="w-10 h-10 text-slate-300" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">{resource.title}</h2>
          <p className="text-slate-500 mb-8 max-w-md">
            This is a preview of the research document. Full access requires a subscription or download.
          </p>
          <div className="p-6 bg-violet-50 rounded-xl border border-violet-100 max-w-sm w-full">
            <h4 className="font-bold text-violet-900 mb-2">Abstract</h4>
            <p className="text-sm text-violet-700">{resource.description}</p>
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
      <div className="absolute top-0 right-0 w-2/3 h-full bg-linear-to-l from-violet-900/40 to-transparent" />
      
      <div className="relative z-10 max-w-2xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/20 border border-violet-500/30 backdrop-blur-sm mb-6">
          <Microscope className="w-4 h-4 text-violet-400" />
          <span className="text-xs font-bold text-violet-100 uppercase tracking-wider">Research Lab</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
          Insights that drive <span className="text-violet-500">Innovation.</span>
        </h1>
        <p className="text-lg text-slate-300 mb-8">
          Access proprietary market research, trend analysis, and data-driven reports to inform your strategy.
        </p>
        <div className="flex flex-wrap gap-4">
          <button onClick={() => onNavigate('reports')} className="px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold transition-colors flex items-center gap-2">
            Browse Reports <ArrowRight className="w-4 h-4" />
          </button>
          <button onClick={() => onNavigate('market-data')} className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-colors backdrop-blur-sm">
            Market Data
          </button>
        </div>
      </div>
    </div>

    {/* Quick Stats */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {MARKET_STATS.map((stat) => (
        <div key={stat.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-violet-50 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-violet-600" />
            </div>
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${stat.trend === 'up' ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'}`}>
              {stat.change}
            </span>
          </div>
          <div className="text-3xl font-bold text-slate-900 mb-1">{stat.value}</div>
          <div className="text-sm text-slate-500">{stat.label}</div>
        </div>
      ))}
    </div>

    {/* Latest Research */}
    <div className="grid lg:grid-cols-3 gap-8">
      {/* Featured Reports */}
      <div className="lg:col-span-2 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Latest Research</h2>
          <button className="text-sm font-bold text-violet-600 hover:text-violet-700">View Archive</button>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {RESOURCES.map((resource) => (
            <div 
              key={resource.id}
              onClick={() => onSelectResource(resource)}
              className="group bg-white p-4 rounded-xl border border-slate-200 hover:border-violet-200 hover:shadow-md transition-all cursor-pointer flex flex-col h-full"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center group-hover:bg-violet-50 transition-colors">
                  <FileText className="w-5 h-5 text-slate-400 group-hover:text-violet-500 transition-colors" />
                </div>
                <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-full">{resource.category}</span>
              </div>
              
              <h3 className="font-bold text-slate-900 group-hover:text-violet-700 transition-colors mb-2 line-clamp-2">{resource.title}</h3>
              <p className="text-sm text-slate-500 line-clamp-2 mb-4 flex-1">{resource.description}</p>
              
              <div className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-50">
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {resource.date}</span>
                <span className="flex items-center gap-1">{resource.pages} Pages</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Categories/Topics */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Topics</h2>
        </div>
        <div className="space-y-3">
          {['Market Trends', 'Consumer Insights', 'Technology', 'Economics', 'Regulatory', 'Sustainability'].map((topic, i) => (
            <div key={i} className="bg-white p-3 rounded-xl border border-slate-200 hover:border-violet-200 hover:shadow-sm transition-all cursor-pointer flex items-center justify-between group">
              <span className="font-bold text-slate-700 group-hover:text-violet-700 transition-colors">{topic}</span>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-violet-400" />
            </div>
          ))}
        </div>
        
        <div className="p-6 bg-violet-900 rounded-2xl text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-violet-800 rounded-full -mr-16 -mt-16 opacity-50" />
          <div className="relative z-10">
            <h3 className="font-bold text-lg mb-2">Request Research</h3>
            <p className="text-violet-200 text-sm mb-4">Need specific data? Commission a custom report.</p>
            <button className="w-full py-2 bg-white text-violet-900 rounded-lg text-sm font-bold hover:bg-violet-50 transition-colors">
              Contact Analysts
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default function ResearchPage() {
  const [currentView, setCurrentView] = useState<ViewState>('overview');
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex">
      {/* Sidebar Navigation */}
      <div className="w-64 bg-white border-r border-slate-200 hidden lg:flex flex-col p-4 sticky top-0 h-screen">
        <div className="mb-8 px-4 pt-4">
          <div className="flex items-center gap-2 text-violet-600 font-bold text-xl">
            <Microscope className="w-6 h-6" />
            <span>Research</span>
          </div>
        </div>
        
        <nav className="space-y-1 flex-1">
          <button onClick={() => setCurrentView('overview')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'overview' ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/20' : 'text-slate-600 hover:bg-slate-100'}`}><LayoutDashboard className="w-5 h-5" /><span className="font-medium">Overview</span></button>
          <button onClick={() => setCurrentView('reports')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'reports' ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/20' : 'text-slate-600 hover:bg-slate-100'}`}><FileText className="w-5 h-5" /><span className="font-medium">Reports</span></button>
          <button onClick={() => setCurrentView('market-data')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'market-data' ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/20' : 'text-slate-600 hover:bg-slate-100'}`}><BarChart3 className="w-5 h-5" /><span className="font-medium">Market Data</span></button>
          <button onClick={() => setCurrentView('case-studies')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'case-studies' ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/20' : 'text-slate-600 hover:bg-slate-100'}`}><FlaskConical className="w-5 h-5" /><span className="font-medium">Case Studies</span></button>
          <button onClick={() => setCurrentView('saved')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'saved' ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/20' : 'text-slate-600 hover:bg-slate-100'}`}><Bookmark className="w-5 h-5" /><span className="font-medium">Saved</span></button>
        </nav>

        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 mt-4">
          <h4 className="font-bold text-slate-900 mb-2 text-sm">Analyst Support</h4>
          <p className="text-xs text-slate-500 mb-3">Questions about a report?</p>
          <button className="w-full py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50">
            Contact Team
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