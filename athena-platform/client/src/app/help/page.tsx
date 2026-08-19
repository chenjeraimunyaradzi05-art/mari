import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Help Centre | ATHENA',
  description: 'Find help with your ATHENA account, safety resources, community guidelines, and ways to reach the team.',
};

const sections = [
  {
    href: '/help/getting-started',
    title: 'Getting started',
    description: 'Set up your profile, explore jobs, mentors and communities.',
  },
  {
    href: '/help/safety-center',
    title: 'Safety centre',
    description: 'Safety tools, reporting, and support resources.',
  },
  {
    href: '/help/community-guidelines',
    title: 'Community guidelines',
    description: 'The standards that keep ATHENA respectful and safe.',
  },
  {
    href: '/report',
    title: 'Report a problem',
    description: 'Report content, behaviour, or a safety concern.',
  },
  {
    href: '/help/appeal',
    title: 'Appeals',
    description: 'Appeal a moderation or account decision.',
  },
  {
    href: '/help/transparency-report',
    title: 'Transparency report',
    description: 'Published reports on moderation and requests.',
  },
  {
    href: '/privacy-center',
    title: 'Privacy centre',
    description: 'Manage your data, consent, and privacy rights.',
  },
  {
    href: '/help/feedback',
    title: 'Feedback',
    description: 'Tell us what is working and what is not.',
  },
  {
    href: '/contact',
    title: 'Contact us',
    description: 'Reach the team directly for anything else.',
  },
];

export default function HelpCentrePage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold">Help Centre</h1>
      <p className="mt-4 text-muted-foreground">
        Answers, safety resources, and ways to reach us. If anything here is unclear or missing,
        please tell us via the feedback page — it goes straight to the team.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="rounded-2xl border border-border bg-card p-6 shadow-sm transition hover:shadow-md"
          >
            <h2 className="text-lg font-semibold">{s.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{s.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
