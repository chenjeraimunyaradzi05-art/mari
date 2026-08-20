/**
 * ATHENA - Shared page layout primitives
 *
 * These encode the visual system already used by the home page
 * (src/components/home/HomepageLanding.tsx) so every other page can adopt it
 * without copying class strings around.
 *
 * The home page establishes:
 *   - a slate-based surface (slate-50 / slate-950), not the gray palette that
 *     had drifted into most other pages
 *   - a max-w-7xl container with px-4 sm:px-6 lg:px-8 gutters
 *   - full-bleed sections that carry their own tone (gradient, inverted, aurora)
 *
 * Usage:
 *   <PageShell>
 *     <PageSection tone="aurora">
 *       <PageContainer>
 *         <PageHeader title="Jobs" description="Roles matched to your profile" />
 *       </PageContainer>
 *     </PageSection>
 *   </PageShell>
 */

import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

// ============================================================================
// PageShell - page root
// ============================================================================

export interface PageShellProps {
  children: ReactNode;
  className?: string;
  /** Centres content vertically - for auth screens, 404s and other short pages. */
  centered?: boolean;
}

/**
 * Page root. Owns the full-height surface and base text colour so individual
 * pages stop declaring their own (and drifting apart while doing it).
 */
export function PageShell({ children, className, centered = false }: PageShellProps) {
  return (
    <div
      className={cn(
        'min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white',
        centered && 'flex items-center justify-center px-4',
        className
      )}
    >
      {children}
    </div>
  );
}

// ============================================================================
// PageContainer - horizontal rhythm
// ============================================================================

const CONTAINER_WIDTHS = {
  narrow: 'max-w-3xl',
  content: 'max-w-5xl',
  default: 'max-w-7xl',
  wide: 'max-w-[90rem]',
} as const;

const CONTAINER_PADDING = {
  none: '',
  tight: 'py-6',
  default: 'py-10',
  loose: 'py-14',
} as const;

export interface PageContainerProps {
  children: ReactNode;
  className?: string;
  width?: keyof typeof CONTAINER_WIDTHS;
  padding?: keyof typeof CONTAINER_PADDING;
}

/** Centred content column matching the home page's gutters at every breakpoint. */
export function PageContainer({
  children,
  className,
  width = 'default',
  padding = 'default',
}: PageContainerProps) {
  return (
    <div
      className={cn(
        'mx-auto w-full px-4 sm:px-6 lg:px-8',
        CONTAINER_WIDTHS[width],
        CONTAINER_PADDING[padding],
        className
      )}
    >
      {children}
    </div>
  );
}

// ============================================================================
// PageSection - full-bleed bands
// ============================================================================

const SECTION_TONES = {
  /** Inherits the shell surface. */
  default: '',
  /** Slightly raised panel, for alternating bands. */
  subtle: 'bg-white dark:bg-slate-900/50',
  /** The home page's rose-tinted gradient band. */
  gradient:
    'border-y border-slate-900/10 bg-gradient-to-b from-white via-rose-50/40 to-white dark:border-white/10 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950',
  /** Inverted band used for high-emphasis calls to action. */
  inverted: 'border-y border-slate-900 bg-slate-950 text-white',
  /** Aurora hero wash - defined as .bg-aurora in globals.css. */
  aurora: 'bg-aurora',
} as const;

export interface PageSectionProps {
  children: ReactNode;
  className?: string;
  tone?: keyof typeof SECTION_TONES;
  /** Renders as <section> by default; pass "div" for nested use. */
  as?: 'section' | 'div';
}

/** Full-bleed band. Put a PageContainer inside it to constrain the content. */
export function PageSection({
  children,
  className,
  tone = 'default',
  as: Tag = 'section',
}: PageSectionProps) {
  return (
    <Tag className={cn('relative overflow-hidden', SECTION_TONES[tone], className)}>
      {children}
    </Tag>
  );
}

// ============================================================================
// PageHeader - title block
// ============================================================================

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Small label above the title, e.g. a breadcrumb or category. */
  eyebrow?: ReactNode;
  /** Buttons or controls, right-aligned on wide screens. */
  actions?: ReactNode;
  className?: string;
}

/**
 * Page title block using the shared .section-title / .section-subtitle classes,
 * so headings stay identical across pages.
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between',
        className
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-xs font-medium uppercase tracking-wide text-rose-600 dark:text-rose-400">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="section-title">{title}</h1>
        {description ? <p className="section-subtitle">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
