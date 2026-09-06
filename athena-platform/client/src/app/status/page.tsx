import Link from 'next/link';
import type { Metadata } from 'next';
import StatusLive from '@/components/status/StatusLive';

export const metadata: Metadata = {
  title: 'System Status | ATHENA',
  description: 'Current availability of ATHENA services.',
};

// The live block reads the API's own health, readiness, version and
// maintenance endpoints from the reader's browser. Uptime history over time
// still needs a status provider; what is shown here is what is true now.
export default function StatusPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold">System status</h1>
      <p className="mt-4 text-muted-foreground">
        Checked live from your browser every 30 seconds. We do not yet publish uptime history; rather than
        show unverifiable numbers, this page shows what is answering right now and how to reach us.
      </p>
      <div className="mt-8 space-y-4">
        <StatusLive />
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
