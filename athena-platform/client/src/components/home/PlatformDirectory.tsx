'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Banknote, Bot, Briefcase, Building2, Compass, GraduationCap, Heart, LayoutGrid, Lock, ShieldCheck, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Rail } from './RailShell';

/**
 * The whole platform, on the front page.
 *
 * ATHENA has around 150 routes and the homepage previously named fifteen of
 * them, so most of what the product does was reachable only by already knowing
 * the URL. This lists every member-facing surface, grouped the way someone
 * would actually go looking: pick a group, see its doors as cards.
 *
 * Two rules keep it honest:
 *
 *  1. Every href here resolves. The list was built from `src/app/**\/page.tsx`
 *     and each one was requested against a running server — the public ones
 *     answer 200 and the rest redirect to /login carrying a `redirect` param,
 *     so a signed-out visitor lands where they meant to go after signing in.
 *     Nothing here is aspirational, and nothing 404s.
 *  2. `gated: true` marks the ones behind sign-in, so the padlock sets the
 *     expectation before the click rather than after it.
 *
 * When you add a page, add it here. A surface nobody can find is a surface that
 * does not exist.
 */

type Destination = {
  href: string;
  label: string;
  blurb: string;
  gated?: boolean;
};

type Group = {
  id: string;
  title: string;
  intro: string;
  icon: typeof Briefcase;
  tint: string;
  items: Destination[];
};

