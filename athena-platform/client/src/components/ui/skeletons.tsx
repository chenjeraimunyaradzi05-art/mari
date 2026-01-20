'use client';

/**
 * Skeleton Loading States - High-fidelity loading placeholders
 * Phase 3: Web Client - Super App Core
 */

import React from 'react';
import { cn } from '@/lib/utils';

// Base Skeleton Component
interface SkeletonProps {
  className?: string;
  animate?: boolean;
}

export function Skeleton({ className, animate = true }: SkeletonProps) {
  return (
    <div
      className={cn(
        'bg-zinc-200 dark:bg-zinc-800 rounded',
        animate && 'animate-pulse',
        className
      )}
    />
  );
}

// Video Feed Skeleton
export function VideoFeedSkeleton() {
  return (
    <div className="h-screen w-full flex flex-col bg-black">
      <div className="flex-1 relative">
        {/* Video placeholder */}
        <Skeleton className="absolute inset-0 rounded-none bg-zinc-900" />
        
        {/* Right side interaction buttons */}
        <div className="absolute right-4 bottom-20 flex flex-col items-center gap-6">
          <Skeleton className="w-12 h-12 rounded-full" />
          <div className="flex flex-col items-center gap-1">
            <Skeleton className="w-12 h-12 rounded-full" />
            <Skeleton className="w-8 h-3" />
          </div>
          <div className="flex flex-col items-center gap-1">
            <Skeleton className="w-12 h-12 rounded-full" />
            <Skeleton className="w-8 h-3" />
          </div>
          <div className="flex flex-col items-center gap-1">
            <Skeleton className="w-12 h-12 rounded-full" />
            <Skeleton className="w-8 h-3" />
          </div>
          <Skeleton className="w-12 h-12 rounded-full" />
        </div>

        {/* Bottom info */}
        <div className="absolute left-4 bottom-20 right-20">
          <div className="flex items-center gap-3 mb-3">
            <Skeleton className="w-10 h-10 rounded-full" />
            <Skeleton className="w-32 h-5" />
          </div>
          <Skeleton className="w-full h-4 mb-2" />
          <Skeleton className="w-3/4 h-4" />
        </div>
      </div>
    </div>
  );
}

// Chat List Skeleton
export function ChatListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-4">
          <Skeleton className="w-12 h-12 rounded-full shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="w-32 h-4" />
              <Skeleton className="w-12 h-3" />
            </div>
            <Skeleton className="w-48 h-3 mt-2" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Message Skeleton
export function MessageSkeleton({ isOwn = false }: { isOwn?: boolean }) {
  return (
    <div className={cn('flex gap-2', isOwn ? 'flex-row-reverse' : 'flex-row')}>
      {!isOwn && <Skeleton className="w-8 h-8 rounded-full shrink-0" />}
      <div className={cn('max-w-[70%]', isOwn && 'ml-auto')}>
        <Skeleton
          className={cn(
            'h-16 rounded-2xl',
            isOwn ? 'w-48 rounded-br-md' : 'w-56 rounded-bl-md'
          )}
        />
      </div>
    </div>
  );
}

export function MessageListSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <MessageSkeleton />
      <MessageSkeleton isOwn />
      <MessageSkeleton />
      <MessageSkeleton />
      <MessageSkeleton isOwn />
      <MessageSkeleton isOwn />
      <MessageSkeleton />
    </div>
  );
}

// Post/Card Skeleton
export function PostSkeleton() {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="flex-1">
          <Skeleton className="w-32 h-4 mb-1" />
          <Skeleton className="w-24 h-3" />
        </div>
        <Skeleton className="w-8 h-8 rounded-full" />
      </div>

      {/* Content */}
      <div className="space-y-2 mb-4">
        <Skeleton className="w-full h-4" />
        <Skeleton className="w-full h-4" />
        <Skeleton className="w-3/4 h-4" />
      </div>

      {/* Media */}
      <Skeleton className="w-full h-64 rounded-lg mb-4" />

      {/* Actions */}
      <div className="flex items-center gap-6 pt-3 border-t border-zinc-100 dark:border-zinc-800">
        <Skeleton className="w-16 h-4" />
        <Skeleton className="w-16 h-4" />
        <Skeleton className="w-16 h-4" />
      </div>
    </div>
  );
}

export function PostListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <PostSkeleton key={i} />
      ))}
    </div>
  );
}

