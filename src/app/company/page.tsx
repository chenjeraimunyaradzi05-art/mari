'use client';

import React, { useState } from 'react';
import { 
  Building2, Users, FileText, ArrowRight, CheckCircle,
  Briefcase, Globe, Search, Filter,
  ChevronRight, Download, X, Plus, Calendar, Target,
  BookOpen, LayoutDashboard, Share2, Shield, Megaphone, Mail, Phone
} from 'lucide-react';

// --- Types ---
type ViewState = 'overview' | 'directory' | 'departments' | 'careers' | 'documents';

interface Resource {
  id: string;
  title: string;
  type: 'PDF' | 'Policy' | 'Template';
  size?: string;
  date: string;
  description: string;
}

interface NewsItem {
  id: string;
  title: string;
  category: 'Announcement' | 'Event' | 'Update';
  date: string;
  author: string;
}

// --- Mock Data ---
const RESOURCES: Resource[] = [
  { id: '1', title: 'Employee Handbook 2025', type: 'PDF', size: '4.2 MB', date: 'Jan 02, 2025', description: 'Comprehensive guide to company policies and culture.' },
  { id: '2', title: 'Brand Identity Guidelines', type: 'PDF', size: '12.5 MB', date: 'Nov 15, 2025', description: 'Logos, typography, and color usage rules.' },
  { id: '3', title: 'Expense Reimbursement Form', type: 'Template', size: '0.5 MB', date: 'Dec 01, 2025', description: 'Standard template for submitting business expenses.' },
  { id: '4', title: 'IT Security Policy', type: 'Policy', size: '1.8 MB', date: 'Oct 20, 2025', description: 'Guidelines for data protection and device usage.' },
];

const NEWS: NewsItem[] = [
  { id: '1', title: 'Q4 All-Hands Meeting Scheduled', category: 'Event', date: 'Dec 15, 2025', author: 'Sarah Jenkins' },
  { id: '2', title: 'New Health Benefits Portal Live', category: 'Announcement', date: 'Dec 10, 2025', author: 'HR Team' },
  { id: '3', title: 'Athena Platform v2.0 Launch', category: 'Update', date: 'Dec 05, 2025', author: 'Product Team' },
];

