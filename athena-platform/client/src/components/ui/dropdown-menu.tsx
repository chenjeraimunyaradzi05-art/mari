'use client';

import * as React from 'react';
import { Menu, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { cn } from '@/lib/utils';

const DropdownMenu = Menu;

interface DropdownMenuTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  children: React.ReactNode;
}

const DropdownMenuTrigger = React.forwardRef<HTMLButtonElement, DropdownMenuTriggerProps>(
  ({ asChild, children, className, onClick, ...props }, ref) => {
    if (asChild && React.isValidElement(children)) {
      return (
        <Menu.Button as={Fragment}>
          {({ open }) => 
            React.cloneElement(children as React.ReactElement<{ ref?: React.Ref<HTMLButtonElement>; 'data-state'?: string; onClick?: React.MouseEventHandler }>, {
              ref,
              'data-state': open ? 'open' : 'closed',
              onClick,
            })
          }
        </Menu.Button>
      );
    }
    
    return (
      <Menu.Button ref={ref} className={className} onClick={onClick} {...props}>
        {children}
      </Menu.Button>
    );
  }
);
DropdownMenuTrigger.displayName = 'DropdownMenuTrigger';

const DropdownMenuContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { 
    align?: 'start' | 'center' | 'end';
    side?: 'top' | 'right' | 'bottom' | 'left';
    sideOffset?: number;
  }
>(({ className, align = 'end', side = 'bottom', sideOffset = 4, children, ...props }, ref) => (
  <Transition
    as={Fragment}
    enter="transition ease-out duration-100"
    enterFrom="transform opacity-0 scale-95"
    enterTo="transform opacity-100 scale-100"
    leave="transition ease-in duration-75"
    leaveFrom="transform opacity-100 scale-100"
    leaveTo="transform opacity-0 scale-95"
  >
    <Menu.Items
      ref={ref}
      className={cn(
        'absolute z-50 min-w-[8rem] overflow-hidden rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-1 shadow-md',
        align === 'start' && 'left-0',
        align === 'center' && 'left-1/2 -translate-x-1/2',
        align === 'end' && 'right-0',
        side === 'top' && 'bottom-full mb-1',
        side === 'bottom' && 'top-full mt-1',
        side === 'left' && 'right-full mr-1',
        side === 'right' && 'left-full ml-1',
        className
      )}
      style={{ marginTop: side === 'bottom' ? sideOffset : undefined, marginBottom: side === 'top' ? sideOffset : undefined }}
      {...props}
    >
      {children}
    </Menu.Items>
  </Transition>
));
DropdownMenuContent.displayName = 'DropdownMenuContent';

interface DropdownMenuItemProps extends React.HTMLAttributes<HTMLDivElement> {
  disabled?: boolean;
  inset?: boolean;
}

const DropdownMenuItem = React.forwardRef<HTMLDivElement, DropdownMenuItemProps>(
  ({ className, disabled, inset, children, onClick, ...props }, ref) => (
    <Menu.Item disabled={disabled}>
      {({ active }) => (
        <div
          ref={ref}
          className={cn(
            'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors',
            active && 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100',
            disabled && 'pointer-events-none opacity-50',
            inset && 'pl-8',
            className
          )}
          onClick={onClick}
          {...props}
        >
          {children}
        </div>
      )}
    </Menu.Item>
  )
);
DropdownMenuItem.displayName = 'DropdownMenuItem';

const DropdownMenuSeparator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('-mx-1 my-1 h-px bg-gray-200 dark:bg-gray-700', className)}
    {...props}
  />
));
DropdownMenuSeparator.displayName = 'DropdownMenuSeparator';

const DropdownMenuLabel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { inset?: boolean }
>(({ className, inset, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'px-2 py-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100',
      inset && 'pl-8',
      className
    )}
    {...props}
  />
));
DropdownMenuLabel.displayName = 'DropdownMenuLabel';

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
};
