import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Feedback | ATHENA Help Centre',
  description: 'Tell the ATHENA team what is working and what is not.',
};

export default function FeedbackPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-12">
      <p className="text-sm text-muted-foreground">
        <Link href="/help" className="hover:underline">Help Centre</Link> / Feedback
      </p>
      <h1 className="mt-2 text-3xl font-bold">Feedback</h1>
      <p className="mt-4 text-muted-foreground">
        ATHENA is in staged rollout and feedback directly shapes what gets built next. Tell us
        what is confusing, broken, or missing — or what is working well.
      </p>
      <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Email the team</p>
        <a
          className="mt-2 inline-block text-lg font-semibold text-primary hover:underline"
          href="mailto:chenjeraimunyaradzi05@gmail.com?subject=ATHENA%20feedback"
        >
          chenjeraimunyaradzi05@gmail.com
        </a>
        <p className="mt-3 text-sm text-muted-foreground">
          Include what you were trying to do, what happened, and a screenshot if you can.
          For safety concerns, use the <Link href="/report" className="text-primary hover:underline">report page</Link> instead.
          For security vulnerabilities, see <code className="rounded bg-muted px-1">/.well-known/security.txt</code>.
        </p>
      </div>
    </div>
  );
}
