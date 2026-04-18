import Link from 'next/link';
import { ArrowRight, Database, KeyRound, ShieldCheck, TerminalSquare } from 'lucide-react';

const consoleSections = [
  {
    title: 'Credential management',
    description: 'Track issued environments, rotate keys safely, and keep integration ownership clear.',
    icon: KeyRound,
  },
  {
    title: 'Request inspection',
    description: 'Preview request and response patterns before you wire production systems to ATHENA.',
    icon: TerminalSquare,
  },
  {
    title: 'Environment separation',
    description: 'Keep staging and production access isolated while you validate jobs, mentors, and AI flows.',
    icon: Database,
  },
];

export default function DeveloperConsolePage() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-white">
      <section className="border-b border-gray-200 bg-white/80 backdrop-blur dark:border-gray-800 dark:bg-gray-950/80">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-sm font-medium text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300">
            <ShieldCheck className="h-4 w-4" />
            Console preview
          </div>
          <h1 className="mt-6 max-w-4xl text-4xl font-semibold tracking-tight sm:text-5xl">
            The managed ATHENA console is opening in stages.
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-gray-600 dark:text-gray-300">
            This page explains what the developer console will provide and how to request early access while the
            platform is still in controlled rollout.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-6 md:grid-cols-3">
          {consoleSections.map((section) => (
            <div
              key={section.title}
              className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                <section.icon className="h-5 w-5" />
              </div>
              <h2 className="mt-5 text-xl font-semibold">{section.title}</h2>
              <p className="mt-3 text-sm leading-7 text-gray-600 dark:text-gray-300">{section.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="text-2xl font-semibold">What you can do right now</h2>
            <div className="mt-6 space-y-4 text-sm leading-7 text-gray-700 dark:text-gray-300">
              <p>
                Use the developer docs to review the current integration surface, then contact the ATHENA team for
                credential issuance and implementation review.
              </p>
              <p>
                This staged approach keeps integrations aligned with privacy, consent, and trust-and-safety controls
                while the console moves from internal tooling to broader external availability.
              </p>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/developers/docs"
                className="inline-flex items-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
              >
                Read developer docs
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link
                href="/contact-sales"
                className="inline-flex items-center rounded-full border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-800 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:hover:bg-gray-800"
              >
                Request access
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="text-2xl font-semibold">Access request checklist</h2>
            <ul className="mt-6 space-y-3 text-sm leading-7 text-gray-700 dark:text-gray-300">
              <li>Share your company or product name.</li>
              <li>Describe the user workflow you want to connect to ATHENA.</li>
              <li>Specify whether you need staging, production, or both.</li>
              <li>Include expected traffic, compliance needs, and launch timing.</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
