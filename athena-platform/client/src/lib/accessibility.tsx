'use client';

/**
 * Accessibility Utilities & Components
 * Phase 3: Web Client - Super App Core
 * 
 * Provides keyboard navigation, screen reader support,
 * focus management, and ARIA live regions
 */

import React, { useEffect, useRef, useCallback, createContext, useContext, useState } from 'react';
import { cn } from '@/lib/utils';

// ============================================
// FOCUS MANAGEMENT
// ============================================

/**
 * Focus trap for modals and dialogs
 */
export function useFocusTrap(isActive: boolean) {
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Save previous focus
    const previousFocus = document.activeElement as HTMLElement;

    // Focus first element
    firstElement?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, [isActive]);

  return containerRef;
}

/**
 * Roving tabindex for list navigation
 */
export function useRovingTabIndex<T extends HTMLElement>(
  items: any[],
  options: {
    orientation?: 'horizontal' | 'vertical' | 'both';
    loop?: boolean;
    onSelect?: (index: number) => void;
  } = {}
) {
  const { orientation = 'vertical', loop = true, onSelect } = options;
  const [activeIndex, setActiveIndex] = useState(0);
  const itemRefs = useRef<(T | null)[]>([]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      let nextIndex = index;
      const isHorizontal = orientation === 'horizontal' || orientation === 'both';
      const isVertical = orientation === 'vertical' || orientation === 'both';

      switch (e.key) {
        case 'ArrowRight':
          if (isHorizontal) {
            e.preventDefault();
            nextIndex = loop
              ? (index + 1) % items.length
              : Math.min(index + 1, items.length - 1);
          }
          break;
        case 'ArrowLeft':
          if (isHorizontal) {
            e.preventDefault();
            nextIndex = loop
              ? (index - 1 + items.length) % items.length
              : Math.max(index - 1, 0);
          }
          break;
        case 'ArrowDown':
          if (isVertical) {
            e.preventDefault();
            nextIndex = loop
              ? (index + 1) % items.length
              : Math.min(index + 1, items.length - 1);
          }
          break;
        case 'ArrowUp':
          if (isVertical) {
            e.preventDefault();
            nextIndex = loop
              ? (index - 1 + items.length) % items.length
              : Math.max(index - 1, 0);
          }
          break;
        case 'Home':
          e.preventDefault();
          nextIndex = 0;
          break;
        case 'End':
          e.preventDefault();
          nextIndex = items.length - 1;
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          onSelect?.(index);
          return;
        default:
          return;
      }

      setActiveIndex(nextIndex);
      itemRefs.current[nextIndex]?.focus();
    },
    [items.length, orientation, loop, onSelect]
  );

  const getItemProps = useCallback(
    (index: number) => ({
      ref: (el: T | null) => {
        itemRefs.current[index] = el;
      },
      tabIndex: activeIndex === index ? 0 : -1,
      onKeyDown: (e: React.KeyboardEvent) => handleKeyDown(e, index),
      onFocus: () => setActiveIndex(index),
    }),
    [activeIndex, handleKeyDown]
  );

  return { activeIndex, setActiveIndex, getItemProps };
}

// ============================================
// SCREEN READER ANNOUNCEMENTS
// ============================================

interface AnnouncementContextType {
  announce: (message: string, priority?: 'polite' | 'assertive') => void;
}

const AnnouncementContext = createContext<AnnouncementContextType | null>(null);

export function AnnouncementProvider({ children }: { children: React.ReactNode }) {
  const [politeMessage, setPoliteMessage] = useState('');
  const [assertiveMessage, setAssertiveMessage] = useState('');

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (priority === 'assertive') {
      setAssertiveMessage('');
      setTimeout(() => setAssertiveMessage(message), 50);
    } else {
      setPoliteMessage('');
      setTimeout(() => setPoliteMessage(message), 50);
    }
  }, []);

  return (
    <AnnouncementContext.Provider value={{ announce }}>
      {children}
      {/* Live regions */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {politeMessage}
      </div>
      <div
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      >
        {assertiveMessage}
      </div>
    </AnnouncementContext.Provider>
  );
}

export function useAnnounce() {
  const context = useContext(AnnouncementContext);
  if (!context) {
    throw new Error('useAnnounce must be used within AnnouncementProvider');
  }
  return context.announce;
}

// ============================================
// SKIP LINKS
// ============================================

export function SkipLinks() {
  return (
    <div className="sr-only focus-within:not-sr-only">
      <a
        href="#main-content"
        className="fixed top-0 left-0 z-[100] bg-white dark:bg-zinc-900 px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
      >
        Skip to main content
      </a>
      <a
        href="#main-nav"
        className="fixed top-0 left-32 z-[100] bg-white dark:bg-zinc-900 px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
      >
        Skip to navigation
      </a>
    </div>
  );
}

// ============================================
// KEYBOARD SHORTCUTS
// ============================================

