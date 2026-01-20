'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface ToggleProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  pressed?: boolean;
  onPressedChange?: (pressed: boolean) => void;
  variant?: 'default' | 'outline';
  size?: 'default' | 'sm' | 'lg';
}

const Toggle = React.forwardRef<HTMLButtonElement, ToggleProps>(
  ({ className, variant = 'default', size = 'default', pressed, onPressedChange, onClick, ...props }, ref) => {
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      onPressedChange?.(!pressed);
      onClick?.(e);
    };

    return (
      <button
        ref={ref}
        type="button"
        aria-pressed={pressed}
        data-state={pressed ? 'on' : 'off'}
        onClick={handleClick}
        className={cn(
          'inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-white transition-colors hover:bg-zinc-100 hover:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:ring-offset-zinc-950 dark:hover:bg-zinc-800 dark:hover:text-zinc-400 dark:focus-visible:ring-zinc-300',
          pressed && 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50',
          variant === 'outline' && 'border border-zinc-200 bg-transparent hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-800',
          size === 'default' && 'h-10 px-3',
          size === 'sm' && 'h-9 px-2.5',
          size === 'lg' && 'h-11 px-5',
          className
        )}
        {...props}
      />
    );
  }
);

Toggle.displayName = 'Toggle';

export { Toggle };
export type { ToggleProps };
