'use client';

import React, { useState } from 'react';
import { 
  BarChart3, PieChart, TrendingUp, Globe, 
  Leaf, Users, Target, Download, Share2, 
  Calendar, ArrowUpRight, ArrowDownRight, 
  LayoutDashboard, FileText, Settings, Zap,
  Activity, Heart, Award
} from 'lucide-react';

// --- Types ---
type ViewState = 'overview' | 'reports' | 'goals' | 'settings';

interface ImpactMetric {
  id: string;
  label: string;
  value: string;
  change: string;
  trend: 'up' | 'down' | 'neutral';
  icon: React.ElementType;
  color: string;
}

interface Report {
  id: string;
  title: string;
  date: string;
  type: 'Monthly' | 'Quarterly' | 'Annual';
  status: 'Ready' | 'Processing';
}

// --- Mock Data ---
const METRICS: ImpactMetric[] = [
  {
    id: '1',
    label: 'Carbon Offset',
    value: '12.5 tons',
    change: '+15%',
    trend: 'up',
    icon: Leaf,
    color: 'text-emerald-600 bg-emerald-50'
  },
  {
    id: '2',
    label: 'Community Reach',
    value: '45,200',
    change: '+8.2%',
    trend: 'up',
    icon: Users,
    color: 'text-blue-600 bg-blue-50'
  },
  {
    id: '3',
    label: 'Social Value',
    value: '$1.2M',
    change: '+22%',
    trend: 'up',
    icon: Heart,
    color: 'text-rose-600 bg-rose-50'
  },
  {
    id: '4',
    label: 'Active Projects',
    value: '24',
    change: '-2',
    trend: 'down',
    icon: Activity,
    color: 'text-amber-600 bg-amber-50'
  }
];

const RECENT_REPORTS: Report[] = [
  { id: '1', title: 'Q3 Sustainability Report', date: 'Oct 15, 2025', type: 'Quarterly', status: 'Ready' },
  { id: '2', title: 'September Impact Summary', date: 'Oct 01, 2025', type: 'Monthly', status: 'Ready' },
  { id: '3', title: 'Annual Social Audit 2024', date: 'Jan 10, 2025', type: 'Annual', status: 'Ready' },
];

// --- Components ---

