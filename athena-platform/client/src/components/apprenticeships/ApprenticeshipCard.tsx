'use client';

import { MapPin, Clock, Briefcase, DollarSign, GraduationCap, Building2, Bookmark, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export interface Apprenticeship {
  id: string;
  title: string;
  organization: {
    id: string;
    name: string;
    logoUrl?: string;
    isVerified?: boolean;
  };
  description: string;
  industry: string;
  level: 'entry' | 'intermediate' | 'advanced';
  duration: string; // e.g., "12 months"
  location: string;
  isRemote: boolean;
  salary?: {
    min: number;
    max: number;
    currency: string;
    period: 'hourly' | 'weekly' | 'monthly' | 'yearly';
  };
  skills: string[];
  requirements: string[];
  benefits: string[];
  applicationDeadline?: string;
  startDate?: string;
  spotsAvailable?: number;
  totalSpots?: number;
  isBookmarked: boolean;
  isFeatured?: boolean;
  createdAt: string;
}

interface ApprenticeshipCardProps {
  apprenticeship: Apprenticeship;
  onApply: (id: string) => void;
  onBookmark: (id: string) => void;
  onShare: (id: string) => void;
  onClick?: (id: string) => void;
  variant?: 'default' | 'compact';
}

export function ApprenticeshipCard({
  apprenticeship,
  onApply,
  onBookmark,
  onShare,
  onClick,
  variant = 'default',
}: ApprenticeshipCardProps) {
  const formatSalary = (salary: Apprenticeship['salary']) => {
    if (!salary) return null;
    const { min, max, currency, period } = salary;
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
    });
    return `${formatter.format(min)} - ${formatter.format(max)} / ${period}`;
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'entry':
        return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
      case 'intermediate':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
      case 'advanced':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const daysUntilDeadline = apprenticeship.applicationDeadline
    ? Math.ceil((new Date(apprenticeship.applicationDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  if (variant === 'compact') {
    return (
      <Card
        className={cn(
          'p-4 cursor-pointer hover:shadow-md transition-shadow',
          apprenticeship.isFeatured && 'ring-2 ring-primary-500'
        )}
        onClick={() => onClick?.(apprenticeship.id)}
      >
        <div className="flex items-start gap-3">
          {/* Logo */}
          <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
            {apprenticeship.organization.logoUrl ? (
              <img
                src={apprenticeship.organization.logoUrl}
                alt={apprenticeship.organization.name}
                className="w-10 h-10 rounded object-cover"
              />
            ) : (
              <Building2 className="w-6 h-6 text-gray-400" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-white truncate">
              {apprenticeship.title}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {apprenticeship.organization.name}
            </p>
            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
              <MapPin className="w-3 h-3" />
              {apprenticeship.isRemote ? 'Remote' : apprenticeship.location}
            </div>
          </div>

          {/* Bookmark */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onBookmark(apprenticeship.id);
            }}
            className="p-1"
          >
            <Bookmark
              className={cn(
                'w-5 h-5',
                apprenticeship.isBookmarked
                  ? 'text-primary-500 fill-current'
                  : 'text-gray-400'
              )}
            />
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        'p-6 cursor-pointer hover:shadow-lg transition-shadow',
        apprenticeship.isFeatured && 'ring-2 ring-primary-500 relative'
      )}
      onClick={() => onClick?.(apprenticeship.id)}
    >
      {apprenticeship.isFeatured && (
        <div className="absolute top-0 right-4 -translate-y-1/2 bg-primary-500 text-white text-xs font-medium px-2 py-0.5 rounded">
          Featured
        </div>
      )}

      <div className="flex items-start justify-between mb-4">
        {/* Logo and company */}
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            {apprenticeship.organization.logoUrl ? (
              <img
                src={apprenticeship.organization.logoUrl}
                alt={apprenticeship.organization.name}
                className="w-12 h-12 rounded-lg object-cover"
              />
            ) : (
              <Building2 className="w-7 h-7 text-gray-400" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
              {apprenticeship.title}
            </h3>
            <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
              <span>{apprenticeship.organization.name}</span>
              {apprenticeship.organization.isVerified && (
                <span className="bg-blue-500 rounded-full w-4 h-4 flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                  </svg>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onBookmark(apprenticeship.id);
            }}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <Bookmark
              className={cn(
                'w-5 h-5',
                apprenticeship.isBookmarked
                  ? 'text-primary-500 fill-current'
                  : 'text-gray-400'
              )}
            />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onShare(apprenticeship.id);
            }}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <Share2 className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Badge className={getLevelColor(apprenticeship.level)}>
          {apprenticeship.level.charAt(0).toUpperCase() + apprenticeship.level.slice(1)} Level
        </Badge>
        <Badge variant="outline">{apprenticeship.industry}</Badge>
        {apprenticeship.isRemote && (
          <Badge variant="outline" className="border-green-500 text-green-600">
            Remote
          </Badge>
        )}
      </div>

      {/* Description */}
      <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mb-4">
        {apprenticeship.description}
      </p>

      {/* Details */}
      <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
        <div className="flex items-center gap-2 text-gray-500">
          <MapPin className="w-4 h-4" />
          <span>{apprenticeship.isRemote ? 'Remote' : apprenticeship.location}</span>
        </div>
        <div className="flex items-center gap-2 text-gray-500">
          <Clock className="w-4 h-4" />
          <span>{apprenticeship.duration}</span>
        </div>
        {apprenticeship.salary && (
          <div className="flex items-center gap-2 text-gray-500">
            <DollarSign className="w-4 h-4" />
            <span>{formatSalary(apprenticeship.salary)}</span>
          </div>
        )}
        {apprenticeship.spotsAvailable !== undefined && (
          <div className="flex items-center gap-2 text-gray-500">
            <GraduationCap className="w-4 h-4" />
            <span>
              {apprenticeship.spotsAvailable} of {apprenticeship.totalSpots} spots left
            </span>
          </div>
        )}
      </div>

      {/* Skills */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {apprenticeship.skills.slice(0, 5).map((skill) => (
          <span
            key={skill}
            className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs rounded"
          >
            {skill}
          </span>
        ))}
        {apprenticeship.skills.length > 5 && (
          <span className="text-xs text-gray-500">
            +{apprenticeship.skills.length - 5} more
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-800">
        <div className="text-sm">
          {daysUntilDeadline !== null && daysUntilDeadline > 0 ? (
            <span className={cn(
              daysUntilDeadline <= 7 ? 'text-orange-600' : 'text-gray-500'
            )}>
              {daysUntilDeadline} days left to apply
            </span>
          ) : daysUntilDeadline !== null ? (
            <span className="text-red-500">Applications closed</span>
          ) : (
            <span className="text-gray-500">Open until filled</span>
          )}
        </div>
        <Button
          onClick={(e) => {
            e.stopPropagation();
            onApply(apprenticeship.id);
          }}
          disabled={daysUntilDeadline !== null && daysUntilDeadline <= 0}
        >
          Apply Now
        </Button>
      </div>
    </Card>
  );
}

export default ApprenticeshipCard;
