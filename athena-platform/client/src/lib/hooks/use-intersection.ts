/**
 * useIntersection Hook
 * Observe element visibility for infinite scroll & lazy loading
 */

import { useState, useEffect, useRef, useCallback, type RefObject } from 'react';

interface UseIntersectionOptions {
  threshold?: number | number[];
  root?: Element | null;
  rootMargin?: string;
  triggerOnce?: boolean;
}

interface UseIntersectionResult {
  ref: RefObject<HTMLElement>;
  isIntersecting: boolean;
  entry: IntersectionObserverEntry | null;
}

export function useIntersection(
  options: UseIntersectionOptions = {}
): UseIntersectionResult {
  const { threshold = 0, root = null, rootMargin = '0px', triggerOnce = false } = options;
  
  const ref = useRef<HTMLElement>(null);
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null);
  const [hasTriggered, setHasTriggered] = useState(false);

  const frozen = triggerOnce && hasTriggered;

  useEffect(() => {
    const node = ref.current;
    if (!node || frozen) return;

    const observer = new IntersectionObserver(
      ([observerEntry]) => {
        setEntry(observerEntry);
        
        if (observerEntry.isIntersecting && triggerOnce) {
          setHasTriggered(true);
        }
      },
      { threshold, root, rootMargin }
    );

    observer.observe(node);

    return () => {
      observer.unobserve(node);
    };
  }, [threshold, root, rootMargin, frozen, triggerOnce]);

  return {
    ref: ref as RefObject<HTMLElement>,
    isIntersecting: entry?.isIntersecting ?? false,
    entry,
  };
}

export function useInfiniteScroll(
  onLoadMore: () => void | Promise<void>,
  options: { threshold?: number; rootMargin?: string } = {}
) {
  const { threshold = 0.1, rootMargin = '100px' } = options;
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const isLoading = useRef(false);

  const handleLoadMore = useCallback(async () => {
    if (isLoading.current) return;
    
    isLoading.current = true;
    try {
      await onLoadMore();
    } finally {
      isLoading.current = false;
    }
  }, [onLoadMore]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          handleLoadMore();
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(node);

    return () => {
      observer.unobserve(node);
    };
  }, [threshold, rootMargin, handleLoadMore]);

  return loadMoreRef;
}
