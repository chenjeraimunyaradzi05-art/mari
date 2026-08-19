/**
 * Shared Hooks for ATHENA Platform
 * Phase 5: Step 82 - Shared UI Library
 *
 * Common hooks used across web and mobile clients
 */
import { type RefObject } from 'react';
export declare function useDebounce<T>(value: T, delay: number): T;
export declare function useThrottle<T>(value: T, interval: number): T;
export declare function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void];
export declare function usePrevious<T>(value: T): T | undefined;
export declare function useMediaQuery(query: string): boolean;
export declare const MediaQueries: {
    isMobile: string;
    isTablet: string;
    isDesktop: string;
    prefersReducedMotion: string;
    prefersDarkMode: string;
};
export declare function useOnlineStatus(): boolean;
export declare function useInterval(callback: () => void, delay: number | null): void;
export declare function useTimeout(callback: () => void, delay: number | null): void;
interface UseIntersectionObserverOptions {
    threshold?: number | number[];
    root?: Element | null;
    rootMargin?: string;
    freezeOnceVisible?: boolean;
}
export declare function useIntersectionObserver(elementRef: RefObject<Element>, { threshold, root, rootMargin, freezeOnceVisible, }?: UseIntersectionObserverOptions): IntersectionObserverEntry | undefined;
interface UseClipboardResult {
    copied: boolean;
    copy: (text: string) => Promise<void>;
    reset: () => void;
}
export declare function useClipboard(resetDelay?: number): UseClipboardResult;
interface WindowSize {
    width: number;
    height: number;
}
export declare function useWindowSize(): WindowSize;
export declare function useKeyPress(targetKey: string): boolean;
interface ScrollPosition {
    x: number;
    y: number;
}
export declare function useScrollPosition(): ScrollPosition;
export {};
//# sourceMappingURL=index.d.ts.map