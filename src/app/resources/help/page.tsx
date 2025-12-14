'use client';

import React, { useState } from 'react';
import { 
  LifeBuoy, FileText, MessageCircle, ArrowRight, CheckCircle,
  HelpCircle, Search, Filter, Phone,
  ChevronRight, Download, X, Plus, Calendar, Target,
  LayoutDashboard, Share2, Mail, Clock, ThumbsUp
} from 'lucide-react';

// --- Types ---
type ViewState = 'overview' | 'tickets' | 'faq' | 'contact' | 'status';

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
  views: number;
}

interface Ticket {
  id: string;
  subject: string;
  status: 'Open' | 'In Progress' | 'Resolved';
  lastUpdated: string;
  priority: 'Low' | 'Medium' | 'High';
}

// --- Mock Data ---
const FAQS: FAQ[] = [
  { id: '1', question: 'How do I reset my password?', answer: 'Go to settings > security > password reset.', category: 'Account', views: 1240 },
  { id: '2', question: 'Where can I find my billing invoices?', answer: 'Invoices are located in the Billing section of your dashboard.', category: 'Billing', views: 850 },
  { id: '3', question: 'How do I invite team members?', answer: 'Admins can invite users via the Team Management page.', category: 'Team', views: 620 },
  { id: '4', question: 'Is there an API available?', answer: 'Yes, check our developer documentation for API keys and endpoints.', category: 'Technical', views: 430 },
];

const TICKETS: Ticket[] = [
  { id: 'T-1024', subject: 'Integration error with Salesforce', status: 'In Progress', lastUpdated: '2 hours ago', priority: 'High' },
  { id: 'T-1023', subject: 'Billing cycle question', status: 'Open', lastUpdated: '5 hours ago', priority: 'Medium' },
  { id: 'T-1020', subject: 'Feature request: Dark mode', status: 'Resolved', lastUpdated: '1 day ago', priority: 'Low' },
];

// --- Components ---
const TicketViewer = ({ ticket, onClose }: { ticket: Ticket; onClose: () => void }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
    <div className="bg-white rounded-2xl w-full max-w-2xl flex flex-col shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-sky-100 rounded-lg flex items-center justify-center">
            <LifeBuoy className="w-5 h-5 text-sky-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">{ticket.id}</h3>
            <p className="text-xs text-slate-500">{ticket.status} • {ticket.priority} Priority</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="p-8 bg-slate-50">
        <h2 className="text-xl font-bold text-slate-900 mb-4">{ticket.subject}</h2>
        <div className="bg-white p-4 rounded-xl border border-slate-200 mb-4">
          <p className="text-slate-600 text-sm">
            This is a placeholder for the ticket conversation history. In a real app, you would see messages between the user and support agent here.
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50">
            Add Reply
          </button>
          <button className="px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-bold hover:bg-sky-700">
            Mark Resolved
          </button>
        </div>
      </div>
    </div>
  </div>
);

interface OverviewViewProps {
  onSelectTicket: (ticket: Ticket) => void;
  onNavigate: (view: ViewState) => void;
}