// Profile Header Skeleton
export function ProfileHeaderSkeleton() {
  return (
    <div>
      {/* Cover */}
      <Skeleton className="h-48 md:h-64 w-full rounded-none" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative -mt-16 sm:-mt-20 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:gap-6">
            {/* Avatar */}
            <Skeleton className="w-32 h-32 sm:w-40 sm:h-40 rounded-full border-4 border-white dark:border-zinc-950 shrink-0" />

            <div className="flex-1 mt-4 sm:mt-0 sm:mb-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <Skeleton className="w-48 h-8 mb-2" />
                  <Skeleton className="w-64 h-5" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="w-24 h-10 rounded-md" />
                  <Skeleton className="w-24 h-10 rounded-md" />
                  <Skeleton className="w-10 h-10 rounded-md" />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col lg:flex-row gap-6">
            <div className="flex-1 space-y-4">
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                <Skeleton className="w-40 h-4" />
                <Skeleton className="w-32 h-4" />
                <Skeleton className="w-24 h-4" />
              </div>
              <Skeleton className="w-full h-16" />
              <div className="flex gap-6">
                <Skeleton className="w-24 h-6" />
                <Skeleton className="w-24 h-6" />
                <Skeleton className="w-24 h-6" />
              </div>
            </div>
            <div className="lg:w-80 space-y-4">
              <Skeleton className="w-full h-24 rounded-xl" />
              <Skeleton className="w-full h-24 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Job Card Skeleton
export function JobCardSkeleton() {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
      <div className="flex gap-4">
        <Skeleton className="w-14 h-14 rounded-lg shrink-0" />
        <div className="flex-1 min-w-0">
          <Skeleton className="w-48 h-5 mb-2" />
          <Skeleton className="w-32 h-4 mb-1" />
          <Skeleton className="w-40 h-3" />
        </div>
        <Skeleton className="w-8 h-8 rounded-full" />
      </div>
      <div className="flex flex-wrap gap-2 mt-4">
        <Skeleton className="w-16 h-6 rounded-full" />
        <Skeleton className="w-20 h-6 rounded-full" />
        <Skeleton className="w-24 h-6 rounded-full" />
      </div>
    </div>
  );
}

export function JobListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <JobCardSkeleton key={i} />
      ))}
    </div>
  );
}

// Course Card Skeleton
export function CourseCardSkeleton() {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      <Skeleton className="w-full h-40" />
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Skeleton className="w-6 h-6 rounded-full" />
          <Skeleton className="w-24 h-3" />
        </div>
        <Skeleton className="w-full h-5 mb-2" />
        <Skeleton className="w-3/4 h-4" />
        <div className="flex items-center justify-between mt-4">
          <Skeleton className="w-20 h-4" />
          <Skeleton className="w-16 h-4" />
        </div>
      </div>
    </div>
  );
}

export function CourseGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <CourseCardSkeleton key={i} />
      ))}
    </div>
  );
}

// Notification Skeleton
export function NotificationSkeleton() {
  return (
    <div className="flex items-start gap-3 p-4">
      <Skeleton className="w-10 h-10 rounded-full shrink-0" />
      <div className="flex-1">
        <Skeleton className="w-full h-4 mb-1" />
        <Skeleton className="w-3/4 h-3 mb-2" />
        <Skeleton className="w-16 h-3" />
      </div>
    </div>
  );
}

export function NotificationListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
      {Array.from({ length: count }).map((_, i) => (
        <NotificationSkeleton key={i} />
      ))}
    </div>
  );
}

// Search Result Skeleton
export function SearchResultSkeleton() {
  return (
    <div className="flex items-center gap-3 p-4">
      <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
      <div className="flex-1">
        <Skeleton className="w-40 h-4 mb-1" />
        <Skeleton className="w-56 h-3" />
      </div>
      <Skeleton className="w-16 h-6 rounded-full" />
    </div>
  );
}

export function SearchResultsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
      {Array.from({ length: count }).map((_, i) => (
        <SearchResultSkeleton key={i} />
      ))}
    </div>
  );
}

// Table Skeleton
export function TableSkeleton({
  rows = 5,
  columns = 4,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex gap-4 p-4 border-b border-zinc-200 dark:border-zinc-800">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="flex-1 h-4" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="flex gap-4 p-4 border-b border-zinc-100 dark:border-zinc-800/50"
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={colIndex} className="flex-1 h-4" />
          ))}
        </div>
      ))}
    </div>
  );
}

// Text Content Skeleton (for articles, etc.)
export function TextContentSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="w-3/4 h-8" />
      <div className="flex items-center gap-4">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div>
          <Skeleton className="w-32 h-4 mb-1" />
          <Skeleton className="w-24 h-3" />
        </div>
      </div>
      <Skeleton className="w-full h-64 rounded-lg" />
      <div className="space-y-3">
        <Skeleton className="w-full h-4" />
        <Skeleton className="w-full h-4" />
        <Skeleton className="w-full h-4" />
        <Skeleton className="w-3/4 h-4" />
      </div>
      <div className="space-y-3">
        <Skeleton className="w-full h-4" />
        <Skeleton className="w-full h-4" />
        <Skeleton className="w-1/2 h-4" />
      </div>
    </div>
  );
}

// Dashboard Card Skeleton
export function DashboardCardSkeleton() {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="w-24 h-4" />
        <Skeleton className="w-8 h-8 rounded" />
      </div>
      <Skeleton className="w-20 h-8 mb-2" />
      <Skeleton className="w-32 h-3" />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <DashboardCardSkeleton key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
          <Skeleton className="w-32 h-5 mb-4" />
          <Skeleton className="w-full h-64" />
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
          <Skeleton className="w-32 h-5 mb-4" />
          <Skeleton className="w-full h-64" />
        </div>
      </div>
    </div>
  );
}

export default Skeleton;
