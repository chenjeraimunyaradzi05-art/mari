"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  CheckCircle2, 
  ArrowRight, 
  Loader2,
  Sparkles
} from 'lucide-react';

// Mock Data
const PERSONAS = [
  { id: 'career_pivot', label: 'Career Pivot', icon: '🔄', description: 'Transitioning to a new industry or role.', tagline: 'Reinvent your path.' },
  { id: 'returning', label: 'Returning to Work', icon: '🏠', description: 'Re-entering the workforce after a break.', tagline: 'Welcome back.' },
  { id: 'leadership', label: 'Leadership Growth', icon: '🚀', description: 'Aspiring to or growing in leadership roles.', tagline: 'Lead with impact.' },
  { id: 'tech_entry', label: 'Breaking into Tech', icon: '💻', description: 'Starting a career in technology.', tagline: 'Build the future.' },
  { id: 'entrepreneur', label: 'Entrepreneurship', icon: '💡', description: 'Starting or scaling a business.', tagline: 'Create your own way.' },
];

export default function OnboardingFlow() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  
  // Form State
  const [profile, setProfile] = useState({
    name: '',
    preferredName: '',
    pronouns: '',
    timezone: '',
  });
  const [selectedPersonas, setSelectedPersonas] = useState<string[]>([]);

  // Simulate initial load
  useEffect(() => {
    const timer = setTimeout(() => setProgress(25), 500);
    return () => clearTimeout(timer);
  }, []);

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep(2);
      setProgress(50);
    }, 800);
  };

  const togglePersona = (id: string) => {
    if (selectedPersonas.includes(id)) {
      setSelectedPersonas(prev => prev.filter(p => p !== id));
    } else {
      if (selectedPersonas.length < 5) {
        setSelectedPersonas(prev => [...prev, id]);
      }
    }
  };

  const handlePersonasSubmit = () => {
    setLoading(true);
    setProgress(100);
    setTimeout(() => {
      router.push('/dashboard/candidate');
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Hero Section */}
      <div className="bg-white border-b border-slate-200 pt-8 pb-12 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-bold uppercase tracking-widest mb-4 border border-purple-100">
            <Sparkles className="w-3 h-3" />
            WomenRise Onboarding
          </span>
          <h1 className="text-3xl md:text-5xl font-bold text-slate-900 mb-4">
            Tailor Athena to you{profile.preferredName ? `, ${profile.preferredName}` : ''}
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Spend a few minutes capturing your goals and Athena tunes jobs, courses, housing, and mentors around what matters most.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm sticky top-8">
            <div className="flex justify-between items-center mb-6">
              <div>
                <p className="text-xs font-bold text-purple-600 uppercase tracking-wider mb-1">Live Progress</p>
                <h2 className="font-bold text-slate-900">Your Journey</h2>
              </div>
              <span className="text-2xl font-bold text-purple-600">{progress}%</span>
            </div>

            <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-8">
              <div 
                className="h-full bg-linear-to-r from-purple-500 to-pink-500 transition-all duration-1000 ease-out"
                style={{ width: `${progress}%` }}
              ></div>
            </div>

            <ul className="space-y-6">
              {[
                { s: 1, label: 'Profile Basics', desc: 'Name, pronouns, timezone' },
                { s: 2, label: 'Choose Personas', desc: 'Select your career path' },
              ].map((item) => (
                <li key={item.s} className="flex gap-4">
                  <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors
                    ${step > item.s || (step === item.s && item.s === 2 && progress === 100)
                      ? 'bg-emerald-500 border-emerald-500 text-white' 
                      : step === item.s 
                        ? 'border-purple-600 text-purple-600' 
                        : 'border-slate-200 text-slate-300'}
                  `}>
                    {step > item.s ? <CheckCircle2 className="w-5 h-5" /> : <span className="font-bold text-sm">{item.s}</span>}
                  </div>
                  <div>
                    <p className={`font-bold ${step === item.s ? 'text-slate-900' : 'text-slate-500'}`}>{item.label}</p>
                    <p className="text-xs text-slate-500">{item.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-8">
          {/* Step 1: Profile Basics */}
          {step === 1 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <header className="mb-8">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Step 1 of 3</span>
                <h2 className="text-2xl font-bold text-slate-900 mt-1">Profile Basics</h2>
                <p className="text-slate-600 mt-2">Update how we address you and the timezone you prefer.</p>
              </header>

              <form onSubmit={handleProfileSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Full Name</label>
                  <input 
                    type="text" 
                    required
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
                    value={profile.name}
                    onChange={e => setProfile({...profile, name: e.target.value})}
                    placeholder="e.g. Sarah Jenkins"
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Preferred Name</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
                      value={profile.preferredName}
                      onChange={e => setProfile({...profile, preferredName: e.target.value})}
                      placeholder="e.g. Sarah"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Pronouns</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
                      value={profile.pronouns}
                      onChange={e => setProfile({...profile, pronouns: e.target.value})}
                      placeholder="e.g. she/her"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Timezone</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
                    value={profile.timezone}
                    onChange={e => setProfile({...profile, timezone: e.target.value})}
                    placeholder="e.g. Australia/Sydney"
                  />
                </div>

                <div className="pt-4">
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full md:w-auto px-8 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-lg shadow-purple-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save & Continue'}
                    {!loading && <ArrowRight className="w-5 h-5" />}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Step 2: Personas */}
          {step === 2 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <header className="mb-8">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Step 2 of 2</span>
                    <h2 className="text-2xl font-bold text-slate-900 mt-1">Choose your personas</h2>
                    <p className="text-slate-600 mt-2">Pick up to five journeys that best describe the support you need.</p>
                  </div>
                  <span className="px-3 py-1 bg-slate-100 rounded-full text-xs font-bold text-slate-600">
                    {selectedPersonas.length}/5 selected
                  </span>
                </div>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                {PERSONAS.map((persona) => {
                  const isSelected = selectedPersonas.includes(persona.id);
                  return (
                    <button
                      key={persona.id}
                      onClick={() => togglePersona(persona.id)}
                      className={`
                        text-left p-4 rounded-xl border-2 transition-all duration-200 relative group
                        ${isSelected 
                          ? 'border-purple-500 bg-purple-50/50 shadow-md shadow-purple-500/10' 
                          : 'border-slate-100 hover:border-purple-200 hover:bg-slate-50'}
                      `}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">{persona.icon}</span>
                        <div>
                          <h3 className={`font-bold ${isSelected ? 'text-purple-900' : 'text-slate-900'}`}>{persona.label}</h3>
                          <p className="text-xs font-bold uppercase tracking-wider text-purple-600 mt-1 mb-2">{persona.tagline}</p>
                          <p className="text-sm text-slate-600 leading-relaxed">{persona.description}</p>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="absolute top-3 right-3 text-purple-600">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="pt-4 flex justify-between items-center">
                <button 
                  onClick={() => setStep(1)}
                  className="text-slate-500 font-bold hover:text-slate-700"
                >
                  Back
                </button>
                <button 
                  onClick={handlePersonasSubmit}
                  disabled={loading || selectedPersonas.length === 0}
                  className="px-8 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-lg shadow-purple-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Finish Onboarding'}
                  {!loading && <ArrowRight className="w-5 h-5" />}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}