const OverviewView = ({ onSelectTicket, onNavigate }: OverviewViewProps) => (
  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
    {/* Hero Card */}
    <div className="relative bg-slate-900/50 rounded-3xl overflow-hidden p-8 md:p-12">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
      <div className="absolute top-0 right-0 w-2/3 h-full bg-linear-to-l from-sky-900/40 to-transparent" />
      
      <div className="relative z-10 max-w-2xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/20 border border-sky-500/30 backdrop-blur-sm mb-6">
          <LifeBuoy className="w-4 h-4 text-sky-400" />
          <span className="text-xs font-bold text-sky-100 uppercase tracking-wider">Help Center</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
          How can we <span className="text-sky-500">help you?</span>
        </h1>
        <div className="relative max-w-lg mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search for answers..." 
            className="w-full pl-12 pr-4 py-4 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-slate-400 focus:outline-none focus:bg-white/20 focus:border-sky-500 transition-all backdrop-blur-sm"
          />
        </div>
        <div className="flex flex-wrap gap-4">
          <button onClick={() => onNavigate('tickets')} className="px-6 py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold transition-colors flex items-center gap-2">
            My Tickets <ArrowRight className="w-4 h-4" />
          </button>
          <button onClick={() => onNavigate('contact')} className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-colors backdrop-blur-sm">
            Contact Support
          </button>
        </div>
      </div>
    </div>

    {/* Quick Stats */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="w-10 h-10 bg-sky-50 rounded-lg flex items-center justify-center">
            <Clock className="w-5 h-5 text-sky-600" />
          </div>
          <span className="text-xs font-bold text-sky-600 bg-sky-50 px-2 py-1 rounded-full">Fast</span>
        </div>
        <div className="text-3xl font-bold text-slate-900 mb-1">&lt; 2h</div>
        <div className="text-sm text-slate-500">Avg. Response Time</div>
      </div>
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
            <ThumbsUp className="w-5 h-5 text-emerald-600" />
          </div>
          <span className="text-xs font-bold text-slate-500">Rating</span>
        </div>
        <div className="text-3xl font-bold text-slate-900 mb-1">98%</div>
        <div className="text-sm text-slate-500">Customer Satisfaction</div>
      </div>
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-purple-600" />
          </div>
          <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded-full">Online</span>
        </div>
        <div className="text-3xl font-bold text-slate-900 mb-1">12</div>
        <div className="text-sm text-slate-500">Agents Available</div>
      </div>
    </div>

    {/* Content Grid */}
    <div className="grid lg:grid-cols-3 gap-8">
      {/* Popular FAQs */}
      <div className="lg:col-span-2 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Popular Articles</h2>
          <button className="text-sm font-bold text-sky-600 hover:text-sky-700">View Knowledge Base</button>
        </div>
        <div className="space-y-4">
          {FAQS.map((faq) => (
            <div key={faq.id} className="bg-white p-4 rounded-xl border border-slate-200 hover:border-sky-200 hover:shadow-sm transition-all cursor-pointer group">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-sky-50 transition-colors">
                  <HelpCircle className="w-4 h-4 text-slate-400 group-hover:text-sky-500" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-slate-900 mb-1 group-hover:text-sky-700 transition-colors">{faq.question}</h3>
                  <p className="text-sm text-slate-500 line-clamp-1">{faq.answer}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-sky-400 self-center" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Tickets */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Recent Tickets</h2>
          <button className="text-sm font-bold text-sky-600 hover:text-sky-700">View All</button>
        </div>
        <div className="space-y-3">
          {TICKETS.map((ticket) => (
            <div 
              key={ticket.id}
              onClick={() => onSelectTicket(ticket)}
              className="bg-white p-4 rounded-xl border border-slate-200 hover:border-sky-200 hover:shadow-sm transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500">{ticket.id}</span>
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                  ticket.status === 'Open' ? 'bg-blue-50 text-blue-600' :
                  ticket.status === 'In Progress' ? 'bg-amber-50 text-amber-600' :
                  'bg-emerald-50 text-emerald-600'
                }`}>
                  {ticket.status}
                </span>
              </div>
              <h3 className="font-bold text-slate-900 text-sm mb-2">{ticket.subject}</h3>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>{ticket.lastUpdated}</span>
                <span className={ticket.priority === 'High' ? 'text-rose-500 font-bold' : ''}>{ticket.priority}</span>
              </div>
            </div>
          ))}
        </div>
        
        <div className="p-6 bg-sky-50 rounded-2xl border border-sky-100">
          <h3 className="font-bold text-sky-900 mb-2">Still need help?</h3>
          <p className="text-sky-700 text-sm mb-4">Our support team is available 24/7 to assist you.</p>
          <button className="w-full py-2 bg-sky-600 text-white rounded-lg text-sm font-bold hover:bg-sky-700 transition-colors">
            Start Live Chat
          </button>
        </div>
      </div>
    </div>
  </div>
);

export default function HelpPage() {
  const [currentView, setCurrentView] = useState<ViewState>('overview');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex">
      {/* Sidebar Navigation */}
      <div className="w-64 bg-white border-r border-slate-200 hidden lg:flex flex-col p-4 sticky top-0 h-screen">
        <div className="mb-8 px-4 pt-4">
          <div className="flex items-center gap-2 text-sky-600 font-bold text-xl">
            <LifeBuoy className="w-6 h-6" />
            <span>Help Center</span>
          </div>
        </div>
        
        <nav className="space-y-1 flex-1">
          <button onClick={() => setCurrentView('overview')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'overview' ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/20' : 'text-slate-600 hover:bg-slate-100'}`}><LayoutDashboard className="w-5 h-5" /><span className="font-medium">Overview</span></button>
          <button onClick={() => setCurrentView('tickets')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'tickets' ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/20' : 'text-slate-600 hover:bg-slate-100'}`}><MessageCircle className="w-5 h-5" /><span className="font-medium">My Tickets</span></button>
          <button onClick={() => setCurrentView('faq')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'faq' ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/20' : 'text-slate-600 hover:bg-slate-100'}`}><HelpCircle className="w-5 h-5" /><span className="font-medium">FAQ</span></button>
          <button onClick={() => setCurrentView('contact')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'contact' ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/20' : 'text-slate-600 hover:bg-slate-100'}`}><Phone className="w-5 h-5" /><span className="font-medium">Contact Us</span></button>
          <button onClick={() => setCurrentView('status')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'status' ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/20' : 'text-slate-600 hover:bg-slate-100'}`}><CheckCircle className="w-5 h-5" /><span className="font-medium">System Status</span></button>
        </nav>

        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 mt-4">
          <h4 className="font-bold text-slate-900 mb-2 text-sm">Emergency?</h4>
          <p className="text-xs text-slate-500 mb-3">Call our priority line for critical issues.</p>
          <button className="w-full py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50">
            +1 (800) 555-0123
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 md:p-8 pb-24 lg:pb-8 overflow-y-auto h-screen">
        {currentView === 'overview' && <OverviewView onSelectTicket={setSelectedTicket} onNavigate={setCurrentView} />}
        {/* Placeholders for other views */}
        {currentView !== 'overview' && (
          <div className="flex items-center justify-center h-full text-slate-500">
            View content coming soon...
          </div>
        )}
      </div>

      {/* Modals */}
      {selectedTicket && (
        <TicketViewer ticket={selectedTicket} onClose={() => setSelectedTicket(null)} />
      )}
    </div>
  );
}