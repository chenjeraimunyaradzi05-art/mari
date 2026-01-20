'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Clock,
  Play,
  CheckCircle,
  Trophy,
  Target,
  Calendar,
  BarChart3,
  Filter,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui';
import { useMyCourses } from '@/lib/hooks';
import { CardSkeleton } from '@/components/ui/loading';

interface EnrolledCourse {
  id: string;
  title: string;
  instructor: string;
  image: string;
  progress: number;
  totalLessons?: number;
  completedLessons?: number;
  totalHours?: number;
  hoursWatched?: number;
  lastAccessed?: string;
  category: string;
  certificate?: boolean;
}

type FilterType = 'all' | 'in-progress' | 'completed';

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
      instructor: course.providerName || course.organization?.name || 'ATHENA',
      image: '/images/course-placeholder.jpg',
      progress,
      lastAccessed: lastAccessedIso ? new Date(lastAccessedIso).toISOString() : undefined,
      category: course.type || 'Course',
      certificate: progress >= 100,
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
        course.instructor.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const stats = {
    totalCourses: courses.length,
    inProgress: courses.filter((c) => c.progress > 0 && c.progress < 100).length,
    completed: courses.filter((c) => c.progress === 100).length,
    totalHoursWatched: 0,
    certificates: courses.filter((c) => c.certificate).length,
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          My Learning
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Track your progress and continue where you left off
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="card text-center">
          <BookOpen className="w-8 h-8 text-primary-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {stats.totalCourses}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Courses</p>
        </div>
        <div className="card text-center">
          <Play className="w-8 h-8 text-blue-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {stats.inProgress}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">In Progress</p>
        </div>
        <div className="card text-center">
          <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {stats.completed}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Completed</p>
        </div>
        <div className="card text-center">
          <Clock className="w-8 h-8 text-purple-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {stats.totalHoursWatched.toFixed(1)}h
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Hours Watched</p>
        </div>
        <div className="card text-center">
          <Trophy className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {stats.certificates}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Certificates</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setFilter('all')}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition',
              filter === 'all'
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
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
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
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
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
            )}
          >
            Completed ({stats.completed})
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search courses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
          />
        </div>
      </div>

      {/* Course List */}
      {isLoading ? (
        <div className="space-y-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : isError ? (
        <div className="card text-center py-16">
          <BookOpen className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Unable to load your courses
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Please try again. If you’re logged out, sign in first.
          </p>
          <Link href="/login" className="btn-primary">
            Go to Login
          </Link>
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="card text-center py-16">
          <BookOpen className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No courses found
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
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
          {filteredCourses.map((course) => (
            <div
              key={course.id}
              className="card-hover flex flex-col md:flex-row md:items-center gap-4"
            >
              {/* Thumbnail */}
              <Link
                href={`/dashboard/learn/${course.id}`}
                className="relative flex-shrink-0"
              >
                <img
                  src={course.image}
                  alt={course.title}
                  className="w-full md:w-48 h-32 object-cover rounded-lg"
                />
                {course.progress === 100 ? (
                  <div className="absolute inset-0 bg-green-500/80 rounded-lg flex items-center justify-center">
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

              {/* Course Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <div>
                    <Link
                      href={`/dashboard/learn/${course.id}`}
                      className="font-medium text-gray-900 dark:text-white hover:text-primary-500"
                    >
                      {course.title}
                    </Link>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {course.instructor}
                    </p>
                  </div>
                  <Badge variant="secondary" className="hidden md:block">
                    {course.category}
                  </Badge>
                </div>

                {/* Progress */}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600 dark:text-gray-300">
                      {typeof course.completedLessons === 'number' && typeof course.totalLessons === 'number'
                        ? `${course.completedLessons} of ${course.totalLessons} lessons`
                        : 'Progress'}
                    </span>
                    <span className="font-medium text-primary-500">
                      {course.progress}%
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        course.progress === 100 ? 'bg-green-500' : 'bg-primary-500'
                      )}
                      style={{ width: `${course.progress}%` }}
                    />
                  </div>
                </div>

                {/* Meta */}
                <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-gray-500 dark:text-gray-400">
                  {typeof course.hoursWatched === 'number' && typeof course.totalHours === 'number' && (
                    <span className="flex items-center">
                      <Clock className="w-4 h-4 mr-1" />
                      {course.hoursWatched.toFixed(1)}h / {course.totalHours}h
                    </span>
                  )}
                  {course.lastAccessed && (
                    <span className="flex items-center">
                      <Calendar className="w-4 h-4 mr-1" />
                      Last accessed {new Date(course.lastAccessed).toLocaleDateString()}
                    </span>
                  )}
                  {course.certificate && (
                    <span className="flex items-center text-green-500">
                      <Trophy className="w-4 h-4 mr-1" />
                      Certificate Earned
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex md:flex-col items-center gap-2">
                {course.progress === 100 ? (
                  <>
                    <Link
                      href={`/dashboard/learn/${course.id}/certificate`}
                      className="btn-primary text-sm w-full md:w-auto"
                    >
                      View Certificate
                    </Link>
                    <Link
                      href={`/dashboard/learn/${course.id}`}
                      className="btn-outline text-sm w-full md:w-auto"
                    >
                      Review
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      href={`/dashboard/learn/${course.id}/continue`}
                      className="btn-primary text-sm w-full md:w-auto"
                    >
                      Continue
                    </Link>
                    <Link
                      href={`/dashboard/learn/${course.id}`}
                      className="btn-outline text-sm w-full md:w-auto"
                    >
                      View Details
                    </Link>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Learning Streak */}
      <div className="card bg-gradient-to-r from-primary-50 to-purple-50 dark:from-primary-900/20 dark:to-purple-900/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
              <Target className="w-6 h-6 text-primary-500" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                🔥 7 Day Learning Streak!
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Keep it up! You're building great learning habits.
              </p>
            </div>
          </div>
          <div className="hidden md:flex items-center space-x-1">
            {[1, 2, 3, 4, 5, 6, 7].map((day) => (
              <div
                key={day}
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                  day <= 7
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
                )}
              >
                {day <= 7 ? '✓' : day}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
