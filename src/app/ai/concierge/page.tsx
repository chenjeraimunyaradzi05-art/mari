'use client';

import React, { useState } from 'react';
import { 
  MessageSquare, Sparkles, Calendar, Clock, 
  CheckCircle, ArrowRight, Search, Bell, 
  User, Settings, LayoutDashboard, Zap, 
  Send, Paperclip, Mic, Bot, MoreHorizontal,
  FileText, Briefcase, Coffee
} from 'lucide-react';

// --- Types ---
type ViewState = 'dashboard' | 'chat' | 'tasks' | 'calendar';

interface Task {
  id: string;
  title: string;
  status: 'in-progress' | 'completed' | 'pending';
  type: 'scheduling' | 'research' | 'communication';
  time: string;
}

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  time: string;
  attachments?: string[];
}

// --- Mock Data ---
const ACTIVE_TASKS: Task[] = [
  {
    id: '1',
    title: 'Drafting follow-up email to TechFlow',
    status: 'in-progress',
    type: 'communication',
    time: '2 mins remaining'
  },
  {
    id: '2',
    title: 'Analyzing salary trends for Senior Dev',
    status: 'completed',
    type: 'research',
    time: 'Just now'
  },
  {
    id: '3',
    title: 'Scheduling interview with Sarah Chen',
    status: 'pending',
    type: 'scheduling',
    time: 'Waiting for confirmation'
  }
];

const CHAT_HISTORY: Message[] = [
  {
    id: '1',
    sender: 'ai',
    text: "Good morning! I noticed you have an interview coming up on Thursday. Would you like me to prepare a briefing document on the company?",
    time: '9:00 AM'
  },
  {
    id: '2',
    sender: 'user',
    text: "Yes, that would be great. Also, can you find their recent engineering blog posts?",
    time: '9:05 AM'
  },
  {
    id: '3',
    sender: 'ai',
    text: "Absolutely. I've started compiling the briefing. I found 3 recent articles about their migration to Next.js. I'll include summaries in the doc.",
    time: '9:06 AM'
  }
];

// --- Components ---

const TaskCard = ({ task }: { task: Task }) => (
  <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between hover:shadow-sm transition-shadow">
    <div className="flex items-center gap-4">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
        task.type === 'communication' ? 'bg-blue-50 text-blue-600' :
        task.type === 'research' ? 'bg-purple-50 text-purple-600' :
        'bg-rose-50 text-rose-600'
      }`}>
        {task.type === 'communication' ? <MessageSquare className="w-5 h-5" /> :
         task.type === 'research' ? <Search className="w-5 h-5" /> :
         <Calendar className="w-5 h-5" />}
      </div>
      <div>
        <h4 className="font-bold text-slate-900 text-sm">{task.title}</h4>
        <p className="text-xs text-slate-500 flex items-center gap-1">
          {task.status === 'in-progress' && <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />}
          {task.status === 'completed' && <CheckCircle className="w-3 h-3 text-emerald-500" />}
          {task.status === 'pending' && <Clock className="w-3 h-3 text-slate-400" />}
          <span className="capitalize">{task.status.replace('-', ' ')}</span> • {task.time}
        </p>
      </div>
    </div>
    <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600">
      <MoreHorizontal className="w-5 h-5" />
    </button>
  </div>
);

const ChatInterface = () => (
  <div className="flex flex-col h-[600px] bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
    <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-rose-600 rounded-full flex items-center justify-center shadow-lg shadow-rose-600/20">
          <Bot className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900">Concierge AI</h3>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-xs text-slate-500 font-medium">Online & Ready</span>
          </div>
        </div>
      </div>
      <button className="p-2 hover:bg-slate-200 rounded-lg text-slate-500">
        <MoreHorizontal className="w-5 h-5" />
      </button>
    </div>

    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30">
      {CHAT_HISTORY.map((msg) => (
        <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[80%] rounded-2xl p-4 ${
            msg.sender === 'user' 
              ? 'bg-rose-600 text-white rounded-tr-none shadow-lg shadow-rose-600/10' 
              : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none shadow-sm'
          }`}>
            <p className="text-sm leading-relaxed">{msg.text}</p>
            <div className={`text-[10px] mt-2 font-medium ${msg.sender === 'user' ? 'text-rose-100' : 'text-slate-400'}`}>
              {msg.time}
            </div>
          </div>
        </div>
      ))}
    </div>

    <div className="p-4 bg-white border-t border-slate-100">
      <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200 focus-within:border-rose-300 focus-within:ring-4 focus-within:ring-rose-100 transition-all">
        <button className="p-2 hover:bg-slate-200 rounded-lg text-slate-400 transition-colors">
          <Paperclip className="w-5 h-5" />
        </button>
        <input 
          type="text" 
          placeholder="Ask me anything..." 
          className="flex-1 bg-transparent border-none focus:ring-0 text-slate-900 placeholder-slate-400"
        />
        <button className="p-2 hover:bg-slate-200 rounded-lg text-slate-400 transition-colors">
          <Mic className="w-5 h-5" />
        </button>
        <button className="p-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-md shadow-rose-600/20 transition-colors">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
);

