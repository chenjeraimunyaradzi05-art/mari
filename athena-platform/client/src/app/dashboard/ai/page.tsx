'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  FileText,
  Target,
  MessageSquare,
  TrendingUp,
  Lightbulb,
  PenSquare,
  Crown,
  ArrowRight,
  Zap,
  Compass,
  Radar,
  DollarSign,
  Users,
  Shield,
  Video,
} from 'lucide-react';
import { useAuth } from '@/lib/hooks';

/**
 * Every description below is read as a promise about what the tool will do, and
 * six of them used to promise something else entirely.
 *
 * CareerCompass was sold here as "ML-powered career predictions" while its own
 * page opens with "A comparison, not a forecast" — it runs four database
 * queries and compares her skills to the ones employers are advertising, and
 * there is no model anywhere behind it. OpportunityScan was "AI-matched
 * opportunities ranked by your skills and preferences" over three newest-first
 * queries, and says so on its own page. MentorMatch was "AI-powered mentor
 * recommendations based on compatibility" over a SQL sort on shared skills,
 * rating and years mentoring. IncomeStream offered "income projections" whose
 * modelled-income card was removed from the creator page precisely because
 * every coefficient in it was invented.
 *
 * The contradiction mattered more than the exaggeration. A woman who read
 * "predictions" here and "not a forecast" one click later has to work out which
 * of the two ATHENA meant, and there is no good version of that. These say what
 * each tool does, in the same words the tool itself uses.
 */
const tools = [
  {
    id: 'career-compass',
    name: 'CareerCompass',
    description:
      'Compares the skills employers are advertising with the skills on your profile, and names the gap',
    icon: Compass,
    href: '/dashboard/ai/career-compass',
    color: 'bg-indigo-500',
    premium: false,
    isNew: true,
  },
  {
    id: 'opportunity-scan',
    name: 'OpportunityScan',
    description: 'The newest roles, courses and events on ATHENA, newest first',
    icon: Radar,
    href: '/dashboard/ai/opportunities',
    color: 'bg-cyan-500',
    premium: false,
    isNew: true,
  },
  {
    id: 'salary-equity',
    name: 'SalaryEquity',
    description:
      'The median of advertised ranges for your role, against what you are asking for',
    icon: DollarSign,
    href: '/dashboard/ai/salary',
    color: 'bg-emerald-500',
    premium: false,
    isNew: true,
  },
  {
    id: 'mentor-match',
    name: 'MentorMatch',
    description:
      'Mentors ranked by skills you share, their rating and years mentoring — with the reasons shown',
    icon: Users,
    href: '/dashboard/ai/mentors',
    color: 'bg-purple-500',
    premium: false,
    isNew: true,
  },
  {
    id: 'safety-score',
    name: 'Trust Score',
    description: 'What your trust score is made of, and what raises it',
    icon: Shield,
    href: '/dashboard/ai/trust',
    color: 'bg-amber-500',
    premium: false,
    isNew: true,
  },
  {
    id: 'income-stream',
    name: 'Creator Analytics',
    description: 'Your followers, posts and views as counted today, and the share of each gift you keep',
    icon: Video,
    href: '/dashboard/ai/creator',
    color: 'bg-pink-500',
    premium: false,
    isNew: true,
  },
  {
    id: 'opportunity-radar',
    name: 'Opportunity Radar',
    description: 'Open roles scored by how many of their listed skills you already hold',
    icon: Target,
    href: '/dashboard/ai/opportunity-radar',
    color: 'bg-blue-500',
    // The scan route carries requirePremium on the server. This card said
    // otherwise, so a free member was sent to the page rather than to billing
    // and met a 403 after filling the form in.
    premium: true,
  },
  {
    id: 'resume-optimizer',
    name: 'Resume Optimizer',
    // Not "rewritten against the role you want", which is what the public
    // directory promises: this returns a score, matched and missing keywords
    // and a list of suggestions. It has never rewritten a résumé.
    description: 'Scores your résumé against a role and lists what to change',
    icon: FileText,
    href: '/dashboard/ai/resume',
    color: 'bg-purple-500',
    premium: true,
  },
  {
    id: 'interview-coach',
    name: 'Interview Coach',
    description: 'Practice with AI-generated questions tailored to your target role',
    icon: MessageSquare,
    href: '/dashboard/ai/interview-coach',
    color: 'bg-green-500',
    premium: true,
  },
  {
    id: 'career-path',
    name: 'Career Path Analyzer',
    description: 'Get strategic guidance on your career trajectory',
    icon: TrendingUp,
    href: '/dashboard/ai/career-path',
    color: 'bg-orange-500',
    premium: true,
  },
  {
    id: 'content-generator',
    name: 'Content Generator',
    description: 'Create engaging posts and articles for your personal brand',
    icon: PenSquare,
    href: '/dashboard/ai/content-generator',
    color: 'bg-pink-500',
    premium: true,
  },
  {
    id: 'idea-validator',
    name: 'Business Idea Validator',
    description: 'Get AI feedback on your startup or business ideas',
    icon: Lightbulb,
    href: '/dashboard/ai/idea-validator',
    color: 'bg-yellow-500',
    premium: true,
  },
];

