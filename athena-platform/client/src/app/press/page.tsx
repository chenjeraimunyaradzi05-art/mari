import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Press | ATHENA',
  description: 'Press contact, company boilerplate, and brand assets for ATHENA.',
};

const BOILERPLATE =
  'ATHENA is a platform for women’s careers and economic opportunity. It brings jobs, apprenticeships, mentorship, learning, funding and community into one place, with safety tooling and reporting built into every surface. ATHENA is currently in staged rollout.';

const assets = [
  { label: 'Logo (SVG)', href: '/logo.svg' },
  { label: 'Logo (PNG)', href: '/logo.png' },
  { label: 'Wordmark (PNG)', href: '/athena-logo.png' },
];

export default function PressPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold">Press</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        Everything a journalist normally needs from us is on this page. If something is missing,
        ask and we will get it to you rather than pointing you at a form.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Press enquiries</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            We are a small team and answer press directly. Tell us your deadline in the first
            line and we will work to it.
          </p>
          <Link href="/contact" className="btn-primary mt-4 inline-flex">Contact us</Link>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Brand assets</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Please use the logo as supplied, without recolouring or redrawing it.
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {assets.map((asset) => (
              <li key={asset.href}>
                <a href={asset.href} download className="text-primary hover:underline">
                  {asset.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Boilerplate</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Cleared for use in full or in part.
        </p>
        <p className="mt-4 rounded-xl bg-muted p-4 text-sm leading-6">{BOILERPLATE}</p>
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Coverage</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          No coverage to list yet. When ATHENA is written about we will link the pieces here,
          including the critical ones.
        </p>
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        Background on what we are building and how we report on it is in the{' '}
        <Link href="/impact" className="text-primary hover:underline">impact</Link> and{' '}
        <Link href="/help/transparency-report" className="text-primary hover:underline">transparency</Link>{' '}
        pages.
      </p>
    </div>
  );
}
