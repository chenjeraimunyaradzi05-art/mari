import Image from 'next/image';
import Link from 'next/link';
import { LiveCommunityFeed } from './LiveCommunityFeed';
import { HomeReelsRail } from './HomeReelsRail';
import {
  ArrowRight,
  Brain,
  Briefcase,
  Building2,
  Calendar,
  Command,
  Compass,
  DollarSign,
  Facebook,
  Gem,
  Globe2,
  GraduationCap,
  Heart,
  Instagram,
  Play,
  Radar,
  Rocket,
  ShieldCheck,
  Sparkles,
  Star,
  Twitter,
  Users,
  UsersRound,
  Video,
  Wand2,
} from 'lucide-react';
import { ClientOnly } from '@/components/ClientOnly';
import PublicThemeToggle from '@/components/theme/PublicThemeToggle';

const navLinks = [
  { href: '/jobs', label: 'Jobs' },
  { href: '/mentors', label: 'Mentors' },
  { href: '/feed', label: 'Social' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/help/safety-center', label: 'Safety' },
];

const shortcuts = [
  { href: '/jobs', label: 'Jobs', icon: Briefcase },
  { href: '/mentors', label: 'Mentors', icon: Users },
  { href: '/feed', label: 'Social', icon: Heart },
  { href: '/dashboard/ai/chat', label: 'AI', icon: Sparkles },
];

const socialLinks = [
  { href: 'https://instagram.com/athena.platform', label: 'Instagram', icon: Instagram },
  { href: 'https://facebook.com/athena.platform', label: 'Facebook', icon: Facebook },
  { href: 'https://x.com/athenaplatform', label: 'X (Twitter)', icon: Twitter },
];

const intelligenceCards = [
  {
    icon: Radar,
    title: 'Opportunity radar',
    description: 'A focused search layer for roles, companies, saved jobs, and application movement.',
    href: '/jobs',
    gradient: 'from-rose-500 via-pink-500 to-orange-400',
    glow: 'shadow-[0_20px_45px_-15px_rgba(244,63,94,0.55)]',
  },
  {
    icon: Wand2,
    title: 'AI career co-pilot',
    description: 'Resume positioning, interview prep, and career planning inside the same workspace.',
    href: '/dashboard/ai',
    gradient: 'from-fuchsia-500 via-purple-500 to-indigo-500',
    glow: 'shadow-[0_20px_45px_-15px_rgba(168,85,247,0.55)]',
  },
  {
    icon: UsersRound,
    title: 'Human network',
    description: 'Mentors, peers, groups, and events designed to turn ambition into accountable progress.',
    href: '/mentors',
    gradient: 'from-sky-400 via-cyan-400 to-teal-400',
    glow: 'shadow-[0_20px_45px_-15px_rgba(14,165,233,0.5)]',
  },
  {
    icon: Gem,
    title: 'Earning engine',
    description: 'Creator, mentor, employer, and learning paths that help expertise become durable income.',
    href: '/pricing',
    gradient: 'from-amber-400 via-orange-400 to-rose-400',
    glow: 'shadow-[0_20px_45px_-15px_rgba(245,158,11,0.55)]',
  },
];

const operatingLayers = [
  {
    eyebrow: 'Discover',
    title: 'Find the next move',
    description: 'Search roles, compare opportunities, and build a shortlist without losing context.',
    icon: Compass,
    gradient: 'from-rose-500 to-orange-400',
  },
  {
    eyebrow: 'Prepare',
    title: 'Raise your signal',
    description: 'Use AI tools, learning paths, mentor feedback, and profile improvements together.',
    icon: Rocket,
    gradient: 'from-fuchsia-500 to-purple-500',
  },
  {
    eyebrow: 'Connect',
    title: 'Work with the right people',
    description: 'Move from isolated searching into communities, events, messages, and support loops.',
    icon: Heart,
    gradient: 'from-pink-500 to-rose-400',
  },
];

const audienceRoutes = [
  { label: 'Job seekers', href: '/register', icon: Briefcase, gradient: 'from-rose-500 to-pink-500' },
  { label: 'Employers', href: '/employer', icon: Building2, gradient: 'from-indigo-500 to-purple-500' },
  { label: 'Mentors', href: '/dashboard/mentors/become-mentor', icon: Star, gradient: 'from-amber-500 to-orange-500' },
  { label: 'Developers', href: '/developers', icon: Command, gradient: 'from-sky-500 to-cyan-500' },
];

// The eight abilities that carry the product story. The previous sixteen made
// the section a wall of tiles nobody read.
const platformAbilities = [
  { icon: Heart, title: 'Social feed', description: 'Post wins, ask questions, follow women building in public.', gradient: 'from-pink-500 to-rose-500' },
  { icon: Video, title: 'Reels', description: 'Short-form career video, salary talk, and founder stories.', gradient: 'from-purple-500 to-fuchsia-500' },
  { icon: Users, title: 'Mentorship', description: 'Find mentors, run 1:1s, and track growth milestones.', gradient: 'from-sky-500 to-cyan-500' },
  { icon: Briefcase, title: 'Smart job search', description: 'AI-matched roles with salary insight and one-click apply.', gradient: 'from-rose-500 to-pink-500' },
  { icon: Brain, title: 'AI career coach', description: 'Always-on copilot for interview prep, planning, and mindset.', gradient: 'from-violet-500 to-indigo-500' },
  { icon: GraduationCap, title: 'Learning paths', description: 'Curated courses, micro-credentials, and skills tracks.', gradient: 'from-teal-500 to-emerald-500' },
  { icon: DollarSign, title: 'Earning pathways', description: 'Turn expertise into income as a creator, mentor, or consultant.', gradient: 'from-amber-500 to-orange-500' },
  { icon: ShieldCheck, title: 'Safety first', description: 'Built-in moderation, consent controls, and a safety centre.', gradient: 'from-rose-500 to-red-500' },
];

// Instagram-style sample feed preview (static, links to live feed)
export default function HomepageLanding() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <Image
              src="/icon.svg"
              alt="ATHENA"
              width={40}
              height={40}
              className="rounded-xl shadow-blossom ring-1 ring-rose-200/60 dark:ring-rose-400/20"
            />
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
                className="text-sm font-medium text-slate-600 transition hover:text-rose-600 dark:text-slate-300 dark:hover:text-rose-300"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-1 sm:flex">
              {socialLinks.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="hidden h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-500/10 dark:hover:text-rose-300 lg:flex"
                >
                  <s.icon className="h-4 w-4" />
                </a>
              ))}
            </div>
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
        {/* Hero */}
        <section className="relative overflow-hidden bg-aurora">
          <div className="cyber-grid pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" />
          <div className="relative mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1fr)_27rem] lg:px-8">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-rose-300/60 bg-white/70 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-rose-700 shadow-sm backdrop-blur dark:border-rose-400/30 dark:bg-white/5 dark:text-rose-200">
                <Globe2 className="h-3.5 w-3.5" />
                Built for global career momentum
              </div>
              <h1 className="mt-6 max-w-4xl font-display text-5xl font-semibold leading-[1.05] text-slate-900 sm:text-6xl lg:text-7xl dark:text-white">
                A career command center for women{' '}
                <span className="gradient-text-feminine">building the future.</span>
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-slate-700 sm:text-lg dark:text-slate-200">
                ATHENA connects jobs, mentors, learning, community, AI coaching, and earning pathways in one
                intelligent workspace designed for women&apos;s whole lives.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center rounded-xl bg-[linear-gradient(135deg,#f43f5e_0%,#a855f7_55%,#f59e0b_100%)] px-5 py-3 text-sm font-semibold text-white shadow-blossom transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-10px_rgba(244,63,94,0.55)]"
                >
                  Start your workspace
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
                <div className="hidden h-10 w-px bg-rose-200/60 dark:bg-rose-500/20 sm:block" />
                <Link
                  href="/jobs"
                  className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-white/70 px-5 py-3 text-sm font-semibold text-rose-700 backdrop-blur transition hover:bg-white dark:border-rose-400/30 dark:bg-white/5 dark:text-rose-200 dark:hover:bg-white/10"
                >
                  Explore roles
                </Link>
                <Link
                  href="/feed"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/70 px-5 py-3 text-sm font-semibold text-slate-800 backdrop-blur transition hover:bg-white dark:border-slate-700 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                >
                  <Heart className="h-4 w-4 text-rose-500" />
                  Social feed
                </Link>
              </div>

            </div>

            {/* Real posts, above the fold — the fastest way to show this is a
                living community rather than a brochure. */}
            <LiveCommunityFeed />
          </div>
        </section>

        {/* Intelligence layer */}
        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="kicker">Intelligence layer</div>
              <h2 className="mt-2 max-w-3xl text-3xl font-semibold text-slate-950 dark:text-white">
                Futuristic where it matters: faster decisions, better signal, less scattered work.
              </h2>
            </div>
            <Link href="/dashboard/ai" className="inline-flex items-center text-sm font-semibold text-rose-600 dark:text-rose-300">
              Open AI tools
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {intelligenceCards.map((card) => (
              <Link
                key={card.title}
                href={card.href}
                className="panel group relative overflow-hidden p-5 transition hover:-translate-y-1 hover:border-rose-200 hover:shadow-md dark:hover:border-rose-400/30"
              >
                <div
                  aria-hidden="true"
                  className={`pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br ${card.gradient} opacity-0 blur-2xl transition duration-500 group-hover:opacity-40`}
                />
                <div className="relative flex items-center justify-between">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${card.gradient} text-white ${card.glow} transition group-hover:scale-110 group-hover:rotate-[-4deg]`}
                  >
                    <card.icon className="h-6 w-6" strokeWidth={2.25} />
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-rose-600" />
                </div>
                <h3 className="relative mt-5 text-lg font-semibold text-slate-950 dark:text-white">{card.title}</h3>
                <p className="relative mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">{card.description}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* Reels */}
        <HomeReelsRail />

        {/* Full platform abilities */}
        <section className="border-y border-slate-200 bg-gradient-to-br from-rose-50 via-white to-purple-50 dark:border-slate-800 dark:from-slate-950 dark:via-slate-900/60 dark:to-slate-950">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="kicker">Every ability, one account</div>
                <h2 className="mt-2 max-w-3xl text-3xl font-semibold text-slate-950 dark:text-white">
                  The full <span className="gradient-text-feminine">life OS</span> for women&apos;s careers.
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300">
                  Eight connected abilities that turn scattered tabs into a single momentum engine.
                </p>
              </div>
              <Link
                href="/register"
                className="inline-flex items-center gap-1 text-sm font-semibold text-rose-600 dark:text-rose-300"
              >
                Unlock all features
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {platformAbilities.map((ability) => (
                <div
                  key={ability.title}
                  className="group relative overflow-hidden rounded-2xl border border-rose-100 bg-white/90 p-5 shadow-sm backdrop-blur transition hover:-translate-y-1 hover:border-rose-300 hover:shadow-blossom dark:border-rose-400/10 dark:bg-slate-900/70 dark:hover:border-rose-400/30"
                >
                  <div
                    aria-hidden="true"
                    className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br ${ability.gradient} opacity-0 blur-2xl transition duration-500 group-hover:opacity-40`}
                  />
                  <div
                    className={`relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${ability.gradient} text-white shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3`}
                  >
                    <ability.icon className="h-6 w-6" strokeWidth={2.25} />
                  </div>
                  <h3 className="relative mt-4 text-sm font-semibold text-slate-900 dark:text-white">{ability.title}</h3>
                  <p className="relative mt-1 text-xs leading-5 text-slate-600 dark:text-slate-400">{ability.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Social preview + operating layers */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-10">
            <div>
              <div className="kicker">Social network, built for wins</div>
              <h2 className="mt-2 max-w-3xl text-3xl font-semibold text-slate-950 dark:text-white">
                An Instagram-feel feed, a professional-grade network, and a safe community in one.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300">
                Share wins, ask questions, run live workshops, and find the people who will open doors.
              </p>

              <div className="mt-8 grid gap-6 sm:grid-cols-3">
                {operatingLayers.map((layer) => (
                  <div key={layer.title} className="border-l-2 border-rose-300/70 pl-5 dark:border-rose-400/40">
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${layer.gradient} text-white shadow-lg`}
                    >
                      <layer.icon className="h-5 w-5" strokeWidth={2.25} />
                    </div>
                    <div className="mt-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-rose-700 dark:text-rose-300">
                      {layer.eyebrow}
                    </div>
                    <h3 className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">{layer.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{layer.description}</p>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/feed"
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                >
                  <Play className="h-4 w-4" />
                  Open live social feed
                </Link>
                <Link
                  href="/events"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <Calendar className="h-4 w-4" />
                  Upcoming events
                </Link>
              </div>
            </div>

          </div>
        </section>

        {/* Audience routes */}
        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
            <div>
              <div className="kicker">Routes for every growth mode</div>
              <h2 className="mt-2 max-w-3xl text-3xl font-semibold text-slate-950 dark:text-white">
                Move from public discovery into the dashboard when you are ready to act.
              </h2>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {audienceRoutes.map((route) => (
                  <Link
                    key={route.href}
                    href={route.href}
                    className="panel group flex items-center justify-between gap-4 p-5 transition hover:-translate-y-0.5 hover:border-rose-200 hover:shadow-md dark:hover:border-rose-400/30"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${route.gradient} text-white shadow-md transition-transform duration-300 group-hover:scale-110`}
                      >
                        <route.icon className="h-5 w-5" strokeWidth={2.25} />
                      </div>
                      <span className="font-semibold text-slate-950 dark:text-white">{route.label}</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-rose-600" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-[linear-gradient(135deg,#f43f5e_0%,#a855f7_55%,#f59e0b_100%)] p-8 text-white shadow-blossom lg:p-12">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/80">
                  Launch the next chapter
                </div>
                <h2 className="mt-3 max-w-3xl font-display text-3xl font-semibold text-white lg:text-4xl">
                  One account. Every route into opportunity, support, learning, and income.
                </h2>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-rose-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50"
                >
                  Create account
                </Link>
                <Link
                  href="/dashboard/ai/chat"
                  className="inline-flex items-center justify-center rounded-xl border border-white/30 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Ask ATHENA AI
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(4,minmax(0,1fr))]">
            <div>
              <Link href="/" className="flex items-center gap-3">
                <Image
                  src="/icon.svg"
                  alt="ATHENA"
                  width={40}
                  height={40}
                  className="rounded-xl shadow-blossom ring-1 ring-rose-200/60 dark:ring-rose-400/20"
                />
                <div>
                  <div className="text-sm font-semibold tracking-wide text-slate-900 dark:text-white">ATHENA</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Career intelligence platform</div>
                </div>
              </Link>
              <p className="mt-4 max-w-sm text-sm leading-6 text-slate-600 dark:text-slate-400">
                The life operating system for women. Jobs, mentors, learning, community, AI, and earning &mdash; one account.
              </p>
              <div className="mt-5 flex items-center gap-2">
                {socialLinks.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-rose-400/40 dark:hover:bg-rose-500/10 dark:hover:text-rose-300"
                  >
                    <s.icon className="h-4 w-4" />
                  </a>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-900 dark:text-white">Product</h4>
              <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <li><Link href="/jobs" className="hover:text-rose-600 dark:hover:text-rose-300">Jobs</Link></li>
                <li><Link href="/mentors" className="hover:text-rose-600 dark:hover:text-rose-300">Mentors</Link></li>
                <li><Link href="/courses" className="hover:text-rose-600 dark:hover:text-rose-300">Learning paths</Link></li>
                <li><Link href="/events" className="hover:text-rose-600 dark:hover:text-rose-300">Events</Link></li>
                <li><Link href="/dashboard/ai" className="hover:text-rose-600 dark:hover:text-rose-300">AI tools</Link></li>
                <li><Link href="/pricing" className="hover:text-rose-600 dark:hover:text-rose-300">Pricing</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-900 dark:text-white">Community</h4>
              <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <li><Link href="/feed" className="hover:text-rose-600 dark:hover:text-rose-300">Social feed</Link></li>
                <li><Link href="/groups" className="hover:text-rose-600 dark:hover:text-rose-300">Groups</Link></li>
                <li><Link href="/videos" className="hover:text-rose-600 dark:hover:text-rose-300">Videos</Link></li>
                <li><Link href="/dashboard/mentors/become-mentor" className="hover:text-rose-600 dark:hover:text-rose-300">Become a mentor</Link></li>
                <li><Link href="/employer" className="hover:text-rose-600 dark:hover:text-rose-300">For employers</Link></li>
                <li><Link href="/developers" className="hover:text-rose-600 dark:hover:text-rose-300">For developers</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-900 dark:text-white">Company</h4>
              <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <li><Link href="/about" className="hover:text-rose-600 dark:hover:text-rose-300">About ATHENA</Link></li>
                <li><Link href="/impact" className="hover:text-rose-600 dark:hover:text-rose-300">Impact</Link></li>
                <li><Link href="/careers" className="hover:text-rose-600 dark:hover:text-rose-300">Careers</Link></li>
                <li><Link href="/press" className="hover:text-rose-600 dark:hover:text-rose-300">Press</Link></li>
                <li><Link href="/contact-sales?intent=partnership" className="hover:text-rose-600 dark:hover:text-rose-300">Partners</Link></li>
                <li><Link href="/contact" className="hover:text-rose-600 dark:hover:text-rose-300">Contact</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-900 dark:text-white">Resources</h4>
              <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <li><Link href="/help" className="hover:text-rose-600 dark:hover:text-rose-300">Help centre</Link></li>
                <li><Link href="/help/safety-center" className="hover:text-rose-600 dark:hover:text-rose-300">Safety centre</Link></li>
                <li><Link href="/help/community-guidelines" className="hover:text-rose-600 dark:hover:text-rose-300">Community guidelines</Link></li>
                <li><Link href="/privacy-center" className="hover:text-rose-600 dark:hover:text-rose-300">Privacy centre</Link></li>
                <li><Link href="/status" className="hover:text-rose-600 dark:hover:text-rose-300">System status</Link></li>
                <li><Link href="/changelog" className="hover:text-rose-600 dark:hover:text-rose-300">Changelog</Link></li>
              </ul>
            </div>
          </div>

          <div className="mt-12 flex flex-col gap-4 border-t border-slate-100 pt-6 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-500 lg:flex-row lg:items-center lg:justify-between">
            <div>
              &copy; {new Date().getFullYear()} ATHENA. Built for career momentum by Munyaradzi Chenjerai.
            </div>
            <div className="flex flex-wrap gap-5">
              <Link href="/privacy" className="hover:text-slate-900 dark:hover:text-white">Privacy</Link>
              <Link href="/terms" className="hover:text-slate-900 dark:hover:text-white">Terms</Link>
              <Link href="/cookies" className="hover:text-slate-900 dark:hover:text-white">Cookies</Link>
              <Link href="/accessibility" className="hover:text-slate-900 dark:hover:text-white">Accessibility</Link>
              <Link href="/help/safety-center" className="hover:text-slate-900 dark:hover:text-white">Safety</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
