'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Award,
  BarChart,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Globe,
  Share2,
} from 'lucide-react';
import { useCourse, useEnrollCourse } from '@/lib/hooks';
import { cn, formatCurrency } from '@/lib/utils';

interface CourseDetails {
  id: string;
  title: string;
  description: string;
  providerName?: string | null;
  organization?: {
    id?: string;
    name?: string | null;
    slug?: string | null;
    logo?: string | null;
    website?: string | null;
  } | null;
  type?: string | null;
  durationMonths?: number | null;
  studyMode?: unknown;
  cost?: number | null;
  fundingOptions?: unknown;
  employmentRate?: number | null;
  avgStartingSalary?: number | null;
  intakeDates?: unknown;
  enrollment?: {
    id?: string;
    progress?: number | null;
  } | null;
  isActive?: boolean;
}

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

function formatDateList(value: unknown): string[] {
  return toStringList(value).map((date) => {
    const parsed = new Date(date);
    return Number.isNaN(parsed.getTime())
      ? date
      : parsed.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  });
}

export default function CourseDetailPage() {
  const params = useParams();
  const courseId = params.id as string;
  const { data: course, isLoading, error } = useCourse(courseId);
  const { mutate: enroll, isPending: isEnrolling } = useEnrollCourse();

  const [activeTab, setActiveTab] = useState('overview');

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
          <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-xl" />
          <div className="h-32 bg-slate-200 dark:bg-slate-700 rounded-xl" />
        </div>
      </div>
    );
  }

  const displayCourse = course as CourseDetails | undefined;

  if (!displayCourse || error) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <Link
          href="/dashboard/learn"
          className="inline-flex items-center text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Courses
        </Link>
        <div className="card text-center py-12">
          <BookOpen className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
            Course unavailable
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            This course could not be found or is no longer active.
          </p>
        </div>
      </div>
    );
  }

  const studyModes = toStringList(displayCourse.studyMode);
  const fundingOptions = toStringList(displayCourse.fundingOptions);
  const intakeDates = formatDateList(displayCourse.intakeDates);
  const duration = formatDuration(displayCourse.durationMonths);
  const providerName = displayCourse.organization?.name || displayCourse.providerName || 'Provider not listed';
  const typeLabel = displayCourse.type ? formatLabel(displayCourse.type) : 'Course';
  const progress = displayCourse.enrollment?.progress ?? 0;
  const isEnrolled = Boolean(displayCourse.enrollment);

  // Courses here are provider-run programs, not lessons hosted on ATHENA, so an
  // enrolled learner continues on the provider's own page.
  const providerSlug = displayCourse.organization?.slug;
  const providerWebsite = displayCourse.organization?.website;

  const highlights = [
    { label: 'Provider', value: providerName },
    { label: 'Format', value: studyModes.map(formatLabel).join(', ') },
    { label: 'Duration', value: duration },
    {
      label: 'Employment rate',
      value: typeof displayCourse.employmentRate === 'number' ? `${displayCourse.employmentRate}%` : null,
    },
    {
      label: 'Average starting salary',
      value: typeof displayCourse.avgStartingSalary === 'number'
        ? formatCurrency(displayCourse.avgStartingSalary)
        : null,
    },
  ].filter((item) => item.value);

  const handleEnroll = () => {
    enroll(displayCourse.id);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <Link
        href="/dashboard/learn"
        className="inline-flex items-center text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Courses
      </Link>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-xs font-medium px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded-full">
                {typeLabel}
              </span>
              {displayCourse.isActive === false && (
                <span className="text-xs font-medium px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full">
                  Inactive
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
              {displayCourse.title}
            </h1>
            <p className="text-slate-600 dark:text-slate-300 mb-5">
              {displayCourse.description}
            </p>
            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
              <span className="flex items-center">
                <BookOpen className="w-4 h-4 mr-1" />
                {providerName}
              </span>
              {duration && (
                <span className="flex items-center">
                  <Clock className="w-4 h-4 mr-1" />
                  {duration}
                </span>
              )}
              {studyModes.length > 0 && (
                <span className="flex items-center">
                  <Globe className="w-4 h-4 mr-1" />
                  {studyModes.map(formatLabel).join(', ')}
                </span>
              )}
            </div>
          </div>

          <div className="card">
            <div className="grid sm:grid-cols-2 gap-4">
              {highlights.map((item) => (
                <div key={item.label} className="rounded-lg border border-slate-100 dark:border-slate-700 p-4">
                  <p className="text-sm text-slate-500 dark:text-slate-400">{item.label}</p>
                  <p className="mt-1 font-semibold text-slate-900 dark:text-white">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="border-b border-slate-200 dark:border-slate-700">
            <nav className="flex space-x-8">
              {['overview', 'curriculum', 'provider', 'outcomes'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'py-4 px-1 border-b-2 font-medium text-sm transition',
                    activeTab === tab
                      ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                      : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  )}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </nav>
          </div>

          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="card">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                  Course Summary
                </h2>
                <p className="text-slate-600 dark:text-slate-300">
                  {displayCourse.description}
                </p>
              </div>

              {fundingOptions.length > 0 && (
                <div className="card">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                    Funding Options
                  </h2>
                  <div className="grid md:grid-cols-2 gap-3">
                    {fundingOptions.map((item) => (
                      <div key={item} className="flex items-center space-x-2 text-slate-600 dark:text-slate-300">
                        <CheckCircle2 className="w-4 h-4 text-primary-500" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {intakeDates.length > 0 && (
                <div className="card">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                    Intake Dates
                  </h2>
                  <div className="grid md:grid-cols-2 gap-3">
                    {intakeDates.map((date) => (
                      <div key={date} className="flex items-center space-x-2 text-slate-600 dark:text-slate-300">
                        <Calendar className="w-4 h-4 text-primary-500" />
                        <span>{date}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'curriculum' && (
            <div className="card text-center py-12">
              <BookOpen className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                Curriculum details are not published yet
              </h2>
              <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                The current course API provides program-level details only. Lesson modules will appear here when the provider publishes them.
              </p>
            </div>
          )}

          {activeTab === 'provider' && (
            <div className="card">
              <div className="flex items-start space-x-4">
                <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-xl font-bold text-primary-600">
                  {providerName.charAt(0)}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                    {providerName}
                  </h2>
                  <p className="mt-2 text-slate-600 dark:text-slate-300">
                    Provider profile details are not published for this course yet.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'outcomes' && (
            <div className="card">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Outcomes
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="rounded-lg border border-slate-100 dark:border-slate-700 p-4">
                  <div className="flex items-center text-slate-500 dark:text-slate-400 mb-2">
                    <BarChart className="w-4 h-4 mr-2" />
                    Employment rate
                  </div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {typeof displayCourse.employmentRate === 'number' ? `${displayCourse.employmentRate}%` : 'Not listed'}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-100 dark:border-slate-700 p-4">
                  <div className="flex items-center text-slate-500 dark:text-slate-400 mb-2">
                    <Award className="w-4 h-4 mr-2" />
                    Average starting salary
                  </div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {typeof displayCourse.avgStartingSalary === 'number'
                      ? formatCurrency(displayCourse.avgStartingSalary)
                      : 'Not listed'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-1">
          <div className="card sticky top-6">
            <div className="mb-6">
              <p className="text-sm text-slate-500 dark:text-slate-400">Course cost</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">
                {typeof displayCourse.cost === 'number' ? formatCurrency(displayCourse.cost) : 'Contact provider'}
              </p>
            </div>

            {isEnrolled ? (
              <div className="space-y-3">
                <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-primary-500" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">{progress}% complete</p>
                {providerSlug ? (
                  <Link
                    href={`/dashboard/learn/providers/${providerSlug}`}
                    className="w-full btn-primary py-3 flex items-center justify-center space-x-2"
                  >
                    <BookOpen className="w-5 h-5" />
                    <span>Continue with {providerName}</span>
                  </Link>
                ) : providerWebsite ? (
                  <a
                    href={providerWebsite}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full btn-primary py-3 flex items-center justify-center space-x-2"
                  >
                    <BookOpen className="w-5 h-5" />
                    <span>Continue with {providerName}</span>
                  </a>
                ) : (
                  <Link
                    href="/dashboard/learn/my-courses"
                    className="w-full btn-primary py-3 flex items-center justify-center space-x-2"
                  >
                    <BookOpen className="w-5 h-5" />
                    <span>View in My Courses</span>
                  </Link>
                )}
              </div>
            ) : (
              <button
                onClick={handleEnroll}
                disabled={isEnrolling || displayCourse.isActive === false}
                className="w-full btn-primary py-3 flex items-center justify-center space-x-2 disabled:opacity-60"
              >
                <Award className="w-5 h-5" />
                <span>{isEnrolling ? 'Enrolling...' : 'Enroll Now'}</span>
              </button>
            )}

            <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-700 space-y-3 text-sm text-slate-600 dark:text-slate-300">
              {duration && (
                <p className="flex items-center">
                  <Clock className="w-4 h-4 mr-2 text-slate-400" />
                  {duration}
                </p>
              )}
              {studyModes.length > 0 && (
                <p className="flex items-center">
                  <Globe className="w-4 h-4 mr-2 text-slate-400" />
                  {studyModes.map(formatLabel).join(', ')}
                </p>
              )}
            </div>

            <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-700 flex justify-center space-x-4">
              <button className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" aria-label="Share course">
                <Share2 className="w-5 h-5" />
              </button>
              <button className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" aria-label="Download course information">
                <Download className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
