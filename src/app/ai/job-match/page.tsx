'use client';

import React, { useState } from 'react';
import { 
  Briefcase, Sparkles, CheckCircle, ArrowRight, MapPin,
  DollarSign, Search, Filter, UserCheck,
  ChevronRight, Download, X, Plus, Calendar, Building2,
  LayoutDashboard, Share2, Bookmark, Star, Clock
} from 'lucide-react';

// --- Types ---
type ViewState = 'overview' | 'matches' | 'saved' | 'applications' | 'preferences';

interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  salary: string;
  type: 'Full-time' | 'Contract' | 'Remote';
  matchScore: number;
  posted: string;
  description: string;
  skills: string[];
}

interface MatchStat {
  id: string;
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
}

// --- Mock Data ---
const JOBS: Job[] = [
  { 
    id: '1', 
    title: 'Senior Frontend Engineer', 
    company: 'TechFlow Solutions', 
    location: 'Remote', 
    salary: '$140k - $180k', 
    type: 'Full-time', 
    matchScore: 98, 
    posted: '2 days ago',
    description: 'We are looking for an experienced React developer to lead our core product team. You will be responsible for architectural decisions and mentoring junior developers.',
    skills: ['React', 'TypeScript', 'Node.js', 'AWS']
  },
  { 
    id: '2', 
    title: 'Product Designer', 
    company: 'Creative Pulse', 
    location: 'New York, NY', 
    salary: '$120k - $150k', 
    type: 'Full-time', 
    matchScore: 85, 
    posted: '1 week ago',
    description: 'Join our award-winning design team. We need someone with a strong portfolio in UI/UX and a passion for user-centric design.',
    skills: ['Figma', 'Prototyping', 'User Research']
  },
  { 
    id: '3', 
    title: 'Data Scientist', 
    company: 'DataMind Analytics', 
    location: 'San Francisco, CA', 
    salary: '$160k - $200k', 
    type: 'Full-time', 
    matchScore: 92, 
    posted: '3 days ago',
    description: 'Help us build the next generation of predictive models. You will work with large datasets to uncover hidden patterns and trends.',
    skills: ['Python', 'Machine Learning', 'SQL', 'TensorFlow']
  },
  { 
    id: '4', 
    title: 'DevOps Engineer', 
    company: 'CloudScale Inc.', 
    location: 'Remote', 
    salary: '$130k - $160k', 
    type: 'Contract', 
    matchScore: 78, 
    posted: '5 days ago',
    description: 'We need a DevOps expert to streamline our CI/CD pipelines and manage our cloud infrastructure.',
    skills: ['Docker', 'Kubernetes', 'Jenkins', 'Azure']
  },
];

const STATS: MatchStat[] = [
  { id: '1', label: 'Perfect Matches', value: '12', icon: Sparkles, color: 'text-purple-600 bg-purple-50' },
  { id: '2', label: 'Applications', value: '5', icon: Briefcase, color: 'text-blue-600 bg-blue-50' },
  { id: '3', label: 'Interviews', value: '2', icon: UserCheck, color: 'text-emerald-600 bg-emerald-50' },
];

// --- Components ---
const JobViewer = ({ job, onClose }: { job: Job; onClose: () => void }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
    <div className="bg-white rounded-2xl w-full max-w-3xl h-[85vh] flex flex-col shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">{job.title}</h3>
            <p className="text-xs text-slate-500">{job.company} • {job.location}</p>
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
      <div className="flex-1 bg-slate-50 p-8 overflow-y-auto">
        <div className="bg-white p-8 rounded-2xl shadow-sm mb-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">{job.title}</h1>
              <div className="flex items-center gap-4 text-sm text-slate-500">
                <span className="flex items-center gap-1"><Building2 className="w-4 h-4" /> {job.company}</span>
                <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {job.location}</span>
                <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {job.posted}</span>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-1 text-purple-600 font-bold text-lg">
                <Sparkles className="w-5 h-5" />
                <span>{job.matchScore}% Match</span>
              </div>
              <span className="text-sm text-slate-500">AI Confidence</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-8">
            {job.skills.map((skill, i) => (
              <span key={i} className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-sm font-medium">
                {skill}
              </span>
            ))}
          </div>

          <h3 className="font-bold text-slate-900 mb-3">About the Role</h3>
          <p className="text-slate-600 leading-relaxed mb-6">
            {job.description}
          </p>
          
          <h3 className="font-bold text-slate-900 mb-3">Compensation</h3>
          <p className="text-slate-600 font-medium flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-600" />
            {job.salary} • {job.type}
          </p>
        </div>
      </div>
      <div className="p-4 border-t border-slate-100 bg-white flex justify-end gap-3">
        <button onClick={onClose} className="px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-colors">
          Save for Later
        </button>
        <button className="px-6 py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-colors flex items-center gap-2">
          Apply Now <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
);

