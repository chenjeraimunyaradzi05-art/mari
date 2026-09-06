'use client';

/**
 * The light/dark switch. It writes to the same UI store the page's theme
 * sync reads, so flipping it re-themes the whole site at once and the choice
 * survives a reload. Until the component has mounted it renders a neutral
 * placeholder, because the server cannot know the viewer's preference.
 */

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useUIStore } from '@/lib/store';
import { cn } from '@/lib/utils';

type Resolved = 'light' | 'dark';

function resolve(theme: 'light' | 'dark' | 'system'): Resolved {
  if (theme !== 'system') return theme;
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function ThemeSwitch({ className }: { className?: string }) {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const [mounted, setMounted] = useState(false);
  const [resolved, setResolved] = useState<Resolved>('light');

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    setResolved(resolve(theme));
    if (theme !== 'system') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setResolved(resolve('system'));
    mql.addEventListener?.('change', onChange);
    return () => mql.removeEventListener?.('change', onChange);
  }, [mounted, theme]);

  if (!mounted) {
    return <span aria-hidden className={cn('inline-block h-8 w-14 rounded-full bg-slate-200/70 dark:bg-slate-800/70', className)} />;
  }

  const dark = resolved === 'dark';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      className={cn(
        'focusable relative inline-flex h-8 w-14 flex-shrink-0 items-center rounded-full border transition-colors duration-300',
        dark ? 'border-violet-400/40 bg-slate-900' : 'border-rose-200 bg-rose-50',
        className
      )}
    >
      <Sun className={cn('absolute left-2 h-3.5 w-3.5 transition-opacity duration-300', dark ? 'opacity-40 text-slate-400' : 'opacity-0')} />
      <Moon className={cn('absolute right-2 h-3.5 w-3.5 transition-opacity duration-300', dark ? 'opacity-0' : 'opacity-40 text-slate-400')} />
      <span
        className={cn(
          'absolute top-0.5 flex h-[26px] w-[26px] items-center justify-center rounded-full shadow-md transition-transform duration-300 ease-out',
          dark ? 'translate-x-[26px] bg-gradient-to-br from-violet-500 to-indigo-600 text-white' : 'translate-x-0.5 bg-gradient-to-br from-amber-300 to-rose-400 text-white'
        )}
      >
        {dark ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
      </span>
    </button>
  );
}
