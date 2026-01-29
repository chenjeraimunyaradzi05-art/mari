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

// Creator Studio Upload Skeleton
export function CreatorUploadSkeleton() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Video Preview Area */}
        <div className="bg-black rounded-xl overflow-hidden aspect-[9/16] max-h-[600px]">
          <div className="w-full h-full flex items-center justify-center">
            <Skeleton className="w-20 h-20 rounded-full" animate />
          </div>
        </div>

        {/* Edit Panel */}
        <div className="space-y-6">
          <div className="flex gap-2">
            <Skeleton className="flex-1 h-10 rounded-lg" />
            <Skeleton className="flex-1 h-10 rounded-lg" />
            <Skeleton className="flex-1 h-10 rounded-lg" />
          </div>
          <div className="space-y-4">
            <Skeleton className="w-32 h-5" />
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[9/16] rounded-lg" />
              ))}
            </div>
            <Skeleton className="w-full h-10 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Media Gallery Skeleton
export function MediaGallerySkeleton({ count = 9 }: { count?: number }) {
  return (
    <div className="grid grid-cols-3 gap-1">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="aspect-square" />
      ))}
    </div>
  );
}

// Story Carousel Skeleton
export function StoryCarouselSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="flex gap-4 overflow-x-auto py-4 px-2 scrollbar-hide">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-2 shrink-0">
          <Skeleton className="w-16 h-16 rounded-full ring-2 ring-offset-2 ring-zinc-200 dark:ring-zinc-700" />
          <Skeleton className="w-14 h-3" />
        </div>
      ))}
    </div>
  );
}

// Mentor Card Skeleton
export function MentorCardSkeleton() {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
      <div className="flex items-start gap-4">
        <Skeleton className="w-16 h-16 rounded-full shrink-0" />
        <div className="flex-1 min-w-0">
          <Skeleton className="w-32 h-5 mb-1" />
          <Skeleton className="w-48 h-4 mb-2" />
          <div className="flex items-center gap-2">
            <Skeleton className="w-16 h-4" />
            <Skeleton className="w-20 h-4" />
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mt-4">
        <Skeleton className="w-16 h-6 rounded-full" />
        <Skeleton className="w-20 h-6 rounded-full" />
        <Skeleton className="w-14 h-6 rounded-full" />
      </div>
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
        <Skeleton className="w-24 h-5" />
        <Skeleton className="w-20 h-9 rounded-lg" />
      </div>
    </div>
  );
}

// Comment Skeleton
export function CommentSkeleton({ depth = 0 }: { depth?: number }) {
  return (
    <div className={cn('flex gap-3', depth > 0 && 'ml-10')}>
      <Skeleton className="w-8 h-8 rounded-full shrink-0" />
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <Skeleton className="w-24 h-4" />
          <Skeleton className="w-16 h-3" />
        </div>
        <Skeleton className="w-full h-4 mb-1" />
        <Skeleton className="w-3/4 h-4 mb-2" />
        <div className="flex items-center gap-4">
          <Skeleton className="w-12 h-4" />
          <Skeleton className="w-12 h-4" />
        </div>
      </div>
    </div>
  );
}

export function CommentListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <CommentSkeleton key={i} depth={i % 3 === 2 ? 1 : 0} />
      ))}
    </div>
  );
}

// Activity Feed Skeleton
export function ActivityFeedSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <div className="flex flex-col items-center">
            <Skeleton className="w-10 h-10 rounded-full" />
            {i < count - 1 && <Skeleton className="w-0.5 flex-1 mt-2" />}
          </div>
          <div className="flex-1 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <Skeleton className="w-24 h-4" />
              <Skeleton className="w-32 h-3" />
            </div>
            <Skeleton className="w-full h-4 mb-1" />
            <Skeleton className="w-2/3 h-4" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Super App Navigation Skeleton
