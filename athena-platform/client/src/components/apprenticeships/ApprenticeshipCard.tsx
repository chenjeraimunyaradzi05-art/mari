'use client';

import { MapPin, Clock, DollarSign, GraduationCap, Building2, Bookmark, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Apprenticeship,
  daysUntil,
  durationLabel,
  levelLabel,
  locationLabel,
  positionsLeft,
  primaryOrg,
  wageLabel,
} from './types';

export type { Apprenticeship } from './types';

interface ApprenticeshipCardProps {
  apprenticeship: Apprenticeship;
  onApply: (id: string) => void;
  onBookmark: (id: string) => void;
  onShare: (id: string) => void;
  onClick?: (id: string) => void;
  variant?: 'default' | 'compact';
}

// Higher AQF levels read as further along, so the colour ramps with the level
// rather than mapping three invented tiers.
function levelClass(level: string) {
  switch (level) {
    case 'CERTIFICATE_I':
    case 'CERTIFICATE_II':
      return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
    case 'CERTIFICATE_III':
    case 'CERTIFICATE_IV':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
    case 'DIPLOMA':
    case 'ADVANCED_DIPLOMA':
      return 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300';
    default:
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
  }
}

export function ApprenticeshipCard({
  apprenticeship,
  onApply,
  onBookmark,
  onShare,
  onClick,
  variant = 'default',
}: ApprenticeshipCardProps) {
  const org = primaryOrg(apprenticeship);
  const orgName = org?.name ?? 'Employer to be confirmed';
  const deadlineDays = daysUntil(apprenticeship.applicationDeadline);
  const wage = wageLabel(apprenticeship);
  const left = positionsLeft(apprenticeship);

  if (variant === 'compact') {
    return (
      <Card
        className={cn(
          'p-4 cursor-pointer hover:shadow-md transition-shadow',
          apprenticeship.isFeatured && 'ring-2 ring-rose-500'
        )}
        onClick={() => onClick?.(apprenticeship.id)}
      >
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
            {org?.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={org.logo} alt={orgName} className="w-10 h-10 rounded object-cover" />
            ) : (
              <Building2 className="w-6 h-6 text-slate-400" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-900 dark:text-white truncate">
              {apprenticeship.title}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{orgName}</p>
            <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
              <MapPin className="w-3 h-3" />
              {locationLabel(apprenticeship)}
            </div>
          </div>

          <button
            type="button"
            aria-label={apprenticeship.isBookmarked ? 'Remove bookmark' : 'Bookmark'}
            onClick={(e) => {
              e.stopPropagation();
              onBookmark(apprenticeship.id);
            }}
            className="p-1"
          >
            <Bookmark
              className={cn(
                'w-5 h-5',
                apprenticeship.isBookmarked ? 'text-rose-500 fill-current' : 'text-slate-400'
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
        apprenticeship.isFeatured && 'ring-2 ring-rose-500 relative'
      )}
      onClick={() => onClick?.(apprenticeship.id)}
    >
      {apprenticeship.isFeatured && (
        <div className="absolute top-0 right-4 -translate-y-1/2 bg-rose-600 text-white text-xs font-medium px-2 py-0.5 rounded">
          Featured
        </div>
      )}

      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
            {org?.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={org.logo} alt={orgName} className="w-12 h-12 rounded-lg object-cover" />
            ) : (
              <Building2 className="w-7 h-7 text-slate-400" />
            )}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-lg text-slate-900 dark:text-white">
              {apprenticeship.title}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{orgName}</p>
            {/* Who awards the qualification is a different question from who you
                work for, and an apprentice needs both. */}
            {apprenticeship.rto && apprenticeship.rto.id !== org?.id && (
              <p className="text-xs text-slate-400 truncate">
                Qualification awarded by {apprenticeship.rto.name}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            aria-label={apprenticeship.isBookmarked ? 'Remove bookmark' : 'Bookmark'}
            onClick={(e) => {
              e.stopPropagation();
              onBookmark(apprenticeship.id);
            }}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Bookmark
              className={cn(
                'w-5 h-5',
                apprenticeship.isBookmarked ? 'text-rose-500 fill-current' : 'text-slate-400'
              )}
            />
          </button>
          <button
            type="button"
            aria-label="Share"
            onClick={(e) => {
              e.stopPropagation();
              onShare(apprenticeship.id);
            }}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Share2 className="w-5 h-5 text-slate-400" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <Badge className={levelClass(String(apprenticeship.level))}>
          {levelLabel(String(apprenticeship.level))}
        </Badge>
        {apprenticeship.framework && <Badge variant="outline">{apprenticeship.framework}</Badge>}
        {apprenticeship.isRemote && (
          <Badge variant="outline" className="border-green-500 text-green-600">
            Remote
          </Badge>
        )}
      </div>

      <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2 mb-4">
        {apprenticeship.description}
      </p>

      <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
        <div className="flex items-center gap-2 text-slate-500">
          <MapPin className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">{locationLabel(apprenticeship)}</span>
        </div>
        {apprenticeship.durationMonths > 0 && (
          <div className="flex items-center gap-2 text-slate-500">
            <Clock className="w-4 h-4 flex-shrink-0" />
            <span>{durationLabel(apprenticeship.durationMonths)}</span>
          </div>
        )}
        {wage && (
          <div className="flex items-center gap-2 text-slate-500">
            <DollarSign className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{wage}</span>
          </div>
        )}
        {apprenticeship.positions > 1 && (
          <div className="flex items-center gap-2 text-slate-500">
            <GraduationCap className="w-4 h-4 flex-shrink-0" />
            <span>
              {left} of {apprenticeship.positions} place{apprenticeship.positions === 1 ? '' : 's'} left
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
        <div className="text-sm">
          {deadlineDays !== null && deadlineDays > 0 ? (
            <span className={cn(deadlineDays <= 7 ? 'text-orange-600' : 'text-slate-500')}>
              {deadlineDays} day{deadlineDays === 1 ? '' : 's'} left to apply
            </span>
          ) : deadlineDays !== null ? (
            <span className="text-red-500">Applications closed</span>
          ) : (
            <span className="text-slate-500">Open until filled</span>
          )}
        </div>
        <Button
          onClick={(e) => {
            e.stopPropagation();
            onApply(apprenticeship.id);
          }}
          disabled={left === 0 || (deadlineDays !== null && deadlineDays <= 0)}
        >
          Apply
        </Button>
      </div>
    </Card>
  );
}

export default ApprenticeshipCard;
