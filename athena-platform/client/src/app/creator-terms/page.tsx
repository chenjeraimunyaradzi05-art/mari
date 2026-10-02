import { promises as fs } from 'fs';
import path from 'path';
import Link from 'next/link';
import { markdownToSafeHtml } from '@/lib/markdown';
import { renderLegalTokens } from '@/lib/contact';
import { CREATOR_TERMS_VERSION } from '@/lib/creator-terms';
import { CreatorTermsAcceptance } from './CreatorTermsAcceptance';

/**
 * The Creator Terms Addendum, and the box a creator ticks to accept it.
 *
 * Terms 5.1 named the addendum for a long time while no such text existed and
 * nothing recorded that anyone had accepted it. The text lives beside the Terms
 * in src/content/legal and is rendered the same way; the version printed here is
 * the one the server records when she accepts, so what she read and what is on
 * her profile are the same text.
 */
export default async function CreatorTermsPage() {
  const filePath = path.join(process.cwd(), 'src', 'content', 'legal', 'creator-terms.md');
  const markdown = await fs.readFile(filePath, 'utf8');
  const html = markdownToSafeHtml(renderLegalTokens(markdown));

  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
        Version {CREATOR_TERMS_VERSION} · part of the{' '}
        <Link href="/terms" className="font-medium text-rose-600 hover:underline dark:text-rose-400">
          Terms of Service
        </Link>
        , section 5. Every fee it mentions is on the{' '}
        <Link href="/fees" className="font-medium text-rose-600 hover:underline dark:text-rose-400">
          fees page
        </Link>
        .
      </p>
      <div className="prose prose-slate dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
      <CreatorTermsAcceptance />
    </div>
  );
}
