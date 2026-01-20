/**
 * useScrollPosition Hook
 * Track scroll position for scroll-based effects
 */

import { useState, useEffect, useRef, useCallback } from 'react';

interface ScrollPosition {
  x: number;
  y: number;
  direction: 'up' | 'down' | 'none';
  isScrolling: boolean;
  progress: number; // 0-1 scroll progress
}

export function useScrollPosition(
  element?: HTMLElement | null
): ScrollPosition {
  const [position, setPosition] = useState<ScrollPosition>({
    x: 0,
    y: 0,
    direction: 'none',
    isScrolling: false,
    progress: 0,
  });

  const prevY = useRef(0);
  const scrollTimeout = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const target = element || window;

    const handleScroll = () => {
      const scrollY = element ? element.scrollTop : window.scrollY;
      const scrollX = element ? element.scrollLeft : window.scrollX;
      
      const maxScroll = element
        ? element.scrollHeight - element.clientHeight
        : document.documentElement.scrollHeight - window.innerHeight;

      const direction: 'up' | 'down' | 'none' =
        scrollY > prevY.current ? 'down' : scrollY < prevY.current ? 'up' : 'none';

      setPosition({
        x: scrollX,
        y: scrollY,
        direction,
        isScrolling: true,
        progress: maxScroll > 0 ? scrollY / maxScroll : 0,
      });

      prevY.current = scrollY;

      // Clear existing timeout
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }

      // Set isScrolling to false after scroll ends
      scrollTimeout.current = setTimeout(() => {
        setPosition((prev) => ({ ...prev, isScrolling: false }));
      }, 150);
    };

    target.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      target.removeEventListener('scroll', handleScroll);
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
    };
  }, [element]);

  return position;
}

export function useScrollToTop() {
  const scrollToTop = useCallback((smooth = true) => {
    if (typeof window === 'undefined') return;

    window.scrollTo({
      top: 0,
      behavior: smooth ? 'smooth' : 'auto',
    });
  }, []);

  return scrollToTop;
}

export function useScrollLock() {
  const lock = useCallback(() => {
    if (typeof document === 'undefined') return;
    
    const scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
  }, []);

  const unlock = useCallback(() => {
    if (typeof document === 'undefined') return;
    
    const scrollY = document.body.style.top;
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    window.scrollTo(0, parseInt(scrollY || '0') * -1);
  }, []);

  return { lock, unlock };
}
