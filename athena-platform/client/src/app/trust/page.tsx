import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Trust Centre | ATHENA',
  description: 'How ATHENA approaches security, privacy, and safety — stated plainly, with only claims we can evidence.',
};

const controls = [
  {
    title: 'Account security',
    body: 'Passwords are hashed with bcrypt (cost 12) and never stored in plain text. Two-factor authentication (TOTP) with recovery codes is available on every account. You can view your active sessions and sign out of individual devices or all devices at once; reuse of a revoked refresh token revokes every session on the account.',
  },
  {
    title: 'Platform security',
    body: 'All traffic is served over HTTPS. Security headers (CSP, HSTS, frame and MIME protections) are applied across responses. Login endpoints are rate limited with per-account lockout, and payment webhooks are verified against provider signatures.',
  },
  {
    title: 'Privacy',
    body: 'The privacy centre lets you access, export, and delete your data, and manage consent granularly. Our privacy policy and cookie policy describe exactly what is collected and why.',
  },
  {
    title: 'Safety',
    body: 'Reporting tools are available on profiles, posts, and messages. The safety centre provides support pathways, and appeals are available for moderation decisions.',
  },
];

export default function TrustPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold">Trust Centre</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        A plain statement of how we protect your account and data. We publish only what we can
        evidence in the product today; certifications and audits will be listed here when — and
        only when — they are complete.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {controls.map((c) => (
          <div key={c.title} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">{c.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{c.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Reporting a security vulnerability</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          We welcome good-faith security research. Disclosure instructions are published at{' '}
          <code className="rounded bg-muted px-1">/.well-known/security.txt</code>. Please do not
          access data that is not your own while testing.
        </p>
      </div>

      <div className="mt-10 flex flex-wrap gap-3 text-sm">
        <Link href="/privacy" className="btn-outline">Privacy policy</Link>
        <Link href="/terms" className="btn-outline">Terms</Link>
        <Link href="/cookies" className="btn-outline">Cookies</Link>
        <Link href="/help/safety-center" className="btn-outline">Safety centre</Link>
        <Link href="/help/transparency-report" className="btn-outline">Transparency report</Link>
      </div>
    </div>
  );
}