export function SuperAppNavSkeleton() {
  return (
    <div className="h-screen flex">
      {/* Sidebar */}
      <div className="w-64 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 p-4">
        {/* Logo */}
        <Skeleton className="w-32 h-8 mb-8" />
        
        {/* Mode Switcher */}
        <Skeleton className="w-full h-10 rounded-lg mb-6" />
        
        {/* Nav Items */}
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="w-full h-10 rounded-lg" />
          ))}
        </div>
        
        {/* User Profile */}
        <div className="absolute bottom-4 left-4 right-4 flex items-center gap-3 p-3">
          <Skeleton className="w-10 h-10 rounded-full" />
          <div className="flex-1">
            <Skeleton className="w-24 h-4 mb-1" />
            <Skeleton className="w-16 h-3" />
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 p-6">
        <Skeleton className="w-48 h-8 mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

// Video Player Skeleton
export function VideoPlayerSkeleton() {
  return (
    <div className="relative bg-black rounded-xl overflow-hidden aspect-video">
      <Skeleton className="absolute inset-0 rounded-none bg-zinc-900" />
      
      {/* Play button */}
      <div className="absolute inset-0 flex items-center justify-center">
        <Skeleton className="w-16 h-16 rounded-full" />
      </div>
      
      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <Skeleton className="w-full h-1 rounded-full mb-3" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="w-8 h-8 rounded" />
            <Skeleton className="w-8 h-8 rounded" />
            <Skeleton className="w-16 h-4" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="w-8 h-8 rounded" />
            <Skeleton className="w-8 h-8 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Connection Card Skeleton
export function ConnectionCardSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
      <Skeleton className="w-14 h-14 rounded-full shrink-0" />
      <div className="flex-1 min-w-0">
        <Skeleton className="w-32 h-5 mb-1" />
        <Skeleton className="w-48 h-4 mb-1" />
        <Skeleton className="w-24 h-3" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="w-20 h-9 rounded-lg" />
        <Skeleton className="w-20 h-9 rounded-lg" />
      </div>
    </div>
  );
}

export function ConnectionListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <ConnectionCardSkeleton key={i} />
      ))}
    </div>
  );
}

// ============================================
// PHASE 4: PERSONA STUDIOS SKELETONS
// ============================================

