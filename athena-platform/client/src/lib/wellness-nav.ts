/**
 * The wellness area, in one place. The header's wellness menu, the phone
 * menu, the dashboard sidebar, the pill navigation across the wellness
 * pages, the public wellness page and the directories all read this, so a
 * page added here is reachable from everywhere at once and a page removed
 * here disappears from everywhere at once.
 *
 * Every href resolves. The member pages redirect a signed-out visitor to
 * /login with a `redirect` back, so `gated` only sets the expectation.
 */

import {
  Activity,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  HeartPulse,
  Leaf,
  Lock,
  MessageCircleHeart,
  Pill,
  Scale,
  Stethoscope,
  Sun,
  Upload,
  Users,
  type LucideIcon,
} from 'lucide-react';

export type WellnessTone = 'rose' | 'purple' | 'amber' | 'emerald';

export type WellnessLink = {
  href: string;
  label: string;
  /** The short form for the pill navigation, where "What the days are saying" is too long. */
  short?: string;
  blurb: string;
  icon: LucideIcon;
  gated?: boolean;
  /** False keeps a page out of the pill navigation (it stays in the menu). */
  pill?: boolean;
};

export type WellnessGroup = {
  key: string;
  title: string;
  intro: string;
  tone: WellnessTone;
  items: WellnessLink[];
};

export const WELLNESS_HOME = '/wellness';
export const WELLNESS_TODAY = '/dashboard/wellness';
export const WELLNESS_CHECK = '/wellness#check';

export const WELLNESS_GROUPS: WellnessGroup[] = [
  {
    key: 'you',
    title: 'Your body and mind',
    intro: 'A minute a day, encrypted and read only by you.',
    tone: 'rose',
    items: [
      { href: '/dashboard/wellness', label: 'Today', blurb: 'The check-in, your cycle, the doses and habits due', icon: Sun, gated: true },
      { href: '/dashboard/wellness/track', label: 'Track', blurb: 'Mood, sleep, movement, water, food, the cycle, a symptom', icon: HeartPulse, gated: true },
      { href: '/dashboard/wellness/insights', label: 'What the days are saying', short: 'Insights', blurb: 'Patterns, what is worth raising, and a report for the doctor', icon: Activity, gated: true },
      { href: '/dashboard/wellness/medications', label: 'Medications', blurb: 'Doses, reminders, refills and notes from a visit', icon: Pill, gated: true },
    ],
  },
  {
    key: 'support',
    title: 'Support',
    intro: 'Women who get it, and the words to hand things over.',
    tone: 'purple',
    items: [
      { href: '/dashboard/wellness/forums', label: 'Forums', blurb: 'Anxiety, low mood, burnout, motherhood, grief; anonymous if you want', icon: MessageCircleHeart, gated: true },
      { href: '/dashboard/wellness/circles', label: 'Support circles', short: 'Circles', blurb: 'Four to six women, one topic, eight weeks of check-ins', icon: Users, gated: true },
      { href: '/dashboard/wellness/mental-load', label: 'The mental load', short: 'Mental load', blurb: 'Log the invisible work, see who carries it, hand some over', icon: Scale, gated: true },
    ],
  },
  {
    key: 'care',
    title: 'Care',
    intro: 'Practitioners who take you seriously, telehealth marked.',
    tone: 'amber',
    items: [
      { href: '/dashboard/wellness/practitioners', label: 'Find care', blurb: 'GPs, psychologists, gynaecologists and more, rated only by real visits', icon: Stethoscope, gated: true },
      { href: '/dashboard/wellness/bookings', label: 'Appointments', blurb: 'What is coming, what happened, and the follow-up', icon: CalendarCheck, gated: true },
      { href: '/dashboard/wellness/practice', label: 'For practitioners', blurb: 'Your listing, your hours, and the requests that come in', icon: ClipboardList, gated: true, pill: false },
    ],
  },
  {
    key: 'keep',
    title: 'Keep going',
    intro: 'Small things, kept, with the research behind them.',
    tone: 'emerald',
    items: [
      { href: '/dashboard/wellness/habits', label: 'Habits and goals', blurb: 'Streaks, peer challenges, and goals read from what you logged', icon: Leaf, gated: true },
      { href: '/dashboard/wellness/library', label: 'The library', short: 'Library', blurb: 'Sleep, eating, movement, stress, hormones, from Australian sources', icon: BookOpen, gated: true },
      { href: '/dashboard/wellness/import', label: 'Bring your data', blurb: 'Apple Health, Google Fit, or a CSV you exported before', icon: Upload, gated: true, pill: false },
      { href: '/dashboard/wellness/settings', label: 'Privacy', blurb: 'Every tracker can be switched off; everything can be deleted', icon: Lock, gated: true },
    ],
  },
];

export const WELLNESS_LINKS: WellnessLink[] = WELLNESS_GROUPS.flatMap((g) => g.items);

/** The pill navigation across the wellness pages, in the menu's order. */
export const WELLNESS_PILLS: Array<{ href: string; label: string }> = WELLNESS_LINKS.filter((l) => l.pill !== false).map((l) => ({ href: l.href, label: l.short ?? l.label }));

export function isWellnessPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return pathname === WELLNESS_HOME || pathname.startsWith(`${WELLNESS_HOME}/`) || pathname.startsWith(WELLNESS_TODAY);
}

/** The tint each group's icons take, light and dark. */
export const WELLNESS_TONES: Record<WellnessTone, string> = {
  rose: 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300',
  purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
};
