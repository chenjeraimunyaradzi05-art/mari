import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  Briefcase,
  Sparkles,
  Users,
  GraduationCap,
  ShieldCheck,
  MessageCircle,
  Radar,
  TrendingUp,
  CheckCircle2,
  Heart,
} from 'lucide-react';

const stats = [
  { value: '50K+', label: 'members building momentum' },
  { value: '10K+', label: 'roles and opportunities' },
  { value: '500+', label: 'mentors and experts' },
  { value: '9', label: 'persona-guided journeys' },
];

const features = [
  {
    icon: Briefcase,
    title: 'Career engine, not a job board',
    description: 'Discover roles, manage applications, and turn your experience into stronger outcomes.',
    color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  },
  {
    icon: Sparkles,
    title: 'AI tools with real workflow value',
    description: 'Use resume, interview, and writing tools inside one consistent growth system.',
    color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  },
  {
    icon: Users,
    title: 'Community that compounds growth',
    description: 'Build with peers, mentors, and conversations that help you move faster.',
    color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  },
  {
    icon: GraduationCap,
    title: 'Learning tied to opportunity',
    description: 'Develop the skills and confidence needed for your next role, pivot, or launch.',
    color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
  },
];

const trustSignals = [
  'Secure session handling and refresh token rotation',
  'Privacy, consent, and compliance controls built into the platform',
  'Community, mentoring, jobs, and AI guidance in one place',
];

const sponsorPlacements = [
  {
    label: 'Sponsored spotlight',
    title: 'Feature mission-aligned brands',
    description: 'Promote tools, services, and employers that genuinely help women grow their careers and businesses.',
  },
  {
    label: 'Partnership placement',
    title: 'Recruiting and education partners',
    description: 'Highlight employers, accelerators, and training providers looking to reach an engaged audience.',
  },
];

const partnershipMetrics = [
  { value: 'Brand', label: 'sponsorship inventory' },
  { value: 'Hiring', label: 'partner campaigns' },
  { value: 'Growth', label: 'affiliate placements' },
];

const stories = [
  {
    name: 'Sarah Chen',
    role: 'Software Engineer at Google',
    content:
      'ATHENA helped me sharpen my story, practice interviews with more confidence, and stay accountable through the search.',
    likes: 234,
    comments: 45,
  },
  {
    name: 'Priya Sharma',
    role: 'Founder, EcoStyle',
    content:
      'I found founder community, clearer positioning, and stronger momentum while raising and building at the same time.',
    likes: 567,
    comments: 89,
  },
  {
    name: 'Emily Rodriguez',
    role: 'Marketing Director',
    content:
      'The resume tools helped me frame outcomes better and walk into salary conversations with more leverage.',
    likes: 412,
    comments: 67,
  },
];

const steps = [
  {
    icon: Radar,
    title: 'Choose your direction',
    description: 'Start with a path that matches your ambition, stage, and priorities.',
  },
  {
    icon: MessageCircle,
    title: 'Connect to the right support',
    description: 'Meet mentors, peers, and communities that reduce guesswork and isolation.',
  },
  {
    icon: TrendingUp,
    title: 'Build repeatable momentum',
    description: 'Use tools, guidance, and accountability to keep moving on the right work.',
  },
];

