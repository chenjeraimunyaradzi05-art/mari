'use client';

import React, { useState } from 'react';
import { 
  Plane, FileText, Award, ArrowRight, CheckCircle,
  Scale, GraduationCap, Search, Filter,
  ChevronRight, Download, X, Plus, Calendar, Target,
  BookOpen, LayoutDashboard, Share2, Clock, MapPin, Heart, Users
} from 'lucide-react';

// --- Types ---
type ViewState = 'overview' | 'roster' | 'travel' | 'wellbeing' | 'community';

interface Resource {
  id: string;
  title: string;
  type: 'PDF' | 'Video' | 'Guide';
  size?: string;
  date: string;
  description: string;
}

interface Plan {
  id: string;
  title: string;
  status: 'In Progress' | 'Completed' | 'Not Started';
  progress: number;
  dueDate: string;
  tasks: number;
}

// --- Mock Data ---
const RESOURCES: Resource[] = [
  { id: '1', title: 'FIFO Mental Health Guide', type: 'PDF', size: '1.5 MB', date: 'Dec 10, 2025', description: 'Strategies for maintaining mental wellbeing while away.' },
  { id: '2', title: 'Site Safety Protocols 2025', type: 'PDF', size: '3.2 MB', date: 'Nov 25, 2025', description: 'Updated safety regulations and emergency procedures.' },
  { id: '3', title: 'Financial Planning for FIFO', type: 'Guide', size: '2.1 MB', date: 'Dec 01, 2025', description: 'Managing high income and planning for the future.' },
  { id: '4', title: 'Family Connection Toolkit', type: 'PDF', size: '4.5 MB', date: 'Oct 20, 2025', description: 'Activities and tips for staying connected with family.' },
];

const PLANS: Plan[] = [
  { id: '1', title: 'Career Progression Plan', status: 'In Progress', progress: 60, dueDate: 'Jun 30, 2026', tasks: 10 },
  { id: '2', title: 'R&R Travel Itinerary', status: 'Not Started', progress: 0, dueDate: 'Feb 15, 2026', tasks: 5 },
  { id: '3', title: 'Certification Renewal', status: 'Completed', progress: 100, dueDate: 'Nov 15, 2025', tasks: 3 },
];

