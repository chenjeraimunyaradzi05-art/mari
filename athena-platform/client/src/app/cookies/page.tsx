import { promises as fs } from 'fs';
import path from 'path';
import Link from 'next/link';
import type { Metadata } from 'next';
import { markdownToSafeHtml } from '@/lib/markdown';
import { renderLegalTokens } from '@/lib/contact';
import CookiePreferencesButton from './CookiePreferencesButton';

export const metadata: Metadata = {
  title: 'Cookie Policy | ATHENA',
  description: 'The cookies and browser storage ATHENA actually uses, and how to change your choices.',
};

/**
 * Rendered from src/content/legal/cookies.md through the same loader as
 * /privacy and /terms, so there is one dated policy text. This page used to be
 * hand-written TSX listing Google Analytics, Meta Pixel and LinkedIn cookies
 * the app never sets; the markdown now lists only what the platform stores.
 */
export default async function CookiesPage() {
  const filePath = path.join(process.cwd(), 'src', 'content', 'legal', 'cookies.md');
  const markdown = await fs.readFile(filePath, 'utf8');
  const html = markdownToSafeHtml(renderLegalTokens(markdown));

  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <section className="mb-10 flex flex-col gap-4 rounded-2xl border border-rose-100 bg-gradient-to-r from-rose-50 to-amber-50 p-6 dark:border-rose-900/40 dark:from-rose-950/30 dark:to-amber-950/20 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Your cookie choices</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Change your mind whenever you like. Until you choose, only what the platform needs is set.
          </p>
        </div>
        <CookiePreferencesButton />
      </section>

      <div className="prose prose-slate dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: html }} />

      <nav aria-label="Related policies" className="mt-10 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        <Link href="/privacy" className="text-rose-700 hover:underline dark:text-rose-300">Privacy Policy</Link>
        <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">|</span>
        <Link href="/privacy/au" className="text-rose-700 hover:underline dark:text-rose-300">Australian Privacy Statement</Link>
        <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">|</span>
        <Link href="/privacy/uk" className="text-rose-700 hover:underline dark:text-rose-300">UK Privacy Addendum</Link>
        <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">|</span>
        <Link href="/terms" className="text-rose-700 hover:underline dark:text-rose-300">Terms of Service</Link>
        <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">|</span>
        <Link href="/privacy-center" className="text-rose-700 hover:underline dark:text-rose-300">Privacy Centre</Link>
      </nav>
    </div>
  );
}