const MetricCard = ({ metric }: { metric: ImpactMetric }) => (
  <div className="bg-white p-6 rounded-2xl border border-slate-200 hover:shadow-md transition-all">
    <div className="flex items-center justify-between mb-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${metric.color}`}>
        <metric.icon className="w-6 h-6" />
      </div>
      <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${
        metric.trend === 'up' ? 'bg-emerald-50 text-emerald-600' : 
        metric.trend === 'down' ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-600'
      }`}>
        {metric.trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : 
         metric.trend === 'down' ? <ArrowDownRight className="w-3 h-3" /> : null}
        {metric.change}
      </div>
    </div>
    <div className="text-3xl font-bold text-slate-900 mb-1">{metric.value}</div>
    <div className="text-sm text-slate-500">{metric.label}</div>
  </div>
);

const ReportRow = ({ report }: { report: Report }) => (
  <div className="flex items-center justify-between p-4 hover:bg-slate-50 rounded-xl transition-colors border-b border-slate-100 last:border-0">
    <div className="flex items-center gap-4">
      <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500">
        <FileText className="w-5 h-5" />
      </div>
      <div>
        <h4 className="font-bold text-slate-900 text-sm">{report.title}</h4>
        <p className="text-xs text-slate-500">{report.type} • {report.date}</p>
      </div>
    </div>
    <button className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
      <Download className="w-5 h-5" />
    </button>
  </div>
);

const OverviewView = () => (
  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
    {/* Hero Section */}
    <div className="relative bg-slate-900/50 rounded-3xl overflow-hidden p-8 md:p-12">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
      <div className="absolute top-0 right-0 w-2/3 h-full bg-linear-to-l from-emerald-900/40 to-transparent" />
      
      <div className="relative z-10 max-w-2xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 backdrop-blur-sm mb-6">
          <Globe className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold text-emerald-100 uppercase tracking-wider">Global Impact</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
          Measure what matters.<br/>
          <span className="text-emerald-500">Change the world.</span>
        </h1>
        <p className="text-lg text-slate-300 mb-8">
          Track your organization's social, environmental, and economic impact in real-time.
        </p>
        
        <div className="flex flex-wrap gap-3">
          <button className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-colors flex items-center gap-2">
            <Download className="w-4 h-4" /> Download Report
          </button>
          <button className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-colors backdrop-blur-sm flex items-center gap-2">
            <Share2 className="w-4 h-4" /> Share Dashboard
          </button>
        </div>
      </div>
    </div>

    {/* Metrics Grid */}
    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
      {METRICS.map((metric) => (
        <MetricCard key={metric.id} metric={metric} />
      ))}
    </div>

    <div className="grid lg:grid-cols-3 gap-8">
      {/* Main Chart Area */}
      <div className="lg:col-span-2 space-y-8">
        <div className="bg-white p-6 rounded-2xl border border-slate-200">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-900">Impact Trends</h2>
            <select className="bg-slate-50 border border-slate-200 rounded-lg text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500/20">
              <option>Last 12 Months</option>
              <option>Year to Date</option>
              <option>All Time</option>
            </select>
          </div>
          
          {/* Placeholder Chart */}
          <div className="h-64 w-full bg-slate-50 rounded-xl flex items-end justify-between p-4 gap-2">
            {[40, 65, 45, 80, 55, 70, 85, 60, 75, 90, 65, 80].map((h, i) => (
              <div key={i} className="w-full bg-emerald-100 rounded-t-md relative group hover:bg-emerald-200 transition-colors" style={{ height: `${h}%` }}>
                <div className="absolute bottom-0 w-full bg-emerald-500 rounded-t-md transition-all duration-500" style={{ height: `${h * 0.6}%` }} />
                <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs py-1 px-2 rounded pointer-events-none whitespace-nowrap">
                  Value: {h}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-4 text-xs text-slate-400 font-medium uppercase">
            <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span>
            <span>Jul</span><span>Aug</span><span>Sep</span><span>Oct</span><span>Nov</span><span>Dec</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200">
          <h2 className="text-xl font-bold text-slate-900 mb-6">Recent Reports</h2>
          <div className="space-y-2">
            {RECENT_REPORTS.map((report) => (
              <ReportRow key={report.id} report={report} />
            ))}
          </div>
          <button className="w-full mt-4 py-2 text-emerald-600 text-sm font-bold hover:bg-emerald-50 rounded-lg transition-colors">
            View All Reports
          </button>
        </div>
      </div>

      {/* Sidebar Widgets */}
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200">
          <h3 className="font-bold text-slate-900 mb-4">Impact Goals</h3>
          <div className="space-y-6">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium text-slate-700">Reduce Emissions</span>
                <span className="font-bold text-emerald-600">75%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5">
                <div className="bg-emerald-500 h-2.5 rounded-full w-[75%]" />
              </div>
              <p className="text-xs text-slate-500 mt-1">Target: 20 tons by Q4</p>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium text-slate-700">Community Growth</span>
                <span className="font-bold text-blue-600">42%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5">
                <div className="bg-blue-500 h-2.5 rounded-full w-[42%]" />
              </div>
              <p className="text-xs text-slate-500 mt-1">Target: 100k members</p>
            </div>
          </div>
          <button className="w-full mt-6 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-50 transition-colors flex items-center justify-center gap-2">
            <Target className="w-4 h-4" /> Set New Goal
          </button>
        </div>

        <div className="bg-emerald-900 p-6 rounded-2xl text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-800 rounded-full -mr-16 -mt-16 opacity-50" />
          <div className="relative z-10">
            <h3 className="font-bold text-lg mb-2">Impact Certification</h3>
            <p className="text-emerald-200 text-sm mb-4">Get certified for your sustainable practices and display the badge.</p>
            <button className="w-full py-2 bg-white text-emerald-900 rounded-lg text-sm font-bold hover:bg-emerald-50 transition-colors flex items-center justify-center gap-2">
              <Award className="w-4 h-4" /> Apply Now
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default function ImpactPage() {
  const [currentView, setCurrentView] = useState<ViewState>('overview');

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-slate-200 hidden lg:flex flex-col p-4 sticky top-0 h-screen">
        <div className="mb-8 px-4 pt-4">
          <div className="flex items-center gap-2 text-emerald-600 font-bold text-xl">
            <BarChart3 className="w-6 h-6" />
            <span>Impact Hub</span>
          </div>
        </div>
        
        <nav className="space-y-1 flex-1">
          <button onClick={() => setCurrentView('overview')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'overview' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'text-slate-600 hover:bg-slate-100'}`}>
            <LayoutDashboard className="w-5 h-5" /><span className="font-medium">Overview</span>
          </button>
          <button onClick={() => setCurrentView('reports')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'reports' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'text-slate-600 hover:bg-slate-100'}`}>
            <FileText className="w-5 h-5" /><span className="font-medium">Reports</span>
          </button>
          <button onClick={() => setCurrentView('goals')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'goals' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'text-slate-600 hover:bg-slate-100'}`}>
            <Target className="w-5 h-5" /><span className="font-medium">Goals</span>
          </button>
          <button onClick={() => setCurrentView('settings')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'settings' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'text-slate-600 hover:bg-slate-100'}`}>
            <Settings className="w-5 h-5" /><span className="font-medium">Settings</span>
          </button>
        </nav>

        <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 mt-4">
          <div className="flex items-center gap-2 text-emerald-900 font-bold mb-1">
            <Zap className="w-4 h-4" /> Live Data
          </div>
          <p className="text-xs text-emerald-700 mb-3">Connect your data sources for real-time tracking.</p>
          <button className="w-full py-2 bg-white border border-emerald-200 rounded-lg text-xs font-bold text-emerald-700 hover:bg-white/50">
            Connect API
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 md:p-8 overflow-y-auto h-screen">
        {currentView === 'overview' && <OverviewView />}
        
        {currentView !== 'overview' && (
          <div className="flex items-center justify-center h-full text-slate-500">
            <div className="text-center">
              <BarChart3 className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-bold text-slate-900">Coming Soon</h3>
              <p>This section is under development.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}