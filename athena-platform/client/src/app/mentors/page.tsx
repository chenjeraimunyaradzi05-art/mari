import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  GraduationCap,
  MessageSquare,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
} from 'lucide-react';

const mentorModes = [
  {
    icon: Search,
    title: 'Find the right signal',
    description: 'Search by career lane, industry, lived experience, session format, and availability.',
  },
  {
    icon: CalendarClock,
    title: 'Book with context',
    description: 'Bring your role targets, resume, applications, and goals into the session.',
  },
  {
    icon: MessageSquare,
    title: 'Keep momentum',
    description: 'Turn mentor notes into tasks, follow-ups, interview prep, and new outreach.',
  },
];

const featuredMentors = [
  {
    name: 'Maya Chen',
    role: 'Product leader',
    focus: 'Career strategy, leadership, interviews',
    rating: '4.9',
  },
  {
    name: 'Aisha Patel',
    role: 'Founder and operator',
    focus: 'Business formation, capital, confidence',
    rating: '5.0',
  },
  {
    name: 'Grace Okafor',
    role: 'Engineering manager',
    focus: 'Technical interviews, growth plans, negotiation',
    rating: '4.8',
  },
];

const trustItems = [
  'Verified mentor profiles',
  'Structured session goals',
  'Safety-aware messaging',
  'Clear next steps after every conversation',
];

export default function MentorsMarketingPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <section className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/50">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:px-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-lg border border-primary-200 bg-primary-50 px-3 py-1.5 text-sm font-semibold text-primary-800 dark:border-primary-400/20 dark:bg-primary-400/10 dark:text-primary-200">
              <Sparkles className="h-4 w-4" />
              Mentor intelligence
            </div>
            <h1 className="mt-6 max-w-4xl text-4xl font-semibold leading-tight text-slate-950 sm:text-6xl dark:text-white">
              Find mentors who make the next move feel possible.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 dark:text-slate-300">
              ATHENA connects mentor discovery with your career goals, applications, learning path, and AI prep so each
              conversation turns into visible progress.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/dashboard/mentors" className="btn-primary">
                Find a mentor
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/dashboard/mentors/become-mentor" className="btn-outline">
                Become a mentor
              </Link>
            </div>
          </div>

          <div className="panel p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="kicker">Session readiness</div>
                <h2 className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">Before you book</h2>
              </div>
              <GraduationCap className="h-6 w-6 text-primary-600" />
            </div>
            <div className="mt-5 space-y-3">
              {trustItems.map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
                  <ShieldCheck className="h-4 w-4 text-primary-600" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          {mentorModes.map((mode) => (
            <div key={mode.title} className="panel p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-slate-950 dark:bg-slate-800 dark:text-white">
                <mode.icon className="h-5 w-5" />
              </div>
              <h2 className="mt-5 text-xl font-semibold text-slate-950 dark:text-white">{mode.title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">{mode.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="kicker">Featured mentor paths</div>
            <h2 className="mt-2 text-3xl font-semibold text-slate-950 dark:text-white">
              Browse trusted guidance without guessing where to start.
            </h2>
          </div>
          <Link href="/dashboard/mentors" className="inline-flex items-center text-sm font-semibold text-primary-700 dark:text-primary-300">
            View all mentors
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {featuredMentors.map((mentor) => (
            <Link key={mentor.name} href="/dashboard/mentors" className="panel group p-5 transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-950 font-semibold text-white dark:bg-white dark:text-slate-950">
                  {mentor.name.split(' ').map((part) => part[0]).join('')}
                </div>
                <div className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-400/10 dark:text-amber-200">
                  <Star className="h-3.5 w-3.5" />
                  {mentor.rating}
                </div>
              </div>
              <div className="mt-5 flex items-center gap-2">
                <h3 className="font-semibold text-slate-950 dark:text-white">{mentor.name}</h3>
                <BadgeCheck className="h-4 w-4 text-primary-600" />
              </div>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{mentor.role}</p>
              <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">{mentor.focus}</p>
              <div className="mt-5 inline-flex items-center text-sm font-semibold text-primary-700 dark:text-primary-300">
                Open profile
                <ArrowRight className="ml-1 h-4 w-4 transition group-hover:translate-x-0.5" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="grid gap-4 bg-slate-950 p-6 text-white md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-slate-950">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Ready to turn experience into momentum?</h2>
              <p className="mt-1 text-sm text-slate-300">Start with discovery, then bring your goals into the dashboard.</p>
            </div>
          </div>
          <Link href="/dashboard/mentors" className="inline-flex items-center justify-center rounded-lg bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100">
            Explore mentors
          </Link>
        </div>
      </section>
    </main>
  );
}
