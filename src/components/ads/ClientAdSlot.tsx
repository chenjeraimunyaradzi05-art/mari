'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { AdCreative } from '@/lib/advertising';

type ClientAdSlotProps = {
  position: string;
  layout?: 'card';
  ads?: AdCreative[];
  useAuction?: boolean;
};

function resolveHref(ad: AdCreative) {
  if (ad.cta_url) return ad.cta_url;
  if (ad.cta_route) return `/${ad.cta_route}`;
  return '#';
}

export default function ClientAdSlot({ position, layout = 'card', ads, useAuction = false }: ClientAdSlotProps) {
  const [creativeSet, setCreativeSet] = useState<AdCreative[]>(ads ?? []);
  const [loaded, setLoaded] = useState(Boolean(ads?.length));
  const impressionSent = useRef<Set<string>>(new Set());

  const trackEvent = React.useCallback(async (type: 'impression' | 'click', auctionId?: string) => {
    if (!auctionId) return;
    // Prevent duplicate impressions
    if (type === 'impression') {
      if (impressionSent.current.has(auctionId)) return;
      impressionSent.current.add(auctionId);
    }

    try {
      await fetch('/api/ads/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, auctionId }),
      });
    } catch (e) {
      console.error('Tracking error', e);
    }
  }, []);

  useEffect(() => {
    if (ads?.length) return;
    let cancelled = false;

    const fetchAds = async () => {
      try {
        let data: AdCreative[] = [];
        
        if (useAuction) {
           const res = await fetch('/api/ads/auction', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ placementId: position })
           });
           
           if (res.ok) {
             const auctionResult = await res.json();
             if (auctionResult.creative) {
               data = [{
                 type: auctionResult.creative.mediaType || 'image',
                 label: 'Sponsored',
                 title: auctionResult.creative.title,
                 description: auctionResult.creative.description,
                 media: auctionResult.creative.mediaUrl,
                 cta_text: 'Learn More',
                 cta_url: '#',
                 metrics: {
                   creative_id: auctionResult.creative.id,
                   slot: position,
                   signature: auctionResult.auctionId
                 }
               }];
             }
           }
        } else {
          const res = await fetch(`/api/ads/preview?position=${encodeURIComponent(position)}`);
          if (res.ok) {
            const json = await res.json();
            data = Array.isArray(json) ? json : json?.ads ?? [];
          }
        }

        if (!cancelled) setCreativeSet(data);
      } catch (err) {
        console.error('Failed to load ads', err);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    };

    fetchAds();
    return () => {
      cancelled = true;
    };
  }, [position, ads, useAuction]);

  // Intersection Observer for Impressions
  useEffect(() => {
    if (!creativeSet.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const auctionId = entry.target.getAttribute('data-signature');
            if (auctionId) {
              trackEvent('impression', auctionId);
            }
          }
        });
      },
      { threshold: 0.5 } // 50% visible
    );

    const elements = document.querySelectorAll(`.ad-slot--${position} .ad-card`);
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [creativeSet, position, trackEvent]);

  if (!creativeSet.length && loaded) return null;
  if (!creativeSet.length) return null;

  const containerStyle: React.CSSProperties = {
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: 16,
    background: 'var(--card)',
    boxShadow: '0 18px 36px -28px rgba(233,30,140,0.35)',
  };
  const cardStyle: React.CSSProperties = {
    border: '1px solid var(--border)',
    borderRadius: 14,
    overflow: 'hidden',
    background: '#fff',
    display: 'flex',
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  };

  return (
    <div className={`ad-slot ad-slot--${position} ad-slot--${layout}`} data-slot={position} style={containerStyle}>
      <div className="ad-carousel" data-position={position} style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        {creativeSet.map((ad, index) => {
          const type = ad.type ?? 'image';
          const isVideo = type === 'video';
          const label = ad.label;
          const title = ad.title;
          const description = ad.description;
          const href = resolveHref(ad);
          const metrics = ad.metrics;
          const external = Boolean(ad.external ?? href?.startsWith('http'));
          const auctionId = metrics?.signature;

          return (
            <article
              key={`${position}-${index}-${title ?? 'creative'}`}
              className="ad-card"
              data-type={type}
              data-index={index}
              style={cardStyle}
              {...(metrics && {
                'data-creative': metrics.creative_id,
                'data-campaign': metrics.campaign_id,
                'data-company': metrics.company_id,
                'data-slot': metrics.slot ?? position,
                'data-signature': metrics.signature,
              })}
              onClick={() => trackEvent('click', auctionId)}
            >
              <div className="ad-media" style={{ width: 120, flexShrink: 0 }}>
                {isVideo ? (
                  <video
                    className="ad-video"
                    src={ad.media ?? ''}
                    poster={ad.poster ?? ''}
                    muted
                    playsInline
                    loop
                    {...(index === 0 ? { autoPlay: true } : {})}
                    style={{ width: '100%', borderRadius: 10 }}
                  />
                ) : (
                  <Image
                    className="ad-image"
                    src={ad.media ?? ''}
                    alt={ad.alt ?? ad.title ?? 'Sponsored placement'}
                    width={320}
                    height={240}
                    style={{ width: '100%', borderRadius: 10, objectFit: 'cover' }}
                    unoptimized
                  />
                )}
              </div>

              <div className="ad-body" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {label && <p className="ad-label">{label}</p>}
                {title && <h3 className="ad-title">{title}</h3>}
                {description && <p className="ad-description">{description}</p>}

                {href && ad.cta_text && (
                  external ? (
                    <a
                      href={href}
                      className="btn btn--outline ad-cta"
                      data-track-click={metrics ? 'true' : 'false'}
                      target="_blank"
                      rel="noopener"
                    >
                      {ad.cta_text}
                    </a>
                  ) : (
                    <Link
                      href={href}
                      className="btn btn--outline ad-cta"
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
