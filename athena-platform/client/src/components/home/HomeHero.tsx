'use client';

/**
 * The opening of the home page, softly, in either theme.
 *
 * Light: a blush, lavender and cream sky with plum text and rose ink.
 * Dark: the same aurora over deep plum with cream text.
 * Both carry a serif headline that keeps naming what someone might be here
 * for, one gentle line of the platform's live numbers, and a row of intents
 * that swap a short, warm pitch with two doors. A member is greeted by name
 * for the time of day and given her quick doors instead.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';
import { ArrowRight, BookOpen, Bookmark, Briefcase, GraduationCap, LayoutDashboard, MessageCircle, PenSquare, ShieldCheck, Users, Wallet, type LucideIcon } from 'lucide-react';
import { courseApi, eventsApi, groupsApi, jobApi } from '@/lib/api';
import { useAuth } from '@/lib/hooks';
import { cn } from '@/lib/utils';

const PHRASES = ['a new career', 'a fair salary', 'your own business', 'a mentor who gets it', 'a softer landing'];

type Intent = { id: string; label: string; icon: LucideIcon; title: string; copy: string; links: Array<[string, string]> };

const INTENTS: Intent[] = [
  { id: 'career', label: 'Work', icon: Briefcase, title: 'Roles that show the pay', copy: 'Employers here say what they pay before you apply, and a coach helps with the interview you are dreading.', links: [['/jobs', 'See the roles'], ['/salary-insights', 'What roles pay']] },
  { id: 'money', label: 'Money', icon: Wallet, title: 'Money, without the dread', copy: 'A ledger you can read at a glance, the BAS worked out from it, and grants you might actually get.', links: [['/finances', 'Your finances'], ['/grants', 'Grants']] },
  { id: 'learning', label: 'Learning', icon: GraduationCap, title: 'Learn at your own pace', copy: 'Courses from the providers who run them, a certificate anyone can check, and apprenticeships that pay you while you learn.', links: [['/courses', 'Browse courses'], ['/apprenticeships', 'Apprenticeships']] },
  { id: 'community', label: 'People', icon: Users, title: 'Women a few steps ahead', copy: 'Small rooms for what you are going through, and mentors you can book an hour with.', links: [['/communities', 'Find your room'], ['/mentors', 'Meet the mentors']] },
  { id: 'safety', label: 'Safety', icon: ShieldCheck, title: 'A space that is yours', copy: 'Women only, real people moderating, a safe mode that hides what needs hiding, and controls you own.', links: [['/safety-center', 'How we keep it safe'], ['/trust', 'Trust centre']] },
];

/** A member's quick doors, in place of the visitor's intents. */
const QUICK: Array<{ href: string; label: string; hint: string; icon: LucideIcon; tint: string }> = [
  { href: '/dashboard', label: 'Your dashboard', hint: 'Everything of yours', icon: LayoutDashboard, tint: 'from-rose-400 to-pink-500' },
  { href: '/dashboard/learn/my-courses', label: 'Your courses', hint: 'Pick up where you stopped', icon: BookOpen, tint: 'from-violet-400 to-fuchsia-500' },
  { href: '/dashboard/saved-jobs', label: 'Saved jobs', hint: 'The roles you kept', icon: Bookmark, tint: 'from-amber-300 to-rose-400' },
  { href: '/dashboard/messages', label: 'Messages', hint: 'Your conversations', icon: MessageCircle, tint: 'from-sky-300 to-violet-400' },
];

function greeting(hour: number): string {
  if (hour < 5) return 'Still up';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * The headline's changing phrase. Deep rose to purple to amber on a pale sky;
 * blush to lavender to butter on a dark one. Kept as one class so the two
 * halves of the theme never drift apart.
 */
const PHRASE_INK =
  'bg-[linear-gradient(90deg,#be123c_0%,#9333ea_52%,#c2410c_100%)] dark:bg-[linear-gradient(90deg,#fecdd3_0%,#e9d5ff_50%,#fde68a_100%)] bg-clip-text italic text-transparent';

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
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 900);
      setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
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

