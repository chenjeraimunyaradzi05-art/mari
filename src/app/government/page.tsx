'use client';

import React, { useState } from 'react';
import { 
  Landmark, FileText, Award, ArrowRight, CheckCircle,
  Scale, GraduationCap, Search, Filter,
  ChevronRight, Download, X, Plus, Calendar, Target,
  BookOpen, LayoutDashboard, Share2
} from 'lucide-react';// --- Types ---
type ViewState = 'overview' | 'programs' | 'grants' | 'policy' | 'plans';

interface Resource {
  id: string;
  title: string;
  type: 'PDF' | 'Video' | 'Article';
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
  { id: '1', title: 'Grant Writing Guide 2025', type: 'PDF', size: '2.4 MB', date: 'Dec 10, 2025', description: 'Comprehensive guide to securing federal and state funding.' },
  { id: '2', title: 'Public Sector Leadership Framework', type: 'PDF', size: '1.8 MB', date: 'Nov 28, 2025', description: 'Core competencies for women in government leadership.' },
  { id: '3', title: 'Policy Advocacy Toolkit', type: 'PDF', size: '3.1 MB', date: 'Dec 05, 2025', description: 'Strategies for effective legislative advocacy and lobbying.' },
  { id: '4', title: 'Global Women Leaders Report', type: 'PDF', size: '5.2 MB', date: 'Oct 15, 2025', description: 'Annual report on the state of women in global politics.' },
];

const PLANS: Plan[] = [
  { id: '1', title: 'Campaign Launch Strategy', status: 'In Progress', progress: 65, dueDate: 'Jan 15, 2026', tasks: 12 },
  { id: '2', title: 'Community Outreach Program', status: 'Not Started', progress: 0, dueDate: 'Feb 01, 2026', tasks: 8 },
  { id: '3', title: 'Policy Research Initiative', status: 'Completed', progress: 100, dueDate: 'Nov 30, 2025', tasks: 5 },
];

const PROGRAMS = [
  { title: 'Executive Leadership Academy', duration: '6 Weeks', level: 'Advanced', spots: 5 },
  { title: 'Campaign Management 101', duration: '4 Weeks', level: 'Beginner', spots: 12 },
  { title: 'Public Speaking for Leaders', duration: '2 Days', level: 'Intermediate', spots: 8 },
];

const GRANTS = [
  { title: 'Women in STEM Innovation', amount: '$50,000', deadline: 'Jan 30, 2026', agency: 'National Science Foundation' },
  { title: 'Community Development Block Grant', amount: '$25,000', deadline: 'Feb 15, 2026', agency: 'Dept. of Housing' },
  { title: 'Small Business Growth Fund', amount: '$10,000', deadline: 'Rolling', agency: 'SBA' },
];

