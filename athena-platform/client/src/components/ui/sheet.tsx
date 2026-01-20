'use client';

import * as React from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

// Sheet context for managing state
const SheetContext = React.createContext<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
}>({
  open: false,
  onOpenChange: () => {},
});

// Root Sheet component
interface SheetProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

const Sheet = ({ open = false, onOpenChange, children }: SheetProps) => {
  const handleOpenChange = React.useCallback(
    (newOpen: boolean) => {
      onOpenChange?.(newOpen);
    },
    [onOpenChange]
  );

  return (
    <SheetContext.Provider value={{ open, onOpenChange: handleOpenChange }}>
      {children}
    </SheetContext.Provider>
  );
};

// SheetTrigger - button that opens the sheet
const SheetTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(({ className, children, asChild, onClick, ...props }, ref) => {
  const { onOpenChange } = React.useContext(SheetContext);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onOpenChange(true);
    onClick?.(e);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ ref?: React.Ref<HTMLElement>; onClick?: () => void }>, {
      onClick: handleClick,
      ref,
      ...props,
    } as React.Attributes & { ref?: React.Ref<HTMLElement>; onClick?: () => void });
  }

  return (
    <button ref={ref} className={className} onClick={handleClick} {...props}>
      {children}
    </button>
  );
});
SheetTrigger.displayName = 'SheetTrigger';

// SheetClose - button that closes the sheet
const SheetClose = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(({ className, children, asChild, onClick, ...props }, ref) => {
  const { onOpenChange } = React.useContext(SheetContext);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onOpenChange(false);
    onClick?.(e);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ ref?: React.Ref<HTMLElement>; onClick?: () => void }>, {
      onClick: handleClick,
      ref,
      ...props,
    } as React.Attributes & { ref?: React.Ref<HTMLElement>; onClick?: () => void });
  }

  return (
    <button ref={ref} className={className} onClick={handleClick} {...props}>
      {children}
    </button>
  );
});
SheetClose.displayName = 'SheetClose';

// SheetPortal - wrapper (not needed with Headless UI but kept for API compatibility)
const SheetPortal = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};

// SheetOverlay - backdrop
const SheetOverlay = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <Transition.Child
    as={React.Fragment}
    enter="ease-out duration-300"
    enterFrom="opacity-0"
    enterTo="opacity-100"
    leave="ease-in duration-200"
    leaveFrom="opacity-100"
    leaveTo="opacity-0"
  >
    <div
      ref={ref}
      className={cn('fixed inset-0 z-50 bg-black/80', className)}
      {...props}
    />
  </Transition.Child>
));
SheetOverlay.displayName = 'SheetOverlay';

// Sheet variants for different positions
const sheetVariants = cva(
  'fixed z-50 gap-4 bg-background p-6 shadow-lg transition ease-in-out',
  {
    variants: {
      side: {
        top: 'inset-x-0 top-0 border-b',
        bottom: 'inset-x-0 bottom-0 border-t',
        left: 'inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm',
        right: 'inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm',
      },
    },
    defaultVariants: {
      side: 'right',
    },
  }
);

// Animation variants based on side
const getAnimationClasses = (side: 'top' | 'bottom' | 'left' | 'right') => {
  switch (side) {
    case 'top':
      return {
        enter: 'duration-300',
        enterFrom: '-translate-y-full',
        enterTo: 'translate-y-0',
        leave: 'duration-200',
        leaveFrom: 'translate-y-0',
        leaveTo: '-translate-y-full',
      };
    case 'bottom':
      return {
        enter: 'duration-300',
        enterFrom: 'translate-y-full',
        enterTo: 'translate-y-0',
        leave: 'duration-200',
        leaveFrom: 'translate-y-0',
        leaveTo: 'translate-y-full',
      };
    case 'left':
      return {
        enter: 'duration-300',
        enterFrom: '-translate-x-full',
        enterTo: 'translate-x-0',
        leave: 'duration-200',
        leaveFrom: 'translate-x-0',
        leaveTo: '-translate-x-full',
      };
    case 'right':
    default:
      return {
        enter: 'duration-300',
        enterFrom: 'translate-x-full',
        enterTo: 'translate-x-0',
        leave: 'duration-200',
        leaveFrom: 'translate-x-0',
        leaveTo: 'translate-x-full',
      };
  }
};

// SheetContent - main content container
interface SheetContentProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof sheetVariants> {}

const SheetContent = React.forwardRef<HTMLDivElement, SheetContentProps>(
  ({ side = 'right', className, children, ...props }, ref) => {
    const { open, onOpenChange } = React.useContext(SheetContext);
    const animationClasses = getAnimationClasses(side || 'right');

    return (
      <Transition appear show={open} as={React.Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => onOpenChange(false)}>
          <SheetOverlay />
          <Transition.Child
            as={React.Fragment}
            enter={animationClasses.enter}
            enterFrom={animationClasses.enterFrom}
            enterTo={animationClasses.enterTo}
            leave={animationClasses.leave}
            leaveFrom={animationClasses.leaveFrom}
            leaveTo={animationClasses.leaveTo}
          >
            <Dialog.Panel
              ref={ref}
              className={cn(sheetVariants({ side }), className)}
              {...props}
            >
              {children}
              <button
                className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </button>
            </Dialog.Panel>
          </Transition.Child>
        </Dialog>
      </Transition>
    );
  }
);
SheetContent.displayName = 'SheetContent';

// SheetHeader
const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col space-y-2 text-center sm:text-left',
      className
    )}
    {...props}
  />
);
SheetHeader.displayName = 'SheetHeader';

// SheetFooter
const SheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2',
      className
    )}
    {...props}
  />
);
SheetFooter.displayName = 'SheetFooter';

// SheetTitle
const SheetTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <Dialog.Title
    ref={ref}
    className={cn('text-lg font-semibold text-foreground', className)}
    {...props}
  />
));
SheetTitle.displayName = 'SheetTitle';

// SheetDescription
const SheetDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <Dialog.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
SheetDescription.displayName = 'SheetDescription';

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
