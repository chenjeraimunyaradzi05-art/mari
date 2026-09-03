'use client';

import { Heart, Star, Clock, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import {
  SkillService,
  categoryLabel,
  formatAud,
  providerInitials,
  providerName,
  quickestDelivery,
  startingPrice,
} from './types';

export type { SkillService, ServicePackage } from './types';

interface ServiceCardProps {
  service: SkillService;
  onFavorite: (id: string) => void;
  onShare: (id: string) => void;
  onClick?: (id: string) => void;
  variant?: 'default' | 'compact' | 'horizontal';
}

// A service with no reviews yet shows "New" rather than a fabricated 0.0 stars.
function RatingLine({ service, small = false }: { service: SkillService; small?: boolean }) {
  const hasRating = typeof service.rating === 'number' && (service.reviewCount ?? 0) > 0;

  if (!hasRating) {
    return (
      <span className={cn('text-slate-500', small ? 'text-xs' : 'text-sm')}>New service</span>
    );
  }

  return (
    <span className="flex items-center gap-1">
      <Star className={cn('text-yellow-400 fill-current', small ? 'w-3 h-3' : 'w-4 h-4')} />
      <span className={cn('font-medium', small ? 'text-xs' : 'text-sm')}>
        {(service.rating as number).toFixed(1)}
      </span>
      {!small && <span className="text-sm text-slate-500">({service.reviewCount})</span>}
    </span>
  );
}

function PriceLine({ service }: { service: SkillService }) {
  const start = startingPrice(service);
  if (!start) return <span className="font-semibold">Rate on request</span>;
  return (
    <span className="font-semibold text-slate-900 dark:text-white">
      {formatAud(start.amount)}
      <span className="ml-1 text-xs font-normal text-slate-500">/ {start.unit}</span>
    </span>
  );
}

export function ServiceCard({
  service,
  onFavorite,
  onShare,
  onClick,
  variant = 'default',
}: ServiceCardProps) {
  const delivery = quickestDelivery(service);
  const name = providerName(service);
  const tags = service.tags ?? [];

  const favoriteButton = (className: string, iconClass: string) => (
    <button
      type="button"
      aria-label={service.isFavorite ? 'Remove from saved' : 'Save service'}
      onClick={(e) => {
        e.stopPropagation();
        onFavorite(service.id);
      }}
      className={className}
    >
      <Heart
        className={cn(iconClass, service.isFavorite ? 'text-red-500 fill-current' : 'text-slate-400')}
      />
    </button>
  );

  if (variant === 'horizontal') {
    return (
      <Card
        className="flex overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
        onClick={() => onClick?.(service.id)}
      >
        <div className="flex-1 p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-medium text-slate-900 dark:text-white line-clamp-2">
                {service.title}
              </h3>
              {favoriteButton('p-1 flex-shrink-0', 'w-5 h-5')}
            </div>
            <p className="mt-1 text-sm text-slate-500 truncate">{name}</p>
            <div className="flex items-center gap-2 mt-1">
              <RatingLine service={service} />
            </div>
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-sm text-slate-500">
              <Clock className="w-3 h-3 inline mr-1" />
              {delivery !== null ? `${delivery} day delivery` : 'Booked by the hour'}
            </span>
            <PriceLine service={service} />
          </div>
        </div>
      </Card>
    );
  }

  if (variant === 'compact') {
    return (
      <Card
        className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => onClick?.(service.id)}
      >
        <div className="p-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium text-slate-900 dark:text-white text-sm line-clamp-2">
              {service.title}
            </h3>
            {favoriteButton('p-1 flex-shrink-0', 'w-4 h-4')}
          </div>
          <p className="mt-1 truncate text-xs text-slate-500">{name}</p>
          <div className="mt-2 flex items-center justify-between">
            <RatingLine service={service} small />
            <PriceLine service={service} />
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card
      className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
      onClick={() => onClick?.(service.id)}
    >
      <div className="p-4">
        {/* Provider. A SkillService has no cover image, so the person offering
            it leads the card rather than a grey "No image" placeholder. */}
        <div className="flex items-center gap-2 mb-3">
          <Avatar
            src={service.provider?.avatar ?? undefined}
            fallback={providerInitials(service)}
            size="sm"
          />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-slate-900 dark:text-white truncate">{name}</p>
            {service.provider?.headline && (
              <p className="truncate text-xs text-slate-500">{service.provider.headline}</p>
            )}
          </div>
          {favoriteButton(
            'p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex-shrink-0',
            'w-5 h-5'
          )}
        </div>

        <div className="mb-2">
          <Badge variant="outline">{categoryLabel(String(service.category))}</Badge>
        </div>

        <h3 className="font-medium text-slate-900 dark:text-white line-clamp-2 mb-2 min-h-[2.5rem]">
          {service.title}
        </h3>

        <div className="flex items-center gap-2 mb-3">
          <RatingLine service={service} />
          {(service.completedCount ?? 0) > 0 && (
            <span className="flex items-center gap-1 text-sm text-slate-500">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {service.completedCount} completed
            </span>
          )}
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1 text-sm text-slate-500">
            <Clock className="w-4 h-4" />
            <span>{delivery !== null ? `${delivery} day delivery` : 'Booked by the hour'}</span>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">From</p>
            <PriceLine service={service} />
          </div>
        </div>
      </div>
    </Card>
  );
}

export default ServiceCard;
