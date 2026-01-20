'use client';

import * as React from 'react';
import { Listbox, Transition } from '@headlessui/react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

// Context for sharing state between Select components
const SelectContext = React.createContext<{
  value?: string;
  onValueChange?: (value: string) => void;
}>({});

// Root Select component - now accepts generic onValueChange
interface SelectProps<T extends string = string> {
  value?: T;
  onValueChange?: (value: T) => void;
  defaultValue?: T;
  children: React.ReactNode;
  disabled?: boolean;
}

function Select<T extends string = string>({
  value,
  onValueChange,
  defaultValue,
  children,
  disabled,
}: SelectProps<T>) {
  const [internalValue, setInternalValue] = React.useState<string>(defaultValue ?? '');
  const currentValue = (value ?? internalValue) as string;
  
  const handleChange = (newValue: string) => {
    setInternalValue(newValue);
    onValueChange?.(newValue as T);
  };

  return (
    <SelectContext.Provider value={{ value: currentValue, onValueChange: handleChange }}>
      <Listbox value={currentValue} onChange={handleChange} disabled={disabled}>
        <div className="relative">
          {children}
        </div>
      </Listbox>
    </SelectContext.Provider>
  );
}

// SelectGroup - wrapper for grouped items
const SelectGroup = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => <div className={cn('p-1', className)}>{children}</div>;

// SelectValue - displays the selected value
const SelectValue = ({
  placeholder,
  className,
}: {
  placeholder?: string;
  className?: string;
}) => {
  const { value } = React.useContext(SelectContext);
  return (
    <span className={cn('block truncate', className)}>
      {value || placeholder}
    </span>
  );
};

// SelectTrigger - button that opens the select
const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(({ className, children, asChild, ...props }, ref) => (
  <Listbox.Button
    ref={ref}
    className={cn(
      'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...props}
  >
    {children}
    <ChevronDown className="h-4 w-4 opacity-50" />
  </Listbox.Button>
));
SelectTrigger.displayName = 'SelectTrigger';

// SelectContent - dropdown content
const SelectContent = React.forwardRef<
  HTMLUListElement,
  React.HTMLAttributes<HTMLUListElement> & {
    position?: 'popper' | 'item-aligned';
  }
>(({ className, children, position = 'popper', ...props }, ref) => (
  <Transition
    as={React.Fragment}
    leave="transition ease-in duration-100"
    leaveFrom="opacity-100"
    leaveTo="opacity-0"
  >
    <Listbox.Options
      ref={ref}
      className={cn(
        'absolute z-50 mt-1 max-h-60 min-w-[8rem] w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
        'focus:outline-none',
        position === 'popper' && 'translate-y-1',
        className
      )}
      {...props}
    >
      {children}
    </Listbox.Options>
  </Transition>
));
SelectContent.displayName = 'SelectContent';

// SelectLabel - label for a group
const SelectLabel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('py-1.5 pl-8 pr-2 text-sm font-semibold', className)}
    {...props}
  />
));
SelectLabel.displayName = 'SelectLabel';

// SelectItem - individual option
const SelectItem = React.forwardRef<
  HTMLLIElement,
  React.LiHTMLAttributes<HTMLLIElement> & { value: string; disabled?: boolean }
>(({ className, children, value, disabled, ...props }, ref) => (
  <Listbox.Option
    ref={ref}
    value={value}
    disabled={disabled}
    className={({ active, selected }) =>
      cn(
        'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none',
        active && 'bg-accent text-accent-foreground',
        disabled && 'pointer-events-none opacity-50',
        className
      )
    }
    {...props}
  >
    {({ selected }) => (
      <>
        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
          {selected && <Check className="h-4 w-4" />}
        </span>
        <span className={cn('block truncate', selected && 'font-medium')}>
          {children}
        </span>
      </>
    )}
  </Listbox.Option>
));
SelectItem.displayName = 'SelectItem';

// SelectSeparator - divider between items
const SelectSeparator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('-mx-1 my-1 h-px bg-muted', className)}
    {...props}
  />
));
SelectSeparator.displayName = 'SelectSeparator';

// SelectScrollUpButton / SelectScrollDownButton - for scrollable content
const SelectScrollUpButton = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'flex cursor-default items-center justify-center py-1',
      className
    )}
    {...props}
  >
    <ChevronDown className="h-4 w-4 rotate-180" />
  </div>
));
SelectScrollUpButton.displayName = 'SelectScrollUpButton';

const SelectScrollDownButton = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'flex cursor-default items-center justify-center py-1',
      className
    )}
    {...props}
  >
    <ChevronDown className="h-4 w-4" />
  </div>
));
SelectScrollDownButton.displayName = 'SelectScrollDownButton';

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
};
