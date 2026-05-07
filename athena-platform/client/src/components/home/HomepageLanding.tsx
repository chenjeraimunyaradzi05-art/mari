import Image from 'next/image';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  BookOpen,
  Briefcase,
  Building2,
  Check,
  Coins,
  Command,
  Globe2,
  GraduationCap,
  MessageSquare,
  Radar,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { ClientOnly } from '@/components/ClientOnly';
import PublicThemeToggle from '@/components/theme/PublicThemeToggle';

const navLinks = [
  { href: '/jobs', label: 'Jobs' },
  { href: '/mentors', label: 'Mentors' },
  { href: '/feed', label: 'Community' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/help/safety-center', label: 'Safety' },
];

const shortcuts = [
  { href: '/jobs', label: 'Jobs', icon: Briefcase },
  { href: '/mentors', label: 'Mentors', icon: Users },
  { href: '/feed', label: 'Community', icon: MessageSquare },
  { href: '/dashboard/ai/chat', label: 'AI', icon: Sparkles },
];

const commandSignals = [
  { label: 'Role match', value: '92%', icon: Radar, tone: 'text-emerald-600' },
  { label: 'Mentor fit', value: '8 new', icon: Users, tone: 'text-sky-600' },
  { label: 'Skills gap', value: '3 tasks', icon: BookOpen, tone: 'text-amber-600' },
  { label: 'Trust state', value: 'clear', icon: ShieldCheck, tone: 'text-rose-600' },
];

const intelligenceCards = [
  {
    icon: Search,
    title: 'Opportunity radar',
    description: 'A focused search layer for roles, companies, saved jobs, and application movement.',
    href: '/jobs',
  },
  {
    icon: Sparkles,
    title: 'AI career co-pilot',
    description: 'Resume positioning, interview prep, and career planning inside the same workspace.',
    href: '/dashboard/ai',
  },
  {
    icon: Users,
    title: 'Human network',
    description: 'Mentors, peers, groups, and events designed to turn ambition into accountable progress.',
    href: '/mentors',
  },
  {
    icon: Coins,
    title: 'Earning engine',
    description: 'Creator, mentor, employer, and learning paths that help expertise become durable income.',
    href: '/pricing',
  },
];

const operatingLayers = [
  {
    eyebrow: 'Discover',
    title: 'Find the next move',
    description: 'Search roles, compare opportunities, and build a shortlist without losing context.',
    icon: Briefcase,
  },
  {
    eyebrow: 'Prepare',
    title: 'Raise your signal',
    description: 'Use AI tools, learning paths, mentor feedback, and profile improvements together.',
    icon: GraduationCap,
  },
  {
    eyebrow: 'Connect',
    title: 'Work with the right people',
    description: 'Move from isolated searching into communities, events, messages, and support loops.',
    icon: MessageSquare,
  },
];

const audienceRoutes = [
  { label: 'Job seekers', href: '/register', icon: Briefcase },
  { label: 'Employers', href: '/employer', icon: Building2 },
  { label: 'Mentors', href: '/dashboard/mentors/become-mentor', icon: Users },
  { label: 'Developers', href: '/developers', icon: Command },
];

const platformChecks = [
  'Neon-ready PostgreSQL configuration',
  'Netlify frontend and portable backend runtime',
  'GDPR-aware consent, safety, moderation, and audit surfaces',
  'Stripe subscriptions, AI routes, messaging, jobs, and learning paths',
];

function SignalPanel() {
  return (
    <div className="border border-white/15 bg-slate-950/70 p-4 text-white shadow-2xl shadow-slate-950/30 backdrop-blur">
      <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-slate-950">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold">ATHENA Signal Console</div>
            <div className="text-xs text-slate-400">Live growth pathways</div>
          </div>
        </div>
        <span className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-200">
          Online
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {commandSignals.map((signal) => (
          <div key={signal.label} className="border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center justify-between">
              <signal.icon className={`h-5 w-5 ${signal.tone}`} />
              <span className="text-lg font-semibold">{signal.value}</span>
            </div>
            <div className="mt-3 text-sm text-slate-300">{signal.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 border border-white/10 bg-white/[0.04] p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Zap className="h-4 w-4 text-amber-300" />
          Suggested next action
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Update your profile, compare three matched roles, and send one mentor request before your next application.
        </p>
      </div>
    </div>
  );
}

export default function HomepageLanding() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <Image src="/logo.svg" alt="ATHENA" width={40} height={40} className="rounded-lg" />
            <div className="min-w-0">
              <div className="text-sm font-semibold tracking-wide text-slate-950 dark:text-white">ATHENA</div>
              <div className="truncate text-xs text-slate-500 dark:text-slate-400">Career intelligence platform</div>
            </div>
          </Link>

          <div className="hidden items-center gap-6 lg:flex">
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

          <div className="flex items-center gap-2">
            <div className="hidden sm:block">
              <ClientOnly>
                <PublicThemeToggle />
              </ClientOnly>
            </div>
            <Link href="/login" className="btn-ghost">
              Sign in
            </Link>
            <Link href="/register" className="btn-primary">
              Join free
            </Link>
          </div>
        </div>

        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 pb-4 sm:px-6 lg:hidden lg:px-8">
          {shortcuts.map((shortcut) => (
            <Link
              key={shortcut.href}
              href={shortcut.href}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
            >
              <shortcut.icon className="h-4 w-4" />
              {shortcut.label}
            </Link>
          ))}
        </div>
      </nav>

      <main>
        <section className="bg-[linear-gradient(135deg,#0f172a_0%,#111827_42%,#0b3b3a_100%)] text-white">
          <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1fr)_27rem] lg:px-8">
            <div>
              <div className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-teal-100">
                <Globe2 className="h-4 w-4" />
                Built for global career momentum
              </div>
              <h1 className="mt-6 max-w-4xl text-5xl font-semibold leading-none text-white sm:text-6xl lg:text-7xl">
                A career command center for women building the future.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-slate-200 sm:text-lg">
                ATHENA connects jobs, mentors, learning, community, AI coaching, and earning pathways in one
                intelligent workspace.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/register" className="inline-flex items-center justify-center rounded-lg bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100">
                  Start your workspace
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
                <Link href="/jobs" className="inline-flex items-center justify-center rounded-lg border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
                  Explore roles
                </Link>
              </div>

              <div className="mt-10 grid gap-3 sm:grid-cols-3">
                {['Jobs', 'Mentors', 'AI coach'].map((item) => (
                  <div key={item} className="border border-white/10 bg-white/[0.04] p-4">
                    <div className="text-2xl font-semibold">{item}</div>
                    <div className="mt-1 text-sm text-slate-300">Connected in one flow</div>
                  </div>
                ))}
              </div>
            </div>

            <SignalPanel />
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="kicker">Intelligence layer</div>
              <h2 className="mt-2 max-w-3xl text-3xl font-semibold text-slate-950 dark:text-white">
                Futuristic where it matters: faster decisions, better signal, less scattered work.
              </h2>
            </div>
            <Link href="/dashboard/ai" className="inline-flex items-center text-sm font-semibold text-primary-700 dark:text-primary-300">
              Open AI tools
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {intelligenceCards.map((card) => (
              <Link key={card.title} href={card.href} className="panel group p-5 transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-slate-950 dark:bg-slate-800 dark:text-white">
                    <card.icon className="h-5 w-5" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-900 dark:group-hover:text-white" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-slate-950 dark:text-white">{card.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">{card.description}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/50">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-3 lg:px-8">
            {operatingLayers.map((layer) => (
              <div key={layer.title} className="border-l-2 border-slate-200 pl-5 dark:border-slate-700">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-950 dark:bg-slate-800 dark:text-white">
                  <layer.icon className="h-5 w-5" />
                </div>
                <div className="mt-5 text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  {layer.eyebrow}
                </div>
                <h3 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{layer.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">{layer.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
            <div>
              <div className="kicker">Routes for every growth mode</div>
              <h2 className="mt-2 max-w-3xl text-3xl font-semibold text-slate-950 dark:text-white">
                Move from public discovery into the dashboard when you are ready to act.
              </h2>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {audienceRoutes.map((route) => (
                  <Link key={route.href} href={route.href} className="panel group flex items-center justify-between gap-4 p-5 transition hover:shadow-md">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                        <route.icon className="h-5 w-5" />
                      </div>
                      <span className="font-semibold text-slate-950 dark:text-white">{route.label}</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5" />
                  </Link>
                ))}
              </div>
            </div>

            <div className="panel p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
                <ShieldCheck className="h-4 w-4 text-primary-600" />
                Production posture
              </div>
              <div className="mt-4 space-y-3">
                {platformChecks.map((check) => (
                  <div key={check} className="flex gap-3 text-sm leading-6 text-slate-700 dark:text-slate-300">
                    <Check className="mt-1 h-4 w-4 shrink-0 text-primary-600" />
                    {check}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
          <div className="bg-slate-950 p-8 text-white dark:border dark:border-slate-800">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div>
                <div className="kicker text-slate-400">Launch the next chapter</div>
                <h2 className="mt-3 max-w-3xl text-3xl font-semibold text-white">
                  One account. Every route into opportunity, support, learning, and income.
                </h2>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/register" className="inline-flex items-center justify-center rounded-lg bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100">
                  Create account
                </Link>
                <Link href="/dashboard/ai/chat" className="inline-flex items-center justify-center rounded-lg border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
                  Ask ATHENA AI
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-slate-500 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8 dark:text-slate-400">
          <div className="flex items-center gap-3">
            <Image src="/logo.svg" alt="ATHENA" width={32} height={32} className="rounded-lg" />
            <span>ATHENA. Built for career momentum by Munyaradzi Chenjerai.</span>
          </div>
          <div className="flex flex-wrap gap-4">
            <Link href="/privacy" className="hover:text-slate-950 dark:hover:text-white">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-950 dark:hover:text-white">Terms</Link>
            <Link href="/developers" className="hover:text-slate-950 dark:hover:text-white">Developers</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