const GROUPS: Group[] = [
  {
    id: 'work',
    title: 'Find work',
    intro: 'Roles, contracts and paid training, with the money named up front.',
    icon: Briefcase,
    tint: 'from-rose-500 to-pink-500',
    items: [
      { href: '/jobs', label: 'Jobs', blurb: 'Open roles from employers who publish the salary' },
      { href: '/apprenticeships', label: 'Apprenticeships', blurb: 'Paid on-the-job training with a registered provider' },
      { href: '/rfps', label: 'Contracts & tenders', blurb: 'Work put out to bid you can quote on' },
      { href: '/skills-marketplace', label: 'Skills marketplace', blurb: 'Sell what you can do, by the hour or as a package' },
      { href: '/salary-insights', label: 'Salary insights', blurb: 'What a role actually pays, and where the gap is' },
      { href: '/employer', label: 'For employers', blurb: 'Post a role and reach women directly' },
      { href: '/dashboard/applications', label: 'Your applications', blurb: 'Everything you have applied for, and where it got to', gated: true },
      { href: '/dashboard/saved-jobs', label: 'Saved jobs', blurb: 'The roles you kept to come back to', gated: true },
    ],
  },
  {
    id: 'learn',
    title: 'Learn something',
    intro: 'Courses, credentials and the training that leads somewhere.',
    icon: GraduationCap,
    tint: 'from-violet-500 to-indigo-500',
    items: [
      { href: '/learning', label: 'Learning', blurb: 'Courses, and what happened to the people who finished' },
      { href: '/courses', label: 'Course catalogue', blurb: 'Everything on offer, filterable' },
      { href: '/certifications', label: 'Certificates', blurb: 'Yours, and the courses that issue one' },
      { href: '/skills', label: 'Skills', blurb: 'Map what you can do, and what is worth learning next' },
      { href: '/dashboard/learn/my-courses', label: 'My courses', blurb: 'Pick up where you stopped', gated: true },
      { href: '/dashboard/learn/providers', label: 'Training providers', blurb: 'Who runs the training, and their outcomes', gated: true },
    ],
  },
  {
    id: 'people',
    title: 'People and community',
    intro: 'Mentors, smaller rooms, and the people already doing it.',
    icon: Users,
    tint: 'from-amber-400 to-orange-500',
    items: [
      { href: '/mentors', label: 'Mentors', blurb: 'Book time with someone who has done it before' },
      { href: '/mentorship', label: 'How mentoring works', blurb: 'What to expect, and what it costs' },
      { href: '/communities', label: 'Communities', blurb: 'Smaller rooms by industry, stage and city' },
      { href: '/groups', label: 'Groups', blurb: 'Join a group, or start one' },
      { href: '/events', label: 'Events', blurb: 'Meetups, workshops and online sessions' },
      { href: '/network', label: 'Network', blurb: 'People worth knowing, near you and in your field' },
      { href: '/stories', label: 'Member stories', blurb: 'What actually changed for women here' },
      { href: '/dashboard/messages', label: 'Messages', blurb: 'Your conversations, with the safety controls on', gated: true },
    ],
  },
  {
    id: 'watch',
    title: 'Watch and share',
    intro: 'Short video, long video, and the daily feed.',
    icon: Compass,
    tint: 'from-fuchsia-500 to-purple-600',
    items: [
      { href: '/explore', label: 'Reels', blurb: 'Ninety-second career wins, salary talk and founder stories' },
      { href: '/videos', label: 'Videos', blurb: 'The longer things: talks, walkthroughs, panels' },
      { href: '/feed', label: 'Feed', blurb: 'What everyone is talking about today' },
      { href: '/discover', label: 'Discover', blurb: 'Everything new, in one place' },
      { href: '/explore/saved', label: 'Saved reels', blurb: 'The ones you kept' },
      { href: '/dashboard/create-post', label: 'Post something', blurb: 'Share a win, ask the awkward question', gated: true },
      { href: '/dashboard/creator-studio', label: 'Creator studio', blurb: 'Upload, schedule and see how it performed', gated: true },
    ],
  },
  {
    id: 'money',
    title: 'Money and business',
    intro: 'Earning here, and running the business side of it.',
    icon: Banknote,
    tint: 'from-emerald-400 to-teal-500',
    items: [
      { href: '/finances', label: 'Finances', blurb: 'Money coming in, money going out' },
      { href: '/business', label: 'Business', blurb: 'The tools for running one' },
      { href: '/formation', label: 'Company formation', blurb: 'Register a company, step by step' },
      { href: '/grants', label: 'Grants', blurb: 'Funding you are actually eligible for' },
      { href: '/capital', label: 'Capital', blurb: 'Investors, and what they are looking for' },
      { href: '/accelerator', label: 'Accelerator', blurb: 'The programme for founders getting going' },
      { href: '/growth', label: 'Growth', blurb: 'Grow the thing you have already started' },
      { href: '/vendors', label: 'Vendors', blurb: 'Suppliers other members have vetted' },
      { href: '/pricing', label: 'Plans and pricing', blurb: 'What is free, and what is not' },
      { href: '/dashboard/creator', label: 'Creator earnings', blurb: 'Gifts, subscriptions and brand work, paid out through Stripe', gated: true },
      { href: '/dashboard/finance/tax', label: 'Tax', blurb: 'GST, the BAS worksheet and what to set aside', gated: true },
      { href: '/dashboard/finance/super', label: 'Super', blurb: 'The retirement gap, and closing yours', gated: true },
      { href: '/dashboard/housing', label: 'Housing', blurb: 'Somewhere to live, and how to afford it', gated: true },
    ],
  },
  {
    id: 'ai',
    title: 'AI that does something useful',
    intro: 'Built on your own history here, not a chatbot bolted to the side.',
    icon: Bot,
    tint: 'from-sky-400 to-cyan-500',
    items: [
      { href: '/dashboard/ai/career-compass', label: 'Career Compass', blurb: 'Where your path realistically goes next', gated: true },
      { href: '/dashboard/ai/salary', label: 'Salary check', blurb: 'What you should be asking for, and the evidence', gated: true },
      { href: '/dashboard/ai/interview-coach', label: 'Interview coach', blurb: 'Practise the questions you are dreading', gated: true },
      { href: '/dashboard/ai/resume-optimizer', label: 'Résumé help', blurb: 'Rewritten against the role you want', gated: true },
      { href: '/dashboard/ai/opportunity-radar', label: 'Opportunity radar', blurb: 'Things worth going for, surfaced early', gated: true },
      { href: '/dashboard/ai/idea-validator', label: 'Idea validator', blurb: 'Pressure-test a business idea before you spend on it', gated: true },
      { href: '/dashboard/ai/content-generator', label: 'Content help', blurb: 'Drafts for posts, reels and pitches', gated: true },
      { href: '/dashboard/ai/chat', label: 'Ask ATHENA', blurb: 'The general one, for everything else', gated: true },
    ],
  },
  {
    id: 'safety',
    title: 'Safety, trust and privacy',
    intro: 'The part that makes the rest of it possible.',
    icon: ShieldCheck,
    tint: 'from-rose-500 to-purple-600',
    items: [
      { href: '/safety-center', label: 'Safety centre', blurb: 'Controls, and what to do if something happens' },
      { href: '/report', label: 'Report something', blurb: 'One form, one moderation queue, a real human' },
      { href: '/trust', label: 'Trust centre', blurb: 'Verification, and how we score it' },
      { href: '/privacy-center', label: 'Privacy centre', blurb: 'See, export or delete what we hold' },
      { href: '/help/community-guidelines', label: 'Community guidelines', blurb: 'What is and is not on here' },
      { href: '/help/transparency-report', label: 'Transparency report', blurb: 'What we actioned, and how much of it' },
      { href: '/help/appeal', label: 'Appeal a decision', blurb: 'If we got it wrong, say so' },
      { href: '/accessibility', label: 'Accessibility', blurb: 'How the product is built to be usable' },
      { href: '/safety', label: 'Safety overview', blurb: 'The short version of all of the above' },
    ],
  },
  {
    id: 'impact',
    title: 'Impact',
    intro: 'What all of this adds up to, measured rather than claimed.',
    icon: Heart,
    tint: 'from-amber-400 to-rose-500',
    items: [
      { href: '/impact', label: 'Impact', blurb: 'The numbers, and how they are counted' },
      { href: '/ecosystem', label: 'Ecosystem', blurb: 'Partners, providers and who else is involved' },
      { href: '/community', label: 'Community', blurb: 'The wider picture beyond your own rooms' },
      { href: '/dashboard/impact/programs', label: 'Programmes', blurb: 'Targeted support you may be eligible for', gated: true },
      { href: '/dashboard/impact/reports', label: 'Impact reports', blurb: 'The published measurement', gated: true },
    ],
  },
  {
    id: 'company',
    title: 'About ATHENA',
    intro: 'Who is behind it, and how to reach us.',
    icon: Building2,
    tint: 'from-slate-500 to-slate-700',
    items: [
      { href: '/about', label: 'About', blurb: 'Why this exists' },
      { href: '/team', label: 'Team', blurb: 'The people building it' },
      { href: '/careers', label: 'Careers', blurb: 'Work here' },
      { href: '/press', label: 'Press', blurb: 'For journalists' },
      { href: '/blog', label: 'Blog', blurb: 'Longer writing' },
      { href: '/changelog', label: 'Changelog', blurb: 'What shipped, and when' },
      { href: '/status', label: 'Status', blurb: 'Whether anything is down right now' },
      { href: '/developers', label: 'Developers', blurb: 'The API, and how to build on it' },
      { href: '/help', label: 'Help centre', blurb: 'Answers, and a way to reach a person' },
      { href: '/contact', label: 'Contact', blurb: 'Say hello' },
    ],
  },
];

