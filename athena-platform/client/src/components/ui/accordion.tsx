'use client';

import * as React from 'react';
import { Disclosure } from '@headlessui/react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AccordionProps {
  type?: 'single' | 'multiple';
  collapsible?: boolean;
  defaultValue?: string | string[];
  children: React.ReactNode;
  className?: string;
}

interface AccordionContextValue {
  type: 'single' | 'multiple';
  openItems: string[];
  toggleItem: (value: string) => void;
}

const AccordionContext = React.createContext<AccordionContextValue | null>(null);

function useAccordion() {
  const context = React.useContext(AccordionContext);
  if (!context) {
    throw new Error('Accordion components must be used within an Accordion');
  }
  return context;
}

function Accordion({
  type = 'single',
  collapsible = true,
  defaultValue,
  children,
  className,
}: AccordionProps) {
  const [openItems, setOpenItems] = React.useState<string[]>(() => {
    if (!defaultValue) return [];
    return Array.isArray(defaultValue) ? defaultValue : [defaultValue];
  });

  const toggleItem = React.useCallback((value: string) => {
    setOpenItems((current) => {
      if (type === 'single') {
        if (current.includes(value) && collapsible) {
          return [];
        }
        return [value];
      }
      if (current.includes(value)) {
        return current.filter((v) => v !== value);
      }
      return [...current, value];
    });
  }, [type, collapsible]);

  return (
    <AccordionContext.Provider value={{ type, openItems, toggleItem }}>
      <div className={cn('space-y-2', className)}>{children}</div>
    </AccordionContext.Provider>
  );
}

interface AccordionItemProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

const AccordionItemContext = React.createContext<{ value: string; isOpen: boolean } | null>(null);

function AccordionItem({ value, children, className }: AccordionItemProps) {
  const { openItems } = useAccordion();
  const isOpen = openItems.includes(value);

  return (
    <AccordionItemContext.Provider value={{ value, isOpen }}>
      <div className={cn('border rounded-lg', className)}>{children}</div>
    </AccordionItemContext.Provider>
  );
}

interface AccordionTriggerProps {
  children: React.ReactNode;
  className?: string;
}

function AccordionTrigger({ children, className }: AccordionTriggerProps) {
  const { toggleItem } = useAccordion();
  const itemContext = React.useContext(AccordionItemContext);
  
  if (!itemContext) {
    throw new Error('AccordionTrigger must be used within an AccordionItem');
  }

  const { value, isOpen } = itemContext;

  return (
    <button
      type="button"
      onClick={() => toggleItem(value)}
      className={cn(
        'flex w-full items-center justify-between px-4 py-4 font-medium transition-all hover:underline',
        className
      )}
    >
      {children}
      <ChevronDown
        className={cn(
          'h-4 w-4 shrink-0 transition-transform duration-200',
          isOpen && 'rotate-180'
        )}
      />
    </button>
  );
}

interface AccordionContentProps {
  children: React.ReactNode;
  className?: string;
}

function AccordionContent({ children, className }: AccordionContentProps) {
  const itemContext = React.useContext(AccordionItemContext);
  
  if (!itemContext) {
    throw new Error('AccordionContent must be used within an AccordionItem');
  }

  const { isOpen } = itemContext;

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        'overflow-hidden px-4 pb-4 pt-0 text-sm',
        className
      )}
    >
      {children}
    </div>
  );
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