type KeyboardShortcut = {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
  description: string;
  action: () => void;
};

const ShortcutsContext = createContext<{
  shortcuts: KeyboardShortcut[];
  registerShortcut: (shortcut: KeyboardShortcut) => void;
  unregisterShortcut: (key: string) => void;
} | null>(null);

export function KeyboardShortcutsProvider({ children }: { children: React.ReactNode }) {
  const [shortcuts, setShortcuts] = useState<KeyboardShortcut[]>([]);

  const registerShortcut = useCallback((shortcut: KeyboardShortcut) => {
    setShortcuts((prev) => [...prev.filter((s) => s.key !== shortcut.key), shortcut]);
  }, []);

  const unregisterShortcut = useCallback((key: string) => {
    setShortcuts((prev) => prev.filter((s) => s.key !== key));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      for (const shortcut of shortcuts) {
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = !!shortcut.ctrl === (e.ctrlKey || e.metaKey);
        const altMatch = !!shortcut.alt === e.altKey;
        const shiftMatch = !!shortcut.shift === e.shiftKey;

        if (keyMatch && ctrlMatch && altMatch && shiftMatch) {
          e.preventDefault();
          shortcut.action();
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);

  return (
    <ShortcutsContext.Provider value={{ shortcuts, registerShortcut, unregisterShortcut }}>
      {children}
    </ShortcutsContext.Provider>
  );
}

export function useKeyboardShortcut(shortcut: KeyboardShortcut) {
  const context = useContext(ShortcutsContext);
  
  useEffect(() => {
    if (!context) return;
    context.registerShortcut(shortcut);
    return () => context.unregisterShortcut(shortcut.key);
  }, [shortcut, context]);
}

export function useKeyboardShortcuts() {
  const context = useContext(ShortcutsContext);
  if (!context) {
    throw new Error('useKeyboardShortcuts must be used within KeyboardShortcutsProvider');
  }
  return context.shortcuts;
}

// ============================================
// ACCESSIBLE COMPONENTS
// ============================================

/**
 * Visually hidden but accessible to screen readers
 */
export function VisuallyHidden({ children }: { children: React.ReactNode }) {
  return <span className="sr-only">{children}</span>;
}

/**
 * Focus outline component for custom focus styles
 */
export function FocusRing({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'focus-within:ring-2 focus-within:ring-emerald-500 focus-within:ring-offset-2 rounded-lg',
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * Accessible icon button
 */
interface AccessibleIconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon: React.ReactNode;
}

export function AccessibleIconButton({ label, icon, className, ...props }: AccessibleIconButtonProps) {
  return (
    <button
      {...props}
      aria-label={label}
      className={cn(
        'inline-flex items-center justify-center',
        'focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2',
        className
      )}
    >
      {icon}
      <VisuallyHidden>{label}</VisuallyHidden>
    </button>
  );
}

// ============================================
// REDUCED MOTION
// ============================================

export function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return prefersReducedMotion;
}

// ============================================
// VIDEO FEED KEYBOARD NAVIGATION
// ============================================

export function useVideoFeedKeyboardNav(options: {
  onNext: () => void;
  onPrevious: () => void;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onMute: () => void;
  onPlayPause: () => void;
}) {
  const { onNext, onPrevious, onLike, onComment, onShare, onMute, onPlayPause } = options;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if in input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
        case 'j':
          e.preventDefault();
          onNext();
          break;
        case 'ArrowUp':
        case 'k':
          e.preventDefault();
          onPrevious();
          break;
        case 'l':
          e.preventDefault();
          onLike();
          break;
        case 'c':
          e.preventDefault();
          onComment();
          break;
        case 's':
          e.preventDefault();
          onShare();
          break;
        case 'm':
          e.preventDefault();
          onMute();
          break;
        case ' ':
          e.preventDefault();
          onPlayPause();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNext, onPrevious, onLike, onComment, onShare, onMute, onPlayPause]);
}

// ============================================
// CHAT KEYBOARD NAVIGATION
// ============================================

export function useChatKeyboardNav(options: {
  onSend: () => void;
  onPreviousConversation: () => void;
  onNextConversation: () => void;
  onEscape: () => void;
}) {
  const { onSend, onPreviousConversation, onNextConversation, onEscape } = options;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + Enter to send
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        onSend();
        return;
      }

      // Only handle other shortcuts outside of inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          onEscape();
          break;
        case 'ArrowUp':
          if (e.altKey) {
            e.preventDefault();
            onPreviousConversation();
          }
          break;
        case 'ArrowDown':
          if (e.altKey) {
            e.preventDefault();
            onNextConversation();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSend, onPreviousConversation, onNextConversation, onEscape]);
}

export default {
  SkipLinks,
  AnnouncementProvider,
  KeyboardShortcutsProvider,
  VisuallyHidden,
  FocusRing,
  AccessibleIconButton,
};
