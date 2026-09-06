'use client';

/**
 * The opening of the home page: an aurora of the brand colours behind
 * frosted glass, a headline that keeps naming what someone might be here
 * for, the platform's live numbers counted from its own tables, and a row of
 * intents that swap a short, honest pitch with two real doors.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Briefcase, GraduationCap, ShieldCheck, Sparkles, Users, Wallet, type LucideIcon } from 'lucide-react';
import { courseApi, eventsApi, groupsApi, jobApi } from '@/lib/api';
import { cn } from '@/lib/utils';

const PHRASES = ['a new career', 'a fair salary', 'your own business', 'a mentor who gets it', 'a safer place to grow'];

type Intent = { id: string; label: string; icon: LucideIcon; title: string; copy: string; links: Array<[string, string]> };

const INTENTS: Intent[] = [
  { id: 'career', label: 'Jobs & career', icon: Briefcase, title: 'Roles that show the salary', copy: 'Employers here list pay up front, and an AI coach helps with the application and the interview.', links: [['/jobs', 'Browse jobs'], ['/salary-insights', 'Salary insights']] },
  { id: 'money', label: 'Money & business', icon: Wallet, title: 'Your money, in plain sight', copy: 'A ledger you can actually read, a BAS worksheet counted from it, and grants worth applying for.', links: [['/finances', 'Finances'], ['/grants', 'Grants']] },
  { id: 'learning', label: 'Learning', icon: GraduationCap, title: 'Certificates anyone can check', copy: 'Courses from the providers who run them, and apprenticeships that pay you while you learn.', links: [['/courses', 'Courses'], ['/apprenticeships', 'Apprenticeships']] },
  { id: 'community', label: 'Community & mentors', icon: Users, title: 'People who have done it', copy: 'Groups for what you are going through, and mentors you can book a session with.', links: [['/communities', 'Communities'], ['/mentors', 'Mentors']] },
  { id: 'safety', label: 'Safety', icon: ShieldCheck, title: 'A women-only space', copy: 'Safe mode, real moderation, and controls you own, built with domestic-violence safety in mind.', links: [['/safety-center', 'Safety centre'], ['/trust', 'Trust']] },
];

/** Counts up from zero the first time it is shown; still for reduced motion. */
function CountUp({ value }: { value: number }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  useEffect(() => {
    if (reduce) {
      setShown(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const duration = 900;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(value * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reduce]);
  return <>{shown.toLocaleString('en-AU')}</>;
}

const listLength = (data: unknown): number => {
  if (Array.isArray(data)) return data.length;
  if (data && typeof data === 'object') {
    for (const key of ['events', 'groups', 'items']) {
      const v = (data as Record<string, unknown>)[key];
      if (Array.isArray(v)) return v.length;
    }
  }
  return 0;
};

/** The platform's live numbers. A tile whose source fails is simply not shown. */
function usePulse() {
  const jobs = useQuery({ queryKey: ['home-pulse', 'jobs'], queryFn: () => jobApi.search({ limit: 1 }), select: (r) => Number(r.data?.pagination?.total ?? listLength(r.data?.data)), staleTime: 60_000 });
  const courses = useQuery({ queryKey: ['home-pulse', 'courses'], queryFn: () => courseApi.getAll({ limit: 1 }), select: (r) => Number(r.data?.pagination?.total ?? listLength(r.data?.data)), staleTime: 60_000 });
  const groups = useQuery({ queryKey: ['home-pulse', 'groups'], queryFn: () => groupsApi.list(), select: (r) => listLength(r.data?.data ?? r.data), staleTime: 60_000 });
  const events = useQuery({ queryKey: ['home-pulse', 'events'], queryFn: () => eventsApi.list(), select: (r) => listLength(r.data?.data ?? r.data), staleTime: 60_000 });
  return [
    { key: 'jobs', label: 'open roles', href: '/jobs', value: jobs.data, error: jobs.isError },
    { key: 'courses', label: 'courses', href: '/courses', value: courses.data, error: courses.isError },
    { key: 'groups', label: 'communities', href: '/communities', value: groups.data, error: groups.isError },
    { key: 'events', label: 'events listed', href: '/events', value: events.data, error: events.isError },
  ].filter((t) => !t.error);
}

export function HomeHero() {
  const reduce = useReducedMotion();
  const [phrase, setPhrase] = useState(0);
  const [intent, setIntent] = useState<Intent>(INTENTS[0]);
  const pulse = usePulse();

  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => setPhrase((p) => (p + 1) % PHRASES.length), 2600);
    return () => window.clearInterval(id);
  }, [reduce]);

  return (
    <div className="space-y-4">
      <section aria-labelledby="home-hero-title" className="relative overflow-hidden rounded-3xl border border-violet-200/40 text-white shadow-[0_30px_80px_-40px_rgba(168,85,247,0.7)] dark:border-white/10">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(120%_120%_at_0%_0%,#3b0f4f_0%,#140b25_45%,#1a0b17_100%)]" />
        <div aria-hidden className="aurora-blob left-[-12%] top-[-25%] h-72 w-72 bg-rose-500" />
        <div aria-hidden className="aurora-blob aurora-blob--slow right-[-8%] top-[5%] h-80 w-80 bg-violet-500" />
        <div aria-hidden className="aurora-blob aurora-blob--slower bottom-[-35%] left-[30%] h-72 w-72 bg-amber-400" />
        <div aria-hidden className="grid-fade absolute inset-0 opacity-60" />

        <div className="relative p-6 sm:p-8 lg:p-10">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/80">
            <Sparkles className="h-3.5 w-3.5" />
            Welcome to ATHENA
          </div>

          <h1 id="home-hero-title" className="mt-4 max-w-2xl text-3xl font-semibold leading-tight sm:text-4xl lg:text-[2.6rem]" style={{ textWrap: 'balance' }}>
            Working towards{' '}
            <span className="relative inline-block align-baseline">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={PHRASES[phrase]}
                  initial={reduce ? false : { opacity: 0, y: 14, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={reduce ? undefined : { opacity: 0, y: -14, filter: 'blur(4px)' }}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  className="inline-block bg-[linear-gradient(90deg,#fda4af_0%,#e9d5ff_50%,#fde68a_100%)] bg-clip-text text-transparent"
                >
                  {PHRASES[phrase]}
                </motion.span>
              </AnimatePresence>
            </span>
            ?<br />
            You don&rsquo;t have to do it alone.
          </h1>

          <p className="mt-4 max-w-xl text-sm leading-6 text-white/85 sm:text-base">
            Women here are changing careers, asking the awkward salary questions, starting things, and cheering each other on. Have a look around; no account needed.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/register" className="focusable group inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-violet-800 shadow-[0_10px_30px_-10px_rgba(255,255,255,0.8)] transition hover:bg-rose-50">
              Join free
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link href="/about" className="focusable rounded-full border border-white/40 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20">
              See how it works
            </Link>
          </div>

          {pulse.length > 0 && (
            <div className="mt-8">
              <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/70">
                <span className="pulse-dot relative inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Right now, counted live
              </p>
              <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {pulse.map((tile) => (
                  <li key={tile.key}>
                    <Link href={tile.href} className="focusable block rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur transition hover:border-white/40 hover:bg-white/15">
                      <span className="block text-2xl font-semibold tabular-nums leading-none">{tile.value == null ? <span className="inline-block h-6 w-10 animate-pulse rounded bg-white/20" /> : <CountUp value={tile.value} />}</span>
                      <span className="mt-1 block text-xs text-white/75">{tile.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      <section aria-label="What brings you here" className="glow-card rounded-2xl bg-white/80 p-4 backdrop-blur dark:bg-slate-900/60 sm:p-5">
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist" aria-label="What brings you here">
          {INTENTS.map((item) => {
            const active = intent.id === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setIntent(item)}
                className={cn(
                  'focusable relative flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition sm:text-[13px]',
                  active ? 'text-white' : 'text-slate-600 hover:bg-rose-50 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white'
                )}
              >
                {active && <motion.span layoutId={reduce ? undefined : 'home-intent-active'} aria-hidden className="absolute inset-0 rounded-full bg-[linear-gradient(135deg,#f43f5e_0%,#a855f7_55%,#f59e0b_100%)]" transition={{ type: 'spring', stiffness: 380, damping: 30 }} />}
                <item.icon className="relative z-10 h-3.5 w-3.5" />
                <span className="relative z-10">{item.label}</span>
              </button>
            );
          })}
        </div>
        <div className="relative mt-3 min-h-[92px]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={intent.id}
              role="tabpanel"
              initial={reduce ? false : { opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? undefined : { opacity: 0, x: -10 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">{intent.title}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{intent.copy}</p>
              </div>
              <div className="flex flex-shrink-0 flex-wrap gap-2">
                {intent.links.map(([href, label], i) => (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'focusable inline-flex items-center gap-1 rounded-full px-4 py-2 text-sm font-semibold transition',
                      i === 0 ? 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-rose-50' : 'border border-rose-200 text-slate-800 hover:bg-rose-50 dark:border-white/15 dark:text-slate-100 dark:hover:bg-white/10'
                    )}
                  >
                    {label}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </section>
    </div>
  );
}
