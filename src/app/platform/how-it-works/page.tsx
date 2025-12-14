'use client';

import React, { useState } from 'react';
import { 
  Cpu, FileText, Zap, ArrowRight, CheckCircle,
  Layers, Search, Filter, Shield,
  ChevronRight, Download, X, Plus, Calendar, Target,
  LayoutDashboard, Share2, Database, Network, Lock
} from 'lucide-react';

// --- Types ---
type ViewState = 'overview' | 'architecture' | 'security' | 'integrations' | 'roadmap';

interface Step {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
}

interface Feature {
  id: string;
  title: string;
  description: string;
  category: 'Core' | 'Security' | 'AI';
}

// --- Mock Data ---
const STEPS: Step[] = [
  { id: '1', title: 'Data Aggregation', description: 'We securely connect to your financial, operational, and market data sources in real-time.', icon: Database },
  { id: '2', title: 'AI Processing', description: 'Our neural networks analyze millions of data points to identify patterns, anomalies, and opportunities.', icon: Cpu },
  { id: '3', title: 'Actionable Insights', description: 'Complex data is transformed into clear, strategic recommendations tailored to your goals.', icon: Zap },
];

const FEATURES: Feature[] = [
  { id: '1', title: 'End-to-End Encryption', description: 'AES-256 encryption for data at rest and TLS 1.3 for data in transit.', category: 'Security' },
  { id: '2', title: 'Predictive Modeling', description: 'Forecast future trends with 94% accuracy using our proprietary algorithms.', category: 'AI' },
  { id: '3', title: 'Real-Time Sync', description: 'Changes in your source systems are reflected in your dashboard within seconds.', category: 'Core' },
  { id: '4', title: 'Role-Based Access', description: 'Granular permission controls ensure team members only see what they need.', category: 'Security' },
];

// --- Components ---
const FeatureViewer = ({ feature, onClose }: { feature: Feature; onClose: () => void }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
    <div className="bg-white rounded-2xl w-full max-w-2xl flex flex-col shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-cyan-100 rounded-lg flex items-center justify-center">
            <Cpu className="w-5 h-5 text-cyan-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">{feature.title}</h3>
            <p className="text-xs text-slate-500">{feature.category} Feature</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="p-8 bg-slate-50 flex flex-col items-center text-center">
        <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm mb-6">
          <Shield className="w-10 h-10 text-cyan-500" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-4">{feature.title}</h2>
        <p className="text-slate-600 mb-8 max-w-md leading-relaxed">
          {feature.description}
        </p>
        <div className="w-full bg-white p-6 rounded-xl border border-slate-200 text-left">
          <h4 className="font-bold text-slate-900 mb-2 text-sm">Technical Detail</h4>
          <p className="text-xs text-slate-500">
            This feature is built on our microservices architecture, ensuring high availability and scalability. It integrates directly with our core processing engine.
          </p>
        </div>
      </div>
    </div>
  </div>
);

interface OverviewViewProps {
  onSelectFeature: (feature: Feature) => void;
  onNavigate: (view: ViewState) => void;
}

