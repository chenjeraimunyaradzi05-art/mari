'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { X, AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react';

interface InlineAlertProps {
  tone?: 'success' | 'error' | 'info';
  children: ReactNode;
  onDismiss?: () => void;
  className?: string;
}

const toneStyles = {
  success: 'border-green-100 bg-green-50 text-green-700',
  error: 'border-red-100 bg-red-50 text-red-700',
  info: 'border-blue-100 bg-blue-50 text-blue-700',
};

export function InlineAlert({ tone = 'info', children, onDismiss, className }: InlineAlertProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-xl border px-4 py-3 text-sm',
        toneStyles[tone],
        className
      )}
    >
      <span>{children}</span>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="ml-3">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

// Standard Alert component (shadcn-style)
interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'destructive' | 'success' | 'warning';
}

const alertVariants = {
  default: 'bg-background text-foreground border',
  destructive: 'border-destructive/50 text-destructive dark:border-destructive bg-destructive/10',
  success: 'border-green-500/50 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20',
  warning: 'border-yellow-500/50 text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20',
};

function Alert({ className, variant = 'default', ...props }: AlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        'relative w-full rounded-lg border p-4',
        '[&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground',
        alertVariants[variant],
        className
      )}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h5
      className={cn('mb-1 font-medium leading-none tracking-tight', className)}
      {...props}
    />
  );
}

function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <div
      className={cn('text-sm [&_p]:leading-relaxed', className)}
      {...props}
    />
  );
}

export { Alert, AlertTitle, AlertDescription };
