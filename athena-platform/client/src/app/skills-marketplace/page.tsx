'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ServiceCard,
  MarketplaceFiltersBar,
  OrderModal,
  SkillService,
  MarketplaceFilters,
} from '@/components/skills-marketplace';
import { categoryLabel } from '@/components/skills-marketplace/types';
import { skillsMarketplaceApi } from '@/lib/api-extensions';
import { PageShell, PageHero, EmptyState } from '@/components/layout/PageShell';
import { Loader2, Sparkles, TrendingUp, Clock, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PAGE_SIZE = 12;

export default function SkillsMarketplacePage() {
  const router = useRouter();
  const [services, setServices] = useState<SkillService[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filters, setFilters] = useState<MarketplaceFilters>({
    search: '',
    category: '',
    subcategory: '',
    deliveryTime: '',
    sellerLevel: [],
    sortBy: 'recommended',
  });
  const [selectedService, setSelectedService] = useState<SkillService | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalResults, setTotalResults] = useState(0);

  const hasMarketplaceFilters = Boolean(
    filters.search ||
      filters.category ||
      filters.subcategory ||
      filters.deliveryTime ||
      filters.sellerLevel.length ||
      filters.minPrice ||
      filters.maxPrice ||
      filters.minRating
  );

  // Categories come from the server, which returns the five real
  // ServiceCategory enum values with live counts. The page used to hardcode six
  // marketing names ("Design & Creative", "Programming & Tech", …) and send the
  // display string as the category, which Prisma rejected as an invalid enum —
  // a 500, not an empty list.
  const [categories, setCategories] = useState<
    { value: string; label: string; count: number }[]
  >([]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await skillsMarketplaceApi.getCategories();
        const data = response.data?.data;
        setCategories(
          Array.isArray(data)
            ? data.map((c: { category: string; count: number }) => ({
                value: c.category,
                label: categoryLabel(c.category),
                count: c.count,
              }))
            : []
        );
      } catch (error) {
        console.error('Failed to fetch service categories:', error);
      }
    };
    fetchCategories();
  }, []);

  // Fetch services
  const fetchServices = useCallback(async (pageNum: number, reset: boolean = false) => {
    try {
      setLoading(true);
      // The route reads minRate/maxRate, not minPrice/maxPrice, and reads
      // neither deliveryTime nor rating — sending those did nothing.
      const response = await skillsMarketplaceApi.getServices({
        page: pageNum,
        limit: PAGE_SIZE,
        search: filters.search || undefined,
        category: filters.category || undefined,
        minRate: filters.minPrice,
        maxRate: filters.maxPrice,
      });

      // `{ success, data: [...], pagination }` — data is the array. This used
      // to read `data.services` and `data.total`, keys that have never
      // existed, so the grid was permanently empty and the count always 0.
      const payload = response.data;
      const data: SkillService[] = Array.isArray(payload?.data) ? payload.data : [];
      const pagination = payload?.pagination;

      if (reset) {
        setServices(data);
      } else {
        setServices((prev) => [...prev, ...data]);
      }

      setTotalResults(pagination?.total ?? data.length);
      setHasMore(pagination ? pagination.page < pagination.pages : data.length === PAGE_SIZE);
    } catch (error) {
      console.error('Failed to fetch services:', error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Initial load and filter changes
  useEffect(() => {
    setPage(1);
    fetchServices(1, true);
  }, [fetchServices]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchServices(nextPage);
  };

  const handleFavorite = async (id: string) => {
    try {
      const service = services.find((s) => s.id === id);
      if (service?.isFavorite) {
        await skillsMarketplaceApi.unfavoriteService(id);
      } else {
        await skillsMarketplaceApi.favoriteService(id);
      }

      setServices((prev) =>
        prev.map((s) => (s.id === id ? { ...s, isFavorite: !s.isFavorite } : s))
      );
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  const handleShare = async (id: string) => {
    try {
      await navigator.share({
        title: 'Check out this service on Athena',
        url: `${window.location.origin}/skills-marketplace/${id}`,
      });
    } catch {
      navigator.clipboard.writeText(`${window.location.origin}/skills-marketplace/${id}`);
    }
  };

  const handleServiceClick = (id: string) => {
    router.push(`/skills-marketplace/${id}`);
  };

  const handleOrder = (id: string) => {
    const service = services.find((s) => s.id === id);
    if (service) {
      setSelectedService(service);
      setShowOrderModal(true);
    }
  };

  const handleOrderSubmit = async (packageIndex: number, requirements: string) => {
    if (!selectedService) return;
    
    await skillsMarketplaceApi.placeOrder(selectedService.id, {
      packageIndex,
      requirements,
    });
  };

  return (
    <PageShell width="wide">
      <PageHero
        kicker="Skills marketplace"
        title="Hire a woman who has done it before"
        description="Members offering what they are good at — by the hour or as a fixed package. You see the rate before you get in touch, and the money moves through Stripe."
        primaryAction={{ label: 'Browse services', href: '#all-services' }}
        secondaryAction={{ label: 'Offer your own', href: '/dashboard/creator' }}
      />
      <div className="mt-3 text-sm">
        <Link href="/skills-marketplace/orders" className="font-medium text-primary-600 hover:underline">
          Your orders
        </Link>
        <span className="text-slate-400"> · what you have bought and what you are delivering</span>
      </div>

      {/* Popular Categories */}
      <div className="mt-8">
        <h2 className="rail-title mb-3">Browse by category</h2>
        <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setFilters({ ...filters, category: cat.value })}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                filters.category === cat.value
                  ? 'bg-rose-600 text-white'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-rose-400'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div id="all-services" className="mt-2">
        {/* Filters */}
        <section className="mb-8">
          <MarketplaceFiltersBar
            filters={filters}
            onFiltersChange={setFilters}
            categories={categories}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            resultCount={totalResults}
          />
        </section>

        {/* Results */}
        {loading && services.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
          </div>
        ) : services.length === 0 ? (
          // Nobody has listed a service yet, so most visitors see this and
          // not the filtered case — telling them to adjust filters they
          // never set sends them looking for listings that are not there.
          <EmptyState
            icon={Sparkles}
            reason={hasMarketplaceFilters ? 'filtered' : 'empty'}
            title={
              hasMarketplaceFilters
                ? 'Nothing matches those filters'
                : 'No services listed yet'
            }
            description={
              hasMarketplaceFilters
                ? 'Widen the search and see who else is offering work.'
                : 'This is where members sell what they are good at — by the hour or as a fixed package. Nobody has listed one yet, so it is wide open.'
            }
            onClear={() =>
              setFilters({
                search: '',
                category: '',
                subcategory: '',
                deliveryTime: '',
                sellerLevel: [],
                sortBy: 'recommended',
              })
            }
            primaryAction={
              hasMarketplaceFilters ? undefined : { label: 'Offer a service', href: '/dashboard/creator' }
            }
            secondaryAction={
              hasMarketplaceFilters ? undefined : { label: 'Post what you need instead', href: '/dashboard/rfps' }
            }
          />
        ) : (
          <>
            <div
              className={
                viewMode === 'grid'
                  ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
                  : 'space-y-4'
              }
            >
              {services.map((service) => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  variant={viewMode === 'list' ? 'horizontal' : 'default'}
                  onFavorite={handleFavorite}
                  onShare={handleShare}
                  onClick={handleServiceClick}
                />
              ))}
            </div>

            {hasMore && (
              <div className="flex justify-center mt-8">
                <Button variant="outline" onClick={handleLoadMore} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Load More'
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Order Modal */}
      {selectedService && (
        <OrderModal
          isOpen={showOrderModal}
          onClose={() => {
            setShowOrderModal(false);
            setSelectedService(null);
          }}
          service={selectedService}
          onOrder={handleOrderSubmit}
        />
      )}
    </PageShell>
  );
}
