import Link from 'next/link';
import { Heart, ShieldCheck } from 'lucide-react';
import { ORGANISATION, contactLink, HAS_LEGAL_IDENTITY } from '@/lib/contact';

/**
 * The site footer, mounted once in the root layout so every page carries the
 * way out to everything else.
 *
 * Before this, the only comprehensive link map was inside the homepage's middle
 * column, which is `hidden lg:block` — so on a phone, and on all ~150 other
 * pages, there was no footer at all. Someone who landed on a shared job link
 * had no route to the safety centre, the privacy centre, or the terms they had
 * agreed to.
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
      { href: '/certifications', label: 'Certifications' },
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

export function SiteFooter() {
  const year = new Date().getFullYear();
  const support = contactLink('support');
  const help = contactLink('sales');

  return (
    <footer
      className="mt-16 border-t border-slate-200 bg-white text-slate-950 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
      aria-labelledby="site-footer-heading"
    >
      <h2 id="site-footer-heading" className="sr-only">
        Site links
      </h2>

      <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {COLUMNS.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h3 className="kicker">{column.title}</h3>
              <ul className="mt-3 space-y-2">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="focusable text-sm text-slate-600 transition hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Safety sits above the legal line, not buried in a column, because it
            is the thing someone might need in a hurry. */}
        <div className="mt-10 flex flex-col gap-3 rounded-2xl border border-rose-100 bg-rose-50/50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-rose-500/20 dark:bg-rose-500/5">
          <p className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
            <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-500" />
            <span>
              In immediate danger, call <strong>000</strong>. For family violence support in
              Australia, 1800RESPECT is on <strong>1800 737 732</strong>.
            </span>
          </p>
          <Link
            href="/safety-center"
            className="focusable flex-shrink-0 rounded-lg bg-slate-900 px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            Safety centre
          </Link>
        </div>

        <div className="mt-10 border-t border-slate-200 pt-8 dark:border-slate-800">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-md">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {ORGANISATION.shortName}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                Built in {ORGANISATION.jurisdiction}, for women everywhere.
              </p>

              {/* Credit where it is due. */}
              <p className="mt-4 flex flex-wrap items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
                <span>Designed and built by</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  Munyaradzi Chenjerai
                </span>
                <Heart className="h-3.5 w-3.5 text-rose-500" aria-hidden="true" />
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-500">
                Developer and vision founder
              </p>
            </div>

            <div className="text-sm text-slate-600 dark:text-slate-400">
              <p className="font-medium text-slate-900 dark:text-white">Get in touch</p>
              <ul className="mt-2 space-y-1.5">
                <li>
                  <Link
                    href={support.href}
                    className="focusable transition hover:text-rose-600 dark:hover:text-rose-400"
                  >
                    {support.isEmail ? support.label : 'Help centre'}
                  </Link>
                </li>
                <li>
                  <Link
                    href={help.href}
                    className="focusable transition hover:text-rose-600 dark:hover:text-rose-400"
                  >
                    {help.isEmail ? help.label : 'Talk to our team'}
                  </Link>
                </li>
                <li>
                  <Link
                    href="/contact"
                    className="focusable transition hover:text-rose-600 dark:hover:text-rose-400"
                  >
                    Contact
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800/60">
            <p className="text-xs text-slate-500">
              &copy; {year} {ORGANISATION.legalName}
              {/* The ABN and registered office are published only once they are
                  real — see lib/contact.ts. An invented company number is worse
                  than an absent one. */}
              {HAS_LEGAL_IDENTITY && ORGANISATION.abn ? ` · ABN ${ORGANISATION.abn}` : ''}
            </p>
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {LEGAL.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="focusable text-xs text-slate-500 transition hover:text-rose-600 dark:hover:text-rose-400"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default SiteFooter;
