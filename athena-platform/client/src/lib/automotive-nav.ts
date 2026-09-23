/**
 * The automotive area, in one place. The header, the phone menu, the
 * dashboard sidebar, the pill navigation across the car pages, the public
 * cars page, the footer and the directories all read this, so a page added
 * here is reachable from everywhere at once.
 *
 * Browsing is open: the catalogue, the pre-loved listings, the workshops,
 * the calculators and the guides need no account. The member pages
 * (garage, selling, purchases, bookings, finance) redirect a signed-out
 * visitor to /login with a `redirect` back, so `gated` only sets the
 * expectation.
 */

import {
  BadgeDollarSign,
  Building2,
  Car,
  CarFront,
  ClipboardCheck,
  FileCheck2,
  Gauge,
  Banknote,
  Heart,
  KeyRound,
  ShieldCheck,
  Sparkles,
  Store,
  Tag,
  Umbrella,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

export type AutoTone = 'rose' | 'purple' | 'amber' | 'emerald' | 'sky';

export type AutoLink = {
  href: string;
  label: string;
  short?: string;
  blurb: string;
  icon: LucideIcon;
  gated?: boolean;
  /** False keeps a page out of the pill navigation (it stays in the menu). */
  pill?: boolean;
};

export type AutoGroup = {
  key: string;
  title: string;
  intro: string;
  tone: AutoTone;
  items: AutoLink[];
};

export const CARS_HOME = '/cars';
export const CARS_DASHBOARD = '/dashboard/cars';

export const AUTO_GROUPS: AutoGroup[] = [
  {
    key: 'buy',
    title: 'Buying',
    intro: 'Safety first, running costs second, the badge last.',
    tone: 'rose',
    items: [
      { href: '/cars/new', label: 'New cars', blurb: 'The catalogue, ANCAP dated, running costs worked out, reviews from women', icon: CarFront },
      { href: '/cars/preloved', label: 'Pre-loved', blurb: 'Used cars with a price guide, history checks and buyer protection', icon: Tag },
      { href: '/cars/safety', label: 'Safety, explained', short: 'Safety', blurb: 'What every acronym on the spec sheet does for you', icon: ShieldCheck },
      { href: '/dashboard/cars/saved', label: 'Saved cars', blurb: 'The listings you are watching', icon: Heart, gated: true, pill: false },
    ],
  },
  {
    key: 'money',
    title: 'Paying for it',
    intro: 'The arithmetic a good broker does on a napkin.',
    tone: 'emerald',
    items: [
      { href: '/cars/finance', label: 'Finance', blurb: 'Repayments, loans compared, what you can carry, and pre-approval', icon: Banknote },
      { href: '/cars/insurance', label: 'Insurance', blurb: 'A fair premium, the cover types, and the claims process', icon: Umbrella },
      { href: '/cars/value', label: 'What is it worth', short: 'Valuation', blurb: 'Your car\'s value, a trade-in quote, and the changeover to the next one', icon: BadgeDollarSign },
      { href: '/dashboard/cars/finance', label: 'Finance readiness', blurb: 'Where you stand before you go to a lender', icon: FileCheck2, gated: true, pill: false },
    ],
  },
  {
    key: 'keep',
    title: 'Looking after it',
    intro: 'Mechanics who explain the bill, and reminders before the bill.',
    tone: 'amber',
    items: [
      { href: '/cars/mechanics', label: 'Find a mechanic', short: 'Mechanics', blurb: 'Women-owned workshops and women mechanics, prices shown, rated by real jobs', icon: Wrench },
      { href: '/dashboard/cars/garage', label: 'Your garage', blurb: 'Service history, warranty, rego and insurance reminders', icon: KeyRound, gated: true },
      { href: '/dashboard/cars/bookings', label: 'Bookings', blurb: 'Quotes to accept, jobs under way, and the ones to rate', icon: ClipboardCheck, gated: true },
      { href: '/cars/safety#maintenance', label: 'Maintenance guide', short: 'Maintenance', blurb: 'What needs doing, how often, and what it should cost', icon: Gauge, pill: false },
      { href: '/cars/mechanics#fleet', label: 'Fleet programme', blurb: 'For a business with a few vehicles: one account, one statement, the workshops at a fleet rate', icon: Building2, pill: false },
    ],
  },
  {
    key: 'sell',
    title: 'Selling and trading',
    intro: 'A fair price, a safe handover, and the money held until she has the keys.',
    tone: 'purple',
    items: [
      { href: '/dashboard/cars/sell', label: 'Sell a car', blurb: 'List it with a price guide and buyer protection', icon: Sparkles, gated: true },
      { href: '/dashboard/cars/purchases', label: 'Offers and purchases', short: 'Purchases', blurb: 'Buying or selling, every step and where the money is', icon: Car, gated: true },
      { href: '/cars/dealerships', label: 'Dealerships', blurb: 'Test drives, trade-in quotes, and women-led showrooms', icon: Store },
      { href: '/dashboard/cars/requests', label: 'Test drives and trade-ins', short: 'Requests', blurb: 'What you have asked for and the quotes that came back', icon: Tag, gated: true, pill: false },
    ],
  },
];

export const AUTO_LINKS: AutoLink[] = AUTO_GROUPS.flatMap((g) => g.items);

/** The pill navigation across the car pages, in the menu's order, with the overview first. */
export const AUTO_PILLS: Array<{ href: string; label: string }> = [{ href: CARS_DASHBOARD, label: 'Overview' }, ...AUTO_LINKS.filter((l) => l.pill !== false).map((l) => ({ href: l.href, label: l.short ?? l.label }))];

export function isCarsPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return pathname === CARS_HOME || pathname.startsWith(`${CARS_HOME}/`) || pathname.startsWith(CARS_DASHBOARD);
}

export const AUTO_TONES: Record<AutoTone, string> = {
  rose: 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300',
  purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  sky: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
};
