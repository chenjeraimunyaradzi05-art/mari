import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  Building2,
  Check,
  Coins,
  Globe2,
  GraduationCap,
  LayoutGrid,
  MessageSquare,
  Minus,
  Radar,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import { ClientOnly } from '@/components/ClientOnly';
import PublicThemeToggle from '@/components/theme/PublicThemeToggle';

const navLinks = [
  { href: '/jobs', label: 'Jobs' },
  { href: '/mentors', label: 'Mentors' },
  { href: '/feed', label: 'Community' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/help/safety-center', label: 'Trust & Safety' },
];

const headlineStats = [
  { value: '01', label: 'workspace for jobs, mentors, learning, and AI' },
  { value: '04', label: 'growth lanes connected in one product' },
  { value: 'Dark', label: 'default mode with instant light-mode option' },
  { value: 'Live', label: 'entry points linked to real routes and flows' },
];

const pillars = [
  {
    icon: Search,
    title: 'Opportunity discovery',
    description:
      'Find roles, save matches, track applications, and surface smarter recommendations from one system.',
    tone: 'bg-sky-100 text-sky-700',
  },
  {
    icon: Sparkles,
    title: 'AI guidance that helps',
    description:
      'Use resume optimization, interview prep, and career coaching where the work actually happens.',
    tone: 'bg-amber-100 text-amber-700',
  },
  {
    icon: Users,
    title: 'Community with real utility',
    description:
      'Join groups, attend events, message peers and mentors, and stay close to the right people.',
    tone: 'bg-emerald-100 text-emerald-700',
  },
  {
    icon: GraduationCap,
    title: 'Learning and monetization',
    description:
      'Take courses, book mentorship, publish content, and create repeatable income pathways.',
    tone: 'bg-rose-100 text-rose-700',
  },
];

const audiences = [
  {
    icon: Briefcase,
    eyebrow: 'For job seekers',
    title: 'Move from searching to momentum',
    description:
      'Build your profile, improve your story, find better-fit roles, and stay accountable with tools and people around you.',
    cta: 'Start free',
    href: '/register',
    accent: 'border-sky-200 bg-sky-50/80',
  },
  {
    icon: Building2,
    eyebrow: 'For employers',
    title: 'Hire with signal, not noise',
    description:
      'Showcase culture, post roles, review applicants, and reach a mission-aligned professional community.',
    cta: 'Explore hiring',
    href: '/employer',
    accent: 'border-amber-200 bg-amber-50/80',
  },
  {
    icon: Coins,
    eyebrow: 'For creators and mentors',
    title: 'Turn expertise into revenue',
    description:
      'Offer sessions, courses, and content inside the same platform where your audience is already investing in growth.',
    cta: 'Teach on ATHENA',
    href: '/dashboard/mentors/become-mentor',
    accent: 'border-emerald-200 bg-emerald-50/80',
  },
];

const momentumLoop = [
  {
    icon: Radar,
    title: 'Match the next move',
    description: 'Start with jobs, mentors, learning, or community instead of a single rigid funnel.',
  },
  {
    icon: MessageSquare,
    title: 'Get support in context',
    description: 'Keep conversations, applications, events, and coaching connected to the same journey.',
  },
  {
    icon: TrendingUp,
    title: 'Compound over time',
    description: 'Return for referrals, new recommendations, mentor sessions, and recognition loops.',
  },
];

const launchpadCards = [
  {
    icon: Briefcase,
    title: 'Search roles',
    description: 'Browse public jobs, save the right ones, and move into tracked applications.',
    href: '/jobs',
    cta: 'Open jobs',
  },
  {
    icon: Users,
    title: 'Meet mentors',
    description: 'Explore mentor profiles, session offers, and guidance designed to keep momentum high.',
    href: '/mentors',
    cta: 'View mentors',
  },
  {
    icon: Sparkles,
    title: 'Open AI coach',
    description: 'Jump into ATHENA AI for resume help, interview prep, and career planning.',
    href: '/dashboard/ai/chat',
    cta: 'Launch AI',
  },
  {
    icon: MessageSquare,
    title: 'Join community',
    description: 'Move from isolated search to shared accountability with groups, events, and conversation.',
    href: '/feed',
    cta: 'Enter feed',
  },
  {
    icon: Coins,
    title: 'Compare plans',
    description: 'See which layer unlocks deeper AI, unlimited applications, and team-grade tooling.',
    href: '/pricing',
    cta: 'See pricing',
  },
  {
    icon: ShieldCheck,
    title: 'Review trust',
    description: 'Audit the platform safety posture, privacy controls, and deployment-readiness surfaces.',
    href: '/help/safety-center',
    cta: 'View safety',
  },
];

const operatorColumns = [
  {
    icon: Search,
    title: 'Find better-fit work',
    description: 'Search, shortlist, and manage opportunities without losing context across tabs and tools.',
    items: ['Public jobs directory', 'Saved roles and application tracking', 'AI-assisted positioning support'],
    href: '/jobs',
  },
  {
    icon: Users,
    title: 'Build trusted support',
    description: 'Meet peers, mentors, and communities that make career growth feel accountable, not lonely.',
    items: ['Mentor discovery', 'Groups and events', 'Messaging and community loops'],
    href: '/mentors',
  },
  {
    icon: BookOpen,
    title: 'Learn, teach, and earn',
    description: 'Move from growth to monetization with learning, creator, and expert-led revenue surfaces.',
    items: ['Course and learning paths', 'Mentor sessions', 'Creator and employer workflows'],
    href: '/learning',
  },
];

const planCards = [
  {
    name: 'Free',
    price: '$0',
    detail: 'Start building momentum',
    features: ['Basic job search', 'Community access', 'Profile setup', '5 applications per month'],
    accent: 'border-gray-200 bg-white',
  },
  {
    name: 'Pro',
    price: '$29/mo',
    detail: 'For active growth',
    features: ['Unlimited applications', 'AI resume optimizer', 'Interview coach', '1 mentor session included'],
    accent: 'border-amber-300 bg-amber-50/80',
    badge: 'Most popular',
  },
  {
    name: 'Enterprise',
    price: '$99/mo',
    detail: 'For teams and partners',
    features: ['Team management', 'Custom job boards', 'Analytics', 'SSO, SAML, and API access'],
    accent: 'border-sky-300 bg-sky-50/80',
  },
];

const capabilityMatrix = [
  {
    capability: 'Job discovery and saved roles',
    free: 'included',
    pro: 'included',
    enterprise: 'included',
  },
  {
    capability: 'Applications volume',
    free: 'limited',
    pro: 'included',
    enterprise: 'included',
  },
  {
    capability: 'AI resume and interview tools',
    free: 'preview',
    pro: 'included',
    enterprise: 'advanced',
  },
  {
    capability: 'Mentor and learning benefits',
    free: 'limited',
    pro: 'discounted',
    enterprise: 'advanced',
  },
  {
    capability: 'Hiring team workflows',
    free: 'none',
    pro: 'none',
    enterprise: 'team',
  },
  {
    capability: 'Security, analytics, and API access',
    free: 'none',
    pro: 'limited',
    enterprise: 'advanced',
  },
];

const trustSignals = [
  'Women-first product design with room for employers, mentors, and creators',
  'GDPR-aware consent, DSAR exports, moderation tooling, and audit trails',
  'Stripe subscriptions and regional payment-readiness for global expansion',
];

const ecosystemSignals = [
  'Jobs',
  'Mentorship',
  'Courses',
  'Events',
  'Messaging',
  'Feed',
  'Referrals',
  'AI coach',
];

const matrixTone: Record<string, { label: string; icon: typeof Check; className: string }> = {
  included: {
    label: 'Included',
    icon: Check,
    className: 'text-emerald-600 dark:text-emerald-300',
  },
  limited: {
    label: 'Limited',
    icon: Minus,
    className: 'text-amber-600 dark:text-amber-300',
  },
  preview: {
    label: 'Preview',
    icon: Sparkles,
    className: 'text-sky-600 dark:text-sky-300',
  },
  discounted: {
    label: 'Discounted',
    icon: Coins,
    className: 'text-amber-600 dark:text-amber-300',
  },
  team: {
    label: 'Team',
    icon: Users,
    className: 'text-violet-600 dark:text-violet-300',
  },
  advanced: {
    label: 'Advanced',
    icon: TrendingUp,
    className: 'text-sky-700 dark:text-sky-300',
  },
  none: {
    label: 'Not included',
    icon: Minus,
    className: 'text-slate-400 dark:text-slate-500',
  },
};

const surfaceClassName =
  'rounded-[2rem] border border-slate-200/80 bg-white/88 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur transition dark:border-white/10 dark:bg-slate-900/78 dark:shadow-[0_24px_80px_rgba(2,6,23,0.35)]';

function MatrixPill({ value }: { value: keyof typeof matrixTone }) {
  const tone = matrixTone[value];
  const Icon = tone.icon;

  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ${tone.className}`}>
      <Icon className="h-4 w-4" />
      {tone.label}
    </span>
  );
}

export default function HomepageLanding() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fffdf8_0%,#fff8ee_26%,#f5f9ff_64%,#ffffff_100%)] text-slate-900 transition-colors dark:bg-[linear-gradient(180deg,#020617_0%,#0f172a_32%,#07111f_100%)] dark:text-slate-100">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[34rem] bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.22),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(45,212,191,0.18),_transparent_30%),radial-gradient(circle_at_center,_rgba(14,165,233,0.12),_transparent_45%)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.16),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(56,189,248,0.16),_transparent_28%),radial-gradient(circle_at_center,_rgba(59,130,246,0.14),_transparent_42%)]"
      />

      <nav className="sticky top-0 z-50 border-b border-white/70 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/72">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logo.svg" alt="ATHENA" width={38} height={38} className="rounded-2xl" />
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-600 dark:text-amber-300">
                ATHENA
              </div>
              <div className="text-sm font-medium text-slate-500 dark:text-slate-400">Career superapp</div>
            </div>
          </Link>

          <div className="hidden items-center gap-7 lg:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-slate-600 transition hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:block">
              <ClientOnly>
                <PublicThemeToggle />
              </ClientOnly>
            </div>
            <Link href="/login" className="text-sm font-medium text-slate-600 transition hover:text-slate-950 dark:text-slate-300 dark:hover:text-white">
              Sign in
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
            >
              Join free
            </Link>
          </div>
        </div>
      </nav>

      <main>
        <section className="mx-auto max-w-7xl px-4 pb-12 pt-10 sm:px-6 lg:px-8 lg:pb-16 lg:pt-16">
          <div className="grid gap-6 lg:grid-cols-12">
            <div className={`${surfaceClassName} p-8 lg:col-span-7 xl:p-10`}>
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-1.5 text-sm font-medium text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
                <Sparkles className="h-4 w-4" />
                Jobs, mentors, learning, community, and AI coaching in one platform
              </div>

              <h1 className="mt-6 max-w-4xl text-5xl font-semibold leading-[0.94] tracking-[-0.04em] text-slate-950 sm:text-6xl xl:text-7xl dark:text-white">
                The career superapp for women building what comes next.
              </h1>

              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
                Search roles, book mentors, build skills, join career communities, and get AI guidance from one
                trusted workspace designed for long-term momentum.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/register"
                  className="inline-flex items-center rounded-full bg-slate-950 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                >
                  Join free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
                <Link
                  href="/pricing"
                  className="inline-flex items-center rounded-full border border-slate-200 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950 dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
                >
                  View pricing
                </Link>
              </div>

              <div className="mt-10 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {headlineStats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-3xl border border-slate-200 bg-slate-50/90 px-4 py-5 dark:border-white/10 dark:bg-white/5"
                  >
                    <div className="text-2xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">{stat.value}</div>
                    <div className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-5 lg:col-span-5">
              <div className="rounded-[2rem] border border-slate-200 bg-slate-950 p-6 text-white shadow-[0_24px_80px_rgba(15,23,42,0.16)] dark:border-sky-400/20 dark:bg-[linear-gradient(145deg,#0f172a_0%,#111827_55%,#0b1120_100%)]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-300">
                      AI concierge
                    </div>
                    <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
                      The homepage now points to real product surfaces
                    </h2>
                  </div>
                  <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-slate-200">
                    Dark-first
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  {momentumLoop.map((item) => (
                    <div
                      key={item.title}
                      className="rounded-3xl border border-white/10 bg-white/5 p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-400/15 text-teal-200">
                          <item.icon className="h-5 w-5" />
                        </div>
                        <h3 className="text-base font-semibold">{item.title}</h3>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-300">{item.description}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center gap-3">
                    <LayoutGrid className="h-5 w-5 text-sky-200" />
                    <div>
                      <p className="text-sm font-semibold text-white">Faster pathways from the homepage</p>
                      <p className="text-sm text-slate-300">
                        Jump straight into jobs, mentors, pricing, safety, or AI with no dead-end cards.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[2rem] border border-emerald-200 bg-emerald-50/85 p-6 dark:border-emerald-400/20 dark:bg-emerald-400/10">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                  <ShieldCheck className="h-4 w-4" />
                  Designed for trust, privacy, and production-readiness
                </div>
                <div className="mt-4 space-y-3">
                  {trustSignals.map((signal) => (
                    <div key={signal} className="rounded-2xl border border-emerald-100 bg-white/80 p-4 text-sm leading-6 text-slate-700 dark:border-white/10 dark:bg-slate-950/45 dark:text-slate-200">
                      {signal}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className={`${surfaceClassName} px-6 py-6`}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                  One connected ecosystem
                </div>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
                  Professional growth should not feel fragmented.
                </h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {ecosystemSignals.map((signal) => (
                  <span
                    key={signal}
                    className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                  >
                    {signal}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                Launchpad
              </div>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
                Homepage shortcuts that open the real product.
              </h2>
            </div>
            <Link href="/register" className="text-sm font-semibold text-slate-950 transition hover:text-amber-700 dark:text-white dark:hover:text-amber-300">
              Create your account
            </Link>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {launchpadCards.map((card) => (
              <div
                key={card.title}
                className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg dark:border-white/10 dark:bg-slate-900/75 dark:shadow-[0_16px_48px_rgba(2,6,23,0.3)]"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-900 dark:bg-white/10 dark:text-white">
                  <card.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">{card.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">{card.description}</p>
                <Link
                  href={card.href}
                  className="mt-5 inline-flex items-center text-sm font-semibold text-slate-950 transition hover:text-amber-700 dark:text-white dark:hover:text-amber-300"
                >
                  {card.cta}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                Product pillars
              </div>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
                Everything needed to turn ambition into repeatable progress.
              </h2>
            </div>
            <Link href="/dashboard/ai" className="text-sm font-semibold text-slate-950 transition hover:text-amber-700 dark:text-white dark:hover:text-amber-300">
              Explore AI tools
            </Link>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {pillars.map((pillar) => (
              <div
                key={pillar.title}
                className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg dark:border-white/10 dark:bg-slate-900/75 dark:shadow-[0_16px_48px_rgba(2,6,23,0.3)]"
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${pillar.tone} dark:bg-white/10 dark:text-white`}>
                  <pillar.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">{pillar.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">{pillar.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-5 lg:grid-cols-3">
            {operatorColumns.map((column) => (
              <div
                key={column.title}
                className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm dark:border-white/10 dark:bg-slate-900/75 dark:shadow-[0_16px_48px_rgba(2,6,23,0.3)]"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-900 dark:bg-white/10 dark:text-white">
                  <column.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-2xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
                  {column.title}
                </h3>
                <p className="mt-4 text-sm leading-7 text-slate-700 dark:text-slate-300">{column.description}</p>
                <div className="mt-5 space-y-3">
                  {column.items.map((item) => (
                    <div
                      key={item}
                      className="rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3 text-sm text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                    >
                      {item}
                    </div>
                  ))}
                </div>
                <Link
                  href={column.href}
                  className="mt-6 inline-flex items-center text-sm font-semibold text-slate-950 transition hover:text-amber-700 dark:text-white dark:hover:text-amber-300"
                >
                  Explore route
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-5 lg:grid-cols-3">
            {audiences.map((audience) => (
              <div
                key={audience.title}
                className={`rounded-[2rem] border p-7 shadow-sm dark:border-white/10 dark:bg-slate-900/75 dark:text-white ${audience.accent}`}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-900 shadow-sm dark:bg-white/10 dark:text-white">
                  <audience.icon className="h-5 w-5" />
                </div>
                <div className="mt-5 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                  {audience.eyebrow}
                </div>
                <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
                  {audience.title}
                </h3>
                <p className="mt-4 text-sm leading-7 text-slate-700 dark:text-slate-300">{audience.description}</p>
                <Link
                  href={audience.href}
                  className="mt-6 inline-flex items-center text-sm font-semibold text-slate-950 transition hover:text-amber-700 dark:text-white dark:hover:text-amber-300"
                >
                  {audience.cta}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className={`${surfaceClassName} p-8 lg:p-10`}>
            <div className="max-w-3xl">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                Capability matrix
              </div>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
                A clearer table for what each plan unlocks.
              </h2>
              <p className="mt-4 text-base leading-8 text-slate-600 dark:text-slate-300">
                The production homepage now carries an actual matrix instead of a thin card stack, so pricing and
                product scope read clearly in both dark and light mode.
              </p>
            </div>

            <div className="mt-8 overflow-hidden rounded-[1.75rem] border border-slate-200 dark:border-white/10">
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-left">
                  <thead className="bg-slate-50/90 dark:bg-white/5">
                    <tr>
                      <th className="px-5 py-4 text-sm font-semibold text-slate-950 dark:text-white">Capability</th>
                      <th className="px-5 py-4 text-sm font-semibold text-slate-950 dark:text-white">Free</th>
                      <th className="px-5 py-4 text-sm font-semibold text-slate-950 dark:text-white">Pro</th>
                      <th className="px-5 py-4 text-sm font-semibold text-slate-950 dark:text-white">Enterprise</th>
                    </tr>
                  </thead>
                  <tbody>
                    {capabilityMatrix.map((row) => (
                      <tr key={row.capability} className="border-t border-slate-200 dark:border-white/10">
                        <td className="px-5 py-4 text-sm font-medium text-slate-900 dark:text-white">
                          {row.capability}
                        </td>
                        <td className="px-5 py-4">
                          <MatrixPill value={row.free as keyof typeof matrixTone} />
                        </td>
                        <td className="px-5 py-4">
                          <MatrixPill value={row.pro as keyof typeof matrixTone} />
                        </td>
                        <td className="px-5 py-4">
                          <MatrixPill value={row.enterprise as keyof typeof matrixTone} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Pricing</div>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
                Start free, then unlock deeper support as momentum grows.
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-7 text-slate-600 dark:text-slate-300">
              Pro includes a 14-day trial, and verified students and nonprofits receive 50% off.
            </p>
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {planCards.map((plan) => (
              <div key={plan.name} className={`rounded-[2rem] border p-7 shadow-sm dark:border-white/10 dark:bg-slate-900/75 ${plan.accent}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-slate-950 dark:text-white">{plan.name}</div>
                    <div className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">
                      {plan.price}
                    </div>
                    <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">{plan.detail}</div>
                  </div>
                  {plan.badge ? (
                    <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white">
                      {plan.badge}
                    </span>
                  ) : null}
                </div>

                <div className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <div key={feature} className="rounded-2xl bg-white/80 px-4 py-3 text-sm text-slate-700 dark:bg-white/5 dark:text-slate-200">
                      {feature}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-20 pt-12 sm:px-6 lg:px-8">
          <div className="rounded-[2.25rem] bg-slate-950 px-8 py-10 text-white shadow-[0_30px_120px_rgba(15,23,42,0.22)] dark:border dark:border-sky-400/20 dark:bg-[linear-gradient(145deg,#0f172a_0%,#111827_55%,#0b1120_100%)] lg:px-10 lg:py-12">
            <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-300">Get started</div>
                <h2 className="mt-3 text-4xl font-semibold tracking-[-0.04em]">
                  Build your next chapter with one platform designed for real momentum.
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-8 text-slate-300">
                  ATHENA helps ambitious professionals move from searching to growing to earning without losing
                  context along the way.
                </p>
              </div>

              <div className="flex flex-col gap-3 lg:col-span-4">
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                >
                  Create your ATHENA account
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
                <Link
                  href="/dashboard/ai/chat"
                  className="inline-flex items-center justify-center rounded-full border border-white/20 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Ask ATHENA AI
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white dark:border-white/10 dark:bg-slate-950/88">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:px-8">
          <div>
            <div className="flex items-center gap-3">
              <Image src="/logo.svg" alt="ATHENA" width={34} height={34} className="rounded-xl" />
              <div>
                <div className="text-sm font-semibold text-slate-950 dark:text-white">ATHENA</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">Jobs, mentorship, community, and AI guidance</div>
              </div>
            </div>
            <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600 dark:text-slate-300">
              ATHENA helps professionals grow, connect, learn, and earn from a single platform designed for
              long-term career momentum.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-950 dark:text-white">Platform</h3>
              <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                <div><Link href="/jobs" className="transition hover:text-slate-950 dark:hover:text-white">Jobs</Link></div>
                <div><Link href="/feed" className="transition hover:text-slate-950 dark:hover:text-white">Community</Link></div>
                <div><Link href="/pricing" className="transition hover:text-slate-950 dark:hover:text-white">Pricing</Link></div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-950 dark:text-white">Trust</h3>
              <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                <div><Link href="/help/community-guidelines" className="transition hover:text-slate-950 dark:hover:text-white">Community Guidelines</Link></div>
                <div><Link href="/help/safety-center" className="transition hover:text-slate-950 dark:hover:text-white">Safety Center</Link></div>
                <div><Link href="/privacy" className="transition hover:text-slate-950 dark:hover:text-white">Privacy</Link></div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-950 dark:text-white">Company</h3>
              <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                <div><Link href="/press" className="transition hover:text-slate-950 dark:hover:text-white">Press</Link></div>
                <div><Link href="/terms" className="transition hover:text-slate-950 dark:hover:text-white">Terms</Link></div>
                <div><Link href="/developers" className="transition hover:text-slate-950 dark:hover:text-white">Developers</Link></div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 dark:border-white/10">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-sm text-slate-500 dark:text-slate-400 sm:px-6 sm:flex-row sm:items-center sm:justify-between lg:px-8">
            <p>ATHENA. All rights reserved.</p>
            <p>Built for momentum across jobs, community, learning, and AI.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