const DashboardView = () => (
  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
    {/* Hero Section */}
    <div className="relative bg-slate-900/50 rounded-3xl overflow-hidden p-8 md:p-12">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
      <div className="absolute top-0 right-0 w-2/3 h-full bg-linear-to-l from-rose-900/40 to-transparent" />
      
      <div className="relative z-10 max-w-2xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/30 backdrop-blur-sm mb-6">
          <Sparkles className="w-4 h-4 text-rose-400" />
          <span className="text-xs font-bold text-rose-100 uppercase tracking-wider">Personal Assistant</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
          Good afternoon, <span className="text-rose-500">Alex.</span><br/>
          How can I help you today?
        </h1>
        
        <div className="flex flex-wrap gap-3">
          <button className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg text-sm text-white backdrop-blur-sm transition-colors flex items-center gap-2">
            <Calendar className="w-4 h-4" /> Schedule a meeting
          </button>
          <button className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg text-sm text-white backdrop-blur-sm transition-colors flex items-center gap-2">
            <Search className="w-4 h-4" /> Research a company
          </button>
          <button className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg text-sm text-white backdrop-blur-sm transition-colors flex items-center gap-2">
            <FileText className="w-4 h-4" /> Update my resume
          </button>
        </div>
      </div>
    </div>

    <div className="grid lg:grid-cols-3 gap-8">
      {/* Active Tasks */}
      <div className="lg:col-span-2 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Active Tasks</h2>
          <button className="text-sm font-bold text-rose-600 hover:text-rose-700">View All</button>
        </div>
        <div className="space-y-4">
          {ACTIVE_TASKS.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>

        <div className="mt-8">
          <h2 className="text-xl font-bold text-slate-900 mb-6">Suggestions for You</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-5 bg-indigo-50 rounded-2xl border border-indigo-100 hover:shadow-md transition-shadow cursor-pointer">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                <Briefcase className="w-5 h-5 text-indigo-600" />
              </div>
              <h3 className="font-bold text-slate-900 mb-2">New Job Match</h3>
              <p className="text-sm text-slate-600 mb-4">A "Senior Frontend Engineer" role at TechFlow matches 98% of your profile.</p>
              <span className="text-xs font-bold text-indigo-600 flex items-center gap-1">View Details <ArrowRight className="w-3 h-3" /></span>
            </div>
            <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-100 hover:shadow-md transition-shadow cursor-pointer">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center mb-4">
                <Coffee className="w-5 h-5 text-emerald-600" />
              </div>
              <h3 className="font-bold text-slate-900 mb-2">Networking Event</h3>
              <p className="text-sm text-slate-600 mb-4">"React Summit" is happening next week online. Would you like to register?</p>
              <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">Register Now <ArrowRight className="w-3 h-3" /></span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Chat Widget */}
      <div className="lg:col-span-1">
        <ChatInterface />
      </div>
    </div>
  </div>
);

export default function ConciergePage() {
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-slate-200 hidden lg:flex flex-col p-4 sticky top-0 h-screen">
        <div className="mb-8 px-4 pt-4">
          <div className="flex items-center gap-2 text-rose-600 font-bold text-xl">
            <Bot className="w-6 h-6" />
            <span>Concierge</span>
          </div>
        </div>
        
        <nav className="space-y-1 flex-1">
          <button onClick={() => setCurrentView('dashboard')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'dashboard' ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20' : 'text-slate-600 hover:bg-slate-100'}`}>
            <LayoutDashboard className="w-5 h-5" /><span className="font-medium">Dashboard</span>
          </button>
          <button onClick={() => setCurrentView('chat')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'chat' ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20' : 'text-slate-600 hover:bg-slate-100'}`}>
            <MessageSquare className="w-5 h-5" /><span className="font-medium">Messages</span>
          </button>
          <button onClick={() => setCurrentView('tasks')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'tasks' ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20' : 'text-slate-600 hover:bg-slate-100'}`}>
            <CheckCircle className="w-5 h-5" /><span className="font-medium">My Tasks</span>
          </button>
          <button onClick={() => setCurrentView('calendar')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'calendar' ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20' : 'text-slate-600 hover:bg-slate-100'}`}>
            <Calendar className="w-5 h-5" /><span className="font-medium">Calendar</span>
          </button>
        </nav>

        <div className="p-4 bg-rose-50 rounded-xl border border-rose-100 mt-4">
          <div className="flex items-center gap-2 text-rose-900 font-bold mb-1">
            <Zap className="w-4 h-4" /> Priority Access
          </div>
          <p className="text-xs text-rose-700 mb-3">You have 24/7 access to our premium concierge agents.</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 md:p-8 overflow-y-auto h-screen">
        {currentView === 'dashboard' && <DashboardView />}
        
        {currentView !== 'dashboard' && (
          <div className="flex items-center justify-center h-full text-slate-500">
            <div className="text-center">
              <Bot className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-bold text-slate-900">Coming Soon</h3>
              <p>This section is under development.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}