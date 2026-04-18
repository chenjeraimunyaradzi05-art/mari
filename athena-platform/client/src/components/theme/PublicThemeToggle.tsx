'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useUIStore } from '@/lib/store';
import { cn } from '@/lib/utils';

type ResolvedTheme = 'light' | 'dark';

function getResolvedTheme(theme: 'light' | 'dark' | 'system'): ResolvedTheme {
  if (typeof window === 'undefined') {
    return 'dark';
  }

  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  return theme;
}

export default function PublicThemeToggle() {
  const theme = useUIStore((state) => state.theme);
  const setTheme = useUIStore((state) => state.setTheme);
  const [mounted, setMounted] = useState(false);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('dark');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const syncTheme = () => setResolvedTheme(getResolvedTheme(theme));
    syncTheme();

    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => syncTheme();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, [mounted, theme]);

  if (!mounted) {
    return <div className="h-11 w-[7.5rem] rounded-full border border-slate-200/80 bg-white/70 dark:border-white/10 dark:bg-slate-900/70" />;
  }

  return (
    <div className="inline-flex items-center rounded-full border border-slate-200/80 bg-white/85 p-1 text-slate-600 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-900/80 dark:text-slate-300">
      {[
        { id: 'dark' as const, label: 'Dark', icon: Moon },
        { id: 'light' as const, label: 'Light', icon: Sun },
      ].map((option) => {
        const isActive = (theme === option.id) || (theme === 'system' && resolvedTheme === option.id);

        return (
          <button
            key={option.id}
            type="button"
            onClick={() => setTheme(option.id)}
            aria-pressed={isActive}
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition',
              isActive
                ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
                : 'hover:bg-slate-100 hover:text-slate-950 dark:hover:bg-white/10 dark:hover:text-white'
            )}
          >
            <option.icon className="h-4 w-4" />
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
