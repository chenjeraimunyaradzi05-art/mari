'use client';

import * as React from 'react';
import { RadioGroup as HeadlessRadioGroup } from '@headlessui/react';
import { Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RadioGroupProps<T extends string = string> {
  value?: T;
  onValueChange?: (value: T) => void;
  defaultValue?: T;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}

function RadioGroup<T extends string = string>({
  value,
  onValueChange,
  defaultValue,
  disabled,
  className,
  children,
  ...props
}: RadioGroupProps<T>) {
  return (
    <HeadlessRadioGroup
      value={value as string}
      onChange={(val: string) => onValueChange?.(val as T)}
      defaultValue={defaultValue as string}
      disabled={disabled}
      className={cn('grid gap-2', className)}
      {...props}
    >
      {children}
    </HeadlessRadioGroup>
  );
}

interface RadioGroupItemProps {
  value: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  children?: React.ReactNode;
}

const RadioGroupItem = React.forwardRef<HTMLDivElement, RadioGroupItemProps>(
  ({ value, disabled, className, id, children, ...props }, ref) => {
    return (
      <HeadlessRadioGroup.Option
        ref={ref}
        value={value}
        disabled={disabled}
        className={({ checked }) =>
          cn(
            'aspect-square h-4 w-4 rounded-full border border-primary text-primary ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer',
            checked && 'border-2',
            className
          )
        }
        {...props}
      >
        {({ checked }) => (
          <span
            className={cn(
              'flex items-center justify-center',
              checked && 'text-current'
            )}
          >
            {checked && (
              <Circle className="h-2.5 w-2.5 fill-current" />
            )}
          </span>
        )}
      </HeadlessRadioGroup.Option>
    );
  }
);
RadioGroupItem.displayName = 'RadioGroupItem';

export { RadioGroup, RadioGroupItem };
