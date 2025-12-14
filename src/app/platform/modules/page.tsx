'use client';

import React, { useState } from 'react';
import { 
  Box, Layers, Cpu, Shield, Database, 
  Settings, Search, Filter, Plus, Download, 
  CheckCircle, AlertTriangle, RefreshCw, 
  LayoutDashboard, Zap, Globe, Lock,
  ToggleLeft, ToggleRight, MoreVertical
} from 'lucide-react';

// --- Types ---
type ViewState = 'installed' | 'marketplace' | 'updates' | 'settings';

interface Module {
  id: string;
  name: string;
  description: string;
  version: string;
  category: 'Core' | 'AI' | 'Social' | 'Analytics';
  status: 'active' | 'inactive' | 'update-available' | 'beta';
  icon: React.ElementType;
  author: string;
  size: string;
}

// --- Mock Data ---
const MODULES: Module[] = [
  {
    id: '1',
    name: 'User Management',
    description: 'Core authentication and role-based access control system.',
    version: '2.4.0',
    category: 'Core',
    status: 'active',
    icon: Shield,
    author: 'System',
    size: '1.2 MB'
  },
  {
    id: '2',
    name: 'AI Job Matcher',
    description: 'Advanced matching algorithm using vector embeddings.',
    version: '1.1.0',
    category: 'AI',
    status: 'active',
    icon: Cpu,
    author: 'AI Team',
    size: '45 MB'
  },
  {
    id: '3',
    name: 'Social Graph',
    description: 'Relationship mapping and community interaction engine.',
    version: '0.9.5',
    category: 'Social',
    status: 'beta',
    icon: Globe,
    author: 'Social Team',
    size: '12 MB'
  },
  {
    id: '4',
    name: 'Billing & Payments',
    description: 'Stripe integration and invoice generation module.',
    version: '2.1.0',
    category: 'Core',
    status: 'update-available',
    icon: Database,
    author: 'Finance Team',
    size: '3.5 MB'
  },
  {
    id: '5',
    name: 'Resume Parser',
    description: 'PDF/DOCX text extraction and entity recognition.',
    version: '1.5.2',
    category: 'AI',
    status: 'inactive',
    icon: Layers,
    author: 'AI Team',
    size: '28 MB'
  }
];

// --- Components ---

