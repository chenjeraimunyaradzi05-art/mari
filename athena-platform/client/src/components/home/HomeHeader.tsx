'use client';

/**
 * The site header: the primary navigation across the top, the light/dark
 * switch, and the way in (sign up, log in) or, for a member, the way to her
 * dashboard. Below the large breakpoint the links fold into a menu.
 */

import { Fragment, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { LayoutDashboard, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/hooks';
import ThemeSwitch from '@/components/theme/ThemeSwitch';
import { WellnessMenuList, WellnessPanel, WellnessTrigger, useWellnessMenu } from '@/components/wellness/WellnessMenu';
import { isWellnessPath } from '@/lib/wellness-nav';
import { HOME_NAV } from './nav';

/** The wellness superlink sits after this item in the header; the phone's bottom bar is untouched. */
const WELLNESS_AFTER = '/mentors';

/**
 * Between the large and extra-large breakpoints the bar is too narrow for
 * ten labelled items beside the wordmark and the sign-in buttons, so these
 * show their icon alone there, with the label as a tooltip, and get their
 * words back at extra-large.
 */
const ICON_ONLY_UNTIL_XL = new Set(['/explore', '/search', '/learning', '/events', '/salary-insights']);

function initialsOf(first?: string | null, last?: string | null): string {
  return [first, last]
    .filter(Boolean)
    .map((p) => (p as string)[0])
    .join('')
    .toUpperCase() || 'A';
}

export function HomeHeader() {
  const pathname = usePathname();
  const { isAuthenticated, user } = useAuth();
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const wellness = useWellnessMenu();
  const wellnessActive = isWellnessPath(pathname);

  // The menu closes on navigation, and never survives a resize to desktop.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)');
    const onChange = () => mql.matches && setOpen(false);
    mql.addEventListener?.('change', onChange);
    return () => mql.removeEventListener?.('change', onChange);
  }, []);

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`));

  const authControls = (
    <>
      {isAuthenticated && user ? (
        <Link href="/dashboard" className="focusable inline-flex items-center gap-2 rounded-full border border-rose-200/70 py-1 pl-1 pr-3 text-sm font-semibold text-slate-800 transition hover:border-rose-300 hover:bg-rose-50 dark:border-white/10 dark:text-slate-100 dark:hover:bg-white/5">
          {user.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatar} alt="" className="h-7 w-7 rounded-full object-cover" />
          ) : (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-purple-600 text-[11px] font-semibold text-white">{initialsOf(user.firstName, user.lastName)}</span>
          )}
          <span className="hidden sm:inline">{user.firstName}</span>
          <LayoutDashboard className="h-4 w-4 text-rose-500" />
        </Link>
      ) : (
        <>
          <Link href="/login" className="focusable rounded-full px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10">
            Log in
          </Link>
          <Link href="/register" className="focusable relative rounded-full bg-[linear-gradient(135deg,#f43f5e_0%,#a855f7_55%,#f59e0b_100%)] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_24px_-10px_rgba(168,85,247,0.7)] transition hover:shadow-[0_10px_30px_-8px_rgba(244,63,94,0.7)]">
            Sign up
          </Link>
        </>
      )}
    </>
  );

  return (
    <header ref={wellness.rootRef} className="sticky top-0 z-40 border-b border-rose-100/60 bg-white/75 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/70">
      {/* A hairline of the brand gradient along the top edge. */}
      <div aria-hidden className="h-[2px] w-full bg-[linear-gradient(90deg,#f43f5e_0%,#a855f7_50%,#f59e0b_100%)] opacity-80" />
      <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center gap-3 px-3 xl:px-5">
        <Link href="/" className="focusable mr-1 flex flex-shrink-0 items-center gap-2 rounded-lg">
          <Image src="/icon.svg" alt="ATHENA" width={32} height={32} className="rounded-lg" priority />
          <span className="hidden text-lg font-bold tracking-tight gradient-text-feminine sm:inline lg:hidden xl:inline">ATHENA</span>
        </Link>

        <nav aria-label="Primary" className="hidden min-w-0 flex-1 items-center justify-center lg:flex">
          <ul className="flex items-center gap-0.5 rounded-full border border-rose-100/70 bg-white/60 p-1 dark:border-white/10 dark:bg-white/5">
            {HOME_NAV.map((item) => {
              const active = isActive(item.href);
              return (
                <Fragment key={item.href}>
                  <li className="relative">
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      aria-label={ICON_ONLY_UNTIL_XL.has(item.href) ? item.label : undefined}
                      title={ICON_ONLY_UNTIL_XL.has(item.href) ? item.label : undefined}
                      className={cn(
                        'focusable relative z-10 flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[13px] font-medium transition-colors xl:px-3 xl:text-sm',
                        active ? 'text-white' : 'text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white'
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      <span className={cn(ICON_ONLY_UNTIL_XL.has(item.href) && 'hidden xl:inline')}>{item.label}</span>
                    </Link>
                    {active && (
                      <motion.span
                        layoutId={reduce ? undefined : 'home-nav-active'}
                        aria-hidden
                        className="absolute inset-0 rounded-full bg-[linear-gradient(135deg,#f43f5e_0%,#a855f7_55%,#f59e0b_100%)] shadow-[0_6px_18px_-8px_rgba(168,85,247,0.8)]"
                        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                      />
                    )}
                  </li>
                  {item.href === WELLNESS_AFTER && (
                    <li className="relative" {...wellness.hoverProps}>
                      <WellnessTrigger
                        menu={wellness}
                        active={wellnessActive}
                        className={cn(
                          'relative z-10 px-2.5 py-1.5 text-[13px] font-medium xl:px-3 xl:text-sm',
                          wellnessActive ? 'text-white' : wellness.open ? 'text-rose-600 dark:text-rose-300' : 'text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white'
                        )}
                      />
                      {wellnessActive && (
                        <motion.span
                          layoutId={reduce ? undefined : 'home-nav-active'}
                          aria-hidden
                          className="absolute inset-0 rounded-full bg-[linear-gradient(135deg,#f43f5e_0%,#a855f7_55%,#f59e0b_100%)] shadow-[0_6px_18px_-8px_rgba(168,85,247,0.8)]"
                          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                        />
                      )}
                    </li>
                  )}
                </Fragment>
              );
            })}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeSwitch />
          <div className="hidden items-center gap-2 lg:flex">{authControls}</div>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="home-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="focusable inline-flex h-9 w-9 items-center justify-center rounded-full border border-rose-100/70 text-slate-700 transition hover:bg-rose-50 lg:hidden dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* The wellness menu, full width under the bar. Desktop only; the phone menu lists it instead. */}
      <WellnessPanel menu={wellness} className="hidden lg:block" />

      <AnimatePresence>
        {open && (
          <motion.div
            id="home-menu"
            initial={reduce ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="border-t border-rose-100/60 bg-white/95 backdrop-blur-xl lg:hidden dark:border-white/10 dark:bg-slate-950/95"
          >
            <nav aria-label="Primary, menu" className="mx-auto max-w-[1600px] px-3 py-3">
              <ul className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                {HOME_NAV.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'focusable flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                          active ? 'bg-[linear-gradient(135deg,#f43f5e_0%,#a855f7_55%,#f59e0b_100%)] text-white' : 'text-slate-700 hover:bg-rose-50 dark:text-slate-200 dark:hover:bg-white/10'
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-3 border-t border-rose-100/60 pt-3 dark:border-white/10">
                <p className="font-display text-sm italic text-rose-700 dark:text-rose-300">Wellness</p>
                <div className="mt-2"><WellnessMenuList onNavigate={() => setOpen(false)} /></div>
              </div>
              <div className="mt-3 flex items-center gap-2 border-t border-rose-100/60 pt-3 dark:border-white/10">{authControls}</div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
