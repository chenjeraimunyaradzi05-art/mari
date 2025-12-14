'use client';

import React, { useState } from 'react';
import { 
  GraduationCap, Users, Calendar, Clock, 
  Search, Filter, Star, MessageSquare, 
  Video, CheckCircle, XCircle, MoreHorizontal, 
  LayoutDashboard, BookOpen, Award, Zap,
  ArrowRight, UserCheck, MapPin
} from 'lucide-react';

// --- Types ---
type ViewState = 'find-mentor' | 'my-mentorships' | 'schedule' | 'resources';

interface Mentor {
  id: string;
  name: string;
  role: string;
  company: string;
  avatar: string;
  expertise: string[];
  rating: number;
  reviews: number;
  availability: string;
  isAvailable: boolean;
}

interface Session {
  id: string;
  mentorName: string;
  topic: string;
  date: string;
  time: string;
  status: 'upcoming' | 'completed' | 'cancelled';
  type: 'video' | 'audio';
}

// --- Mock Data ---
const MENTORS: Mentor[] = [
  {
    id: '1',
    name: 'Elena Rodriguez',
    role: 'VP of Engineering',
    company: 'TechFlow',
    avatar: 'ER',
    expertise: ['Leadership', 'System Design', 'Scaling Teams'],
    rating: 4.9,
    reviews: 42,
    availability: '2 slots left this week',
    isAvailable: true
  },
  {
    id: '2',
    name: 'David Kim',
    role: 'Senior Product Manager',
    company: 'Innovate Inc.',
    avatar: 'DK',
    expertise: ['Product Strategy', 'User Research', 'Agile'],
    rating: 4.8,
    reviews: 28,
    availability: 'Fully booked',
    isAvailable: false
  },
  {
    id: '3',
    name: 'Sarah Jenkins',
    role: 'Staff Frontend Engineer',
    company: 'Creative Pulse',
    avatar: 'SJ',
    expertise: ['React', 'Performance', 'Accessibility'],
    rating: 5.0,
    reviews: 15,
    availability: 'Available tomorrow',
    isAvailable: true
  },
  {
    id: '4',
    name: 'Michael Chen',
    role: 'CTO',
    company: 'StartupX',
    avatar: 'MC',
    expertise: ['Fundraising', 'Technical Strategy', 'Hiring'],
    rating: 4.7,
    reviews: 56,
    availability: 'Available next week',
    isAvailable: true
  }
];

const UPCOMING_SESSIONS: Session[] = [
  {
    id: '1',
    mentorName: 'Elena Rodriguez',
    topic: 'Career Growth Strategy',
    date: 'Today',
    time: '2:00 PM',
    status: 'upcoming',
    type: 'video'
  },
  {
    id: '2',
    mentorName: 'Sarah Jenkins',
    topic: 'Code Review Best Practices',
    date: 'Thu, Dec 14',
    time: '10:00 AM',
    status: 'upcoming',
    type: 'video'
  }
];

// --- Components ---

