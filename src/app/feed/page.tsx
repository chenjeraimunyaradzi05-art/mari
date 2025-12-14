"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import './feed.css';
import { useFeed } from './useFeed';
import { FEED_FILTERS, SPONSOR_ADS } from '@/lib/feed-config';
import { WhoToFollow } from '@/components/social/WhoToFollow';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { SimpleVideoPlayer as VideoPlayer } from '@/components/social/SimpleVideoPlayer';
import { TippingModal } from '@/components/social/TippingModal';
import { AdCard } from '@/components/social/AdCard';

const relativeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

function formatRelative(iso?: string) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const divisions = [
    { amount: 60, unit: 'seconds' },
    { amount: 60, unit: 'minutes' },
    { amount: 24, unit: 'hours' },
    { amount: 7, unit: 'days' },
    { amount: 4.34524, unit: 'weeks' },
    { amount: 12, unit: 'months' },
    { amount: Number.POSITIVE_INFINITY, unit: 'years' },
  ];

  let duration = diffMs / 1000;
  for (const division of divisions) {
    if (Math.abs(duration) < division.amount) {
      const value = Math.round(duration);
      const unit = division.unit.replace(/s$/, '') as Intl.RelativeTimeFormatUnit;
      return relativeFormatter.format(value, unit);
    }
    duration /= division.amount;
  }
  return '';
}

function initials(name?: string) {
  if (!name) return 'A';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  const chars = parts.map((part) => part[0]?.toUpperCase() ?? '');
  return chars.join('') || 'A';
}

