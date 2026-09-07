'use client';

import Link from 'next/link';
import { ArrowRight, DollarSign, Lock, MapPin, Megaphone, ShieldCheck, Sparkles, UserCheck, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { HomeHero } from './HomeHero';
import { Reveal } from './Reveal';
import { HomeReelsRail } from './HomeReelsRail';
import { ReelTopicCircles } from './ReelTopicCircles';
import { JobSpotlight } from './JobSpotlight';
import { WinsRail } from './WinsRail';
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

/** What anyone here can count on, each a door to the page that backs it up. */
const PROMISES: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: '/safety-center', label: 'Women only', icon: ShieldCheck },
  { href: '/help/community-guidelines', label: 'Real people moderate', icon: UserCheck },
  { href: '/privacy-center', label: 'Your data, your call', icon: Lock },
  { href: '/about', label: 'Made in Queensland', icon: MapPin },
];

/** Two soft cards: earning here, and being kept safe. */
function ClosingPair() {
  const cards = [
    {
      icon: DollarSign,
      tint: 'from-emerald-300 to-teal-400 shadow-[0_10px_24px_-10px_rgba(20,184,166,0.6)]',
      eyebrow: 'for what you already know',
      title: 'Be paid for it',
      copy: 'Take gifts on your reels, charge for an hour of mentoring, or work with a brand. It lands in your account through Stripe.',
      links: [
        ['/dashboard/creator', 'Start creating'],
        ['/dashboard/mentors/become-mentor', 'Mentor others'],
      ],
    },
    {
      icon: ShieldCheck,
      tint: 'from-rose-400 to-pink-500 shadow-[0_10px_24px_-10px_rgba(244,63,94,0.7)]',
      eyebrow: 'and looked after',
      title: 'A space that is yours',
      copy: 'Women only, real people moderating, a safe mode that hides what needs hiding, and a trust centre that says plainly what we do with your data.',
      links: [
        ['/safety-center', 'How we keep it safe'],
        ['/trust', 'Trust centre'],
      ],
    },
  ];
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {cards.map((c) => (
        <section key={c.title} className="tile-glass flex flex-col p-6">
          <div className="flex items-center gap-3">
            <span className={cn('flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br text-white', c.tint)}>
              <c.icon className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <span className="eyebrow-soft text-rose-500 dark:text-rose-300">{c.eyebrow}</span>
          </div>
          <h2 className="mt-3 font-display text-2xl font-medium text-slate-900 dark:text-white">{c.title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{c.copy}</p>
          <div className="mt-auto flex flex-wrap gap-2 pt-4">
            {c.links.map(([href, label], i) => (
              <Link key={href} href={href} className={cn('focusable rounded-full px-4 py-2 text-sm font-semibold transition', i === 0 ? 'bg-rose-500 text-white hover:bg-rose-600 dark:bg-rose-400 dark:text-slate-950 dark:hover:bg-rose-300' : 'bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-500/15 dark:text-rose-200 dark:hover:bg-rose-500/25')}>
                {label}
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/** The warm close: one last door for a visitor, a thank-you for a member, and what anyone can count on. */
function ClosingBand() {
  const { isAuthenticated } = useAuth();
  return (
    <section className="relative overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#fb7185_0%,#c084fc_55%,#fcd34d_100%)] p-6 text-white shadow-[0_30px_80px_-40px_rgba(236,72,153,0.6)] sm:p-8">
      <span aria-hidden className="grid-fade absolute inset-0 opacity-30" />
      <span aria-hidden className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/25 blur-3xl" />
      <span aria-hidden className="absolute -bottom-16 left-1/3 h-40 w-40 rounded-full bg-white/15 blur-3xl" />
      <div className="relative flex flex-wrap items-center justify-between gap-5">
        <div className="min-w-0 max-w-xl">
          <p className="eyebrow-soft text-white/90">Built in Australia, for women everywhere</p>
          <h2 className="mt-2 font-display text-3xl font-medium leading-tight sm:text-4xl" style={{ textWrap: 'balance' }}>
            {isAuthenticated ? 'So glad you are here. Go make something of today.' : 'Whenever you are ready. We are so glad you are here.'}
          </h2>
          <p className="mt-2 text-[15px] leading-7 text-white/90">{isAuthenticated ? 'Share a win, book a mentor, or tick a lesson off; every bit of it counts.' : 'It is free to join, and you can look around as long as you like first. No rush at all.'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAuthenticated ? (
            <Link href="/dashboard/create-post" className="focusable inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50">
              Share a win <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <>
              <Link href="/register" className="focusable inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50">
                Join, it&rsquo;s free <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/about" className="focusable rounded-full border border-white/50 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20">
                How it works
              </Link>
            </>
          )}
        </div>
      </div>
      <ul className="relative mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t border-white/25 pt-4 text-sm text-white/90">
        {PROMISES.map((p) => (
          <li key={p.href}>
            <Link href={p.href} className="focusable inline-flex items-center gap-1.5 rounded-sm transition hover:text-white hover:underline hover:decoration-white/60 hover:underline-offset-4">
              <p.icon className="h-4 w-4" strokeWidth={1.75} /> {p.label}
            </Link>
          </li>
        ))}
        <li className="ml-auto inline-flex items-center gap-1.5 text-white/80">
          <Sparkles className="h-4 w-4" /> Glad you&rsquo;re here
        </li>
      </ul>
    </section>
  );
}

/**
 * The middle column: the hero, then the platform's live rows (wins, work,
 * mentors, courses, events, communities, people, reels, the directory), each
 * rising into place as it scrolls into view, then two soft cards on earning
 * and safety, and a warm close. A blush wash sits behind the top of it all.
 */
export function HomeMiddleColumn() {
  return (
    <div className="relative space-y-6">
      <div aria-hidden className="blush-wash pointer-events-none absolute -inset-x-10 -top-16 -z-10 h-[720px] rounded-[3rem] blur-2xl" />

      {/* Topic circles first, the way Instagram opens with stories. */}
      <ReelTopicCircles />

      <HomeHero />

      {/* Members' own wins, before anything we are selling. Renders nothing
          when none have been posted. */}
      <Reveal>
        <WinsRail />
      </Reveal>

      {/* Real open roles and apprenticeships rather than more marketing copy. */}
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
        <ClosingPair />
      </Reveal>

      <Reveal>
        <ClosingBand />
      </Reveal>
    </div>
  );
}
