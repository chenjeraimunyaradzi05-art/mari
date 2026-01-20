'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Search,
  Filter,
  Star,
  Calendar,
  MessageCircle,
  Globe,
  Award,
  Clock,
  Users,
  ChevronDown,
} from 'lucide-react';
import { useMentors, useAuth } from '@/lib/hooks';
import { formatCurrency, getFullName, getInitials, cn } from '@/lib/utils';
import { CardSkeleton } from '@/components/ui/loading';

const specializations = [
  'All Specializations',
  'Career Coaching',
  'Leadership',
  'Tech & Engineering',
  'Product Management',
  'Entrepreneurship',
  'Marketing',
  'Finance',
  'Work-Life Balance',
  'Personal Branding',
];

const sortOptions = [
  { value: 'rating', label: 'Highest Rated' },
  { value: 'sessions', label: 'Most Sessions' },
  { value: 'price_low', label: 'Price: Low to High' },
  { value: 'price_high', label: 'Price: High to Low' },
];

export default function MentorsPage() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecialization, setSelectedSpecialization] = useState('All Specializations');
  const [sortBy, setSortBy] = useState('rating');
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading } = useMentors({
    search: searchQuery,
    specialization: selectedSpecialization !== 'All Specializations' ? selectedSpecialization : undefined,
    sortBy,
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Find Your Mentor
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Connect with experienced professionals who can guide your journey
          </p>
        </div>
        <Link
          href="/dashboard/mentors/become-mentor"
          className="btn-primary px-6 py-2.5 text-center"
        >
          Become a Mentor
        </Link>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search mentors by name, expertise, or company..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-10 w-full"
          />
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <select
              value={selectedSpecialization}
              onChange={(e) => setSelectedSpecialization(e.target.value)}
              className="input pr-10 appearance-none"
            >
              {specializations.map((spec) => (
                <option key={spec} value={spec}>
                  {spec}
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

      {/* Mentors Grid */}
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
        ) : data?.mentors?.length ? (
          data.mentors.map((mentor: any) => (
            <div key={mentor.id} className="card hover:shadow-lg transition-shadow">
              {/* Mentor Header */}
              <div className="flex items-start space-x-4 mb-4">
                <div className="relative">
                  {mentor.user?.profile?.avatarUrl ? (
                    <img
                      src={mentor.user.profile.avatarUrl}
                      alt={getFullName(mentor.user?.firstName || '', mentor.user?.lastName || '')}
                      className="w-16 h-16 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-primary-600 font-semibold text-xl">
                      {getInitials(mentor.user?.firstName || '', mentor.user?.lastName || '')}
                    </div>
                  )}
                  {mentor.verified && (
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                      <Award className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                    {getFullName(mentor.user?.firstName || '', mentor.user?.lastName || '')}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                    {mentor.title || mentor.user?.profile?.headline || 'Mentor'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                    {mentor.company}
                  </p>
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center space-x-4 mb-4 text-sm">
                <div className="flex items-center text-yellow-500">
                  <Star className="w-4 h-4 fill-current mr-1" />
                  <span className="font-medium">{mentor.rating?.toFixed(1) || '5.0'}</span>
                  <span className="text-gray-400 ml-1">({mentor.reviewCount || 0})</span>
                </div>
                <div className="flex items-center text-gray-500 dark:text-gray-400">
                  <Users className="w-4 h-4 mr-1" />
                  <span>{mentor.sessionCount || 0} sessions</span>
                </div>
              </div>

              {/* Specializations */}
              <div className="flex flex-wrap gap-2 mb-4">
                {mentor.specializations?.slice(0, 3).map((spec: string, index: number) => (
                  <span
                    key={index}
                    className="px-2 py-1 text-xs font-medium bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full"
                  >
                    {spec}
                  </span>
                ))}
                {mentor.specializations?.length > 3 && (
                  <span className="px-2 py-1 text-xs font-medium text-gray-500">
                    +{mentor.specializations.length - 3} more
                  </span>
                )}
              </div>

              {/* Bio */}
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 line-clamp-3">
                {mentor.bio || 'Passionate about helping others grow in their careers.'}
              </p>

              {/* Pricing & Availability */}
              <div className="flex items-center justify-between text-sm mb-4">
                <div className="flex items-center text-gray-500 dark:text-gray-400">
                  <Clock className="w-4 h-4 mr-1" />
                  <span>{mentor.sessionDuration || 60} min</span>
                </div>
                <div className="font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(mentor.hourlyRate || 100)}/session
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center space-x-2">
                <Link
                  href={`/dashboard/mentors/${mentor.id}`}
                  className="flex-1 btn-outline py-2 text-center text-sm"
                >
                  View Profile
                </Link>
                <Link
                  href={`/dashboard/mentors/${mentor.id}`}
                  className="flex-1 btn-primary py-2 text-center text-sm"
                >
                  Book Session
                </Link>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full card text-center py-12">
            <Users className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No mentors found
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Try adjusting your search or filters
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedSpecialization('All Specializations');
              }}
              className="btn-outline px-4 py-2"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* Become a Mentor CTA */}
      <div className="card bg-gradient-to-r from-primary-600 to-secondary-600 text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-xl font-bold mb-2">Share Your Knowledge</h2>
            <p className="text-white/80">
              Join ATHENA as a mentor and help other women achieve their career goals.
              Set your own rates and schedule.
            </p>
          </div>
          <Link
            href="/dashboard/mentors/become-mentor"
            className="btn bg-white text-primary-600 hover:bg-gray-100 px-6 py-3 flex-shrink-0"
          >
            Apply to Mentor
          </Link>
        </div>
      </div>
    </div>
  );
}
