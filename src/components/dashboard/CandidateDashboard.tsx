'use client';

import React from 'react';
import Link from 'next/link';
import { 
  Send, 
  Bookmark, 
  BadgeCheck, 
  Clock, 
  Sun, 
  Zap, 
  UserPlus, 
  Feather, 
  ReplyAll, 
  MailOpen 
} from 'lucide-react';

export default function CandidateDashboard() {
  // Mock Data based on Blade template
  const candidateName = "Sarah";
  const metrics = [
    { label: 'Applications sent', value: '12', context: 'Total to date', icon: Send },
    { label: 'Saved roles', value: '5', context: 'Ready to revisit', icon: Bookmark },
    { label: 'Profile score', value: '85%', context: 'Signal strength', icon: BadgeCheck },
  ];

  const priorities = [
    {
      id: 1,
      title: 'Send two courageous applications before midday.',
      copy: 'Signals keep flowing when you ship work early.',
      accent: 'bg-indigo-500/20',
      text: 'text-indigo-300',
    },
    {
      id: 2,
      title: 'Invite a trusted ally to review your story.',
      copy: 'Fresh eyes unlock kinder insights.',
      accent: 'bg-pink-500/20',
      text: 'text-pink-300',
    },
    {
      id: 3,
      title: 'Clear lingering onboarding steps to unlock nudges.',
      copy: 'Prime Athena to route premium matches your way.',
      accent: 'bg-slate-500/20',
      text: 'text-slate-300',
    },
  ];

  const nextMoves = [
    {
      icon: Feather,
      title: 'Record a 30-second gratitude note to your strongest ally.',
      copy: 'Signals warmth to mentors holding space for you.',
      accent: 'bg-emerald-500/20',
      text: 'text-emerald-300',
    },
    {
      icon: ReplyAll,
      title: 'Drop a fresh update in the community feed.',
      copy: 'Keeps the orbit feminine-forward and focused.',
      accent: 'bg-indigo-500/20',
      text: 'text-indigo-300',
    },
    {
      icon: MailOpen,
      title: 'Close out pending invites so networking AI stays accurate.',
      copy: 'Unlocks new matches instantly.',
      accent: 'bg-pink-500/20',
      text: 'text-pink-300',
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Hero Section */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left Column - Morning Window */}
        <div className="xl:col-span-7">
          <div className="h-full rounded-[2rem] p-8 text-white shadow-2xl relative overflow-hidden bg-linear-to-br from-[#5a1e3a] via-[#6f2d4a] to-[#7f3d5a]">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-8 relative z-10">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-white text-slate-900 text-xs font-bold uppercase tracking-widest rounded-full">
                  Welcome to Athena
                </span>
                <span className="px-3 py-1 bg-white/90 text-slate-900 text-xs font-bold rounded-full flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Updated 9:00 AM
                </span>
              </div>
              <span className="px-3 py-1 bg-white/90 text-slate-900 text-xs font-bold rounded-full flex items-center gap-1">
                <Sun className="w-3 h-3" />
                Morning window
              </span>
            </div>

            {/* Content */}
            <div className="mb-8 relative z-10">
              <p className="text-xs font-bold uppercase tracking-widest text-white/75 mb-2">Athena member hub</p>
              <h1 className="text-3xl md:text-4xl font-bold mb-4 leading-tight">
                Good morning, {candidateName}. <br/>
                Let&apos;s build something powerful today.
              </h1>
              <p className="text-lg text-white/85 leading-relaxed max-w-2xl">
                Crafted with dignity, respect, and love for every woman who joins Athena. Track applications, unlock AI nudges, and keep your pathways on course without giving an inch to doubt.
              </p>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 relative z-10">
              {metrics.map((metric, idx) => (
                <div key={idx} className="rounded-2xl p-4 bg-white/10 border border-white/15 backdrop-blur-sm">
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center mb-3 text-white">
                    <metric.icon className="w-4 h-4" />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-widest text-white/70 mb-1">{metric.label}</p>
                  <p className="text-2xl font-bold mb-0">{metric.value}</p>
                  <p className="text-xs text-white/70">{metric.context}</p>
                </div>
              ))}
            </div>

            {/* Priorities */}
            <div className="mb-8 relative z-10">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-bold uppercase tracking-widest text-white">Today&apos;s priorities</p>
                <span className="text-xs text-white/75">Fuel the feed before noon</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {priorities.map((priority, idx) => (
                  <div key={idx} className="rounded-2xl p-4 bg-white/10 border border-white/15 backdrop-blur-sm flex gap-3 items-start h-full">
                    <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${priority.accent} ${priority.text}`}>
                      {idx + 1}
                    </span>
                    <div>
                      <p className="text-sm font-bold mb-1 leading-snug">{priority.title}</p>
                      <p className="text-xs text-white/75 leading-relaxed">{priority.copy}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3 relative z-10">
              <Link href="/onboarding" className="px-6 py-2.5 bg-white text-slate-900 rounded-full font-bold text-sm flex items-center gap-2 hover:bg-slate-100 transition-colors">
                <Zap className="w-4 h-4" />
                Open onboarding dashboard
              </Link>
              <Link href="/profile" className="px-6 py-2.5 bg-white/15 text-white border border-white/25 rounded-full font-bold text-sm flex items-center gap-2 hover:bg-white/25 transition-colors">
                <UserPlus className="w-4 h-4" />
                Refresh profile story
              </Link>
            </div>
          </div>
        </div>

        {/* Right Column - Next Moves & Signals */}
        <div className="xl:col-span-5 flex flex-col gap-6">
          {/* Next Moves Card */}
          <div className="flex-1 rounded-[2rem] p-8 text-white shadow-2xl relative overflow-hidden bg-linear-to-br from-[#2b185a] via-[#461867] to-[#7f104e]">
             <div className="rounded-2xl bg-linear-to-br from-[#1e0d3f] via-[#3a1680] to-[#6525b6] p-6 h-full border border-white/10">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-xl font-bold mb-1">Next Moves</h3>
                    <p className="text-sm text-white/70">Small steps, big momentum.</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                    <Feather className="w-5 h-5" />
                  </div>
                </div>

                <div className="space-y-4">
                  {nextMoves.map((move, idx) => (
                    <div key={idx} className="flex gap-4 p-3 rounded-xl hover:bg-white/5 transition-colors">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${move.accent} ${move.text}`}>
                        <move.icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold mb-1">{move.title}</h4>
                        <p className="text-xs text-white/60">{move.copy}</p>
                      </div>
                    </div>
                  ))}
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
