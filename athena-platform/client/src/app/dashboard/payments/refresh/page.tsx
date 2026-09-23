import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Finish setting up payouts | ATHENA',
  description: 'The Stripe link expired before you finished.',
};

/**
 * Where Stripe sends a member when an account link expires or she backs out.
 *
 * Stripe's onboarding links are single-use and short-lived, so this is a normal
 * thing to hit — she left the tab open, or closed it partway, or the link sat in
 * an email overnight. It is not an error and does not say it is one. Like the
 * success page, this route was named as `refresh_url` by three different
 * onboarding paths and had never been built, so the ordinary case of pausing
 * halfway ended on a 404.
 *
 * The way back is to ask for a fresh link, which the earnings page does, so this
 * points there rather than minting one here and redirecting a member straight
 * back out to Stripe without her asking.
 */
export default function PayoutsRefreshPage() {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-16">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">That link has expired</h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          Stripe&rsquo;s setup links only work once, and they do not last long. Nothing you entered
          has been lost, and nothing has gone wrong — you just need a new link to pick up where you
          stopped.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/dashboard/earnings"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Get a new link
        </Link>
        <Link
          href="/dashboard"
          className="rounded-md border px-4 py-2 text-sm font-medium"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
