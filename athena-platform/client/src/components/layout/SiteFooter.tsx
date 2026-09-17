import Link from 'next/link';
import Image from 'next/image';
import { Heart, ShieldCheck } from 'lucide-react';
import { ORGANISATION, contactLink, HAS_LEGAL_IDENTITY } from '@/lib/contact';
import { FooterColumn } from './FooterColumn';

/**
 * The site footer, mounted once in the root layout so every page carries the
 * way out to everything else. One glass panel: the brand and the safety line
 * across the top, six columns of links on a single row, and one closing row
 * with the credit, the utility links and the legal ones.
 *
 * It is kept to six columns of five because it had grown to eight columns of
 * up to nine, which wrapped to a second row and made the footer taller than
 * the viewport. Two rules keep it that way:
 *
 *   - One line per destination, not per page. A section's own hub page is
 *     where its inner pages are listed; the footer points at the hub.
 *   - Nothing under /dashboard. Those need a session, so a signed-out reader
 *     clicking one only gets a login screen. They belong in the dashboard's
 *     own navigation.
 *
 * Everything dropped from here is still in sitemap.ts and in search. Every
 * href resolves; the auth-gated ones redirect to /login carrying a `redirect`
 * param so the reader lands where they meant to after signing in.
 */

type FooterLink = { href: string; label: string };

const COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: 'Find work',
    links: [
      { href: '/jobs', label: 'Jobs' },
      { href: '/apprenticeships', label: 'Apprenticeships' },
      { href: '/skills-marketplace', label: 'Skills marketplace' },
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
    ],
  },
  {
    title: 'Community',
    links: [
      { href: '/communities', label: 'Communities' },
      { href: '/groups', label: 'Groups' },
      { href: '/events', label: 'Events' },
      { href: '/feed', label: 'Feed' },
      { href: '/explore', label: 'Reels' },
    ],
  },
  {
    title: 'Money and business',
    links: [
      { href: '/finances', label: 'Finances' },
      { href: '/housing', label: 'Housing' },
      { href: '/business', label: 'Business' },
      { href: '/grants', label: 'Grants' },
      { href: '/pricing', label: 'Plans and pricing' },
    ],
  },
  {
    title: 'Wellbeing and cars',
    links: [
      { href: '/wellness', label: 'Wellness' },
      { href: '/cars', label: 'Cars' },
      { href: '/cars/preloved', label: 'Pre-loved cars' },
      { href: '/cars/mechanics', label: 'Find a mechanic' },
      { href: '/cars/finance', label: 'Car finance' },
    ],
  },
  {
    title: 'ATHENA',
    links: [
      { href: '/about', label: 'About' },
      { href: '/impact', label: 'Impact' },
      { href: '/careers', label: 'Careers' },
      { href: '/blog', label: 'Blog' },
      { href: '/press', label: 'Press' },
    ],
  },
];

/** The closing row: what someone needs when something has gone wrong, then the legal line. */
const UTILITY: FooterLink[] = [
  { href: '/safety-center', label: 'Safety centre' },
  { href: '/report', label: 'Report something' },
  { href: '/trust', label: 'Trust centre' },
  { href: '/privacy-center', label: 'Privacy centre' },
  { href: '/help', label: 'Help' },
  { href: '/accessibility', label: 'Accessibility' },
];

const LEGAL: FooterLink[] = [
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/cookies', label: 'Cookies' },
];

const linkClass = 'focusable rounded-sm text-[13px] leading-5 text-slate-600 transition hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-300';

/**
 * The closing row is three lists joined together, and they can name the same
 * destination twice: with no support mailbox configured, "Talk to us" falls back
 * to /help, which the utility list already links. Keeping the first occurrence
 * leaves one link per destination, and stops React seeing a repeated key.
 */
function dedupeByHref(links: FooterLink[]): FooterLink[] {
  const seen = new Set<string>();
  return links.filter((link) => {
    if (seen.has(link.href)) return false;
    seen.add(link.href);
    return true;
  });
}

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
    <footer className="mt-10 px-3 pb-6 text-slate-950 xl:px-5 dark:text-white" aria-labelledby="site-footer-heading">
      <div className="rail-panel glow-card mx-auto w-full max-w-7xl p-5 sm:p-6">
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

        {/* Six columns, one row. On a phone each folds to its heading. */}
        <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-1 border-t border-rose-100/70 pt-4 sm:grid-cols-3 sm:gap-x-6 sm:gap-y-3 lg:grid-cols-6 lg:pt-5 dark:border-white/10">
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

        {/* The closing rows: what you need when something is wrong, then the credit and the legal line. */}
        <div className="mt-5 border-t border-rose-100/70 pt-4 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {dedupeByHref([...UTILITY, ...touch, ...LEGAL]).map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="focusable rounded-sm transition hover:text-rose-600 dark:hover:text-rose-300">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          <p className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1">
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
        </div>
      </div>
    </footer>
  );
}

export default SiteFooter;
