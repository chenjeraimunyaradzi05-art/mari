import Link from 'next/link';
import Image from 'next/image';
import { Heart, ShieldCheck } from 'lucide-react';
import { ORGANISATION, contactLink, HAS_LEGAL_IDENTITY } from '@/lib/contact';
import { FooterColumn } from './FooterColumn';

/**
 * The site footer, mounted once in the root layout so every page carries the
 * way out to everything else. One glass panel, compact: the brand and the
 * safety line across the top, six tight columns of links, and one closing
 * row with the credit, the ways to get in touch and the legal links.
 *
 * Every href here resolves: each was requested against a running server, and
 * the auth-gated ones redirect to /login carrying a `redirect` param so the
 * reader lands where they meant to after signing in.
 */

type FooterLink = { href: string; label: string };

const COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: 'Find work',
    links: [
      { href: '/jobs', label: 'Jobs' },
      { href: '/apprenticeships', label: 'Apprenticeships' },
      { href: '/skills-marketplace', label: 'Skills marketplace' },
      { href: '/rfps', label: 'Contracts and tenders' },
      { href: '/salary-insights', label: 'Salary insights' },
      { href: '/employer', label: 'For employers' },
    ],
  },
  {
    title: 'Learn',
    links: [
      { href: '/learning', label: 'Learning' },
      { href: '/courses', label: 'Courses' },
      { href: '/certifications', label: 'Certificates' },
      { href: '/skills', label: 'Skills' },
      { href: '/mentors', label: 'Mentors' },
      { href: '/mentorship', label: 'How mentoring works' },
    ],
  },
  {
    title: 'Community',
    links: [
      { href: '/communities', label: 'Communities' },
      { href: '/groups', label: 'Groups' },
      { href: '/events', label: 'Events' },
      { href: '/network', label: 'Network' },
      { href: '/feed', label: 'Feed' },
      { href: '/explore', label: 'Reels' },
      { href: '/stories', label: 'Member stories' },
    ],
  },
  {
    title: 'Money and business',
    links: [
      { href: '/finances', label: 'Finances' },
      { href: '/housing', label: 'Housing' },
      { href: '/business', label: 'Business' },
      { href: '/formation', label: 'Company formation' },
      { href: '/grants', label: 'Grants' },
      { href: '/capital', label: 'Capital' },
      { href: '/accelerator', label: 'Accelerator' },
      { href: '/vendors', label: 'Vendors' },
      { href: '/pricing', label: 'Plans and pricing' },
    ],
  },
  {
    title: 'Wellbeing',
    links: [
      { href: '/wellness', label: 'Wellness' },
      { href: '/dashboard/wellness/track', label: 'Health dashboard' },
      { href: '/dashboard/wellness/forums', label: 'Forums' },
      { href: '/dashboard/wellness/circles', label: 'Support circles' },
      { href: '/dashboard/wellness/practitioners', label: 'Find care' },
      { href: '/dashboard/wellness/mental-load', label: 'The mental load' },
      { href: '/dashboard/wellness/habits', label: 'Habits and goals' },
      { href: '/dashboard/wellness/library', label: 'The library' },
    ],
  },
  {
    title: 'Safety and privacy',
    links: [
      { href: '/safety-center', label: 'Safety centre' },
      { href: '/report', label: 'Report something' },
      { href: '/trust', label: 'Trust centre' },
      { href: '/privacy-center', label: 'Privacy centre' },
      { href: '/help/community-guidelines', label: 'Community guidelines' },
      { href: '/help/transparency-report', label: 'Transparency report' },
      { href: '/help/appeal', label: 'Appeal a decision' },
      { href: '/accessibility', label: 'Accessibility' },
    ],
  },
  {
    title: 'ATHENA',
    links: [
      { href: '/about', label: 'About' },
      { href: '/impact', label: 'Impact' },
      { href: '/team', label: 'Team' },
      { href: '/careers', label: 'Careers' },
      { href: '/press', label: 'Press' },
      { href: '/blog', label: 'Blog' },
      { href: '/developers', label: 'Developers' },
      { href: '/changelog', label: 'Changelog' },
      { href: '/status', label: 'Status' },
    ],
  },
];