// Formation Dashboard Skeleton
export function FormationDashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="w-64 h-8 mb-2" />
          <Skeleton className="w-48 h-4" />
        </div>
        <Skeleton className="w-32 h-10 rounded-lg" />
      </div>

      {/* Business Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            <Skeleton className="w-16 h-16 rounded-lg" />
            <div>
              <Skeleton className="w-48 h-6 mb-2" />
              <Skeleton className="w-32 h-4" />
            </div>
          </div>
          <Skeleton className="w-24 h-8 rounded-full" />
        </div>
        
        {/* Progress */}
        <Skeleton className="w-full h-2 rounded-full mb-4" />
        <div className="flex justify-between">
          <Skeleton className="w-24 h-4" />
          <Skeleton className="w-16 h-4" />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
            <div className="flex items-center gap-3 mb-3">
              <Skeleton className="w-10 h-10 rounded-lg" />
              <Skeleton className="w-24 h-4" />
            </div>
            <Skeleton className="w-16 h-8" />
          </div>
        ))}
      </div>

      {/* Compliance & Co-founders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
          <Skeleton className="w-40 h-6 mb-4" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-3 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
              <Skeleton className="w-5 h-5 rounded" />
              <div className="flex-1">
                <Skeleton className="w-48 h-4 mb-1" />
                <Skeleton className="w-32 h-3" />
              </div>
              <Skeleton className="w-16 h-6 rounded-full" />
            </div>
          ))}
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
          <Skeleton className="w-40 h-6 mb-4" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-3">
              <Skeleton className="w-12 h-12 rounded-full" />
              <div className="flex-1">
                <Skeleton className="w-32 h-4 mb-1" />
                <Skeleton className="w-48 h-3" />
              </div>
              <Skeleton className="w-20 h-8 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Mentor Calendar Skeleton
export function MentorCalendarSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="w-8 h-8 rounded" />
          <Skeleton className="w-48 h-8" />
          <Skeleton className="w-8 h-8 rounded" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="w-24 h-10 rounded-lg" />
          <Skeleton className="w-24 h-10 rounded-lg" />
          <Skeleton className="w-24 h-10 rounded-lg" />
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        {/* Day Headers */}
        <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-zinc-800">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="p-3 text-center">
              <Skeleton className="w-12 h-4 mx-auto" />
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        {Array.from({ length: 5 }).map((_, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
            {Array.from({ length: 7 }).map((_, dayIndex) => (
              <div key={dayIndex} className="min-h-[100px] p-2 border-r border-zinc-100 dark:border-zinc-800 last:border-0">
                <Skeleton className="w-6 h-6 mb-2" />
                {(weekIndex * 7 + dayIndex) % 3 === 0 && (
                  <Skeleton className="w-full h-6 rounded mb-1" />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// Session Card Skeleton
export function SessionCardSkeleton() {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
      <div className="flex items-start gap-4">
        <Skeleton className="w-12 h-12 rounded-full shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <Skeleton className="w-32 h-5" />
            <Skeleton className="w-16 h-6 rounded-full" />
          </div>
          <Skeleton className="w-48 h-4 mb-2" />
          <div className="flex items-center gap-4">
            <Skeleton className="w-20 h-4" />
            <Skeleton className="w-24 h-4" />
          </div>
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <Skeleton className="flex-1 h-9 rounded-lg" />
        <Skeleton className="flex-1 h-9 rounded-lg" />
      </div>
    </div>
  );
}

export function SessionListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SessionCardSkeleton key={i} />
      ))}
    </div>
  );
}

// Kanban Board Skeleton
export function KanbanBoardSkeleton() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {Array.from({ length: 6 }).map((_, colIndex) => (
        <div key={colIndex} className="w-80 shrink-0">
          {/* Column Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Skeleton className="w-3 h-3 rounded-full" />
              <Skeleton className="w-24 h-5" />
              <Skeleton className="w-6 h-5 rounded-full" />
            </div>
            <Skeleton className="w-6 h-6 rounded" />
          </div>

          {/* Candidate Cards */}
          <div className="space-y-3">
            {Array.from({ length: Math.floor(Math.random() * 3) + 1 }).map((_, cardIndex) => (
              <div key={cardIndex} className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
                <div className="flex items-start gap-3 mb-3">
                  <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                  <div className="flex-1">
                    <Skeleton className="w-32 h-4 mb-1" />
                    <Skeleton className="w-40 h-3" />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  <Skeleton className="w-16 h-5 rounded-full" />
                  <Skeleton className="w-20 h-5 rounded-full" />
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-zinc-100 dark:border-zinc-800">
                  <Skeleton className="w-24 h-4" />
                  <Skeleton className="w-16 h-6 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Candidate Profile Skeleton
export function CandidateProfileSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-6">
        <Skeleton className="w-24 h-24 rounded-full shrink-0" />
        <div className="flex-1">
          <Skeleton className="w-48 h-8 mb-2" />
          <Skeleton className="w-64 h-5 mb-3" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="w-20 h-6 rounded-full" />
            <Skeleton className="w-24 h-6 rounded-full" />
            <Skeleton className="w-16 h-6 rounded-full" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="w-24 h-10 rounded-lg" />
          <Skeleton className="w-10 h-10 rounded-lg" />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4 text-center">
            <Skeleton className="w-12 h-8 mx-auto mb-1" />
            <Skeleton className="w-20 h-4 mx-auto" />
          </div>
        ))}
      </div>

      {/* Tabs Content */}
      <div className="space-y-4">
        <div className="flex gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="w-20 h-8" />
          ))}
        </div>

        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
              <div className="flex items-center gap-3 mb-2">
                <Skeleton className="w-10 h-10 rounded" />
                <div>
                  <Skeleton className="w-40 h-5 mb-1" />
                  <Skeleton className="w-32 h-4" />
                </div>
              </div>
              <Skeleton className="w-full h-12" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Earnings Dashboard Skeleton
export function EarningsDashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <Skeleton className="w-24 h-4" />
              <Skeleton className="w-10 h-10 rounded-lg" />
            </div>
            <Skeleton className="w-24 h-8 mb-2" />
            <div className="flex items-center gap-2">
              <Skeleton className="w-8 h-4" />
              <Skeleton className="w-16 h-4" />
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="w-32 h-6" />
          <div className="flex gap-2">
            <Skeleton className="w-20 h-8 rounded" />
            <Skeleton className="w-20 h-8 rounded" />
          </div>
        </div>
        <Skeleton className="w-full h-64" />
      </div>

      {/* Transactions */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="w-40 h-6" />
          <Skeleton className="w-24 h-8 rounded-lg" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between py-4 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
            <div className="flex items-center gap-4">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div>
                <Skeleton className="w-40 h-4 mb-1" />
                <Skeleton className="w-24 h-3" />
              </div>
            </div>
            <div className="text-right">
              <Skeleton className="w-20 h-5 mb-1" />
              <Skeleton className="w-16 h-3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Course Builder Skeleton
export function CourseBuilderSkeleton() {
  return (
    <div className="flex h-screen">
      {/* Sidebar - Modules */}
      <div className="w-80 border-r border-zinc-200 dark:border-zinc-800 p-4 space-y-4">
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="w-32 h-6" />
          <Skeleton className="w-8 h-8 rounded" />
        </div>
        {Array.from({ length: 4 }).map((_, moduleIndex) => (
          <div key={moduleIndex} className="space-y-2">
            <div className="flex items-center gap-2 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
              <Skeleton className="w-4 h-4" />
              <Skeleton className="flex-1 h-5" />
              <Skeleton className="w-4 h-4" />
            </div>
            {moduleIndex === 0 && (
              <div className="pl-6 space-y-2">
                {Array.from({ length: 3 }).map((_, lessonIndex) => (
                  <div key={lessonIndex} className="flex items-center gap-2 p-2">
                    <Skeleton className="w-5 h-5 rounded" />
                    <Skeleton className="flex-1 h-4" />
                    <Skeleton className="w-12 h-4" />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 overflow-auto">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="w-64 h-8 mb-2" />
              <Skeleton className="w-40 h-4" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="w-24 h-10 rounded-lg" />
              <Skeleton className="w-24 h-10 rounded-lg" />
            </div>
          </div>

          {/* Content Editor Area */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
            <Skeleton className="w-48 h-6 mb-4" />
            <Skeleton className="w-full h-40 mb-4" />
            <Skeleton className="w-full h-10" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Badge Wallet Skeleton
export function BadgeWalletSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="w-40 h-8 mb-2" />
          <Skeleton className="w-64 h-4" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="w-32 h-10 rounded-lg" />
          <Skeleton className="w-10 h-10 rounded-lg" />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 text-center">
            <Skeleton className="w-12 h-12 rounded-full mx-auto mb-2" />
            <Skeleton className="w-8 h-6 mx-auto mb-1" />
            <Skeleton className="w-16 h-4 mx-auto" />
          </div>
        ))}
      </div>

      {/* Badge Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 text-center">
            <Skeleton className="w-16 h-16 rounded-full mx-auto mb-4" />
            <Skeleton className="w-32 h-5 mx-auto mb-2" />
            <Skeleton className="w-24 h-4 mx-auto mb-3" />
            <div className="flex justify-center gap-2">
              <Skeleton className="w-16 h-6 rounded-full" />
              <Skeleton className="w-6 h-6 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Events Calendar Skeleton
export function EventsCalendarSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="w-48 h-8" />
          <div className="flex gap-1">
            <Skeleton className="w-8 h-8 rounded" />
            <Skeleton className="w-8 h-8 rounded" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="w-32 h-10 rounded-lg" />
          <Skeleton className="w-32 h-10 rounded-lg" />
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <Skeleton className="w-24 h-9 rounded-lg" />
        <Skeleton className="w-24 h-9 rounded-lg" />
        <Skeleton className="w-24 h-9 rounded-lg" />
      </div>

      {/* Events List */}
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <Skeleton className="w-48 h-32" />
            <div className="flex-1 p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <Skeleton className="w-48 h-6 mb-2" />
                  <Skeleton className="w-32 h-4" />
                </div>
                <Skeleton className="w-20 h-6 rounded-full" />
              </div>
              <Skeleton className="w-full h-10 mb-3" />
              <div className="flex items-center gap-4">
                <Skeleton className="w-24 h-4" />
                <Skeleton className="w-20 h-4" />
                <Skeleton className="w-24 h-8 rounded-lg ml-auto" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Community Group Skeleton
export function CommunityGroupSkeleton() {
  return (
    <div className="space-y-6">
      {/* Cover & Header */}
      <div className="relative">
        <Skeleton className="w-full h-48 rounded-xl" />
        <div className="absolute -bottom-12 left-6">
          <Skeleton className="w-24 h-24 rounded-xl border-4 border-white dark:border-zinc-950" />
        </div>
      </div>

      <div className="pt-8 px-6">
        <div className="flex items-start justify-between">
          <div>
            <Skeleton className="w-64 h-8 mb-2" />
            <Skeleton className="w-40 h-4" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="w-24 h-10 rounded-lg" />
            <Skeleton className="w-10 h-10 rounded-lg" />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-6 px-6">
        <Skeleton className="w-24 h-5" />
        <Skeleton className="w-24 h-5" />
        <Skeleton className="w-32 h-5" />
      </div>

      {/* Tabs & Content */}
      <div className="px-6">
        <div className="flex gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
          <Skeleton className="w-20 h-8" />
          <Skeleton className="w-24 h-8" />
          <Skeleton className="w-20 h-8" />
          <Skeleton className="w-20 h-8" />
        </div>

        {/* Posts */}
        <div className="py-6 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <PostSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

// Privacy Center Skeleton
export function PrivacyCenterSkeleton() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-700 to-indigo-800 rounded-xl p-8">
        <div className="flex items-center gap-3 mb-4">
          <Skeleton className="w-10 h-10 rounded-lg bg-purple-600/50" />
          <Skeleton className="w-40 h-8 bg-purple-600/50" />
        </div>
        <Skeleton className="w-full max-w-lg h-16 bg-purple-600/50" />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
            <Skeleton className="w-12 h-12 rounded-lg mb-4" />
            <Skeleton className="w-32 h-6 mb-2" />
            <Skeleton className="w-full h-12" />
          </div>
        ))}
      </div>

      {/* Consent Settings */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
        <Skeleton className="w-48 h-6 mb-6" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between py-4 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
            <div className="flex-1">
              <Skeleton className="w-40 h-5 mb-1" />
              <Skeleton className="w-64 h-4" />
            </div>
            <Skeleton className="w-12 h-6 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Onboarding Skeleton
export function OnboardingSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-8">
        {/* Progress Steps */}
        <div className="flex items-center justify-between">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center">
              <Skeleton className="w-8 h-8 rounded-full" />
              {i < 5 && <Skeleton className="w-16 h-1 mx-2" />}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-lg p-8 space-y-6">
          <Skeleton className="w-64 h-8 mx-auto" />
          <Skeleton className="w-96 h-4 mx-auto" />

          <div className="space-y-4 py-4">
            <Skeleton className="w-full h-12 rounded-lg" />
            <Skeleton className="w-full h-12 rounded-lg" />
            <Skeleton className="w-full h-24 rounded-lg" />
          </div>

          <div className="flex justify-between pt-4">
            <Skeleton className="w-24 h-10 rounded-lg" />
            <Skeleton className="w-24 h-10 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Skeleton;
