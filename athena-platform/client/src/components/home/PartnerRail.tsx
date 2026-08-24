'use client';

import Link from 'next/link';
import { BadgeCheck } from 'lucide-react';

/**
 * Employers who publish a concrete equity commitment, framed for members rather
 * than as ad inventory.
 *
 * These are illustrative, not signed partners — the rail is badged "Examples"
 * and every card carries a Sample chip, so the page never claims a commercial
 * relationship that does not exist. Replace PARTNERS with rows from the Brand
 * table once the ad system lands; the card shape already matches.
 */
type Partner = {
  name: string;
  category: string;
  commitment: string;
  monogram: string;
  gradient: string;
};

const PARTNERS: Partner[] = [
  {
    name: 'Northwind Technology',
    category: 'Engineering employer',
    commitment: '40% women in engineering by 2027',
    monogram: 'NT',
    gradient: 'from-sky-500 to-cyan-500',
  },
  {
    name: 'Marlowe & Finch',
    category: 'Financial services',
    commitment: 'Returnship programme for career breaks',
    monogram: 'MF',
    gradient: 'from-indigo-500 to-purple-500',
  },
  {
    name: 'Verdant Health',
    category: 'Healthcare',
    commitment: 'Paid mentoring for clinical leadership',
    monogram: 'VH',
    gradient: 'from-emerald-500 to-teal-500',
  },
  {
    name: 'Lumen Learning',
    category: 'Education platform',
    commitment: 'Free micro-credentials for members',
    monogram: 'LL',
    gradient: 'from-amber-500 to-orange-500',
  },
  {
    name: 'Atlas Recruitment',
    category: 'Talent partner',
    commitment: 'Salary-transparent roles only',
    monogram: 'AR',
    gradient: 'from-rose-500 to-pink-500',
  },
];

export function PartnerRail() {
  return (
    <section className="surface p-5">
      {/* Framed for members — which employers actually show up — rather than as
          ad inventory. The advertiser ask lives in the footer now. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <BadgeCheck className="h-4 w-4 text-rose-500" />
            <h2 className="rail-title">Who&rsquo;s actually showing up</h2>
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Employers who put a number on it, not just a values page.
          </p>
        </div>
        <span className="rounded-full border border-slate-200 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:border-slate-700">
          Examples
        </span>
      </div>

      <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {PARTNERS.map((partner) => (
          <li
            key={partner.name}
            className="tile-soft p-4"
          >
            <div className="flex items-center gap-3">
              <span
                className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${partner.gradient} text-sm font-bold text-white`}
              >
                {partner.monogram}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                  {partner.name}
                </p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {partner.category}
                </p>
              </div>
              <span className="flex-shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-400 ring-1 ring-slate-200 dark:ring-slate-700">
                Sample
              </span>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-600 dark:text-slate-400">
              {partner.commitment}
            </p>
          </li>
        ))}

      </ul>

      <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
        Know an employer who belongs here?{' '}
        <Link
          href="/contact-sales?intent=partnership"
          className="font-semibold text-rose-600 dark:text-rose-400"
        >
          Tell us about them
        </Link>
      </p>
    </section>
  );
}
