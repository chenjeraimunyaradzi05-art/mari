'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Search,
  Clock,
  Users,
  BookOpen,
  Award,
  ChevronDown,
  TrendingUp,
} from 'lucide-react';
import { useCourses } from '@/lib/hooks';
import { formatCurrency, cn } from '@/lib/utils';
import { CardSkeleton } from '@/components/ui/loading';

type CourseSummary = {
  id: string;
  title: string;
  description?: string | null;
  organization?: {
    id?: string;
    name?: string | null;
    logo?: string | null;
  } | null;
  providerName?: string | null;
  type?: string | null;
  durationMonths?: number | null;
  studyMode?: unknown;
  cost?: number | null;
  employmentRate?: number | null;
  avgStartingSalary?: number | null;
  featured?: boolean;
};

const courseTypes = [
  { value: '', label: 'All Types' },
  { value: 'degree', label: 'Degree' },
  { value: 'diploma', label: 'Diploma' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'bootcamp', label: 'Bootcamp' },
  { value: 'short_course', label: 'Short Course' },
];

const studyModes = [
  { value: '', label: 'All Modes' },
  { value: 'online', label: 'Online' },
  { value: 'part-time', label: 'Part Time' },
  { value: 'full-time', label: 'Full Time' },
];

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

function providerNameFor(course: CourseSummary): string {
  return course.organization?.name || course.providerName || 'Provider not listed';
}

function costLabelFor(course: CourseSummary): string {
  if (typeof course.cost !== 'number') return 'Contact provider';
  return course.cost === 0 ? 'Free' : formatCurrency(course.cost);
}

function CourseArtwork({ course }: { course: CourseSummary }) {
  const providerLogo = course.organization?.logo;

  if (providerLogo) {
    return (
      <img
        src={providerLogo}
        alt={providerNameFor(course)}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
      />
    );
  }

  return (
    <div className="h-full w-full bg-gradient-to-br from-primary-100 via-sky-100 to-emerald-100 dark:from-primary-900/40 dark:via-sky-900/30 dark:to-emerald-900/30 flex items-center justify-center">
      <BookOpen className="h-12 w-12 text-primary-600 dark:text-primary-300" />
    </div>
  );
}

