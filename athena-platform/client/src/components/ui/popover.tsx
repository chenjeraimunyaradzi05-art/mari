'use client';

import * as React from 'react';
import { Popover as HeadlessPopover, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { cn } from '@/lib/utils';

const Popover = HeadlessPopover;

interface PopoverTriggerProps {
  asChild?: boolean;
  children: React.ReactNode;
  className?: string;
}

const PopoverTrigger = React.forwardRef<HTMLButtonElement, PopoverTriggerProps>(
  ({ asChild, children, className, ...props }, ref) => {
    if (asChild && React.isValidElement(children)) {
      return (
        <HeadlessPopover.Button as={Fragment}>
          {({ open }) => 
            React.cloneElement(children as React.ReactElement<{ ref?: React.Ref<HTMLButtonElement>; 'data-state'?: string }>, {
              ref,
              'data-state': open ? 'open' : 'closed',
            })
          }
        </HeadlessPopover.Button>
      );
    }
    
    return (
      <HeadlessPopover.Button ref={ref} className={className} {...props}>
        {children}
      </HeadlessPopover.Button>
    );
  }
);
PopoverTrigger.displayName = 'PopoverTrigger';

const PopoverContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { 
    align?: 'start' | 'center' | 'end';
    sideOffset?: number;
  }
>(({ className, align = 'center', sideOffset = 4, children, ...props }, ref) => (
  <Transition
    as={Fragment}
    enter="transition ease-out duration-200"
    enterFrom="opacity-0 translate-y-1"
    enterTo="opacity-100 translate-y-0"
    leave="transition ease-in duration-150"
    leaveFrom="opacity-100 translate-y-0"
    leaveTo="opacity-0 translate-y-1"
  >
    <HeadlessPopover.Panel
      ref={ref}
      className={cn(
        'absolute z-50 w-72 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-md outline-none',
        align === 'start' && 'left-0',
        align === 'center' && 'left-1/2 -translate-x-1/2',
        align === 'end' && 'right-0',
        className
      )}
      style={{ marginTop: sideOffset }}
      {...props}
    >
      {children}
    </HeadlessPopover.Panel>
  </Transition>
));
PopoverContent.displayName = 'PopoverContent';

export { Popover, PopoverTrigger, PopoverContent };
