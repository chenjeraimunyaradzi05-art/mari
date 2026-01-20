import { promises as fs } from 'fs';
import path from 'path';
import { markdownToSafeHtml } from '@/lib/markdown';

export default async function TermsPage() {
  const filePath = path.join(process.cwd(), 'src', 'content', 'legal', 'terms.md');
  const markdown = await fs.readFile(filePath, 'utf8');
  const html = markdownToSafeHtml(markdown);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <div className="prose prose-slate dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
