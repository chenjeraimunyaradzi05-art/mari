'use client';

/**
 * Post impressions: what was actually on screen, batched to the server.
 *
 * A post counts once it has been at least half visible for a second. Ids are
 * queued and sent a few seconds later in one request; each id is sent once per
 * page load. Signed-out readers count once per browser through a random key
 * kept in localStorage, which the server hashes.
 */

import { useCallback, useEffect, useRef } from 'react';
import { postApi } from './api';
import { getAccessToken } from './auth';

const DWELL_MS = 1000;
const FLUSH_MS = 3000;
const MAX_BATCH = 50;

const sent = new Set<string>();
const queue = new Map<string, string>(); // postId -> source
let timer: ReturnType<typeof setTimeout> | null = null;

function anonId(): string | undefined {
  try {
    const key = 'athena.anon';
    let value = localStorage.getItem(key);
    if (!value) {
      value = crypto.randomUUID();
      localStorage.setItem(key, value);
    }
    return value;
  } catch {
    return undefined;
  }
}

function takeBatch(): { ids: string[]; source: string } | null {
  if (queue.size === 0) return null;
  // One request per source keeps the breakdown honest.
  const [, source] = queue.entries().next().value as [string, string];
  const ids: string[] = [];
  for (const [id, s] of queue) {
    if (s === source && ids.length < MAX_BATCH) {
      ids.push(id);
      queue.delete(id);
    }
  }
  return { ids, source };
}

function flush(final = false) {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  let batch = takeBatch();
  while (batch) {
    const body = { ids: batch.ids, source: batch.source, anonId: anonId() };
    if (final && typeof fetch === 'function') {
      // The page is going away: a keepalive request outlives it.
      const token = getAccessToken();
      void fetch('/api/posts/impressions', {
        method: 'POST',
        keepalive: true,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
      }).catch(() => {});
    } else {
      void postApi.recordImpressions(body).catch(() => {});
    }
    batch = takeBatch();
  }
}

function schedule() {
  if (timer) return;
  timer = setTimeout(() => flush(), FLUSH_MS);
}

let listening = false;
function listen() {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  window.addEventListener('pagehide', () => flush(true));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush(true);
  });
}

export function recordImpression(postId: string, source: string) {
  if (!postId || sent.has(postId)) return;
  sent.add(postId);
  queue.set(postId, source);
  listen();
  schedule();
}

/**
 * Attach the returned ref to a post card's root. The post is recorded once it
 * has been at least half on screen for a second.
 */
export function useImpression(postId: string | undefined, source: string) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    observerRef.current?.disconnect();
    observerRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  return useCallback(
    (node: HTMLElement | null) => {
      cleanup();
      if (!node || !postId || sent.has(postId) || typeof IntersectionObserver === 'undefined') return;
      const observer = new IntersectionObserver(
        (entries) => {
          const visible = entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5);
          if (visible && !timerRef.current) {
            timerRef.current = setTimeout(() => {
              recordImpression(postId, source);
              cleanup();
            }, DWELL_MS);
          } else if (!visible && timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
          }
        },
        { threshold: [0, 0.5, 1] }
      );
      observer.observe(node);
      observerRef.current = observer;
    },
    [postId, source, cleanup]
  );
}