export default function HomepageLanding() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white">
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Image src="/athena-logo.png" alt="ATHENA" width={36} height={36} className="rounded-xl" />
            <span className="text-xl font-bold gradient-text">ATHENA</span>
          </div>
          <div className="hidden items-center gap-6 lg:flex">
            <Link href="/feed" className="text-sm font-medium text-slate-600 hover:text-primary-600 dark:text-slate-300 dark:hover:text-white">Community</Link>
            <Link href="/jobs" className="text-sm font-medium text-slate-600 hover:text-primary-600 dark:text-slate-300 dark:hover:text-white">Jobs</Link>
            <Link href="/pricing" className="text-sm font-medium text-slate-600 hover:text-primary-600 dark:text-slate-300 dark:hover:text-white">Pricing</Link>
            <Link href="/help/community-guidelines" className="text-sm font-medium text-slate-600 hover:text-primary-600 dark:text-slate-300 dark:hover:text-white">Trust & Safety</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">Sign In</Link>
            <Link href="/register" className="btn-primary px-4 py-2 text-sm">Join Free</Link>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-4 pt-24 pb-16 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)_22rem]">
          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-4">
              <div className="rounded-3xl border border-primary-100 bg-primary-50/80 p-5 dark:border-primary-900/40 dark:bg-primary-950/20">
                <div className="flex items-center gap-2 text-sm font-semibold text-primary-700 dark:text-primary-300">
                  <ShieldCheck className="h-4 w-4" />
                  Launch-ready foundation
                </div>
                <div className="mt-4 space-y-3">
                  {trustSignals.map((signal) => (
                    <div key={signal} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary-600 dark:text-primary-300" />
                      <span>{signal}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-amber-200 bg-white p-5 shadow-sm dark:border-amber-900/40 dark:bg-slate-900">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-400">
                      Revenue opportunities
                    </p>
                    <h2 className="mt-2 text-base font-semibold text-slate-900 dark:text-white">
                      Advertising & partnerships
                    </h2>
                  </div>
                  <div className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                    Available
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {sponsorPlacements.map((placement) => (
                    <div key={placement.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                        {placement.label}
                      </p>
                      <h3 className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                        {placement.title}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                        {placement.description}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  {partnershipMetrics.map((metric) => (
                    <div key={metric.label} className="rounded-2xl bg-amber-50 px-3 py-3 text-center dark:bg-amber-950/20">
                      <div className="text-sm font-semibold text-amber-700 dark:text-amber-300">{metric.value}</div>
                      <div className="mt-1 text-[11px] leading-4 text-slate-500 dark:text-slate-400">{metric.label}</div>
                    </div>
                  ))}
                </div>

                <Link
                  href="/developers"
                  className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-600"
                >
                  Explore partnership options
                </Link>
              </div>
            </div>
          </aside>

          <main className="min-w-0">
            <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary-600 via-fuchsia-600 to-indigo-700 p-8 text-white shadow-xl shadow-primary-900/15 md:p-10 xl:p-12">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm backdrop-blur">
                <Sparkles className="h-4 w-4" />
                <span>Career growth, mentoring, community, and AI guidance in one place</span>
              </div>
              <h1 className="mt-6 max-w-4xl text-4xl font-bold leading-tight md:text-5xl xl:text-6xl">
                Where ambitious women build momentum, not just profiles.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/85 md:text-lg">
                ATHENA helps you discover opportunities, sharpen your positioning, build real relationships, and keep moving with more clarity and support.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/register" className="group inline-flex items-center rounded-xl bg-white px-6 py-3 font-semibold text-primary-700 hover:bg-slate-100">
                  Join Free
                  <ArrowRight className="ml-2 h-5 w-5 transition group-hover:translate-x-1" />
                </Link>
                <Link href="/feed" className="inline-flex items-center rounded-xl border border-white/25 px-6 py-3 font-semibold text-white hover:bg-white/10">
                  Explore the community
                </Link>
              </div>
              <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {stats.map((stat) => (
                  <div key={stat.label} className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
                    <div className="text-2xl font-bold">{stat.value}</div>
                    <div className="mt-1 text-sm text-white/80">{stat.label}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-6 grid gap-4 sm:grid-cols-2">
              {features.map((feature) => (
                <Link key={feature.title} href="/register" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${feature.color}`}>
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <h2 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">{feature.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{feature.description}</p>
                </Link>
              ))}
            </section>

            <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">How ATHENA helps you move</h2>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">A focused system for opportunity discovery, support, and sustained career momentum.</p>
                </div>
                <Link href="/register" className="hidden text-sm font-semibold text-primary-600 hover:text-primary-500 md:inline-flex">Start your path</Link>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {steps.map((step) => (
                  <div key={step.title} className="rounded-2xl bg-slate-50 p-5 dark:bg-slate-950/50">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300">
                      <step.icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 font-semibold text-slate-900 dark:text-white">{step.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{step.description}</p>
                  </div>
                ))}
              </div>
            </section>
          </main>

          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-4">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Momentum stories</h2>
                  <Link href="/register" className="text-sm font-medium text-primary-600 hover:text-primary-500">Join in</Link>
                </div>
                <div className="mt-4 space-y-4">
                  {stories.map((story) => (
                    <article key={story.name} className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950/50">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-fuchsia-500 text-sm font-semibold text-white">
                          {story.name.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{story.name}</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{story.role}</p>
                        </div>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-300">{story.content}</p>
                      <div className="mt-3 flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" />{story.likes}</span>
                        <span className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" />{story.comments}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <footer className="border-t border-slate-200 bg-white/90 dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-xl">
              <div className="flex items-center gap-3">
                <Image src="/athena-logo.png" alt="ATHENA" width={32} height={32} className="rounded-lg" />
                <span className="text-lg font-bold gradient-text">ATHENA</span>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-400">
                Build your next chapter with better opportunities, stronger support, and one platform designed for meaningful career momentum.
              </p>
            </div>

            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Platform</h3>
                <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-400">
                  <div><Link href="/jobs" className="hover:text-primary-600 dark:hover:text-primary-400">Jobs</Link></div>
                  <div><Link href="/feed" className="hover:text-primary-600 dark:hover:text-primary-400">Community</Link></div>
                  <div><Link href="/pricing" className="hover:text-primary-600 dark:hover:text-primary-400">Pricing</Link></div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Support</h3>
                <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-400">
                  <div><Link href="/help/community-guidelines" className="hover:text-primary-600 dark:hover:text-primary-400">Community Guidelines</Link></div>
                  <div><Link href="/help/safety-center" className="hover:text-primary-600 dark:hover:text-primary-400">Safety Center</Link></div>
                  <div><Link href="/privacy" className="hover:text-primary-600 dark:hover:text-primary-400">Privacy</Link></div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Company</h3>
                <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-400">
                  <div><Link href="/terms" className="hover:text-primary-600 dark:hover:text-primary-400">Terms</Link></div>
                  <div><Link href="/press" className="hover:text-primary-600 dark:hover:text-primary-400">Press</Link></div>
                  <div><Link href="/developers" className="hover:text-primary-600 dark:hover:text-primary-400">Developers</Link></div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-200 pt-6 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <p>© ATHENA. All rights reserved.</p>
            <p>Developed by Munyaradzi Chenjerai.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
