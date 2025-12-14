import React from 'react';
import Link from 'next/link';
import { 
  GraduationCap, 
  Briefcase, 
  CheckCircle, 
  Users, 
  Building2, 
  ArrowRight, 
  Star, 
  ShieldCheck,
  Hammer,
  Zap,
  HardHat
} from 'lucide-react';

export default function ApprenticeshipsPage() {
  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-emerald-100 selection:text-emerald-900">
      
      {/* Hero Section */}
      <div className="relative bg-linear-to-br from-emerald-900 via-teal-900 to-emerald-950 text-white overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
        <div className="absolute top-0 right-0 w-1/2 h-full bg-linear-to-l from-emerald-500/10 to-transparent" />
        
        <div className="max-w-7xl mx-auto px-6 py-24 lg:py-32 relative z-10">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-800/50 border border-emerald-700 backdrop-blur-sm mb-6">
              <Star className="w-4 h-4 text-emerald-400 fill-emerald-400" />
              <span className="text-sm font-medium text-emerald-100">#1 Platform for Women in Trades</span>
            </div>
            <h1 className="text-5xl lg:text-7xl font-bold tracking-tight mb-8 leading-tight">
              Reinvent Your <span className="text-emerald-400">Future.</span>
            </h1>
            <p className="text-xl text-emerald-100/90 leading-relaxed max-w-2xl mb-10">
              Connect with inclusive employers, find mentorship, and build a career that empowers you. Whether you're starting out or starting over, your path begins here.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/apprenticeships/search" className="px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-2xl transition-all shadow-lg shadow-emerald-900/20 hover:-translate-y-1">
                Find an Apprenticeship
              </Link>
              <Link href="/apprenticeships/recruit" className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl backdrop-blur-md border border-white/20 transition-all hover:-translate-y-1">
                Post an Opportunity
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Split Section: Seekers vs Recruiters */}
      <div className="max-w-7xl mx-auto px-6 -mt-16 relative z-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* For Seekers */}
          <div className="bg-white rounded-3xl p-8 lg:p-12 shadow-xl border border-slate-100 relative overflow-hidden group hover:border-emerald-200 transition-all">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full -mr-16 -mt-16 opacity-50 group-hover:scale-110 transition-transform duration-500" />
            <div className="relative z-10">
              <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mb-8 text-emerald-600">
                <GraduationCap className="w-8 h-8" />
              </div>
              <h2 className="text-3xl font-bold text-slate-900 mb-4">For Members</h2>
              <p className="text-slate-600 mb-8 text-lg leading-relaxed">
                Looking to start a trade or switch careers? We connect you with safe, supportive, and verified employers who value diversity.
              </p>
              
              <ul className="space-y-4 mb-10">
                {[
                  'Verified "Women-Safe" Workplaces',
                  'Mentorship from Senior Tradeswomen',
                  'Scholarship & Grant Opportunities',
                  'Tool Allowances & Gear Support'
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-slate-700 font-medium">
                    <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>

              <Link href="/apprenticeships/search" className="inline-flex items-center gap-2 text-emerald-700 font-bold hover:gap-3 transition-all">
                Browse Opportunities <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>

          {/* For Recruiters */}
          <div className="bg-slate-900 rounded-3xl p-8 lg:p-12 shadow-xl border border-slate-800 relative overflow-hidden group hover:border-emerald-800 transition-all">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-900/20 rounded-full -mr-16 -mt-16 opacity-50 group-hover:scale-110 transition-transform duration-500" />
            <div className="relative z-10">
              <div className="w-16 h-16 bg-emerald-900/50 rounded-2xl flex items-center justify-center mb-8 text-emerald-400 border border-emerald-800">
                <Briefcase className="w-8 h-8" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-4">For Recruiters</h2>
              <p className="text-slate-400 mb-8 text-lg leading-relaxed">
                Tradies, companies, and organizations: Find dedicated, reliable, and skilled apprentices. Build a diverse workforce that drives innovation.
              </p>
              
              <ul className="space-y-4 mb-10">
                {[
                  'Access to Pre-Vetted Candidates',
                  'Government Incentive Guidance',
                  'Retention Support Programs',
                  'Diversity & Inclusion Badging'
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-slate-300 font-medium">
                    <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>

              <Link href="/apprenticeships/recruit" className="inline-flex items-center gap-2 text-emerald-400 font-bold hover:gap-3 transition-all">
                Post a Role <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>

        </div>
      </div>

      {/* Popular Categories */}
      <div className="max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Explore Popular Pathways</h2>
          <p className="text-slate-600 max-w-2xl mx-auto">
            Discover high-demand industries where women are making their mark.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { name: 'Electrical', icon: Zap, count: '120+ Roles' },
            { name: 'Construction', icon: HardHat, count: '85+ Roles' },
            { name: 'Plumbing', icon: Hammer, count: '64+ Roles' },
            { name: 'Engineering', icon: Building2, count: '92+ Roles' },
          ].map((cat, i) => (
            <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all cursor-pointer group text-center">
              <div className="w-12 h-12 mx-auto bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 mb-4 group-hover:scale-110 transition-transform">
                <cat.icon className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 mb-1">{cat.name}</h3>
              <p className="text-xs text-slate-500 font-medium">{cat.count}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Pricing / Membership Plans */}
      <div className="bg-slate-900 py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5" />
        
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center mb-16">
            <span className="text-emerald-400 font-bold tracking-wider uppercase text-sm mb-2 block">Recruitment Plans</span>
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Simple, Transparent Pricing</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Choose the plan that fits your organization's size and hiring needs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Single Member / Sole Trader */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-3xl p-8 border border-slate-700 hover:border-emerald-500/50 transition-all flex flex-col">
              <div className="mb-6">
                <h3 className="text-xl font-bold text-white mb-2">Sole Trader</h3>
                <p className="text-slate-400 text-sm">Perfect for single tradies looking for an apprentice.</p>
              </div>
              <div className="mb-8">
                <span className="text-4xl font-bold text-white">$49</span>
                <span className="text-slate-500">/mo</span>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                  1 Active Job Post
                </li>
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                  Basic Candidate Matching
                </li>
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                  Standard Support
                </li>
              </ul>
              <Link href="/apprenticeships/recruit?plan=sole" className="w-full py-3 rounded-xl bg-slate-700 text-white font-bold hover:bg-slate-600 transition-all text-center block">
                Get Started
              </Link>
            </div>

            {/* 5-10 Members (Growth) */}
            <div className="bg-emerald-900/20 backdrop-blur-sm rounded-3xl p-8 border border-emerald-500/50 relative flex flex-col transform md:-translate-y-4 shadow-2xl shadow-emerald-900/50">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-emerald-500 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wide shadow-lg">
                Most Popular
              </div>
              <div className="mb-6">
                <h3 className="text-xl font-bold text-white mb-2">Small Team</h3>
                <p className="text-emerald-100/70 text-sm">For growing businesses with 5-10 staff.</p>
              </div>
              <div className="mb-8">
                <span className="text-4xl font-bold text-white">$199</span>
                <span className="text-emerald-200/70">/mo</span>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-start gap-3 text-white text-sm">
                  <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                  Up to 3 Active Job Posts
                </li>
                <li className="flex items-start gap-3 text-white text-sm">
                  <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                  AI Candidate Matching
                </li>
                <li className="flex items-start gap-3 text-white text-sm">
                  <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                  "Women-Safe" Badge Verification
                </li>
                <li className="flex items-start gap-3 text-white text-sm">
                  <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                  Priority Support
                </li>
              </ul>
              <Link href="/apprenticeships/recruit?plan=growth" className="w-full py-3 rounded-xl bg-emerald-500 text-white font-bold hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-900/20 text-center block">
                Start Free Trial
              </Link>
            </div>

            {/* 10+ Members (Enterprise) */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-3xl p-8 border border-slate-700 hover:border-emerald-500/50 transition-all flex flex-col">
              <div className="mb-6">
                <h3 className="text-xl font-bold text-white mb-2">Enterprise</h3>
                <p className="text-slate-400 text-sm">For organizations with 10+ staff.</p>
              </div>
              <div className="mb-8">
                <span className="text-4xl font-bold text-white">Custom</span>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                  Unlimited Job Posts
                </li>
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                  Dedicated Account Manager
                </li>
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                  Custom Onboarding & Training
                </li>
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                  API Access
                </li>
              </ul>
              <Link href="/apprenticeships/recruit?plan=enterprise" className="w-full py-3 rounded-xl bg-white text-slate-900 font-bold hover:bg-slate-100 transition-all text-center block">
                Contact Sales
              </Link>
            </div>

          </div>
        </div>
      </div>

      {/* Trust Indicators */}
      <div className="py-16 border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-slate-500 font-medium mb-8 uppercase tracking-widest text-xs">Trusted by Industry Leaders</p>
          <div className="flex flex-wrap justify-center gap-8 lg:gap-16 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
            {/* Placeholders for logos */}
            <div className="h-8 w-32 bg-slate-200 rounded-md animate-pulse" />
            <div className="h-8 w-32 bg-slate-200 rounded-md animate-pulse" />
            <div className="h-8 w-32 bg-slate-200 rounded-md animate-pulse" />
            <div className="h-8 w-32 bg-slate-200 rounded-md animate-pulse" />
            <div className="h-8 w-32 bg-slate-200 rounded-md animate-pulse" />
          </div>
        </div>
      </div>

    </div>
  );
}
