import React from 'react';

// Example data for stats and heroSponsors (replace with real data or props)
const stats = {
  live_listings: 42,
  sponsored_perks: 8,
  states_represented: 6,
  community_requests: 1200,
};

const heroSponsors = [
  {
    label: 'Community partner',
    title: 'Wellness Co.',
    description: 'Supporting trauma-aware care and ethical pricing.',
    cta_url: '#',
    cta_text: 'Learn More',
  },
  // Add more sponsors as needed
];

export default function WomenMarketplacePage() {
  return (
    <section className="bg-slate-950 text-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-16 lg:flex-row lg:items-end lg:py-24">
        <div className="flex-1 space-y-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/30 px-4 py-1 text-sm uppercase tracking-wide text-white/80">
            Women-Owned Marketplace
          </span>
          <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
            Fitness, beauty, and pet care listings that centre women, carers, and community safety.
          </h1>
          <p className="text-lg text-white/80">
            Built from the Problem Map research, every listing is vetted for trauma-aware care, ethical pricing, and advertising partners that fund real perks.
          </p>
          <dl className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-sm text-white/70">Live listings</dt>
              <dd className="text-2xl font-semibold">{stats.live_listings ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-sm text-white/70">Sponsored perks</dt>
              <dd className="text-2xl font-semibold">{stats.sponsored_perks ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-sm text-white/70">States represented</dt>
              <dd className="text-2xl font-semibold">{stats.states_represented ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-sm text-white/70">Weekly searches</dt>
              <dd className="text-2xl font-semibold">{stats.community_requests ?? '—'}</dd>
            </div>
          </dl>
        </div>
        {heroSponsors.length > 0 && (
          <div className="flex w-full max-w-xl flex-col gap-4 rounded-3xl bg-white/5 p-6 backdrop-blur">
            <p className="text-sm uppercase tracking-wide text-white/70">Advertising partners funding care</p>
            {heroSponsors.map((sponsor, idx) => (
              <article key={idx} className="rounded-2xl bg-white/10 p-4">
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white">Sponsored</span>
                  <p className="text-white/80">{sponsor.label || sponsor.title || 'Community partner'}</p>
                </div>
                <h3 className="mt-2 text-lg font-semibold text-white">{sponsor.title || 'Partner placement'}</h3>
                {sponsor.description && (
                  <p className="mt-1 text-sm text-white/80">{sponsor.description}</p>
                )}
                {sponsor.cta_url && sponsor.cta_text && (
                  <form method="POST" action={sponsor.cta_url} target="_blank" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-white hover:text-rose-200">
                    {/* CSRF and hidden input would be handled differently in React/Next.js */}
                    <input type="hidden" name="slot" value="marketplace-hero" />
                    <button type="submit">{sponsor.cta_text}</button>
                  </form>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