export default function FeedPage() {
  const [activeFilter, setActiveFilter] = useState(FEED_FILTERS[0]?.value ?? 'latest');
  const { items, error, isLoadingInitial, isLoadingMore, isReachingEnd, isRefreshing, setSize } = useFeed(activeFilter);
  const loadMoreRef = useRef<HTMLButtonElement | null>(null);

  const loadMore = useCallback(() => setSize((size) => size + 1), [setSize]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && !isLoadingMore && !isReachingEnd) {
          loadMore();
        }
      },
      { rootMargin: '320px' }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [isLoadingMore, isReachingEnd, loadMore]);

  useEffect(() => {
    setSize(1);
  }, [activeFilter, setSize]);

  const [ad, setAd] = useState<any>(null);

  useEffect(() => {
    fetch('/api/ads/serve')
      .then(res => res.json())
      .then(data => {
        if (data.ad) setAd(data.ad);
      })
      .catch(err => console.error("Failed to load ad", err));
  }, []);

  const [tippingPostId, setTippingPostId] = useState<string | null>(null);

  const handleTip = async (amount: number) => {
    if (!tippingPostId) return;

    try {
      const res = await fetch('/api/social/tip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: tippingPostId, amount }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Successfully tipped $${amount.toFixed(2)}!`);
      } else {
        alert(`Tip failed: ${data.error}`);
      }
    } catch (e) {
      alert("Error sending tip");
    }
  };

  const statusMessage = useMemo(() => {
    if (error) return 'Could not load feed right now.';
    if (isLoadingInitial) return 'Loading feed...';
    if (isRefreshing) return 'Refreshing feed...';
    return null;
  }, [error, isLoadingInitial, isRefreshing]);

  const hasItems = items.length > 0;

  return (
    <main
      className="signal-shell"
      aria-label="Athena signal feed"
      style={{
        background:
          'radial-gradient(circle at 16% 12%, rgba(233,30,140,0.08), transparent 30%), radial-gradient(circle at 84% 10%, rgba(139,92,246,0.08), transparent 28%), var(--background)',
      }}
    >
      <div className="signal-container">
        <div className="flex justify-end mb-4">
          <NotificationBell />
        </div>
        <section
          className="signal-hero"
          style={{
            background: 'linear-gradient(135deg,#e91e8c,#8b5cf6)',
            boxShadow: '0 22px 44px -30px rgba(233,30,140,0.55)',
          }}
        >
          <p className="stat-label" style={{ color: 'rgba(255,255,255,0.75)' }}>Athena Network</p>
          <h1>Signal feed across housing, money, careers, and wellbeing.</h1>
          <p>
            Tap into transparent pay intel, dream job drops, and community wins. Filters help you jump between discovery,
            following, and high-signal media posts.
          </p>
          <div className="signal-meta">
            <span className="signal-pill" style={{ background: 'rgba(255,255,255,0.14)', color: '#fff', border: '1px solid rgba(255,255,255,0.24)' }}><i className="fas fa-rss" aria-hidden="true" /> Live API powered</span>
            <span className="signal-pill" style={{ background: 'rgba(255,255,255,0.14)', color: '#fff', border: '1px solid rgba(255,255,255,0.24)' }}><i className="fas fa-sliders-h" aria-hidden="true" /> {FEED_FILTERS.length} curated filters</span>
            <span className="signal-pill" style={{ background: 'rgba(255,255,255,0.14)', color: '#fff', border: '1px solid rgba(255,255,255,0.24)' }}><i className="fas fa-lock-open" aria-hidden="true" /> Public endpoint: /api/feed</span>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8">

            <section className="signal-panel" style={{ boxShadow: '0 18px 36px -28px rgba(233,30,140,0.35)', border: '1px solid var(--border)', background: 'var(--card)' }}>
              <div className="signal-filters" role="tablist" aria-label="Feed filters">
                {FEED_FILTERS.map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    className={`signal-filter ${activeFilter === filter.value ? 'is-active' : ''}`}
                    role="tab"
                    aria-selected={activeFilter === filter.value}
                    onClick={() => setActiveFilter(filter.value)}
                  >
                    <i className="fas fa-hashtag" aria-hidden="true" />
                    <span>{filter.label}</span>
                  </button>
                ))}
              </div>

              {statusMessage ? (
                <div className="signal-empty" role="status">
                  <p className="mb-2" style={{ fontWeight: 600 }}>{statusMessage}</p>
                  {error ? <p className="mb-0" style={{ color: '#fca5a5' }}>Please try again shortly.</p> : null}
                </div>
              ) : null}

              <ul className="signal-list" aria-live="polite">
                {items.map((item, index) => {
                  const authorName = item.organization?.name || 'Athena member';
                  const relative = formatRelative(item.createdAt);
                  const mediaUrl = item.mediaUrl || undefined;
                  const videoUrl = item.videoUrl || undefined;
                  const thumbnailUrl = item.thumbnailUrl || undefined;
                  const type = item.organization?.type || 'post';
                  const visibility = item.visibility || 'public';

                  return (
                    <React.Fragment key={item.id}>
                    <li
                      className="signal-card"
                      style={{ border: '1px solid var(--border)', background: 'rgba(255,255,255,0.9)', boxShadow: '0 14px 32px -24px rgba(233,30,140,0.35)' }}
                    >
                      <div className="signal-card__header">
                        <div className="signal-author">
                          <span className="signal-avatar" aria-hidden="true" style={{ background: 'rgba(233,30,140,0.12)', color: '#9d174d' }}>{initials(authorName)}</span>
                          <div>
                            <strong>{authorName}</strong>
                            {relative ? <div className="stat-context" style={{ color: '#94a3b8' }}>{relative}</div> : null}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <span className="signal-type"><i className="fas fa-tag" aria-hidden="true" /> {type}</span>
                          <span className="signal-type"><i className="fas fa-lock-open" aria-hidden="true" /> {visibility}</span>
                        </div>
                      </div>
                      
                      {item.ranking && item.ranking.reasons.length > 0 && (
                        <div className="signal-ranking" style={{ margin: '0 0 12px 0', padding: '8px 12px', background: 'rgba(139,92,246,0.08)', borderRadius: 8, fontSize: '0.85rem', color: '#7c3aed', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <i className="fas fa-magic" aria-hidden="true" />
                          <span>
                            <strong>Recommended for you:</strong> {item.ranking.reasons.join(', ')}
                          </span>
                        </div>
                      )}

                      <p className="signal-content">{item.content}</p>
                      
                      {videoUrl ? (
                        <div className="signal-media" style={{ borderRadius: 14, overflow: 'hidden', boxShadow: '0 16px 32px -26px rgba(233,30,140,0.4)' }}>
                          <VideoPlayer src={videoUrl} poster={thumbnailUrl} postId={item.id} />
                        </div>
                      ) : mediaUrl ? (
                        <div className="signal-media" style={{ borderRadius: 14, overflow: 'hidden', boxShadow: '0 16px 32px -26px rgba(233,30,140,0.4)' }}>
                          <Image src={mediaUrl} alt="Feed media" width={800} height={500} style={{ width: '100%', height: 'auto' }} />
                        </div>
                      ) : null}

                      <div className="signal-actions" style={{ marginTop: 12, display: 'flex', gap: 16, alignItems: 'center', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: 12 }}>
                        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                          <i className="fas fa-eye" aria-hidden="true" style={{ marginRight: 6 }} />
                          {item.viewsCount || 0} views
                        </span>
                        <button
                          onClick={() => setTippingPostId(item.id)}
                          style={{ background: 'none', border: 'none', color: '#e91e8c', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
                        >
                          <i className="fas fa-coins" aria-hidden="true" style={{ marginRight: 6 }} />
                          Tip Creator
                        </button>
                      </div>
                    </li>
                    {index === 2 && ad && <AdCard ad={ad} />}
                    </React.Fragment>
                  );
                })}
              </ul>

              <TippingModal 
                isOpen={!!tippingPostId} 
                onClose={() => setTippingPostId(null)} 
                onTip={handleTip}
              />

              {!hasItems && !isLoadingInitial ? (
                <div className="signal-empty">
                  <p className="mb-2" style={{ fontWeight: 600 }}>No stories for this filter yet.</p>
                  <p className="mb-0" style={{ color: '#94a3b8' }}>Try switching filters or post something new from the social feed.</p>
                </div>
              ) : null}

              <button
                ref={loadMoreRef}
                type="button"
                className="signal-load"
                onClick={loadMore}
                disabled={isLoadingMore || isReachingEnd}
                style={{ background: 'linear-gradient(135deg,#e91e8c,#8b5cf6)', color: '#fff', boxShadow: '0 14px 32px -24px rgba(233,30,140,0.45)' }}
              >
                <i className="fas fa-chevron-down" aria-hidden="true" />
                {isReachingEnd ? 'End of feed' : isLoadingMore ? 'Loading...' : 'Keep scrolling'}
              </button>
            </section>
          </div>

          <div className="hidden lg:block lg:col-span-4 space-y-6">
            <WhoToFollow />
          </div>
        </div>
      </div>
    </main>
  );
}