const MentorCard = ({ mentor }: { mentor: Mentor }) => (
  <div className="bg-white p-6 rounded-2xl border border-slate-200 hover:shadow-md transition-all group cursor-pointer flex flex-col h-full">
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 bg-teal-100 rounded-full flex items-center justify-center text-teal-700 font-bold text-xl">
          {mentor.avatar}
        </div>
        <div>
          <h3 className="font-bold text-slate-900 group-hover:text-teal-600 transition-colors">{mentor.name}</h3>
          <p className="text-xs text-slate-500">{mentor.role} at {mentor.company}</p>
        </div>
      </div>
      <div className="flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-lg border border-amber-100">
        <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
        <span className="text-xs font-bold text-amber-700">{mentor.rating}</span>
        <span className="text-[10px] text-amber-600/70">({mentor.reviews})</span>
      </div>
    </div>
    
    <div className="flex flex-wrap gap-2 mb-6 flex-1 content-start">
      {mentor.expertise.map((skill, i) => (
        <span key={i} className="px-2 py-1 bg-slate-50 text-slate-500 rounded-md text-xs font-medium border border-slate-100">
          {skill}
        </span>
      ))}
    </div>

    <div className="pt-4 border-t border-slate-100 mt-auto">
      <div className="flex items-center justify-between mb-4">
        <span className={`text-xs font-medium flex items-center gap-1.5 ${mentor.isAvailable ? 'text-emerald-600' : 'text-slate-400'}`}>
          <div className={`w-2 h-2 rounded-full ${mentor.isAvailable ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
          {mentor.availability}
        </span>
      </div>
      <button 
        disabled={!mentor.isAvailable}
        className={`w-full py-2.5 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 ${
          mentor.isAvailable 
            ? 'bg-teal-600 text-white hover:bg-teal-700 shadow-lg shadow-teal-600/20' 
            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
        }`}
      >
        {mentor.isAvailable ? 'Book Session' : 'Join Waitlist'}
      </button>
    </div>
  </div>
);

const SessionCard = ({ session }: { session: Session }) => (
  <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between hover:border-teal-200 transition-colors">
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 bg-teal-50 rounded-xl flex flex-col items-center justify-center text-teal-600 shrink-0">
        <Calendar className="w-5 h-5 mb-0.5" />
      </div>
      <div>
        <h4 className="font-bold text-slate-900 text-sm">{session.topic}</h4>
        <p className="text-xs text-slate-500">with <span className="font-medium text-teal-600">{session.mentorName}</span></p>
        <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {session.time}</span>
          <span>•</span>
          <span>{session.date}</span>
        </div>
      </div>
    </div>
    <button className="px-4 py-2 bg-teal-600 text-white rounded-lg text-xs font-bold hover:bg-teal-700 transition-colors flex items-center gap-2">
      <Video className="w-3 h-3" /> Join
    </button>
  </div>
);

const FindMentorView = () => (
  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
    {/* Hero Section */}
    <div className="relative bg-slate-900/50 rounded-3xl overflow-hidden p-8 md:p-12">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
      <div className="absolute top-0 right-0 w-2/3 h-full bg-linear-to-l from-teal-900/40 to-transparent" />
      
      <div className="relative z-10 max-w-2xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 border border-teal-500/30 backdrop-blur-sm mb-6">
          <Award className="w-4 h-4 text-teal-400" />
          <span className="text-xs font-bold text-teal-100 uppercase tracking-wider">Career Growth</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
          Master your craft with<br/>
          <span className="text-teal-500">Expert Guidance.</span>
        </h1>
        <p className="text-lg text-slate-300 mb-8">
          Connect with industry leaders for 1-on-1 mentorship, code reviews, and career advice.
        </p>
        
        <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md p-2 rounded-xl border border-white/10 max-w-md">
          <Search className="w-5 h-5 text-slate-400 ml-2" />
          <input 
            type="text" 
            placeholder="Search by role, company, or skill..." 
            className="bg-transparent border-none text-white placeholder-slate-400 focus:ring-0 w-full"
          />
        </div>
      </div>
    </div>

    <div className="grid lg:grid-cols-3 gap-8">
      {/* Mentor Grid */}
      <div className="lg:col-span-2 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Recommended Mentors</h2>
          <button className="text-sm font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1">
            Filter <Filter className="w-4 h-4" />
          </button>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {MENTORS.map((mentor) => (
            <MentorCard key={mentor.id} mentor={mentor} />
          ))}
        </div>
      </div>

      {/* Sidebar Widgets */}
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200">
          <h3 className="font-bold text-slate-900 mb-4">Your Schedule</h3>
          <div className="space-y-4">
            {UPCOMING_SESSIONS.map((session) => (
              <SessionCard key={session.id} session={session} />
            ))}
            {UPCOMING_SESSIONS.length === 0 && (
              <div className="text-center py-8 text-slate-500 text-sm">
                No upcoming sessions.
              </div>
            )}
          </div>
          <button className="w-full mt-4 py-2 text-teal-600 text-sm font-bold hover:bg-teal-50 rounded-lg transition-colors">
            View Full Calendar
          </button>
        </div>

        <div className="bg-teal-900 p-6 rounded-2xl text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-teal-800 rounded-full -mr-16 -mt-16 opacity-50" />
          <div className="relative z-10">
            <h3 className="font-bold text-lg mb-2">Become a Mentor</h3>
            <p className="text-teal-200 text-sm mb-4">Share your knowledge and help others grow. Earn badges and community recognition.</p>
            <button className="w-full py-2 bg-white text-teal-900 rounded-lg text-sm font-bold hover:bg-teal-50 transition-colors">
              Apply Now
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default function MentorshipPage() {
  const [currentView, setCurrentView] = useState<ViewState>('find-mentor');

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-slate-200 hidden lg:flex flex-col p-4 sticky top-0 h-screen">
        <div className="mb-8 px-4 pt-4">
          <div className="flex items-center gap-2 text-teal-600 font-bold text-xl">
            <GraduationCap className="w-6 h-6" />
            <span>Mentorship</span>
          </div>
        </div>
        
        <nav className="space-y-1 flex-1">
          <button onClick={() => setCurrentView('find-mentor')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'find-mentor' ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/20' : 'text-slate-600 hover:bg-slate-100'}`}>
            <Search className="w-5 h-5" /><span className="font-medium">Find Mentor</span>
          </button>
          <button onClick={() => setCurrentView('my-mentorships')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'my-mentorships' ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/20' : 'text-slate-600 hover:bg-slate-100'}`}>
            <Users className="w-5 h-5" /><span className="font-medium">My Mentors</span>
          </button>
          <button onClick={() => setCurrentView('schedule')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'schedule' ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/20' : 'text-slate-600 hover:bg-slate-100'}`}>
            <Calendar className="w-5 h-5" /><span className="font-medium">Schedule</span>
          </button>
          <button onClick={() => setCurrentView('resources')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'resources' ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/20' : 'text-slate-600 hover:bg-slate-100'}`}>
            <BookOpen className="w-5 h-5" /><span className="font-medium">Resources</span>
          </button>
        </nav>

        <div className="p-4 bg-teal-50 rounded-xl border border-teal-100 mt-4">
          <div className="flex items-center gap-2 text-teal-900 font-bold mb-1">
            <Zap className="w-4 h-4" /> Quick Match
          </div>
          <p className="text-xs text-teal-700 mb-3">Let AI find the perfect mentor for your current goals.</p>
          <button className="w-full py-2 bg-white border border-teal-200 rounded-lg text-xs font-bold text-teal-700 hover:bg-white/50">
            Start Matching
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 md:p-8 overflow-y-auto h-screen">
        {currentView === 'find-mentor' && <FindMentorView />}
        
        {currentView !== 'find-mentor' && (
          <div className="flex items-center justify-center h-full text-slate-500">
            <div className="text-center">
              <GraduationCap className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-bold text-slate-900">Coming Soon</h3>
              <p>This section is under development.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}