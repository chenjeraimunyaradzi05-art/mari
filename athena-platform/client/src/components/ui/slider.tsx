'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface SliderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'defaultValue'> {
  value?: number[];
  defaultValue?: number[];
  min?: number;
  max?: number;
  step?: number;
  onValueChange?: (value: number[]) => void;
  disabled?: boolean;
  orientation?: 'horizontal' | 'vertical';
}

const Slider = React.forwardRef<HTMLDivElement, SliderProps>(
  (
    {
      className,
      value,
      defaultValue = [0],
      min = 0,
      max = 100,
      step = 1,
      onValueChange,
      disabled = false,
      orientation = 'horizontal',
      ...props
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = React.useState(defaultValue);
    const currentValue = value ?? internalValue;
    const trackRef = React.useRef<HTMLDivElement>(null);
    const isVertical = orientation === 'vertical';

    const percentage = ((currentValue[0] - min) / (max - min)) * 100;

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
      if (disabled) return;
      
      const updateValue = (clientX: number, clientY: number) => {
        if (!trackRef.current) return;
        const rect = trackRef.current.getBoundingClientRect();
        let percent: number;
        if (isVertical) {
          percent = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height));
        } else {
          percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        }
        const rawValue = min + percent * (max - min);
        const steppedValue = Math.round(rawValue / step) * step;
        const clampedValue = Math.max(min, Math.min(max, steppedValue));
        
        const newValue = [clampedValue];
        setInternalValue(newValue);
        onValueChange?.(newValue);
      };

      updateValue(e.clientX, e.clientY);

      const handleMouseMove = (moveEvent: MouseEvent) => {
        updateValue(moveEvent.clientX, moveEvent.clientY);
      };

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    };

    return (
      <div
        ref={ref}
        className={cn(
          'relative flex touch-none select-none',
          isVertical ? 'h-full flex-col items-center' : 'w-full items-center',
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
        {...props}
      >
        <div
          ref={trackRef}
          className={cn(
            'relative overflow-hidden rounded-full bg-secondary cursor-pointer',
            isVertical ? 'w-2 h-full' : 'h-2 w-full grow'
          )}
          onMouseDown={handleMouseDown}
        >
          <div
            className={cn('absolute bg-primary', isVertical ? 'w-full bottom-0' : 'h-full')}
            style={isVertical ? { height: `${percentage}%` } : { width: `${percentage}%` }}
          />
        </div>
        <div
          className="absolute block h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-grab active:cursor-grabbing"
          style={isVertical ? { bottom: `calc(${percentage}% - 10px)` } : { left: `calc(${percentage}% - 10px)` }}
          onMouseDown={handleMouseDown}
        />
      </div>
    );
  }
);
Slider.displayName = 'Slider';

export { Slider };