interface OverviewViewProps {
  onSelectJob: (job: Job) => void;
  onNavigate: (view: ViewState) => void;
}

const OverviewView = ({ onSelectJob, onNavigate }: OverviewViewProps) => (
  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
    {/* Hero Card */}
    <div className="relative bg-slate-900/50 rounded-3xl overflow-hidden p-8 md:p-12">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
      <div className="absolute top-0 right-0 w-2/3 h-full bg-linear-to-l from-purple-900/40 to-transparent" />
      
      <div className="relative z-10 max-w-2xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 backdrop-blur-sm mb-6">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span className="text-xs font-bold text-purple-100 uppercase tracking-wider">AI Job Match</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
          Your perfect role is <span className="text-purple-500">Waiting.</span>
        </h1>
        <p className="text-lg text-slate-300 mb-8">
          Our AI analyzes your skills, experience, and preferences to find opportunities where you'll thrive.
        </p>
        <div className="flex flex-wrap gap-4">
          <button onClick={() => onNavigate('matches')} className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition-colors flex items-center gap-2">
            View Matches <ArrowRight className="w-4 h-4" />
          </button>
          <button onClick={() => onNavigate('preferences')} className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-colors backdrop-blur-sm">
            Edit Preferences
          </button>
        </div>
      </div>
    </div>

    {/* Quick Stats */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {STATS.map((stat) => (
        <div key={stat.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${stat.color.split(' ')[1]}`}>
              <stat.icon className={`w-5 h-5 ${stat.color.split(' ')[0]}`} />
            </div>
            <span className="text-xs font-bold text-slate-500">This Week</span>
          </div>
          <div className="text-3xl font-bold text-slate-900 mb-1">{stat.value}</div>
          <div className="text-sm text-slate-500">{stat.label}</div>
        </div>
      ))}
    </div>

    {/* Job Matches */}
    <div className="grid lg:grid-cols-3 gap-8">
      {/* Top Matches */}
      <div className="lg:col-span-2 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Top Recommendations</h2>
          <button className="text-sm font-bold text-purple-600 hover:text-purple-700">View All</button>
        </div>
        <div className="space-y-4">
          {JOBS.map((job) => (
            <div 
              key={job.id}
              onClick={() => onSelectJob(job)}
              className="group bg-white p-5 rounded-xl border border-slate-200 hover:border-purple-200 hover:shadow-md transition-all cursor-pointer flex flex-col md:flex-row gap-5"
            >
              <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-purple-50 transition-colors">
                <Building2 className="w-6 h-6 text-slate-400 group-hover:text-purple-500 transition-colors" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-bold text-slate-900 group-hover:text-purple-700 transition-colors">{job.title}</h3>
                  <div className="flex items-center gap-1 text-purple-600 font-bold text-sm">
                    <Sparkles className="w-3 h-3" />
                    <span>{job.matchScore}%</span>
                  </div>
                </div>
                <p className="text-sm text-slate-500 mb-3">{job.company} • {job.location}</p>
                <div className="flex flex-wrap gap-2">
                  {job.skills.slice(0, 3).map((skill, i) => (
                    <span key={i} className="px-2 py-0.5 bg-slate-50 text-slate-500 rounded-md text-xs font-medium border border-slate-100">
                      {skill}
                    </span>
                  ))}
                  {job.skills.length > 3 && (
                    <span className="px-2 py-0.5 bg-slate-50 text-slate-400 rounded-md text-xs font-medium border border-slate-100">
                      +{job.skills.length - 3}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end justify-between border-l border-slate-100 pl-5 ml-2 hidden md:flex">
                <span className="text-sm font-bold text-slate-700">{job.salary}</span>
                <span className="text-xs text-slate-400">{job.posted}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sidebar Widgets */}
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200">
          <h3 className="font-bold text-slate-900 mb-4">Match Criteria</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-600">Skills Match</span>
                <span className="font-bold text-purple-600">95%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-purple-600 h-2 rounded-full w-[95%]" />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-600">Experience Level</span>
                <span className="font-bold text-purple-600">88%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-purple-600 h-2 rounded-full w-[88%]" />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-600">Salary Expectations</span>
                <span className="font-bold text-purple-600">100%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-purple-600 h-2 rounded-full w-full" />
              </div>
            </div>
          </div>
          <button className="w-full mt-6 py-2 bg-slate-50 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-100 transition-colors">
            Update Profile
          </button>
        </div>

        <div className="p-6 bg-purple-900 rounded-2xl text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-800 rounded-full -mr-16 -mt-16 opacity-50" />
          <div className="relative z-10">
            <h3 className="font-bold text-lg mb-2">Resume Review</h3>
            <p className="text-purple-200 text-sm mb-4">Get AI-powered feedback on your resume to improve your match score.</p>
            <button className="w-full py-2 bg-white text-purple-900 rounded-lg text-sm font-bold hover:bg-purple-50 transition-colors">
              Upload Resume
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default function JobMatchPage() {
  const [currentView, setCurrentView] = useState<ViewState>('overview');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex">
      {/* Sidebar Navigation */}
      <div className="w-64 bg-white border-r border-slate-200 hidden lg:flex flex-col p-4 sticky top-0 h-screen">
        <div className="mb-8 px-4 pt-4">
          <div className="flex items-center gap-2 text-purple-600 font-bold text-xl">
            <Sparkles className="w-6 h-6" />
            <span>Job Match</span>
          </div>
        </div>
        
        <nav className="space-y-1 flex-1">
          <button onClick={() => setCurrentView('overview')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'overview' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'text-slate-600 hover:bg-slate-100'}`}><LayoutDashboard className="w-5 h-5" /><span className="font-medium">Overview</span></button>
          <button onClick={() => setCurrentView('matches')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'matches' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'text-slate-600 hover:bg-slate-100'}`}><Briefcase className="w-5 h-5" /><span className="font-medium">Matches</span></button>
          <button onClick={() => setCurrentView('saved')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'saved' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'text-slate-600 hover:bg-slate-100'}`}><Bookmark className="w-5 h-5" /><span className="font-medium">Saved Jobs</span></button>
          <button onClick={() => setCurrentView('applications')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'applications' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'text-slate-600 hover:bg-slate-100'}`}><CheckCircle className="w-5 h-5" /><span className="font-medium">Applications</span></button>
          <button onClick={() => setCurrentView('preferences')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'preferences' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'text-slate-600 hover:bg-slate-100'}`}><UserCheck className="w-5 h-5" /><span className="font-medium">Preferences</span></button>
        </nav>

        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 mt-4">
          <h4 className="font-bold text-slate-900 mb-2 text-sm">Job Alerts</h4>
          <p className="text-xs text-slate-500 mb-3">Get notified when new matches are found.</p>
          <button className="w-full py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50">
            Manage Alerts
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 md:p-8 pb-24 lg:pb-8 overflow-y-auto h-screen">
        {currentView === 'overview' && <OverviewView onSelectJob={setSelectedJob} onNavigate={setCurrentView} />}
        {/* Placeholders for other views */}
        {currentView !== 'overview' && (
          <div className="flex items-center justify-center h-full text-slate-500">
            View content coming soon...
          </div>
        )}
      </div>

      {/* Modals */}
      {selectedJob && (
        <JobViewer job={selectedJob} onClose={() => setSelectedJob(null)} />
      )}
    </div>
  );
}