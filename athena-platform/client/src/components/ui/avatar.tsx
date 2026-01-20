import * as React from 'react';
import { cn } from '@/lib/utils';

interface AvatarProps {
  src?: string | null;
  alt?: string;
  fallback?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  online?: boolean;
  children?: React.ReactNode;
}

const sizeClasses = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-12 h-12 text-lg',
  xl: 'w-16 h-16 text-xl',
};

const onlineIndicatorClasses = {
  xs: 'w-1.5 h-1.5 border',
  sm: 'w-2 h-2 border',
  md: 'w-2.5 h-2.5 border-2',
  lg: 'w-3 h-3 border-2',
  xl: 'w-4 h-4 border-2',
};

// Compound component pattern - Avatar as container
const Avatar = React.forwardRef<
  HTMLDivElement,
  AvatarProps & React.HTMLAttributes<HTMLDivElement>
>(({ src, alt = 'Avatar', fallback = '?', size = 'md', className, online, children, ...props }, ref) => {
  // If children are provided, use compound pattern
  if (children) {
    return (
      <div
        ref={ref}
        className={cn(
          'relative flex shrink-0 overflow-hidden rounded-full',
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {children}
        {online !== undefined && (
          <span
            className={cn(
              'absolute bottom-0 right-0 rounded-full border-white dark:border-gray-900',
              online ? 'bg-green-500' : 'bg-gray-400',
              onlineIndicatorClasses[size]
            )}
          />
        )}
      </div>
    );
  }

  // Legacy single-component pattern
  return (
    <div ref={ref} className={cn('relative inline-block', className)} {...props}>
      {src ? (
        <img
          src={src}
          alt={alt}
          className={cn(
            'rounded-full object-cover',
            sizeClasses[size]
          )}
        />
      ) : (
        <div
          className={cn(
            'rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-primary-600 font-semibold',
            sizeClasses[size]
          )}
        >
          {fallback}
        </div>
      )}
      {online !== undefined && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full border-white dark:border-gray-900',
            online ? 'bg-green-500' : 'bg-gray-400',
            onlineIndicatorClasses[size]
          )}
        />
      )}
    </div>
  );
});
Avatar.displayName = 'Avatar';

// AvatarImage component for compound pattern
interface AvatarImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  onLoadingStatusChange?: (status: 'loading' | 'loaded' | 'error') => void;
}

const AvatarImage = React.forwardRef<HTMLImageElement, AvatarImageProps>(
  ({ className, src, alt, onLoadingStatusChange, ...props }, ref) => {
    const [status, setStatus] = React.useState<'loading' | 'loaded' | 'error'>('loading');

    React.useEffect(() => {
      if (!src) {
        setStatus('error');
        return;
      }
      setStatus('loading');
    }, [src]);

    const handleLoad = () => {
      setStatus('loaded');
      onLoadingStatusChange?.('loaded');
    };

    const handleError = () => {
      setStatus('error');
      onLoadingStatusChange?.('error');
    };

    if (status === 'error' || !src) {
      return null;
    }

    return (
      <img
        ref={ref}
        src={src}
        alt={alt}
        onLoad={handleLoad}
        onError={handleError}
        className={cn('aspect-square h-full w-full object-cover', className)}
        {...props}
      />
    );
  }
);
AvatarImage.displayName = 'AvatarImage';

// AvatarFallback component for compound pattern
interface AvatarFallbackProps extends React.HTMLAttributes<HTMLSpanElement> {
  delayMs?: number;
}

const AvatarFallback = React.forwardRef<HTMLSpanElement, AvatarFallbackProps>(
  ({ className, children, delayMs, ...props }, ref) => {
    const [canRender, setCanRender] = React.useState(delayMs === undefined);

    React.useEffect(() => {
      if (delayMs !== undefined) {
        const timer = setTimeout(() => setCanRender(true), delayMs);
        return () => clearTimeout(timer);
      }
    }, [delayMs]);

    if (!canRender) {
      return null;
    }

    return (
      <span
        ref={ref}
        className={cn(
          'flex h-full w-full items-center justify-center rounded-full bg-muted bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-medium',
          className
        )}
        {...props}
      >
        {children}
      </span>
    );
  }
);
AvatarFallback.displayName = 'AvatarFallback';

interface AvatarGroupProps {
  children: React.ReactNode;
  max?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

function AvatarGroup({ children, max = 4, size = 'md' }: AvatarGroupProps) {
  const childArray = Array.isArray(children) ? children : [children];
  const visibleAvatars = childArray.slice(0, max);
  const remainingCount = childArray.length - max;

  return (
    <div className="flex -space-x-2">
      {visibleAvatars.map((child, index) => (
        <div
          key={index}
          className="relative rounded-full ring-2 ring-white dark:ring-gray-900"
        >
          {child}
        </div>
      ))}
      {remainingCount > 0 && (
        <div
          className={cn(
            'relative rounded-full ring-2 ring-white dark:ring-gray-900 bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 font-medium',
            sizeClasses[size]
          )}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  );
}

export { Avatar, AvatarImage, AvatarFallback, AvatarGroup };
