import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Impact | ATHENA',
  description: 'What ATHENA is building towards, and how we measure and report impact honestly.',
};

const commitments = [
  {
    title: 'Economic opportunity',
    body: 'Connecting women to jobs, apprenticeships, grants, and skills programs — with matching designed around potential, not just pedigree.',
  },
  {
    title: 'Safety by design',
    body: 'Reporting tools on every surface, a staffed safety centre, moderation guidelines, and support pathways for people experiencing harm.',
  },
  {
    title: 'Financial capability',
    body: 'Practical tools for pay equity, budgeting, and financial wellbeing, built for the realities of career breaks and caring responsibilities.',
  },
  {
    title: 'Honest reporting',
    body: 'We publish what we can evidence. As the platform grows, verified impact metrics will appear in our transparency report — we do not publish estimates as results.',
  },
];

export default function ImpactPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold">Impact</h1>
      <p className="mt-4 max-w-2xl text-slate-600 dark:text-slate-400">
        ATHENA exists to widen access to economic opportunity for women. We are early in that
        mission: the platform is in staged rollout, and we hold ourselves to reporting only
        outcomes we can verify.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {commitments.map((c) => (
          <div key={c.title} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">{c.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{c.body}</p>
          </div>
        ))}
      </div>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/help/transparency-report" className="btn-primary">Read the transparency report</Link>
        <Link href="/about" className="btn-outline">About ATHENA</Link>
      </div>
    </div>
  );
}
