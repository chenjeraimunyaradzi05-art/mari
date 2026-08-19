import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact | ATHENA',
  description: 'How to reach the ATHENA team.',
};

export default function ContactPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold">Contact us</h1>
      <p className="mt-4 text-muted-foreground">
        ATHENA is in staged rollout and run by a small team, so email is currently the fastest
        and most reliable way to reach us. We aim to respond within two business days.
      </p>

      <div className="mt-8 space-y-4">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">General enquiries</p>
          <a
            className="mt-2 inline-block text-lg font-semibold text-primary hover:underline"
            href="mailto:chenjeraimunyaradzi05@gmail.com?subject=ATHENA%20enquiry"
          >
            chenjeraimunyaradzi05@gmail.com
          </a>
          <p className="mt-3 text-sm text-muted-foreground">
            This inbox is monitored directly by the team while our permanent support address is
            being set up.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Specific requests</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              Safety concerns or reporting content — use the{' '}
              <Link href="/report" className="text-primary hover:underline">report page</Link> or the{' '}
              <Link href="/help/safety-center" className="text-primary hover:underline">safety centre</Link>.
            </li>
            <li>
              Privacy and data requests — the{' '}
              <Link href="/privacy-center" className="text-primary hover:underline">privacy centre</Link>.
            </li>
            <li>
              Security vulnerabilities — see{' '}
              <code className="rounded bg-muted px-1">/.well-known/security.txt</code>.
            </li>
            <li>
              Enterprise, pilots, and partnerships —{' '}
              <Link href="/contact-sales" className="text-primary hover:underline">contact sales</Link>.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
