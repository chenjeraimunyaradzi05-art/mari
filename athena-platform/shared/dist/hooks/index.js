"use strict";
/**
 * Shared Hooks for ATHENA Platform
 * Phase 5: Step 82 - Shared UI Library
 *
 * Common hooks used across web and mobile clients
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaQueries = void 0;
exports.useDebounce = useDebounce;
exports.useThrottle = useThrottle;
exports.useLocalStorage = useLocalStorage;
exports.usePrevious = usePrevious;
exports.useMediaQuery = useMediaQuery;
exports.useOnlineStatus = useOnlineStatus;
exports.useInterval = useInterval;
exports.useTimeout = useTimeout;
exports.useIntersectionObserver = useIntersectionObserver;
exports.useClipboard = useClipboard;
exports.useWindowSize = useWindowSize;
exports.useKeyPress = useKeyPress;
exports.useScrollPosition = useScrollPosition;
const react_1 = require("react");
// ==========================================
// DEBOUNCE HOOK
// ==========================================
function useDebounce(value, delay) {
    const [debouncedValue, setDebouncedValue] = (0, react_1.useState)(value);
    (0, react_1.useEffect)(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
}
// ==========================================
// THROTTLE HOOK
// ==========================================
function useThrottle(value, interval) {
    const [throttledValue, setThrottledValue] = (0, react_1.useState)(value);
    const lastExecuted = (0, react_1.useRef)(Date.now());
    (0, react_1.useEffect)(() => {
        const handler = setTimeout(() => {
            const now = Date.now();
            if (now - lastExecuted.current >= interval) {
                setThrottledValue(value);
                lastExecuted.current = now;
            }
        }, interval - (Date.now() - lastExecuted.current));
        return () => clearTimeout(handler);
    }, [value, interval]);
    return throttledValue;
}
// ==========================================
// LOCAL STORAGE HOOK
// ==========================================
function useLocalStorage(key, initialValue) {
    const [storedValue, setStoredValue] = (0, react_1.useState)(() => {
        if (typeof window === 'undefined') {
            return initialValue;
        }
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        }
        catch (error) {
            console.error(`Error reading localStorage key "${key}":`, error);
            return initialValue;
        }
    });
    const setValue = (0, react_1.useCallback)((value) => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);
            if (typeof window !== 'undefined') {
                window.localStorage.setItem(key, JSON.stringify(valueToStore));
            }
        }
        catch (error) {
            console.error(`Error setting localStorage key "${key}":`, error);
        }
    }, [key, storedValue]);
    return [storedValue, setValue];
}
// ==========================================
// PREVIOUS VALUE HOOK
// ==========================================
function usePrevious(value) {
    const ref = (0, react_1.useRef)();
    (0, react_1.useEffect)(() => {
        ref.current = value;
    });
    return ref.current;
}
// ==========================================
// MEDIA QUERY HOOK
// ==========================================
function useMediaQuery(query) {
    const [matches, setMatches] = (0, react_1.useState)(false);
    (0, react_1.useEffect)(() => {
        if (typeof window === 'undefined')
            return;
        const mediaQuery = window.matchMedia(query);
        setMatches(mediaQuery.matches);
        const handler = (event) => {
            setMatches(event.matches);
        };
        mediaQuery.addEventListener('change', handler);
        return () => mediaQuery.removeEventListener('change', handler);
    }, [query]);
    return matches;
}
// Preset media queries
exports.MediaQueries = {
    isMobile: '(max-width: 639px)',
    isTablet: '(min-width: 640px) and (max-width: 1023px)',
    isDesktop: '(min-width: 1024px)',
    prefersReducedMotion: '(prefers-reduced-motion: reduce)',
    prefersDarkMode: '(prefers-color-scheme: dark)',
};
// ==========================================
// ONLINE STATUS HOOK
// ==========================================
function useOnlineStatus() {
    const [isOnline, setIsOnline] = (0, react_1.useState)(typeof navigator !== 'undefined' ? navigator.onLine : true);
    (0, react_1.useEffect)(() => {
        if (typeof window === 'undefined')
            return;
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);
    return isOnline;
}
// ==========================================
// INTERVAL HOOK
// ==========================================
function useInterval(callback, delay) {
    const savedCallback = (0, react_1.useRef)(callback);
    (0, react_1.useEffect)(() => {
        savedCallback.current = callback;
    }, [callback]);
    (0, react_1.useEffect)(() => {
        if (delay === null)
            return;
        const id = setInterval(() => savedCallback.current(), delay);
        return () => clearInterval(id);
    }, [delay]);
}
// ==========================================
// TIMEOUT HOOK
// ==========================================
function useTimeout(callback, delay) {
    const savedCallback = (0, react_1.useRef)(callback);
    (0, react_1.useEffect)(() => {
        savedCallback.current = callback;
    }, [callback]);
    (0, react_1.useEffect)(() => {
        if (delay === null)
            return;
        const id = setTimeout(() => savedCallback.current(), delay);
        return () => clearTimeout(id);
    }, [delay]);
}
function useIntersectionObserver(elementRef, { threshold = 0, root = null, rootMargin = '0%', freezeOnceVisible = false, } = {}) {
    const [entry, setEntry] = (0, react_1.useState)();
    const frozen = entry?.isIntersecting && freezeOnceVisible;
    (0, react_1.useEffect)(() => {
        const node = elementRef?.current;
        if (!node || typeof IntersectionObserver === 'undefined' || frozen)
            return;
        const observer = new IntersectionObserver(([entry]) => setEntry(entry), { threshold, root, rootMargin });
        observer.observe(node);
        return () => observer.disconnect();
    }, [elementRef, threshold, root, rootMargin, frozen]);
    return entry;
}
function useClipboard(resetDelay = 2000) {
    const [copied, setCopied] = (0, react_1.useState)(false);
    const copy = (0, react_1.useCallback)(async (text) => {
        if (!navigator?.clipboard) {
            console.warn('Clipboard not supported');
            return;
        }
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
        }
        catch (error) {
            console.error('Failed to copy:', error);
        }
    }, []);
    const reset = (0, react_1.useCallback)(() => setCopied(false), []);
    (0, react_1.useEffect)(() => {
        if (copied && resetDelay) {
            const timeout = setTimeout(reset, resetDelay);
            return () => clearTimeout(timeout);
        }
    }, [copied, resetDelay, reset]);
    return { copied, copy, reset };
}
function useWindowSize() {
    const [size, setSize] = (0, react_1.useState)({
        width: typeof window !== 'undefined' ? window.innerWidth : 0,
        height: typeof window !== 'undefined' ? window.innerHeight : 0,
    });
    (0, react_1.useEffect)(() => {
        if (typeof window === 'undefined')
            return;
        const handleResize = () => {
            setSize({
                width: window.innerWidth,
                height: window.innerHeight,
            });
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    return size;
}
// ==========================================
// KEY PRESS HOOK
// ==========================================
function useKeyPress(targetKey) {
    const [keyPressed, setKeyPressed] = (0, react_1.useState)(false);
    (0, react_1.useEffect)(() => {
        const downHandler = ({ key }) => {
            if (key === targetKey)
                setKeyPressed(true);
        };
        const upHandler = ({ key }) => {
            if (key === targetKey)
                setKeyPressed(false);
        };
        window.addEventListener('keydown', downHandler);
        window.addEventListener('keyup', upHandler);
        return () => {
            window.removeEventListener('keydown', downHandler);
            window.removeEventListener('keyup', upHandler);
        };
    }, [targetKey]);
    return keyPressed;
}
function useScrollPosition() {
    const [position, setPosition] = (0, react_1.useState)({
        x: typeof window !== 'undefined' ? window.scrollX : 0,
        y: typeof window !== 'undefined' ? window.scrollY : 0,
    });
    (0, react_1.useEffect)(() => {
        if (typeof window === 'undefined')
            return;
        const handleScroll = () => {
            setPosition({
                x: window.scrollX,
                y: window.scrollY,
            });
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);
    return position;
}
