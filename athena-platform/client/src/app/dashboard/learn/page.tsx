'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Search,
  Play,
  Clock,
  Users,
  Star,
  BookOpen,
  Award,
  ChevronDown,
  Filter,
  TrendingUp,
} from 'lucide-react';
import { useCourses, useAuth } from '@/lib/hooks';
import { formatCurrency, cn } from '@/lib/utils';
import { CardSkeleton } from '@/components/ui/loading';

const categories = [
  'All Categories',
  'Leadership',
  'Tech & Engineering',
  'Product Management',
  'Marketing',
  'Finance',
  'Entrepreneurship',
  'Personal Development',
  'Communication',
  'Productivity',
];

const levels = [
  { value: '', label: 'All Levels' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

const sortOptions = [
  { value: 'popular', label: 'Most Popular' },
  { value: 'rating', label: 'Highest Rated' },
  { value: 'newest', label: 'Newest' },
  { value: 'price_low', label: 'Price: Low to High' },
  { value: 'price_high', label: 'Price: High to Low' },
];

export default function LearnPage() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [selectedLevel, setSelectedLevel] = useState('');
  const [sortBy, setSortBy] = useState('popular');

  const { data, isLoading } = useCourses({
    search: searchQuery,
    category: selectedCategory !== 'All Categories' ? selectedCategory : undefined,
    level: selectedLevel || undefined,
    sortBy,
  });

  const featuredCourses = data?.courses?.filter((c: any) => c.featured)?.slice(0, 3) || [];
  const totalPages = data?.totalPages ?? 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Learn & Grow
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
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

      {/* Stats Cards */}
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
              <p className="text-2xl font-bold">12.5K+</p>
              <p className="text-sm text-white/80">Students</p>
            </div>
          </div>
        </div>
        <div className="card bg-gradient-to-br from-accent-500 to-accent-600 text-white">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <p className="text-2xl font-bold">95%</p>
              <p className="text-sm text-white/80">Completion</p>
            </div>
          </div>
        </div>
        <div className="card bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-2xl font-bold">4.8</p>
              <p className="text-sm text-white/80">Avg Rating</p>
            </div>
          </div>
        </div>
      </div>

      {/* Featured Courses */}
      {featuredCourses.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Featured Courses
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {featuredCourses.map((course: any) => (
              <Link
                key={course.id}
                href={`/dashboard/learn/${course.id}`}
                className="card group hover:shadow-lg transition-all overflow-hidden"
              >
                <div className="relative h-40 -mx-6 -mt-6 mb-4">
                  <img
                    src={course.thumbnailUrl || '/images/course-placeholder.jpg'}
                    alt={course.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3">
                    <span className="px-2 py-1 text-xs font-medium bg-primary-500 text-white rounded-full">
                      Featured
                    </span>
                  </div>
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-primary-600 transition mb-2">
                  {course.title}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">
                  {course.description}
                </p>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center text-yellow-500">
                    <Star className="w-4 h-4 fill-current mr-1" />
                    <span className="font-medium">{course.rating?.toFixed(1) || '5.0'}</span>
                  </div>
                  <span className="font-semibold text-primary-600">
                    {course.price === 0 ? 'Free' : formatCurrency(course.price)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
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
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="input pr-10 appearance-none"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="input pr-10 appearance-none"
            >
              {levels.map((level) => (
                <option key={level.value} value={level.value}>
                  {level.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="input pr-10 appearance-none"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Courses Grid */}
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
        ) : data?.courses?.length ? (
          data.courses.map((course: any) => (
            <Link
              key={course.id}
              href={`/dashboard/learn/${course.id}`}
              className="card group hover:shadow-lg transition-all overflow-hidden"
            >
              {/* Thumbnail */}
              <div className="relative h-40 -mx-6 -mt-6 mb-4">
                <img
                  src={course.thumbnailUrl || '/images/course-placeholder.jpg'}
                  alt={course.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-3 left-3 flex items-center space-x-2">
                  <span className="px-2 py-1 text-xs font-medium bg-gray-900/70 text-white rounded-full flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    {course.duration || '2h 30m'}
                  </span>
                  <span className="px-2 py-1 text-xs font-medium bg-gray-900/70 text-white rounded-full flex items-center">
                    <Play className="w-3 h-3 mr-1" />
                    {course.lessonCount || 12} lessons
                  </span>
                </div>
                {course.price === 0 && (
                  <div className="absolute top-3 right-3">
                    <span className="px-2 py-1 text-xs font-medium bg-green-500 text-white rounded-full">
                      Free
                    </span>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 text-xs font-medium bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded">
                    {course.category || 'General'}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                    {course.level || 'All Levels'}
                  </span>
                </div>

                <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-primary-600 transition line-clamp-2">
                  {course.title}
                </h3>

                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                  {course.description}
                </p>

                {/* Instructor */}
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                    {course.instructor?.avatarUrl ? (
                      <img
                        src={course.instructor.avatarUrl}
                        alt={course.instructor.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs font-medium text-gray-500">
                        {course.instructor?.name?.charAt(0) || 'A'}
                      </div>
                    )}
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {course.instructor?.name || 'ATHENA Team'}
                  </span>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center text-yellow-500">
                      <Star className="w-4 h-4 fill-current mr-1" />
                      <span className="text-sm font-medium">{course.rating?.toFixed(1) || '5.0'}</span>
                    </div>
                    <span className="text-sm text-gray-400">
                      ({course.enrollmentCount || 0} students)
                    </span>
                  </div>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {course.price === 0 ? 'Free' : formatCurrency(course.price)}
                  </span>
                </div>
              </div>
            </Link>
          ))
        ) : (
          <div className="col-span-full card text-center py-12">
            <BookOpen className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No courses found
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Try adjusting your search or filters
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('All Categories');
                setSelectedLevel('');
              }}
              className="btn-outline px-4 py-2"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center space-x-2">
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => (
            <button
              key={i}
              className={cn(
                'px-4 py-2 rounded-lg font-medium transition',
                i === 0
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
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
