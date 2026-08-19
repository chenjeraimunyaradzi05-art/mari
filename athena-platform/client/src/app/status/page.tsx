import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'System Status | ATHENA',
  description: 'Current availability of ATHENA services.',
};

// A dedicated status provider (with uptime history) is on the roadmap.
// Until then this page is honest about what we can and cannot show.
export default function StatusPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold">System status</h1>
      <p className="mt-4 text-muted-foreground">
        ATHENA is in staged rollout. We do not yet publish an automated public uptime dashboard —
        rather than show unverifiable numbers, this page tells you how to check and how to reach us.
      </p>
      <div className="mt-8 space-y-4">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Is something down for you?</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            If the app is unreachable or a feature is failing, it is most likely a real incident
            rather than your connection — please{' '}
            <Link href="/contact" className="text-primary hover:underline">contact us</Link> with the time,
            what you were doing, and any error message. Incident notices will be posted on the{' '}
            <Link href="/changelog" className="text-primary hover:underline">changelog</Link> until a dedicated
            status provider is live.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Planned maintenance</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Maintenance windows are announced in advance in-app. During maintenance you may see the
            maintenance page instead of your dashboard.
          </p>
        </div>
      </div>
    </div>
  );
}