const LEGAL: FooterLink[] = [
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/cookies', label: 'Cookies' },
  { href: '/mentor-agreement', label: 'Mentor agreement' },
];

const linkClass = 'focusable rounded-sm text-[13px] leading-5 text-slate-600 transition hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-300';

export function SiteFooter() {
  const year = new Date().getFullYear();
  const support = contactLink('support');
  const help = contactLink('sales');
  const touch: FooterLink[] = [
    { href: support.href, label: support.isEmail ? support.label : 'Help centre' },
    { href: help.href, label: help.isEmail ? help.label : 'Talk to our team' },
    { href: '/contact', label: 'Contact' },
  ];

  return (
    <footer className="mt-14 px-3 pb-8 text-slate-950 xl:px-5 dark:text-white" aria-labelledby="site-footer-heading">
      <div className="rail-panel glow-card mx-auto w-full max-w-7xl p-5 sm:p-7">
        <h2 id="site-footer-heading" className="sr-only">
          Site links
        </h2>

        {/* The brand on the left; the thing someone might need in a hurry on the right. */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <Image src="/icon.svg" alt="" width={36} height={36} className="rounded-xl" />
            <div>
              <p className="font-display text-xl font-medium leading-tight text-slate-900 dark:text-white">{ORGANISATION.shortName}</p>
              <p className="eyebrow-soft text-rose-500 dark:text-rose-300">Built in {ORGANISATION.jurisdiction}, for women everywhere.</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 rounded-2xl bg-rose-50/80 px-4 py-3 text-[13px] leading-5 text-slate-700 sm:flex-row sm:items-center dark:bg-rose-500/10 dark:text-slate-200">
            <p className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-500" strokeWidth={1.75} />
              <span>
                In immediate danger, call <strong>000</strong>. For family violence support in Australia, 1800RESPECT is on <strong>1800 737 732</strong>.
              </span>
            </p>
            <Link href="/safety-center" className="focusable flex-shrink-0 rounded-full bg-rose-500 px-3.5 py-1.5 text-center text-xs font-semibold text-white transition hover:bg-rose-600 dark:bg-rose-400 dark:text-slate-950 dark:hover:bg-rose-300">
              Safety centre
            </Link>
          </div>
        </div>

        {/* Six tight columns on a wide screen; on a phone each folds to its heading. */}
        <div className="mt-6 grid grid-cols-1 gap-x-6 gap-y-2 border-t border-rose-100/70 pt-5 sm:grid-cols-2 sm:gap-y-3 lg:grid-cols-6 lg:gap-y-5 lg:pt-6 dark:border-white/10">
          {COLUMNS.map((column) => (
            <FooterColumn key={column.title} title={column.title}>
              <ul className="space-y-1">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className={linkClass}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </FooterColumn>
          ))}
        </div>

        {/* One closing row: credit, ways in, the legal line. */}
        <div className="mt-6 flex flex-col gap-3 border-t border-rose-100/70 pt-5 text-xs text-slate-500 lg:flex-row lg:items-center lg:justify-between dark:border-white/10 dark:text-slate-400">
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <span>
              &copy; {year} {ORGANISATION.legalName}
              {/* The ABN is published only once it is real; see lib/contact.ts. */}
              {HAS_LEGAL_IDENTITY && ORGANISATION.abn ? ` · ABN ${ORGANISATION.abn}` : ''}
            </span>
            <span aria-hidden className="text-rose-300">·</span>
            <span>
              Designed and built by <span className="font-semibold text-slate-800 dark:text-slate-100">Munyaradzi Chenjerai</span>, developer and vision founder
            </span>
            <Heart className="h-3 w-3 text-rose-500" aria-hidden="true" />
          </p>
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {[...touch, ...LEGAL].map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="focusable rounded-sm transition hover:text-rose-600 dark:hover:text-rose-300">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}

export default SiteFooter;
