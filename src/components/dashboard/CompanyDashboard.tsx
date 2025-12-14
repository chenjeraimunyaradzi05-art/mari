'use client';

import React from 'react';
import { 
  Activity, 
  Clock, 
  AlertCircle, 
  Layers, 
  BarChart3, 
  TrendingUp 
} from 'lucide-react';

export default function CompanyDashboard() {
  // Mock Data
  const onboardingProgress = 65;
  const aiMetrics = [
    { label: 'Successful AI calls (24h)', value: '1,240', trend: '+12%', icon: Activity, color: 'bg-emerald-500' },
    { label: 'Average response time', value: '145ms', trend: '-5ms', icon: Clock, color: 'bg-indigo-500' },
    { label: 'Fallback rate', value: '0.8%', trend: '-0.2%', icon: AlertCircle, color: 'bg-amber-500' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-slate-900">Company Dashboard</h1>
        <p className="text-slate-600">Overview of your recruitment operations and AI performance.</p>
      </div>

      {/* Onboarding Progress */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-pink-600">Onboarding Progress</h3>
          <span className="text-sm font-bold text-slate-600">{onboardingProgress}% Complete</span>
        </div>
        <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-linear-to-r from-pink-500 to-purple-600 rounded-full transition-all duration-1000 ease-out"
            style={{ width: `${onboardingProgress}%` }}
          ></div>
        </div>
      </div>

      {/* AI Hero Card */}
      <div className="rounded-[2rem] p-8 text-white shadow-xl relative overflow-hidden bg-linear-to-br from-pink-600 via-purple-600 to-indigo-600">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Layers className="w-64 h-64" />
        </div>
        
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-xs font-bold uppercase tracking-widest mb-4">
              <Layers className="w-3 h-3" />
              AI Warmup Signals
            </span>
            <h2 className="text-3xl font-bold mb-4">Operational Health Overview</h2>
            <p className="text-white/80 mb-6 max-w-md leading-relaxed">
              Stay informed on how our AI services are performing without exposing member or company identifiers. Metrics update continuously from anonymised telemetry.
            </p>
            
            <div className="flex items-center gap-4">
              <div className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 backdrop-blur-sm">
                <span className="block text-2xl font-bold">98.5%</span>
                <span className="text-xs text-white/70 uppercase tracking-wider">Uptime</span>
              </div>
              <div className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 backdrop-blur-sm">
                <span className="block text-2xl font-bold">Active</span>
                <span className="text-xs text-white/70 uppercase tracking-wider">Status</span>
              </div>
            </div>
          </div>
          
          <div className="hidden lg:flex justify-center">
            <div className="w-32 h-32 rounded-full bg-white/10 flex items-center justify-center animate-pulse">
              <Activity className="w-16 h-16 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {aiMetrics.map((metric, idx) => (
          <div key={idx} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white ${metric.color}`}>
                <metric.icon className="w-6 h-6" />
              </div>
              <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                <TrendingUp className="w-3 h-3" />
                {metric.trend}
              </span>
            </div>
            <h3 className="text-3xl font-bold text-slate-900 mb-1">{metric.value}</h3>
            <p className="text-sm text-slate-500 font-medium uppercase tracking-wide">{metric.label}</p>
          </div>
        ))}
      </div>

      {/* Recent Activity Placeholder */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-bold text-slate-900">Recent Activity</h3>
          <button className="text-sm font-bold text-indigo-600 hover:text-indigo-700">View All</button>
        </div>
        <div className="p-6">
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <BarChart3 className="w-5 h-5 text-slate-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">New candidate match found for Senior Developer role</p>
                  <p className="text-xs text-slate-500 mt-1">2 hours ago</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
