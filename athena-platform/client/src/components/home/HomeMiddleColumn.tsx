'use client';

import Link from 'next/link';
import { ArrowRight, DollarSign, Megaphone, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/hooks';
import { HomeHero } from './HomeHero';
import { Reveal } from './Reveal';
import { HomeReelsRail } from './HomeReelsRail';
import { ReelTopicCircles } from './ReelTopicCircles';
import { JobSpotlight } from './JobSpotlight';
import { MentorsRail } from './MentorsRail';
import { EventsRail } from './EventsRail';
import { LearningRail, CommunityRail } from './HomeContentRails';
import { PlatformDirectory } from './PlatformDirectory';
import { SuggestedPeople } from '@/components/community/SuggestedPeople';

/**
 * A paid placement. The advertiser pitch that used to live here has moved to
 * the footer: a sales ask does not belong between someone's job results and
 * their courses. With no campaign to serve, the slot renders nothing at all,
 * the same as every ad platform, rather than holding space with a promo.
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
    <aside aria-label={`Sponsored by ${campaign.advertiser}`} data-ad-placement={placement} className="surface p-5">
      <div className="flex items-center gap-2">
        <Megaphone className="h-3.5 w-3.5 text-slate-400" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Sponsored &middot; {campaign.advertiser}</span>
      </div>
      <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{campaign.headline}</p>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{campaign.body}</p>
      <Link href={campaign.href} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-rose-600 dark:text-rose-400">
        Learn more <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </aside>
  );
}

/** The warm close: one last door for a visitor, a thank-you for a member. */
function ClosingBand() {
  const { isAuthenticated } = useAuth();
  return (
    <section className="relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#f43f5e_0%,#a855f7_55%,#f59e0b_100%)] p-6 text-white shadow-[0_30px_80px_-40px_rgba(168,85,247,0.7)] sm:p-8">
      <span aria-hidden className="grid-fade absolute inset-0 opacity-40" />
      <span aria-hidden className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/20 blur-3xl" />
      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 max-w-xl">
          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/85">
            <Sparkles className="h-3.5 w-3.5" /> Built in Australia, for women everywhere
          </p>
          <h2 className="mt-2 text-2xl font-semibold leading-snug sm:text-3xl" style={{ textWrap: 'balance' }}>
            {isAuthenticated ? 'Glad you are here. Go make something of today.' : 'Ready when you are. Glad you are here.'}
          </h2>
          <p className="mt-2 text-sm text-white/85">{isAuthenticated ? 'Share a win, book a mentor, or tick a lesson off; it all counts.' : 'It is free to join, and you can look around as long as you like first.'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAuthenticated ? (
            <Link href="/dashboard/create-post" className="focusable inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-violet-800 transition hover:bg-rose-50">
              Share a win <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <>
              <Link href="/register" className="focusable inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-violet-800 transition hover:bg-rose-50">
                Join free <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/about" className="focusable rounded-full border border-white/50 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20">
                How it works
              </Link>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * The middle column: the hero, then the platform's live rows (jobs, mentors,
 * courses, events, communities, people, reels, the directory), each rising
 * into place as it scrolls into view, the two cards on earning and safety,
 * and a warm close.
 */
export function HomeMiddleColumn() {
  return (
    <div className="space-y-6">
      {/* Topic circles first, the way Instagram opens with stories. */}
      <ReelTopicCircles />

      <HomeHero />

      {/* Real open roles rather than more marketing copy. */}
      <Reveal>
        <JobSpotlight />
      </Reveal>

      <Reveal>
        <MentorsRail />
      </Reveal>

      <SponsoredSlot placement="home-middle-top" />

      {/* Real courses and real communities, in place of tiles of marketing copy. */}
      <Reveal>
        <LearningRail />
      </Reveal>

      <Reveal>
        <EventsRail />
      </Reveal>

      <Reveal>
        <CommunityRail />
      </Reveal>

      {/* Members worth following, with the reason each is here. Renders
          nothing for a visitor. */}
      <Reveal>
        <SuggestedPeople limit={5} />
      </Reveal>

      <Reveal>
        <HomeReelsRail compact />
      </Reveal>

      {/* The rest of the product, named in full: a member cannot use what she
          cannot find. */}
      <Reveal>
        <PlatformDirectory />
      </Reveal>

      <Reveal>
        <div className="grid gap-4 md:grid-cols-2">
          {/* Creator monetisation, the other half of the revenue story. */}
          <section className="tile-glass flex flex-col p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-[0_8px_20px_-8px_rgba(16,185,129,0.8)]">
                <DollarSign className="h-5 w-5" />
              </span>
              <span className="kicker">Earning here</span>
            </div>
            <h2 className="mt-3 text-lg font-semibold text-slate-900 dark:text-white">Get paid for what you already know</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">Take gifts on your reels, charge for mentoring, or work with a brand. Money lands in your account through Stripe.</p>
            <div className="mt-auto flex flex-wrap gap-2 pt-4">
              <Link href="/dashboard/creator" className="focusable rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-rose-50">
                Start creating
              </Link>
              <Link href="/dashboard/mentors/become-mentor" className="focusable rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-rose-50 dark:border-white/15 dark:text-slate-100 dark:hover:bg-white/10">
                Mentor others
              </Link>
            </div>
          </section>

          <section className="tile-glass flex flex-col p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-purple-600 text-white shadow-[0_8px_20px_-8px_rgba(244,63,94,0.8)]">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <span className="kicker">Kept safe</span>
            </div>
            <h2 className="mt-3 text-lg font-semibold text-slate-900 dark:text-white">A women-only space, with controls you own</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">Real moderation, a safe mode that hides what needs hiding, and a trust centre that says plainly what we do with your data.</p>
            <div className="mt-auto flex flex-wrap gap-2 pt-4">
              <Link href="/safety-center" className="focusable rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-rose-50">
                See how we keep it safe
              </Link>
              <Link href="/trust" className="focusable rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-rose-50 dark:border-white/15 dark:text-slate-100 dark:hover:bg-white/10">
                Trust centre
              </Link>
            </div>
          </section>
        </div>
      </Reveal>

      <Reveal>
        <ClosingBand />
      </Reveal>
    </div>
  );
}