export function PlatformDirectory() {
  const reduce = useReducedMotion();
  const [activeId, setActiveId] = useState(GROUPS[0].id);
  const active = GROUPS.find((g) => g.id === activeId) ?? GROUPS[0];
  const total = GROUPS.reduce((sum, g) => sum + g.items.length, 0);

  return (
    <Rail icon={LayoutGrid} tone="rose" kicker="Everything here" title="Explore the whole platform" titleId="directory-heading" description={`${total} places to go, grouped by what you came for. A padlock means you need an account; sign in and you land straight back on the page you picked.`}>
      <div role="tablist" aria-label="Areas of the platform" className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-2">
        {GROUPS.map((group) => {
          const on = group.id === active.id;
          return (
            <button
              key={group.id}
              type="button"
              role="tab"
              id={`directory-tab-${group.id}`}
              aria-selected={on}
              aria-controls={`directory-panel-${group.id}`}
              onClick={() => setActiveId(group.id)}
              className={cn(
                'focusable relative flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold transition',
                on ? 'text-white' : 'text-slate-600 hover:bg-rose-50 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white'
              )}
            >
              {on && <motion.span layoutId={reduce ? undefined : 'directory-active'} aria-hidden className={cn('absolute inset-0 rounded-full bg-gradient-to-r', group.tint)} transition={{ type: 'spring', stiffness: 380, damping: 30 }} />}
              <group.icon className="relative z-10 h-3.5 w-3.5" />
              <span className="relative z-10">{group.title}</span>
              <span className={cn('relative z-10 rounded-full px-1.5 text-[10px] tabular-nums', on ? 'bg-white/25' : 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400')}>{group.items.length}</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={active.id}
          id={`directory-panel-${active.id}`}
          role="tabpanel"
          aria-labelledby={`directory-tab-${active.id}`}
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? undefined : { opacity: 0, y: -6 }}
          transition={{ duration: 0.22 }}
          className="mt-3"
        >
          <p className="text-sm text-slate-600 dark:text-slate-400">{active.intro}</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {active.items.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="tile-glass group flex h-full items-start gap-3 p-3.5">
                  <span className={cn('mt-0.5 h-8 w-1 flex-shrink-0 rounded-full bg-gradient-to-b', active.tint)} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-white">
                      <span className="truncate">{item.label}</span>
                      {item.gated && <Lock className="h-3 w-3 flex-shrink-0 text-slate-400" aria-label="Sign in required" />}
                    </span>
                    <span className="mt-0.5 block text-xs leading-5 text-slate-500 dark:text-slate-400">{item.blurb}</span>
                  </span>
                  <ArrowRight className="mt-1 h-3.5 w-3.5 flex-shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-rose-500 dark:text-slate-600" />
                </Link>
              </li>
            ))}
          </ul>
        </motion.div>
      </AnimatePresence>
    </Rail>
  );
}

export default PlatformDirectory;