/** The platform's live numbers. A source that fails is left out of the sentence. */
function usePulse() {
  const jobs = useQuery({ queryKey: ['home-pulse', 'jobs'], queryFn: () => jobApi.search({ limit: 1 }), select: (r) => Number(r.data?.pagination?.total ?? listLength(r.data?.data)), staleTime: 60_000 });
  const courses = useQuery({ queryKey: ['home-pulse', 'courses'], queryFn: () => courseApi.getAll({ limit: 1 }), select: (r) => Number(r.data?.pagination?.total ?? listLength(r.data?.data)), staleTime: 60_000 });
  const groups = useQuery({ queryKey: ['home-pulse', 'groups'], queryFn: () => groupsApi.list(), select: (r) => listLength(r.data?.data ?? r.data), staleTime: 60_000 });
  const events = useQuery({ queryKey: ['home-pulse', 'events'], queryFn: () => eventsApi.list(), select: (r) => listLength(r.data?.data ?? r.data), staleTime: 60_000 });
  return [
    { key: 'jobs', href: '/jobs', value: jobs.data, error: jobs.isError, one: 'open role', many: 'open roles' },
    { key: 'courses', href: '/courses', value: courses.data, error: courses.isError, one: 'course', many: 'courses' },
    { key: 'groups', href: '/communities', value: groups.data, error: groups.isError, one: 'community', many: 'communities' },
    { key: 'events', href: '/events', value: events.data, error: events.isError, one: 'event coming up', many: 'events coming up' },
  ].filter((t) => !t.error && (t.value === undefined || t.value > 0));
}

function Twinkle({ className }: { className: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={cn('twinkle h-4 w-4 text-rose-300 dark:text-white/90', className)} fill="currentColor">
      <path d="M12 2c.6 4.6 3.4 7.4 8 8-4.6.6-7.4 3.4-8 8-.6-4.6-3.4-7.4-8-8 4.6-.6 7.4-3.4 8-8z" />
    </svg>
  );
}

