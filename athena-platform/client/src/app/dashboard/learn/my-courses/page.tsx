'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Clock,
  Play,
  CheckCircle,
  Building2,
  Calendar,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui';
import { useMyCourses } from '@/lib/hooks';
import { CardSkeleton } from '@/components/ui/loading';

interface EnrolledCourse {
  id: string;
  title: string;
  description?: string | null;
  providerName?: string | null;
  organization?: {
    name?: string | null;
    logo?: string | null;
  } | null;
  progress: number;
  durationMonths?: number | null;
  studyMode?: unknown;
  lastAccessed?: string;
  category: string;
  employmentRate?: number | null;
  avgStartingSalary?: number | null;
}

type FilterType = 'all' | 'in-progress' | 'completed';

function toStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
      }
    } catch {
      return [value];
    }
  }

  return [];
}

function formatLabel(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDuration(months?: number | null): string | null {
  if (!months || months <= 0) return null;
  if (months < 12) return `${months} month${months === 1 ? '' : 's'}`;

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (remainingMonths === 0) return `${years} year${years === 1 ? '' : 's'}`;

  return `${years}y ${remainingMonths}m`;
}

function providerNameFor(course: EnrolledCourse): string {
  return course.organization?.name || course.providerName || 'Provider not listed';
}

function CourseArtwork({ course }: { course: EnrolledCourse }) {
  const logo = course.organization?.logo;

  if (logo) {
    return (
      <img
        src={logo}
        alt={providerNameFor(course)}
        className="w-full h-full object-cover"
      />
    );
  }

  return (
    <div className="h-full w-full bg-gradient-to-br from-primary-100 via-sky-100 to-emerald-100 dark:from-primary-900/40 dark:via-sky-900/30 dark:to-emerald-900/30 flex items-center justify-center">
      <BookOpen className="h-10 w-10 text-primary-600 dark:text-primary-300" />
    </div>
  );
}

export default function MyCoursesPage() {
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: myCourses, isLoading, isError } = useMyCourses();

  const courses: EnrolledCourse[] = (myCourses || []).map((course: any) => {
    const enrollment = course.enrollment;
    const progress = Math.max(0, Math.min(100, Number(enrollment?.progress ?? 0)));
    const lastAccessedIso = enrollment?.updatedAt || course.updatedAt || course.createdAt;

    return {
      id: course.id,
      title: course.title,
      description: course.description,
      providerName: course.providerName,
      organization: course.organization,
      progress,
      durationMonths: course.durationMonths,
      studyMode: course.studyMode,
      lastAccessed: lastAccessedIso ? new Date(lastAccessedIso).toISOString() : undefined,
      category: course.type ? formatLabel(course.type) : 'Course',
      employmentRate: course.employmentRate,
      avgStartingSalary: course.avgStartingSalary,
    };
  });

  const filteredCourses = courses
    .filter((course) => {
      if (filter === 'in-progress') return course.progress > 0 && course.progress < 100;
      if (filter === 'completed') return course.progress === 100;
      return true;
    })
    .filter(
      (course) =>
        course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        providerNameFor(course).toLowerCase().includes(searchQuery.toLowerCase())
    );

  const stats = {
    totalCourses: courses.length,
    inProgress: courses.filter((c) => c.progress > 0 && c.progress < 100).length,
    completed: courses.filter((c) => c.progress === 100).length,
    providers: new Set(courses.map(providerNameFor).filter((name) => name !== 'Provider not listed')).size,
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          My Learning
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Track your progress and continue where you left off
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card text-center">
          <BookOpen className="w-8 h-8 text-primary-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {stats.totalCourses}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">Total Courses</p>
        </div>
        <div className="card text-center">
          <Play className="w-8 h-8 text-blue-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {stats.inProgress}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">In Progress</p>
        </div>
        <div className="card text-center">
          <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {stats.completed}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">Completed</p>
        </div>
        <div className="card text-center">
          <Building2 className="w-8 h-8 text-purple-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {stats.providers}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">Providers</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setFilter('all')}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition',
              filter === 'all'
                ? 'bg-primary-500 text-white'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            )}
          >
            All ({courses.length})
          </button>
          <button
            onClick={() => setFilter('in-progress')}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition',
              filter === 'in-progress'
                ? 'bg-primary-500 text-white'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            )}
          >
            In Progress ({stats.inProgress})
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition',
              filter === 'completed'
                ? 'bg-primary-500 text-white'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            )}
          >
            Completed ({stats.completed})
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search courses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-sm"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : isError ? (
        <div className="card text-center py-16">
          <BookOpen className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
            Unable to load your courses
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            Please try again. If you're logged out, sign in first.
          </p>
          <Link href="/login" className="btn-primary">
            Go to Login
          </Link>
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="card text-center py-16">
          <BookOpen className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
            No courses found
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            {filter !== 'all'
              ? "You don't have any courses in this category"
              : "You haven't enrolled in any courses yet"}
          </p>
          <Link href="/dashboard/learn" className="btn-primary">
            Browse Courses
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredCourses.map((course) => {
            const duration = formatDuration(course.durationMonths);
            const modes = toStringList(course.studyMode);

            return (
              <div
                key={course.id}
                className="card-hover flex flex-col md:flex-row md:items-center gap-4"
              >
                <Link
                  href={`/dashboard/learn/${course.id}`}
                  className="relative flex-shrink-0 overflow-hidden rounded-lg w-full md:w-48 h-32"
                >
                  <CourseArtwork course={course} />
                  {course.progress === 100 ? (
                    <div className="absolute inset-0 bg-green-500/80 flex items-center justify-center">
                      <CheckCircle className="w-12 h-12 text-white" />
                    </div>
                  ) : (
                    <div className="absolute bottom-2 left-2 right-2">
                      <div className="bg-black/60 rounded-full px-3 py-1.5 text-white text-xs flex items-center space-x-2">
                        <Play className="w-3 h-3" />
                        <span>Continue</span>
                      </div>
                    </div>
                  )}
                </Link>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link
                        href={`/dashboard/learn/${course.id}`}
                        className="font-medium text-slate-900 dark:text-white hover:text-primary-500"
                      >
                        {course.title}
                      </Link>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {providerNameFor(course)}
                      </p>
                    </div>
                    <Badge variant="secondary" className="hidden md:block">
                      {course.category}
                    </Badge>
                  </div>

                  <div className="mt-3">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-slate-600 dark:text-slate-300">
                        Progress
                      </span>
                      <span className="font-medium text-primary-500">
                        {course.progress}%
                      </span>
                    </div>
                    <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          course.progress === 100 ? 'bg-green-500' : 'bg-primary-500'
                        )}
                        style={{ width: `${course.progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-slate-500 dark:text-slate-400">
                    {duration && (
                      <span className="flex items-center">
                        <Clock className="w-4 h-4 mr-1" />
                        {duration}
                      </span>
                    )}
                    {modes.slice(0, 2).map((mode) => (
                      <span key={mode}>{formatLabel(mode)}</span>
                    ))}
                    {course.lastAccessed && (
                      <span className="flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />
                        Last accessed {new Date(course.lastAccessed).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex md:flex-col items-center gap-2">
                  <Link
                    href={`/dashboard/learn/${course.id}`}
                    className="btn-primary text-sm w-full md:w-auto"
                  >
                    {course.progress === 100 ? 'Review' : 'Continue'}
                  </Link>
                  <Link
                    href={`/dashboard/learn/${course.id}`}
                    className="btn-outline text-sm w-full md:w-auto"
                  >
                    View Details
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
