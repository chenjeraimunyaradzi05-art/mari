'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Heart,
  Loader2,
  RefreshCw,
  Share2,
  Sparkles,
  Star,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { OrderModal } from '@/components/skills-marketplace';
import {
  SkillService,
  categoryLabel,
  formatAud,
  providerInitials,
  providerName,
  readPackages,
} from '@/components/skills-marketplace/types';
import { skillsMarketplaceApi } from '@/lib/api-extensions';
import { BackToHome } from '@/components/layout/PageShell';
import { cn } from '@/lib/utils';

/**
 * The service detail page.
 *
 * `/skills-marketplace/[id]` was an empty directory, so every card click and
 * every shared link 404ed, while `GET /api/skills-marketplace/services/:id`
 * had been serving the row with its provider and reviews all along.
 */

interface ServiceReview {
  id: string;
  rating: number;
  comment?: string | null;
  createdAt: string;
  clientId?: string;
}

export default function ServiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id ?? '');

  const [service, setService] = useState<SkillService | null>(null);
  const [reviews, setReviews] = useState<ServiceReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showOrder, setShowOrder] = useState(false);
  const [shareLabel, setShareLabel] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const response = await skillsMarketplaceApi.getService(id);
      const data = response.data?.data;
      if (data) {
        setService(data);
        setReviews(Array.isArray(data.reviews) ? data.reviews : []);
      } else {
        setNotFound(true);
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleFavorite = async () => {
    if (!service) return;
    const next = !service.isFavorite;
    setService({ ...service, isFavorite: next });
    try {
      if (next) {
        await skillsMarketplaceApi.favoriteService(service.id);
      } else {
        await skillsMarketplaceApi.unfavoriteService(service.id);
      }
    } catch {
      setService((current) => (current ? { ...current, isFavorite: !next } : current));
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: service?.title ?? 'Service', url });
        return;
      }
      throw new Error('no share');
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        setShareLabel('Link copied');
        setTimeout(() => setShareLabel(null), 2000);
      } catch {
        setShareLabel('Could not copy');
        setTimeout(() => setShareLabel(null), 2000);
      }
    }
  };

  const handleOrder = async (packageIndex: number, requirements: string) => {
    if (!service) return;
    await skillsMarketplaceApi.placeOrder(service.id, { packageIndex, requirements });
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-rose-500" />
      </div>
    );
  }

  if (notFound || !service) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <Sparkles className="mx-auto mb-4 h-12 w-12 text-slate-300" />
        <h1 className="mb-2 text-xl font-semibold text-slate-900 dark:text-white">
          This service is no longer listed
        </h1>
        <p className="mb-6 text-slate-500">
          The provider may have paused or withdrawn it since you saw the link.
        </p>
        <Button onClick={() => router.push('/skills-marketplace')}>Browse the marketplace</Button>
      </div>
    );
  }

  const packages = readPackages(service.packages);
  const hasRating = typeof service.rating === 'number' && (service.reviewCount ?? 0) > 0;
  const name = providerName(service);

  return (
    <div className="min-h-screen bg-white text-slate-950 dark:bg-slate-950 dark:text-white">
      <div className="container mx-auto max-w-5xl px-4 py-8">
        {/* Two ways out: back to the list you were browsing, and back to the
            front page — a shared link can land someone here with no history. */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <BackToHome />
          <Link
            href="/skills-marketplace"
            className="focusable inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4" />
            All services
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="surface p-6">
              <Badge variant="outline" className="mb-3">
                {categoryLabel(String(service.category))}
              </Badge>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{service.title}</h1>

              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                {hasRating ? (
                  <span className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-current text-yellow-400" />
                    <span className="font-medium">{(service.rating as number).toFixed(1)}</span>
                    <span className="text-slate-500">({service.reviewCount} reviews)</span>
                  </span>
                ) : (
                  <span className="text-slate-500">No reviews yet</span>
                )}
                {(service.completedCount ?? 0) > 0 && (
                  <span className="flex items-center gap-1 text-slate-500">
                    <CheckCircle2 className="h-4 w-4" />
                    {service.completedCount} completed
                  </span>
                )}
              </div>

              <p className="mt-6 whitespace-pre-line text-sm leading-6 text-slate-600 dark:text-slate-300">
                {service.description}
              </p>

              {(service.tags?.length ?? 0) > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {service.tags!.map((tag) => (
                    <span
                      key={tag}
                      className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {packages.length > 0 && (
              <div className="surface p-6">
                <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
                  What you can book
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {packages.map((pkg, i) => (
                    <div
                      key={`${pkg.name}-${i}`}
                      className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <h3 className="font-medium text-slate-900 dark:text-white">{pkg.name}</h3>
                        <span className="font-semibold">{formatAud(pkg.price)}</span>
                      </div>
                      {pkg.description && (
                        <p className="mt-1 text-sm text-slate-500">{pkg.description}</p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                        {pkg.deliveryDays > 0 && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {pkg.deliveryDays} day delivery
                          </span>
                        )}
                        {pkg.revisions !== undefined && (
                          <span className="flex items-center gap-1">
                            <RefreshCw className="h-3.5 w-3.5" />
                            {pkg.revisions === -1
                              ? 'Unlimited revisions'
                              : `${pkg.revisions} revision${pkg.revisions === 1 ? '' : 's'}`}
                          </span>
                        )}
                      </div>
                      {(pkg.features?.length ?? 0) > 0 && (
                        <ul className="mt-3 space-y-1">
                          {pkg.features!.map((feature, fi) => (
                            <li key={fi} className="flex items-start gap-2 text-sm">
                              <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
                              <span className="text-slate-600 dark:text-slate-300">{feature}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {reviews.length > 0 && (
              <div className="surface p-6">
                <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
                  Reviews
                </h2>
                <ul className="space-y-4">
                  {reviews.slice(0, 10).map((review) => (
                    <li
                      key={review.id}
                      className="border-b border-slate-100 pb-4 last:border-b-0 last:pb-0 dark:border-slate-800"
                    >
                      <div className="flex items-center gap-1">
                        {Array.from({ length: 5 }, (_, i) => (
                          <Star
                            key={i}
                            className={cn(
                              'h-3.5 w-3.5',
                              i < review.rating
                                ? 'fill-current text-yellow-400'
                                : 'text-slate-300 dark:text-slate-600'
                            )}
                          />
                        ))}
                        <span className="ml-2 text-xs text-slate-400">
                          {new Date(review.createdAt).toLocaleDateString('en-AU')}
                        </span>
                      </div>
                      {review.comment && (
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                          {review.comment}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <aside className="lg:sticky lg:top-6 lg:h-fit">
            <div className="surface p-6">
              <Link
                href={`/profile/${service.provider?.id ?? ''}`}
                className="flex items-center gap-3"
              >
                <Avatar
                  src={service.provider?.avatar ?? undefined}
                  fallback={providerInitials(service)}
                  size="md"
                />
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 dark:text-white">{name}</p>
                  {service.provider?.headline && (
                    <p className="truncate text-xs text-slate-500">{service.provider.headline}</p>
                  )}
                </div>
              </Link>

              <div className="mt-5 border-t border-slate-100 pt-5 dark:border-slate-800">
                <p className="text-xs uppercase tracking-wide text-slate-400">Hourly rate</p>
                <p className="text-2xl font-semibold text-slate-900 dark:text-white">
                  {formatAud(service.hourlyRate)}
                  <span className="ml-1 text-sm font-normal text-slate-500">/ hour</span>
                </p>
                {service.minimumHours && service.minimumHours > 1 && (
                  <p className="mt-1 text-xs text-slate-500">
                    {service.minimumHours} hour minimum booking
                  </p>
                )}
              </div>

              <div className="mt-5 space-y-2">
                {packages.length > 0 ? (
                  <Button className="w-full" onClick={() => setShowOrder(true)}>
                    Choose a package
                  </Button>
                ) : (
                  /* Hourly-only services have nothing for the package modal to
                     sell, so the buyer is sent to the provider to arrange a time
                     rather than shown an empty picker. */
                  <Button
                    className="w-full"
                    onClick={() => router.push(`/dashboard/messages?user=${service.provider?.id ?? ''}`)}
                  >
                    Message about availability
                  </Button>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={handleFavorite}>
                    <Heart
                      className={cn(
                        'mr-2 h-4 w-4',
                        service.isFavorite && 'fill-current text-red-500'
                      )}
                    />
                    {service.isFavorite ? 'Saved' : 'Save'}
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={handleShare}>
                    <Share2 className="mr-2 h-4 w-4" />
                    {shareLabel ?? 'Share'}
                  </Button>
                </div>
              </div>

              {service.isAvailable === false && (
                <p className="mt-4 text-center text-sm text-orange-600">
                  Not taking new work right now
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>

      {showOrder && packages.length > 0 && (
        <OrderModal
          isOpen={showOrder}
          onClose={() => setShowOrder(false)}
          service={service}
          onOrder={handleOrder}
        />
      )}
    </div>
  );
}