export default function LearnPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedStudyMode, setSelectedStudyMode] = useState('');
  const [page, setPage] = useState(1);
  // A new search starts from the first page.
  useEffect(() => {
    setPage(1);
  }, [searchQuery, selectedType, selectedStudyMode]);

  const { data, isLoading } = useCourses({
    page,
    search: searchQuery,
    type: selectedType || undefined,
    studyMode: selectedStudyMode || undefined,
  });

  const courses = (data?.courses || []) as CourseSummary[];
  const featuredCourses = courses.filter((course) => course.featured).slice(0, 3);
  const totalPages = data?.totalPages ?? 0;
  const providerCount = new Set(courses.map(providerNameFor).filter((name) => name !== 'Provider not listed')).size;
  const outcomeCount = courses.filter(
    (course) =>
      typeof course.employmentRate === 'number' ||
      typeof course.avgStartingSalary === 'number'
  ).length;
  const freeCourseCount = courses.filter((course) => course.cost === 0).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Learn & Grow
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Upskill with courses designed for women in tech and leadership
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard/learn/providers"
            className="btn-outline px-6 py-2.5 text-center"
          >
            Providers
          </Link>
          <Link
            href="/dashboard/learn/applications"
            className="btn-outline px-6 py-2.5 text-center"
          >
            My Applications
          </Link>
          <Link
            href="/dashboard/learn/my-courses"
            className="btn-outline px-6 py-2.5 text-center"
          >
            My Courses
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card bg-gradient-to-br from-primary-500 to-primary-600 text-white">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <p className="text-2xl font-bold">{data?.totalCourses || 0}</p>
              <p className="text-sm text-white/80">Courses</p>
            </div>
          </div>
        </div>
        <div className="card bg-gradient-to-br from-secondary-500 to-secondary-600 text-white">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-2xl font-bold">{providerCount}</p>
              <p className="text-sm text-white/80">Providers</p>
            </div>
          </div>
        </div>
        <div className="card bg-gradient-to-br from-accent-500 to-accent-600 text-white">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <p className="text-2xl font-bold">{outcomeCount}</p>
              <p className="text-sm text-white/80">Outcome Listings</p>
            </div>
          </div>
        </div>
        <div className="card bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-2xl font-bold">{freeCourseCount}</p>
              <p className="text-sm text-white/80">Free Courses</p>
            </div>
          </div>
        </div>
      </div>

      {featuredCourses.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Featured Courses
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {featuredCourses.map((course) => (
              <Link
                key={course.id}
                href={`/dashboard/learn/${course.id}`}
                className="card group hover:shadow-lg transition-all overflow-hidden"
              >
                <div className="relative h-40 -mx-6 -mt-6 mb-4 overflow-hidden">
                  <CourseArtwork course={course} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3">
                    <span className="px-2 py-1 text-xs font-medium bg-primary-500 text-white rounded-full">
                      Featured
                    </span>
                  </div>
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white group-hover:text-primary-600 transition mb-2">
                  {course.title}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">
                  {course.description || 'No description provided.'}
                </p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">
                    {providerNameFor(course)}
                  </span>
                  <span className="font-semibold text-primary-600">
                    {costLabelFor(course)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search courses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-10 w-full"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="relative">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="input pr-10 appearance-none"
            >
              {courseTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select
              value={selectedStudyMode}
              onChange={(e) => setSelectedStudyMode(e.target.value)}
              className="input pr-10 appearance-none"
            >
              {studyModes.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : courses.length ? (
          courses.map((course) => {
            const duration = formatDuration(course.durationMonths);
            const modes = toStringList(course.studyMode);
            const typeLabel = course.type ? formatLabel(course.type) : 'Course';

            return (
              <Link
                key={course.id}
                href={`/dashboard/learn/${course.id}`}
                className="card group hover:shadow-lg transition-all overflow-hidden"
              >
                <div className="relative h-40 -mx-6 -mt-6 mb-4 overflow-hidden">
                  <CourseArtwork course={course} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-2">
                    {duration && (
                      <span className="px-2 py-1 text-xs font-medium bg-slate-900/70 text-white rounded-full flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        {duration}
                      </span>
                    )}
                    {modes.slice(0, 2).map((mode) => (
                      <span
                        key={mode}
                        className="px-2 py-1 text-xs font-medium bg-slate-900/70 text-white rounded-full"
                      >
                        {formatLabel(mode)}
                      </span>
                    ))}
                  </div>
                  {course.cost === 0 && (
                    <div className="absolute top-3 right-3">
                      <span className="px-2 py-1 text-xs font-medium bg-green-500 text-white rounded-full">
                        Free
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 text-xs font-medium bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded">
                      {typeLabel}
                    </span>
                  </div>

                  <h3 className="font-semibold text-slate-900 dark:text-white group-hover:text-primary-600 transition line-clamp-2">
                    {course.title}
                  </h3>

                  <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">
                    {course.description || 'No description provided.'}
                  </p>

                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      {course.organization?.logo ? (
                        <img
                          src={course.organization.logo}
                          alt={providerNameFor(course)}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs font-medium text-slate-500">
                          {providerNameFor(course).charAt(0)}
                        </div>
                      )}
                    </div>
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      {providerNameFor(course)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      {typeof course.employmentRate === 'number'
                        ? `${course.employmentRate}% employment`
                        : typeof course.avgStartingSalary === 'number'
                          ? `${formatCurrency(course.avgStartingSalary)} avg salary`
                          : 'Outcomes not listed'}
                    </div>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {costLabelFor(course)}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })
        ) : (
          <div className="col-span-full card text-center py-12">
            <BookOpen className="w-12 h-12 mx-auto text-slate-400 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
              No courses found
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-4">
              Try adjusting your search or filters
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedType('');
                setSelectedStudyMode('');
              }}
              className="btn-outline px-4 py-2"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center space-x-2">
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setPage(i + 1)}
              aria-current={i + 1 === page ? 'page' : undefined}
              className={cn(
                'px-4 py-2 rounded-lg font-medium transition',
                i + 1 === page
                  ? 'bg-primary-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              )}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