export function HomeHero() {
  const reduce = useReducedMotion();
  const { isAuthenticated, user } = useAuth();
  const [phrase, setPhrase] = useState(0);
  const [intent, setIntent] = useState<Intent>(INTENTS[0]);
  // The greeting depends on the viewer's clock, which the server does not
  // have, so it is settled after mount to keep the first render identical.
  const [hello, setHello] = useState('Welcome back');
  const pulse = usePulse();
  const member = isAuthenticated && Boolean(user);

  // The aurora follows the pointer a little, each blob by a different amount,
  // so the card has depth. Springs keep it slow; reduced motion switches it off.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 60, damping: 20 });
  const sy = useSpring(py, { stiffness: 60, damping: 20 });
  const b1x = useTransform(sx, (v) => v * 28);
  const b1y = useTransform(sy, (v) => v * 22);
  const b2x = useTransform(sx, (v) => v * -20);
  const b2y = useTransform(sy, (v) => v * -16);
  const b3x = useTransform(sx, (v) => v * 14);
  const b3y = useTransform(sy, (v) => v * -26);
  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (reduce) return;
    const r = event.currentTarget.getBoundingClientRect();
    px.set(((event.clientX - r.left) / r.width - 0.5) * 2);
    py.set(((event.clientY - r.top) / r.height - 0.5) * 2);
  };
  const onPointerLeave = () => {
    px.set(0);
    py.set(0);
  };

  useEffect(() => {
    setHello(greeting(new Date().getHours()));
  }, []);

  useEffect(() => {
    if (reduce || member) return;
    const id = window.setInterval(() => setPhrase((p) => (p + 1) % PHRASES.length), 2600);
    return () => window.clearInterval(id);
  }, [reduce, member]);

  const loaded = pulse.filter((t) => typeof t.value === 'number');

  return (
    <div className="space-y-4">
      <section
        aria-labelledby="home-hero-title"
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        className="relative overflow-hidden rounded-[2rem] border border-rose-200/70 text-slate-900 shadow-[0_24px_60px_-38px_rgba(190,24,93,0.45)] dark:border-white/10 dark:text-white dark:shadow-[0_30px_80px_-40px_rgba(236,72,153,0.6)]"
      >
        {/* A pale blush sky by day, deep plum by night. */}
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(120%_120%_at_0%_0%,#fff1f2_0%,#fae8ff_48%,#fff7ed_100%)] dark:bg-[radial-gradient(120%_120%_at_0%_0%,#5b1d4f_0%,#2a1236_45%,#3a1224_100%)]" />
        <motion.div aria-hidden style={{ x: b1x, y: b1y }} className="pointer-events-none absolute inset-0">
          <div className="aurora-blob left-[-12%] top-[-25%] h-72 w-72 bg-rose-300 dark:bg-rose-400" />
        </motion.div>
        <motion.div aria-hidden style={{ x: b2x, y: b2y }} className="pointer-events-none absolute inset-0">
          <div className="aurora-blob aurora-blob--slow right-[-8%] top-[5%] h-80 w-80 bg-fuchsia-200 dark:bg-fuchsia-400" />
        </motion.div>
        <motion.div aria-hidden style={{ x: b3x, y: b3y }} className="pointer-events-none absolute inset-0">
          <div className="aurora-blob aurora-blob--slower bottom-[-35%] left-[30%] h-72 w-72 bg-amber-200 dark:bg-amber-300" />
        </motion.div>
        <div aria-hidden className="grid-fade absolute inset-0 opacity-40" />
        <Twinkle className="right-[9%] top-[14%]" />
        <Twinkle className="twinkle--2 right-[22%] top-[38%] h-3 w-3" />
        <Twinkle className="twinkle--3 right-[13%] bottom-[22%] h-5 w-5" />

        <div className="relative p-6 sm:p-8 lg:p-10">
          <p className="eyebrow-soft text-rose-600 dark:text-rose-100/90">{member ? 'Welcome back' : 'Welcome to ATHENA'}</p>

          {member ? (
            <h1 id="home-hero-title" className="mt-3 max-w-2xl font-display text-[2rem] font-medium leading-[1.12] sm:text-4xl 2xl:text-[2.6rem]">
              <span className="block">
                {hello}, <span className={PHRASE_INK}>{user?.firstName}</span>.
              </span>
              <span className="block">Where to today?</span>
            </h1>
          ) : (
            /* The phrase changes, the layout does not: every phrase is laid out
               in the same grid cell, the inactive ones invisible, so the slot is
               always as wide and as tall as the longest of them. */
            <h1 id="home-hero-title" className="mt-3 max-w-2xl font-display text-[2rem] font-medium leading-[1.12] sm:text-4xl 2xl:text-[2.6rem]">
              <span className="block">Working towards</span>
              <span className="inline-grid max-w-full align-top">
                {PHRASES.map((p, i) => {
                  const active = i === phrase;
                  return (
                    <motion.span
                      key={p}
                      aria-hidden={!active}
                      initial={false}
                      animate={reduce ? { opacity: active ? 1 : 0 } : { opacity: active ? 1 : 0, y: active ? 0 : 12, filter: active ? 'blur(0px)' : 'blur(4px)' }}
                      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                      className={cn('col-start-1 row-start-1 whitespace-nowrap', PHRASE_INK, !active && 'pointer-events-none')}
                    >
                      {p}?
                    </motion.span>
                  );
                })}
              </span>
              <span className="block">You don&rsquo;t have to do it alone.</span>
            </h1>
          )}

          <p className="mt-5 max-w-lg text-[15px] leading-7 text-slate-700 dark:text-rose-50/90">
            {member ? 'Pick up where you left off, or see what has happened here since you were last in.' : 'Women here are changing careers, asking the awkward salary questions, starting things, and cheering each other on. Have a look around; no account needed, no rush.'}
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            {member ? (
              <>
                <Link href="/dashboard/create-post" className="focusable inline-flex items-center gap-2 rounded-full bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_26px_-12px_rgba(244,63,94,0.9)] transition hover:bg-rose-600 dark:bg-white dark:text-rose-700 dark:hover:bg-rose-50">
                  <PenSquare className="h-4 w-4" /> Share a win
                </Link>
                <Link href="/dashboard" className="focusable inline-flex items-center gap-2 rounded-full border border-rose-300 bg-white/70 px-5 py-2.5 text-sm font-semibold text-rose-700 backdrop-blur transition hover:bg-white dark:border-white/40 dark:bg-white/10 dark:text-white dark:hover:bg-white/20">
                  Your dashboard <ArrowRight className="h-4 w-4" />
                </Link>
              </>
            ) : (
              <>
                <Link href="/register" className="focusable group inline-flex items-center gap-2 rounded-full bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_26px_-12px_rgba(244,63,94,0.9)] transition hover:bg-rose-600 dark:bg-white dark:text-rose-700 dark:shadow-[0_10px_30px_-10px_rgba(255,255,255,0.8)] dark:hover:bg-rose-50">
                  Join, it&rsquo;s free
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link href="/about" className="focusable rounded-full border border-rose-300 bg-white/70 px-5 py-2.5 text-sm font-semibold text-rose-700 backdrop-blur transition hover:bg-white dark:border-white/40 dark:bg-white/10 dark:text-white dark:hover:bg-white/20">
                  Have a look around first
                </Link>
              </>
            )}
          </div>

          {/* One gentle sentence of live numbers rather than a row of boxes. */}
          {pulse.length > 0 && (
            <p className="mt-7 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-slate-600 dark:text-rose-50/85">
              <span className="pulse-dot relative mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-300" aria-hidden />
              <span>Right now there are</span>
              {loaded.length === 0 ? (
                <span className="inline-block h-4 w-40 animate-pulse rounded bg-rose-200/70 dark:bg-white/20" aria-label="Counting" />
              ) : (
                loaded.map((t, i) => (
                  <span key={t.key}>
                    <Link href={t.href} className="focusable rounded-sm font-display text-base font-semibold italic text-rose-700 underline decoration-rose-300 decoration-1 underline-offset-4 transition hover:decoration-rose-500 dark:text-white dark:decoration-rose-300/60 dark:hover:decoration-white">
                      <CountUp value={t.value as number} /> {t.value === 1 ? t.one : t.many}
                    </Link>
                    {i < loaded.length - 2 ? ',' : i === loaded.length - 2 ? ' and' : '.'}
                  </span>
                ))
              )}
            </p>
          )}
        </div>
      </section>

      {member ? (
        <section aria-label="Your quick doors" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {QUICK.map((q) => (
            <Link key={q.href} href={q.href} className="tile-glass group flex items-start gap-3 p-4">
              <span className={cn('flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-white', q.tint)}>
                <q.icon className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-900 dark:text-white">{q.label}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">{q.hint}</span>
              </span>
            </Link>
          ))}
        </section>
      ) : (
        <section aria-label="What brings you here" className="rail-panel glow-card p-4 sm:p-5">
          <p className="eyebrow-soft mb-3 text-rose-500 dark:text-rose-300">What brings you here?</p>
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
                    'focusable relative flex flex-shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition',
                    active ? 'text-white' : 'text-slate-600 hover:bg-rose-50 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white'
                  )}
                >
                  {active && <motion.span layoutId={reduce ? undefined : 'home-intent-active'} aria-hidden className="absolute inset-0 rounded-full bg-[linear-gradient(135deg,#fb7185_0%,#c084fc_55%,#fcd34d_100%)]" transition={{ type: 'spring', stiffness: 380, damping: 30 }} />}
                  <item.icon className="relative z-10 h-3.5 w-3.5" />
                  <span className="relative z-10">{item.label}</span>
                </button>
              );
            })}
          </div>
          {/* Every panel is laid out in the same cell, so the card is always as
              tall as the tallest of them and nothing below it moves. */}
          <div className="relative mt-3 grid">
            {INTENTS.map((item) => {
              const active = item.id === intent.id;
              return (
                <motion.div
                  key={item.id}
                  role="tabpanel"
                  aria-hidden={!active}
                  initial={false}
                  animate={reduce ? { opacity: active ? 1 : 0 } : { opacity: active ? 1 : 0, x: active ? 0 : 8 }}
                  transition={{ duration: 0.25 }}
                  className={cn('col-start-1 row-start-1 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between', !active && 'pointer-events-none')}
                >
                  <div className="min-w-0">
                    <h2 className="font-display text-xl font-medium text-slate-900 dark:text-white">{item.title}</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.copy}</p>
                  </div>
                  <div className="flex flex-shrink-0 flex-wrap gap-2">
                    {item.links.map(([href, label], i) => (
                      <Link
                        key={href}
                        href={href}
                        tabIndex={active ? 0 : -1}
                        className={cn(
                          'focusable inline-flex items-center gap-1 rounded-full px-4 py-2 text-sm font-semibold transition',
                          i === 0 ? 'bg-rose-500 text-white hover:bg-rose-600 dark:bg-rose-400 dark:text-slate-950 dark:hover:bg-rose-300' : 'bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-500/15 dark:text-rose-200 dark:hover:bg-rose-500/25'
                        )}
                      >
                        {label}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
