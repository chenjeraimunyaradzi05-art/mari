'use client';

/** Listing something for the first time. */

import { BackToHome, PageShell } from '@/components/layout/PageShell';
import { ServiceForm, blankService } from '../ServiceForm';

export default function NewServicePage() {
  return (
    <PageShell width="default" showBack={false}>
      <BackToHome href="/skills-marketplace/sell" label="Back to your listings" />

      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white md:text-3xl">
          List what you are good at
        </h1>
        <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
          Members see your rate before they get in touch, and you can pause the listing at any time.
        </p>
      </header>

      <ServiceForm mode="create" initialValues={blankService()} />
    </PageShell>
  );
}