// --- Components ---
const FileViewer = ({ resource, onClose }: { resource: Resource; onClose: () => void }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
    <div className="bg-white rounded-2xl w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-rose-100 rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5 text-rose-600" />
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
          <div className="p-6 bg-rose-50 rounded-xl border border-rose-100 max-w-sm w-full">
            <h4 className="font-bold text-rose-900 mb-2">Document Summary</h4>
            <p className="text-sm text-rose-700">{resource.description}</p>
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
      <div className="absolute top-0 right-0 w-2/3 h-full bg-linear-to-l from-rose-900/40 to-transparent" />
      
      <div className="relative z-10 max-w-2xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/30 backdrop-blur-sm mb-6">
          <Plane className="w-4 h-4 text-rose-400" />
          <span className="text-xs font-bold text-rose-100 uppercase tracking-wider">FIFO Dashboard</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
          Welcome back, <span className="text-rose-500">Specialist.</span>
        </h1>
        <p className="text-lg text-slate-300 mb-8">
          Manage your roster, travel schedules, and wellbeing while working away.
        </p>
        <div className="flex flex-wrap gap-4">
          <button onClick={() => onNavigate('roster')} className="px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition-colors flex items-center gap-2">
            View Roster <ArrowRight className="w-4 h-4" />
          </button>
          <button onClick={() => onNavigate('wellbeing')} className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-colors backdrop-blur-sm">
            Wellbeing Hub
          </button>
        </div>
      </div>
    </div>

    {/* Quick Stats */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
            <Calendar className="w-5 h-5 text-blue-600" />
          </div>
          <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">On Swing</span>
        </div>
        <div className="text-3xl font-bold text-slate-900 mb-1">Day 5</div>
        <div className="text-sm text-slate-500">of 14 Days</div>
      </div>
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
            <Plane className="w-5 h-5 text-purple-600" />
          </div>
          <span className="text-xs font-bold text-slate-500">Next Flight</span>
        </div>
        <div className="text-3xl font-bold text-slate-900 mb-1">Dec 20</div>
        <div className="text-sm text-slate-500">06:30 AM - QF1234</div>
      </div>
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
            <Heart className="w-5 h-5 text-amber-600" />
          </div>
          <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-full">Check-in</span>
        </div>
        <div className="text-3xl font-bold text-slate-900 mb-1">Good</div>
        <div className="text-sm text-slate-500">Daily Wellbeing Score</div>
      </div>
    </div>

    {/* Featured Resources */}
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-900">Featured Resources</h2>
        <button className="text-sm font-bold text-rose-600 hover:text-rose-700">View All</button>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {RESOURCES.slice(0, 4).map((resource) => (
          <div 
            key={resource.id}
            onClick={() => onSelectResource(resource)}
            className="group bg-white p-4 rounded-xl border border-slate-200 hover:border-rose-200 hover:shadow-md transition-all cursor-pointer flex items-start gap-4"
          >
            <div className="w-12 h-12 bg-slate-50 rounded-lg flex items-center justify-center group-hover:bg-rose-50 transition-colors shrink-0">
              <FileText className="w-6 h-6 text-slate-400 group-hover:text-rose-500 transition-colors" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-slate-900 group-hover:text-rose-700 transition-colors mb-1">{resource.title}</h3>
              <p className="text-sm text-slate-500 line-clamp-2 mb-2">{resource.description}</p>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {resource.date}</span>
                <span className="flex items-center gap-1"><Download className="w-3 h-3" /> {resource.size}</span>
              </div>
            </div>
            <div className="self-center opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0">
              <ChevronRight className="w-5 h-5 text-rose-400" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default function FIFOPage() {
  const [currentView, setCurrentView] = useState<ViewState>('overview');
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex">
      {/* Sidebar Navigation */}
      <div className="w-64 bg-white border-r border-slate-200 hidden lg:flex flex-col p-4 sticky top-0 h-screen">
        <div className="mb-8 px-4 pt-4">
          <div className="flex items-center gap-2 text-rose-600 font-bold text-xl">
            <Plane className="w-6 h-6" />
            <span>FIFO Life</span>
          </div>
        </div>
        
        <nav className="space-y-1 flex-1">
          <button onClick={() => setCurrentView('overview')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'overview' ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20' : 'text-slate-600 hover:bg-slate-100'}`}><LayoutDashboard className="w-5 h-5" /><span className="font-medium">Overview</span></button>
          <button onClick={() => setCurrentView('roster')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'roster' ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20' : 'text-slate-600 hover:bg-slate-100'}`}><Calendar className="w-5 h-5" /><span className="font-medium">My Roster</span></button>
          <button onClick={() => setCurrentView('travel')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'travel' ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20' : 'text-slate-600 hover:bg-slate-100'}`}><Plane className="w-5 h-5" /><span className="font-medium">Travel</span></button>
          <button onClick={() => setCurrentView('wellbeing')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'wellbeing' ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20' : 'text-slate-600 hover:bg-slate-100'}`}><Heart className="w-5 h-5" /><span className="font-medium">Wellbeing</span></button>
          <button onClick={() => setCurrentView('community')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'community' ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20' : 'text-slate-600 hover:bg-slate-100'}`}><Users className="w-5 h-5" /><span className="font-medium">Community</span></button>
        </nav>

        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 mt-4">
          <h4 className="font-bold text-slate-900 mb-2 text-sm">Need Help?</h4>
          <p className="text-xs text-slate-500 mb-3">Contact our support team for guidance.</p>
          <button className="w-full py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50">
            Contact Support
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