const OverviewView = ({ onSelectFeature, onNavigate }: OverviewViewProps) => (
  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
    {/* Hero Card */}
    <div className="relative bg-slate-900/50 rounded-3xl overflow-hidden p-8 md:p-12">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
      <div className="absolute top-0 right-0 w-2/3 h-full bg-linear-to-l from-cyan-900/40 to-transparent" />
      
      <div className="relative z-10 max-w-2xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-500/30 backdrop-blur-sm mb-6">
          <Cpu className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-bold text-cyan-100 uppercase tracking-wider">Platform Architecture</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
          The engine behind <span className="text-cyan-500">Intelligence.</span>
        </h1>
        <p className="text-lg text-slate-300 mb-8">
          Discover how Athena transforms raw data into strategic power through advanced AI and secure processing.
        </p>
        <div className="flex flex-wrap gap-4">
          <button onClick={() => onNavigate('architecture')} className="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-bold transition-colors flex items-center gap-2">
            View Architecture <ArrowRight className="w-4 h-4" />
          </button>
          <button onClick={() => onNavigate('security')} className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-colors backdrop-blur-sm">
            Security Specs
          </button>
        </div>
      </div>
    </div>

    {/* Process Steps */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {STEPS.map((step, index) => (
        <div key={step.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <span className="text-6xl font-bold text-slate-900">{index + 1}</span>
          </div>
          <div className="w-12 h-12 bg-cyan-50 rounded-xl flex items-center justify-center mb-4 relative z-10">
            <step.icon className="w-6 h-6 text-cyan-600" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2 relative z-10">{step.title}</h3>
          <p className="text-sm text-slate-500 relative z-10">{step.description}</p>
        </div>
      ))}
    </div>

    {/* Features Grid */}
    <div className="grid lg:grid-cols-3 gap-8">
      {/* Core Features */}
      <div className="lg:col-span-2 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Platform Capabilities</h2>
          <button className="text-sm font-bold text-cyan-600 hover:text-cyan-700">View All</button>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {FEATURES.map((feature) => (
            <div 
              key={feature.id}
              onClick={() => onSelectFeature(feature)}
              className="group bg-white p-4 rounded-xl border border-slate-200 hover:border-cyan-200 hover:shadow-md transition-all cursor-pointer flex flex-col h-full"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center group-hover:bg-cyan-50 transition-colors">
                  <Cpu className="w-5 h-5 text-slate-400 group-hover:text-cyan-500 transition-colors" />
                </div>
                <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-full">{feature.category}</span>
              </div>
              
              <h3 className="font-bold text-slate-900 group-hover:text-cyan-700 transition-colors mb-2">{feature.title}</h3>
              <p className="text-sm text-slate-500 line-clamp-2 mb-4 flex-1">{feature.description}</p>
              
              <div className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-50">
                <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-emerald-500" /> Live</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tech Stack / Info */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Tech Stack</h2>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                <Database className="w-4 h-4 text-slate-600" />
              </div>
              <div>
                <div className="font-bold text-slate-900 text-sm">PostgreSQL</div>
                <div className="text-xs text-slate-500">Primary Database</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                <Zap className="w-4 h-4 text-slate-600" />
              </div>
              <div>
                <div className="font-bold text-slate-900 text-sm">Next.js 14</div>
                <div className="text-xs text-slate-500">Frontend Framework</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                <Lock className="w-4 h-4 text-slate-600" />
              </div>
              <div>
                <div className="font-bold text-slate-900 text-sm">Auth0</div>
                <div className="text-xs text-slate-500">Identity Management</div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="p-6 bg-cyan-900 rounded-2xl text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-800 rounded-full -mr-16 -mt-16 opacity-50" />
          <div className="relative z-10">
            <h3 className="font-bold text-lg mb-2">Developer API</h3>
            <p className="text-cyan-200 text-sm mb-4">Build custom integrations with our robust API.</p>
            <button className="w-full py-2 bg-white text-cyan-900 rounded-lg text-sm font-bold hover:bg-cyan-50 transition-colors">
              Read Docs
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default function HowItWorksPage() {
  const [currentView, setCurrentView] = useState<ViewState>('overview');
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex">
      {/* Sidebar Navigation */}
      <div className="w-64 bg-white border-r border-slate-200 hidden lg:flex flex-col p-4 sticky top-0 h-screen">
        <div className="mb-8 px-4 pt-4">
          <div className="flex items-center gap-2 text-cyan-600 font-bold text-xl">
            <Layers className="w-6 h-6" />
            <span>Platform</span>
          </div>
        </div>
        
        <nav className="space-y-1 flex-1">
          <button onClick={() => setCurrentView('overview')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'overview' ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/20' : 'text-slate-600 hover:bg-slate-100'}`}><LayoutDashboard className="w-5 h-5" /><span className="font-medium">Overview</span></button>
          <button onClick={() => setCurrentView('architecture')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'architecture' ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/20' : 'text-slate-600 hover:bg-slate-100'}`}><Network className="w-5 h-5" /><span className="font-medium">Architecture</span></button>
          <button onClick={() => setCurrentView('security')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'security' ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/20' : 'text-slate-600 hover:bg-slate-100'}`}><Shield className="w-5 h-5" /><span className="font-medium">Security</span></button>
          <button onClick={() => setCurrentView('integrations')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'integrations' ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/20' : 'text-slate-600 hover:bg-slate-100'}`}><Zap className="w-5 h-5" /><span className="font-medium">Integrations</span></button>
          <button onClick={() => setCurrentView('roadmap')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'roadmap' ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/20' : 'text-slate-600 hover:bg-slate-100'}`}><Target className="w-5 h-5" /><span className="font-medium">Roadmap</span></button>
        </nav>

        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 mt-4">
          <h4 className="font-bold text-slate-900 mb-2 text-sm">System Status</h4>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-slate-500">All systems operational</span>
          </div>
          <button className="w-full py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50">
            View Status Page
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 md:p-8 pb-24 lg:pb-8 overflow-y-auto h-screen">
        {currentView === 'overview' && <OverviewView onSelectFeature={setSelectedFeature} onNavigate={setCurrentView} />}
        {/* Placeholders for other views */}
        {currentView !== 'overview' && (
          <div className="flex items-center justify-center h-full text-slate-500">
            View content coming soon...
          </div>
        )}
      </div>

      {/* Modals */}
      {selectedFeature && (
        <FeatureViewer feature={selectedFeature} onClose={() => setSelectedFeature(null)} />
      )}
    </div>
  );
}