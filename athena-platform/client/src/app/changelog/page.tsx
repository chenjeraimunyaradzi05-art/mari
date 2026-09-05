import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Changelog | ATHENA',
  description: 'Notable platform updates, in the open.',
};

// Keep entries factual and verifiable — this page is part of our commitment
// to only publishing claims we can evidence.
const entries = [
  {
    date: 'September 2026',
    title: 'Your own words, and a safer live connection',
    points: [
      'Edit your own comments and messages, and unsend a message for everyone in the thread; edited posts, comments and messages say so.',
      'See who reacted to a post, and how, by opening the reaction count.',
      'New-device sign-in alerts, in-app and by email, and an accurate "this device" label on the sessions list in Security settings.',
      'The live connection (WebSocket) now honours logout, session revocation and account suspension, and applies the same blocks, message permissions, content moderation and rate limits as the API.',
      'Link previews check every redirect against private-network rules, and post interactions share one visibility rule for blocks, private groups and connections-only members.',
    ],
  },
  {
    date: 'August 2026',
    title: 'Security hardening pass',
    points: [
      'Authentication middleware hardened across services (strict JWT verification, no development bypasses in production).',
      'Security headers applied consistently across all responses.',
      'Vulnerability disclosure channel published at /.well-known/security.txt.',
      'Help centre, contact, impact, and trust pages added; broken public links fixed.',
    ],
  },
  {
    date: 'July 2026',
    title: 'Trust and launch-readiness work',
    points: [
      'Two-factor authentication (TOTP) with recovery codes.',
      'Session management: revoke individual sessions or all devices; refresh-token reuse detection.',
      'Launch-readiness endpoint reporting missing production configuration.',
      'Transparency report rewired to published reports only.',
    ],
  },
  {
    date: 'June 2026',
    title: 'Platform consolidation',
    points: [
      'Web, API, mobile shell, and ML service brought under one platform.',
      'Payments guardrails: simulated flows can no longer masquerade as production behaviour.',
      'GDPR tooling: privacy centre, consent management, data retention scripts.',
    ],
  },
];

export default function ChangelogPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold">Changelog</h1>
      <p className="mt-4 text-muted-foreground">
        Notable updates to the platform. For what is coming next, see the{' '}
        <Link href="/help/transparency-report" className="text-primary hover:underline">transparency report</Link>.
      </p>
      <div className="mt-8 space-y-6">
        {entries.map((e) => (
          <div key={e.date} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{e.date}</p>
            <h2 className="mt-1 text-lg font-semibold">{e.title}</h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-6 text-muted-foreground">
              {e.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