export default function AIToolsPage() {
  const { user } = useAuth();
  const isPremium = user?.subscriptionTier !== 'FREE';

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center">
          <Sparkles className="w-7 h-7 mr-2 text-primary-500" />
          AI Career Tools
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Supercharge your career with AI-powered insights and automation
        </p>
      </div>

      {/* Premium Banner for Free Users */}
      {!isPremium && (
        <div className="bg-gradient-to-r from-primary-500 to-secondary-500 rounded-2xl p-6 text-white">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <Crown className="w-6 h-6" />
                <span className="text-xl font-bold">Unlock Premium AI Tools</span>
              </div>
              {/* "Unlimited" was never true: every AI route on the server is
                  rate limited per minute whatever the tier. Premium removes the
                  free-tier quota, which is the thing worth saying. */}
              <p className="text-white/90 max-w-xl">
                Premium opens the Resume Optimizer, Interview Coach, Career Path Analyzer,
                Opportunity Radar and the rest, and lifts the free limit on ATHENA chat.
              </p>
            </div>
            <Link
              href="/dashboard/settings/billing"
              className="mt-4 md:mt-0 inline-flex items-center px-6 py-3 bg-white text-primary-600 rounded-lg font-semibold hover:bg-slate-100 transition"
            >
              Upgrade Now
              <ArrowRight className="w-5 h-5 ml-2" />
            </Link>
          </div>
        </div>
      )}

      {/* Quick Chat */}
      <div className="card">
        <div className="flex items-start space-x-4">
          <div className="w-12 h-12 bg-athena-gradient rounded-lg flex items-center justify-center">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-slate-900 dark:text-white">
              Ask ATHENA Anything
            </h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
              Get instant career advice from your AI assistant
            </p>
            <div className="mt-4">
              <Link
                href="/dashboard/ai/chat"
                className="btn-primary inline-flex items-center"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Start Chat
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Tools Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tools.map((tool) => (
          <Link
            key={tool.id}
            href={tool.premium && !isPremium ? '/dashboard/settings/billing' : tool.href}
            className="card hover:shadow-md transition group relative"
          >
            {tool.premium && !isPremium && (
              <div className="absolute top-4 right-4">
                <span className="flex items-center space-x-1 px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                  <Crown className="w-3 h-3" />
                  <span>Premium</span>
                </span>
              </div>
            )}
            
            {'isNew' in tool && tool.isNew && (
              <div className="absolute top-4 right-4">
                <span className="px-2 py-1 bg-gradient-to-r from-primary-500 to-secondary-500 text-white rounded-full text-xs font-medium">
                  NEW
                </span>
              </div>
            )}
            
            <div className={`w-12 h-12 ${tool.color} rounded-lg flex items-center justify-center mb-4`}>
              <tool.icon className="w-6 h-6 text-white" />
            </div>
            
            <h3 className="font-semibold text-slate-900 dark:text-white group-hover:text-primary-600 transition">
              {tool.name}
            </h3>
            
            <p className="text-slate-600 dark:text-slate-400 text-sm mt-2">
              {tool.description}
            </p>
            
            <div className="mt-4 flex items-center text-primary-600 text-sm font-medium">
              {tool.premium && !isPremium ? 'Upgrade to access' : 'Get started'}
              <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition" />
            </div>
          </Link>
        ))}
      </div>

      {/* How it works
          "Our AI creates personalized recommendations just for you" was
          printed under a grid in which six of the twelve tools never call a
          model at all — they read ATHENA's own tables. Saying which tools use
          a model and which count rows is the difference between a woman
          trusting a figure for the right reason and trusting it for the wrong
          one. */}
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">
          How these tools work
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-xl font-bold text-primary-600">1</span>
            </div>
            <h3 className="font-medium text-slate-900 dark:text-white">Tell us your goals</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Share your career aspirations and current situation
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-xl font-bold text-primary-600">2</span>
            </div>
            <h3 className="font-medium text-slate-900 dark:text-white">Two different kinds of answer</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              The Premium tools send what you write to a language model. CareerCompass,
              OpportunityScan, SalaryEquity, MentorMatch, Trust Score and Creator Analytics
              read ATHENA&apos;s own listings and records — no model, and no forecast.
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-xl font-bold text-primary-600">3</span>
            </div>
            <h3 className="font-medium text-slate-900 dark:text-white">Take action</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Each tool shows what its answer was built from, so you can weigh it yourself
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
