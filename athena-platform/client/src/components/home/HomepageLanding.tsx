import Image from 'next/image';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  BookOpen,
  Brain,
  Briefcase,
  Building2,
  Calendar,
  Check,
  Command,
  Compass,
  Crown,
  DollarSign,
  Facebook,
  FileText,
  Gem,
  Globe2,
  GraduationCap,
  Heart,
  Instagram,
  MessageCircle,
  Mic,
  Network,
  PenSquare,
  Play,
  Radar,
  Rocket,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Twitter,
  Users,
  UsersRound,
  Video,
  Wand2,
  Zap,
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

const commandSignals = [
  { label: 'Role match', value: '92%', icon: Radar, tone: 'text-emerald-300' },
  { label: 'Mentor fit', value: '8 new', icon: Users, tone: 'text-sky-300' },
  { label: 'Skills gap', value: '3 tasks', icon: BookOpen, tone: 'text-amber-300' },
  { label: 'Trust state', value: 'clear', icon: ShieldCheck, tone: 'text-rose-300' },
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

const platformChecks = [
  'Neon-ready PostgreSQL configuration',
  'Netlify frontend and portable backend runtime',
  'GDPR-aware consent, safety, moderation, and audit surfaces',
  'Stripe subscriptions, AI routes, messaging, jobs, and learning paths',
];

// Full platform abilities — what ATHENA can do end-to-end.
// Each ability has a distinctive gradient and icon so the grid pops.
const platformAbilities = [
  { icon: Briefcase, title: 'Smart job search', description: 'AI-matched roles with salary insights and one-click apply.', gradient: 'from-rose-500 to-pink-500' },
  { icon: FileText, title: 'Resume optimizer', description: 'Tailor your resume to any job in seconds with AI feedback.', gradient: 'from-fuchsia-500 to-purple-500' },
  { icon: Brain, title: 'AI career coach', description: 'Always-on copilot for interview prep, planning, and mindset.', gradient: 'from-violet-500 to-indigo-500' },
  { icon: Users, title: 'Mentorship circles', description: 'Find mentors, run 1:1s, and track growth milestones.', gradient: 'from-sky-500 to-cyan-500' },
  { icon: GraduationCap, title: 'Learning paths', description: 'Curated courses, micro-credentials, and skills tracks.', gradient: 'from-teal-500 to-emerald-500' },
  { icon: Heart, title: 'Social feed', description: 'Post wins, ask questions, follow inspiring women worldwide.', gradient: 'from-pink-500 to-rose-500' },
  { icon: Video, title: 'Video discovery', description: 'Short-form career videos, events, and creator content.', gradient: 'from-purple-500 to-fuchsia-500' },
  { icon: Calendar, title: 'Events & meetups', description: 'Join workshops, AMAs, and community calls that matter.', gradient: 'from-amber-500 to-orange-500' },
  { icon: DollarSign, title: 'Earning pathways', description: 'Turn expertise into income as a creator, mentor, or consultant.', gradient: 'from-yellow-500 to-amber-500' },
  { icon: PenSquare, title: 'Creator tools', description: 'Publish articles, run paid workshops, launch digital products.', gradient: 'from-orange-500 to-rose-500' },
  { icon: Building2, title: 'Employer branding', description: 'Showcase culture, post roles, and engage top talent.', gradient: 'from-indigo-500 to-blue-500' },
  { icon: Network, title: 'Warm referrals', description: 'Connect with employees and mentors who can open doors.', gradient: 'from-cyan-500 to-sky-500' },
  { icon: Target, title: 'Goal tracking', description: 'Set weekly intentions and watch momentum compound.', gradient: 'from-emerald-500 to-teal-500' },
  { icon: ShieldCheck, title: 'Safety first', description: 'Built-in moderation, consent controls, and safety centre.', gradient: 'from-rose-500 to-red-500' },
  { icon: Mic, title: 'Voice notes', description: 'Send voice intros, check-ins, and mentor reflections.', gradient: 'from-fuchsia-500 to-pink-500' },
  { icon: Crown, title: 'Your life OS', description: 'Everything connected — one dashboard for your whole chapter.', gradient: 'from-amber-400 via-rose-500 to-purple-500' },
];

// Instagram-style sample feed preview (static, links to live feed)
const feedPreview = [
  {
    name: 'Amara Okonkwo',
    role: 'Product Designer',
    avatar: '#fde4ec',
    badge: 'Win',
    caption: 'Signed my first staff design role today after 6 weeks of ATHENA mentor sessions!',
    likes: 248,
    comments: 41,
  },
  {
    name: 'Priya Singh',
    role: 'ML Engineer',
    avatar: '#ede9fe',
    badge: 'Question',
    caption: 'Any mentors who have navigated the transition from research to industry AI? Would love a chat.',
    likes: 76,
    comments: 18,
  },
  {
    name: 'Sofia Martinez',
    role: 'Founder, QueenBee Labs',
    avatar: '#ffedd5',
    badge: 'Live',
    caption: 'Going live in 10min: how I raised my pre-seed as a solo, first-time, non-technical founder.',
    likes: 512,
    comments: 88,
  },
];

function SignalPanel() {
  return (
    <div className="rounded-2xl border border-white/15 bg-slate-950/70 p-4 text-white shadow-2xl shadow-slate-950/30 backdrop-blur">
      <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-rose-600">
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
          <div key={signal.label} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center justify-between">
              <signal.icon className={`h-5 w-5 ${signal.tone}`} />
              <span className="text-lg font-semibold">{signal.value}</span>
            </div>
            <div className="mt-3 text-sm text-slate-300">{signal.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] p-4">
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

function SocialFeedPreview() {
  return (
    <div className="rounded-2xl border border-rose-200/60 bg-white/80 p-5 shadow-sm backdrop-blur dark:border-rose-400/10 dark:bg-slate-900/70">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-rose-600 dark:text-rose-300">
            Live community
          </span>
        </div>
        <Link
          href="/feed"
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-rose-600 dark:text-slate-300 dark:hover:text-rose-300"
        >
          Open feed <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="space-y-3">
        {feedPreview.map((post) => (
          <div
            key={post.name}
            className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-rose-200 hover:shadow dark:border-slate-800 dark:bg-slate-950/60 dark:hover:border-rose-400/20"
          >
            <div className="flex items-start gap-3">
              <div
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-rose-700 ring-2 ring-white dark:ring-slate-900"
                style={{ backgroundColor: post.avatar, color: '#9f1239' }}
              >
                {post.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">{post.name}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                      post.badge === 'Live'
                        ? 'bg-rose-600 text-white'
                        : post.badge === 'Win'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                          : 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300'
                    }`}
                  >
                    {post.badge}
                  </span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{post.role}</div>
                <p className="mt-1 text-xs leading-5 text-slate-700 dark:text-slate-300 line-clamp-2">
                  {post.caption}
                </p>
                <div className="mt-2 flex items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <Heart className="h-3 w-3" /> {post.likes}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle className="h-3 w-3" /> {post.comments}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
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
        {/* Hero — now theme-aware */}
        <section className="relative overflow-hidden bg-feminine-hero">
          <div className="pointer-events-none absolute inset-0 bg-feminine-aurora opacity-80" aria-hidden="true" />
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

              <div className="mt-10 grid gap-3 sm:grid-cols-3">
                {[
                  { label: 'Jobs', icon: Briefcase },
                  { label: 'Mentors', icon: Users },
                  { label: 'AI coach', icon: Sparkles },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center gap-3 rounded-xl border border-rose-200/60 bg-white/70 p-4 backdrop-blur dark:border-rose-400/15 dark:bg-white/5"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200">
                      <item.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-slate-900 dark:text-white">{item.label}</div>
                      <div className="text-xs text-slate-600 dark:text-slate-300">Connected in one flow</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <SignalPanel />
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
                  Sixteen connected abilities that turn scattered tabs into a single momentum engine.
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
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_24rem]">
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

            <SocialFeedPreview />
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

            <div className="panel p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
                <ShieldCheck className="h-4 w-4 text-rose-600" />
                Production posture
              </div>
              <div className="mt-4 space-y-3">
                {platformChecks.map((check) => (
                  <div key={check} className="flex gap-3 text-sm leading-6 text-slate-700 dark:text-slate-300">
                    <Check className="mt-1 h-4 w-4 shrink-0 text-rose-600" />
                    {check}
                  </div>
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
                <li><Link href="/partners" className="hover:text-rose-600 dark:hover:text-rose-300">Partners</Link></li>
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
