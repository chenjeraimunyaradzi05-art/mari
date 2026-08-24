'use client';

import Link from 'next/link';
import {
  ArrowRight,
  DollarSign,
  Megaphone,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { HomeReelsRail } from './HomeReelsRail';
import { ReelTopicCircles } from './ReelTopicCircles';
import { PartnerRail } from './PartnerRail';
import { JobSpotlight } from './JobSpotlight';
import { LearningRail, CommunityRail } from './HomeContentRails';

/**
 * A paid placement. The advertiser pitch that used to live here has moved to
 * the footer: a sales ask does not belong between someone's job results and
 * their courses. With no campaign to serve, the slot renders nothing at all —
 * the same as every ad platform — rather than holding space with a promo.
 *
 * Wire `campaign` up to the ad server when it exists; the seam stays addressable
 * via data-ad-placement either way.
 */
export function SponsoredSlot({
  placement,
  campaign = null,
}: {
  placement: string;
  campaign?: { headline: string; body: string; href: string; advertiser: string } | null;
}) {
  if (!campaign) return null;

  return (
    <aside
      aria-label={`Sponsored by ${campaign.advertiser}`}
      data-ad-placement={placement}
      className="surface p-5"
    >
      <div className="flex items-center gap-2">
        <Megaphone className="h-3.5 w-3.5 text-slate-400" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
          Sponsored &middot; {campaign.advertiser}
        </span>
      </div>
      <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
        {campaign.headline}
      </p>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{campaign.body}</p>
      <Link
        href={campaign.href}
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-rose-600 dark:text-rose-400"
      >
        Learn more <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </aside>
  );
}

export function HomeMiddleColumn() {
  return (
    <div className="space-y-6">
      {/* Topic circles first, the way Instagram opens with stories. */}
      <ReelTopicCircles />

      {/* Speaks to one person arriving, rather than announcing a product. */}
      <section className="overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#f43f5e_0%,#a855f7_55%,#f59e0b_100%)] p-6 text-white sm:p-8">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em]">
            Welcome to ATHENA
          </span>
        </div>
        <h1 className="mt-3 text-2xl font-semibold leading-snug sm:text-3xl">
          Whatever you&rsquo;re working towards, you don&rsquo;t have to do it alone.
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-white/90">
          Thousands of women here are changing careers, asking the awkward salary questions,
          and cheering each other on. Have a look around &mdash; no account needed.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href="/register"
            className="focusable rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
          >
            Join free
          </Link>
          <Link
            href="/about"
            className="focusable rounded-lg border border-white/50 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            See how it works
          </Link>
        </div>
      </section>

      {/* Real open roles rather than more marketing copy. */}
      <JobSpotlight />

      <SponsoredSlot placement="home-middle-top" />

      {/* Real courses and real communities, in place of six tiles of marketing copy. */}
      <LearningRail />

      <CommunityRail />

      {/* Reels rail keeps short video in the marketing flow too. */}
      <HomeReelsRail compact />

      <PartnerRail />

      {/* Creator monetisation — the other half of the revenue story. */}
      <section className="surface p-6">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-emerald-500" />
          <span className="kicker">Earning here</span>
        </div>
        <h2 className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
          Get paid for what you already know
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
          Plenty of women here already do. Take gifts on your reels, charge for mentoring,
          or work with a brand. Money lands in your account through Stripe.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/dashboard/creator"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900"
          >
            Start creating
          </Link>
          <Link
            href="/dashboard/mentors/become-mentor"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 dark:border-slate-700 dark:text-slate-200"
          >
            Mentor others
          </Link>
        </div>
      </section>

      <section className="surface flex items-start gap-3 p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-rose-500" />
        <p className="text-xs leading-5 text-slate-600 dark:text-slate-400">
          This is a women-only space, with real moderation and controls you actually own.{' '}
          <Link href="/help/safety-center" className="font-semibold text-rose-600 dark:text-rose-400">
            See how we keep it safe
          </Link>
        </p>
      </section>

      {/* A human sign-off, and the business asks kept small and at the end where
          they belong rather than interrupting the member's flow. */}
      <footer className="px-1 pb-2 pt-2 text-center">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Built in Australia, for women everywhere. Glad you&rsquo;re here.
        </p>
        <p className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-slate-400">
          <Link href="/about" className="hover:text-rose-600 dark:hover:text-rose-400">
            About
          </Link>
          <Link href="/help" className="hover:text-rose-600 dark:hover:text-rose-400">
            Help
          </Link>
          <Link href="/privacy" className="hover:text-rose-600 dark:hover:text-rose-400">
            Privacy
          </Link>
          <Link href="/careers" className="hover:text-rose-600 dark:hover:text-rose-400">
            Work with us
          </Link>
          <Link href="/contact-sales" className="hover:text-rose-600 dark:hover:text-rose-400">
            Advertise
          </Link>
        </p>
      </footer>
    </div>
  );
}
