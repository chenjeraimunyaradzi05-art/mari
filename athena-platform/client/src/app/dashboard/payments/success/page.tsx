import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Payouts set up | ATHENA',
  description: 'Stripe has finished checking your details.',
};

/**
 * Where Stripe sends a member back when she finishes Connect onboarding.
 *
 * Every path that creates an account link — the creator studio, the mentor
 * dashboard and the shared Connect route — named this page as its `return_url`,
 * and it did not exist. A woman who worked through Stripe's identity and bank
 * questions was handed a 404 at the end of it, with no way to tell whether the
 * thing she had just done had worked.
 *
 * It deliberately makes no claim about whether payouts are live yet. Stripe
 * decides that asynchronously, and the platform only learns the answer when it
 * next reads the account, so promising "you can take payments now" here would
 * be a guess. The earnings page shows the real state.
 */
export default function PayoutsSuccessPage() {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-16">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Your details are with Stripe</h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          Thank you — that is the part that needed you. Stripe now runs its own checks, which usually
          take a few minutes but can take longer if it wants another document.
        </p>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          You do not need to stay on this page. We will show your payout status on your earnings page
          as soon as Stripe tells us, and email you if anything else is needed.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/dashboard/earnings"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          See my earnings
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
