'use client';

/**
 * Every fee ATHENA takes, on one public page.
 *
 * The figures used to live in a different file for each flow, and the Terms
 * quoted a range none of them charged. This page reads GET /api/fees, which is
 * built from the one price book the payment code charges from, so what it prints
 * is what a card is charged and what a mentor, a seller or a creator is paid.
 * Nothing here is estimated: when the call fails the page says so and shows no
 * figure, rather than a copy that could drift.
 */

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { PageHero, PageShell } from '@/components/layout/PageShell';
import { feesApi } from '@/lib/api';

type Tier = { name: string; minFollowers: number; creatorSharePercent: number; platformSharePercent: number };

type FeeSchedule = {
  currency: string;
  gst: { registered: boolean; statement: string };
  mentoring: { platformPercent: number };
  marketplace: { platformPercent: number };
  creatorGifts: { giftPointValueAud: number; minimumPayoutAud: number; tiers: Tier[] };
  automotive: { privateSale: number; dealerSale: number; workshopJob: number; inspection: number };
  processing: string;
};

const aud = (amount: number, cents = false) =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount);

const followers = (n: number) => (n === 0 ? 'from the first follower' : `from ${n.toLocaleString('en-AU')} followers`);

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="surface p-6">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
      <div className="mt-3 space-y-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{children}</div>
    </section>
  );
}

export default function FeesPage() {
  const schedule = useQuery({
    queryKey: ['fee-schedule'],
    queryFn: () => feesApi.schedule(),
    staleTime: 60 * 60 * 1000,
    select: (response) => response.data?.data as FeeSchedule | undefined,
  });

  const fees = schedule.data;

  return (
    <PageShell width="default">
      <PageHero
        kicker="Fees"
        title="What ATHENA keeps"
        description="Every fee, with the figure the payment code charges. The same numbers are in the Terms of Service, the mentor agreement and the Creator Terms Addendum, because all of them read the same list."
      />

      {schedule.isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" aria-label="Loading the fee schedule" />
        </div>
      ) : schedule.isError || !fees ? (
        <div role="alert" className="surface space-y-3 p-6 text-sm leading-6 text-slate-600 dark:text-slate-400">
          <p>
            The fee schedule could not be loaded just now. Rather than guess, this page shows no figure until it can read the
            real ones.
          </p>
          <button type="button" onClick={() => schedule.refetch()} className="btn-outline min-h-[44px] px-4 py-2 text-sm">
            Try again
          </button>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          <Card title="Mentoring sessions">
            <p>
              ATHENA keeps <strong className="text-slate-900 dark:text-white">{fees.mentoring.platformPercent}%</strong> of each paid
              session. The mentor is paid the other {100 - fees.mentoring.platformPercent}%, to her own Stripe account.
            </p>
            <p>
              Sessions are priced by the hour at the rate on the mentor’s profile, in Australian dollars.{' '}
              <Link href="/mentor-agreement" className="font-medium text-rose-600 hover:underline dark:text-rose-400">
                The mentor agreement
              </Link>{' '}
              says when the card is charged.
            </p>
          </Card>

          <Card title="Skills marketplace">
            <p>
              ATHENA keeps <strong className="text-slate-900 dark:text-white">{fees.marketplace.platformPercent}%</strong> of each
              order and each hourly booking. The provider receives the other {100 - fees.marketplace.platformPercent}%.
            </p>
            <p>The buyer’s payment is held on her card when the order is placed and released when she approves the work.</p>
          </Card>

          <Card title="Creator gifts">
            <p>What a creator keeps of the value of a gift depends on her tier, which follows her follower count:</p>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-slate-500">
                  <th scope="col" className="py-1 pr-2 font-medium">
                    Tier
                  </th>
                  <th scope="col" className="py-1 pr-2 font-medium">
                    Creator keeps
                  </th>
                  <th scope="col" className="py-1 font-medium">
                    ATHENA keeps
                  </th>
                </tr>
              </thead>
              <tbody>
                {fees.creatorGifts.tiers.map((tier) => (
                  <tr key={tier.name} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="py-1.5 pr-2">
                      <span className="font-medium text-slate-900 dark:text-white">{tier.name}</span>
                      <span className="block text-xs text-slate-500">{followers(tier.minFollowers)}</span>
                    </td>
                    <td className="py-1.5 pr-2 font-medium text-slate-900 dark:text-white">{tier.creatorSharePercent}%</td>
                    <td className="py-1.5">{tier.platformSharePercent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>
              One gift point is worth {aud(fees.creatorGifts.giftPointValueAud, true)}. The minimum payout is{' '}
              {aud(fees.creatorGifts.minimumPayoutAud)}, and ATHENA takes nothing when a creator withdraws.{' '}
              <Link href="/creator-terms" className="font-medium text-rose-600 hover:underline dark:text-rose-400">
                The Creator Terms Addendum
              </Link>{' '}
              has the rest.
            </p>
          </Card>

          <Card title="Cars">
            <ul className="space-y-1">
              <li>
                Private sale: <strong className="text-slate-900 dark:text-white">{fees.automotive.privateSale}%</strong> of the price
              </li>
              <li>
                Dealer sale: <strong className="text-slate-900 dark:text-white">{fees.automotive.dealerSale}%</strong> of the price
              </li>
              <li>
                Workshop job: <strong className="text-slate-900 dark:text-white">{fees.automotive.workshopJob}%</strong> of the job
              </li>
              <li>
                Inspection report: <strong className="text-slate-900 dark:text-white">{fees.automotive.inspection}%</strong> of the fee
              </li>
            </ul>
          </Card>

          <Card title="Card processing">
            <p>{fees.processing}</p>
          </Card>

          <Card title="GST">
            <p>{fees.gst.statement}</p>
          </Card>
        </div>
      )}

      <p className="mt-8 text-sm leading-6 text-slate-600 dark:text-slate-400">
        Membership prices are on the{' '}
        <Link href="/pricing" className="font-medium text-rose-600 hover:underline dark:text-rose-400">
          pricing page
        </Link>
        . The{' '}
        <Link href="/terms" className="font-medium text-rose-600 hover:underline dark:text-rose-400">
          Terms of Service
        </Link>{' '}
        say how refunds and disputes work.
      </p>
    </PageShell>
  );
}
