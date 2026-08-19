import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Getting Started | ATHENA Help Centre',
  description: 'How to set up your ATHENA account and find your way around.',
};

const steps = [
  {
    title: '1. Create your account',
    body: 'Register with your email, verify it, and complete your profile. You can enable two-factor authentication from your security settings at any time — we recommend it.',
  },
  {
    title: '2. Choose what you are here for',
    body: 'Onboarding asks what you want from ATHENA — jobs, mentorship, learning, community, or business support — and tailors your dashboard to it. You can change this later in settings.',
  },
  {
    title: '3. Explore opportunities',
    body: 'Browse jobs, apprenticeships, courses, events, and grants from your dashboard. Save anything interesting; your saved items and applications are tracked in one place.',
  },
  {
    title: '4. Connect safely',
    body: 'Join communities and connect with mentors. Review the community guidelines, and use the safety centre if anything ever feels wrong — reporting tools are on every profile and post.',
  },
  {
    title: '5. Manage your data',
    body: 'The privacy centre lets you view, export, or delete your data and manage consent at any time.',
  },
];

export default function GettingStartedPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-12">
      <p className="text-sm text-muted-foreground">
        <Link href="/help" className="hover:underline">Help Centre</Link> / Getting started
      </p>
      <h1 className="mt-2 text-3xl font-bold">Getting started with ATHENA</h1>
      <div className="mt-8 space-y-6">
        {steps.map((s) => (
          <div key={s.title} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">{s.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{s.body}</p>
          </div>
        ))}
      </div>
      <p className="mt-8 text-sm text-muted-foreground">
        Stuck on something not covered here? <Link href="/contact" className="text-primary hover:underline">Contact us</Link> or
        leave <Link href="/help/feedback" className="text-primary hover:underline">feedback</Link>.
      </p>
    </div>
  );
}
