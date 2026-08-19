import Link from 'next/link';
import { ArrowRight, BookOpen, KeyRound, ShieldCheck, TerminalSquare } from 'lucide-react';

const quickLinks = [
  {
    title: 'Authentication',
    description: 'Understand bearer tokens, environment setup, and request headers.',
    href: '/developers/docs/api-reference#authentication',
    icon: KeyRound,
  },
  {
    title: 'API reference',
    description: 'Review the current public endpoint groups and integration patterns.',
    href: '/developers/docs/api-reference',
    icon: BookOpen,
  },
  {
    title: 'Console preview',
    description: 'Request beta access to the managed API console and sandbox tooling.',
    href: '/developers/console',
    icon: TerminalSquare,
  },
];

const setupSteps = [
  'Create an ATHENA account and confirm the product surface you want to integrate.',
  'Request API access through the developer team or enterprise onboarding flow.',
  'Store your credentials securely and call ATHENA endpoints from your server environment.',
  'Use the API reference to map jobs, mentors, messaging, and AI workflows to your product.',
];

export default function DeveloperDocsPage() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-white">
      <section className="border-b border-gray-200 bg-white/80 backdrop-blur dark:border-gray-800 dark:bg-gray-950/80">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-4 py-1.5 text-sm font-medium text-primary-700 dark:border-primary-900/40 dark:bg-primary-950/40 dark:text-primary-300">
            <BookOpen className="h-4 w-4" />
            Developer docs
          </div>
          <h1 className="mt-6 max-w-4xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Build on ATHENA without guessing the integration path.
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-gray-600 dark:text-gray-300">
            This documentation hub outlines how teams integrate ATHENA jobs, mentoring, community, and AI-powered
            workflows into external products and internal platforms.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/developers/docs/api-reference"
              className="inline-flex items-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
            >
              Open API reference
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
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-12 sm:px-6 lg:grid-cols-3 lg:px-8">
        {quickLinks.map((item) => (
          <Link
            key={item.title}
            href={item.href}
            className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">
              <item.icon className="h-5 w-5" />
            </div>
            <h2 className="mt-5 text-xl font-semibold">{item.title}</h2>
            <p className="mt-3 text-sm leading-7 text-gray-600 dark:text-gray-300">{item.description}</p>
            <span className="mt-5 inline-flex items-center text-sm font-semibold text-primary-700 dark:text-primary-300">
              Open section
              <ArrowRight className="ml-2 h-4 w-4" />
            </span>
          </Link>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="text-2xl font-semibold">Integration checklist</h2>
            <div className="mt-6 space-y-4">
              {setupSteps.map((step, index) => (
                <div
                  key={step}
                  className="flex gap-4 rounded-2xl border border-gray-100 bg-gray-50/80 p-4 dark:border-gray-800 dark:bg-gray-950/50"
                >
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white dark:bg-white dark:text-slate-950">
                    {index + 1}
                  </div>
                  <p className="text-sm leading-7 text-gray-700 dark:text-gray-300">{step}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              <ShieldCheck className="h-4 w-4" />
              Access model
            </div>
            <h2 className="mt-5 text-2xl font-semibold">Current developer program</h2>
            <p className="mt-4 text-sm leading-7 text-gray-600 dark:text-gray-300">
              ATHENA developer access is currently managed to keep jobs, messaging, and community integrations aligned
              with trust and safety controls. Public documentation is live, while production credentials are issued
              through onboarding.
            </p>
            <div className="mt-6 rounded-2xl border border-gray-100 bg-gray-50 p-5 dark:border-gray-800 dark:bg-gray-950/50">
              <p className="text-sm font-medium text-gray-900 dark:text-white">Need enterprise or partner access?</p>
              <p className="mt-2 text-sm leading-7 text-gray-600 dark:text-gray-300">
                Contact the ATHENA team with your use case, timeline, expected traffic, and the surface you want to
                integrate.
              </p>
            </div>
            <Link
              href="/contact-sales"
              className="mt-6 inline-flex items-center text-sm font-semibold text-primary-700 dark:text-primary-300"
            >
              Talk to the team
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
