/* eslint-disable @next/next/no-img-element */
import React from 'react';
import Link from 'next/link';
import { getFrontendPreviewAds, AdCreative } from '@/lib/advertising';

export type AdSlotProps = {
  position: string;
  layout?: 'card';
  ads?: AdCreative[];
};

function resolveHref(ad: AdCreative) {
  if (ad.cta_url) return ad.cta_url;
  if (ad.cta_route) return `/${ad.cta_route}`;
  return '#';
}

export default async function AdSlot({ position, layout = 'card', ads }: AdSlotProps) {
  const creativeSet = ads && ads.length > 0 ? ads : await getFrontendPreviewAds(position);
  if (!creativeSet.length) return null;

  return (
    <div className={`ad-slot ad-slot--${position} ad-slot--${layout} border border-primary-soft rounded-2xl p-4 bg-surface/75 shadow-lg shadow-primary/10`} data-slot={position}>
      <div className="ad-carousel grid gap-3 grid-cols-[repeat(auto-fit,minmax(260px,1fr))]" data-position={position}>
        {creativeSet.map((ad, index) => {
          const type = ad.type ?? 'image';
          const isVideo = type === 'video';
          const label = ad.label;
          const title = ad.title;
          const description = ad.description;
          const href = resolveHref(ad);
          const metrics = ad.metrics;
          const external = Boolean(ad.external ?? href?.startsWith('http'));

          return (
            <article
              key={`${position}-${index}-${title ?? 'creative'}`}
              className="ad-card border border-primary-soft rounded-xl overflow-hidden bg-surface flex flex-row gap-3 p-3"
              data-type={type}
              data-index={index}
              {...(metrics && {
                'data-creative': metrics.creative_id,
                'data-campaign': metrics.campaign_id,
                'data-company': metrics.company_id,
                'data-slot': metrics.slot ?? position,
                'data-signature': metrics.signature,
              })}
            >
              <div className="w-[120px] shrink-0">
                {isVideo ? (
                  <video
                    className="w-full rounded-lg"
                    src={ad.media ?? ''}
                    poster={ad.poster ?? ''}
                    muted
                    playsInline
                    loop
                    {...(index === 0 ? { autoPlay: true } : {})}
                  />
                ) : (
                  <img
                    className="w-full rounded-lg object-cover"
                    src={ad.media ?? ''}
                    alt={ad.alt ?? ad.title ?? 'Sponsored placement'}
                  />
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                {label && <p className="text-xs font-bold text-secondary uppercase tracking-wider">{label}</p>}
                {title && <h3 className="text-sm font-bold text-primary-dark">{title}</h3>}
                {description && <p className="text-xs text-text-muted leading-relaxed">{description}</p>}

                {href && ad.cta_text && (
                  external ? (
                    <a
                      href={href}
                      className="inline-flex items-center text-xs font-bold text-secondary hover:text-primary-dark mt-1"
                      data-track-click={metrics ? 'true' : 'false'}
                      target="_blank"
                      rel="noopener"
                    >
                      {ad.cta_text}
                    </a>
                  ) : (
                    <Link
                      href={href}
                      className="inline-flex items-center text-xs font-bold text-secondary hover:text-primary-dark mt-1"
                      data-track-click={metrics ? 'true' : 'false'}
                    >
                      {ad.cta_text}
                    </Link>
                  )
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