// --- Views ---

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
          <Landmark className="w-4 h-4 text-rose-400" />
          <span className="text-xs font-bold text-rose-100 uppercase tracking-wider">Government Dashboard</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
          Welcome back, <span className="text-rose-500">Leader.</span>
        </h1>
        <p className="text-lg text-slate-300 mb-8">
          Track your progress, manage your campaigns, and access exclusive resources for women in government.
        </p>
        <div className="flex flex-wrap gap-4">
          <button onClick={() => onNavigate('plans')} className="px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition-colors flex items-center gap-2">
            View My Plans <ArrowRight className="w-4 h-4" />
          </button>
          <button onClick={() => onNavigate('programs')} className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-colors backdrop-blur-sm">
            Browse Programs
          </button>
        </div>
      </div>
    </div>

    {/* Quick Stats */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
            <Target className="w-5 h-5 text-blue-600" />
          </div>
          <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">+12%</span>
        </div>
        <div className="text-3xl font-bold text-slate-900 mb-1">3</div>
        <div className="text-sm text-slate-500">Active Plans</div>
      </div>
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-purple-600" />
          </div>
          <span className="text-xs font-bold text-slate-500">Total</span>
        </div>
        <div className="text-3xl font-bold text-slate-900 mb-1">12</div>
        <div className="text-sm text-slate-500">Resources Accessed</div>
      </div>
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
            <Award className="w-5 h-5 text-amber-600" />
          </div>
          <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-full">Pending</span>
        </div>
        <div className="text-3xl font-bold text-slate-900 mb-1">2</div>
        <div className="text-sm text-slate-500">Grant Applications</div>
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

interface PlansViewProps {
  onNewPlan: () => void;
}

const PlansView = ({ onNewPlan }: PlansViewProps) => (
  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">My Strategic Plans</h2>
        <p className="text-slate-500">Manage your campaigns and leadership initiatives.</p>
      </div>
      <button 
        onClick={onNewPlan}
        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold flex items-center gap-2 transition-colors"
      >
        <Plus className="w-4 h-4" /> New Plan
      </button>
    </div>

    <div className="grid gap-4">
      {PLANS.map((plan) => (
        <div key={plan.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                plan.status === 'Completed' ? 'bg-green-100 text-green-600' :
                plan.status === 'In Progress' ? 'bg-blue-100 text-blue-600' :
                'bg-slate-100 text-slate-600'
              }`}>
                <Target className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-900">{plan.title}</h3>
                <div className="flex items-center gap-3 text-sm text-slate-500">
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Due {plan.dueDate}</span>
                  <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3" /> {plan.tasks} Tasks</span>
                </div>
              </div>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
              plan.status === 'Completed' ? 'bg-green-100 text-green-700' :
              plan.status === 'In Progress' ? 'bg-blue-100 text-blue-700' :
              'bg-slate-100 text-slate-700'
            }`}>
              {plan.status}
            </span>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm font-medium">
              <span className="text-slate-600">Progress</span>
              <span className="text-slate-900">{plan.progress}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-1000 ${
                  plan.status === 'Completed' ? 'bg-green-500' : 'bg-rose-500'
                }`} 
                style={{ width: `${plan.progress}%` }} 
              />
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button className="flex-1 px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold rounded-lg transition-colors">
              View Details
            </button>
            <button className="flex-1 px-4 py-2 border border-slate-200 hover:border-rose-200 text-slate-600 hover:text-rose-600 font-bold rounded-lg transition-colors">
              Edit Plan
            </button>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const ProgramsView = () => (
  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Leadership Programs</h2>
        <p className="text-slate-500">Training and mentorship opportunities.</p>
      </div>
      <div className="flex gap-2">
        <button className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600">
          <Filter className="w-5 h-5" />
        </button>
        <button className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600">
          <Search className="w-5 h-5" />
        </button>
      </div>
    </div>

    <div className="grid md:grid-cols-2 gap-6">
      {PROGRAMS.map((program, i) => (
        <div key={i} className="bg-white p-6 rounded-xl border border-slate-200 hover:border-rose-200 hover:shadow-lg transition-all group">
          <div className="w-12 h-12 bg-rose-100 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <GraduationCap className="w-6 h-6 text-rose-600" />
          </div>
          <h3 className="font-bold text-xl text-slate-900 mb-2">{program.title}</h3>
          <div className="flex flex-wrap gap-2 mb-6">
            <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-md">{program.duration}</span>
            <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-md">{program.level}</span>
            <span className="px-2 py-1 bg-rose-50 text-rose-600 text-xs font-bold rounded-md">{program.spots} Spots Left</span>
          </div>
          <button className="w-full py-2.5 bg-slate-900 hover:bg-rose-600 text-white font-bold rounded-lg transition-colors">
            Apply Now
          </button>
        </div>
      ))}
    </div>
  </div>
);

const GrantsView = () => (
  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Grants & Funding</h2>
        <p className="text-slate-500">Financial support for your initiatives.</p>
      </div>
    </div>

    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <table className="w-full text-left">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="p-4 font-bold text-slate-700 text-sm">Grant Name</th>
            <th className="p-4 font-bold text-slate-700 text-sm">Agency</th>
            <th className="p-4 font-bold text-slate-700 text-sm">Amount</th>
            <th className="p-4 font-bold text-slate-700 text-sm">Deadline</th>
            <th className="p-4 font-bold text-slate-700 text-sm">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {GRANTS.map((grant, i) => (
            <tr key={i} className="hover:bg-slate-50 transition-colors">
              <td className="p-4 font-bold text-slate-900">{grant.title}</td>
              <td className="p-4 text-slate-600">{grant.agency}</td>
              <td className="p-4 font-bold text-green-600">{grant.amount}</td>
              <td className="p-4 text-slate-600">{grant.deadline}</td>
              <td className="p-4">
                <button className="text-rose-600 font-bold text-sm hover:underline">View Details</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

interface PolicyViewProps {
  onSelectResource: (resource: Resource) => void;
}

const PolicyView = ({ onSelectResource }: PolicyViewProps) => (
  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Policy & Advocacy</h2>
        <p className="text-slate-500">Latest updates and advocacy tools.</p>
      </div>
    </div>

    <div className="space-y-4">
      {[1, 2, 3].map((_, i) => (
        <div key={i} className="bg-white p-6 rounded-xl border border-slate-200 flex gap-6">
          <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
            <Scale className="w-8 h-8 text-slate-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-xs font-bold rounded-full">New Legislation</span>
              <span className="text-xs text-slate-400">2 days ago</span>
            </div>
            <h3 className="font-bold text-lg text-slate-900 mb-2">Women&apos;s Health Equity Act 2025</h3>
            <p className="text-slate-600 mb-4">
              A comprehensive bill aimed at closing the gender gap in medical research and healthcare access.
            </p>
            <div className="flex gap-4">
              <button 
                onClick={() => onSelectResource(RESOURCES[0])}
                className="text-sm font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1"
              >
                Read Full Text <ArrowRight className="w-4 h-4" />
              </button>
              <button className="text-sm font-bold text-slate-600 hover:text-slate-700 flex items-center gap-1">
                <Share2 className="w-4 h-4" /> Share
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default function GovernmentPage() {
  const [currentView, setCurrentView] = useState<ViewState>('overview');
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [showNewPlanModal, setShowNewPlanModal] = useState(false);



  // --- Views ---


  // --- Main Render ---
  return (
    <div className="min-h-screen bg-slate-50 font-sans flex">
      {/* Sidebar Navigation */}
      <div className="w-64 bg-white border-r border-slate-200 hidden lg:flex flex-col p-4 sticky top-0 h-screen">
        <div className="mb-8 px-4 pt-4">
          <div className="flex items-center gap-2 text-rose-600 font-bold text-xl">
            <Landmark className="w-6 h-6" />
            <span>Government</span>
          </div>
        </div>
        
        <nav className="space-y-1 flex-1">
          <button onClick={() => setCurrentView('overview')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'overview' ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20' : 'text-slate-600 hover:bg-slate-100'}`}><LayoutDashboard className="w-5 h-5" /><span className="font-medium">Overview</span></button>
          <button onClick={() => setCurrentView('plans')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'plans' ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20' : 'text-slate-600 hover:bg-slate-100'}`}><Target className="w-5 h-5" /><span className="font-medium">My Plans</span></button>
          <button onClick={() => setCurrentView('programs')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'programs' ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20' : 'text-slate-600 hover:bg-slate-100'}`}><GraduationCap className="w-5 h-5" /><span className="font-medium">Programs</span></button>
          <button onClick={() => setCurrentView('grants')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'grants' ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20' : 'text-slate-600 hover:bg-slate-100'}`}><Award className="w-5 h-5" /><span className="font-medium">Grants & Funding</span></button>
          <button onClick={() => setCurrentView('policy')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'policy' ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20' : 'text-slate-600 hover:bg-slate-100'}`}><Scale className="w-5 h-5" /><span className="font-medium">Policy & Advocacy</span></button>
        </nav>

        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 mt-4">
          <h4 className="font-bold text-slate-900 mb-2 text-sm">Need Help?</h4>
          <p className="text-xs text-slate-500 mb-3">Contact our support team for guidance.</p>
          <button className="w-full py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50">
            Contact Support
          </button>
        </div>
      </div>

      {/* Mobile Nav (Simple) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-2 flex justify-around z-40">
        <button onClick={() => setCurrentView('overview')} className={`p-2 rounded-lg ${currentView === 'overview' ? 'text-rose-600' : 'text-slate-400'}`}><LayoutDashboard /></button>
        <button onClick={() => setCurrentView('plans')} className={`p-2 rounded-lg ${currentView === 'plans' ? 'text-rose-600' : 'text-slate-400'}`}><Target /></button>
        <button onClick={() => setCurrentView('programs')} className={`p-2 rounded-lg ${currentView === 'programs' ? 'text-rose-600' : 'text-slate-400'}`}><GraduationCap /></button>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 md:p-8 pb-24 lg:pb-8 overflow-y-auto h-screen">
        {currentView === 'overview' && <OverviewView onSelectResource={setSelectedResource} onNavigate={setCurrentView} />}
        {currentView === 'plans' && <PlansView onNewPlan={() => setShowNewPlanModal(true)} />}
        {currentView === 'programs' && <ProgramsView />}
        {currentView === 'grants' && <GrantsView />}
        {currentView === 'policy' && <PolicyView onSelectResource={setSelectedResource} />}
      </div>

      {/* Modals */}
      {selectedResource && (
        <FileViewer resource={selectedResource} onClose={() => setSelectedResource(null)} />
      )}
      
      {showNewPlanModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full animate-in zoom-in-95 duration-200">
            <h3 className="text-2xl font-bold text-slate-900 mb-4">Create New Plan</h3>
            <p className="text-slate-600 mb-6">Start a new strategic initiative or campaign plan.</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowNewPlanModal(false)}
                className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-50 rounded-lg"
              >
                Cancel
              </button>
              <button 
                onClick={() => setShowNewPlanModal(false)}
                className="px-4 py-2 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700"
              >
                Create Plan
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