// --- Components ---
const FileViewer = ({ resource, onClose }: { resource: Resource; onClose: () => void }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
    <div className="bg-white rounded-2xl w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">{resource.title}</h3>
            <p className="text-xs text-slate-500">{resource.type} • {resource.size}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
            <FileText className="w-10 h-10 text-slate-300" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">{resource.title}</h2>
          <p className="text-slate-500 mb-8 max-w-md">
            This is a preview of the document. In a real application, the PDF or content would be rendered here.
          </p>
          <div className="p-6 bg-indigo-50 rounded-xl border border-indigo-100 max-w-sm w-full">
            <h4 className="font-bold text-indigo-900 mb-2">Document Summary</h4>
            <p className="text-sm text-indigo-700">{resource.description}</p>
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
      <div className="absolute top-0 right-0 w-2/3 h-full bg-linear-to-l from-indigo-900/40 to-transparent" />
      
      <div className="relative z-10 max-w-2xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 backdrop-blur-sm mb-6">
          <Building2 className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-bold text-indigo-100 uppercase tracking-wider">Company Portal</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
          Building the future, <span className="text-indigo-500">Together.</span>
        </h1>
        <p className="text-lg text-slate-300 mb-8">
          Access company resources, connect with colleagues, and stay updated on Athena's mission.
        </p>
        <div className="flex flex-wrap gap-4">
          <button onClick={() => onNavigate('directory')} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors flex items-center gap-2">
            Find Colleague <ArrowRight className="w-4 h-4" />
          </button>
          <button onClick={() => onNavigate('documents')} className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-colors backdrop-blur-sm">
            View Policies
          </button>
        </div>
      </div>
    </div>

    {/* Quick Stats */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">Growing</span>
        </div>
        <div className="text-3xl font-bold text-slate-900 mb-1">1,240</div>
        <div className="text-sm text-slate-500">Team Members</div>
      </div>
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
            <Globe className="w-5 h-5 text-purple-600" />
          </div>
          <span className="text-xs font-bold text-slate-500">Global</span>
        </div>
        <div className="text-3xl font-bold text-slate-900 mb-1">12</div>
        <div className="text-sm text-slate-500">Office Locations</div>
      </div>
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-emerald-600" />
          </div>
          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">Hiring</span>
        </div>
        <div className="text-3xl font-bold text-slate-900 mb-1">45</div>
        <div className="text-sm text-slate-500">Open Positions</div>
      </div>
    </div>

    {/* News & Resources Grid */}
    <div className="grid lg:grid-cols-3 gap-8">
      {/* News Feed */}
      <div className="lg:col-span-2 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Company News</h2>
          <button className="text-sm font-bold text-indigo-600 hover:text-indigo-700">View Archive</button>
        </div>
        <div className="space-y-4">
          {NEWS.map((item) => (
            <div key={item.id} className="bg-white p-4 rounded-xl border border-slate-200 flex items-start gap-4">
              <div className="w-12 h-12 bg-indigo-50 rounded-lg flex items-center justify-center shrink-0">
                <Megaphone className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{item.category}</span>
                  <span className="text-xs text-slate-400">• {item.date}</span>
                </div>
                <h3 className="font-bold text-slate-900 mb-1">{item.title}</h3>
                <p className="text-sm text-slate-500">Posted by {item.author}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Resources */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Key Documents</h2>
        </div>
        <div className="space-y-3">
          {RESOURCES.slice(0, 3).map((resource) => (
            <div 
              key={resource.id}
              onClick={() => onSelectResource(resource)}
              className="group bg-white p-3 rounded-xl border border-slate-200 hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer flex items-center gap-3"
            >
              <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center group-hover:bg-indigo-50 transition-colors shrink-0">
                <FileText className="w-5 h-5 text-slate-400 group-hover:text-indigo-500 transition-colors" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-slate-900 text-sm truncate group-hover:text-indigo-700 transition-colors">{resource.title}</h3>
                <p className="text-xs text-slate-500">{resource.type}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-400" />
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

export default function CompanyPage() {
  const [currentView, setCurrentView] = useState<ViewState>('overview');
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex">
      {/* Sidebar Navigation */}
      <div className="w-64 bg-white border-r border-slate-200 hidden lg:flex flex-col p-4 sticky top-0 h-screen">
        <div className="mb-8 px-4 pt-4">
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-xl">
            <Building2 className="w-6 h-6" />
            <span>Company</span>
          </div>
        </div>
        
        <nav className="space-y-1 flex-1">
          <button onClick={() => setCurrentView('overview')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'overview' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-600 hover:bg-slate-100'}`}><LayoutDashboard className="w-5 h-5" /><span className="font-medium">Overview</span></button>
          <button onClick={() => setCurrentView('directory')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'directory' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-600 hover:bg-slate-100'}`}><Users className="w-5 h-5" /><span className="font-medium">Directory</span></button>
          <button onClick={() => setCurrentView('departments')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'departments' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-600 hover:bg-slate-100'}`}><Share2 className="w-5 h-5" /><span className="font-medium">Departments</span></button>
          <button onClick={() => setCurrentView('careers')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'careers' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-600 hover:bg-slate-100'}`}><Briefcase className="w-5 h-5" /><span className="font-medium">Careers</span></button>
          <button onClick={() => setCurrentView('documents')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'documents' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-600 hover:bg-slate-100'}`}><BookOpen className="w-5 h-5" /><span className="font-medium">Documents</span></button>
        </nav>

        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 mt-4">
          <h4 className="font-bold text-slate-900 mb-2 text-sm">HR Support</h4>
          <p className="text-xs text-slate-500 mb-3">Questions about benefits or policies?</p>
          <button className="w-full py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50">
            Contact HR
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
