'use client';

import { Star, Clock, CheckCircle, Heart, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

export interface ServicePackage {
  name: string;
  description: string;
  price: number;
  deliveryDays: number;
  revisions?: number;
  features: string[];
}

export interface SkillService {
  id: string;
  title: string;
  description: string;
  seller: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
    level?: 'new' | 'rising' | 'top' | 'pro';
    rating: number;
    reviewCount: number;
    completedOrders: number;
  };
  category: string;
  subcategory?: string;
  packages: ServicePackage[];
  images: string[];
  tags: string[];
  rating: number;
  reviewCount: number;
  ordersInQueue?: number;
  isFavorite: boolean;
  isFeatured?: boolean;
  createdAt: string;
}

interface ServiceCardProps {
  service: SkillService;
  onFavorite: (id: string) => void;
  onShare: (id: string) => void;
  onClick?: (id: string) => void;
  variant?: 'default' | 'compact' | 'horizontal';
}

export function ServiceCard({
  service,
  onFavorite,
  onShare,
  onClick,
  variant = 'default',
}: ServiceCardProps) {
  const startingPrice = Math.min(...service.packages.map((p) => p.price));
  const quickestDelivery = Math.min(...service.packages.map((p) => p.deliveryDays));

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const getSellerLevelBadge = (level?: string) => {
    switch (level) {
      case 'pro':
        return <Badge className="bg-purple-100 text-purple-700">Pro</Badge>;
      case 'top':
        return <Badge className="bg-amber-100 text-amber-700">Top Rated</Badge>;
      case 'rising':
        return <Badge className="bg-green-100 text-green-700">Rising Star</Badge>;
      default:
        return null;
    }
  };

  if (variant === 'horizontal') {
    return (
      <Card
        className="flex overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
        onClick={() => onClick?.(service.id)}
      >
        {/* Image */}
        <div className="w-48 h-32 flex-shrink-0 bg-gray-100 dark:bg-gray-800">
          {service.images[0] ? (
            <img
              src={service.images[0]}
              alt={service.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              No image
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between">
              <h3 className="font-medium text-gray-900 dark:text-white line-clamp-2">
                {service.title}
              </h3>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onFavorite(service.id);
                }}
                className="p-1"
              >
                <Heart
                  className={cn(
                    'w-5 h-5',
                    service.isFavorite ? 'text-red-500 fill-current' : 'text-gray-400'
                  )}
                />
              </button>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 text-yellow-400 fill-current" />
                <span className="text-sm font-medium">{service.rating.toFixed(1)}</span>
                <span className="text-sm text-gray-500">({service.reviewCount})</span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-sm text-gray-500">
              <Clock className="w-3 h-3 inline mr-1" />
              {quickestDelivery}d delivery
            </span>
            <span className="font-semibold text-gray-900 dark:text-white">
              From {formatPrice(startingPrice)}
            </span>
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
        {/* Image */}
        <div className="aspect-video bg-gray-100 dark:bg-gray-800 relative">
          {service.images[0] ? (
            <img
              src={service.images[0]}
              alt={service.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              No image
            </div>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onFavorite(service.id);
            }}
            className="absolute top-2 right-2 p-1.5 bg-white/80 dark:bg-gray-900/80 rounded-full"
          >
            <Heart
              className={cn(
                'w-4 h-4',
                service.isFavorite ? 'text-red-500 fill-current' : 'text-gray-600'
              )}
            />
          </button>
        </div>

        {/* Content */}
        <div className="p-3">
          <h3 className="font-medium text-gray-900 dark:text-white text-sm line-clamp-2 mb-2">
            {service.title}
          </h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Star className="w-3 h-3 text-yellow-400 fill-current" />
              <span className="text-xs font-medium">{service.rating.toFixed(1)}</span>
            </div>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {formatPrice(startingPrice)}
            </span>
          </div>
        </div>
      </Card>
    );
  }

  // Default variant
  return (
    <Card
      className={cn(
        'overflow-hidden cursor-pointer hover:shadow-lg transition-shadow',
        service.isFeatured && 'ring-2 ring-primary-500'
      )}
      onClick={() => onClick?.(service.id)}
    >
      {/* Image carousel */}
      <div className="aspect-video bg-gray-100 dark:bg-gray-800 relative">
        {service.images[0] ? (
          <img
            src={service.images[0]}
            alt={service.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            No image
          </div>
        )}

        {/* Favorite button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onFavorite(service.id);
          }}
          className="absolute top-3 right-3 p-2 bg-white/90 dark:bg-gray-900/90 rounded-full shadow-sm hover:bg-white dark:hover:bg-gray-900 transition-colors"
        >
          <Heart
            className={cn(
              'w-5 h-5',
              service.isFavorite ? 'text-red-500 fill-current' : 'text-gray-600'
            )}
          />
        </button>

        {/* Featured badge */}
        {service.isFeatured && (
          <div className="absolute top-3 left-3 bg-primary-500 text-white text-xs font-medium px-2 py-1 rounded">
            Featured
          </div>
        )}

        {/* Image count indicator */}
        {service.images.length > 1 && (
          <div className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded">
            1/{service.images.length}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Seller info */}
        <div className="flex items-center gap-2 mb-3">
          <Avatar
            src={service.seller.avatarUrl}
            fallback={`${service.seller.firstName[0]}${service.seller.lastName[0]}`}
            size="sm"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className="font-medium text-sm text-gray-900 dark:text-white truncate">
                {service.seller.firstName} {service.seller.lastName}
              </span>
              {getSellerLevelBadge(service.seller.level)}
            </div>
          </div>
        </div>

        {/* Title */}
        <h3 className="font-medium text-gray-900 dark:text-white line-clamp-2 mb-2 min-h-[2.5rem]">
          {service.title}
        </h3>

        {/* Rating */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 text-yellow-400 fill-current" />
            <span className="font-medium text-sm">{service.rating.toFixed(1)}</span>
          </div>
          <span className="text-sm text-gray-500">({service.reviewCount} reviews)</span>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1 mb-3">
          {service.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs rounded"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-1 text-sm text-gray-500">
            <Clock className="w-4 h-4" />
            <span>{quickestDelivery}d delivery</span>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Starting at</p>
            <p className="font-semibold text-lg text-gray-900 dark:text-white">
              {formatPrice(startingPrice)}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default ServiceCard;