const ModuleCard = ({ module }: { module: Module }) => (
  <div className="bg-white p-6 rounded-2xl border border-slate-200 hover:shadow-md transition-all group">
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
          module.category === 'Core' ? 'bg-slate-100 text-slate-600' :
          module.category === 'AI' ? 'bg-purple-100 text-purple-600' :
          module.category === 'Social' ? 'bg-sky-100 text-sky-600' :
          'bg-emerald-100 text-emerald-600'
        }`}>
          <module.icon className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900">{module.name}</h3>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-medium">{module.category}</span>
            <span>•</span>
            <span>v{module.version}</span>
          </div>
        </div>
      </div>
      <button className={`text-2xl transition-colors ${module.status === 'active' || module.status === 'beta' || module.status === 'update-available' ? 'text-cyan-600' : 'text-slate-300'}`}>
        {module.status === 'active' || module.status === 'beta' || module.status === 'update-available' ? <ToggleRight className="w-10 h-10" /> : <ToggleLeft className="w-10 h-10" />}
      </button>
    </div>
    
    <p className="text-slate-600 text-sm mb-6 h-10 line-clamp-2">
      {module.description}
    </p>

    <div className="flex items-center justify-between pt-4 border-t border-slate-100">
      <div className="flex items-center gap-2">
        {module.status === 'active' && (
          <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-md text-xs font-bold flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> Active
          </span>
        )}
        {module.status === 'inactive' && (
          <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded-md text-xs font-bold">
            Inactive
          </span>
        )}
        {module.status === 'beta' && (
          <span className="px-2 py-1 bg-amber-50 text-amber-600 rounded-md text-xs font-bold flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Beta
          </span>
        )}
        {module.status === 'update-available' && (
          <span className="px-2 py-1 bg-cyan-50 text-cyan-600 rounded-md text-xs font-bold flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Update
          </span>
        )}
      </div>
      <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
        <Settings className="w-4 h-4" />
      </button>
    </div>
  </div>
);

const InstalledView = () => (
  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
    {/* Hero Section */}
    <div className="relative bg-slate-900/50 rounded-3xl overflow-hidden p-8 md:p-12">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
      <div className="absolute top-0 right-0 w-2/3 h-full bg-linear-to-l from-cyan-900/40 to-transparent" />
      
      <div className="relative z-10 max-w-2xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-500/30 backdrop-blur-sm mb-6">
          <Box className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-bold text-cyan-100 uppercase tracking-wider">System Architecture</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
          Manage your platform<br/>
          <span className="text-cyan-500">Modules & Extensions.</span>
        </h1>
        <p className="text-lg text-slate-300 mb-8">
          Configure, update, and monitor the core components powering your application.
        </p>
        
        <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md p-2 rounded-xl border border-white/10 max-w-md">
          <Search className="w-5 h-5 text-slate-400 ml-2" />
          <input 
            type="text" 
            placeholder="Search installed modules..." 
            className="bg-transparent border-none text-white placeholder-slate-400 focus:ring-0 w-full"
          />
        </div>
      </div>
    </div>

    <div className="grid lg:grid-cols-3 gap-8">
      {/* Module Grid */}
      <div className="lg:col-span-2 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Installed Modules</h2>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">All</button>
            <button className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Core</button>
            <button className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">AI</button>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {MODULES.map((module) => (
            <ModuleCard key={module.id} module={module} />
          ))}
        </div>
      </div>

      {/* Sidebar Widgets */}
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200">
          <h3 className="font-bold text-slate-900 mb-4">System Health</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-600">Memory Usage</span>
                <span className="font-bold text-cyan-600">42%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-cyan-600 h-2 rounded-full w-[42%]" />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-600">API Latency</span>
                <span className="font-bold text-emerald-600">45ms</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-emerald-500 h-2 rounded-full w-[15%]" />
              </div>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-slate-100">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Active Modules</span>
              <span className="font-bold text-slate-900">12/15</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-2">
              <span className="text-slate-500">Last Update</span>
              <span className="font-bold text-slate-900">2h ago</span>
            </div>
          </div>
        </div>

        <div className="bg-cyan-900 p-6 rounded-2xl text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-800 rounded-full -mr-16 -mt-16 opacity-50" />
          <div className="relative z-10">
            <h3 className="font-bold text-lg mb-2">Marketplace</h3>
            <p className="text-cyan-200 text-sm mb-4">Discover new modules to extend your platform's capabilities.</p>
            <button className="w-full py-2 bg-white text-cyan-900 rounded-lg text-sm font-bold hover:bg-cyan-50 transition-colors flex items-center justify-center gap-2">
              <Download className="w-4 h-4" /> Browse Store
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default function ModulesPage() {
  const [currentView, setCurrentView] = useState<ViewState>('installed');

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-slate-200 hidden lg:flex flex-col p-4 sticky top-0 h-screen">
        <div className="mb-8 px-4 pt-4">
          <div className="flex items-center gap-2 text-cyan-600 font-bold text-xl">
            <Box className="w-6 h-6" />
            <span>Modules</span>
          </div>
        </div>
        
        <nav className="space-y-1 flex-1">
          <button onClick={() => setCurrentView('installed')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'installed' ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/20' : 'text-slate-600 hover:bg-slate-100'}`}>
            <Layers className="w-5 h-5" /><span className="font-medium">Installed</span>
          </button>
          <button onClick={() => setCurrentView('marketplace')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'marketplace' ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/20' : 'text-slate-600 hover:bg-slate-100'}`}>
            <Download className="w-5 h-5" /><span className="font-medium">Marketplace</span>
          </button>
          <button onClick={() => setCurrentView('updates')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'updates' ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/20' : 'text-slate-600 hover:bg-slate-100'}`}>
            <RefreshCw className="w-5 h-5" /><span className="font-medium">Updates</span>
          </button>
          <button onClick={() => setCurrentView('settings')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'settings' ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/20' : 'text-slate-600 hover:bg-slate-100'}`}>
            <Settings className="w-5 h-5" /><span className="font-medium">Settings</span>
          </button>
        </nav>

        <div className="p-4 bg-cyan-50 rounded-xl border border-cyan-100 mt-4">
          <div className="flex items-center gap-2 text-cyan-900 font-bold mb-1">
            <Zap className="w-4 h-4" /> Developer Mode
          </div>
          <p className="text-xs text-cyan-700 mb-3">Access advanced configuration and logs.</p>
          <button className="w-full py-2 bg-white border border-cyan-200 rounded-lg text-xs font-bold text-cyan-700 hover:bg-white/50">
            Enable
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 md:p-8 overflow-y-auto h-screen">
        {currentView === 'installed' && <InstalledView />}
        
        {currentView !== 'installed' && (
          <div className="flex items-center justify-center h-full text-slate-500">
            <div className="text-center">
              <Box className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-bold text-slate-900">Coming Soon</h3>
              <p>This section is under development.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}