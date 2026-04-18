import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  Briefcase,
  Building2,
  Coins,
  Globe2,
  GraduationCap,
  MessageSquare,
  Radar,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';

const navLinks = [
  { href: '/jobs', label: 'Jobs' },
  { href: '/feed', label: 'Community' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/help/safety-center', label: 'Trust & Safety' },
];

const headlineStats = [
  { value: '1', label: 'workspace for growth' },
  { value: '4', label: 'core journeys unified' },
  { value: '3', label: 'marketplace sides connected' },
  { value: 'Global', label: 'privacy-ready foundation' },
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

export default function HomepageLanding() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fffdf8_0%,#fff8ee_28%,#f7fbff_62%,#ffffff_100%)] text-slate-900">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[32rem] bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.22),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(45,212,191,0.18),_transparent_30%),radial-gradient(circle_at_center,_rgba(14,165,233,0.12),_transparent_45%)]"
      />

      <nav className="sticky top-0 z-50 border-b border-white/70 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/athena-logo.png" alt="ATHENA" width={38} height={38} className="rounded-2xl" />
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-600">
                ATHENA
              </div>
              <div className="text-sm font-medium text-slate-500">Career superapp</div>
            </div>
          </Link>

          <div className="hidden items-center gap-7 lg:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-slate-600 transition hover:text-slate-950"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-slate-600 transition hover:text-slate-950">
              Sign in
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Join free
            </Link>
          </div>
        </div>
      </nav>

      <main>
        <section className="mx-auto max-w-7xl px-4 pb-12 pt-10 sm:px-6 lg:px-8 lg:pb-16 lg:pt-16">
          <div className="grid gap-8 xl:grid-cols-[minmax(0,1.2fr)_28rem]">
            <div className="rounded-[2rem] border border-white/80 bg-white/75 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur xl:p-10">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-1.5 text-sm font-medium text-amber-800">
                <Sparkles className="h-4 w-4" />
                Jobs, mentors, learning, community, and AI guidance in one place
              </div>

              <h1 className="mt-6 max-w-4xl text-5xl font-semibold leading-[0.94] tracking-[-0.04em] text-slate-950 sm:text-6xl xl:text-7xl">
                Build your career with one platform that keeps momentum alive.
              </h1>

              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
                ATHENA is the women-first career superapp for professionals who want better roles, stronger
                support, sharper positioning, and more ways to grow or earn without stitching together five
                different tools.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/register"
                  className="inline-flex items-center rounded-full bg-slate-950 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Create your ATHENA account
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
                <Link
                  href="/pricing"
                  className="inline-flex items-center rounded-full border border-slate-200 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
                >
                  See plans
                </Link>
              </div>

              <div className="mt-10 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {headlineStats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-3xl border border-slate-200 bg-slate-50/90 px-4 py-5"
                  >
                    <div className="text-2xl font-semibold tracking-[-0.03em] text-slate-950">{stat.value}</div>
                    <div className="mt-1 text-sm leading-6 text-slate-600">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-5">
              <div className="rounded-[2rem] border border-slate-200 bg-slate-950 p-6 text-white shadow-[0_24px_80px_rgba(15,23,42,0.16)]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-300">
                      ATHENA loop
                    </div>
                    <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
                      More than a job board
                    </h2>
                  </div>
                  <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-slate-200">
                    Multi-sided
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
              </div>

              <div className="rounded-[2rem] border border-emerald-200 bg-emerald-50/80 p-6">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                  <ShieldCheck className="h-4 w-4" />
                  Designed for trust, privacy, and scale
                </div>
                <div className="mt-4 space-y-3">
                  {trustSignals.map((signal) => (
                    <div key={signal} className="rounded-2xl border border-emerald-100 bg-white/80 p-4 text-sm leading-6 text-slate-700">
                      {signal}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="rounded-[2rem] border border-slate-200 bg-white px-6 py-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  One connected ecosystem
                </div>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                  Professional growth should not feel fragmented.
                </h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {ecosystemSignals.map((signal) => (
                  <span
                    key={signal}
                    className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700"
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
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Product pillars
              </div>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-slate-950">
                Everything needed to turn ambition into repeatable progress.
              </h2>
            </div>
            <Link href="/register" className="text-sm font-semibold text-slate-950 transition hover:text-amber-700">
              Join the platform
            </Link>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {pillars.map((pillar) => (
              <div
                key={pillar.title}
                className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${pillar.tone}`}>
                  <pillar.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-xl font-semibold tracking-[-0.03em] text-slate-950">{pillar.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{pillar.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-5 lg:grid-cols-3">
            {audiences.map((audience) => (
              <div
                key={audience.title}
                className={`rounded-[2rem] border p-7 shadow-sm ${audience.accent}`}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-900 shadow-sm">
                  <audience.icon className="h-5 w-5" />
                </div>
                <div className="mt-5 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  {audience.eyebrow}
                </div>
                <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                  {audience.title}
                </h3>
                <p className="mt-4 text-sm leading-7 text-slate-700">{audience.description}</p>
                <Link
                  href={audience.href}
                  className="mt-6 inline-flex items-center text-sm font-semibold text-slate-950 transition hover:text-amber-700"
                >
                  {audience.cta}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm lg:p-10">
            <div className="max-w-3xl">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Global foundation
              </div>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-slate-950">
                Built to support careers, communities, and commerce in one product.
              </h2>
              <p className="mt-4 text-base leading-8 text-slate-600">
                ATHENA is structured for recurring revenue, transactional revenue, and enterprise growth with
                compliance, moderation, and regionalization already part of the product direction.
              </p>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl bg-slate-50 p-5">
                <div className="flex items-center gap-3">
                  <Coins className="h-5 w-5 text-amber-600" />
                  <h3 className="font-semibold text-slate-950">Monetization layers</h3>
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Subscriptions, mentor bookings, course sales, promoted jobs, and employer packages.
                </p>
              </div>

              <div className="rounded-3xl bg-slate-50 p-5">
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-sky-600" />
                  <h3 className="font-semibold text-slate-950">Enterprise expansion</h3>
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Team management, analytics, SSO, API access, and branded hiring workflows.
                </p>
              </div>

              <div className="rounded-3xl bg-slate-50 p-5">
                <div className="flex items-center gap-3">
                  <Globe2 className="h-5 w-5 text-emerald-600" />
                  <h3 className="font-semibold text-slate-950">Regional readiness</h3>
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Pricing, legal surfaces, and payment methods can be localized for broader market expansion.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Pricing</div>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-slate-950">
                Start free, then unlock deeper support as momentum grows.
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-7 text-slate-600">
              Pro includes a 14-day trial, and verified students and nonprofits receive 50% off.
            </p>
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {planCards.map((plan) => (
              <div key={plan.name} className={`rounded-[2rem] border p-7 shadow-sm ${plan.accent}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-slate-950">{plan.name}</div>
                    <div className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-slate-950">
                      {plan.price}
                    </div>
                    <div className="mt-2 text-sm text-slate-600">{plan.detail}</div>
                  </div>
                  {plan.badge ? (
                    <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white">
                      {plan.badge}
                    </span>
                  ) : null}
                </div>

                <div className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <div key={feature} className="rounded-2xl bg-white/80 px-4 py-3 text-sm text-slate-700">
                      {feature}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-20 pt-12 sm:px-6 lg:px-8">
          <div className="rounded-[2.25rem] bg-slate-950 px-8 py-10 text-white shadow-[0_30px_120px_rgba(15,23,42,0.22)] lg:px-10 lg:py-12">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-center">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-300">Get started</div>
                <h2 className="mt-3 text-4xl font-semibold tracking-[-0.04em]">
                  Rebuild your career stack around momentum, not fragmentation.
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-8 text-slate-300">
                  Join ATHENA to access jobs, mentors, learning, community, and AI guidance from one place built
                  to help ambitious women move faster and with more confidence.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                >
                  Join free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
                <Link
                  href="/pricing"
                  className="inline-flex items-center justify-center rounded-full border border-white/20 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  View pricing
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:px-8">
          <div>
            <div className="flex items-center gap-3">
              <Image src="/athena-logo.png" alt="ATHENA" width={34} height={34} className="rounded-xl" />
              <div>
                <div className="text-sm font-semibold text-slate-950">ATHENA</div>
                <div className="text-sm text-slate-500">Jobs, mentorship, community, and AI guidance</div>
              </div>
            </div>
            <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600">
              ATHENA helps professionals grow, connect, learn, and earn from a single platform designed for
              long-term career momentum.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-950">Platform</h3>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <div><Link href="/jobs" className="transition hover:text-slate-950">Jobs</Link></div>
                <div><Link href="/feed" className="transition hover:text-slate-950">Community</Link></div>
                <div><Link href="/pricing" className="transition hover:text-slate-950">Pricing</Link></div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-950">Trust</h3>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <div><Link href="/help/community-guidelines" className="transition hover:text-slate-950">Community Guidelines</Link></div>
                <div><Link href="/help/safety-center" className="transition hover:text-slate-950">Safety Center</Link></div>
                <div><Link href="/privacy" className="transition hover:text-slate-950">Privacy</Link></div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-950">Company</h3>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <div><Link href="/press" className="transition hover:text-slate-950">Press</Link></div>
                <div><Link href="/terms" className="transition hover:text-slate-950">Terms</Link></div>
                <div><Link href="/developers" className="transition hover:text-slate-950">Developers</Link></div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-sm text-slate-500 sm:px-6 sm:flex-row sm:items-center sm:justify-between lg:px-8">
            <p>© ATHENA. All rights reserved.</p>
            <p>Developed by Munyaradzi Chenjerai.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
